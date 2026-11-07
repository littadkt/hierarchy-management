"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  Camera,
  CameraOff,
  X,
  RefreshCw,
  Zap,
  ZapOff,
  AlertCircle,
  CheckCircle2,
  Lock,
  Radio,
  ArrowRight,
  Loader2,
  SwitchCamera,
} from "lucide-react";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";

interface CameraBarcodeScannerProps {
  isOpen: boolean;
  onScan: (code: string) => void;
  onClose: () => void;
}

interface CameraDeviceOption {
  id: string;
  label: string;
  isBack: boolean;
  isFront: boolean;
}

export const CameraBarcodeScanner: React.FC<CameraBarcodeScannerProps> = ({
  isOpen,
  onScan,
  onClose,
}) => {
  const [cameras, setCameras] = useState<CameraDeviceOption[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>("");
  const [activeFacingMode, setActiveFacingMode] = useState<"environment" | "user">("environment");
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [isStarting, setIsStarting] = useState<boolean>(false);
  const [error, setError] = useState<{
    type: "permission" | "busy" | "insecure" | "notfound" | "generic";
    message: string;
  } | null>(null);
  const [torchOn, setTorchOn] = useState<boolean>(false);
  const [hasTorch, setHasTorch] = useState<boolean>(false);
  const [manualCode, setManualCode] = useState<string>("");

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const containerId = "barcode-camera-viewport";
  const isStartingRef = useRef<boolean>(false);

  // Audio scan chime synthesizer
  const playScanChime = () => {
    try {
      const AudioContextClass =
        window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      const audioCtx = new AudioContextClass();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(880, audioCtx.currentTime); // 880 Hz (A5)
      osc.frequency.exponentialRampToValueAtTime(
        1320,
        audioCtx.currentTime + 0.12
      );
      gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.15);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.15);
    } catch {
      // Audio autoplay policy fallback
    }
  };

  // Safe camera track shutdown
  const stopCamera = useCallback(async () => {
    if (scannerRef.current) {
      try {
        if (scannerRef.current.isScanning) {
          await scannerRef.current.stop();
        }
        scannerRef.current.clear();
      } catch (err) {
        console.warn("[Scanner] Error during stop:", err);
      } finally {
        scannerRef.current = null;
        setIsScanning(false);
        setTorchOn(false);
        setHasTorch(false);
      }
    }

    // Force release all active MediaStream tracks in the container video elements
    try {
      const container = document.getElementById(containerId);
      if (container) {
        const videos = container.getElementsByTagName("video");
        for (let i = 0; i < videos.length; i++) {
          const video = videos[i];
          if (video && video.srcObject) {
            const stream = video.srcObject as MediaStream;
            stream.getTracks().forEach((track) => {
              track.enabled = false;
              track.stop();
            });
            video.srcObject = null;
          }
        }
      }
    } catch (_) {}
  }, [containerId]);

  // Main start scanner routine with robust multi-tiered iOS rear camera support
  const startScanner = useCallback(
    async (
      targetFacing: "environment" | "user" = "environment",
      preferredCamId?: string
    ) => {
      if (isStartingRef.current) return;
      isStartingRef.current = true;
      setIsStarting(true);
      setError(null);

      try {
        // 1. Insecure Context Check (Browsers block camera on plain HTTP over LAN)
        if (
          typeof window !== "undefined" &&
          !window.isSecureContext &&
          window.location.hostname !== "localhost" &&
          window.location.hostname !== "127.0.0.1"
        ) {
          setError({
            type: "insecure",
            message:
              "Browsers block camera access over plain HTTP connections on local IP. Access using localhost/127.0.0.1 or configure browser flags.",
          });
          setIsStarting(false);
          isStartingRef.current = false;
          return;
        }

        // 2. Browser MediaDevices Support Check
        if (
          typeof navigator === "undefined" ||
          !navigator.mediaDevices ||
          !navigator.mediaDevices.getUserMedia
        ) {
          setError({
            type: "notfound",
            message:
              "Camera hardware or video streaming API is not available in this browser.",
          });
          setIsStarting(false);
          isStartingRef.current = false;
          return;
        }

        // 3. Stop any prior stream and let iOS / mobile camera hardware fully cooldown and release
        await stopCamera();
        await new Promise((r) => setTimeout(r, 220));

        // 4. Ensure viewport DOM element is present and clean
        const container = document.getElementById(containerId);
        if (!container) {
          setIsStarting(false);
          isStartingRef.current = false;
          return;
        }
        container.innerHTML = "";

        // Enforce iOS WebKit playsinline, object-fit cover, and non-black video element sizing
        const enforceVideoInline = () => {
          const videos = container.getElementsByTagName("video");
          for (let i = 0; i < videos.length; i++) {
            const v = videos[i];
            v.style.width = "100%";
            v.style.height = "100%";
            v.style.objectFit = "cover";
            v.style.display = "block";
            v.style.position = "absolute";
            v.style.top = "0";
            v.style.left = "0";
            v.setAttribute("playsinline", "true");
            v.setAttribute("webkit-playsinline", "true");
            v.setAttribute("autoplay", "true");
            v.setAttribute("muted", "true");
            v.playsInline = true;
            v.muted = true;
            v.autoplay = true;

            if (v.paused) {
              v.play().catch(() => {});
            }
          }

          // Hide unwanted shaded region inserted by html5-qrcode
          const shaded = container.querySelector(
            "#qr-shaded-region"
          ) as HTMLElement | null;
          if (shaded) {
            shaded.style.display = "none";
          }
        };

        const observer = new MutationObserver(() => {
          enforceVideoInline();
        });
        observer.observe(container, { childList: true, subtree: true });

        const html5QrCode = new Html5Qrcode(containerId);
        scannerRef.current = html5QrCode;

        // Omit restrictive qrbox so html5-qrcode doesn't draw opaque black border shaders
        // and doesn't force a landscape aspect ratio mismatch on iOS Safari portrait mode
        const baseConfig = {
          fps: 15,
          formatsToSupport: [
            Html5QrcodeSupportedFormats.EAN_13,
            Html5QrcodeSupportedFormats.EAN_8,
            Html5QrcodeSupportedFormats.CODE_128,
            Html5QrcodeSupportedFormats.CODE_39,
            Html5QrcodeSupportedFormats.UPC_A,
            Html5QrcodeSupportedFormats.UPC_E,
            Html5QrcodeSupportedFormats.QR_CODE,
          ],
        };

        const handleSuccess = (decodedText: string) => {
          playScanChime();
          if (typeof navigator !== "undefined" && navigator.vibrate) {
            navigator.vibrate(100);
          }
          stopCamera().finally(() => {
            onScan(decodedText);
            onClose();
          });
        };

        // Query available devices beforehand if permission was previously given
        let availableVideoDevices: MediaDeviceInfo[] = [];
        try {
          const allDevs = await navigator.mediaDevices.enumerateDevices();
          availableVideoDevices = allDevs.filter(
            (d) => d.kind === "videoinput"
          );
        } catch (_) {}

        // Find known rear camera device ID if available
        const knownBackCam = availableVideoDevices.find((d) => {
          const l = (d.label || "").toLowerCase();
          return (
            l.includes("back") ||
            l.includes("rear") ||
            l.includes("environment")
          );
        });

        // Build list of camera candidates to try
        type CameraCandidate = {
          target: any;
          config: any;
          facing: "environment" | "user";
          desc: string;
        };

        const candidates: CameraCandidate[] = [];

        if (preferredCamId) {
          // Explicit user-chosen device from dropdown
          candidates.push({
            target: preferredCamId,
            config: {
              ...baseConfig,
              videoConstraints: { deviceId: { ideal: preferredCamId } },
            },
            facing: targetFacing,
            desc: "Preferred device with ideal ID",
          });
          candidates.push({
            target: preferredCamId,
            config: baseConfig,
            facing: targetFacing,
            desc: "Preferred device direct",
          });
        } else if (targetFacing === "environment") {
          // 1. iOS / WebKit ideal environment constraint (WITHOUT forced landscape dimensions that corrupt portrait video)
          candidates.push({
            target: { facingMode: "environment" },
            config: {
              ...baseConfig,
              videoConstraints: {
                facingMode: { ideal: "environment" },
              },
            },
            facing: "environment",
            desc: "Ideal environment constraint (native portrait resolution)",
          });

          // 2. Standard facingMode environment
          candidates.push({
            target: { facingMode: "environment" },
            config: baseConfig,
            facing: "environment",
            desc: "Standard facingMode environment",
          });

          // 3. If a rear camera device was detected in enumeration, try its ID directly
          if (knownBackCam && knownBackCam.deviceId) {
            candidates.push({
              target: knownBackCam.deviceId,
              config: {
                ...baseConfig,
                videoConstraints: {
                  deviceId: { ideal: knownBackCam.deviceId },
                },
              },
              facing: "environment",
              desc: "Explicit rear deviceId",
            });
          }

          // 4. Exact environment constraint (some browsers prefer this)
          candidates.push({
            target: { facingMode: { exact: "environment" } },
            config: baseConfig,
            facing: "environment",
            desc: "Exact environment constraint",
          });

          // 5. Fallback: User camera if device has no rear camera (e.g. laptop webcam)
          candidates.push({
            target: { facingMode: "user" },
            config: {
              ...baseConfig,
              videoConstraints: { facingMode: { ideal: "user" } },
            },
            facing: "user",
            desc: "Fallback user camera",
          });
        } else {
          // Front camera requested
          candidates.push({
            target: { facingMode: "user" },
            config: {
              ...baseConfig,
              videoConstraints: { facingMode: { ideal: "user" } },
            },
            facing: "user",
            desc: "Ideal user camera",
          });
          candidates.push({
            target: { facingMode: "user" },
            config: baseConfig,
            facing: "user",
            desc: "Standard user camera",
          });
        }

        let startedSuccessfully = false;
        let lastError: any = null;

        for (const candidate of candidates) {
          try {
            console.log(`[Scanner] Attempting: ${candidate.desc}`);
            await html5QrCode.start(
              candidate.target,
              candidate.config,
              handleSuccess,
              () => {}
            );
            setActiveFacingMode(candidate.facing);
            startedSuccessfully = true;
            enforceVideoInline();
            console.log(
              `[Scanner] Successfully connected with: ${candidate.desc}`
            );
            break;
          } catch (candErr) {
            console.warn(
              `[Scanner] Candidate failed (${candidate.desc}):`,
              candErr
            );
            lastError = candErr;
            // Brief pause before trying next candidate to allow WebKit pipeline to reset
            await new Promise((r) => setTimeout(r, 120));
          }
        }

        if (!startedSuccessfully) {
          throw (
            lastError ||
            new Error("Failed to start camera with available constraints")
          );
        }

        setIsScanning(true);
        setError(null);
        enforceVideoInline();

        // Kickstart video playback and styling periodically for 2 seconds on Safari
        let checks = 0;
        const playKickstarter = setInterval(() => {
          enforceVideoInline();
          checks++;
          if (checks > 15) {
            clearInterval(playKickstarter);
          }
        }, 120);

        // 5. Enumerate and populate device list using native navigator API
        try {
          const freshDevs = await navigator.mediaDevices.enumerateDevices();
          const videoDevs: CameraDeviceOption[] = freshDevs
            .filter((d) => d.kind === "videoinput")
            .map((d, idx) => {
              const label = d.label || `Camera ${idx + 1}`;
              const lower = label.toLowerCase();
              const isBack =
                lower.includes("back") ||
                lower.includes("rear") ||
                lower.includes("environment");
              const isFront =
                lower.includes("front") ||
                lower.includes("user") ||
                lower.includes("face");
              return {
                id: d.deviceId,
                label,
                isBack,
                isFront,
              };
            });

          if (videoDevs.length > 0) {
            setCameras(videoDevs);
            if (!preferredCamId) {
              const matched = videoDevs.find((d) =>
                targetFacing === "environment" ? d.isBack : d.isFront
              );
              setSelectedCameraId(matched ? matched.id : videoDevs[0].id);
            } else {
              setSelectedCameraId(preferredCamId);
            }
          }
        } catch (enumErr) {
          console.warn("[Scanner] Camera enumeration error:", enumErr);
        }

        // 6. Check torch capability on active track
        try {
          const capabilities =
            (html5QrCode as any).getRunningTrackCapabilities?.();
          if (capabilities && capabilities.torch) {
            setHasTorch(true);
          } else {
            setHasTorch(false);
          }
        } catch {
          setHasTorch(false);
        }
      } catch (err: any) {
        console.error("[Scanner] Final camera start error:", err);

        const errMsg = String(err?.message || err || "").toLowerCase();
        const errName = String(err?.name || "");

        if (
          errName === "NotAllowedError" ||
          errMsg.includes("permission denied") ||
          errMsg.includes("not allowed") ||
          errMsg.includes("permission")
        ) {
          setError({
            type: "permission",
            message:
              "Camera permission is currently blocked by your browser settings.",
          });
        } else if (
          errName === "NotReadableError" ||
          errName === "TrackStartError" ||
          errMsg.includes("could not start video source") ||
          errMsg.includes("in use") ||
          errMsg.includes("busy")
        ) {
          setError({
            type: "busy",
            message:
              "Your camera is currently in use or busy in another tab/app (such as Zoom, Teams, or another window).",
          });
        } else if (
          errName === "OverconstrainedError" ||
          errName === "NotFoundError" ||
          errMsg.includes("not found") ||
          errMsg.includes("overconstrained")
        ) {
          setError({
            type: "notfound",
            message:
              "Requested camera hardware is not available on this device.",
          });
        } else {
          setError({
            type: "generic",
            message:
              err?.message ||
              "Could not establish video connection with the camera hardware.",
          });
        }
        setIsScanning(false);
      } finally {
        setIsStarting(false);
        isStartingRef.current = false;
      }
    },
    [stopCamera, onScan, onClose, containerId]
  );

  // Mount effect: start scanner once modal opens
  useEffect(() => {
    if (!isOpen) {
      stopCamera();
      return;
    }

    // Delay to ensure modal animation and container DOM are fully ready
    const timer = setTimeout(() => {
      startScanner("environment");
    }, 200);

    return () => {
      clearTimeout(timer);
      stopCamera();
    };
  }, [isOpen, startScanner, stopCamera]);

  // Flashlight toggle
  const toggleTorch = async () => {
    if (!scannerRef.current || !hasTorch) return;
    try {
      await (scannerRef.current as any).applyVideoConstraints({
        advanced: [{ torch: !torchOn }],
      });
      setTorchOn(!torchOn);
    } catch (e) {
      console.warn("Torch toggle not supported", e);
    }
  };

  // Instant Flip between Rear and Front camera
  const toggleFlipCamera = async () => {
    const nextFacing =
      activeFacingMode === "environment" ? "user" : "environment";
    setActiveFacingMode(nextFacing);
    await startScanner(nextFacing);
  };

  // Switch specific camera from dropdown
  const handleCameraChange = async (newCameraId: string) => {
    setSelectedCameraId(newCameraId);
    const chosen = cameras.find((c) => c.id === newCameraId);
    const facing = chosen?.isBack
      ? "environment"
      : chosen?.isFront
      ? "user"
      : activeFacingMode;
    setActiveFacingMode(facing);
    await startScanner(facing, newCameraId);
  };

  // Handle manual code entry submission
  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCode.trim()) return;
    stopCamera().finally(() => {
      onScan(manualCode.trim());
      onClose();
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-60 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-lg w-full border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/50 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-purple-600 text-white flex items-center justify-center shadow-md shadow-purple-600/30">
              <Camera className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white text-sm">
                Barcode Camera Scanner
              </h3>
              <p className="text-[11px] text-slate-500">
                Point your camera directly at the product barcode
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              stopCamera();
              onClose();
            }}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Viewport container */}
        <div className="p-4 sm:p-5 flex flex-col items-center overflow-y-auto space-y-3.5">
          {/* Scanner Window (Always mounted in DOM to prevent containerId null crashes) */}
          <div className="relative w-full aspect-4/3 max-w-sm rounded-2xl overflow-hidden bg-slate-950 border-2 border-indigo-500/50 shadow-inner flex items-center justify-center">
            {/* HTML5 QR Code Mount Element */}
            <div id={containerId} className="w-full h-full relative overflow-hidden" />

            <style>{`
              #${containerId} {
                width: 100% !important;
                height: 100% !important;
                position: relative !important;
                overflow: hidden !important;
                display: flex !important;
                align-items: center !important;
                justify-content: center !important;
              }
              #${containerId} video {
                width: 100% !important;
                height: 100% !important;
                object-fit: cover !important;
                display: block !important;
                position: absolute !important;
                top: 0 !important;
                left: 0 !important;
                right: 0 !important;
                bottom: 0 !important;
                opacity: 1 !important;
                visibility: visible !important;
              }
              #${containerId} #qr-shaded-region {
                display: none !important;
              }
              #${containerId} canvas {
                display: none !important;
              }
            `}</style>

            {/* Viewfinder Target Overlays (visible when actively scanning) */}
            {isScanning && !error && (
              <>
                <div className="absolute top-2.5 right-2.5 z-10">
                  <div className="px-2.5 py-1 rounded-full bg-slate-900/85 backdrop-blur-xs text-[10px] font-semibold text-white/90 flex items-center gap-1.5 shadow-sm border border-white/10">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    <span>
                      {activeFacingMode === "environment"
                        ? "Rear Camera"
                        : "Front Camera"}
                    </span>
                  </div>
                </div>

                <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center p-6">
                  <div className="relative w-full max-w-[280px] h-[140px] border-2 border-dashed border-indigo-400/80 rounded-xl bg-indigo-500/5">
                    {/* Four Corner Target Brackets */}
                    <div className="absolute -top-1 -left-1 w-4 h-4 border-t-2 border-l-2 border-indigo-500 rounded-tl-sm" />
                    <div className="absolute -top-1 -right-1 w-4 h-4 border-t-2 border-r-2 border-indigo-500 rounded-tr-sm" />
                    <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-2 border-l-2 border-indigo-500 rounded-bl-sm" />
                    <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-2 border-r-2 border-indigo-500 rounded-br-sm" />

                    {/* Animated Scanning Laser Line */}
                    <div className="absolute inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-rose-500 to-transparent shadow-[0_0_8px_rgba(244,63,94,0.8)] animate-[scan_2s_ease-in-out_infinite]" />
                  </div>

                  <div className="mt-3 px-3 py-1 rounded-full bg-slate-900/80 backdrop-blur-xs text-[10px] font-semibold text-white/90 flex items-center gap-1.5 shadow-sm">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                    <span>Align barcode inside the target box</span>
                  </div>
                </div>
              </>
            )}

            {/* Starting / Loading Overlay */}
            {isStarting && !error && (
              <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-xs flex flex-col items-center justify-center gap-2 text-white p-4 text-center">
                <Loader2 className="w-7 h-7 text-indigo-400 animate-spin" />
                <span className="text-xs font-semibold">Connecting to camera stream...</span>
              </div>
            )}

            {/* Specific Error Diagnostics Overlay */}
            {error && (
              <div className="absolute inset-0 bg-slate-900/95 backdrop-blur-xs flex flex-col items-center justify-center p-5 text-center text-white space-y-3 z-10">
                <div className="w-12 h-12 rounded-2xl bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center justify-center">
                  {error.type === "permission" ? (
                    <Lock className="w-6 h-6" />
                  ) : error.type === "busy" ? (
                    <CameraOff className="w-6 h-6" />
                  ) : (
                    <AlertCircle className="w-6 h-6" />
                  )}
                </div>

                <div className="space-y-1 max-w-xs">
                  <h4 className="text-sm font-bold text-white">
                    {error.type === "permission"
                      ? "Camera Permission Denied"
                      : error.type === "busy"
                      ? "Camera Busy / In Use"
                      : error.type === "insecure"
                      ? "Connection Not Secure"
                      : "Camera Stream Unavailable"}
                  </h4>
                  <p className="text-[11px] text-slate-300 leading-relaxed">
                    {error.message}
                  </p>
                </div>

                {error.type === "permission" && (
                  <div className="p-2.5 rounded-xl bg-slate-800/80 border border-slate-700 text-[10px] text-slate-300 text-left space-y-1 max-w-xs">
                    <p className="font-bold text-white">How to fix in 5 seconds:</p>
                    <p>1. Tap the <strong>lock 🔒 or camera icon</strong> in your browser address bar.</p>
                    <p>2. Toggle <strong>Camera</strong> to <strong>Allow</strong>.</p>
                    <p>3. Tap <strong>&quot;Try Again&quot;</strong> below.</p>
                  </div>
                )}

                {error.type === "insecure" && (
                  <div className="p-3 rounded-xl bg-amber-500/15 border border-amber-500/30 text-[11px] text-amber-200 text-left space-y-2 max-w-xs">
                    <p className="font-bold text-amber-300">Plain HTTP Camera Restriction:</p>
                    <p className="text-slate-300 leading-relaxed">
                      Browsers block camera access over plain HTTP on LAN IP addresses. To use the camera:
                    </p>
                    <ul className="list-disc pl-4 text-[10px] text-slate-300 space-y-1">
                      <li>Access via <code className="text-amber-300">http://localhost:3000</code> on the host PC, or</li>
                      <li>In Chrome/Edge flags, enable <code className="text-amber-300">unsafely-treat-insecure-origin-as-secure</code> for this IP.</li>
                    </ul>
                  </div>
                )}

                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() =>
                      startScanner(
                        activeFacingMode,
                        selectedCameraId || undefined
                      )
                    }
                    disabled={isStarting}
                    className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md shadow-indigo-600/30 flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isStarting ? "animate-spin" : ""}`} />
                    <span>Try Again</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Controls Bar: Flip Camera, Specific Camera Dropdown, & Torch */}
          <div className="w-full flex items-center justify-between gap-2 flex-wrap">
            {/* 1. Direct Flip Camera Button (Front / Rear) */}
            <button
              type="button"
              onClick={toggleFlipCamera}
              disabled={isStarting}
              className="px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 disabled:opacity-50"
              title="Switch between front and rear camera"
            >
              <SwitchCamera className={`w-3.5 h-3.5 ${isStarting ? "animate-spin" : ""}`} />
              <span>
                {activeFacingMode === "environment"
                  ? "Flip to Front"
                  : "Flip to Rear"}
              </span>
            </button>

            {/* 2. Specific Camera Dropdown (if multiple sensors detected) */}
            {cameras.length > 1 && (
              <div className="flex items-center gap-1.5 flex-1 min-w-[160px]">
                <Camera className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <select
                  value={selectedCameraId}
                  onChange={(e) => handleCameraChange(e.target.value)}
                  disabled={isStarting}
                  className="w-full px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 outline-hidden focus:ring-2 focus:ring-indigo-500 truncate disabled:opacity-50"
                >
                  {cameras.map((cam, idx) => (
                    <option key={cam.id} value={cam.id}>
                      {cam.label || (cam.isBack ? `Rear Camera ${idx + 1}` : `Camera ${idx + 1}`)}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* 3. Flashlight toggle */}
            {hasTorch && (
              <button
                type="button"
                onClick={toggleTorch}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                  torchOn
                    ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                    : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                }`}
              >
                {torchOn ? (
                  <ZapOff className="w-3.5 h-3.5" />
                ) : (
                  <Zap className="w-3.5 h-3.5" />
                )}
                <span>{torchOn ? "Flash Off" : "Flash On"}</span>
              </button>
            )}
          </div>

          {/* Fallback: Direct Manual Barcode Input (Always available if camera fails) */}
          <div className="w-full pt-2 border-t border-slate-100 dark:border-slate-800/80">
            <span className="text-[11px] font-semibold text-slate-500 block mb-1.5">
              Or enter barcode directly:
            </span>
            <form onSubmit={handleManualSubmit} className="flex gap-2">
              <input
                type="text"
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                placeholder="e.g. 8901030383921"
                className="flex-1 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-mono text-slate-900 dark:text-white outline-hidden focus:ring-2 focus:ring-indigo-500"
              />
              <button
                type="submit"
                disabled={!manualCode.trim()}
                className="px-3.5 py-1.5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold text-xs hover:bg-slate-800 dark:hover:bg-slate-100 disabled:opacity-40 transition-colors flex items-center gap-1 cursor-pointer shrink-0"
              >
                <span>Use Code</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </form>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex items-center justify-between shrink-0">
          <p className="text-[11px] text-slate-400">
            Supports EAN-13, Code 128, Code 39, UPC, & QR
          </p>
          <button
            type="button"
            onClick={() => {
              stopCamera();
              onClose();
            }}
            className="px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition-colors cursor-pointer"
          >
            Cancel / Close
          </button>
        </div>
      </div>
    </div>
  );
};

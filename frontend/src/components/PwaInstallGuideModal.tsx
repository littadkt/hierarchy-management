"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  Smartphone,
  Monitor,
  Share,
  PlusSquare,
  MoreVertical,
  Download,
  Check,
  Copy,
  Info,
  ExternalLink,
  Sparkles,
  ShieldAlert,
} from "lucide-react";
import { usePwa } from "@/context/PwaContext";

export const PwaInstallGuideModal: React.FC = () => {
  const { isInstallGuideOpen, closeInstallGuide, isIos, isAndroid, canPromptNative, promptInstall, hasSslError } = usePwa();
  const [activeTab, setActiveTab] = useState<"ios" | "android" | "desktop">("ios");
  const [copiedOrigin, setCopiedOrigin] = useState<boolean>(false);
  const [copiedFlagUrl, setCopiedFlagUrl] = useState<boolean>(false);
  const [currentOrigin, setCurrentOrigin] = useState<string>("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      setCurrentOrigin(window.location.origin);
    }
  }, []);

  useEffect(() => {
    if (isIos) {
      setActiveTab("ios");
    } else if (isAndroid) {
      setActiveTab("android");
    } else {
      setActiveTab("desktop");
    }
  }, [isIos, isAndroid, isInstallGuideOpen]);

  if (!isInstallGuideOpen) return null;

  const handleCopyOrigin = () => {
    if (typeof window !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(window.location.origin);
      setCopiedOrigin(true);
      setTimeout(() => setCopiedOrigin(false), 2500);
    }
  };

  const handleCopyFlagUrl = () => {
    if (typeof window !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText("chrome://flags/#unsafely-treat-insecure-origin-as-secure");
      setCopiedFlagUrl(true);
      setTimeout(() => setCopiedFlagUrl(false), 2500);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
      >
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3 bg-gradient-to-r from-indigo-50/50 via-transparent to-purple-50/50 dark:from-indigo-950/20 dark:to-purple-950/20">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center text-white shadow-md shadow-indigo-500/20 shrink-0">
              <Download className="w-5 h-5" />
            </div>
            <div className="truncate">
              <h3 className="font-bold text-slate-900 dark:text-white text-base flex items-center gap-1.5 truncate">
                <span>Install Team Littad</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                  PWA
                </span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                Install as a standalone app on home screen or desktop
              </p>
            </div>
          </div>
          <button
            onClick={closeInstallGuide}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* SSL Warning / Local IP Notice */}
        {hasSslError && (
          <div className="mx-4 sm:mx-6 mt-4 p-3.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/80 rounded-2xl text-amber-900 dark:text-amber-200 text-xs space-y-1.5">
            <div className="flex items-center gap-2 font-bold text-amber-800 dark:text-amber-300">
              <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
              <span>Notice for Local Network IP ({currentOrigin.replace(/https?:\/\//, "")})</span>
            </div>
            <p className="text-[11px] leading-relaxed text-amber-700 dark:text-amber-300/90">
              When accessed over plain HTTP on a local network IP, browser security policies restrict automatic 1-tap install prompts.
              <strong> You can still add and use the app in your browser:</strong>
            </p>
          </div>
        )}

        {/* Device Switcher Tabs */}
        <div className="p-2 sm:px-4 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 flex items-center gap-1.5 overflow-x-auto mt-2">
          <button
            onClick={() => setActiveTab("ios")}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === "ios"
                ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs border border-slate-200 dark:border-slate-700"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>iPhone / iPad (iOS)</span>
          </button>
          <button
            onClick={() => setActiveTab("android")}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === "android"
                ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs border border-slate-200 dark:border-slate-700"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>Android</span>
          </button>
          <button
            onClick={() => setActiveTab("desktop")}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === "desktop"
                ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs border border-slate-200 dark:border-slate-700"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <Monitor className="w-3.5 h-3.5" />
            <span>PC / Mac / Chrome</span>
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4 text-xs">
          {/* iOS Tab */}
          {activeTab === "ios" && (
            <div className="space-y-4">
              <div className="p-3 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/60 rounded-xl text-indigo-900 dark:text-indigo-200">
                <p className="font-semibold flex items-center gap-1.5 text-xs">
                  <Sparkles className="w-4 h-4 text-indigo-600 shrink-0" />
                  <span>How to install on iPhone &amp; iPad in 3 taps:</span>
                </p>
                <p className="mt-1 text-[11px] leading-relaxed text-indigo-700 dark:text-indigo-300">
                  Safari allows adding any website directly to your iOS Home Screen. Make sure you opened this page in <strong>Safari</strong> (Apple does not support PWA installation from Chrome iOS or social media in-app browsers).
                </p>
              </div>

              <div className="space-y-3">
                <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800">
                  <div className="w-7 h-7 rounded-lg bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold shrink-0">
                    1
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-slate-900 dark:text-white">
                      Tap the Share Button
                    </p>
                    <p className="text-slate-500 text-[11px] mt-0.5">
                      In the bottom toolbar of Safari, tap the <strong>Share</strong> icon (the square box with an arrow pointing up).
                    </p>
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 mt-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-medium text-[11px] text-slate-700 dark:text-slate-300 shadow-xs">
                      <Share className="w-3.5 h-3.5 text-indigo-500" />
                      <span>Share (Square with arrow)</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800">
                  <div className="w-7 h-7 rounded-lg bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold shrink-0">
                    2
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-slate-900 dark:text-white">
                      Select &quot;Add to Home Screen&quot;
                    </p>
                    <p className="text-slate-500 text-[11px] mt-0.5">
                      Scroll down through the share options and tap <strong>Add to Home Screen</strong>.
                    </p>
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 mt-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-medium text-[11px] text-slate-700 dark:text-slate-300 shadow-xs">
                      <PlusSquare className="w-3.5 h-3.5 text-indigo-500" />
                      <span>Add to Home Screen</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800">
                  <div className="w-7 h-7 rounded-lg bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold shrink-0">
                    3
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-slate-900 dark:text-white">
                      Tap &quot;Add&quot; in Top Right
                    </p>
                    <p className="text-slate-500 text-[11px] mt-0.5">
                      Tap <strong>Add</strong> in the top right corner. The Team Littad app icon will be pinned onto your iPhone home screen!
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Android Tab */}
          {activeTab === "android" && (
            <div className="space-y-4">
              {canPromptNative && (
                <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 rounded-xl flex items-center justify-between gap-3">
                  <div>
                    <p className="font-bold text-emerald-900 dark:text-emerald-200">
                      Ready for 1-Click Install!
                    </p>
                    <p className="text-[11px] text-emerald-700 dark:text-emerald-300 mt-0.5">
                      Your browser supports instant native installation.
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      closeInstallGuide();
                      promptInstall();
                    }}
                    className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shrink-0 shadow-sm cursor-pointer"
                  >
                    Install Now
                  </button>
                </div>
              )}

              <div className="space-y-3">
                <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800">
                  <div className="w-7 h-7 rounded-lg bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold shrink-0">
                    1
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-slate-900 dark:text-white">
                      Open Chrome Menu (3 Dots)
                    </p>
                    <p className="text-slate-500 text-[11px] mt-0.5">
                      In Chrome, Edge, or Samsung Internet, tap the <strong>three dots (⋮)</strong> at the top right corner.
                    </p>
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 mt-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-medium text-[11px] text-slate-700 dark:text-slate-300 shadow-xs">
                      <MoreVertical className="w-3.5 h-3.5 text-indigo-500" />
                      <span>Browser Menu (⋮)</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800">
                  <div className="w-7 h-7 rounded-lg bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold shrink-0">
                    2
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-slate-900 dark:text-white">
                      Tap &quot;Install app&quot; or &quot;Add to Home screen&quot;
                    </p>
                    <p className="text-slate-500 text-[11px] mt-0.5">
                      Select <strong>Install app</strong> (or <strong>Add to Home screen</strong>) and confirm.
                    </p>
                  </div>
                </div>
              </div>

              {/* Private Network Insecure Origin Tip for Chrome on Android */}
              <div className="p-3 bg-slate-100 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-xl space-y-2">
                <p className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  <span>Pro Tip: Enable 1-Click Prompt in Chrome (Android):</span>
                </p>
                <p className="text-slate-600 dark:text-slate-300 text-[11px] leading-relaxed">
                  To tell Android Chrome to trust this local IP without any certificate warnings:
                </p>
                <ol className="list-decimal list-inside space-y-1.5 text-slate-600 dark:text-slate-300 text-[11px] pl-1">
                  <li>
                    Open a new tab in Chrome and paste:
                    <div className="flex items-center gap-1.5 mt-1">
                      <code className="bg-slate-200 dark:bg-slate-900 px-2 py-0.5 rounded text-[10px] select-all font-mono">
                        chrome://flags/#unsafely-treat-insecure-origin-as-secure
                      </code>
                      <button
                        onClick={handleCopyFlagUrl}
                        className="px-2 py-0.5 bg-white dark:bg-slate-700 rounded text-[10px] font-bold border border-slate-300 dark:border-slate-600"
                      >
                        {copiedFlagUrl ? "Copied" : "Copy"}
                      </button>
                    </div>
                  </li>
                  <li>
                    In the text box, paste your server URL:
                    <div className="flex items-center gap-1.5 mt-1">
                      <code className="bg-slate-200 dark:bg-slate-900 px-2 py-0.5 rounded text-[10px] select-all font-mono font-bold text-indigo-600 dark:text-indigo-400">
                        {currentOrigin || "http://192.168.100.10:3000"}
                      </code>
                      <button
                        onClick={handleCopyOrigin}
                        className="px-2 py-0.5 bg-white dark:bg-slate-700 rounded text-[10px] font-bold border border-slate-300 dark:border-slate-600"
                      >
                        {copiedOrigin ? "Copied" : "Copy"}
                      </button>
                    </div>
                  </li>
                  <li>Set dropdown to <strong>Enabled</strong>, then tap <strong>Relaunch</strong>.</li>
                </ol>
              </div>
            </div>
          )}

          {/* Desktop Tab */}
          {activeTab === "desktop" && (
            <div className="space-y-4">
              {canPromptNative && (
                <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 rounded-xl flex items-center justify-between gap-3">
                  <div>
                    <p className="font-bold text-emerald-900 dark:text-emerald-200">
                      Ready for 1-Click Install!
                    </p>
                    <p className="text-[11px] text-emerald-700 dark:text-emerald-300 mt-0.5">
                      Your browser supports instant desktop app installation.
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      closeInstallGuide();
                      promptInstall();
                    }}
                    className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shrink-0 shadow-sm cursor-pointer"
                  >
                    Install Now
                  </button>
                </div>
              )}

              <div className="space-y-3">
                <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800">
                  <div className="w-7 h-7 rounded-lg bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold shrink-0">
                    1
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-slate-900 dark:text-white">
                      Address Bar Install Icon
                    </p>
                    <p className="text-slate-500 text-[11px] mt-0.5">
                      In Chrome or Edge, look at the right end of the address bar (URL bar) for the <strong>Install App icon</strong> (monitor with down arrow).
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800">
                  <div className="w-7 h-7 rounded-lg bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold shrink-0">
                    2
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-slate-900 dark:text-white">
                      Or Use Browser Menu
                    </p>
                    <p className="text-slate-500 text-[11px] mt-0.5">
                      Click the three dots <strong>(⋮)</strong> &gt; <strong>Save and share</strong> &gt; <strong>Install Team Littad</strong>.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Quick Copy Link Box */}
          <div className="p-3 bg-slate-50 dark:bg-slate-800/30 border border-slate-200 dark:border-slate-800 rounded-xl flex items-center justify-between gap-2">
            <div className="truncate">
              <span className="text-[10px] text-slate-400 block font-medium">Application URL:</span>
              <span className="text-xs font-mono font-semibold text-slate-700 dark:text-slate-300 truncate block">
                {currentOrigin || "Loading URL..."}
              </span>
            </div>
            <button
              onClick={handleCopyOrigin}
              className="px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 font-semibold text-xs flex items-center gap-1.5 shrink-0 transition-colors cursor-pointer"
            >
              {copiedOrigin ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="text-emerald-600">Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-slate-400" />
                  <span>Copy</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex items-center justify-end gap-2">
          <button
            onClick={closeInstallGuide}
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs transition-colors cursor-pointer"
          >
            Got It
          </button>
        </div>
      </div>
    </div>
  );
};

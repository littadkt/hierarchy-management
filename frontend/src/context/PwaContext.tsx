"use client";

import React, { createContext, useContext, useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
  prompt(): Promise<void>;
}

export interface PwaContextType {
  isInstallable: boolean;
  isInstalled: boolean;
  canPromptNative: boolean;
  isIos: boolean;
  isAndroid: boolean;
  hasSslError: boolean;
  isInstallGuideOpen: boolean;
  openInstallGuide: () => void;
  closeInstallGuide: () => void;
  promptInstall: () => Promise<void>;
}

const PwaContext = createContext<PwaContextType | undefined>(undefined);

export const PwaProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState<boolean>(false);
  const [isIos, setIsIos] = useState<boolean>(false);
  const [isAndroid, setIsAndroid] = useState<boolean>(false);
  const [hasSslError, setHasSslError] = useState<boolean>(false);
  const [isInstallGuideOpen, setIsInstallGuideOpen] = useState<boolean>(false);

  useEffect(() => {
    // 1. Detect if running as installed standalone PWA
    const checkStandalone = () => {
      if (typeof window === "undefined") return false;
      const isStandaloneMedia = window.matchMedia("(display-mode: standalone)").matches;
      const isIosStandalone = (window.navigator as any).standalone === true;
      return isStandaloneMedia || isIosStandalone;
    };

    setIsInstalled(checkStandalone());

    if (typeof window !== "undefined") {
      const mediaQuery = window.matchMedia("(display-mode: standalone)");
      const handleMediaChange = (e: MediaQueryListEvent) => {
        setIsInstalled(e.matches);
      };
      mediaQuery.addEventListener("change", handleMediaChange);

      // 2. Detect OS & device
      const userAgent = window.navigator.userAgent.toLowerCase();
      const isIosDevice = /iphone|ipad|ipod/.test(userAgent) && !(window as any).MSStream;
      const isAndroidDevice = /android/.test(userAgent);
      setIsIos(isIosDevice);
      setIsAndroid(isAndroidDevice);

      // 3. Register Service Worker reliably (without missing already-completed load event)
      const registerServiceWorker = () => {
        if ("serviceWorker" in navigator && process.env.NODE_ENV !== "test") {
          navigator.serviceWorker
            .register("/sw.js", { scope: "/" })
            .then((registration) => {
              console.log("[PWA] Service Worker registered, scope:", registration.scope);
              setHasSslError(false);
            })
            .catch((error) => {
              const errorMsg = String(error?.message || error || "");
              const isCertError =
                errorMsg.includes("SSL") ||
                errorMsg.includes("certificate") ||
                errorMsg.includes("SecurityError");
              if (isCertError) {
                setHasSslError(true);
                console.info(
                  "[PWA] Service Worker offline caching requires a trusted SSL certificate. The application remains fully functional in online mode."
                );
              } else {
                console.warn("[PWA] Service Worker registration notice:", errorMsg);
              }
            });
        }
      };

      if ("serviceWorker" in navigator && process.env.NODE_ENV !== "test") {
        if (document.readyState === "complete") {
          registerServiceWorker();
        } else {
          window.addEventListener("load", registerServiceWorker);
        }
      }

      // 4. Listen for beforeinstallprompt event (Chromium, Edge, Android)
      const handleBeforeInstallPrompt = (e: Event) => {
        e.preventDefault();
        setDeferredPrompt(e as BeforeInstallPromptEvent);
      };

      window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

      // 5. Listen for appinstalled event
      const handleAppInstalled = () => {
        setIsInstalled(true);
        setDeferredPrompt(null);
        setIsInstallGuideOpen(false);
      };

      window.addEventListener("appinstalled", handleAppInstalled);

      return () => {
        mediaQuery.removeEventListener("change", handleMediaChange);
        window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
        window.removeEventListener("appinstalled", handleAppInstalled);
        window.removeEventListener("load", registerServiceWorker);
      };
    }
  }, []);

  const openInstallGuide = () => setIsInstallGuideOpen(true);
  const closeInstallGuide = () => setIsInstallGuideOpen(false);

  const promptInstall = async () => {
    if (deferredPrompt) {
      try {
        await deferredPrompt.prompt();
        const choiceResult = await deferredPrompt.userChoice;
        if (choiceResult.outcome === "accepted") {
          setIsInstalled(true);
        }
        setDeferredPrompt(null);
      } catch (err) {
        console.warn("[PWA] Prompt error:", err);
        setIsInstallGuideOpen(true);
      }
    } else {
      // If native prompt is not supported by the browser engine (iOS Safari, local HTTP, etc.),
      // open the tailored visual install guide modal
      setIsInstallGuideOpen(true);
    }
  };

  return (
    <PwaContext.Provider
      value={{
        isInstallable: !isInstalled,
        isInstalled,
        canPromptNative: !!deferredPrompt,
        isIos,
        isAndroid,
        hasSslError,
        isInstallGuideOpen,
        openInstallGuide,
        closeInstallGuide,
        promptInstall,
      }}
    >
      {children}
    </PwaContext.Provider>
  );
};

export const usePwa = (): PwaContextType => {
  const context = useContext(PwaContext);
  if (!context) {
    throw new Error("usePwa must be used within a PwaProvider");
  }
  return context;
};

"use client";

import React, { useState, useEffect } from "react";
import { Download, X, Smartphone, HelpCircle } from "lucide-react";
import { usePwa } from "@/context/PwaContext";
import { PwaInstallGuideModal } from "./PwaInstallGuideModal";

export const PwaInstallPrompt: React.FC = () => {
  const { isInstallable, isInstalled, promptInstall, openInstallGuide, canPromptNative } = usePwa();
  const [dismissed, setDismissed] = useState<boolean>(true);

  useEffect(() => {
    // Show prompt if app is not installed and not dismissed within last 12 hours
    if (isInstallable && !isInstalled) {
      const dismissedUntil = localStorage.getItem("pwa-prompt-dismissed");
      if (!dismissedUntil || Date.now() > Number(dismissedUntil)) {
        setDismissed(false);
      }
    } else {
      setDismissed(true);
    }
  }, [isInstallable, isInstalled]);

  const handleDismiss = () => {
    setDismissed(true);
    // Dismiss for 12 hours
    localStorage.setItem(
      "pwa-prompt-dismissed",
      (Date.now() + 12 * 60 * 60 * 1000).toString()
    );
  };

  const handleInstallClick = async () => {
    await promptInstall();
  };

  return (
    <>
      {/* Visual Step-by-Step Install Guide Modal */}
      <PwaInstallGuideModal />

      {/* Floating Bottom Action Prompt */}
      {!dismissed && !isInstalled && (
        <div className="fixed bottom-4 right-4 z-40 max-w-sm w-[calc(100vw-2rem)] sm:w-auto animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="bg-slate-900/95 dark:bg-slate-900/95 backdrop-blur-md text-white p-4 rounded-2xl border border-indigo-500/40 shadow-2xl flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center shrink-0 shadow-lg shadow-indigo-500/30">
              <Smartphone className="w-5 h-5 text-white" />
            </div>

            <div className="flex-1 min-w-0 pr-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <h4 className="text-xs font-bold text-white">Install Team Littad</h4>
                <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-indigo-500/30 text-indigo-300 border border-indigo-500/30">
                  PWA
                </span>
              </div>
              <p className="text-[11px] text-slate-300 mt-0.5 leading-snug">
                Add to your home screen for quick access, offline mode &amp; faster load speeds.
              </p>

              <div className="mt-3 flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={handleInstallClick}
                  className="px-3.5 py-1.5 text-xs font-bold rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/30 flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>{canPromptNative ? "Install App" : "Install / Add"}</span>
                </button>
                <button
                  type="button"
                  onClick={openInstallGuide}
                  className="px-2.5 py-1.5 text-xs font-medium rounded-xl text-indigo-300 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer flex items-center gap-1"
                >
                  <HelpCircle className="w-3 h-3" />
                  <span>How?</span>
                </button>
                <button
                  type="button"
                  onClick={handleDismiss}
                  className="px-2.5 py-1.5 text-xs font-medium rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  Later
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={handleDismiss}
              className="p-1 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
              title="Dismiss"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </>
  );
};

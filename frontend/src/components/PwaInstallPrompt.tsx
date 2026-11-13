"use client";

import React from "react";
import { PwaInstallGuideModal } from "./PwaInstallGuideModal";

/**
 * PWA Install Helper - Floating popups removed per user preference.
 * Only the Top Bar Install button triggers installation or guide modal.
 */
export const PwaInstallPrompt: React.FC = () => {
  return <PwaInstallGuideModal />;
};

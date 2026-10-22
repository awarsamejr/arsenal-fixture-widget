import { isTauri } from "@tauri-apps/api/core";

/** The Windows widget: has a title bar, tray, mini mode and its own API keys. */
export const isDesktopApp = isTauri();

/** A touch phone or tablet (website), for bigger tap targets. */
export const isMobile = typeof navigator !== "undefined" && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

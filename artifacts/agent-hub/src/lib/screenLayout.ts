// ─── Screen Layout Detection ───────────────────────────────────────────────────
// Detects monitor count and recommends UI layout.
// Uses Window Management API (requires permission) with fallback to screen.isExtended.

export interface ScreenInfo {
  width: number;
  height: number;
  left: number;
  top: number;
  isPrimary: boolean;
  label?: string;
}

export type LayoutMode = "single_wide" | "single_narrow" | "multi";

export interface ScreenLayout {
  count: number;
  primary: ScreenInfo;
  all: ScreenInfo[];
  isExtended: boolean;
  mode: LayoutMode;
  /** true if Window Management permission was granted and coordinates are reliable */
  hasExactCoords: boolean;
}

export async function detectScreenLayout(): Promise<ScreenLayout> {
  const sw = window.screen.width;
  const sh = window.screen.height;
  const primary: ScreenInfo = { width: sw, height: sh, left: 0, top: 0, isPrimary: true };

  // Check if multiple monitors exist (no permission needed)
  const isExtended =
    "isExtended" in window.screen
      ? (window.screen as unknown as { isExtended: boolean }).isExtended
      : false;

  if (isExtended) {
    // Try Window Management API for exact screen coordinates
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ("getScreenDetails" in window) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const details = await (window as any).getScreenDetails() as {
          screens: Array<{
            availWidth: number; availHeight: number;
            availLeft: number; availTop: number;
            isPrimary?: boolean; label?: string;
          }>;
        };
        const all: ScreenInfo[] = details.screens.map((s, i) => ({
          width: s.availWidth,
          height: s.availHeight,
          left: s.availLeft,
          top: s.availTop,
          isPrimary: s.isPrimary ?? i === 0,
          label: s.label,
        }));
        const prim = all.find((s) => s.isPrimary) ?? all[0];
        return { count: all.length, primary: prim, all, isExtended: true, mode: "multi", hasExactCoords: true };
      } catch {
        // Permission denied — best-guess: secondary screen is to the right
        const guessed: ScreenInfo = { width: sw, height: sh, left: sw, top: 0, isPrimary: false };
        return {
          count: 2, primary, all: [primary, guessed],
          isExtended: true, mode: "multi", hasExactCoords: false,
        };
      }
    }
    // API not available — still flag as multi
    const guessed: ScreenInfo = { width: sw, height: sh, left: sw, top: 0, isPrimary: false };
    return {
      count: 2, primary, all: [primary, guessed],
      isExtended: true, mode: "multi", hasExactCoords: false,
    };
  }

  // Single screen — check if wide enough for both panels
  const mode: LayoutMode = window.innerWidth >= 1200 ? "single_wide" : "single_narrow";
  return { count: 1, primary, all: [primary], isExtended: false, mode, hasExactCoords: true };
}

/** Open a URL in a popup window positioned on the secondary screen */
export function openOnSecondaryScreen(url: string, layout: ScreenLayout, title = "AgentHub — גבר"): Window | null {
  const secondary = layout.all.find((s) => !s.isPrimary) ?? layout.all[1];
  if (!secondary) return window.open(url, title);
  const features = [
    `left=${secondary.left}`,
    `top=${secondary.top}`,
    `width=${secondary.width}`,
    `height=${secondary.height}`,
    "popup=yes",
    "menubar=no",
    "toolbar=no",
    "location=no",
    "status=no",
  ].join(",");
  return window.open(url, title, features);
}

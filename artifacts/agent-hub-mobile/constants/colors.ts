/**
 * Semantic design tokens for the AgentHub mobile app.
 *
 * Mirrors the premium light-mode palette defined in the sibling web artifact
 * (artifacts/agent-hub/src/index.css) so both products share one visual
 * identity: barely-there blue-gray background, white cards with hairline
 * borders, and an Electric Indigo brand accent.
 */

const colors = {
  light: {
    // Legacy aliases (kept for scaffold compatibility)
    text: "#1b202c",
    tint: "#5b3cf6",

    // Core surfaces — barely-there blue-gray page background
    background: "#f6f7f9",
    foreground: "#1b202c",

    // Cards — pure white with a hairline border
    card: "#ffffff",
    cardForeground: "#1b202c",

    // Primary — Electric Indigo brand
    primary: "#5b3cf6",
    primaryForeground: "#ffffff",

    // Brand gradient stops (header / hero)
    brandFrom: "#7c6cff",
    brandTo: "#5b3cf6",

    // Secondary surfaces
    secondary: "#eeeff2",
    secondaryForeground: "#303a4f",

    // Muted / subdued elements
    muted: "#f1f2f5",
    mutedForeground: "#788191",

    // Accent
    accent: "#eef0ff",
    accentForeground: "#4b32d6",

    // Status
    success: "#10b981",
    successForeground: "#ffffff",
    warning: "#f59e0b",
    destructive: "#dc2828",
    destructiveForeground: "#ffffff",

    // Borders and inputs
    border: "#e5e7eb",
    input: "#e5e7eb",
  },

  // Border radius (px). Mirrors --radius: 0.625rem (~10px) from index.css.
  radius: 10,
};

export default colors;

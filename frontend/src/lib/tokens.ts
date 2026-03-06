// ─────────────────────────────────────────────
//  Svdeeq-Bot CRM · Design Tokens  (v2)
//  Single source of truth for all visual values.
// ─────────────────────────────────────────────

export const colors = {
  // Surfaces
  bg:          "#F7F6F3",
  surface:     "#FFFFFF",
  surfaceB:    "#F0EEE9",

  // Borders
  border:      "#E4E1D9",
  borderB:     "#D5D1C8",

  // Text — warm ink scale
  ink:         "#1A1916",
  inkB:        "#3D3B35",
  inkC:        "#7A7669",
  inkD:        "#B0AC9F",

  // Accent — electric indigo
  accent:      "#4F46E5",
  accentBg:    "#EEF2FF",
  accentSoft:  "rgba(79,70,229,0.08)",

  // Status — green
  green:       "#16A34A",
  greenBg:     "#F0FDF4",
  greenDot:    "#22C55E",

  // Status — amber
  amber:       "#D97706",
  amberBg:     "#FFFBEB",
  amberDot:    "#F59E0B",

  // Status — red
  red:         "#DC2626",
  redBg:       "#FEF2F2",
  redDot:      "#EF4444",

  // Status — slate (invalid)
  slate:       "#64748B",
  slateBg:     "#F8FAFC",
  slateDot:    "#94A3B8",
} as const;

export const fonts = {
  sans: "'DM Sans', system-ui, sans-serif",
  mono: "'DM Mono', 'Courier New', monospace",
} as const;

export const shadows = {
  sm:  "0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)",
  md:  "0 4px 12px rgba(0,0,0,0.08), 0 2px 4px rgba(0,0,0,0.04)",
  lg:  "0 8px 24px rgba(0,0,0,0.10), 0 2px 8px rgba(0,0,0,0.04)",
} as const;

export const layout = {
  topbarHeight: 56,
  sidebarWidth: 300,
  tickerHeight: 32,
} as const;

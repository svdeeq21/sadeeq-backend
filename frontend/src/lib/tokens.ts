// ─────────────────────────────────────────────
//  Svdeeq Command Center · Design Tokens
//  Theme: Dark ops terminal — deep charcoal + ops green
// ─────────────────────────────────────────────

export const colors = {
  // Base surfaces — deep charcoal stack
  bg:        "#0D0F0E",
  surface:   "#141716",
  surfaceB:  "#1A1D1C",
  surfaceC:  "#202423",
  surfaceD:  "#262B29",

  // Borders
  border:    "#2A2F2D",
  borderB:   "#333938",

  // Text — cool white scale
  ink:       "#E8EDE9",
  inkB:      "#B8C4BB",
  inkC:      "#7A8F7D",
  inkD:      "#4A5C4D",

  // Accent — ops green
  accent:    "#00D97E",
  accentDim: "#00A85F",
  accentBg:  "rgba(0,217,126,0.08)",
  accentGlow:"rgba(0,217,126,0.15)",

  // Status
  green:     "#00D97E",
  greenBg:   "rgba(0,217,126,0.10)",
  greenDot:  "#00D97E",

  amber:     "#F5A623",
  amberBg:   "rgba(245,166,35,0.10)",
  amberDot:  "#F5A623",

  red:       "#FF4444",
  redBg:     "rgba(255,68,68,0.10)",
  redDot:    "#FF4444",

  blue:      "#4F9EFF",
  blueBg:    "rgba(79,158,255,0.10)",

  slate:     "#5A6A6D",
  slateBg:   "rgba(90,106,109,0.10)",
  slateDot:  "#5A6A6D",

  // HOT/WARM/COLD lead heat
  hot:       "#FF4444",
  hotBg:     "rgba(255,68,68,0.12)",
  warm:      "#F5A623",
  warmBg:    "rgba(245,166,35,0.12)",
  cold:      "#4F9EFF",
  coldBg:    "rgba(79,158,255,0.12)",
} as const;

export const fonts = {
  sans:    "'DM Sans', system-ui, sans-serif",
  mono:    "'JetBrains Mono', 'Fira Code', monospace",
  display: "'DM Sans', system-ui, sans-serif",
} as const;

export const shadows = {
  sm:    "0 1px 3px rgba(0,0,0,0.4)",
  md:    "0 4px 16px rgba(0,0,0,0.5)",
  lg:    "0 8px 32px rgba(0,0,0,0.6)",
  glow:  "0 0 20px rgba(0,217,126,0.2)",
  glowSm:"0 0 10px rgba(0,217,126,0.12)",
} as const;

export const layout = {
  sidebarWidth: 220,
  topbarHeight: 56,
} as const;

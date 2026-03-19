// ─────────────────────────────────────────────
//  Svdeeq · Design Tokens v4
//  Aesthetic: Vercel-dark precision × Linear-clean
//  Near-black base, cool gray surfaces, single white accent
//  Grain texture, sharp borders, restrained color
// ─────────────────────────────────────────────

export const colors = {
  // Base — near black, cool-toned
  bg:        "#0A0A0B",
  surface:   "#111113",
  surfaceB:  "#161618",
  surfaceC:  "#1C1C1F",
  surfaceD:  "#222226",
  surfaceE:  "#2A2A2F",

  // Borders — very subtle
  border:    "#252528",
  borderB:   "#2E2E33",
  borderC:   "#3A3A40",

  // Text — cool white scale
  ink:       "#EDEDEF",
  inkB:      "#C0C0C8",
  inkC:      "#7A7A85",
  inkD:      "#48484F",

  // Primary accent — clean white/near-white (Vercel style)
  accent:    "#FFFFFF",
  accentDim: "#C0C0C8",
  accentBg:  "rgba(255,255,255,0.06)",
  accentGlow:"rgba(255,255,255,0.10)",

  // Functional colors — intentionally muted, don't compete with content
  green:    "#22C55E",
  greenBg:  "rgba(34,197,94,0.07)",
  greenDot: "#22C55E",

  amber:    "#D97706",
  amberBg:  "rgba(217,119,6,0.08)",
  amberDot: "#D97706",

  red:      "#EF4444",
  redBg:    "rgba(239,68,68,0.07)",
  redDot:   "#EF4444",

  blue:     "#3B82F6",
  blueBg:   "rgba(59,130,246,0.07)",
  blueDot:  "#3B82F6",

  purple:   "#8B5CF6",
  purpleBg: "rgba(139,92,246,0.07)",

  slate:    "#52525B",
  slateBg:  "rgba(82,82,91,0.08)",
  slateDot: "#71717A",

  // Lead heat — same muted approach
  hot:      "#EF4444",
  hotBg:    "rgba(239,68,68,0.08)",
  warm:     "#D97706",
  warmBg:   "rgba(217,119,6,0.08)",
  cold:     "#3B82F6",
  coldBg:   "rgba(59,130,246,0.08)",
} as const;

export const fonts = {
  display: "'Geist', 'DM Sans', system-ui, sans-serif",
  sans:    "'Geist', 'DM Sans', system-ui, sans-serif",
  mono:    "'Geist Mono', 'JetBrains Mono', monospace",
} as const;

export const shadows = {
  xs:     "0 1px 2px rgba(0,0,0,0.5)",
  sm:     "0 1px 6px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.03)",
  md:     "0 4px 16px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.04)",
  lg:     "0 8px 32px rgba(0,0,0,0.8)",
  glow:   "0 0 0 1px rgba(255,255,255,0.12), 0 4px 20px rgba(0,0,0,0.8)",
  glowSm: "0 0 0 1px rgba(255,255,255,0.08)",
} as const;

export const layout = {
  sidebarWidth: 220,
  topbarHeight: 52,
  mobileNavH:   60,
} as const;

export const radius = {
  xs:   "4px",
  sm:   "6px",
  md:   "8px",
  lg:   "10px",
  xl:   "14px",
  full: "9999px",
} as const;

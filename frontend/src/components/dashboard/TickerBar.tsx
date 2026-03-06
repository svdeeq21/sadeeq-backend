// ─────────────────────────────────────────────
//  Component: TickerBar  (v2)
// ─────────────────────────────────────────────
"use client";

import { colors, fonts, layout } from "@/lib/tokens";
import { useTicker } from "@/hooks";

export function TickerBar() {
  const message = useTicker();
  return (
    <footer style={{
      height: layout.tickerHeight, flexShrink: 0,
      background: colors.surface, borderTop: `1px solid ${colors.border}`,
      display: "flex", alignItems: "center", padding: "0 20px", gap: 10,
    }}>
      <span style={{
        fontSize: 10, fontWeight: 600, color: colors.accent,
        fontFamily: fonts.mono, letterSpacing: "0.08em",
        background: colors.accentBg, padding: "2px 7px", borderRadius: 4,
      }}>
        LIVE
      </span>
      <span style={{ fontFamily: fonts.mono, fontSize: 11.5, color: colors.inkC }}>
        ▸ {message}
      </span>
    </footer>
  );
}

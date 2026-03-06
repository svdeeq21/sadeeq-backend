// ─────────────────────────────────────────────
//  Component: Topbar
//  Sticky header with logo, system metrics rail,
//  and live auth indicator.
// ─────────────────────────────────────────────
"use client";

import { colors, fonts, shadows, layout } from "@/lib/tokens";
import { MOCK_SYSTEM_METRICS } from "@/lib/constants";
import { usePulse } from "@/hooks";

export function Topbar() {
  const pulse = usePulse();

  return (
    <header
      style={{
        background: colors.surface,
        borderBottom: `1px solid ${colors.border}`,
        padding: "0 20px",
        height: layout.topbarHeight,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        position: "sticky",
        top: 0,
        zIndex: 100,
        flexShrink: 0,
        boxShadow: shadows.sm,
      }}
    >
      {/* LOGO */}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div
          style={{
            width: 32, height: 32, borderRadius: 10,
            background: `linear-gradient(135deg, ${colors.accent} 0%, #7C3AED 100%)`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 16, boxShadow: `0 2px 8px ${colors.accent}40`,
          }}
        >
          💬
        </div>
        <div>
          <div style={{ fontSize: 15, fontWeight: 600, color: colors.ink, fontFamily: fonts.sans, letterSpacing: "-0.01em" }}>
            Svdeeq CRM
          </div>
          <div style={{ fontSize: 11, color: colors.inkD, fontFamily: fonts.mono }}>
            v2.0 · MVP
          </div>
        </div>
      </div>

      {/* METRICS RAIL */}
      <div style={{ display: "flex", alignItems: "stretch" }}>
        {MOCK_SYSTEM_METRICS.map((m) => (
          <div
            key={m.key}
            style={{
              padding: "0 18px",
              borderLeft: `1px solid ${colors.border}`,
              display: "flex", flexDirection: "column", justifyContent: "center",
            }}
          >
            <div style={{ fontSize: 10.5, color: colors.inkD, fontFamily: fonts.sans, marginBottom: 1 }}>
              {m.label}
            </div>
            <div style={{ fontSize: 12.5, fontWeight: 600, fontFamily: fonts.mono, color: m.good ? colors.green : colors.red }}>
              {m.value}
            </div>
          </div>
        ))}

        {/* AUTH INDICATOR */}
        <div
          style={{
            padding: "0 0 0 18px",
            borderLeft: `1px solid ${colors.border}`,
            display: "flex", alignItems: "center", gap: 7,
          }}
        >
          <div
            style={{
              width: 8, height: 8, borderRadius: "50%",
              background: colors.greenDot,
              boxShadow: pulse ? `0 0 0 3px ${colors.greenDot}30` : "none",
              transition: "box-shadow 0.6s ease",
            }}
          />
          <span style={{ fontSize: 13, fontWeight: 500, color: colors.inkB, fontFamily: fonts.sans }}>
            Admin
          </span>
        </div>
      </div>
    </header>
  );
}

"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { colors, fonts, layout, shadows } from "@/lib/tokens";

const NAV = [
  { href: "/",               icon: "⬡",  label: "Overview" },
  { href: "/leads",          icon: "◈",  label: "Leads" },
  { href: "/conversations",  icon: "◉",  label: "Conversations" },
  { href: "/analytics",      icon: "◎",  label: "Analytics" },
  { href: "/campaigns",      icon: "▦",  label: "Campaigns" },
  { href: "/calls",          icon: "◷",  label: "Calls" },
  { href: "/import",         icon: "↓",  label: "Import" },
  { href: "/safety",         icon: "⊘",  label: "Safety" },
  { href: "/settings",       icon: "◬",  label: "Settings" },
];

function LiveDot() {
  const [on, setOn] = useState(true);
  useEffect(() => {
    const t = setInterval(() => setOn(p => !p), 900);
    return () => clearInterval(t);
  }, []);
  return (
    <span style={{
      width: 6, height: 6, borderRadius: "50%",
      background: on ? colors.accent : `${colors.accent}40`,
      display: "inline-block",
      boxShadow: on ? `0 0 6px ${colors.accent}` : "none",
      transition: "all 0.4s", flexShrink: 0,
    }} />
  );
}

export function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const activeLabel = NAV.find(n => n.href === path || (n.href !== "/" && path.startsWith(n.href)))?.label ?? "Overview";

  return (
    <div style={{ display: "flex", height: "100vh", background: colors.bg, overflow: "hidden" }}>
      <nav style={{
        width: layout.sidebarWidth, background: colors.surface,
        borderRight: `1px solid ${colors.border}`,
        display: "flex", flexDirection: "column", flexShrink: 0,
      }}>
        <div style={{
          height: layout.topbarHeight, display: "flex", alignItems: "center",
          padding: "0 16px", gap: 10, borderBottom: `1px solid ${colors.border}`,
        }}>
          <div style={{
            width: 32, height: 32, borderRadius: 9, background: colors.accentBg,
            border: `1px solid ${colors.accent}35`, display: "flex",
            alignItems: "center", justifyContent: "center",
            fontSize: 15, color: colors.accent, fontWeight: 800,
            fontFamily: fonts.mono, boxShadow: shadows.glowSm,
          }}>S</div>
          <div>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: colors.ink, fontFamily: fonts.sans, letterSpacing: "-0.01em" }}>Svdeeq</div>
            <div style={{ fontSize: 10, color: colors.inkD, fontFamily: fonts.mono, display: "flex", alignItems: "center", gap: 5 }}>
              <LiveDot /> LIVE
            </div>
          </div>
        </div>
        <div style={{ flex: 1, padding: "10px 8px", display: "flex", flexDirection: "column", gap: 1, overflowY: "auto" }}>
          {NAV.map(({ href, icon, label }) => {
            const active = path === href || (href !== "/" && path.startsWith(href));
            return (
              <Link key={href} href={href} style={{
                display: "flex", alignItems: "center", gap: 9,
                padding: "8px 10px", borderRadius: 7, textDecoration: "none",
                background: active ? colors.accentBg : "transparent",
                color: active ? colors.accent : colors.inkC,
                fontSize: 13, fontFamily: fonts.sans, fontWeight: active ? 600 : 400,
                transition: "all 0.13s",
                borderLeft: `2px solid ${active ? colors.accent : "transparent"}`,
              }}>
                <span style={{ fontSize: 14, fontFamily: fonts.mono, opacity: active ? 1 : 0.5, flexShrink: 0 }}>{icon}</span>
                {label}
              </Link>
            );
          })}
        </div>
        <div style={{ padding: "12px 16px", borderTop: `1px solid ${colors.border}`, fontSize: 10.5, color: colors.inkD, fontFamily: fonts.mono }}>
          svdeeq-bot · v2.0
        </div>
      </nav>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minWidth: 0 }}>
        <header style={{
          height: layout.topbarHeight, background: colors.surface,
          borderBottom: `1px solid ${colors.border}`, display: "flex",
          alignItems: "center", padding: "0 24px", justifyContent: "space-between",
          flexShrink: 0, boxShadow: shadows.sm,
        }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: colors.ink, fontFamily: fonts.sans }}>{activeLabel}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <span style={{ fontSize: 11.5, color: colors.inkD, fontFamily: fonts.mono }}>
              {new Date().toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
            </span>
            <div style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "5px 10px", borderRadius: 6,
              background: colors.greenBg, border: `1px solid ${colors.green}20`,
            }}>
              <LiveDot />
              <span style={{ fontSize: 11, color: colors.green, fontFamily: fonts.mono, fontWeight: 500 }}>Bot Active</span>
            </div>
          </div>
        </header>
        <main style={{ flex: 1, overflow: "auto" }}>{children}</main>
      </div>
    </div>
  );
}

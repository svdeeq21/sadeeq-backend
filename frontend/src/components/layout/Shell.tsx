"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { colors, fonts, layout, shadows, radius } from "@/lib/tokens";

const NAV = [
  { href: "/",              icon: "○",  label: "Overview"     },
  { href: "/leads",         icon: "·",  label: "Leads"        },
  { href: "/conversations", icon: "◌",  label: "Conversations"},
  { href: "/analytics",     icon: "∿",  label: "Analytics"    },
  { href: "/campaigns",     icon: "≡",  label: "Campaigns"    },
  { href: "/calls",         icon: "◎",  label: "Calls"        },
  { href: "/import",        icon: "↓",  label: "Import"       },
  { href: "/safety",        icon: "⊗",  label: "Safety"       },
  { href: "/settings",      icon: "⊙",  label: "Settings"     },
];

const MOBILE_PRIMARY = NAV.slice(0, 5);

function PulseDot({ color = colors.green }: { color?: string }) {
  const [on, setOn] = useState(true);
  useEffect(() => {
    const t = setInterval(() => setOn(p => !p), 1200);
    return () => clearInterval(t);
  }, []);
  return (
    <span style={{
      width: 6, height: 6, borderRadius: "50%",
      background: color, display: "inline-block", flexShrink: 0,
      opacity: on ? 1 : 0.3, transition: "opacity 0.6s ease",
    }} />
  );
}

export function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const activeLabel = NAV.find(n => n.href === path || (n.href !== "/" && path.startsWith(n.href)))?.label ?? "Overview";

  return (
    <>
      {/* ────────── DESKTOP ────────── */}
      <div className="layout-desktop" style={{
        display: "flex", height: "100vh",
        background: colors.bg, overflow: "hidden",
      }}>
        {/* Sidebar */}
        <aside style={{
          width: layout.sidebarWidth,
          background: colors.surface,
          borderRight: `1px solid ${colors.border}`,
          display: "flex", flexDirection: "column",
          flexShrink: 0,
        }}>
          {/* Wordmark */}
          <div style={{
            height: layout.topbarHeight,
            display: "flex", alignItems: "center",
            padding: "0 18px",
            borderBottom: `1px solid ${colors.border}`,
            gap: 10,
          }}>
            <div style={{
              width: 26, height: 26, borderRadius: radius.sm,
              background: colors.surfaceD,
              border: `1px solid ${colors.borderC}`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 11, fontWeight: 700, color: colors.ink,
              fontFamily: fonts.mono, letterSpacing: "0.02em",
              flexShrink: 0,
            }}>SV</div>
            <span style={{
              fontSize: 13.5, fontWeight: 600, color: colors.ink,
              fontFamily: fonts.sans, letterSpacing: "-0.01em",
            }}>Svdeeq</span>
            <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 5 }}>
              <PulseDot />
            </div>
          </div>

          {/* Nav */}
          <nav style={{ flex: 1, padding: "8px", overflow: "auto" }}>
            <div style={{ fontSize: 10, fontWeight: 500, color: colors.inkD, letterSpacing: "0.06em", textTransform: "uppercase", padding: "8px 10px 4px", fontFamily: fonts.mono }}>
              Workspace
            </div>
            {NAV.map(({ href, icon, label }) => {
              const active = path === href || (href !== "/" && path.startsWith(href));
              return (
                <Link key={href} href={href} style={{
                  display: "flex", alignItems: "center", gap: 8,
                  padding: "7px 10px", borderRadius: radius.md,
                  textDecoration: "none", marginBottom: 1,
                  background: active ? colors.surfaceC : "transparent",
                  color: active ? colors.ink : colors.inkC,
                  fontSize: 13, fontFamily: fonts.sans,
                  fontWeight: active ? 500 : 400,
                  transition: "all 0.12s",
                  border: `1px solid ${active ? colors.borderB : "transparent"}`,
                }}>
                  <span style={{
                    fontSize: 13, fontFamily: fonts.mono,
                    color: active ? colors.ink : colors.inkD,
                    width: 16, textAlign: "center", flexShrink: 0,
                  }}>{icon}</span>
                  {label}
                </Link>
              );
            })}
          </nav>

          {/* Status footer */}
          <div style={{
            padding: "12px 16px",
            borderTop: `1px solid ${colors.border}`,
            display: "flex", alignItems: "center", gap: 8,
          }}>
            <PulseDot color={colors.green} />
            <span style={{ fontSize: 11, color: colors.inkC, fontFamily: fonts.mono }}>Bot running</span>
            <span style={{ marginLeft: "auto", fontSize: 10, color: colors.inkD, fontFamily: fonts.mono }}>v2.0</span>
          </div>
        </aside>

        {/* Content */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minWidth: 0 }}>
          {/* Topbar */}
          <header style={{
            height: layout.topbarHeight,
            background: colors.surface,
            borderBottom: `1px solid ${colors.border}`,
            display: "flex", alignItems: "center",
            padding: "0 24px",
            justifyContent: "space-between",
            flexShrink: 0,
          }}>
            <span style={{
              fontSize: 14, fontWeight: 600, color: colors.ink,
              fontFamily: fonts.sans, letterSpacing: "-0.01em",
            }}>
              {activeLabel}
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 11.5, color: colors.inkD, fontFamily: fonts.mono }}>
                {new Date().toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
              </span>
              <div style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "4px 10px", borderRadius: radius.full,
                background: colors.greenBg,
                border: `1px solid ${colors.green}20`,
                fontSize: 11, color: colors.green,
                fontFamily: fonts.mono, fontWeight: 500,
              }}>
                <PulseDot color={colors.green} />
                Active
              </div>
            </div>
          </header>
          <main style={{ flex: 1, overflow: "auto" }}>{children}</main>
        </div>
      </div>

      {/* ────────── MOBILE ────────── */}
      <div className="layout-mobile" style={{
        display: "none", flexDirection: "column",
        height: "100vh", background: colors.bg, overflow: "hidden",
      }}>
        {/* Mobile header */}
        <header style={{
          height: 52, background: colors.surface,
          borderBottom: `1px solid ${colors.border}`,
          display: "flex", alignItems: "center",
          padding: "0 16px", justifyContent: "space-between",
          flexShrink: 0,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{
              width: 24, height: 24, borderRadius: radius.sm,
              background: colors.surfaceD, border: `1px solid ${colors.borderC}`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 10, fontWeight: 700, color: colors.ink, fontFamily: fonts.mono,
            }}>SV</div>
            <span style={{ fontSize: 13, fontWeight: 600, color: colors.ink, fontFamily: fonts.sans }}>
              {activeLabel}
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{
              display: "flex", alignItems: "center", gap: 5,
              padding: "3px 9px", borderRadius: radius.full,
              background: colors.greenBg, border: `1px solid ${colors.green}20`,
              fontSize: 10, color: colors.green, fontFamily: fonts.mono,
            }}>
              <PulseDot color={colors.green} /> Live
            </div>
            <button
              onClick={() => setMoreOpen(p => !p)}
              style={{
                width: 32, height: 32, borderRadius: radius.md,
                background: moreOpen ? colors.surfaceC : "transparent",
                border: `1px solid ${moreOpen ? colors.borderB : "transparent"}`,
                color: colors.inkC, fontSize: 18, cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
              {moreOpen ? "✕" : "⋯"}
            </button>
          </div>
        </header>

        {/* More menu */}
        {moreOpen && (
          <div style={{
            position: "absolute", top: 52, left: 0, right: 0, zIndex: 200,
            background: colors.surface, borderBottom: `1px solid ${colors.border}`,
            padding: "6px 10px 10px",
          }}>
            {NAV.slice(5).map(({ href, icon, label }) => {
              const active = path === href || (href !== "/" && path.startsWith(href));
              return (
                <Link key={href} href={href} onClick={() => setMoreOpen(false)} style={{
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "10px 12px", borderRadius: radius.md,
                  textDecoration: "none", marginBottom: 2,
                  background: active ? colors.surfaceC : "transparent",
                  color: active ? colors.ink : colors.inkB,
                  fontSize: 14, fontFamily: fonts.sans,
                }}>
                  <span style={{ fontFamily: fonts.mono, color: colors.inkD, width: 16, textAlign: "center" }}>{icon}</span>
                  {label}
                </Link>
              );
            })}
          </div>
        )}

        {/* Content */}
        <main style={{ flex: 1, overflow: "auto", paddingBottom: layout.mobileNavH }}>
          {children}
        </main>

        {/* Bottom nav */}
        <nav className="mobile-safe" style={{
          position: "fixed", bottom: 0, left: 0, right: 0,
          height: layout.mobileNavH,
          background: colors.surface,
          borderTop: `1px solid ${colors.border}`,
          display: "flex", alignItems: "center",
          zIndex: 100,
        }}>
          {MOBILE_PRIMARY.map(({ href, icon, label }) => {
            const active = path === href || (href !== "/" && path.startsWith(href));
            return (
              <Link key={href} href={href} style={{
                flex: 1, display: "flex", flexDirection: "column",
                alignItems: "center", justifyContent: "center",
                gap: 4, textDecoration: "none", padding: "6px 0",
                color: active ? colors.ink : colors.inkD,
                position: "relative",
              }}>
                {active && (
                  <span style={{
                    position: "absolute", top: 0, left: "50%",
                    transform: "translateX(-50%)",
                    width: 20, height: 1.5, borderRadius: "0 0 2px 2px",
                    background: colors.ink,
                  }} />
                )}
                <span style={{
                  fontSize: 16, fontFamily: fonts.mono,
                  color: active ? colors.ink : colors.inkD,
                  transition: "color 0.15s",
                }}>{icon}</span>
                <span style={{
                  fontSize: 10, fontFamily: fonts.sans,
                  fontWeight: active ? 600 : 400,
                  color: active ? colors.inkB : colors.inkD,
                }}>{label}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Responsive breakpoint */}
      <style>{`
        @media (min-width: 768px) {
          .layout-desktop { display: flex !important; }
          .layout-mobile  { display: none !important; }
        }
        @media (max-width: 767px) {
          .layout-desktop { display: none !important; }
          .layout-mobile  { display: flex !important; }
        }
      `}</style>
    </>
  );
}

"use client";
import { colors, fonts, shadows } from "@/lib/tokens";
import { STATUS_CONFIG, STATE_CONFIG, heatColor, heatLabel } from "@/lib/constants";
import type { LeadStatus, ConversationState } from "@/types";

// ── Status Badge ──────────────────────────────
export function StatusBadge({ status }: { status: LeadStatus }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG["PENDING"];
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      padding: "3px 8px", borderRadius: 6,
      background: cfg.bg, fontSize: 11, fontWeight: 500,
      color: cfg.color, fontFamily: fonts.mono,
      border: `1px solid ${cfg.dot}20`,
    }}>
      <span style={{
        width: 5, height: 5, borderRadius: "50%",
        background: cfg.dot, display: "inline-block",
      }} />
      {cfg.label}
    </span>
  );
}

// ── State Badge ───────────────────────────────
export function StateBadge({ state }: { state: ConversationState }) {
  const cfg = STATE_CONFIG[state] ?? STATE_CONFIG["COLD"];
  return (
    <span style={{
      display: "inline-flex", alignItems: "center",
      padding: "2px 7px", borderRadius: 4,
      background: `${cfg.color}14`, fontSize: 10.5, fontWeight: 600,
      color: cfg.color, fontFamily: fonts.mono, letterSpacing: "0.04em",
    }}>
      {cfg.label.toUpperCase()}
    </span>
  );
}

// ── Heat Badge ────────────────────────────────
export function HeatBadge({ score }: { score: number }) {
  const label = heatLabel(score);
  const color = heatColor(score);
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      padding: "2px 7px", borderRadius: 4,
      background: `${color}14`, fontSize: 10.5, fontWeight: 700,
      color, fontFamily: fonts.mono,
    }}>
      {label === "HOT" ? "🔥" : label === "WARM" ? "◉" : "○"} {label}
    </span>
  );
}

// ── Score Bar ─────────────────────────────────
export function ScoreBar({ score }: { score: number }) {
  const color = heatColor(score);
  const pct = Math.round((score ?? 0) * 100);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{ width: 60, height: 3, background: colors.surfaceD, borderRadius: 2 }}>
        <div style={{
          width: `${pct}%`, height: "100%", borderRadius: 2,
          background: color, transition: "width 0.4s",
        }} />
      </div>
      <span style={{ fontSize: 10.5, fontFamily: fonts.mono, color, fontWeight: 600 }}>
        {pct}
      </span>
    </div>
  );
}

// ── Button ────────────────────────────────────
type BtnVariant = "primary" | "danger" | "warning" | "ghost" | "success";
export function Btn({
  children, onClick, variant = "ghost", small, disabled,
}: {
  children: React.ReactNode; onClick?: () => void;
  variant?: BtnVariant; small?: boolean; disabled?: boolean;
}) {
  const styles: Record<BtnVariant, { bg: string; color: string; border: string }> = {
    primary: { bg: colors.accent,    color: "#000",         border: "transparent" },
    success: { bg: colors.greenBg,   color: colors.green,   border: `${colors.green}30` },
    warning: { bg: colors.amberBg,   color: colors.amber,   border: `${colors.amber}30` },
    danger:  { bg: colors.redBg,     color: colors.red,     border: `${colors.red}30` },
    ghost:   { bg: colors.surfaceC,  color: colors.inkB,    border: colors.border },
  };
  const s = styles[variant];
  return (
    <button onClick={onClick} disabled={disabled} style={{
      padding: small ? "5px 10px" : "7px 14px",
      borderRadius: 7, cursor: disabled ? "not-allowed" : "pointer",
      fontFamily: fonts.sans, fontSize: small ? 11.5 : 12.5, fontWeight: 500,
      background: s.bg, color: s.color,
      border: `1px solid ${s.border}`,
      opacity: disabled ? 0.5 : 1,
      transition: "all 0.15s", whiteSpace: "nowrap",
    }}>
      {children}
    </button>
  );
}

// ── Card ──────────────────────────────────────
export function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      background: colors.surface, border: `1px solid ${colors.border}`,
      borderRadius: 12, boxShadow: shadows.sm, ...style,
    }}>
      {children}
    </div>
  );
}

// ── Section Header ────────────────────────────
export function SectionHeader({ title, sub, action }: {
  title: string; sub?: string; action?: React.ReactNode;
}) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 20 }}>
      <div>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: colors.ink, fontFamily: fonts.sans, letterSpacing: "-0.02em", marginBottom: 2 }}>
          {title}
        </h2>
        {sub && <p style={{ fontSize: 12.5, color: colors.inkC, fontFamily: fonts.sans }}>{sub}</p>}
      </div>
      {action}
    </div>
  );
}

// ── Empty State ───────────────────────────────
export function Empty({ label }: { label: string }) {
  return (
    <div style={{ textAlign: "center", padding: "48px 0", color: colors.inkD, fontSize: 13, fontFamily: fonts.sans }}>
      {label}
    </div>
  );
}

// ── Loading ───────────────────────────────────
export function Loading() {
  return (
    <div style={{ textAlign: "center", padding: "48px 0", color: colors.inkD, fontSize: 12, fontFamily: fonts.mono }}>
      loading...
    </div>
  );
}

// ── Stat Card ─────────────────────────────────
export function StatCard({ label, value, sub, accent, color }: {
  label: string; value: string | number; sub?: string; accent?: boolean; color?: string;
}) {
  const c = color ?? (accent ? colors.accent : colors.ink);
  return (
    <Card style={{ padding: "18px 20px", position: "relative", overflow: "hidden" }}>
      {accent && (
        <div style={{
          position: "absolute", top: 0, left: 0, right: 0, height: 2,
          background: `linear-gradient(90deg, ${colors.accent}, transparent)`,
        }} />
      )}
      <div style={{ fontSize: 10.5, fontWeight: 500, color: colors.inkD, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8, fontFamily: fonts.mono }}>
        {label}
      </div>
      <div style={{ fontSize: 28, fontWeight: 700, color: c, fontFamily: fonts.mono, letterSpacing: "-0.02em", marginBottom: 3 }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: 11.5, color: colors.inkD, fontFamily: fonts.sans }}>{sub}</div>}
    </Card>
  );
}

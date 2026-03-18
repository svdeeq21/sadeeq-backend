"use client";
import { colors, fonts, shadows, radius } from "@/lib/tokens";
import { STATUS_CONFIG, STATE_CONFIG, heatColor, heatLabel } from "@/lib/constants";
import type { LeadStatus, ConversationState } from "@/types";

export function StatusBadge({ status }: { status: LeadStatus }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG["PENDING"];
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      padding: "2px 8px", borderRadius: radius.full,
      background: cfg.bg, fontSize: 10.5, fontWeight: 500,
      color: cfg.color, fontFamily: fonts.mono,
      border: `1px solid ${cfg.dot}18`, whiteSpace: "nowrap",
    }}>
      <span style={{ width: 5, height: 5, borderRadius: "50%", background: cfg.dot, display: "inline-block", flexShrink: 0 }} />
      {cfg.label}
    </span>
  );
}

export function StateBadge({ state }: { state: ConversationState }) {
  const cfg = STATE_CONFIG[state] ?? STATE_CONFIG["COLD"];
  return (
    <span style={{
      display: "inline-flex", alignItems: "center",
      padding: "2px 7px", borderRadius: radius.sm,
      background: `${cfg.color}10`, fontSize: 10, fontWeight: 600,
      color: cfg.color, fontFamily: fonts.mono, letterSpacing: "0.04em",
      whiteSpace: "nowrap",
    }}>
      {cfg.label.toUpperCase()}
    </span>
  );
}

export function HeatBadge({ score }: { score: number }) {
  const label = heatLabel(score);
  const color = heatColor(score);
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 3,
      padding: "2px 7px", borderRadius: radius.sm,
      background: `${color}10`, fontSize: 10, fontWeight: 600,
      color, fontFamily: fonts.mono, whiteSpace: "nowrap",
    }}>
      {label}
    </span>
  );
}

export function ScoreBar({ score }: { score: number }) {
  const color = heatColor(score);
  const pct   = Math.round((score ?? 0) * 100);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <div style={{ width: 48, height: 3, background: colors.surfaceE, borderRadius: 99, overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 99, transition: "width 0.4s" }} />
      </div>
      <span style={{ fontSize: 10, fontFamily: fonts.mono, color: colors.inkC }}>{pct}</span>
    </div>
  );
}

type BtnVariant = "primary" | "danger" | "warning" | "ghost" | "success";
export function Btn({ children, onClick, variant = "ghost", small, disabled }: {
  children: React.ReactNode; onClick?: () => void;
  variant?: BtnVariant; small?: boolean; disabled?: boolean;
}) {
  const v: Record<BtnVariant, { bg: string; color: string; border: string }> = {
    primary: { bg: colors.ink,      color: colors.bg,   border: "transparent" },
    success: { bg: colors.greenBg,  color: colors.green, border: `${colors.green}20` },
    warning: { bg: colors.amberBg,  color: colors.amber, border: `${colors.amber}20` },
    danger:  { bg: colors.redBg,    color: colors.red,   border: `${colors.red}20` },
    ghost:   { bg: colors.surfaceC, color: colors.inkB,  border: colors.border },
  };
  const s = v[variant];
  return (
    <button onClick={onClick} disabled={disabled} style={{
      padding: small ? "4px 10px" : "7px 14px",
      borderRadius: radius.md, cursor: disabled ? "not-allowed" : "pointer",
      fontFamily: fonts.sans, fontSize: small ? 11.5 : 12.5, fontWeight: 500,
      background: s.bg, color: s.color, border: `1px solid ${s.border}`,
      opacity: disabled ? 0.4 : 1, transition: "all 0.12s",
      whiteSpace: "nowrap", lineHeight: 1,
    }}>
      {children}
    </button>
  );
}

export function Card({ children, style, highlight }: {
  children: React.ReactNode; style?: React.CSSProperties; highlight?: boolean;
}) {
  return (
    <div style={{
      background: colors.surface,
      border: `1px solid ${highlight ? colors.borderC : colors.border}`,
      borderRadius: radius.lg,
      boxShadow: highlight ? shadows.md : shadows.sm,
      ...style,
    }}>
      {children}
    </div>
  );
}

export function StatCard({ label, value, sub, highlight, color, icon }: {
  label: string; value: string | number; sub?: string;
  highlight?: boolean; color?: string; icon?: string;
}) {
  const c = color ?? colors.ink;
  return (
    <Card highlight={highlight} style={{ padding: "16px 18px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <span style={{ fontSize: 10.5, fontWeight: 500, color: colors.inkD, textTransform: "uppercase", letterSpacing: "0.07em", fontFamily: fonts.mono }}>
          {label}
        </span>
        {icon && <span style={{ fontSize: 13, opacity: 0.4 }}>{icon}</span>}
      </div>
      <div style={{ fontSize: 28, fontWeight: 700, color: c, fontFamily: fonts.sans, letterSpacing: "-0.03em", lineHeight: 1, marginBottom: sub ? 6 : 0 }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: 11.5, color: colors.inkD, fontFamily: fonts.sans, marginTop: 4 }}>{sub}</div>}
    </Card>
  );
}

export function SectionHeader({ title, sub, action }: {
  title: string; sub?: string; action?: React.ReactNode;
}) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 20 }}>
      <div>
        <h2 style={{ fontSize: 18, fontWeight: 600, color: colors.ink, fontFamily: fonts.sans, letterSpacing: "-0.02em", marginBottom: 2 }}>
          {title}
        </h2>
        {sub && <p style={{ fontSize: 12.5, color: colors.inkC, fontFamily: fonts.sans }}>{sub}</p>}
      </div>
      {action}
    </div>
  );
}

export function Empty({ label }: { label: string }) {
  return (
    <div style={{ textAlign: "center", padding: "48px 20px" }}>
      <div style={{ fontSize: 11, color: colors.inkD, fontFamily: fonts.mono, marginBottom: 8, letterSpacing: "0.05em" }}>EMPTY</div>
      <div style={{ color: colors.inkC, fontSize: 13, fontFamily: fonts.sans }}>{label}</div>
    </div>
  );
}

export function Loading() {
  return (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", padding: "48px 0", gap: 6 }}>
      {[0,1,2].map(i => (
        <div key={i} style={{
          width: 4, height: 4, borderRadius: "50%",
          background: colors.inkD,
          animation: `pulse-dot 1.4s ease ${i * 0.15}s infinite`,
        }} />
      ))}
    </div>
  );
}

export function Divider() {
  return <div style={{ height: 1, background: colors.border, margin: "4px 0" }} />;
}

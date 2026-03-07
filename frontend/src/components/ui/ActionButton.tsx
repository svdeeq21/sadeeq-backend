"use client";
import { colors } from "@/lib/tokens";

type Variant = "success" | "warning" | "danger" | "ghost";

const STYLES: Record<Variant, { bg: string; color: string; border: string }> = {
  success: { bg: "#1A2E22", color: "#23A55A", border: "1px solid #23A55A40" },
  warning: { bg: "#2C2000", color: "#F0B429", border: "1px solid #F0B42940" },
  danger:  { bg: "#2C1215", color: "#F23F43", border: "1px solid #F23F4340" },
  ghost:   { bg: "transparent", color: colors.inkC, border: `1px solid ${colors.borderB}` },
};

export function ActionButton({ variant, onClick, children }: { variant: Variant; onClick?: () => void; children: React.ReactNode }) {
  const s = STYLES[variant];
  return (
    <button onClick={onClick} style={{
      padding: "6px 14px", borderRadius: 6,
      background: s.bg, border: s.border,
      color: s.color, fontSize: 12.5, fontWeight: 600, cursor: "pointer",
    }}>{children}</button>
  );
}

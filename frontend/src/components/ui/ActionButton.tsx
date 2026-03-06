// ─────────────────────────────────────────────
//  Component: ActionButton  (v2)
//  Variants: success, warning, danger, ghost
// ─────────────────────────────────────────────
import { colors } from "@/lib/tokens";
import type { CSSProperties, ReactNode } from "react";

type Variant = "success" | "warning" | "danger" | "ghost";

interface Props {
  variant: Variant;
  onClick?: () => void;
  children: ReactNode;
}

const VARIANT_STYLES: Record<Variant, CSSProperties> = {
  success: { background: colors.greenBg,  border: `1px solid ${colors.green}28`,  color: colors.green  },
  warning: { background: colors.amberBg,  border: `1px solid ${colors.amber}28`,  color: colors.amber  },
  danger:  { background: colors.redBg,    border: `1px solid ${colors.red}28`,    color: colors.red    },
  ghost:   { background: colors.surfaceB, border: `1px solid ${colors.border}`,   color: colors.inkB   },
};

export function ActionButton({ variant, onClick, children }: Props) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        padding: "7px 14px",
        borderRadius: 8,
        cursor: "pointer",
        fontFamily: "'DM Sans', system-ui, sans-serif",
        fontSize: 13,
        fontWeight: 500,
        transition: "opacity 0.15s",
        whiteSpace: "nowrap",
        ...VARIANT_STYLES[variant],
      }}
      onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.8")}
      onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
    >
      {children}
    </button>
  );
}

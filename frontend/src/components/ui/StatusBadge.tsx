// ─────────────────────────────────────────────
//  Component: StatusBadge
//  Renders a colored pill with a glowing dot
//  for each lead status value.
// ─────────────────────────────────────────────
import type { LeadStatus } from "@/types";
import { STATUS_CONFIG } from "@/lib/constants";

interface Props {
  status: LeadStatus;
}

export function StatusBadge({ status }: Props) {
  const cfg = STATUS_CONFIG[status];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        padding: "3px 9px",
        borderRadius: 99,
        background: cfg.bg,
        border: `1px solid ${cfg.color}28`,
        fontFamily: "'DM Sans', system-ui, sans-serif",
        fontSize: 11.5,
        fontWeight: 500,
        color: cfg.color,
        letterSpacing: "0.01em",
        whiteSpace: "nowrap",
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: cfg.dot,
          flexShrink: 0,
        }}
      />
      {cfg.label}
    </span>
  );
}

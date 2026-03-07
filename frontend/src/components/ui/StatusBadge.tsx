import type { LeadStatus } from "@/types";
import { STATUS_CONFIG } from "@/lib/constants";

const FALLBACK = { label: "Unknown", color: "#80848E", bg: "#2C2F33", dot: "#4E5058" };

export function StatusBadge({ status }: { status: LeadStatus | string }) {
  const cfg = STATUS_CONFIG[status as LeadStatus] ?? FALLBACK;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      padding: "2px 8px", borderRadius: 99,
      background: cfg.bg, border: `1px solid ${cfg.color}35`,
      fontSize: 11, fontWeight: 600, color: cfg.color,
    }}>
      <span style={{ width: 5, height: 5, borderRadius: "50%", background: cfg.dot }} />
      {cfg.label}
    </span>
  );
}

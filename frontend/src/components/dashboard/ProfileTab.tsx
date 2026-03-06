// ─────────────────────────────────────────────
//  Component: ProfileTab  (v2)
// ─────────────────────────────────────────────
import { colors, fonts, shadows } from "@/lib/tokens";
import type { Lead } from "@/types";

function getSummary(lead: Lead): string {
  if (lead.status === "HUMAN_REQUIRED")
    return "Lead requested a file/document export. AI escalated after detecting unsupported media request. Awaiting agent follow-up.";
  if (lead.status === "INVALID_NUMBER")
    return "Number could not be reached after 3 delivery attempts. Marked as invalid. No conversation recorded.";
  return `Lead expressed interest in ${lead.interest} in ${lead.location}. Budget confirmed at ${lead.budget}. AI is actively engaged with Q&A in progress. No escalation triggers detected.`;
}

export function ProfileTab({ lead }: { lead: Lead }) {
  const fields: [string, string][] = [
    ["Lead ID",        lead.id],
    ["Location",       lead.location],
    ["Budget Range",   lead.budget],
    ["Interest Type",  lead.interest],
    ["Total Messages", String(lead.messages)],
    ["Last Activity",  lead.lastActive],
    ["AI Status",      lead.ai_paused ? "Paused" : "Active"],
    ["Escalated",      lead.escalated ? "Yes — awaiting agent" : "No"],
  ];

  return (
    <div style={{ overflowY: "auto", flex: 1, padding: "20px 24px" }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, maxWidth: 720 }}>
        {fields.map(([k, v]) => (
          <div key={k} style={{
            background: colors.surface, border: `1px solid ${colors.border}`,
            borderRadius: 10, padding: "14px 16px", boxShadow: shadows.sm,
          }}>
            <div style={{ fontSize: 11, fontWeight: 500, color: colors.inkD, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 5, fontFamily: fonts.sans }}>
              {k}
            </div>
            <div style={{ fontSize: 14, fontWeight: 500, color: colors.ink, fontFamily: k === "Lead ID" ? fonts.mono : fonts.sans }}>
              {v}
            </div>
          </div>
        ))}

        <div style={{
          gridColumn: "1 / -1",
          background: colors.surface, border: `1px solid ${colors.border}`,
          borderRadius: 10, padding: "16px 18px", boxShadow: shadows.sm,
        }}>
          <div style={{ fontSize: 11, fontWeight: 500, color: colors.inkD, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8, fontFamily: fonts.sans }}>
            Conversation Summary
          </div>
          <div style={{ fontSize: 13.5, color: colors.inkB, lineHeight: 1.7, fontFamily: fonts.sans }}>
            {getSummary(lead)}
          </div>
        </div>
      </div>
    </div>
  );
}

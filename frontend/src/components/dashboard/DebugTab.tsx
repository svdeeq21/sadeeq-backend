// ─────────────────────────────────────────────
//  Component: DebugTab  (v2)
// ─────────────────────────────────────────────
import { colors, fonts, shadows } from "@/lib/tokens";
import type { Lead } from "@/types";

export function DebugTab({ lead }: { lead: Lead }) {
  const rows: [string, string][] = [
    ["vector_search_score",  lead.score > 0 ? lead.score.toFixed(4) : "n/a"],
    ["chunks_retrieved",     lead.score > 0 ? "3" : "0"],
    ["embedding_model",      "text-embedding-004"],
    ["llm_model",            "gemini-1.5-flash"],
    ["avg_latency_ms",       lead.score > 0 ? "1382" : "—"],
    ["rate_limit_hits",      "0"],
    ["fallback_triggered",   "false"],
    ["memory_window",        "last 6 exchanges"],
    ["summary_updated",      lead.messages > 0 ? `msg #${Math.min(5, lead.messages)}` : "—"],
    ["escalation_reason",    lead.escalated ? "MEDIA_REQUEST" : "none"],
  ];
  const dim = new Set(["false", "none", "—", "n/a", "0"]);

  return (
    <div style={{ overflowY: "auto", flex: 1, padding: "20px 24px" }}>
      <div style={{
        background: colors.surface, border: `1px solid ${colors.border}`,
        borderRadius: 10, overflow: "hidden", boxShadow: shadows.sm, maxWidth: 600,
      }}>
        <div style={{ padding: "12px 16px", borderBottom: `1px solid ${colors.border}`, background: colors.bg }}>
          <span style={{ fontFamily: fonts.mono, fontSize: 12, fontWeight: 500, color: colors.accent }}>
            RAG Debug · {lead.id}
          </span>
        </div>
        {rows.map(([k, v], i) => (
          <div key={k} style={{
            display: "flex", alignItems: "center",
            padding: "10px 16px",
            borderBottom: `1px solid ${colors.border}`,
            background: i % 2 === 0 ? "transparent" : colors.bg,
          }}>
            <span style={{ fontFamily: fonts.mono, fontSize: 12, color: colors.inkC, minWidth: 200 }}>{k}</span>
            <span style={{ fontFamily: fonts.mono, fontSize: 12, fontWeight: 500, color: dim.has(v) ? colors.inkD : colors.ink }}>{v}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

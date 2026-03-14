"use client";
import { useEffect, useState } from "react";
import { Shell } from "@/components/layout/Shell";
import { Card, StatCard, Loading, SectionHeader } from "@/components/ui";
import { colors, fonts } from "@/lib/tokens";
import { fetchStats, fetchLeads } from "@/lib/api";
import { STATE_CONFIG } from "@/lib/constants";
import type { Lead, ConversationState } from "@/types";

function BarChart({ data, color = colors.accent }: { data: { label: string; value: number }[]; color?: string }) {
  const max = Math.max(...data.map(d => d.value), 1);
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height: 120 }}>
      {data.map(d => (
        <div key={d.label} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 11, color, fontFamily: fonts.mono, fontWeight: 600 }}>{d.value}</span>
          <div style={{ width: "100%", background: colors.surfaceC, borderRadius: "4px 4px 0 0", overflow: "hidden", flex: 1 }}>
            <div style={{
              width: "100%", background: color, opacity: 0.8,
              height: `${Math.max((d.value / max) * 100, 4)}%`,
              borderRadius: "4px 4px 0 0",
              transition: "height 0.6s ease",
            }} />
          </div>
          <span style={{ fontSize: 10, color: colors.inkD, fontFamily: fonts.sans, textAlign: "center", whiteSpace: "nowrap" }}>{d.label}</span>
        </div>
      ))}
    </div>
  );
}

function DonutRing({ pct, color, label }: { pct: number; color: string; label: string }) {
  const r = 36, circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
      <svg width={90} height={90} viewBox="0 0 90 90">
        <circle cx={45} cy={45} r={r} fill="none" stroke={colors.surfaceC} strokeWidth={10} />
        <circle cx={45} cy={45} r={r} fill="none" stroke={color} strokeWidth={10}
          strokeDasharray={`${dash} ${circ - dash}`}
          strokeDashoffset={circ / 4} strokeLinecap="round"
          style={{ transition: "stroke-dasharray 0.7s ease" }}
        />
        <text x={45} y={45} textAnchor="middle" dominantBaseline="central"
          fill={color} fontSize={14} fontWeight={700} fontFamily="JetBrains Mono, monospace">
          {pct}%
        </text>
      </svg>
      <div style={{ fontSize: 12.5, color: colors.inkB, fontFamily: fonts.sans }}>{label}</div>
    </div>
  );
}

export default function AnalyticsPage() {
  const [stats, setStats]   = useState<any>(null);
  const [leads, setLeads]   = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([fetchStats(), fetchLeads()]).then(([s, l]) => {
      setStats(s); setLeads(l); setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  // Industry breakdown
  const industries: Record<string, number> = {};
  leads.forEach(l => { const i = l.industry ?? "Unknown"; industries[i] = (industries[i] ?? 0) + 1; });
  const industryData = Object.entries(industries).sort((a,b) => b[1]-a[1]).slice(0, 8)
    .map(([label, value]) => ({ label, value }));

  // Stage breakdown
  const states: Record<string, number> = {};
  leads.forEach(l => { if (l.conversation_state) states[l.conversation_state] = (states[l.conversation_state] ?? 0) + 1; });

  // Heat score distribution
  const hot  = leads.filter(l => (l.interest_score ?? 0) >= 0.7).length;
  const warm = leads.filter(l => (l.interest_score ?? 0) >= 0.4 && (l.interest_score ?? 0) < 0.7).length;
  const cold = leads.filter(l => (l.interest_score ?? 0) < 0.4 && (l.interest_score ?? 0) > 0).length;
  const untouched = leads.filter(l => !l.interest_score).length;

  const replyRate = stats?.total > 0 ? Math.round((stats.replied / stats.total) * 100) : 0;
  const bookRate  = stats?.replied > 0 ? Math.round((stats.booked / stats.replied) * 100) : 0;

  return (
    <Shell>
      <div style={{ padding: "28px 32px" }}>
        <SectionHeader title="Analytics" sub="Performance data across your outreach pipeline" />

        {loading ? <Loading /> : (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 20 }}>
              <StatCard label="Reply Rate"       value={`${replyRate}%`} color={replyRate > 20 ? colors.green : colors.amber} />
              <StatCard label="Book Rate"        value={`${bookRate}%`}  color={bookRate > 10 ? colors.green : colors.amber} />
              <StatCard label="Hot Leads"        value={hot}             color={colors.hot} />
              <StatCard label="Opted Out"        value={stats?.optedOut ?? 0} color={colors.inkD} />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
              {/* Industry chart */}
              <Card style={{ padding: "20px 22px" }}>
                <div style={{ fontSize: 10.5, fontWeight: 600, color: colors.inkD, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 18, fontFamily: fonts.mono }}>
                  Leads by Industry
                </div>
                {industryData.length > 0 ? <BarChart data={industryData} color={colors.accent} /> : (
                  <div style={{ color: colors.inkD, fontSize: 12, fontFamily: fonts.sans }}>No industry data yet.</div>
                )}
              </Card>

              {/* Conversion rings */}
              <Card style={{ padding: "20px 22px" }}>
                <div style={{ fontSize: 10.5, fontWeight: 600, color: colors.inkD, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 18, fontFamily: fonts.mono }}>
                  Conversion Metrics
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  <DonutRing pct={replyRate} color={colors.accent} label="Outreach → Reply rate" />
                  <DonutRing pct={bookRate}  color={colors.green}  label="Replied → Call booked" />
                </div>
              </Card>
            </div>

            {/* Stage + heat */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              {/* Conversation stages */}
              <Card style={{ padding: "20px 22px" }}>
                <div style={{ fontSize: 10.5, fontWeight: 600, color: colors.inkD, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 16, fontFamily: fonts.mono }}>
                  Conversation Stages
                </div>
                {Object.entries(states).length === 0 ? (
                  <div style={{ color: colors.inkD, fontSize: 12, fontFamily: fonts.sans }}>No stage data yet.</div>
                ) : Object.entries(states).map(([state, count]) => {
                  const cfg = STATE_CONFIG[state as ConversationState];
                  const pct = leads.length > 0 ? Math.round((count / leads.length) * 100) : 0;
                  return (
                    <div key={state} style={{ marginBottom: 12 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                        <span style={{ fontSize: 12, color: cfg?.color ?? colors.inkC, fontFamily: fonts.mono, fontWeight: 600 }}>
                          {cfg?.label ?? state}
                        </span>
                        <span style={{ fontSize: 12, color: colors.inkD, fontFamily: fonts.mono }}>{count} · {pct}%</span>
                      </div>
                      <div style={{ height: 4, background: colors.surfaceC, borderRadius: 2 }}>
                        <div style={{ width: `${pct}%`, height: "100%", background: cfg?.color ?? colors.inkC, borderRadius: 2, transition: "width 0.5s" }} />
                      </div>
                    </div>
                  );
                })}
              </Card>

              {/* Lead heat */}
              <Card style={{ padding: "20px 22px" }}>
                <div style={{ fontSize: 10.5, fontWeight: 600, color: colors.inkD, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 16, fontFamily: fonts.mono }}>
                  Lead Heat Distribution
                </div>
                {[
                  { label: "🔥 Hot (≥0.7)",       value: hot,       color: colors.hot },
                  { label: "◉ Warm (0.4–0.7)",    value: warm,      color: colors.warm },
                  { label: "○ Cold (<0.4)",        value: cold,      color: colors.cold },
                  { label: "— Untouched",          value: untouched, color: colors.inkD },
                ].map(h => {
                  const pct = leads.length > 0 ? Math.round((h.value / leads.length) * 100) : 0;
                  return (
                    <div key={h.label} style={{ marginBottom: 12 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                        <span style={{ fontSize: 12, color: h.color, fontFamily: fonts.sans }}>{h.label}</span>
                        <span style={{ fontSize: 12, color: colors.inkD, fontFamily: fonts.mono }}>{h.value} · {pct}%</span>
                      </div>
                      <div style={{ height: 4, background: colors.surfaceC, borderRadius: 2 }}>
                        <div style={{ width: `${pct}%`, height: "100%", background: h.color, borderRadius: 2, transition: "width 0.5s" }} />
                      </div>
                    </div>
                  );
                })}
              </Card>
            </div>
          </>
        )}
      </div>
    </Shell>
  );
}

"use client";
import { useEffect, useState } from "react";
import { Shell } from "@/components/layout/Shell";
import { Card, StatCard, Loading, SectionHeader } from "@/components/ui";
import { colors, fonts, radius } from "@/lib/tokens";
import { fetchStats, fetchLeads } from "@/lib/api";
import { STATE_CONFIG } from "@/lib/constants";
import type { Lead, ConversationState } from "@/types";

function MiniBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
        <span style={{ fontSize: 12, color: colors.inkB, fontFamily: fonts.sans, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1, marginRight: 8 }}>{label}</span>
        <span style={{ fontSize: 11, color: colors.inkD, fontFamily: fonts.mono, flexShrink: 0 }}>{value}</span>
      </div>
      <div style={{ height: 4, background: colors.surfaceC, borderRadius: 99 }}>
        <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: 99, transition: "width 0.5s" }} />
      </div>
    </div>
  );
}

function DonutRing({ pct, color, label }: { pct: number; color: string; label: string }) {
  const r = 32, circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
      <svg width={76} height={76} viewBox="0 0 76 76" style={{ flexShrink: 0 }}>
        <circle cx={38} cy={38} r={r} fill="none" stroke={colors.surfaceC} strokeWidth={8} />
        <circle cx={38} cy={38} r={r} fill="none" stroke={color} strokeWidth={8}
          strokeDasharray={`${dash} ${circ - dash}`}
          strokeDashoffset={circ / 4} strokeLinecap="round"
          style={{ transition: "stroke-dasharray 0.7s ease" }} />
        <text x={38} y={38} textAnchor="middle" dominantBaseline="central"
          fill={color} fontSize={13} fontWeight={700} fontFamily="DM Mono, monospace">{pct}%</text>
      </svg>
      <div style={{ fontSize: 12.5, color: colors.inkB, fontFamily: fonts.sans, lineHeight: 1.5 }}>{label}</div>
    </div>
  );
}

export default function AnalyticsPage() {
  const [stats, setStats]     = useState<any>(null);
  const [leads, setLeads]     = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([fetchStats(), fetchLeads()]).then(([s, l]) => { setStats(s); setLeads(l); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  const industries: Record<string, number> = {};
  leads.forEach(l => { const i = l.industry ?? "Unknown"; industries[i] = (industries[i] ?? 0) + 1; });
  const industryData = Object.entries(industries).sort((a,b) => b[1]-a[1]).slice(0, 6).map(([label, value]) => ({ label, value }));
  const maxInd = Math.max(...industryData.map(d => d.value), 1);

  const states: Record<string, number> = {};
  leads.forEach(l => { if (l.conversation_state) states[l.conversation_state] = (states[l.conversation_state] ?? 0) + 1; });

  const hot      = leads.filter(l => (l.interest_score ?? 0) >= 0.7).length;
  const warm     = leads.filter(l => (l.interest_score ?? 0) >= 0.4 && (l.interest_score ?? 0) < 0.7).length;
  const cold     = leads.filter(l => (l.interest_score ?? 0) < 0.4 && (l.interest_score ?? 0) > 0).length;
  const untouched = leads.filter(l => !l.interest_score).length;
  const maxHeat  = Math.max(hot, warm, cold, untouched, 1);

  const replyRate = stats?.total > 0 ? Math.round((stats.replied / stats.total) * 100) : 0;
  const bookRate  = stats?.replied > 0 ? Math.round((stats.booked / stats.replied) * 100) : 0;

  return (
    <Shell>
      <div style={{ padding: "20px 16px", maxWidth: 900, margin: "0 auto" }}>
        <SectionHeader title="Analytics" sub="Outreach performance data" />
        {loading ? <Loading /> : (
          <>
            {/* Stats — 2 col on all screens */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
              <StatCard label="Reply Rate"  value={`${replyRate}%`} color={replyRate > 20 ? colors.green : colors.amber} />
              <StatCard label="Book Rate"   value={`${bookRate}%`}  color={bookRate > 10 ? colors.green : colors.amber} />
              <StatCard label="Hot Leads"   value={hot}             color={colors.hot} />
              <StatCard label="Opted Out"   value={stats?.optedOut ?? 0} />
            </div>

            {/* Conversion rings — stacked, full width */}
            <Card style={{ padding: "18px 20px", marginBottom: 12 }}>
              <div style={{ fontSize: 10, fontWeight: 500, color: colors.inkD, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 16, fontFamily: fonts.mono }}>Conversion</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <DonutRing pct={replyRate} color={colors.ink}   label="Outreach → Reply" />
                <DonutRing pct={bookRate}  color={colors.green} label="Replied → Booked" />
              </div>
            </Card>

            {/* Industry breakdown */}
            {industryData.length > 0 && (
              <Card style={{ padding: "18px 20px", marginBottom: 12 }}>
                <div style={{ fontSize: 10, fontWeight: 500, color: colors.inkD, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 14, fontFamily: fonts.mono }}>By Industry</div>
                {industryData.map(d => <MiniBar key={d.label} label={d.label} value={d.value} max={maxInd} color={colors.ink} />)}
              </Card>
            )}

            {/* Heat distribution */}
            <Card style={{ padding: "18px 20px", marginBottom: 12 }}>
              <div style={{ fontSize: 10, fontWeight: 500, color: colors.inkD, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 14, fontFamily: fonts.mono }}>Lead Heat</div>
              {[
                { label: "Hot ≥0.7",   value: hot,       color: colors.hot },
                { label: "Warm 0.4–0.7", value: warm,    color: colors.warm },
                { label: "Cold <0.4",  value: cold,      color: colors.cold },
                { label: "Untouched",  value: untouched, color: colors.inkD },
              ].map(h => <MiniBar key={h.label} label={h.label} value={h.value} max={maxHeat} color={h.color} />)}
            </Card>

            {/* Conversation stages */}
            {Object.keys(states).length > 0 && (
              <Card style={{ padding: "18px 20px" }}>
                <div style={{ fontSize: 10, fontWeight: 500, color: colors.inkD, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 14, fontFamily: fonts.mono }}>Stages</div>
                {Object.entries(states).map(([state, count]) => {
                  const cfg = STATE_CONFIG[state as ConversationState];
                  return <MiniBar key={state} label={cfg?.label ?? state} value={count} max={leads.length} color={cfg?.color ?? colors.inkC} />;
                })}
              </Card>
            )}
          </>
        )}
      </div>
    </Shell>
  );
}

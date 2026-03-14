"use client";
import { useEffect, useState } from "react";
import { Shell } from "@/components/layout/Shell";
import { StatCard, Card, Loading, Empty } from "@/components/ui";
import { StatusBadge, HeatBadge } from "@/components/ui";
import { colors, fonts, shadows } from "@/lib/tokens";
import { fetchStats, fetchLeads } from "@/lib/api";
import { timeAgo } from "@/lib/constants";
import type { Lead } from "@/types";

function FunnelBar({ stages }: { stages: { label: string; value: number; color: string }[] }) {
  const max = Math.max(...stages.map(s => s.value), 1);
  return (
    <Card style={{ padding: "20px 22px" }}>
      <div style={{ fontSize: 10.5, fontWeight: 600, color: colors.inkD, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 18, fontFamily: fonts.mono }}>
        Pipeline Funnel
      </div>
      <div style={{ display: "flex", gap: 12, alignItems: "flex-end", height: 90 }}>
        {stages.map(s => (
          <div key={s.label} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: s.color, fontFamily: fonts.mono }}>{s.value}</span>
            <div style={{ width: "100%", background: colors.surfaceC, borderRadius: 4, overflow: "hidden", height: 48 }}>
              <div style={{
                width: "100%", borderRadius: 4,
                background: s.color, opacity: 0.85,
                height: `${Math.max((s.value / max) * 100, 4)}%`,
                marginTop: `${100 - Math.max((s.value / max) * 100, 4)}%`,
                transition: "height 0.5s",
              }} />
            </div>
            <span style={{ fontSize: 10, color: colors.inkD, fontFamily: fonts.sans, textAlign: "center" }}>{s.label}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}

function ActivityRow({ lead }: { lead: Lead }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 12,
      padding: "10px 0", borderBottom: `1px solid ${colors.border}`,
    }}>
      <div style={{
        width: 34, height: 34, borderRadius: 9, background: colors.surfaceC,
        border: `1px solid ${colors.border}`, display: "flex",
        alignItems: "center", justifyContent: "center",
        fontSize: 14, color: colors.accent, fontFamily: fonts.mono, flexShrink: 0,
      }}>
        {lead.name.charAt(0).toUpperCase()}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: colors.ink, fontFamily: fonts.sans, marginBottom: 2 }}>{lead.name}</div>
        <div style={{ fontSize: 11.5, color: colors.inkC, fontFamily: fonts.sans }}>{lead.business_name ?? lead.industry ?? "—"}</div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
        <StatusBadge status={lead.status} />
        <span style={{ fontSize: 11, color: colors.inkD, fontFamily: fonts.mono }}>{timeAgo(lead.created_at)}</span>
      </div>
    </div>
  );
}

export default function OverviewPage() {
  const [stats, setStats] = useState<any>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([fetchStats(), fetchLeads()]).then(([s, l]) => {
      setStats(s); setLeads(l.slice(0, 10)); setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const replyRate = stats?.total > 0 ? Math.round((stats.replied / stats.total) * 100) : 0;
  const convRate  = stats?.replied > 0 ? Math.round((stats.booked / stats.replied) * 100) : 0;

  const funnelStages = [
    { label: "Pending",    value: stats?.pending ?? 0,    color: colors.inkC },
    { label: "Outreached", value: stats?.outreached ?? 0, color: colors.blue },
    { label: "Replied",    value: stats?.replied ?? 0,    color: colors.accent },
    { label: "Hot Leads",  value: stats?.hotLeads ?? 0,   color: colors.warm },
    { label: "Booked",     value: stats?.booked ?? 0,     color: colors.green },
  ];

  return (
    <Shell>
      <div style={{ padding: "28px 32px" }}>
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: colors.ink, fontFamily: fonts.sans, letterSpacing: "-0.02em", marginBottom: 3 }}>
            Command Center
          </h1>
          <p style={{ fontSize: 13, color: colors.inkC, fontFamily: fonts.sans }}>
            Live overview of your AI outreach engine.
          </p>
        </div>

        {/* KPI Row */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 12, marginBottom: 20 }}>
          <StatCard label="Total Leads"  value={loading ? "—" : stats?.total ?? 0} />
          <StatCard label="Outreached"   value={loading ? "—" : stats?.outreached ?? 0} />
          <StatCard label="Replied"      value={loading ? "—" : stats?.replied ?? 0} sub={`${replyRate}% rate`} />
          <StatCard label="Hot Leads"    value={loading ? "—" : stats?.hotLeads ?? 0} color={colors.warm} />
          <StatCard label="Calls Booked" value={loading ? "—" : stats?.booked ?? 0} accent color={colors.accent} />
          <StatCard label="Conversion"   value={loading ? "—" : `${convRate}%`} color={colors.green} />
        </div>

        {/* Funnel + Activity */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1.6fr", gap: 16 }}>
          <FunnelBar stages={funnelStages} />

          <Card style={{ padding: "20px 22px" }}>
            <div style={{ fontSize: 10.5, fontWeight: 600, color: colors.inkD, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 14, fontFamily: fonts.mono }}>
              Recent Activity
            </div>
            {loading ? <Loading /> : leads.length === 0 ? <Empty label="No leads yet." /> : (
              leads.map(l => <ActivityRow key={l.id} lead={l} />)
            )}
          </Card>
        </div>
      </div>
    </Shell>
  );
}

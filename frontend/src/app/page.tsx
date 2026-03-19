"use client";
import { useEffect, useState } from "react";
import { Shell } from "@/components/layout/Shell";
import { StatCard, Card, Loading, Empty, StatusBadge } from "@/components/ui";
import { colors, fonts, radius } from "@/lib/tokens";
import { fetchStats, fetchLeads } from "@/lib/api";
import { timeAgo, heatColor } from "@/lib/constants";
import type { Lead } from "@/types";

export default function OverviewPage() {
  const [stats,   setStats]   = useState<any>(null);
  const [leads,   setLeads]   = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([fetchStats(), fetchLeads()])
      .then(([s, l]) => { setStats(s); setLeads(l.slice(0, 8)); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const replyRate = stats?.total > 0 ? Math.round((stats.replied / stats.total) * 100) : 0;
  const convRate  = stats?.replied > 0 ? Math.round((stats.booked / stats.replied) * 100) : 0;

  const funnel = [
    { label: "Pending",    value: stats?.pending    ?? 0, color: colors.inkD },
    { label: "Outreached", value: stats?.outreached ?? 0, color: colors.blue },
    { label: "Replied",    value: stats?.replied    ?? 0, color: colors.ink },
    { label: "Hot",        value: stats?.hotLeads   ?? 0, color: colors.warm },
    { label: "Booked",     value: stats?.booked     ?? 0, color: colors.green },
  ];
  const maxFunnel = Math.max(...funnel.map(f => f.value), 1);

  return (
    <Shell>
      <div style={{ padding: "24px 20px", maxWidth: 1100, margin: "0 auto" }}>

        {/* Page title */}
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: colors.ink, fontFamily: fonts.sans, letterSpacing: "-0.02em", marginBottom: 3 }}>
            Overview
          </h1>
          <p style={{ fontSize: 12.5, color: colors.inkC }}>
            {new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
          </p>
        </div>

        {/* Stats — 2 col mobile, 3 col md, 6 col lg */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10, marginBottom: 16 }}>
          <StatCard label="Leads"      value={loading ? "—" : stats?.total ?? 0}       />
          <StatCard label="Outreached" value={loading ? "—" : stats?.outreached ?? 0}  />
          <StatCard label="Replied"    value={loading ? "—" : stats?.replied ?? 0}     sub={`${replyRate}% rate`} />
          <StatCard label="Hot Leads"  value={loading ? "—" : stats?.hotLeads ?? 0}    color={colors.warm} />
          <StatCard label="Booked"     value={loading ? "—" : stats?.booked ?? 0}      color={colors.green} highlight />
          <StatCard label="Conversion" value={loading ? "—" : `${convRate}%`}          color={colors.green} />
        </div>

        {/* Pipeline + activity */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 12 }}>

          {/* Funnel */}
          <Card style={{ padding: "18px 20px" }}>
            <div style={{ fontSize: 10.5, fontWeight: 500, color: colors.inkD, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 16, fontFamily: fonts.mono }}>
              Pipeline
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "stretch" }}>
              {funnel.map((f, i) => (
                <div key={f.label} style={{ flex: 1 }}>
                  <div style={{
                    height: 3, borderRadius: 99, marginBottom: 10,
                    background: `linear-gradient(90deg, ${f.color}${loading ? "20" : "90"}, ${f.color}${loading ? "10" : "50"})`,
                    transition: "all 0.5s",
                  }} />
                  <div style={{ fontSize: 20, fontWeight: 700, color: f.color, fontFamily: fonts.sans, letterSpacing: "-0.02em" }}>
                    {loading ? "—" : f.value}
                  </div>
                  <div style={{ fontSize: 10.5, color: colors.inkD, fontFamily: fonts.sans, marginTop: 3 }}>{f.label}</div>
                </div>
              ))}
            </div>
          </Card>

          {/* Activity */}
          <Card style={{ padding: "18px 20px" }}>
            <div style={{ fontSize: 10.5, fontWeight: 500, color: colors.inkD, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 14, fontFamily: fonts.mono }}>
              Recent Leads
            </div>
            {loading ? <Loading /> : leads.length === 0 ? <Empty label="No leads yet." /> : (
              <div>
                {leads.map((lead, i) => (
                  <div key={lead.id} style={{
                    display: "flex", alignItems: "center", gap: 12,
                    padding: "9px 0",
                    borderBottom: i < leads.length - 1 ? `1px solid ${colors.border}` : "none",
                  }}>
                    <div style={{
                      width: 30, height: 30, borderRadius: radius.md, flexShrink: 0,
                      background: colors.surfaceC, border: `1px solid ${colors.border}`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 12, fontWeight: 600, color: colors.inkB, fontFamily: fonts.sans,
                    }}>
                      {lead.name.charAt(0).toUpperCase()}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, color: colors.ink, fontFamily: fonts.sans, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {lead.name}
                      </div>
                      <div style={{ fontSize: 11.5, color: colors.inkC, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {lead.business_name ?? lead.industry ?? "—"}
                      </div>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 3, flexShrink: 0 }}>
                      <StatusBadge status={lead.status} />
                      <span style={{ fontSize: 10.5, color: colors.inkD, fontFamily: fonts.mono }}>{timeAgo(lead.created_at)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>

      <style>{`
        @media (min-width: 640px) {
          .stats-grid { grid-template-columns: repeat(3, 1fr) !important; }
        }
        @media (min-width: 1024px) {
          .stats-grid { grid-template-columns: repeat(6, 1fr) !important; }
          .bottom-grid { grid-template-columns: 1fr 1.5fr !important; }
        }
      `}</style>
    </Shell>
  );
}

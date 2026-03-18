"use client";
import { useEffect, useState } from "react";
import { Shell } from "@/components/layout/Shell";
import { Card, StatCard, Btn, Loading, Empty, SectionHeader } from "@/components/ui";
import { colors, fonts, radius } from "@/lib/tokens";
import { fetchLeads } from "@/lib/api";
import { formatPhone, timeAgo } from "@/lib/constants";
import type { Lead } from "@/types";

export default function CallsPage() {
  const [leads, setLeads]     = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLeads().then(l => { setLeads(l.filter(x => x.status === "BOOKED" || x.conversation_state === "BOOKED")); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  const upcoming = leads.filter(l => l.next_follow_up_at && new Date(l.next_follow_up_at) > new Date());

  return (
    <Shell>
      <div style={{ padding: "20px 16px", maxWidth: 700, margin: "0 auto" }}>
        <SectionHeader title="Calls" sub="Leads who agreed to a call" />

        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10, marginBottom: 20 }}>
          <StatCard label="Total Booked" value={leads.length} highlight color={colors.green} />
          <StatCard label="Upcoming"     value={upcoming.length} color={colors.green} />
        </div>

        {loading ? <Loading /> : leads.length === 0 ? (
          <Card style={{ padding: "48px 0" }}><Empty label="No calls booked yet." /></Card>
        ) : leads.map(lead => {
          const isUpcoming = lead.next_follow_up_at && new Date(lead.next_follow_up_at) > new Date();
          return (
            <Card key={lead.id} style={{ padding: "16px 18px", marginBottom: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12, gap: 10 }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: colors.ink, marginBottom: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{lead.name}</div>
                  <div style={{ fontSize: 12, color: colors.inkC }}>{lead.business_name ?? lead.industry ?? "—"}</div>
                  <div style={{ fontSize: 11.5, color: colors.inkD, fontFamily: fonts.mono, marginTop: 2 }}>{formatPhone(lead.phone_number, true)}</div>
                </div>
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <div style={{ fontSize: 11, color: isUpcoming ? colors.green : colors.amber, fontFamily: fonts.mono, marginBottom: 6 }}>
                    {lead.next_follow_up_at
                      ? isUpcoming ? `⬡ ${new Date(lead.next_follow_up_at).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}` : "⚠ Overdue"
                      : "⚠ Time not set"}
                  </div>
                  <a href={`https://wa.me/${lead.phone_number}`} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none" }}>
                    <Btn small variant="success">↗ WhatsApp</Btn>
                  </a>
                </div>
              </div>

              {lead.pain_point && (
                <div style={{ marginTop: 10, padding: "9px 12px", background: colors.amberBg, border: `1px solid ${colors.amber}18`, borderRadius: radius.md, fontSize: 12, color: colors.inkB, lineHeight: 1.5 }}>
                  <div style={{ fontSize: 10, color: colors.amber, fontFamily: fonts.mono, marginBottom: 4 }}>PAIN POINT</div>
                  {lead.pain_point}
                </div>
              )}

              {lead.suggested_solutions?.slice(0, 1).map((s, i) => (
                <div key={i} style={{ marginTop: 8, padding: "9px 12px", background: colors.surfaceB, border: `1px solid ${colors.border}`, borderRadius: radius.md, fontSize: 12, color: colors.inkB, lineHeight: 1.5 }}>
                  <div style={{ fontSize: 10, color: colors.inkD, fontFamily: fonts.mono, marginBottom: 4 }}>PITCH</div>
                  {s}
                </div>
              ))}

              {lead.objections?.length ? (
                <div style={{ marginTop: 8, padding: "8px 12px", background: colors.redBg, border: `1px solid ${colors.red}15`, borderRadius: radius.md, fontSize: 12, color: colors.inkC }}>
                  <span style={{ color: colors.red, fontFamily: fonts.mono, fontSize: 10 }}>WATCH OUT · </span>
                  {lead.objections[0].slice(0, 80)}
                </div>
              ) : null}
            </Card>
          );
        })}
      </div>
    </Shell>
  );
}

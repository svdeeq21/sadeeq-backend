"use client";
import { useEffect, useState } from "react";
import { Shell } from "@/components/layout/Shell";
import { Card, StatCard, Btn, Loading, Empty, SectionHeader } from "@/components/ui";
import { colors, fonts } from "@/lib/tokens";
import { fetchLeads } from "@/lib/api";
import { formatPhone, timeAgo } from "@/lib/constants";
import type { Lead } from "@/types";

function CallCard({ lead }: { lead: Lead }) {
  const isUpcoming = lead.next_follow_up_at && new Date(lead.next_follow_up_at) > new Date();

  return (
    <Card style={{ padding: "20px 22px" }}>
      {/* Top: name + actions */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 13 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 12, background: colors.accentBg,
            border: `1px solid ${colors.accent}30`, display: "flex",
            alignItems: "center", justifyContent: "center",
            fontSize: 18, color: colors.accent, fontFamily: fonts.mono, flexShrink: 0,
          }}>
            {lead.name.charAt(0)}
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 600, color: colors.ink, fontFamily: fonts.sans, marginBottom: 3 }}>
              {lead.name}
            </div>
            <div style={{ display: "flex", gap: 12, fontSize: 12, color: colors.inkC, fontFamily: fonts.sans, flexWrap: "wrap" }}>
              {lead.business_name && <span>{lead.business_name}</span>}
              {lead.industry && <span style={{ color: colors.inkD }}>· {lead.industry}</span>}
              <span style={{ fontFamily: fonts.mono, color: colors.inkD }}>{formatPhone(lead.phone_number, true)}</span>
            </div>
          </div>
        </div>
        <div style={{ textAlign: "right", flexShrink: 0, marginLeft: 16 }}>
          <div style={{
            fontSize: 11, fontWeight: 600, marginBottom: 8,
            color: isUpcoming ? colors.green : colors.amber,
            fontFamily: fonts.mono,
          }}>
            {lead.next_follow_up_at
              ? isUpcoming
                ? `⬡ ${new Date(lead.next_follow_up_at).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}`
                : "⚠ Follow-up overdue"
              : "⚠ Time not set"}
          </div>
          <div style={{ display: "flex", gap: 7, justifyContent: "flex-end" }}>
            <a href={`https://wa.me/${lead.phone_number}`} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none" }}>
              <Btn small variant="success">↗ WhatsApp</Btn>
            </a>
            <Btn small variant="ghost">Set Time</Btn>
          </div>
        </div>
      </div>

      {/* Pre-call briefing */}
      {(lead.pain_point || (lead.suggested_solutions && lead.suggested_solutions.length > 0)) && (
        <div style={{
          borderTop: `1px solid ${colors.border}`,
          paddingTop: 14, marginTop: 4,
          display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12,
        }}>
          {lead.pain_point && (
            <div>
              <div style={{ fontSize: 10, fontWeight: 600, color: colors.amber, textTransform: "uppercase", letterSpacing: "0.07em", fontFamily: fonts.mono, marginBottom: 6 }}>
                ⚡ Pain Point
              </div>
              <div style={{
                background: colors.amberBg, border: `1px solid ${colors.amber}18`,
                borderRadius: 7, padding: "9px 11px",
                fontSize: 12, color: colors.inkB, fontFamily: fonts.sans, lineHeight: 1.55,
              }}>
                {lead.pain_point}
              </div>
            </div>
          )}
          {lead.suggested_solutions && lead.suggested_solutions.length > 0 && (
            <div>
              <div style={{ fontSize: 10, fontWeight: 600, color: colors.accent, textTransform: "uppercase", letterSpacing: "0.07em", fontFamily: fonts.mono, marginBottom: 6 }}>
                ◈ What to Pitch
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                {lead.suggested_solutions.slice(0, 2).map((sol, i) => (
                  <div key={i} style={{
                    background: colors.accentBg, border: `1px solid ${colors.accent}12`,
                    borderRadius: 7, padding: "8px 10px",
                    fontSize: 11.5, color: colors.inkB, fontFamily: fonts.sans, lineHeight: 1.5,
                    display: "flex", gap: 7,
                  }}>
                    <span style={{ color: colors.accent, fontFamily: fonts.mono, fontSize: 10.5, flexShrink: 0 }}>{i + 1}.</span>
                    {sol}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Objections */}
      {lead.objections && lead.objections.length > 0 && (
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${colors.border}` }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: colors.red, textTransform: "uppercase", letterSpacing: "0.07em", fontFamily: fonts.mono, marginBottom: 6 }}>
            ⊘ Watch Out — Objections Raised
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {lead.objections.map((obj, i) => (
              <span key={i} style={{
                background: colors.redBg, border: `1px solid ${colors.red}15`,
                borderRadius: 6, padding: "4px 9px",
                fontSize: 11.5, color: colors.inkC, fontFamily: fonts.sans,
              }}>"{obj.slice(0, 60)}"</span>
            ))}
          </div>
        </div>
      )}

      {lead.location && (
        <div style={{ marginTop: 12, fontSize: 11.5, color: colors.inkD, fontFamily: fonts.sans }}>
          📍 {lead.location} · Added {timeAgo(lead.created_at)}
        </div>
      )}
    </Card>
  );
}

export default function CallsPage() {
  const [leads, setLeads]     = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLeads().then(l => {
      setLeads(l.filter(x => x.status === "BOOKED" || x.conversation_state === "BOOKED"));
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const upcoming = leads.filter(l => l.next_follow_up_at && new Date(l.next_follow_up_at) > new Date());
  const overdue  = leads.filter(l => !l.next_follow_up_at || new Date(l.next_follow_up_at) <= new Date());
  const withIntel = leads.filter(l => l.pain_point || l.suggested_solutions?.length);

  return (
    <Shell>
      <div style={{ padding: "28px 32px" }}>
        <SectionHeader title="Calls" sub="Booked leads with pre-call briefing" />

        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 24 }}>
          <StatCard label="Total Booked"    value={leads.length}       accent color={colors.accent} />
          <StatCard label="Upcoming"        value={upcoming.length}    color={colors.green} />
          <StatCard label="Needs Follow-Up" value={overdue.length}     color={colors.amber} />
          <StatCard label="Intel Ready"     value={withIntel.length}   color={colors.blue} sub="have AI briefing" />
        </div>

        {loading ? <Loading /> : leads.length === 0 ? (
          <Card style={{ padding: "60px 0" }}>
            <Empty label="No calls booked yet. Keep outreaching!" />
          </Card>
        ) : (
          <div style={{ display: "grid", gap: 14 }}>
            {leads.map(lead => <CallCard key={lead.id} lead={lead} />)}
          </div>
        )}
      </div>
    </Shell>
  );
}

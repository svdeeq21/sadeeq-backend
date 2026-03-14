"use client";
import { useEffect, useState } from "react";
import { Shell } from "@/components/layout/Shell";
import { Card, StatCard, Btn, Loading, Empty, SectionHeader } from "@/components/ui";
import { colors, fonts } from "@/lib/tokens";
import { fetchLeads } from "@/lib/api";
import { formatPhone, timeAgo } from "@/lib/constants";
import type { Lead } from "@/types";

export default function CallsPage() {
  const [leads, setLeads]   = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLeads().then(l => {
      setLeads(l.filter(x => x.status === "BOOKED" || x.conversation_state === "BOOKED"));
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const upcoming = leads.filter(l => l.next_follow_up_at && new Date(l.next_follow_up_at) > new Date());
  const recent   = leads.filter(l => !l.next_follow_up_at || new Date(l.next_follow_up_at) <= new Date());

  return (
    <Shell>
      <div style={{ padding: "28px 32px" }}>
        <SectionHeader title="Calls" sub="Leads who have agreed to a call with Sadiq" />

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 24 }}>
          <StatCard label="Total Booked"  value={leads.length}    accent color={colors.accent} />
          <StatCard label="Upcoming"      value={upcoming.length} color={colors.green} />
          <StatCard label="Needs Follow-Up" value={recent.length} color={colors.amber} />
        </div>

        {loading ? <Loading /> : leads.length === 0 ? (
          <Card style={{ padding: "60px 0" }}>
            <Empty label="No calls booked yet. Keep outreaching!" />
          </Card>
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            {leads.map(lead => (
              <Card key={lead.id} style={{ padding: "18px 22px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                    <div style={{
                      width: 44, height: 44, borderRadius: 12, background: colors.accentBg,
                      border: `1px solid ${colors.accent}30`, display: "flex",
                      alignItems: "center", justifyContent: "center",
                      fontSize: 18, color: colors.accent, fontFamily: fonts.mono,
                    }}>
                      {lead.name.charAt(0)}
                    </div>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 600, color: colors.ink, fontFamily: fonts.sans, marginBottom: 3 }}>
                        {lead.name}
                      </div>
                      <div style={{ display: "flex", gap: 12, fontSize: 12, color: colors.inkC, fontFamily: fonts.sans }}>
                        <span>{lead.business_name ?? lead.industry ?? "—"}</span>
                        <span style={{ fontFamily: fonts.mono }}>{formatPhone(lead.phone_number, true)}</span>
                      </div>
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{
                      fontSize: 11, fontWeight: 600,
                      color: lead.next_follow_up_at && new Date(lead.next_follow_up_at) > new Date() ? colors.green : colors.amber,
                      fontFamily: fonts.mono, marginBottom: 6,
                    }}>
                      {lead.next_follow_up_at
                        ? new Date(lead.next_follow_up_at) > new Date()
                          ? `⬡ Scheduled ${new Date(lead.next_follow_up_at).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}`
                          : `⚠ Follow-up overdue`
                        : "⚠ Time not set"}
                    </div>
                    <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                      <a href={`https://wa.me/${lead.phone_number}`} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none" }}>
                        <Btn small variant="success">↗ WhatsApp</Btn>
                      </a>
                      <Btn small variant="ghost">Set Time</Btn>
                    </div>
                  </div>
                </div>
                {lead.location && (
                  <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${colors.border}`, fontSize: 12, color: colors.inkD, fontFamily: fonts.sans }}>
                    📍 {lead.location} · Added {timeAgo(lead.created_at)}
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>
    </Shell>
  );
}

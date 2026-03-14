"use client";
import { useEffect, useState } from "react";
import { Shell } from "@/components/layout/Shell";
import { Card, StatCard, Btn, Loading, Empty, SectionHeader } from "@/components/ui";
import { colors, fonts } from "@/lib/tokens";
import { fetchLeads } from "@/lib/api";
import { formatPhone, timeAgo } from "@/lib/constants";
import type { Lead } from "@/types";

export default function SafetyPage() {
  const [optedOut, setOptedOut]   = useState<Lead[]>([]);
  const [invalid, setInvalid]     = useState<Lead[]>([]);
  const [loading, setLoading]     = useState(true);

  useEffect(() => {
    fetchLeads().then(l => {
      setOptedOut(l.filter(x => x.status === "OPTED_OUT"));
      setInvalid(l.filter(x => x.status === "INVALID_NUMBER"));
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  return (
    <Shell>
      <div style={{ padding: "28px 32px" }}>
        <SectionHeader
          title="Safety & Compliance"
          sub="Suppression list and rate-limit controls"
        />

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 24 }}>
          <StatCard label="Opted Out"       value={optedOut.length} color={colors.red} />
          <StatCard label="Invalid Numbers" value={invalid.length}  color={colors.inkD} />
          <StatCard label="Protected"       value={optedOut.length + invalid.length} sub="will never be messaged again" />
        </div>

        {/* Rate limit info */}
        <Card style={{ padding: "20px 22px", marginBottom: 20, borderColor: `${colors.amber}25` }}>
          <div style={{ fontSize: 10.5, fontWeight: 600, color: colors.amber, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 14, fontFamily: fonts.mono }}>
            ⚠ Rate Limit Controls
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
            {[
              { label: "Daily Message Cap",   value: "20 / day",  note: "per WhatsApp account" },
              { label: "Rate Window",         value: "1 / min",   note: "max per lead" },
              { label: "Safe Hours",          value: "8am – 9pm", note: "WAT only" },
            ].map(s => (
              <div key={s.label}>
                <div style={{ fontSize: 11, color: colors.inkD, fontFamily: fonts.mono, marginBottom: 4 }}>{s.label}</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: colors.ink, fontFamily: fonts.mono }}>{s.value}</div>
                <div style={{ fontSize: 11, color: colors.inkD, fontFamily: fonts.sans, marginTop: 2 }}>{s.note}</div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 14, fontSize: 12, color: colors.inkC, fontFamily: fonts.sans, lineHeight: 1.6 }}>
            These limits are enforced in the backend scheduler. To change them, update your environment variables on Render
            and redeploy. The bot will never message opted-out or invalid numbers regardless of these limits.
          </div>
        </Card>

        {/* Opted out list */}
        <Card style={{ padding: "20px 22px", marginBottom: 16 }}>
          <div style={{ fontSize: 10.5, fontWeight: 600, color: colors.inkD, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 16, fontFamily: fonts.mono }}>
            Suppression List — Opted Out ({optedOut.length})
          </div>
          {loading ? <Loading /> : optedOut.length === 0 ? (
            <Empty label="No opted-out leads. Great!" />
          ) : (
            <div>
              {/* Header */}
              <div style={{
                display: "grid", gridTemplateColumns: "1fr 160px 140px 120px",
                padding: "8px 0", borderBottom: `1px solid ${colors.border}`,
                fontSize: 10.5, fontWeight: 600, color: colors.inkD, fontFamily: fonts.mono,
                textTransform: "uppercase", letterSpacing: "0.07em",
              }}>
                <span>Name / Business</span>
                <span>Phone</span>
                <span>Opted Out</span>
                <span>Follow-ups</span>
              </div>
              {optedOut.map(lead => (
                <div key={lead.id} style={{
                  display: "grid", gridTemplateColumns: "1fr 160px 140px 120px",
                  padding: "12px 0", borderBottom: `1px solid ${colors.border}`,
                  alignItems: "center",
                }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500, color: colors.ink, fontFamily: fonts.sans }}>{lead.name}</div>
                    <div style={{ fontSize: 11.5, color: colors.inkD, fontFamily: fonts.sans }}>{lead.business_name ?? "—"}</div>
                  </div>
                  <div style={{ fontSize: 12, color: colors.inkD, fontFamily: fonts.mono }}>
                    {formatPhone(lead.phone_number)}
                  </div>
                  <div style={{ fontSize: 12, color: colors.inkD, fontFamily: fonts.mono }}>
                    {timeAgo(lead.last_outreach_at ?? lead.created_at)}
                  </div>
                  <div style={{ fontSize: 12, fontFamily: fonts.mono, color: colors.inkC }}>
                    {lead.follow_up_count ?? 0}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Invalid numbers */}
        <Card style={{ padding: "20px 22px" }}>
          <div style={{ fontSize: 10.5, fontWeight: 600, color: colors.inkD, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 16, fontFamily: fonts.mono }}>
            Invalid Numbers ({invalid.length})
          </div>
          {loading ? <Loading /> : invalid.length === 0 ? (
            <Empty label="No invalid numbers recorded." />
          ) : invalid.map(lead => (
            <div key={lead.id} style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              padding: "10px 0", borderBottom: `1px solid ${colors.border}`,
            }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 500, color: colors.ink, fontFamily: fonts.sans }}>{lead.name}</div>
                <div style={{ fontSize: 12, color: colors.inkD, fontFamily: fonts.mono }}>{formatPhone(lead.phone_number)}</div>
              </div>
              <span style={{ fontSize: 11, color: colors.red, fontFamily: fonts.mono, background: colors.redBg, padding: "3px 8px", borderRadius: 5 }}>
                BLOCKED
              </span>
            </div>
          ))}
        </Card>
      </div>
    </Shell>
  );
}

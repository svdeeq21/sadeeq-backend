"use client";
import { useEffect, useState } from "react";
import { Shell } from "@/components/layout/Shell";
import { Card, StatCard, Loading, Empty, SectionHeader } from "@/components/ui";
import { colors, fonts, radius } from "@/lib/tokens";
import { fetchLeads } from "@/lib/api";
import { formatPhone, timeAgo } from "@/lib/constants";
import type { Lead } from "@/types";

export default function SafetyPage() {
  const [optedOut, setOptedOut] = useState<Lead[]>([]);
  const [invalid,  setInvalid]  = useState<Lead[]>([]);
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    fetchLeads().then(l => {
      setOptedOut(l.filter(x => x.status === "OPTED_OUT"));
      setInvalid(l.filter(x => x.status === "INVALID_NUMBER"));
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  return (
    <Shell>
      <div style={{ padding: "20px 16px", maxWidth: 700, margin: "0 auto" }}>
        <SectionHeader title="Safety" sub="Suppression list and compliance controls" />

        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10, marginBottom: 20 }}>
          <StatCard label="Opted Out"       value={optedOut.length} color={colors.red} />
          <StatCard label="Invalid Numbers" value={invalid.length}  />
        </div>

        {/* Rate limit info */}
        <Card style={{ padding: "16px 18px", marginBottom: 16, border: `1px solid ${colors.amber}20` }}>
          <div style={{ fontSize: 10, fontWeight: 500, color: colors.amber, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 12, fontFamily: fonts.mono }}>Rate Limits</div>
          {[
            { label: "Daily cap",     value: "20 / day" },
            { label: "Rate window",   value: "1 / min per lead" },
            { label: "Safe hours",    value: "8am – 9pm WAT" },
          ].map(r => (
            <div key={r.label} style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: `1px solid ${colors.border}`, fontSize: 13 }}>
              <span style={{ color: colors.inkC }}>{r.label}</span>
              <span style={{ color: colors.ink, fontFamily: fonts.mono, fontSize: 12 }}>{r.value}</span>
            </div>
          ))}
        </Card>

        {/* Opted out */}
        <Card style={{ marginBottom: 12 }}>
          <div style={{ padding: "14px 16px", borderBottom: `1px solid ${colors.border}` }}>
            <div style={{ fontSize: 10, fontWeight: 500, color: colors.inkD, textTransform: "uppercase", letterSpacing: "0.07em", fontFamily: fonts.mono }}>
              Opted Out ({optedOut.length})
            </div>
          </div>
          {loading ? <Loading /> : optedOut.length === 0 ? <Empty label="None yet. Good." /> :
            optedOut.map((lead, i) => (
              <div key={lead.id} style={{ padding: "11px 16px", borderBottom: i < optedOut.length - 1 ? `1px solid ${colors.border}` : "none", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: colors.ink }}>{lead.name}</div>
                  <div style={{ fontSize: 11, color: colors.inkD, fontFamily: fonts.mono }}>{formatPhone(lead.phone_number)}</div>
                </div>
                <span style={{ fontSize: 10, color: colors.red, fontFamily: fonts.mono, background: colors.redBg, padding: "2px 8px", borderRadius: radius.full }}>BLOCKED</span>
              </div>
            ))
          }
        </Card>

        {/* Invalid */}
        {invalid.length > 0 && (
          <Card>
            <div style={{ padding: "14px 16px", borderBottom: `1px solid ${colors.border}` }}>
              <div style={{ fontSize: 10, fontWeight: 500, color: colors.inkD, textTransform: "uppercase", letterSpacing: "0.07em", fontFamily: fonts.mono }}>Invalid Numbers ({invalid.length})</div>
            </div>
            {invalid.map((lead, i) => (
              <div key={lead.id} style={{ padding: "11px 16px", borderBottom: i < invalid.length - 1 ? `1px solid ${colors.border}` : "none", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: colors.ink }}>{lead.name}</div>
                  <div style={{ fontSize: 11, color: colors.inkD, fontFamily: fonts.mono }}>{formatPhone(lead.phone_number)}</div>
                </div>
                <span style={{ fontSize: 10, color: colors.inkD, fontFamily: fonts.mono, background: colors.slateBg, padding: "2px 8px", borderRadius: radius.full }}>INVALID</span>
              </div>
            ))}
          </Card>
        )}
      </div>
    </Shell>
  );
}

"use client";
import { useEffect, useState } from "react";
import { Shell } from "@/components/layout/Shell";
import { Card, Btn, SectionHeader, Loading, Empty } from "@/components/ui";
import { colors, fonts } from "@/lib/tokens";
import { fetchVariants, updateVariant } from "@/lib/api";
import type { MessageVariant } from "@/types";

function VariantCard({ variant, onToggle }: { variant: MessageVariant; onToggle: () => void }) {
  const replyRate = variant.sent > 0 ? Math.round((variant.replies / variant.sent) * 100) : 0;
  const barColor  = replyRate >= 30 ? colors.green : replyRate >= 15 ? colors.amber : colors.red;

  return (
    <Card style={{ padding: "20px 22px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: colors.inkD, textTransform: "uppercase", letterSpacing: "0.07em", fontFamily: fonts.mono, marginBottom: 4 }}>
            {variant.type}
          </div>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <span style={{
              padding: "2px 8px", borderRadius: 4, fontSize: 10.5, fontWeight: 600,
              background: variant.is_active ? colors.greenBg : colors.slateBg,
              color: variant.is_active ? colors.green : colors.inkD,
              fontFamily: fonts.mono,
            }}>
              {variant.is_active ? "● ACTIVE" : "○ INACTIVE"}
            </span>
          </div>
        </div>
        <Btn small variant={variant.is_active ? "warning" : "success"} onClick={onToggle}>
          {variant.is_active ? "Deactivate" : "Activate"}
        </Btn>
      </div>

      {/* Message preview */}
      <div style={{
        background: colors.surfaceB, border: `1px solid ${colors.border}`,
        borderRadius: 8, padding: "12px 14px", marginBottom: 16,
        fontSize: 13, color: colors.inkB, lineHeight: 1.6, fontFamily: fonts.sans,
      }}>
        {variant.message}
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 14 }}>
        {[
          { label: "Sent",     value: variant.sent },
          { label: "Replies",  value: variant.replies },
          { label: "Rate",     value: `${replyRate}%`, color: barColor },
        ].map(s => (
          <div key={s.label} style={{
            background: colors.surfaceC, borderRadius: 7,
            padding: "10px 14px", textAlign: "center",
          }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: (s as any).color ?? colors.ink, fontFamily: fonts.mono }}>
              {s.value}
            </div>
            <div style={{ fontSize: 11, color: colors.inkD, fontFamily: fonts.sans, marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Reply rate bar */}
      <div>
        <div style={{ fontSize: 10.5, color: colors.inkD, fontFamily: fonts.mono, marginBottom: 5 }}>
          Reply Rate · {replyRate}%
        </div>
        <div style={{ height: 4, background: colors.surfaceD, borderRadius: 2 }}>
          <div style={{ width: `${Math.min(replyRate, 100)}%`, height: "100%", background: barColor, borderRadius: 2, transition: "width 0.5s" }} />
        </div>
      </div>
    </Card>
  );
}

export default function CampaignsPage() {
  const [variants, setVariants] = useState<MessageVariant[]>([]);
  const [loading, setLoading]   = useState(true);

  const load = () => {
    setLoading(true);
    fetchVariants().then(v => { setVariants(v); setLoading(false); }).catch(() => setLoading(false));
  };
  useEffect(load, []);

  const handleToggle = async (v: MessageVariant) => {
    await updateVariant(v.id, { is_active: !v.is_active });
    setVariants(prev => prev.map(x => x.id === v.id ? { ...x, is_active: !x.is_active } : x));
  };

  const totalSent    = variants.reduce((a, v) => a + v.sent, 0);
  const totalReplies = variants.reduce((a, v) => a + v.replies, 0);
  const overallRate  = totalSent > 0 ? Math.round((totalReplies / totalSent) * 100) : 0;

  return (
    <Shell>
      <div style={{ padding: "28px 32px" }}>
        <SectionHeader
          title="Campaigns"
          sub="A/B test your outreach message variants"
          action={<Btn variant="primary" onClick={load}>↻ Refresh</Btn>}
        />

        {/* Summary */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 24 }}>
          {[
            { label: "Total Sent",    value: totalSent },
            { label: "Total Replies", value: totalReplies },
            { label: "Overall Rate",  value: `${overallRate}%` },
          ].map(s => (
            <Card key={s.label} style={{ padding: "16px 20px", textAlign: "center" }}>
              <div style={{ fontSize: 10.5, color: colors.inkD, fontFamily: fonts.mono, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 8 }}>{s.label}</div>
              <div style={{ fontSize: 26, fontWeight: 700, color: colors.ink, fontFamily: fonts.mono }}>{s.value}</div>
            </Card>
          ))}
        </div>

        {loading ? <Loading /> : variants.length === 0 ? (
          <Card style={{ padding: "48px 0" }}>
            <Empty label="No message variants found. Add variants to your message_variants table." />
          </Card>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 16 }}>
            {variants.map(v => (
              <VariantCard key={v.id} variant={v} onToggle={() => handleToggle(v)} />
            ))}
          </div>
        )}
      </div>
    </Shell>
  );
}

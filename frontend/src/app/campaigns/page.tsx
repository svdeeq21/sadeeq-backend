"use client";
import { useEffect, useState } from "react";
import { Shell } from "@/components/layout/Shell";
import { Card, Btn, SectionHeader, Loading, Empty } from "@/components/ui";
import { colors, fonts, radius } from "@/lib/tokens";
import { fetchVariants, updateVariant } from "@/lib/api";
import type { MessageVariant } from "@/types";

function VariantCard({ variant, onToggle }: { variant: MessageVariant; onToggle: () => void }) {
  const replyRate = variant.sent > 0 ? Math.round((variant.replies / variant.sent) * 100) : 0;
  const rateColor = replyRate >= 30 ? colors.green : replyRate >= 15 ? colors.amber : colors.red;

  return (
    <Card style={{ padding: "16px 18px", marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12, gap: 10 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 10, fontWeight: 500, color: colors.inkD, textTransform: "uppercase", letterSpacing: "0.06em", fontFamily: fonts.mono, marginBottom: 5 }}>{variant.type}</div>
          <span style={{ padding: "2px 8px", borderRadius: radius.full, fontSize: 10, fontWeight: 500, background: variant.is_active ? colors.greenBg : colors.slateBg, color: variant.is_active ? colors.green : colors.inkD, fontFamily: fonts.mono }}>
            {variant.is_active ? "Active" : "Inactive"}
          </span>
        </div>
        <Btn small variant={variant.is_active ? "warning" : "success"} onClick={onToggle}>
          {variant.is_active ? "Deactivate" : "Activate"}
        </Btn>
      </div>

      <div style={{ background: colors.surfaceB, border: `1px solid ${colors.border}`, borderRadius: radius.md, padding: "11px 13px", marginBottom: 14, fontSize: 12.5, color: colors.inkB, lineHeight: 1.65, fontFamily: fonts.sans }}>
        {variant.message}
      </div>

      {/* Stats row */}
      <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
        {[
          { label: "Sent",    value: variant.sent },
          { label: "Replies", value: variant.replies },
          { label: "Rate",    value: `${replyRate}%`, color: rateColor },
        ].map(s => (
          <div key={s.label} style={{ flex: 1, background: colors.surfaceC, borderRadius: radius.md, padding: "10px 0", textAlign: "center" }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: (s as any).color ?? colors.ink, fontFamily: fonts.sans }}>{s.value}</div>
            <div style={{ fontSize: 10.5, color: colors.inkD, marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      <div style={{ fontSize: 10, color: colors.inkD, fontFamily: fonts.mono, marginBottom: 5 }}>Reply Rate · {replyRate}%</div>
      <div style={{ height: 3, background: colors.surfaceC, borderRadius: 99 }}>
        <div style={{ width: `${Math.min(replyRate, 100)}%`, height: "100%", background: rateColor, borderRadius: 99, transition: "width 0.5s" }} />
      </div>
    </Card>
  );
}

export default function CampaignsPage() {
  const [variants, setVariants] = useState<MessageVariant[]>([]);
  const [loading, setLoading]   = useState(true);

  const load = () => { setLoading(true); fetchVariants().then(v => { setVariants(v); setLoading(false); }).catch(() => setLoading(false)); };
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
      <div style={{ padding: "20px 16px", maxWidth: 700, margin: "0 auto" }}>
        <SectionHeader title="Campaigns" sub="A/B test your opening variants"
          action={<Btn variant="ghost" small onClick={load}>↻ Refresh</Btn>} />

        {/* Summary */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 20 }}>
          {[
            { label: "Total Sent",    value: totalSent },
            { label: "Total Replies", value: totalReplies },
            { label: "Overall Rate",  value: `${overallRate}%` },
          ].map(s => (
            <Card key={s.label} style={{ padding: "14px", textAlign: "center" }}>
              <div style={{ fontSize: 10, color: colors.inkD, fontFamily: fonts.mono, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>{s.label}</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: colors.ink, fontFamily: fonts.sans }}>{s.value}</div>
            </Card>
          ))}
        </div>

        {loading ? <Loading /> : variants.length === 0
          ? <Empty label="No variants found." />
          : variants.map(v => <VariantCard key={v.id} variant={v} onToggle={() => handleToggle(v)} />)
        }
      </div>
    </Shell>
  );
}

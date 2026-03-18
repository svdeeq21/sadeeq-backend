"use client";
import { useState } from "react";
import { Shell } from "@/components/layout/Shell";
import { Card, Btn, SectionHeader } from "@/components/ui";
import { colors, fonts, radius } from "@/lib/tokens";

const BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "https://svdeeq-bot.onrender.com";

function Toggle({ label, description, value, onChange }: { label: string; description: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "14px 0", borderBottom: `1px solid ${colors.border}`, gap: 16 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 500, color: colors.ink, fontFamily: fonts.sans, marginBottom: 3 }}>{label}</div>
        <div style={{ fontSize: 12, color: colors.inkD, fontFamily: fonts.sans, lineHeight: 1.5 }}>{description}</div>
      </div>
      <div onClick={() => onChange(!value)} style={{
        width: 40, height: 22, borderRadius: radius.full, cursor: "pointer", flexShrink: 0,
        background: value ? colors.ink : colors.surfaceD,
        position: "relative", transition: "background 0.2s",
        border: `1px solid ${value ? "transparent" : colors.border}`,
      }}>
        <div style={{ position: "absolute", top: 2, left: value ? 19 : 2, width: 16, height: 16, borderRadius: "50%", background: value ? colors.bg : colors.inkD, transition: "left 0.2s" }} />
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const [saving, setSaving] = useState(false);
  const [saved,  setSaved]  = useState(false);
  const [s, setS] = useState({
    aggressiveBooking: false, callInviteEnabled: true,
    autoOptout: true, summaryEnabled: true, ragEnabled: true,
    dailyLimit: "20", safeHoursStart: "08:00", safeHoursEnd: "21:00",
    followUpDays: "2", maxFollowUps: "3",
  });
  const set = (k: string, v: any) => setS(p => ({ ...p, [k]: v }));

  const save = async () => {
    setSaving(true);
    await new Promise(r => setTimeout(r, 700));
    setSaving(false); setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  return (
    <Shell>
      <div style={{ padding: "20px 16px", maxWidth: 600, margin: "0 auto" }}>
        <SectionHeader title="Settings" sub="Bot behavior and outreach rules"
          action={<Btn variant="primary" onClick={save} disabled={saving}>{saving ? "Saving…" : saved ? "✓ Saved" : "Save"}</Btn>} />

        <Card style={{ padding: "0 18px", marginBottom: 14 }}>
          <div style={{ fontSize: 10, color: colors.inkD, fontFamily: fonts.mono, textTransform: "uppercase", letterSpacing: "0.07em", padding: "14px 0 8px" }}>Bot Behaviour</div>
          <Toggle label="Aggressive Booking" description="Moves faster toward a call, skips some discovery." value={s.aggressiveBooking} onChange={v => set("aggressiveBooking", v)} />
          <Toggle label="Call Invite Enabled" description="Bot invites leads to a call with Sadiq." value={s.callInviteEnabled} onChange={v => set("callInviteEnabled", v)} />
          <Toggle label="Auto Opt-Out Detection" description="Stops messaging leads who say stop or not interested." value={s.autoOptout} onChange={v => set("autoOptout", v)} />
          <div style={{ height: 4 }} />
        </Card>

        <Card style={{ padding: "0 18px", marginBottom: 14 }}>
          <div style={{ fontSize: 10, color: colors.inkD, fontFamily: fonts.mono, textTransform: "uppercase", letterSpacing: "0.07em", padding: "14px 0 8px" }}>Memory & RAG</div>
          <Toggle label="Conversation Summaries" description="Compresses old messages every 5 exchanges." value={s.summaryEnabled} onChange={v => set("summaryEnabled", v)} />
          <Toggle label="RAG Knowledge Base" description="Fetches relevant project examples before replying." value={s.ragEnabled} onChange={v => set("ragEnabled", v)} />
          <div style={{ height: 4 }} />
        </Card>

        <Card style={{ padding: "0 18px", marginBottom: 14 }}>
          <div style={{ fontSize: 10, color: colors.inkD, fontFamily: fonts.mono, textTransform: "uppercase", letterSpacing: "0.07em", padding: "14px 0 8px" }}>Rate Limits</div>
          {[
            { key: "dailyLimit",    label: "Daily cap",         unit: "messages/day", type: "number" },
            { key: "safeHoursStart",label: "Safe hours start",  unit: "WAT",          type: "time"   },
            { key: "safeHoursEnd",  label: "Safe hours end",    unit: "WAT",          type: "time"   },
            { key: "followUpDays",  label: "Follow-up interval",unit: "days",         type: "number" },
            { key: "maxFollowUps",  label: "Max follow-ups",    unit: "per lead",     type: "number" },
          ].map(f => (
            <div key={f.key} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0", borderBottom: `1px solid ${colors.border}`, gap: 16 }}>
              <div>
                <div style={{ fontSize: 13.5, fontWeight: 500, color: colors.ink }}>{f.label}</div>
                <div style={{ fontSize: 11, color: colors.inkD, marginTop: 2 }}>{f.unit}</div>
              </div>
              <input type={f.type} value={(s as any)[f.key]} onChange={e => set(f.key, e.target.value)}
                style={{ background: colors.surfaceC, border: `1px solid ${colors.border}`, borderRadius: radius.md, padding: "6px 10px", fontSize: 13, color: colors.ink, fontFamily: fonts.mono, outline: "none", width: f.type === "time" ? 90 : 60, textAlign: "right" }} />
            </div>
          ))}
          <div style={{ height: 4 }} />
        </Card>

        <Card style={{ padding: "16px 18px" }}>
          <div style={{ fontSize: 10, color: colors.inkD, fontFamily: fonts.mono, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 12 }}>System</div>
          {[
            { label: "Backend",  value: BASE },
            { label: "Model",    value: "gemini-2.5-flash-lite" },
            { label: "Admin",    value: "+2349035144812" },
          ].map(r => (
            <div key={r.label} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: `1px solid ${colors.border}`, fontSize: 12.5, gap: 12 }}>
              <span style={{ color: colors.inkC, flexShrink: 0 }}>{r.label}</span>
              <span style={{ color: colors.inkB, fontFamily: fonts.mono, fontSize: 11.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textAlign: "right" }}>{r.value}</span>
            </div>
          ))}
        </Card>
      </div>
    </Shell>
  );
}

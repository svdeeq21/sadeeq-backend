"use client";
import { useState } from "react";
import { Shell } from "@/components/layout/Shell";
import { Card, Btn, SectionHeader } from "@/components/ui";
import { colors, fonts } from "@/lib/tokens";

const BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "https://svdeeq-bot.onrender.com";

function SettingSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card style={{ padding: "22px 24px", marginBottom: 16 }}>
      <div style={{ fontSize: 10.5, fontWeight: 600, color: colors.inkD, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 18, fontFamily: fonts.mono }}>
        {title}
      </div>
      {children}
    </Card>
  );
}

function Toggle({ label, description, value, onChange }: {
  label: string; description: string; value: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", paddingBottom: 14, marginBottom: 14, borderBottom: `1px solid ${colors.border}` }}>
      <div>
        <div style={{ fontSize: 13.5, fontWeight: 500, color: colors.ink, fontFamily: fonts.sans, marginBottom: 3 }}>{label}</div>
        <div style={{ fontSize: 12, color: colors.inkD, fontFamily: fonts.sans }}>{description}</div>
      </div>
      <div
        onClick={() => onChange(!value)}
        style={{
          width: 44, height: 24, borderRadius: 12, cursor: "pointer",
          background: value ? colors.accent : colors.surfaceD,
          position: "relative", transition: "background 0.2s", flexShrink: 0, marginLeft: 24,
        }}
      >
        <div style={{
          position: "absolute", top: 3, left: value ? 22 : 3,
          width: 18, height: 18, borderRadius: "50%", background: "#fff",
          transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.4)",
        }} />
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const [saving, setSaving] = useState(false);
  const [saved,  setSaved]  = useState(false);

  const [settings, setSettings] = useState({
    aggressiveBooking:    false,
    callInviteEnabled:    true,
    autoOptout:           true,
    summaryEnabled:       true,
    ragEnabled:           true,
    dailyLimit:           "20",
    rateLimitWindow:      "60",
    safeHoursStart:       "08:00",
    safeHoursEnd:         "21:00",
    followUpIntervalDays: "2",
    maxFollowUps:         "3",
  });

  const set = (key: string, val: string | boolean) =>
    setSettings(p => ({ ...p, [key]: val }));

  const handleSave = async () => {
    setSaving(true);
    // In a real integration, POST to backend config endpoint
    // For now just show saved state
    await new Promise(r => setTimeout(r, 800));
    setSaving(false); setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <Shell>
      <div style={{ padding: "28px 32px", maxWidth: 820 }}>
        <SectionHeader
          title="Settings"
          sub="Configure the AI bot behavior and outreach rules"
          action={
            <Btn variant={saved ? "success" : "primary"} onClick={handleSave} disabled={saving}>
              {saving ? "Saving…" : saved ? "✓ Saved" : "Save Changes"}
            </Btn>
          }
        />

        <SettingSection title="Bot Behavior">
          <Toggle
            label="Aggressive Booking Mode"
            description="Bot pushes for a call faster, skipping some discovery questions. Use when leads seem ready."
            value={settings.aggressiveBooking}
            onChange={v => set("aggressiveBooking", v)}
          />
          <Toggle
            label="Call Invite Enabled"
            description="Bot will attempt to invite leads to a call with Sadiq once they show interest."
            value={settings.callInviteEnabled}
            onChange={v => set("callInviteEnabled", v)}
          />
          <Toggle
            label="Auto Opt-Out Detection"
            description="Automatically stops messaging leads who say STOP, remove me, not interested, etc."
            value={settings.autoOptout}
            onChange={v => set("autoOptout", v)}
          />
        </SettingSection>

        <SettingSection title="Memory & RAG">
          <Toggle
            label="Conversation Summaries"
            description="Automatically compress older messages into a summary every 5 exchanges to save context."
            value={settings.summaryEnabled}
            onChange={v => set("summaryEnabled", v)}
          />
          <Toggle
            label="RAG Knowledge Base"
            description="Bot fetches relevant project examples from the knowledge base before replying."
            value={settings.ragEnabled}
            onChange={v => set("ragEnabled", v)}
          />
        </SettingSection>

        <SettingSection title="Rate Limits & Schedule">
          {[
            { key: "dailyLimit",           label: "Daily Message Cap",           unit: "messages/day",  type: "number" },
            { key: "rateLimitWindow",      label: "Rate Limit Window",           unit: "seconds",       type: "number" },
            { key: "safeHoursStart",       label: "Safe Hours Start",            unit: "WAT (24h)",     type: "time"   },
            { key: "safeHoursEnd",         label: "Safe Hours End",              unit: "WAT (24h)",     type: "time"   },
            { key: "followUpIntervalDays", label: "Follow-Up Interval",          unit: "days between",  type: "number" },
            { key: "maxFollowUps",         label: "Max Follow-Ups per Lead",     unit: "attempts",      type: "number" },
          ].map(f => (
            <div key={f.key} style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              paddingBottom: 14, marginBottom: 14, borderBottom: `1px solid ${colors.border}`,
            }}>
              <div style={{ fontSize: 13.5, fontWeight: 500, color: colors.ink, fontFamily: fonts.sans }}>{f.label}</div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <input
                  type={f.type}
                  value={(settings as any)[f.key]}
                  onChange={e => set(f.key, e.target.value)}
                  style={{
                    background: colors.surfaceC, border: `1px solid ${colors.border}`,
                    borderRadius: 7, padding: "6px 10px", fontSize: 13,
                    color: colors.ink, fontFamily: fonts.mono, outline: "none",
                    width: f.type === "time" ? 100 : 70, textAlign: "right",
                  }}
                />
                <span style={{ fontSize: 11.5, color: colors.inkD, fontFamily: fonts.sans }}>{f.unit}</span>
              </div>
            </div>
          ))}
        </SettingSection>

        <SettingSection title="System Info">
          {[
            { label: "Backend URL",      value: BASE },
            { label: "Supabase",         value: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "—" },
            { label: "Admin WhatsApp",   value: process.env.NEXT_PUBLIC_ADMIN_PHONE ?? "+2349035144812" },
            { label: "Model",            value: "gemini-2.5-flash-lite + fallbacks" },
          ].map(row => (
            <div key={row.label} style={{
              display: "flex", justifyContent: "space-between",
              padding: "9px 0", borderBottom: `1px solid ${colors.border}`,
              fontSize: 12.5, fontFamily: fonts.sans,
            }}>
              <span style={{ color: colors.inkC }}>{row.label}</span>
              <span style={{ color: colors.ink, fontFamily: fonts.mono, fontSize: 12 }}>{row.value}</span>
            </div>
          ))}
        </SettingSection>
      </div>
    </Shell>
  );
}

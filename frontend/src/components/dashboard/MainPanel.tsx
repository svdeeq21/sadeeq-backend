// ─────────────────────────────────────────────
//  Component: MainPanel  (v2)
// ─────────────────────────────────────────────
"use client";

import { useState, useRef, useEffect } from "react";
import { colors, fonts, shadows } from "@/lib/tokens";
import { StatusBadge, ActionButton } from "@/components/ui";
import { TranscriptTab } from "./TranscriptTab";
import { ProfileTab }    from "./ProfileTab";
import { DebugTab }      from "./DebugTab";
import { MOCK_CONVERSATIONS } from "@/lib/constants";
import type { Lead } from "@/types";

type Tab = "transcript" | "profile" | "debug";

interface Props {
  lead: Lead;
  onTogglePause: (id: string) => void;
  showPhone: boolean;
  onTogglePhone: () => void;
}

export function MainPanel({ lead, onTogglePause, showPhone, onTogglePhone }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>("transcript");
  const chatRef = useRef<HTMLDivElement>(null);
  const messages = MOCK_CONVERSATIONS[lead.id] ?? [];

  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [lead.id]);

  return (
    <main style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minWidth: 0, background: colors.bg }}>

      {/* PROFILE HEADER */}
      <div style={{
        padding: "16px 24px",
        background: colors.surface, borderBottom: `1px solid ${colors.border}`,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        boxShadow: shadows.sm, flexShrink: 0,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            width: 42, height: 42, borderRadius: 12,
            background: `linear-gradient(135deg, ${colors.accentBg}, ${colors.surfaceB})`,
            border: `1px solid ${colors.border}`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 17, fontWeight: 700, color: colors.accent, flexShrink: 0,
          }}>
            {lead.name.charAt(0)}
          </div>
          <div>
            <div style={{ fontSize: 17, fontWeight: 600, color: colors.ink, letterSpacing: "-0.01em", marginBottom: 3, fontFamily: fonts.sans }}>
              {lead.name}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <StatusBadge status={lead.status} />
              <span style={{ fontSize: 12, color: colors.inkD, fontFamily: fonts.mono }}>
                {showPhone ? lead.phone : lead.phone.replace(/\d/g, "×")}
              </span>
              <button
                onClick={onTogglePhone}
                style={{ background: "none", border: "none", color: colors.accent, fontSize: 11, cursor: "pointer", fontFamily: fonts.sans, fontWeight: 500, padding: 0 }}
              >
                {showPhone ? "hide" : "reveal"}
              </button>
              <span style={{ fontSize: 12, color: colors.inkD, fontFamily: fonts.sans }}>
                {lead.messages} messages · {lead.lastActive}
              </span>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <ActionButton variant={lead.ai_paused ? "success" : "warning"} onClick={() => onTogglePause(lead.id)}>
            {lead.ai_paused ? "▶ Resume AI" : "⏸ Pause AI"}
          </ActionButton>
          <ActionButton variant="danger">⚑ Escalate</ActionButton>
          <ActionButton variant="ghost">↗ Export</ActionButton>
        </div>
      </div>

      {/* TAB BAR */}
      <div style={{
        display: "flex", padding: "0 24px",
        background: colors.surface, borderBottom: `1px solid ${colors.border}`,
        flexShrink: 0,
      }}>
        {(["transcript", "profile", "debug"] as Tab[]).map((tab) => {
          const active = activeTab === tab;
          const labels: Record<Tab, string> = { transcript: "Transcript", profile: "Profile", debug: "Debug" };
          return (
            <button key={tab} onClick={() => setActiveTab(tab)} style={{
              padding: "12px 18px", border: "none", background: "transparent",
              fontFamily: fonts.sans, fontSize: 13.5,
              fontWeight: active ? 600 : 400,
              color: active ? colors.accent : colors.inkC,
              borderBottom: `2px solid ${active ? colors.accent : "transparent"}`,
              cursor: "pointer", marginBottom: -1, transition: "all 0.15s",
            }}>
              {labels[tab]}
            </button>
          );
        })}
      </div>

      {/* TAB CONTENT */}
      {activeTab === "transcript" && <TranscriptTab messages={messages} chatRef={chatRef} />}
      {activeTab === "profile"    && <ProfileTab lead={lead} />}
      {activeTab === "debug"      && <DebugTab   lead={lead} />}
    </main>
  );
}

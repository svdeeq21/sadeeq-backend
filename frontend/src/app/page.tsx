"use client";
import { useState, useEffect, useCallback } from "react";
import { colors, layout, fonts } from "@/lib/tokens";
import { useLeads, useLeadFilter, useMessages } from "@/hooks";
import { StatusBadge, ActionButton } from "@/components/ui";
import { STATUS_CONFIG } from "@/lib/constants";
import { maskPhone, fetchVariants } from "@/lib/api";
import type { Lead, LeadStatus, MessageVariant } from "@/types";

type NavPage = "dashboard" | "analytics" | "outreach" | "settings";

// ─────────────────────────────────────────────
// Avatar
// ─────────────────────────────────────────────
function Avatar({ name, size = 36, showStatus, online }: { name: string; size?: number; showStatus?: boolean; online?: boolean }) {
  const initials = name.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase();
  const hue = (name.charCodeAt(0) * 47 + (name.charCodeAt(1) || 0) * 13) % 360;
  return (
    <div style={{ position: "relative", flexShrink: 0 }}>
      <div style={{ width: size, height: size, borderRadius: "50%", background: `hsl(${hue},35%,32%)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.38, fontWeight: 700, color: `hsl(${hue},55%,75%)` }}>{initials}</div>
      {showStatus && <div style={{ position: "absolute", bottom: 0, right: 0, width: size * 0.3, height: size * 0.3, borderRadius: "50%", background: online ? colors.green : colors.inkMuted, border: `2px solid ${colors.bgSidebar}` }} />}
    </div>
  );
}

// ─────────────────────────────────────────────
// Icon Rail
// ─────────────────────────────────────────────
function IconRail({ activePage, setPage }: { activePage: NavPage; setPage: (p: NavPage) => void }) {
  const navItems: { icon: string; label: string; page: NavPage; tooltip: string }[] = [
    { icon: "💬", label: "Dashboard", page: "dashboard",  tooltip: "Leads & Chat" },
    { icon: "📈", label: "Analytics", page: "analytics",  tooltip: "A/B Stats & Metrics" },
    { icon: "📣", label: "Outreach",  page: "outreach",   tooltip: "Scheduler & Campaigns" },
    { icon: "⚙️", label: "Settings",  page: "settings",   tooltip: "Bot Configuration" },
  ];

  return (
    <div style={{ width: layout.iconRailWidth, background: colors.bgDeep, display: "flex", flexDirection: "column", alignItems: "center", padding: "16px 0", gap: 4, flexShrink: 0, borderRight: `1px solid ${colors.border}` }}>
      {/* Logo */}
      <div style={{ width: 44, height: 44, borderRadius: 16, background: `linear-gradient(135deg, ${colors.accent}, #7C3AED)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, marginBottom: 12, boxShadow: `0 4px 16px ${colors.accent}40` }}>💬</div>
      <div style={{ width: 32, height: 1, background: colors.border, margin: "4px 0" }} />

      {navItems.map(item => {
        const active = activePage === item.page;
        return (
          <div key={item.page} title={item.tooltip} onClick={() => setPage(item.page)} style={{ width: 44, height: 44, borderRadius: 12, background: active ? colors.accent : "transparent", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, cursor: "pointer", transition: "background 0.15s", position: "relative" }}
            onMouseEnter={e => { if (!active) (e.currentTarget as HTMLDivElement).style.background = colors.bgHover; }}
            onMouseLeave={e => { if (!active) (e.currentTarget as HTMLDivElement).style.background = "transparent"; }}
          >
            {item.icon}
            {/* tooltip label */}
            <div style={{ position: "absolute", left: "calc(100% + 10px)", background: colors.bgCard, color: colors.ink, fontSize: 12, fontWeight: 600, padding: "5px 10px", borderRadius: 6, whiteSpace: "nowrap", pointerEvents: "none", opacity: 0, transition: "opacity 0.15s", border: `1px solid ${colors.borderB}`, zIndex: 99 }}
              className="nav-tooltip"
            >{item.tooltip}</div>
          </div>
        );
      })}

      <div style={{ flex: 1 }} />
      <div style={{ width: 36, height: 36, borderRadius: "50%", background: `linear-gradient(135deg, ${colors.accent}, #7C3AED)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, fontWeight: 700, color: "#fff", position: "relative" }}>
        S
        <div style={{ position: "absolute", bottom: 0, right: 0, width: 11, height: 11, borderRadius: "50%", background: colors.green, border: `2px solid ${colors.bgDeep}` }} />
      </div>
    </div>
  );
}


// ─────────────────────────────────────────────
// ScoreBar
// ─────────────────────────────────────────────
function ScoreBar({ score }: { score: number | null }) {
  const s = score ?? 0;
  const pct = Math.round(s * 100);
  const color = s >= 0.7 ? colors.green : s >= 0.4 ? colors.amber : s >= 0.15 ? "#00B0F4" : colors.inkMuted;
  const label = s >= 0.7 ? "HOT" : s >= 0.4 ? "WARM" : s >= 0.15 ? "COLD" : "—";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <div style={{ flex: 1, height: 4, background: colors.bgDeep, borderRadius: 99, overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 99, transition: "width 0.4s ease" }} />
      </div>
      <span style={{ fontSize: 10, fontWeight: 700, color, minWidth: 30, fontFamily: fonts.mono }}>{label}</span>
    </div>
  );
}

// ─────────────────────────────────────────────
// Lead Sidebar
// ─────────────────────────────────────────────
function LeadSidebar({ filteredLeads, selectedLead, onSelect, filterStatus, setFilterStatus, searchQuery, setSearchQuery, counts }: {
  filteredLeads: Lead[]; selectedLead: Lead | null; onSelect: (l: Lead) => void;
  filterStatus: string; setFilterStatus: (s: string) => void;
  searchQuery: string; setSearchQuery: (s: string) => void;
  counts: Record<string, number>;
}) {
  const filters = ["ALL", "AI_RESPONDED", "HUMAN_REQUIRED", "OUTREACH_SENT", "PENDING"];
  return (
    <div style={{ width: layout.sidebarWidth, background: colors.bgSidebar, display: "flex", flexDirection: "column", borderRight: `1px solid ${colors.border}`, flexShrink: 0 }}>
      <div style={{ padding: "14px 14px 8px", borderBottom: `1px solid ${colors.border}` }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: colors.ink, marginBottom: 10 }}>Leads</div>
        <div style={{ position: "relative" }}>
          <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: colors.inkD, fontSize: 13 }}>🔍</span>
          <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search…" style={{ width: "100%", padding: "7px 10px 7px 30px", background: colors.bgInput, border: "none", borderRadius: 6, fontSize: 13, color: colors.ink }} />
        </div>
      </div>
      <div style={{ padding: "8px 8px 4px" }}>
        {filters.map(key => {
          const active = filterStatus === key;
          const cfg = STATUS_CONFIG[key as LeadStatus];
          const label = key === "ALL" ? `All` : cfg?.label ?? key;
          const count = key === "ALL" ? counts.ALL : (counts[key] ?? 0);
          return (
            <div key={key} onClick={() => setFilterStatus(key)} style={{ padding: "6px 10px", borderRadius: 6, cursor: "pointer", marginBottom: 2, background: active ? colors.bgSelected : "transparent", color: active ? colors.ink : colors.inkC, fontSize: 13, fontWeight: active ? 600 : 400, display: "flex", alignItems: "center", justifyContent: "space-between" }}
              onMouseEnter={e => { if (!active) (e.currentTarget as HTMLDivElement).style.background = colors.bgHover; }}
              onMouseLeave={e => { if (!active) (e.currentTarget as HTMLDivElement).style.background = "transparent"; }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {key !== "ALL" && <span style={{ width: 8, height: 8, borderRadius: "50%", background: cfg?.dot ?? colors.inkMuted, flexShrink: 0 }} />}
                {label}
              </div>
              <span style={{ fontSize: 11, color: colors.inkD, fontWeight: 400 }}>{count}</span>
            </div>
          );
        })}
      </div>
      <div style={{ width: "calc(100% - 16px)", height: 1, background: colors.border, margin: "4px 8px" }} />
      <div style={{ fontSize: 11, fontWeight: 700, color: colors.inkD, letterSpacing: "0.06em", padding: "4px 14px 6px", textTransform: "uppercase" }}>Direct Messages</div>
      <div style={{ overflowY: "auto", flex: 1 }}>
        {filteredLeads.length === 0 && <div style={{ padding: 24, textAlign: "center", color: colors.inkD, fontSize: 13 }}>No leads found.</div>}
        {filteredLeads.map(lead => {
          const active = selectedLead?.id === lead.id;
          const online = lead.status === "AI_RESPONDED" || lead.status === "OUTREACH_SENT";
          const needsAttention = lead.status === "HUMAN_REQUIRED";
          return (
            <div key={lead.id} onClick={() => onSelect(lead)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 10px", margin: "1px 6px", borderRadius: 6, background: active ? colors.bgSelected : "transparent", cursor: "pointer" }}
              onMouseEnter={e => { if (!active) (e.currentTarget as HTMLDivElement).style.background = colors.bgHover; }}
              onMouseLeave={e => { if (!active) (e.currentTarget as HTMLDivElement).style.background = "transparent"; }}
            >
              <Avatar name={lead.name} size={32} showStatus online={online} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 13.5, fontWeight: needsAttention ? 700 : 500, color: active || needsAttention ? colors.ink : colors.inkC, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{lead.name}</span>
                  {needsAttention && <span style={{ minWidth: 18, height: 18, borderRadius: 99, background: colors.red, color: "#fff", fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 4px", flexShrink: 0 }}>{lead.message_count ?? "!"}</span>}
                </div>
                {lead.business_name && <div style={{ fontSize: 11.5, color: colors.inkD, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{lead.business_name}</div>}
                <div style={{ marginTop: 4 }}><ScoreBar score={lead.interest_score ?? 0} /></div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Chat Area
// ─────────────────────────────────────────────
function ChatArea({ lead, messages, loading, onTogglePause, showPhone, onTogglePhone }: {
  lead: Lead; messages: any[]; loading: boolean;
  onTogglePause: (id: string) => void; showPhone: boolean; onTogglePhone: () => void;
}) {
  const [activeTab, setActiveTab] = useState<"chat" | "profile" | "debug">("chat");
  const [chatEl, setChatEl] = useState<HTMLDivElement | null>(null);
  useEffect(() => { if (chatEl) chatEl.scrollTop = chatEl.scrollHeight; }, [messages.length, chatEl, lead.id]);

  const isOnline = lead.status === "AI_RESPONDED" || lead.status === "OUTREACH_SENT";
  const displayPhone = showPhone ? lead.phone_number : maskPhone(lead.phone_number);

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", background: colors.bgMain, minWidth: 0 }}>
      {/* Header */}
      <div style={{ height: layout.topbarHeight, padding: "0 16px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: `1px solid ${colors.border}`, flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Avatar name={lead.name} size={32} showStatus online={isOnline} />
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: colors.ink }}>{lead.name}{lead.business_name && <span style={{ fontSize: 12.5, fontWeight: 400, color: colors.inkD, marginLeft: 6 }}>· {lead.business_name}</span>}</div>
            <div style={{ fontSize: 12, color: isOnline ? colors.green : colors.inkD }}>{isOnline ? "online" : lead.last_active ?? "offline"} · <button onClick={onTogglePhone} style={{ background: "none", border: "none", color: colors.accent, fontSize: 12, cursor: "pointer", padding: 0 }}>{displayPhone}</button></div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {(["chat", "profile", "debug"] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)} style={{ padding: "5px 12px", borderRadius: 6, border: "none", background: activeTab === tab ? colors.bgSelected : "transparent", color: activeTab === tab ? colors.ink : colors.inkD, fontSize: 12.5, fontWeight: activeTab === tab ? 600 : 400 }}>
              {tab === "chat" ? "💬 Chat" : tab === "profile" ? "👤 Profile" : "🔧 Debug"}
            </button>
          ))}
          <div style={{ width: 1, height: 20, background: colors.border, margin: "0 4px" }} />
          <ActionButton variant={lead.ai_paused ? "success" : "warning"} onClick={() => onTogglePause(lead.id)}>{lead.ai_paused ? "▶ Resume" : "⏸ Pause"}</ActionButton>
        </div>
      </div>

      {/* Chat */}
      {activeTab === "chat" && (
        <div ref={el => setChatEl(el)} style={{ flex: 1, overflowY: "auto", padding: "16px 0" }}>
          {loading && !messages.length
            ? <div style={{ textAlign: "center", color: colors.inkD, paddingTop: 60, fontSize: 13 }}>Loading…</div>
            : messages.length === 0
            ? <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: 10 }}>
                <div style={{ fontSize: 52 }}>💬</div>
                <div style={{ color: colors.inkD, fontSize: 14 }}>No messages yet</div>
                <div style={{ color: colors.inkMuted, fontSize: 12 }}>Outreach fires during next scheduled window</div>
              </div>
            : messages.map((msg, i) => {
                const isAI = msg.role === "AI";
                const isSys = msg.role === "SYSTEM";
                const prevMsg = messages[i - 1];
                const grouped = prevMsg && prevMsg.role === msg.role;
                const time = new Date(msg.inserted_at).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
                const hue = (lead.name.charCodeAt(0) * 47 + (lead.name.charCodeAt(1) || 0) * 13) % 360;

                if (isSys) return (
                  <div key={msg.id} style={{ display: "flex", justifyContent: "center", padding: "6px 16px" }}>
                    <div style={{ padding: "4px 14px", borderRadius: 99, background: colors.bgCard, color: colors.inkD, fontSize: 12, border: `1px solid ${colors.borderB}` }}>🔒 {msg.content}</div>
                  </div>
                );

                return (
                  <div key={msg.id} style={{ display: "flex", alignItems: "flex-start", gap: 14, padding: `${grouped ? "1px" : "10px"} 16px 1px` }}>
                    <div style={{ width: 36, flexShrink: 0, paddingTop: grouped ? 0 : 2 }}>
                      {!grouped && (isAI
                        ? <div style={{ width: 36, height: 36, borderRadius: "50%", background: `linear-gradient(135deg,${colors.accent},#7C3AED)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>🤖</div>
                        : <Avatar name={lead.name} size={36} />
                      )}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      {!grouped && (
                        <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 3 }}>
                          <span style={{ fontSize: 14, fontWeight: 600, color: isAI ? colors.accent : `hsl(${hue},55%,70%)` }}>{isAI ? "Svdeeq Bot" : lead.name}</span>
                          <span style={{ fontSize: 11, color: colors.inkD }}>{time}</span>
                          {isAI && msg.latency_ms && <span style={{ fontSize: 10, color: colors.inkMuted, fontFamily: fonts.mono }}>{msg.latency_ms}ms</span>}
                        </div>
                      )}
                      <div style={{ fontSize: 14.5, color: colors.inkB, lineHeight: 1.55, wordBreak: "break-word" }}>{msg.content}</div>
                    </div>
                  </div>
                );
              })
          }
        </div>
      )}

      {/* Profile */}
      {activeTab === "profile" && (
        <div style={{ flex: 1, overflowY: "auto", padding: 20 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, maxWidth: 640 }}>
            {[["👤 Name", lead.name], ["🏢 Business", lead.business_name ?? "—"], ["🏭 Industry", lead.industry ?? "—"], ["📍 Location", lead.location ?? "—"], ["📊 Status", lead.status], ["🤖 AI", lead.ai_paused ? "Paused" : "Running"], ["📨 Follow-ups", `${lead.follow_up_count ?? 0} sent`], ["💬 Messages", String(lead.message_count ?? 0)], ["📅 Last Outreach", lead.last_outreach_at ? new Date(lead.last_outreach_at).toLocaleDateString() : "—"], ["🎯 Variant", lead.outreach_variant ?? "none"]].map(([label, value]) => (
              <div key={label} style={{ background: colors.bgCard, border: `1px solid ${colors.border}`, borderRadius: 10, padding: "12px 14px" }}>
                <div style={{ fontSize: 11, color: colors.inkD, marginBottom: 4 }}>{label}</div>
                <div style={{ fontSize: 13.5, color: colors.ink, fontWeight: 500 }}>{value}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Debug */}
      {activeTab === "debug" && (
        <div style={{ flex: 1, overflowY: "auto", padding: 20 }}>
          <div style={{ background: colors.bgCard, border: `1px solid ${colors.border}`, borderRadius: 10, overflow: "hidden", maxWidth: 520 }}>
            <div style={{ padding: "10px 14px", background: colors.bgDeep, borderBottom: `1px solid ${colors.border}` }}>
              <span style={{ fontFamily: fonts.mono, fontSize: 12, color: colors.accent }}>🔧 debug · {lead.id.slice(0, 8)}</span>
            </div>
            {[["status", lead.status], ["ai_paused", String(lead.ai_paused)], ["embedding_model", "gemini-embedding-001"], ["llm_model", "gemini-2.5-flash-lite"], ["memory_window", "last 6 messages"], ["total_messages", String(messages.length)], ["follow_up_count", String(lead.follow_up_count ?? 0)], ["outreach_variant", lead.outreach_variant ?? "none"]].map(([k, v], i) => (
              <div key={k} style={{ display: "flex", padding: "9px 14px", borderBottom: `1px solid ${colors.border}`, background: i % 2 === 0 ? "transparent" : "#ffffff03" }}>
                <span style={{ fontFamily: fonts.mono, fontSize: 12, color: colors.inkD, minWidth: 200 }}>{k}</span>
                <span style={{ fontFamily: fonts.mono, fontSize: 12, color: colors.ink, fontWeight: 500 }}>{v}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ padding: "12px 16px", borderTop: `1px solid ${colors.border}`, flexShrink: 0 }}>
        <div style={{ background: colors.bgInput, borderRadius: 8, padding: "10px 14px", fontSize: 13.5, color: colors.inkD, border: `1px solid ${colors.borderB}` }}>
          💬 Replies handled automatically by Svdeeq-Bot
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Right Panel
// ─────────────────────────────────────────────
function RightPanel({ lead }: { lead: Lead }) {
  return (
    <div style={{ width: layout.rightPanelWidth, background: colors.bgSidebar, borderLeft: `1px solid ${colors.border}`, display: "flex", flexDirection: "column", flexShrink: 0, overflowY: "auto" }}>
      <div style={{ padding: "14px 16px", borderBottom: `1px solid ${colors.border}` }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: colors.ink }}>Lead Info</div>
      </div>
      <div style={{ padding: "20px 16px", display: "flex", flexDirection: "column", alignItems: "center", gap: 10, borderBottom: `1px solid ${colors.border}` }}>
        <Avatar name={lead.name} size={64} showStatus online={lead.status === "AI_RESPONDED"} />
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: colors.ink }}>{lead.name}</div>
          {lead.business_name && <div style={{ fontSize: 12.5, color: colors.inkD, marginTop: 2 }}>{lead.business_name}</div>}
          <div style={{ marginTop: 6 }}><StatusBadge status={lead.status} /></div>
        </div>
      </div>
      {[["SCORE", `${Math.round((lead.interest_score ?? 0) * 100)}% · ${(lead.interest_score ?? 0) >= 0.7 ? "🔥 HOT" : (lead.interest_score ?? 0) >= 0.4 ? "🟡 WARM" : (lead.interest_score ?? 0) >= 0.15 ? "🔵 COLD" : "— Untouched"}`], ["INDUSTRY", lead.industry ?? "—"], ["LOCATION", lead.location ?? "—"], ["MESSAGES", String(lead.message_count ?? 0)], ["FOLLOW-UPS", `${lead.follow_up_count ?? 0} / 3`], ["LAST ACTIVE", lead.last_active ?? "—"], ["VARIANT", lead.outreach_variant ?? "none"]].map(([label, value]) => (
        <div key={label} style={{ padding: "10px 16px", borderBottom: `1px solid ${colors.border}` }}>
          <div style={{ fontSize: 10.5, fontWeight: 700, color: colors.inkD, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 3 }}>{label}</div>
          <div style={{ fontSize: 13.5, color: colors.inkB, fontWeight: 500 }}>{value}</div>
        </div>
      ))}
      <div style={{ padding: "12px 16px", margin: "8px 10px", borderRadius: 8, background: lead.ai_paused ? "#2C1215" : "#1A2E22", border: `1px solid ${lead.ai_paused ? colors.red : colors.green}30` }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: lead.ai_paused ? colors.red : colors.green, marginBottom: 4 }}>{lead.ai_paused ? "⏸ AI Paused" : "▶ AI Active"}</div>
        <div style={{ fontSize: 12, color: colors.inkD, lineHeight: 1.5 }}>{lead.ai_paused ? "Bot paused. Use Resume to re-enable." : "Bot is handling this conversation."}</div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Analytics Page
// ─────────────────────────────────────────────
function AnalyticsPage({ leads }: { leads: Lead[] }) {
  const [variants, setVariants] = useState<MessageVariant[]>([]);
  useEffect(() => { fetchVariants().then(setVariants).catch(() => {}); }, []);

  const total       = leads.length;
  const active      = leads.filter(l => l.status === "AI_RESPONDED").length;
  const needHuman   = leads.filter(l => l.status === "HUMAN_REQUIRED").length;
  const sent        = leads.filter(l => l.status === "OUTREACH_SENT").length;
  const replied     = leads.filter(l => (l.message_count ?? 0) > 1).length;
  const replyRate   = total > 0 ? ((replied / total) * 100).toFixed(1) : "0";
  const followUps   = leads.reduce((a, l) => a + (l.follow_up_count ?? 0), 0);
  const avgMessages = total > 0 ? (leads.reduce((a, l) => a + (l.message_count ?? 0), 0) / total).toFixed(1) : "0";

  const statCards = [
    { label: "Total Leads",    value: total,       color: colors.accent },
    { label: "AI Active",      value: active,      color: colors.green },
    { label: "Needs Attention",value: needHuman,   color: colors.red },
    { label: "Reply Rate",     value: `${replyRate}%`, color: colors.blue },
    { label: "Follow-ups Sent",value: followUps,   color: colors.amber },
    { label: "Avg Messages",   value: avgMessages, color: colors.teal },
  ];

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: 28, background: colors.bgMain }}>
      <div style={{ fontSize: 22, fontWeight: 700, color: colors.ink, marginBottom: 6 }}>📈 Analytics</div>
      <div style={{ fontSize: 13, color: colors.inkD, marginBottom: 24 }}>Real-time stats from your Supabase leads table</div>

      {/* Stat cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 28 }}>
        {statCards.map(({ label, value, color }) => (
          <div key={label} style={{ background: colors.bgCard, border: `1px solid ${colors.border}`, borderRadius: 12, padding: "18px 20px", borderLeft: `3px solid ${color}` }}>
            <div style={{ fontSize: 28, fontWeight: 800, color, marginBottom: 4 }}>{value}</div>
            <div style={{ fontSize: 12.5, color: colors.inkD, fontWeight: 500 }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Status breakdown */}
      <div style={{ background: colors.bgCard, border: `1px solid ${colors.border}`, borderRadius: 12, padding: "18px 20px", marginBottom: 20 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: colors.ink, marginBottom: 14 }}>Lead Status Breakdown</div>
        {(["PENDING","OUTREACH_SENT","AI_RESPONDED","HUMAN_REQUIRED","OPTED_OUT","INACTIVE","INVALID_NUMBER"] as LeadStatus[]).map(status => {
          const count = leads.filter(l => l.status === status).length;
          if (!count) return null;
          const pct = Math.round((count / total) * 100);
          const cfg = STATUS_CONFIG[status];
          return (
            <div key={status} style={{ marginBottom: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <span style={{ fontSize: 13, color: colors.inkB }}>{cfg.label}</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: cfg.color }}>{count} · {pct}%</span>
              </div>
              <div style={{ height: 6, background: colors.bgDeep, borderRadius: 99, overflow: "hidden" }}>
                <div style={{ width: `${pct}%`, height: "100%", background: cfg.dot, borderRadius: 99, transition: "width 0.6s ease" }} />
              </div>
            </div>
          );
        })}
      </div>


      {/* Score distribution */}
      <div style={{ background: colors.bgCard, border: `1px solid ${colors.border}`, borderRadius: 12, padding: "18px 20px", marginBottom: 20 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: colors.ink, marginBottom: 14 }}>🔥 Lead Heat Distribution</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 16 }}>
          {[
            { label: "🔥 HOT",      min: 0.7, max: 1.0,  color: colors.green },
            { label: "🟡 WARM",     min: 0.4, max: 0.7,  color: colors.amber },
            { label: "🔵 COLD",     min: 0.15, max: 0.4, color: colors.blue },
            { label: "— Untouched", min: 0,  max: 0.15,  color: colors.inkMuted },
          ].map(({ label, min, max, color }) => {
            const count = leads.filter(l => { const s = l.interest_score ?? 0; return s >= min && s < max; }).length;
            return (
              <div key={label} style={{ background: colors.bgDeep, borderRadius: 10, padding: "14px 16px", borderLeft: `3px solid ${color}` }}>
                <div style={{ fontSize: 22, fontWeight: 800, color }}>{count}</div>
                <div style={{ fontSize: 12, color: colors.inkD, marginTop: 2 }}>{label}</div>
              </div>
            );
          })}
        </div>
        {/* Top scored leads */}
        <div style={{ fontSize: 12, fontWeight: 700, color: colors.inkD, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 8 }}>Top Scored Leads</div>
        {[...leads].sort((a, b) => (b.interest_score ?? 0) - (a.interest_score ?? 0)).slice(0, 5).map(lead => (
          <div key={lead.id} style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
            <Avatar name={lead.name} size={28} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: colors.ink }}>{lead.name}</div>
              <ScoreBar score={lead.interest_score ?? 0} />
            </div>
            <span style={{ fontFamily: fonts.mono, fontSize: 13, fontWeight: 700, color: (lead.interest_score ?? 0) >= 0.7 ? colors.green : (lead.interest_score ?? 0) >= 0.4 ? colors.amber : colors.inkD }}>
              {Math.round((lead.interest_score ?? 0) * 100)}%
            </span>
          </div>
        ))}
      </div>

      {/* A/B variant table */}
      <div style={{ background: colors.bgCard, border: `1px solid ${colors.border}`, borderRadius: 12, overflow: "hidden" }}>
        <div style={{ padding: "14px 20px", borderBottom: `1px solid ${colors.border}` }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: colors.ink }}>🎯 A/B Variant Performance</div>
          <div style={{ fontSize: 12, color: colors.inkD, marginTop: 2 }}>Opening message variants tracked from message_variants table</div>
        </div>
        {variants.length === 0
          ? <div style={{ padding: 24, textAlign: "center", color: colors.inkD, fontSize: 13 }}>Loading variants… (make sure outreach_sql.sql has been run)</div>
          : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: colors.bgDeep }}>
                  {["Variant ID", "Type", "Sent", "Replies", "Reply Rate", "Preview"].map(h => (
                    <th key={h} style={{ padding: "10px 16px", textAlign: "left", fontSize: 11, fontWeight: 700, color: colors.inkD, letterSpacing: "0.06em", textTransform: "uppercase" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {variants.map((v, i) => {
                  const rate = v.sent > 0 ? ((v.replies / v.sent) * 100).toFixed(1) : "0.0";
                  const rateNum = parseFloat(rate);
                  return (
                    <tr key={v.id} style={{ borderBottom: `1px solid ${colors.border}`, background: i % 2 === 0 ? "transparent" : "#ffffff03" }}>
                      <td style={{ padding: "10px 16px", fontFamily: fonts.mono, fontSize: 12, color: colors.accent }}>{v.id}</td>
                      <td style={{ padding: "10px 16px", fontSize: 12 }}><span style={{ padding: "2px 8px", borderRadius: 99, background: colors.bgDeep, color: colors.inkC, fontSize: 11 }}>{v.type}</span></td>
                      <td style={{ padding: "10px 16px", fontSize: 13, fontWeight: 600, color: colors.ink }}>{v.sent}</td>
                      <td style={{ padding: "10px 16px", fontSize: 13, fontWeight: 600, color: colors.ink }}>{v.replies}</td>
                      <td style={{ padding: "10px 16px" }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: rateNum > 20 ? colors.green : rateNum > 10 ? colors.amber : colors.inkD }}>{rate}%</span>
                      </td>
                      <td style={{ padding: "10px 16px", fontSize: 12, color: colors.inkD, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{v.message.slice(0, 60)}…</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )
        }
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Outreach Page
// ─────────────────────────────────────────────
function OutreachPage({ leads }: { leads: Lead[] }) {
  const now = new Date();
  const watHour = (now.getUTCHours() + 1) % 24;
  const watMin  = now.getMinutes();
  const inWindow1 = watHour >= 9 && watHour < 12;
  const inWindow2 = (watHour > 14 || (watHour === 14 && watMin >= 0)) && (watHour < 17 || (watHour === 17 && watMin <= 30));
  const isLive = inWindow1 || inWindow2;

  const pendingLeads   = leads.filter(l => l.status === "PENDING");
  const outreachLeads  = leads.filter(l => l.status === "OUTREACH_SENT");
  const followUpLeads  = leads.filter(l => (l.follow_up_count ?? 0) > 0 && l.status !== "INACTIVE" && l.status !== "OPTED_OUT");
  const recentOutreach = leads.filter(l => l.last_outreach_at).sort((a, b) => new Date(b.last_outreach_at!).getTime() - new Date(a.last_outreach_at!).getTime()).slice(0, 8);

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: 28, background: colors.bgMain }}>
      <div style={{ fontSize: 22, fontWeight: 700, color: colors.ink, marginBottom: 6 }}>📣 Outreach</div>
      <div style={{ fontSize: 13, color: colors.inkD, marginBottom: 24 }}>Scheduler status, campaign health, and send history</div>

      {/* Scheduler status */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 24 }}>
        <div style={{ background: colors.bgCard, border: `1px solid ${isLive ? colors.green : colors.border}`, borderRadius: 12, padding: "18px 20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <div style={{ width: 10, height: 10, borderRadius: "50%", background: isLive ? colors.green : colors.inkMuted, boxShadow: isLive ? `0 0 0 4px ${colors.green}25` : "none" }} />
            <span style={{ fontSize: 14, fontWeight: 700, color: isLive ? colors.green : colors.inkD }}>{isLive ? "Scheduler Active" : "Scheduler Idle"}</span>
          </div>
          <div style={{ fontSize: 13, color: colors.inkD, lineHeight: 1.6 }}>
            Current WAT time: <span style={{ color: colors.ink, fontWeight: 600, fontFamily: fonts.mono }}>{String(watHour).padStart(2,"0")}:{String(watMin).padStart(2,"0")}</span><br />
            Window 1: <span style={{ color: colors.inkB }}>09:00 – 12:00</span><br />
            Window 2: <span style={{ color: colors.inkB }}>14:00 – 17:30</span><br />
            Interval: <span style={{ color: colors.inkB }}>every 20–40 min</span>
          </div>
        </div>

        <div style={{ background: colors.bgCard, border: `1px solid ${colors.border}`, borderRadius: 12, padding: "18px 20px" }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: colors.ink, marginBottom: 10 }}>Queue Status</div>
          {[
            { label: "Pending (not contacted)", value: pendingLeads.length, color: colors.inkC },
            { label: "Outreach sent",            value: outreachLeads.length, color: colors.blue },
            { label: "In follow-up sequence",    value: followUpLeads.length, color: colors.amber },
          ].map(({ label, value, color }) => (
            <div key={label} style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
              <span style={{ fontSize: 13, color: colors.inkD }}>{label}</span>
              <span style={{ fontSize: 13, fontWeight: 700, color }}>{value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Follow-up sequence diagram */}
      <div style={{ background: colors.bgCard, border: `1px solid ${colors.border}`, borderRadius: 12, padding: "18px 20px", marginBottom: 20 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: colors.ink, marginBottom: 14 }}>Follow-up Sequence</div>
        <div style={{ display: "flex", alignItems: "center", gap: 0 }}>
          {[
            { day: "Day 0", label: "Initial outreach", icon: "📨", color: colors.accent },
            { day: "Day 2", label: "Follow-up 1",      icon: "🔔", color: colors.blue },
            { day: "Day 5", label: "Follow-up 2",      icon: "💡", color: colors.amber },
            { day: "Day 10",label: "Final message",    icon: "👋", color: colors.inkC },
            { day: "→",     label: "INACTIVE",         icon: "🔇", color: colors.inkMuted },
          ].map((step, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center" }}>
              <div style={{ textAlign: "center", padding: "0 12px" }}>
                <div style={{ fontSize: 18, marginBottom: 4 }}>{step.icon}</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: step.color }}>{step.day}</div>
                <div style={{ fontSize: 11, color: colors.inkD, marginTop: 2 }}>{step.label}</div>
              </div>
              {i < 4 && <div style={{ width: 24, height: 2, background: colors.borderB, flexShrink: 0 }} />}
            </div>
          ))}
        </div>
      </div>

      {/* Recent send history */}
      <div style={{ background: colors.bgCard, border: `1px solid ${colors.border}`, borderRadius: 12, overflow: "hidden" }}>
        <div style={{ padding: "14px 20px", borderBottom: `1px solid ${colors.border}` }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: colors.ink }}>Recent Outreach History</div>
        </div>
        {recentOutreach.length === 0
          ? <div style={{ padding: 24, textAlign: "center", color: colors.inkD, fontSize: 13 }}>No outreach sent yet.</div>
          : recentOutreach.map((lead, i) => (
            <div key={lead.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 16px", borderBottom: `1px solid ${colors.border}`, background: i % 2 === 0 ? "transparent" : "#ffffff03" }}>
              <Avatar name={lead.name} size={30} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: colors.ink }}>{lead.name}</div>
                <div style={{ fontSize: 12, color: colors.inkD }}>{lead.business_name ?? lead.industry ?? "—"}</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <StatusBadge status={lead.status} />
                <div style={{ fontSize: 11, color: colors.inkD, marginTop: 3 }}>{lead.last_outreach_at ? new Date(lead.last_outreach_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "—"}</div>
              </div>
              <div style={{ textAlign: "right", minWidth: 60 }}>
                <div style={{ fontSize: 11, color: colors.inkD }}>Follow-up</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: colors.amber }}>{lead.follow_up_count ?? 0} / 3</div>
              </div>
              {lead.outreach_variant && (
                <div style={{ padding: "3px 8px", borderRadius: 6, background: colors.bgDeep, fontFamily: fonts.mono, fontSize: 11, color: colors.accent }}>{lead.outreach_variant}</div>
              )}
            </div>
          ))
        }
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Settings Page
// ─────────────────────────────────────────────
function SettingsPage() {
  const configs = [
    { section: "🤖 AI Model", items: [
      ["LLM", "gemini-2.5-flash-lite"],
      ["Embedding model", "gemini-embedding-001"],
      ["Embedding dimensions", "3072"],
      ["RAG match threshold", "0.5"],
      ["Memory window", "Last 6 messages"],
    ]},
    { section: "📅 Scheduler", items: [
      ["Timezone", "WAT (UTC+1)"],
      ["Window 1", "09:00 – 12:00"],
      ["Window 2", "14:00 – 17:30"],
      ["Send interval", "20 – 40 minutes (random)"],
      ["Max per day", "Controlled by scheduler"],
    ]},
    { section: "📞 WhatsApp", items: [
      ["Instance", "svdeeq-bot"],
      ["Evolution API", "evolution-api-production-17af.up.railway.app"],
      ["Admin number", "+2349035144812"],
      ["Webhook", "/webhook/whatsapp"],
    ]},
    { section: "🗄️ Infrastructure", items: [
      ["Backend", "FastAPI · Render (Python 3.11)"],
      ["Database", "Supabase (PostgreSQL + pgvector)"],
      ["Leads sync", "Google Sheets → Apps Script → /api/leads"],
      ["Repo", "github.com/svdeeq21/sadeeq-backend"],
    ]},
  ];

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: 28, background: colors.bgMain }}>
      <div style={{ fontSize: 22, fontWeight: 700, color: colors.ink, marginBottom: 6 }}>⚙️ Configuration</div>
      <div style={{ fontSize: 13, color: colors.inkD, marginBottom: 24 }}>System configuration reference — edit via Render environment variables</div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, maxWidth: 860 }}>
        {configs.map(({ section, items }) => (
          <div key={section} style={{ background: colors.bgCard, border: `1px solid ${colors.border}`, borderRadius: 12, overflow: "hidden" }}>
            <div style={{ padding: "12px 16px", background: colors.bgDeep, borderBottom: `1px solid ${colors.border}`, fontSize: 13, fontWeight: 700, color: colors.ink }}>{section}</div>
            {items.map(([key, value]) => (
              <div key={key} style={{ display: "flex", justifyContent: "space-between", padding: "9px 16px", borderBottom: `1px solid ${colors.border}`, gap: 12 }}>
                <span style={{ fontSize: 12.5, color: colors.inkD, flexShrink: 0 }}>{key}</span>
                <span style={{ fontSize: 12.5, color: colors.ink, fontWeight: 500, textAlign: "right", fontFamily: fonts.mono, wordBreak: "break-all" }}>{value}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Root
// ─────────────────────────────────────────────
export default function DashboardPage() {
  const [activePage, setActivePage] = useState<NavPage>("dashboard");
  const { leads, loading, error, togglePause, refresh } = useLeads();
  const { filteredLeads, filterStatus, setFilterStatus, searchQuery, setSearchQuery, counts } = useLeadFilter(leads);
  const [selectedId, setSelectedId]     = useState<string | null>(null);
  const [revealedPhones, setRevealedPhones] = useState<Record<string, boolean>>({});
  const effectiveId  = selectedId ?? leads[0]?.id ?? null;
  const selectedLead = leads.find(l => l.id === effectiveId) ?? null;
  const { messages, loading: msgsLoading } = useMessages(activePage === "dashboard" ? effectiveId : null);

  const togglePhone = () => { if (!effectiveId) return; setRevealedPhones(p => ({ ...p, [effectiveId]: !p[effectiveId] })); };

  if (loading) return <div style={{ height: "100vh", background: colors.bgDeep, display: "flex", alignItems: "center", justifyContent: "center", color: colors.inkD, fontSize: 14 }}>Loading…</div>;
  if (error)   return <div style={{ height: "100vh", background: colors.bgDeep, display: "flex", alignItems: "center", justifyContent: "center", color: colors.red, fontSize: 14, gap: 8 }}>{error} <button onClick={refresh} style={{ color: colors.accent, background: "none", border: "none", cursor: "pointer" }}>Retry</button></div>;
  if (!leads.length) return (
    <div style={{ height: "100vh", background: colors.bgDeep, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: colors.inkD, fontSize: 14, gap: 8 }}>
      <div style={{ fontSize: 48 }}>💬</div>
      <div>No leads yet.</div>
      <div style={{ fontSize: 12, color: colors.inkMuted }}>Add one via Google Sheets to get started.</div>
    </div>
  );

  return (
    <div style={{ height: "100vh", display: "flex", overflow: "hidden", background: colors.bgDeep }}>
      <IconRail activePage={activePage} setPage={setActivePage} />

      {/* Dashboard shows sidebar + chat + right panel */}
      {activePage === "dashboard" && (
        <>
          <LeadSidebar filteredLeads={filteredLeads} selectedLead={selectedLead} onSelect={l => setSelectedId(l.id)} filterStatus={filterStatus} setFilterStatus={setFilterStatus} searchQuery={searchQuery} setSearchQuery={setSearchQuery} counts={counts} />
          {selectedLead
            ? <ChatArea lead={selectedLead} messages={messages} loading={msgsLoading} onTogglePause={togglePause} showPhone={!!revealedPhones[effectiveId!]} onTogglePhone={togglePhone} />
            : <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: colors.inkD, fontSize: 14 }}>Select a lead</div>
          }
          {selectedLead && <RightPanel lead={selectedLead} />}
        </>
      )}

      {activePage === "analytics" && <AnalyticsPage leads={leads} />}
      {activePage === "outreach"  && <OutreachPage  leads={leads} />}
      {activePage === "settings"  && <SettingsPage />}
    </div>
  );
}

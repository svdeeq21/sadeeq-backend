"use client";
import { useEffect, useState, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Shell } from "@/components/layout/Shell";
import { StatusBadge, StateBadge, ScoreBar, Btn, Loading, Empty } from "@/components/ui";
import { colors, fonts, shadows } from "@/lib/tokens";
import { fetchLeads, fetchMessages, pauseLead } from "@/lib/api";
import { formatPhone, timeAgo } from "@/lib/constants";
import type { Lead, Message } from "@/types";

function ChatBubble({ msg }: { msg: Message }) {
  const isAI  = msg.sender === "AI";
  const isSys = msg.sender === "SYSTEM";
  const time  = new Date(msg.timestamp).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });

  if (isSys) return (
    <div style={{ display: "flex", justifyContent: "center", margin: "10px 0" }}>
      <div style={{
        padding: "4px 14px", borderRadius: 99,
        background: colors.amberBg, border: `1px solid ${colors.amber}25`,
        fontSize: 11.5, color: colors.amber, fontFamily: fonts.sans, fontWeight: 500,
      }}>
        ⚠ {msg.content}
      </div>
    </div>
  );

  return (
    <div style={{
      display: "flex", justifyContent: isAI ? "flex-start" : "flex-end",
      marginBottom: 14, gap: 8, alignItems: "flex-end",
      animation: "fade-in 0.2s ease",
    }}>
      {isAI && (
        <div style={{
          width: 30, height: 30, borderRadius: 8, flexShrink: 0,
          background: colors.accentBg, border: `1px solid ${colors.accent}20`,
          display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13,
        }}>🤖</div>
      )}
      <div style={{ maxWidth: "65%" }}>
        <div style={{
          padding: "10px 14px",
          borderRadius: isAI ? "4px 14px 14px 14px" : "14px 4px 14px 14px",
          background: isAI ? colors.surface : colors.accent,
          border: isAI ? `1px solid ${colors.border}` : "none",
          boxShadow: shadows.sm,
        }}>
          <div style={{ fontSize: 13.5, lineHeight: 1.55, color: isAI ? colors.ink : "#000", fontFamily: fonts.sans }}>
            {msg.content}
          </div>
        </div>
        <div style={{
          fontSize: 10.5, color: colors.inkD, fontFamily: fonts.mono, marginTop: 4,
          textAlign: isAI ? "left" : "right", paddingLeft: isAI ? 4 : 0, paddingRight: isAI ? 0 : 4,
          display: "flex", alignItems: "center", gap: 6, justifyContent: isAI ? "flex-start" : "flex-end",
        }}>
          {time}
          {isAI && msg.latency_ms && (
            <span style={{ color: colors.inkD }}>· {msg.latency_ms}ms</span>
          )}
        </div>
      </div>
      {!isAI && (
        <div style={{
          width: 30, height: 30, borderRadius: 8, flexShrink: 0,
          background: colors.surfaceC, border: `1px solid ${colors.border}`,
          display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13,
        }}>👤</div>
      )}
    </div>
  );
}

function ConversationsInner() {
  const params        = useSearchParams();
  const preselect     = params.get("lead");
  const [leads, setLeads]       = useState<Lead[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(preselect);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading]   = useState(true);
  const [msgLoading, setMsgLoading] = useState(false);
  const [search, setSearch]     = useState("");
  const chatRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchLeads().then(l => {
      setLeads(l);
      if (!selectedId && l.length > 0) setSelectedId(l[0].id);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    setMsgLoading(true);
    fetchMessages(selectedId).then(m => {
      setMessages(m);
      setMsgLoading(false);
      setTimeout(() => chatRef.current?.scrollTo({ top: 99999, behavior: "smooth" }), 100);
    });
  }, [selectedId]);

  const selectedLead = leads.find(l => l.id === selectedId);
  const filteredLeads = leads.filter(l => {
    const q = search.toLowerCase();
    return !q || l.name.toLowerCase().includes(q) || (l.business_name ?? "").toLowerCase().includes(q);
  });

  const handlePause = async () => {
    if (!selectedLead) return;
    await pauseLead(selectedLead.id, !selectedLead.ai_paused);
    setLeads(prev => prev.map(l => l.id === selectedLead.id ? { ...l, ai_paused: !l.ai_paused } : l));
  };

  return (
    <div style={{ display: "flex", height: "100%", overflow: "hidden" }}>

      {/* Lead list sidebar */}
      <div style={{
        width: 280, background: colors.surface,
        borderRight: `1px solid ${colors.border}`,
        display: "flex", flexDirection: "column", flexShrink: 0,
      }}>
        <div style={{ padding: "14px 12px 10px", borderBottom: `1px solid ${colors.border}` }}>
          <div style={{ position: "relative" }}>
            <span style={{ position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)", color: colors.inkD, fontSize: 13 }}>⌕</span>
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search leads…"
              style={{
                width: "100%", boxSizing: "border-box",
                background: colors.surfaceB, border: `1px solid ${colors.border}`,
                borderRadius: 7, padding: "7px 10px 7px 28px",
                fontSize: 12.5, color: colors.ink, fontFamily: fonts.sans, outline: "none",
              }}
            />
          </div>
        </div>
        <div style={{ overflowY: "auto", flex: 1 }}>
          {loading ? <Loading /> : filteredLeads.map(lead => {
            const active = lead.id === selectedId;
            return (
              <div key={lead.id} onClick={() => setSelectedId(lead.id)} style={{
                padding: "12px 14px", cursor: "pointer",
                borderBottom: `1px solid ${colors.border}`,
                background: active ? colors.accentBg : "transparent",
                borderLeft: `2px solid ${active ? colors.accent : "transparent"}`,
                transition: "background 0.1s",
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ fontSize: 13, fontWeight: active ? 600 : 500, color: active ? colors.accent : colors.ink, fontFamily: fonts.sans }}>
                    {lead.name}
                  </span>
                  <StatusBadge status={lead.status} />
                </div>
                <div style={{ fontSize: 11.5, color: colors.inkC, fontFamily: fonts.sans }}>
                  {lead.business_name ?? lead.industry ?? "—"}
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 5, alignItems: "center" }}>
                  {lead.conversation_state && <StateBadge state={lead.conversation_state} />}
                  <span style={{ fontSize: 10.5, color: colors.inkD, fontFamily: fonts.mono }}>
                    {timeAgo(lead.last_outreach_at ?? lead.created_at)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Chat panel */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        {selectedLead ? (
          <>
            {/* Chat header */}
            <div style={{
              padding: "12px 20px", background: colors.surface,
              borderBottom: `1px solid ${colors.border}`,
              display: "flex", alignItems: "center", justifyContent: "space-between",
              flexShrink: 0, boxShadow: shadows.sm,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{
                  width: 38, height: 38, borderRadius: 10, background: colors.surfaceC,
                  border: `1px solid ${colors.border}`, display: "flex",
                  alignItems: "center", justifyContent: "center",
                  fontSize: 16, color: colors.accent, fontFamily: fonts.mono,
                }}>
                  {selectedLead.name.charAt(0)}
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: colors.ink, fontFamily: fonts.sans }}>
                    {selectedLead.name}
                  </div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 2 }}>
                    <span style={{ fontSize: 11.5, color: colors.inkD, fontFamily: fonts.mono }}>
                      {formatPhone(selectedLead.phone_number)}
                    </span>
                    {selectedLead.conversation_state && <StateBadge state={selectedLead.conversation_state} />}
                    <ScoreBar score={selectedLead.interest_score ?? 0} />
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <Btn small variant={selectedLead.ai_paused ? "success" : "warning"} onClick={handlePause}>
                  {selectedLead.ai_paused ? "▶ Resume AI" : "⏸ Pause AI"}
                </Btn>
                <Btn small variant="ghost">↗ Export</Btn>
              </div>
            </div>

            {/* Messages */}
            <div ref={chatRef} style={{ flex: 1, overflowY: "auto", padding: "20px 24px", background: colors.bg }}>
              {msgLoading ? <Loading /> : messages.length === 0
                ? <Empty label="No messages recorded yet." />
                : messages.map(m => <ChatBubble key={m.id} msg={m} />)
              }
            </div>
          </>
        ) : (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Empty label="Select a lead to view their conversation." />
          </div>
        )}
      </div>
    </div>
  );
}

export default function ConversationsPage() {
  return (
    <Shell>
      <div style={{ height: "100%", overflow: "hidden" }}>
        <Suspense fallback={<Loading />}>
          <ConversationsInner />
        </Suspense>
      </div>
    </Shell>
  );
}

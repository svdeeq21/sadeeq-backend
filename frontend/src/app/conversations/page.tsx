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
      <div style={{ padding: "4px 14px", borderRadius: 99, background: colors.amberBg, border: `1px solid ${colors.amber}25`, fontSize: 11.5, color: colors.amber, fontFamily: fonts.sans, fontWeight: 500 }}>
        ⚠ {msg.content}
      </div>
    </div>
  );

  return (
    <div style={{ display: "flex", justifyContent: isAI ? "flex-start" : "flex-end", marginBottom: 14, gap: 8, alignItems: "flex-end" }}>
      {isAI && (
        <div style={{ width: 30, height: 30, borderRadius: 8, flexShrink: 0, background: colors.accentBg, border: `1px solid ${colors.accent}20`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13 }}>🤖</div>
      )}
      <div style={{ maxWidth: "65%" }}>
        <div style={{ padding: "10px 14px", borderRadius: isAI ? "4px 14px 14px 14px" : "14px 4px 14px 14px", background: isAI ? colors.surface : colors.accent, border: isAI ? `1px solid ${colors.border}` : "none", boxShadow: shadows.sm }}>
          <div style={{ fontSize: 13.5, lineHeight: 1.55, color: isAI ? colors.ink : "#000", fontFamily: fonts.sans }}>{msg.content}</div>
        </div>
        <div style={{ fontSize: 10.5, color: colors.inkD, fontFamily: fonts.mono, marginTop: 4, display: "flex", gap: 6, justifyContent: isAI ? "flex-start" : "flex-end" }}>
          {time}{isAI && msg.latency_ms && <span>· {msg.latency_ms}ms</span>}
        </div>
      </div>
      {!isAI && (
        <div style={{ width: 30, height: 30, borderRadius: 8, flexShrink: 0, background: colors.surfaceC, border: `1px solid ${colors.border}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13 }}>👤</div>
      )}
    </div>
  );
}

function IntelPanel({ lead }: { lead: Lead }) {
  const hasAnalysis = !!(lead.pain_point || lead.opportunity_analysis || lead.suggested_solutions?.length);

  return (
    <div style={{ width: 280, background: colors.surface, borderLeft: `1px solid ${colors.border}`, display: "flex", flexDirection: "column", flexShrink: 0, overflowY: "auto" }}>
      <div style={{ padding: "13px 16px", borderBottom: `1px solid ${colors.border}`, fontSize: 10.5, fontWeight: 600, color: colors.inkD, textTransform: "uppercase", letterSpacing: "0.08em", fontFamily: fonts.mono, display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ color: colors.accent }}>◉</span> Lead Intel
      </div>

      <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: 14 }}>

        {/* Score + Stage */}
        <div style={{ background: colors.surfaceB, borderRadius: 9, padding: "12px 14px", border: `1px solid ${colors.border}` }}>
          <div style={{ marginBottom: lead.conversation_state ? 10 : 0 }}>
            <div style={{ fontSize: 10, color: colors.inkD, fontFamily: fonts.mono, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 5 }}>Interest Score</div>
            <ScoreBar score={lead.interest_score ?? 0} />
          </div>
          {lead.conversation_state && (
            <div>
              <div style={{ fontSize: 10, color: colors.inkD, fontFamily: fonts.mono, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 5, marginTop: 8 }}>Stage</div>
              <StateBadge state={lead.conversation_state} />
            </div>
          )}
        </div>

        {hasAnalysis ? (
          <>
            {lead.pain_point && (
              <div>
                <div style={{ fontSize: 10, fontWeight: 600, color: colors.amber, textTransform: "uppercase", letterSpacing: "0.07em", fontFamily: fonts.mono, marginBottom: 7 }}>⚡ Predicted Pain Point</div>
                <div style={{ background: colors.amberBg, border: `1px solid ${colors.amber}20`, borderRadius: 8, padding: "10px 12px", fontSize: 12.5, color: colors.inkB, fontFamily: fonts.sans, lineHeight: 1.6 }}>
                  {lead.pain_point}
                </div>
              </div>
            )}

            {lead.suggested_solutions && lead.suggested_solutions.length > 0 && (
              <div>
                <div style={{ fontSize: 10, fontWeight: 600, color: colors.accent, textTransform: "uppercase", letterSpacing: "0.07em", fontFamily: fonts.mono, marginBottom: 7 }}>◈ Solutions to Pitch</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {lead.suggested_solutions.map((sol, i) => (
                    <div key={i} style={{ background: colors.accentBg, border: `1px solid ${colors.accent}15`, borderRadius: 8, padding: "9px 11px", fontSize: 12, color: colors.inkB, fontFamily: fonts.sans, lineHeight: 1.55, display: "flex", gap: 8 }}>
                      <span style={{ color: colors.accent, fontFamily: fonts.mono, flexShrink: 0, fontSize: 11 }}>{i + 1}.</span>
                      {sol}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {lead.opportunity_analysis && (
              <div>
                <div style={{ fontSize: 10, fontWeight: 600, color: colors.inkD, textTransform: "uppercase", letterSpacing: "0.07em", fontFamily: fonts.mono, marginBottom: 7 }}>Business Context</div>
                <div style={{ fontSize: 12, color: colors.inkC, fontFamily: fonts.sans, lineHeight: 1.65, borderLeft: `2px solid ${colors.border}`, paddingLeft: 10 }}>
                  {lead.opportunity_analysis}
                </div>
              </div>
            )}

            {lead.analysis_generated_at && (
              <div style={{ fontSize: 10.5, color: colors.inkD, fontFamily: fonts.mono }}>
                Analyzed {timeAgo(lead.analysis_generated_at)}
              </div>
            )}
          </>
        ) : (
          <div style={{ background: colors.surfaceB, border: `1px dashed ${colors.border}`, borderRadius: 8, padding: "16px 14px", textAlign: "center" }}>
            <div style={{ fontSize: 12, color: colors.inkD, fontFamily: fonts.sans, lineHeight: 1.7 }}>
              No analysis yet.<br />
              <span style={{ fontSize: 11 }}>Generated automatically before first message.</span>
            </div>
          </div>
        )}

        {lead.objections && lead.objections.length > 0 && (
          <div>
            <div style={{ fontSize: 10, fontWeight: 600, color: colors.red, textTransform: "uppercase", letterSpacing: "0.07em", fontFamily: fonts.mono, marginBottom: 7 }}>⊘ Objections Logged</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              {lead.objections.map((obj, i) => (
                <div key={i} style={{ background: colors.redBg, border: `1px solid ${colors.red}15`, borderRadius: 7, padding: "8px 10px", fontSize: 11.5, color: colors.inkC, fontFamily: fonts.sans, lineHeight: 1.5 }}>
                  "{obj}"
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Lead meta */}
        <div style={{ borderTop: `1px solid ${colors.border}`, paddingTop: 14 }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: colors.inkD, textTransform: "uppercase", letterSpacing: "0.07em", fontFamily: fonts.mono, marginBottom: 10 }}>Lead Info</div>
          {[
            { label: "Business", value: lead.business_name },
            { label: "Industry", value: lead.industry },
            { label: "Location", value: lead.location },
            { label: "Follow-ups", value: lead.follow_up_count != null ? String(lead.follow_up_count) : undefined },
            { label: "Added", value: timeAgo(lead.created_at) },
          ].filter(r => r.value).map(row => (
            <div key={row.label} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", fontSize: 12, fontFamily: fonts.sans }}>
              <span style={{ color: colors.inkD }}>{row.label}</span>
              <span style={{ color: colors.inkB, textAlign: "right", maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.value}</span>
            </div>
          ))}
        </div>

        <a href={`https://wa.me/${lead.phone_number}`} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none" }}>
          <Btn variant="success" small>↗ Open in WhatsApp</Btn>
        </a>
      </div>
    </div>
  );
}

function ConversationsInner() {
  const params    = useSearchParams();
  const preselect = params.get("lead");
  const [leads, setLeads]         = useState<Lead[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(preselect);
  const [messages, setMessages]   = useState<Message[]>([]);
  const [loading, setLoading]     = useState(true);
  const [msgLoading, setMsgLoading] = useState(false);
  const [search, setSearch]       = useState("");
  const [showIntel, setShowIntel] = useState(true);
  const chatRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchLeads().then(l => { setLeads(l); if (!selectedId && l.length > 0) setSelectedId(l[0].id); setLoading(false); });
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    setMsgLoading(true);
    fetchMessages(selectedId).then(m => { setMessages(m); setMsgLoading(false); setTimeout(() => chatRef.current?.scrollTo({ top: 99999, behavior: "smooth" }), 100); });
  }, [selectedId]);

  const selectedLead  = leads.find(l => l.id === selectedId);
  const filteredLeads = leads.filter(l => { const q = search.toLowerCase(); return !q || l.name.toLowerCase().includes(q) || (l.business_name ?? "").toLowerCase().includes(q); });

  const handlePause = async () => {
    if (!selectedLead) return;
    await pauseLead(selectedLead.id, !selectedLead.ai_paused);
    setLeads(prev => prev.map(l => l.id === selectedLead.id ? { ...l, ai_paused: !l.ai_paused } : l));
  };

  return (
    <div style={{ display: "flex", height: "100%", overflow: "hidden" }}>

      {/* Lead list */}
      <div style={{ width: 270, background: colors.surface, borderRight: `1px solid ${colors.border}`, display: "flex", flexDirection: "column", flexShrink: 0 }}>
        <div style={{ padding: "12px 12px 10px", borderBottom: `1px solid ${colors.border}` }}>
          <div style={{ position: "relative" }}>
            <span style={{ position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)", color: colors.inkD, fontSize: 13 }}>⌕</span>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search leads…"
              style={{ width: "100%", boxSizing: "border-box", background: colors.surfaceB, border: `1px solid ${colors.border}`, borderRadius: 7, padding: "7px 10px 7px 28px", fontSize: 12.5, color: colors.ink, fontFamily: fonts.sans, outline: "none" }} />
          </div>
        </div>
        <div style={{ overflowY: "auto", flex: 1 }}>
          {loading ? <Loading /> : filteredLeads.map(lead => {
            const active    = lead.id === selectedId;
            const hasIntel  = !!(lead.pain_point || lead.opportunity_analysis);
            return (
              <div key={lead.id} onClick={() => setSelectedId(lead.id)} style={{ padding: "11px 13px", cursor: "pointer", borderBottom: `1px solid ${colors.border}`, background: active ? colors.accentBg : "transparent", borderLeft: `2px solid ${active ? colors.accent : "transparent"}`, transition: "background 0.1s" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 3 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                    <span style={{ fontSize: 13, fontWeight: active ? 600 : 500, color: active ? colors.accent : colors.ink, fontFamily: fonts.sans }}>{lead.name}</span>
                    {hasIntel && <span style={{ width: 5, height: 5, borderRadius: "50%", background: colors.accent, display: "inline-block", flexShrink: 0 }} />}
                  </div>
                  <StatusBadge status={lead.status} />
                </div>
                <div style={{ fontSize: 11.5, color: colors.inkC, fontFamily: fonts.sans, marginBottom: 3 }}>{lead.business_name ?? lead.industry ?? "—"}</div>
                {lead.pain_point && (
                  <div style={{ fontSize: 11, color: colors.inkD, fontFamily: fonts.sans, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontStyle: "italic", marginBottom: 4 }}>
                    ⚡ {lead.pain_point.slice(0, 48)}…
                  </div>
                )}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  {lead.conversation_state ? <StateBadge state={lead.conversation_state} /> : <span />}
                  <span style={{ fontSize: 10.5, color: colors.inkD, fontFamily: fonts.mono }}>{timeAgo(lead.last_outreach_at ?? lead.created_at)}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Chat */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        {selectedLead ? (
          <>
            <div style={{ padding: "10px 18px", background: colors.surface, borderBottom: `1px solid ${colors.border}`, display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0, boxShadow: shadows.sm }}>
              <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
                <div style={{ width: 36, height: 36, borderRadius: 9, background: colors.surfaceC, border: `1px solid ${colors.border}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, color: colors.accent, fontFamily: fonts.mono, flexShrink: 0 }}>
                  {selectedLead.name.charAt(0)}
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: colors.ink, fontFamily: fonts.sans }}>{selectedLead.name}</div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 2 }}>
                    <span style={{ fontSize: 11, color: colors.inkD, fontFamily: fonts.mono }}>{formatPhone(selectedLead.phone_number)}</span>
                    {selectedLead.conversation_state && <StateBadge state={selectedLead.conversation_state} />}
                    <ScoreBar score={selectedLead.interest_score ?? 0} />
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <Btn small variant={selectedLead.ai_paused ? "success" : "warning"} onClick={handlePause}>
                  {selectedLead.ai_paused ? "▶ Resume AI" : "⏸ Pause AI"}
                </Btn>
                <Btn small variant={showIntel ? "primary" : "ghost"} onClick={() => setShowIntel(p => !p)}>
                  ◉ Intel
                </Btn>
              </div>
            </div>

            <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
              <div ref={chatRef} style={{ flex: 1, overflowY: "auto", padding: "18px 22px", background: colors.bg }}>
                {msgLoading ? <Loading /> : messages.length === 0 ? <Empty label="No messages yet." /> : messages.map(m => <ChatBubble key={m.id} msg={m} />)}
              </div>
              {showIntel && <IntelPanel lead={selectedLead} />}
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

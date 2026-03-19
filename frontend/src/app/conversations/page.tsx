"use client";
import { useEffect, useState, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Shell } from "@/components/layout/Shell";
import { StatusBadge, StateBadge, ScoreBar, Btn, Loading, Empty } from "@/components/ui";
import { colors, fonts, shadows, radius } from "@/lib/tokens";
import { fetchLeads, fetchMessages, pauseLead } from "@/lib/api";
import { formatPhone, timeAgo } from "@/lib/constants";
import type { Lead, Message } from "@/types";

function ChatBubble({ msg }: { msg: Message }) {
  const isAI  = msg.sender === "AI";
  const isSys = msg.sender === "SYSTEM";
  const time  = new Date(msg.timestamp).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
  if (isSys) return (
    <div style={{ display: "flex", justifyContent: "center", margin: "10px 0" }}>
      <div style={{ padding: "4px 12px", borderRadius: 99, background: colors.amberBg, border: `1px solid ${colors.amber}20`, fontSize: 11, color: colors.amber, fontFamily: fonts.sans }}>
        {msg.content}
      </div>
    </div>
  );
  return (
    <div style={{ display: "flex", justifyContent: isAI ? "flex-start" : "flex-end", marginBottom: 12, gap: 8, alignItems: "flex-end" }}>
      {isAI && <div style={{ width: 26, height: 26, borderRadius: radius.sm, flexShrink: 0, background: colors.surfaceC, border: `1px solid ${colors.border}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12 }}>🤖</div>}
      <div style={{ maxWidth: "72%" }}>
        <div style={{ padding: "9px 13px", borderRadius: isAI ? "3px 12px 12px 12px" : "12px 3px 12px 12px", background: isAI ? colors.surface : colors.ink, border: isAI ? `1px solid ${colors.border}` : "none" }}>
          <div style={{ fontSize: 13, lineHeight: 1.55, color: isAI ? colors.ink : colors.bg, fontFamily: fonts.sans }}>{msg.content}</div>
        </div>
        <div style={{ fontSize: 10, color: colors.inkD, fontFamily: fonts.mono, marginTop: 3, textAlign: isAI ? "left" : "right" }}>
          {time}{isAI && msg.latency_ms ? ` · ${msg.latency_ms}ms` : ""}
        </div>
      </div>
      {!isAI && <div style={{ width: 26, height: 26, borderRadius: radius.sm, flexShrink: 0, background: colors.surfaceC, border: `1px solid ${colors.border}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12 }}>👤</div>}
    </div>
  );
}

function IntelPanel({ lead, onClose }: { lead: Lead; onClose?: () => void }) {
  return (
    <div style={{ width: "100%", background: colors.surface, display: "flex", flexDirection: "column", overflowY: "auto", borderLeft: `1px solid ${colors.border}` }}>
      <div style={{ padding: "11px 14px", borderBottom: `1px solid ${colors.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 10, fontWeight: 500, color: colors.inkD, textTransform: "uppercase", letterSpacing: "0.07em", fontFamily: fonts.mono }}>Lead Intel</span>
        {onClose && <button onClick={onClose} style={{ background: "none", border: "none", color: colors.inkC, cursor: "pointer", fontSize: 14, padding: 0 }}>✕</button>}
      </div>
      <div style={{ padding: "14px", display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ background: colors.surfaceB, borderRadius: radius.md, padding: "12px", border: `1px solid ${colors.border}` }}>
          <div style={{ fontSize: 10, color: colors.inkD, fontFamily: fonts.mono, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Score</div>
          <ScoreBar score={lead.interest_score ?? 0} />
          {lead.conversation_state && <>
            <div style={{ fontSize: 10, color: colors.inkD, fontFamily: fonts.mono, textTransform: "uppercase", letterSpacing: "0.06em", marginTop: 10, marginBottom: 6 }}>Stage</div>
            <StateBadge state={lead.conversation_state} />
          </>}
        </div>

        {lead.pain_point && (
          <div>
            <div style={{ fontSize: 10, color: colors.amber, fontFamily: fonts.mono, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Pain Point</div>
            <div style={{ background: colors.amberBg, border: `1px solid ${colors.amber}18`, borderRadius: radius.md, padding: "9px 11px", fontSize: 12, color: colors.inkB, fontFamily: fonts.sans, lineHeight: 1.6 }}>
              {lead.pain_point}
            </div>
          </div>
        )}

        {lead.suggested_solutions?.length ? (
          <div>
            <div style={{ fontSize: 10, color: colors.inkC, fontFamily: fonts.mono, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Solutions</div>
            {lead.suggested_solutions.map((s, i) => (
              <div key={i} style={{ padding: "7px 10px", background: colors.surfaceB, borderRadius: radius.sm, marginBottom: 5, fontSize: 11.5, color: colors.inkB, fontFamily: fonts.sans, lineHeight: 1.5, display: "flex", gap: 7 }}>
                <span style={{ color: colors.inkD, fontFamily: fonts.mono, flexShrink: 0 }}>{i+1}.</span>{s}
              </div>
            ))}
          </div>
        ) : null}

        {lead.objections?.length ? (
          <div>
            <div style={{ fontSize: 10, color: colors.red, fontFamily: fonts.mono, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Objections</div>
            {lead.objections.map((o, i) => (
              <div key={i} style={{ padding: "7px 10px", background: colors.redBg, borderRadius: radius.sm, marginBottom: 5, fontSize: 11.5, color: colors.inkC, fontFamily: fonts.sans }}>"{o}"</div>
            ))}
          </div>
        ) : null}

        <div style={{ borderTop: `1px solid ${colors.border}`, paddingTop: 12 }}>
          {[
            { l: "Business",  v: lead.business_name },
            { l: "Industry",  v: lead.industry },
            { l: "Location",  v: lead.location },
            { l: "Added",     v: timeAgo(lead.created_at) },
          ].filter(r => r.v).map(r => (
            <div key={r.l} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", fontSize: 11.5 }}>
              <span style={{ color: colors.inkD }}>{r.l}</span>
              <span style={{ color: colors.inkB, maxWidth: 130, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textAlign: "right" }}>{r.v}</span>
            </div>
          ))}
        </div>
        <a href={`https://wa.me/${lead.phone_number}`} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none" }}>
          <Btn variant="success" small>↗ WhatsApp</Btn>
        </a>
      </div>
    </div>
  );
}

function ConversationsInner() {
  const params    = useSearchParams();
  const preselect = params.get("lead");
  const [leads, setLeads]           = useState<Lead[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(preselect);
  const [messages, setMessages]     = useState<Message[]>([]);
  const [loading, setLoading]       = useState(true);
  const [msgLoading, setMsgLoading] = useState(false);
  const [search, setSearch]         = useState("");
  const [view, setView]             = useState<"list"|"chat"|"intel">("list");
  const [showIntel, setShowIntel]   = useState(false);
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

  const handleSelect = (id: string) => { setSelectedId(id); setView("chat"); setShowIntel(false); };
  const handlePause  = async () => {
    if (!selectedLead) return;
    await pauseLead(selectedLead.id, !selectedLead.ai_paused);
    setLeads(prev => prev.map(l => l.id === selectedLead.id ? { ...l, ai_paused: !l.ai_paused } : l));
  };

  // Lead list panel
  const LeadList = (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: colors.surface }}>
      <div style={{ padding: "10px 12px", borderBottom: `1px solid ${colors.border}` }}>
        <div style={{ position: "relative" }}>
          <span style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)", color: colors.inkD, fontSize: 12 }}>⌕</span>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search leads…"
            style={{ width: "100%", boxSizing: "border-box", background: colors.surfaceB, border: `1px solid ${colors.border}`, borderRadius: radius.md, padding: "7px 10px 7px 26px", fontSize: 12.5, color: colors.ink, fontFamily: fonts.sans, outline: "none" }} />
        </div>
      </div>
      <div style={{ overflowY: "auto", flex: 1 }}>
        {loading ? <Loading /> : filteredLeads.map(lead => {
          const active = lead.id === selectedId;
          return (
            <div key={lead.id} onClick={() => handleSelect(lead.id)} style={{ padding: "10px 12px", cursor: "pointer", borderBottom: `1px solid ${colors.border}`, background: active ? colors.surfaceC : "transparent", borderLeft: `2px solid ${active ? colors.ink : "transparent"}`, transition: "background 0.1s" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                <span style={{ fontSize: 13, fontWeight: active ? 600 : 500, color: colors.ink, fontFamily: fonts.sans, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1, marginRight: 8 }}>{lead.name}</span>
                <StatusBadge status={lead.status} />
              </div>
              <div style={{ fontSize: 11.5, color: colors.inkC, marginBottom: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{lead.business_name ?? lead.industry ?? "—"}</div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                {lead.conversation_state ? <StateBadge state={lead.conversation_state} /> : <span />}
                <span style={{ fontSize: 10.5, color: colors.inkD, fontFamily: fonts.mono }}>{timeAgo(lead.last_outreach_at ?? lead.created_at)}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  // Chat panel
  const ChatPanel = selectedLead ? (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ padding: "10px 14px", background: colors.surface, borderBottom: `1px solid ${colors.border}`, display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
        <button onClick={() => setView("list")} className="mobile-back" style={{ background: "none", border: "none", color: colors.inkC, cursor: "pointer", fontSize: 16, padding: "0 4px 0 0", display: "none" }}>←</button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13.5, fontWeight: 600, color: colors.ink, fontFamily: fonts.sans, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{selectedLead.name}</div>
          <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 2 }}>
            <span style={{ fontSize: 10.5, color: colors.inkD, fontFamily: fonts.mono }}>{formatPhone(selectedLead.phone_number)}</span>
            {selectedLead.conversation_state && <StateBadge state={selectedLead.conversation_state} />}
          </div>
        </div>
        <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
          <Btn small variant={selectedLead.ai_paused ? "success" : "warning"} onClick={handlePause}>
            {selectedLead.ai_paused ? "▶" : "⏸"}
          </Btn>
          <Btn small variant={showIntel ? "primary" : "ghost"} onClick={() => { setShowIntel(p => !p); setView(showIntel ? "chat" : "intel"); }}>
            Intel
          </Btn>
        </div>
      </div>
      <div ref={chatRef} style={{ flex: 1, overflowY: "auto", padding: "14px 16px", background: colors.bg }}>
        {msgLoading ? <Loading /> : messages.length === 0 ? <Empty label="No messages yet." /> : messages.map(m => <ChatBubble key={m.id} msg={m} />)}
      </div>
    </div>
  ) : <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}><Empty label="Select a lead." /></div>;

  return (
    <>
      {/* Desktop: 3-column layout */}
      <div className="conv-desktop" style={{ display: "flex", height: "100%", overflow: "hidden" }}>
        <div style={{ width: 250, borderRight: `1px solid ${colors.border}`, flexShrink: 0, overflow: "hidden" }}>{LeadList}</div>
        <div style={{ flex: 1, minWidth: 0, overflow: "hidden" }}>{ChatPanel}</div>
        {showIntel && selectedLead && (
          <div style={{ width: 260, borderLeft: `1px solid ${colors.border}`, flexShrink: 0, overflow: "hidden" }}>
            <IntelPanel lead={selectedLead} onClose={() => setShowIntel(false)} />
          </div>
        )}
      </div>

      {/* Mobile: single column, navigate between views */}
      <div className="conv-mobile" style={{ display: "none", height: "100%", overflow: "hidden" }}>
        {view === "list"  && <div style={{ height: "100%" }}>{LeadList}</div>}
        {view === "chat"  && <div style={{ height: "100%" }}>{ChatPanel}</div>}
        {view === "intel" && selectedLead && (
          <div style={{ height: "100%", overflow: "auto" }}>
            <IntelPanel lead={selectedLead} onClose={() => setView("chat")} />
          </div>
        )}
      </div>

      <style>{`
        @media (min-width: 768px) {
          .conv-desktop { display: flex !important; }
          .conv-mobile  { display: none !important; }
        }
        @media (max-width: 767px) {
          .conv-desktop { display: none !important; }
          .conv-mobile  { display: block !important; }
          .mobile-back  { display: block !important; }
        }
      `}</style>
    </>
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

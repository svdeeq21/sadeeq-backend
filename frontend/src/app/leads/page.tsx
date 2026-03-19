"use client";
import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { Shell } from "@/components/layout/Shell";
import { StatusBadge, StateBadge, ScoreBar, Btn, Card, Loading, Empty, SectionHeader } from "@/components/ui";
import { colors, fonts, radius } from "@/lib/tokens";
import { fetchLeads, pauseLead } from "@/lib/api";
import { STATUS_CONFIG, formatPhone, timeAgo } from "@/lib/constants";
import type { Lead, LeadStatus } from "@/types";

const STATUSES: (LeadStatus | "ALL")[] = ["ALL","PENDING","OUTREACH_SENT","AI_RESPONDED","BOOKED","HUMAN_REQUIRED","AI_PAUSED","OPTED_OUT","INVALID_NUMBER"];

function LeadCard({ lead, onPause, revealed, onReveal }: { lead: Lead; onPause: () => void; revealed: boolean; onReveal: () => void }) {
  return (
    <div style={{ padding: "13px 16px", borderBottom: `1px solid ${colors.border}` }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
        <div style={{ flex: 1, minWidth: 0, marginRight: 10 }}>
          <Link href={`/conversations?lead=${lead.id}`} style={{ textDecoration: "none" }}>
            <div style={{ fontSize: 13.5, fontWeight: 600, color: colors.ink, fontFamily: fonts.sans, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{lead.name}</div>
          </Link>
          {lead.business_name && <div style={{ fontSize: 12, color: colors.inkC, marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{lead.business_name}</div>}
        </div>
        <StatusBadge status={lead.status} />
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
        {lead.conversation_state && <StateBadge state={lead.conversation_state} />}
        <ScoreBar score={lead.interest_score ?? 0} />
        <span style={{ fontSize: 10.5, color: colors.inkD, fontFamily: fonts.mono, marginLeft: "auto" }}>{timeAgo(lead.last_outreach_at ?? lead.created_at)}</span>
      </div>

      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
        <span style={{ fontSize: 11, color: colors.inkD, fontFamily: fonts.mono }}>
          {revealed ? formatPhone(lead.phone_number, true) : formatPhone(lead.phone_number)}
        </span>
        <button onClick={onReveal} style={{ background: "none", border: "none", color: colors.inkC, fontSize: 11, cursor: "pointer", padding: 0 }}>
          {revealed ? "hide" : "show"}
        </button>
        <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
          <Btn small variant={lead.ai_paused ? "success" : "warning"} onClick={onPause}>
            {lead.ai_paused ? "▶" : "⏸"}
          </Btn>
          <Link href={`/conversations?lead=${lead.id}`} style={{ textDecoration: "none" }}>
            <Btn small variant="ghost">View</Btn>
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function LeadsPage() {
  const [leads, setLeads]       = useState<Lead[]>([]);
  const [loading, setLoading]   = useState(true);
  const [filter, setFilter]     = useState<string>("ALL");
  const [search, setSearch]     = useState("");
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});

  const load = () => { setLoading(true); fetchLeads().then(l => { setLeads(l); setLoading(false); }).catch(() => setLoading(false)); };
  useEffect(load, []);

  const filtered = useMemo(() => leads.filter(l => {
    const matchStatus = filter === "ALL" || l.status === filter;
    const q = search.toLowerCase();
    return matchStatus && (!q || l.name.toLowerCase().includes(q) || (l.business_name ?? "").toLowerCase().includes(q) || (l.phone_number ?? "").includes(q));
  }), [leads, filter, search]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { ALL: leads.length };
    leads.forEach(l => { c[l.status] = (c[l.status] ?? 0) + 1; });
    return c;
  }, [leads]);

  return (
    <Shell>
      <div style={{ padding: "16px", maxWidth: 900, margin: "0 auto" }}>
        <SectionHeader title="Leads" sub={`${leads.length} total`} action={<Btn variant="ghost" small onClick={load}>↻</Btn>} />

        {/* Search */}
        <div style={{ position: "relative", marginBottom: 12 }}>
          <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: colors.inkD, fontSize: 13 }}>⌕</span>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name, business, phone…"
            style={{ width: "100%", boxSizing: "border-box", background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: radius.md, padding: "8px 12px 8px 30px", fontSize: 13, color: colors.ink, fontFamily: fonts.sans, outline: "none" }} />
        </div>

        {/* Filter pills — scrollable on mobile */}
        <div style={{ display: "flex", gap: 6, marginBottom: 16, overflowX: "auto", paddingBottom: 4 }}>
          {["ALL", "PENDING", "OUTREACH_SENT", "AI_RESPONDED", "BOOKED", "HUMAN_REQUIRED", "AI_PAUSED"].map(s => {
            const active = filter === s;
            const cfg    = s !== "ALL" ? STATUS_CONFIG[s as LeadStatus] : null;
            return (
              <button key={s} onClick={() => setFilter(s)} style={{
                padding: "5px 10px", borderRadius: radius.full, cursor: "pointer", flexShrink: 0,
                fontFamily: fonts.mono, fontSize: 11,
                border: `1px solid ${active ? colors.borderC : colors.border}`,
                background: active ? colors.surfaceC : "transparent",
                color: active ? colors.ink : colors.inkC,
                transition: "all 0.12s", whiteSpace: "nowrap",
              }}>
                {s === "ALL" ? "All" : cfg?.label ?? s} · {counts[s] ?? 0}
              </button>
            );
          })}
        </div>

        {/* Lead list — card-based, works on all screen sizes */}
        <Card style={{ overflow: "hidden" }}>
          {loading ? <Loading /> : filtered.length === 0 ? <Empty label="No leads match your filters." /> :
            filtered.map(lead => (
              <LeadCard
                key={lead.id} lead={lead}
                onPause={async () => { await pauseLead(lead.id, !lead.ai_paused); setLeads(prev => prev.map(l => l.id === lead.id ? { ...l, ai_paused: !l.ai_paused } : l)); }}
                revealed={!!revealed[lead.id]}
                onReveal={() => setRevealed(p => ({ ...p, [lead.id]: !p[lead.id] }))}
              />
            ))
          }
        </Card>
      </div>
    </Shell>
  );
}

"use client";
import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { Shell } from "@/components/layout/Shell";
import { StatusBadge, StateBadge, HeatBadge, ScoreBar, Btn, Card, Loading, Empty, SectionHeader } from "@/components/ui";
import { colors, fonts, shadows } from "@/lib/tokens";
import { fetchLeads, pauseLead } from "@/lib/api";
import { STATUS_CONFIG, formatPhone, timeAgo } from "@/lib/constants";
import type { Lead, LeadStatus } from "@/types";

const STATUSES: (LeadStatus | "ALL")[] = ["ALL", "PENDING", "OUTREACH_SENT", "AI_RESPONDED", "BOOKED", "HUMAN_REQUIRED", "AI_PAUSED", "OPTED_OUT", "INVALID_NUMBER"];

export default function LeadsPage() {
  const [leads, setLeads]       = useState<Lead[]>([]);
  const [loading, setLoading]   = useState(true);
  const [filter, setFilter]     = useState<string>("ALL");
  const [search, setSearch]     = useState("");
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});

  const load = () => {
    setLoading(true);
    fetchLeads().then(l => { setLeads(l); setLoading(false); }).catch(() => setLoading(false));
  };
  useEffect(load, []);

  const filtered = useMemo(() => leads.filter(l => {
    const matchStatus = filter === "ALL" || l.status === filter;
    const q = search.toLowerCase();
    const matchSearch = !q || l.name.toLowerCase().includes(q)
      || (l.business_name ?? "").toLowerCase().includes(q)
      || (l.phone_number ?? "").includes(q);
    return matchStatus && matchSearch;
  }), [leads, filter, search]);

  const counts: Record<string, number> = useMemo(() => {
    const c: Record<string, number> = { ALL: leads.length };
    leads.forEach(l => { c[l.status] = (c[l.status] ?? 0) + 1; });
    return c;
  }, [leads]);

  const handlePause = async (id: string, paused: boolean) => {
    await pauseLead(id, !paused);
    setLeads(prev => prev.map(l => l.id === id ? { ...l, ai_paused: !paused } : l));
  };

  const colStyle = (w: number | string): React.CSSProperties => ({
    width: typeof w === "number" ? w : undefined,
    flexShrink: 0, padding: "0 12px",
    fontSize: 12.5, color: colors.inkB, fontFamily: fonts.sans,
  });

  const headStyle = (w: number | string): React.CSSProperties => ({
    ...colStyle(w),
    fontSize: 10.5, fontWeight: 600, color: colors.inkD,
    textTransform: "uppercase", letterSpacing: "0.07em", fontFamily: fonts.mono,
  });

  return (
    <Shell>
      <div style={{ padding: "28px 32px" }}>
        <SectionHeader
          title="Leads"
          sub={`${leads.length} total leads in system`}
          action={<Btn variant="primary" onClick={load}>↻ Refresh</Btn>}
        />

        {/* Filters */}
        <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ position: "relative", marginRight: 8 }}>
            <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: colors.inkD, fontSize: 13 }}>⌕</span>
            <input
              value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search name, business, phone…"
              style={{
                background: colors.surface, border: `1px solid ${colors.border}`,
                borderRadius: 7, padding: "7px 12px 7px 30px",
                fontSize: 12.5, color: colors.ink, fontFamily: fonts.sans,
                outline: "none", width: 240,
              }}
            />
          </div>
          {STATUSES.map(s => {
            const active = filter === s;
            const cfg = s !== "ALL" ? STATUS_CONFIG[s] : null;
            return (
              <button key={s} onClick={() => setFilter(s)} style={{
                padding: "5px 10px", borderRadius: 6, cursor: "pointer",
                fontFamily: fonts.mono, fontSize: 11, fontWeight: active ? 600 : 400,
                border: `1px solid ${active ? colors.accent + "50" : colors.border}`,
                background: active ? colors.accentBg : "transparent",
                color: active ? colors.accent : colors.inkC,
                transition: "all 0.13s",
              }}>
                {s === "ALL" ? "All" : (cfg?.label ?? s)} · {counts[s] ?? 0}
              </button>
            );
          })}
        </div>

        {/* Table */}
        <Card>
          {/* Header */}
          <div style={{
            display: "flex", alignItems: "center",
            padding: "10px 0", borderBottom: `1px solid ${colors.border}`,
            background: colors.surfaceB, borderRadius: "12px 12px 0 0",
          }}>
            <div style={headStyle(200)}>Name</div>
            <div style={headStyle(160)}>Business</div>
            <div style={headStyle(130)}>Phone</div>
            <div style={headStyle(120)}>Status</div>
            <div style={headStyle(100)}>Stage</div>
            <div style={headStyle(110)}>Score</div>
            <div style={headStyle(90)}>Last Seen</div>
            <div style={{ ...headStyle(130), marginLeft: "auto" }}>Actions</div>
          </div>

          {loading ? <Loading /> : filtered.length === 0 ? <Empty label="No leads match your filters." /> : (
            <div style={{ overflowY: "auto", maxHeight: "calc(100vh - 280px)" }}>
              {filtered.map((lead, i) => (
                <div key={lead.id} style={{
                  display: "flex", alignItems: "center",
                  padding: "12px 0",
                  borderBottom: i < filtered.length - 1 ? `1px solid ${colors.border}` : "none",
                  transition: "background 0.1s",
                }}>
                  <div style={{ ...colStyle(200), fontWeight: 500, color: colors.ink }}>
                    <Link href={`/conversations?lead=${lead.id}`} style={{ color: colors.ink, textDecoration: "none", fontFamily: fonts.sans }}>
                      {lead.name}
                    </Link>
                    <div style={{ fontSize: 10.5, color: colors.inkD, fontFamily: fonts.mono, marginTop: 1 }}>
                      {lead.id.slice(0, 8)}…
                    </div>
                  </div>
                  <div style={colStyle(160)}>
                    <div>{lead.business_name ?? "—"}</div>
                    <div style={{ fontSize: 11, color: colors.inkD }}>{lead.industry ?? ""}</div>
                  </div>
                  <div style={{ ...colStyle(130), fontFamily: fonts.mono, fontSize: 11.5 }}>
                    {revealed[lead.id]
                      ? <span style={{ color: colors.accent }}>{formatPhone(lead.phone_number, true)}</span>
                      : formatPhone(lead.phone_number)
                    }
                    <button onClick={() => setRevealed(p => ({ ...p, [lead.id]: !p[lead.id] }))}
                      style={{ display: "block", background: "none", border: "none", color: colors.accent, fontSize: 10, cursor: "pointer", padding: 0, marginTop: 2, fontFamily: fonts.sans }}>
                      {revealed[lead.id] ? "hide" : "reveal"}
                    </button>
                  </div>
                  <div style={colStyle(120)}>
                    <StatusBadge status={lead.status} />
                  </div>
                  <div style={colStyle(100)}>
                    {lead.conversation_state
                      ? <StateBadge state={lead.conversation_state} />
                      : <span style={{ color: colors.inkD, fontSize: 11, fontFamily: fonts.mono }}>—</span>
                    }
                  </div>
                  <div style={colStyle(110)}>
                    <ScoreBar score={lead.interest_score ?? 0} />
                  </div>
                  <div style={{ ...colStyle(90), color: colors.inkD, fontSize: 11.5, fontFamily: fonts.mono }}>
                    {timeAgo(lead.last_outreach_at ?? lead.created_at)}
                  </div>
                  <div style={{ ...colStyle(130), marginLeft: "auto", display: "flex", gap: 6 }}>
                    <Btn small variant={lead.ai_paused ? "success" : "warning"}
                      onClick={() => handlePause(lead.id, lead.ai_paused)}>
                      {lead.ai_paused ? "▶ Resume" : "⏸ Pause"}
                    </Btn>
                    <Link href={`/conversations?lead=${lead.id}`}
                      style={{ textDecoration: "none" }}>
                      <Btn small variant="ghost">Chat</Btn>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </Shell>
  );
}

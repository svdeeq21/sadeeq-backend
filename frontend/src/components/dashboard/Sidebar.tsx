// ─────────────────────────────────────────────
//  Component: Sidebar  (v2)
// ─────────────────────────────────────────────
"use client";

import { colors, fonts } from "@/lib/tokens";
import { STATUS_CONFIG } from "@/lib/constants";
import { StatusBadge, ScoreBar } from "@/components/ui";
import type { Lead, LeadStatus } from "@/types";

interface SidebarProps {
  leads: Lead[];
  filteredLeads: Lead[];
  selectedLead: Lead;
  onSelect: (lead: Lead) => void;
  filterStatus: string;
  setFilterStatus: (s: string) => void;
  searchQuery: string;
  setSearchQuery: (s: string) => void;
  counts: Record<string, number>;
}

export function Sidebar({
  filteredLeads,
  selectedLead,
  onSelect,
  filterStatus,
  setFilterStatus,
  searchQuery,
  setSearchQuery,
  counts,
}: SidebarProps) {
  return (
    <aside
      style={{
        width: 300,
        borderRight: `1px solid ${colors.border}`,
        display: "flex",
        flexDirection: "column",
        background: colors.surface,
        flexShrink: 0,
        overflow: "hidden",
      }}
    >
      {/* SEARCH + FILTERS */}
      <div style={{ padding: "14px 14px 10px", borderBottom: `1px solid ${colors.border}`, flexShrink: 0 }}>
        <div style={{ position: "relative" }}>
          <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: colors.inkD, fontSize: 14, pointerEvents: "none" }}>
            ⌕
          </span>
          <input
            style={{
              width: "100%", boxSizing: "border-box",
              padding: "8px 10px 8px 30px",
              background: colors.bg, border: `1px solid ${colors.border}`,
              borderRadius: 8, fontSize: 13, color: colors.ink,
              fontFamily: fonts.sans, outline: "none",
            }}
            placeholder="Search name or ID…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div style={{ display: "flex", gap: 4, marginTop: 10, flexWrap: "wrap" }}>
          {Object.entries(counts).map(([key, count]) => {
            const active = filterStatus === key;
            return (
              <button
                key={key}
                onClick={() => setFilterStatus(key)}
                style={{
                  padding: "4px 9px", borderRadius: 6, cursor: "pointer",
                  fontFamily: fonts.sans, fontSize: 11,
                  fontWeight: active ? 600 : 400,
                  border: "1px solid",
                  background: active ? colors.accentBg : "transparent",
                  borderColor: active ? `${colors.accent}40` : colors.border,
                  color: active ? colors.accent : colors.inkC,
                  transition: "all 0.15s",
                }}
              >
                {key === "ALL" ? "All" : STATUS_CONFIG[key as LeadStatus]?.label || key} · {count}
              </button>
            );
          })}
        </div>
      </div>

      {/* LEAD LIST */}
      <div style={{ overflowY: "auto", flex: 1 }}>
        {filteredLeads.length === 0 && (
          <div style={{ padding: 24, textAlign: "center", color: colors.inkD, fontFamily: fonts.sans, fontSize: 13 }}>
            No results found.
          </div>
        )}

        {filteredLeads.map((lead) => {
          const isActive = selectedLead.id === lead.id;
          return (
            <div
              key={lead.id}
              onClick={() => onSelect(lead)}
              style={{
                padding: "13px 14px",
                borderBottom: `1px solid ${colors.border}`,
                background: isActive ? colors.accentBg : "transparent",
                borderLeft: `3px solid ${isActive ? colors.accent : "transparent"}`,
                cursor: "pointer",
                transition: "background 0.1s",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: colors.ink, marginBottom: 2, fontFamily: fonts.sans }}>
                    {lead.name}
                  </div>
                  <div style={{ fontFamily: fonts.mono, fontSize: 10.5, color: colors.inkD }}>
                    {lead.id}
                  </div>
                </div>
                <StatusBadge status={lead.status} />
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <ScoreBar score={lead.score} />
                <span style={{ fontSize: 11.5, color: colors.inkC, fontFamily: fonts.sans }}>{lead.lastActive}</span>
              </div>

              {lead.escalated && (
                <div style={{
                  marginTop: 7, padding: "4px 8px", borderRadius: 6,
                  background: colors.redBg, border: `1px solid ${colors.red}20`,
                  fontSize: 11, color: colors.red, fontWeight: 500,
                  display: "inline-flex", alignItems: "center", gap: 4,
                  fontFamily: fonts.sans,
                }}>
                  ⚠ Needs human response
                </div>
              )}
            </div>
          );
        })}
      </div>
    </aside>
  );
}

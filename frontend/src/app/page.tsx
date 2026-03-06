// ─────────────────────────────────────────────
//  Page: Dashboard  (app/page.tsx)
//  Root page. Orchestrates all state and
//  composes the layout from sub-components.
// ─────────────────────────────────────────────
"use client";

import { useState } from "react";
import { colors, fonts, layout } from "@/lib/tokens";
import { useLeads, useLeadFilter } from "@/hooks";
import { Topbar, Sidebar, MainPanel, TickerBar } from "@/components/dashboard";

export default function DashboardPage() {
  const { leads, togglePause } = useLeads();
  const {
    filteredLeads,
    filterStatus,
    setFilterStatus,
    searchQuery,
    setSearchQuery,
    counts,
  } = useLeadFilter(leads);

  // Selected lead — default to first in list
  const [selectedLeadId, setSelectedLeadId] = useState(leads[0].id);
  const selectedLead =
    leads.find((l) => l.id === selectedLeadId) ?? leads[0];

  // Per-lead phone reveal state
  const [revealedPhones, setRevealedPhones] = useState<Record<string, boolean>>({});
  const togglePhone = () =>
    setRevealedPhones((prev) => ({
      ...prev,
      [selectedLeadId]: !prev[selectedLeadId],
    }));

  return (
    <div
      style={{
        height: "100vh",
        background: colors.bg,
        color: colors.textBody,
        fontFamily: fonts.sans,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      {/* ── TOP BAR ── */}
      <Topbar />

      {/* ── BODY ── */}
      <div
        style={{
          display: "flex",
          flex: 1,
          overflow: "hidden",
          // subtract topbar + ticker from full viewport height
          height: `calc(100vh - ${layout.topbarHeight + layout.tickerHeight}px)`,
        }}
      >
        <Sidebar
          leads={leads}
          filteredLeads={filteredLeads}
          selectedLead={selectedLead}
          onSelect={(lead) => setSelectedLeadId(lead.id)}
          filterStatus={filterStatus}
          setFilterStatus={setFilterStatus}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          counts={counts}
        />

        <MainPanel
          lead={selectedLead}
          onTogglePause={togglePause}
          showPhone={!!revealedPhones[selectedLeadId]}
          onTogglePhone={togglePhone}
        />
      </div>

      {/* ── TICKER ── */}
      <TickerBar />
    </div>
  );
}

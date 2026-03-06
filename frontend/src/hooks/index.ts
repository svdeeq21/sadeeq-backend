// ─────────────────────────────────────────────
//  Svdeeq-Bot CRM · Custom Hooks
// ─────────────────────────────────────────────
"use client";

import { useState, useEffect } from "react";
import type { Lead, LeadStatus } from "@/types";
import { MOCK_LEADS, TICKER_MESSAGES } from "@/lib/constants";

// ── useLeads ────────────────────────────────
//  Manages lead list state.
//  Later: swap MOCK_LEADS for a real fetch() call.

export function useLeads() {
  const [leads, setLeads] = useState<Lead[]>(MOCK_LEADS);

  const togglePause = (leadId: string) => {
    setLeads((prev) =>
      prev.map((l) =>
        l.id === leadId
          ? {
              ...l,
              ai_paused: !l.ai_paused,
              status: (!l.ai_paused
                ? "AI_PAUSED"
                : "AI_RESPONDED") as LeadStatus,
            }
          : l
      )
    );
  };

  return { leads, togglePause };
}

// ── usePulse ────────────────────────────────
//  Simple 1-second boolean toggle for blinking indicators.

export function usePulse(intervalMs = 1000) {
  const [pulse, setPulse] = useState(false);
  useEffect(() => {
    const id = setInterval(() => setPulse((p) => !p), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return pulse;
}

// ── useTicker ───────────────────────────────
//  Cycles through ticker messages.

export function useTicker(intervalMs = 2800) {
  const [pos, setPos] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setPos((p) => p + 1), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return TICKER_MESSAGES[pos % TICKER_MESSAGES.length];
}

// ── useLeadFilter ───────────────────────────
//  Filter + search logic for the sidebar lead list.

export function useLeadFilter(leads: Lead[]) {
  const [filterStatus, setFilterStatus] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  const filteredLeads = leads.filter((l) => {
    const matchStatus = filterStatus === "ALL" || l.status === filterStatus;
    const matchSearch =
      l.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      l.id.includes(searchQuery.toUpperCase());
    return matchStatus && matchSearch;
  });

  const counts = {
    ALL: leads.length,
    AI_RESPONDED: leads.filter((l) => l.status === "AI_RESPONDED").length,
    HUMAN_REQUIRED: leads.filter((l) => l.status === "HUMAN_REQUIRED").length,
    AI_PAUSED: leads.filter((l) => l.status === "AI_PAUSED").length,
    INVALID_NUMBER: leads.filter((l) => l.status === "INVALID_NUMBER").length,
  };

  return {
    filteredLeads,
    filterStatus,
    setFilterStatus,
    searchQuery,
    setSearchQuery,
    counts,
  };
}

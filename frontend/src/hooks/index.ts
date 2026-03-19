// ─────────────────────────────────────────────
//  Svdeeq-Bot CRM · Custom Hooks
//  All mock data replaced with real Supabase calls.
// ─────────────────────────────────────────────
"use client";

import { useState, useEffect, useCallback } from "react";
import type { Lead, Message, LeadStatus } from "@/types";
import { fetchLeads, fetchMessages, toggleLeadPause } from "@/lib/api";
import { TICKER_MESSAGES } from "@/lib/constants";

// ── useLeads ─────────────────────────────────
//  Fetches all leads from Supabase and refreshes every 30s.

export function useLeads() {
  const [leads, setLeads]     = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await fetchLeads();
      setLeads(data);
      setError(null);
    } catch (e) {
      setError("Failed to load leads");
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    // Refresh every 30 seconds
    const id = setInterval(load, 30_000);
    return () => clearInterval(id);
  }, [load]);

  const togglePause = async (leadId: string) => {
    const lead = leads.find((l) => l.id === leadId);
    if (!lead) return;

    const newPaused = !lead.ai_paused;

    // Optimistic update
    setLeads((prev) =>
      prev.map((l) =>
        l.id === leadId
          ? { ...l, ai_paused: newPaused, status: (newPaused ? "HUMAN_REQUIRED" : "PENDING") as LeadStatus }
          : l
      )
    );

    try {
      await toggleLeadPause(leadId, newPaused);
    } catch {
      // Revert on failure
      setLeads((prev) =>
        prev.map((l) => (l.id === leadId ? lead : l))
      );
    }
  };

  return { leads, loading, error, togglePause, refresh: load };
}

// ── useMessages ──────────────────────────────
//  Fetches conversation for a selected lead. Refreshes every 10s.

export function useMessages(leadId: string | null) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading]   = useState(false);

  const load = useCallback(async () => {
    if (!leadId) return;
    setLoading(true);
    try {
      const data = await fetchMessages(leadId);
      setMessages(data);
    } catch (e) {
      console.error("Failed to load messages:", e);
    } finally {
      setLoading(false);
    }
  }, [leadId]);

  useEffect(() => {
    setMessages([]); // Clear on lead change
    load();
    const id = setInterval(load, 10_000);
    return () => clearInterval(id);
  }, [load]);

  return { messages, loading };
}

// ── usePulse ─────────────────────────────────
export function usePulse(intervalMs = 1000) {
  const [pulse, setPulse] = useState(false);
  useEffect(() => {
    const id = setInterval(() => setPulse((p) => !p), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return pulse;
}

// ── useTicker ────────────────────────────────
export function useTicker(intervalMs = 2800) {
  const [pos, setPos] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setPos((p) => p + 1), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return TICKER_MESSAGES[pos % TICKER_MESSAGES.length];
}

// ── useLeadFilter ────────────────────────────
export function useLeadFilter(leads: Lead[]) {
  const [filterStatus, setFilterStatus] = useState<string>("ALL");
  const [searchQuery, setSearchQuery]   = useState("");

  const filteredLeads = leads.filter((l) => {
    const matchStatus = filterStatus === "ALL" || l.status === filterStatus;
    const matchSearch =
      l.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (l.business_name ?? "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      l.phone_number.includes(searchQuery);
    return matchStatus && matchSearch;
  });

  const counts = {
    ALL:            leads.length,
    PENDING:        leads.filter((l) => l.status === "PENDING").length,
    OUTREACH_SENT:  leads.filter((l) => l.status === "OUTREACH_SENT").length,
    AI_RESPONDED:   leads.filter((l) => l.status === "AI_RESPONDED").length,
    HUMAN_REQUIRED: leads.filter((l) => l.status === "HUMAN_REQUIRED").length,
  };

  return { filteredLeads, filterStatus, setFilterStatus, searchQuery, setSearchQuery, counts };
}

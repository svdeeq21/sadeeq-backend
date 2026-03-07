// ─────────────────────────────────────────────
//  Svdeeq-Bot CRM · Supabase API Layer
//  All data fetching goes through here.
// ─────────────────────────────────────────────
import { createClient } from "@supabase/supabase-js";
import type { Lead, Message, MessageVariant } from "@/types";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// ── Leads ────────────────────────────────────

export async function fetchLeads(): Promise<Lead[]> {
  const { data, error } = await supabase
    .from("leads")
    .select(`
      id, name, phone_number, status, ai_paused,
      business_name, industry, location,
      follow_up_count, last_outreach_at,
      outreach_variant, interest_score, created_at
    `)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) throw error;

  // Attach message counts
  const leads = data as Lead[];
  const counts = await fetchMessageCounts(leads.map((l) => l.id));

  return leads.map((lead) => ({
    ...lead,
    message_count: counts[lead.id] ?? 0,
    last_active:   formatRelativeTime(lead.last_outreach_at ?? lead.created_at),
  }));
}

export async function fetchMessageCounts(
  leadIds: string[]
): Promise<Record<string, number>> {
  if (!leadIds.length) return {};

  const { data } = await supabase
    .from("messages")
    .select("lead_id")
    .in("lead_id", leadIds);

  const counts: Record<string, number> = {};
  (data ?? []).forEach((row: { lead_id: string }) => {
    counts[row.lead_id] = (counts[row.lead_id] ?? 0) + 1;
  });
  return counts;
}

export async function toggleLeadPause(
  leadId: string,
  aiPaused: boolean
): Promise<void> {
  const { error } = await supabase
    .from("leads")
    .update({
      ai_paused: aiPaused,
      status: aiPaused ? "HUMAN_REQUIRED" : "PENDING",
    })
    .eq("id", leadId);

  if (error) throw error;
}

export async function resumeLead(leadId: string): Promise<void> {
  const { error } = await supabase
    .from("leads")
    .update({ ai_paused: false, status: "PENDING" })
    .eq("id", leadId);

  if (error) throw error;
}

// ── Messages ─────────────────────────────────

export async function fetchMessages(leadId: string): Promise<Message[]> {
  const { data, error } = await supabase
    .from("messages")
    .select("id, sender, content, inserted_at, latency_ms, message_type")
    .eq("lead_id", leadId)
    .order("inserted_at", { ascending: true });

  if (error) throw error;

  // Map sender → role for frontend
  return (data ?? []).map((m: {
    id: string;
    sender: string;
    content: string;
    inserted_at: string;
    latency_ms: number | null;
    message_type: string;
  }) => ({
    id:           m.id,
    role:         m.sender as "AI" | "USER" | "SYSTEM",
    content:      m.content,
    inserted_at:  m.inserted_at,
    latency_ms:   m.latency_ms,
    message_type: m.message_type,
  }));
}

// ── Message Variants (A/B stats) ─────────────

export async function fetchVariants(): Promise<MessageVariant[]> {
  const { data, error } = await supabase
    .from("message_variants")
    .select("id, type, message, sent, replies")
    .eq("is_active", true)
    .order("type");

  if (error) throw error;
  return data ?? [];
}

// ── System health ─────────────────────────────

export async function fetchSystemHealth() {
  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL;
  try {
    const res = await fetch(`${apiBase}/health`, { cache: "no-store" });
    if (!res.ok) throw new Error("Health check failed");
    return await res.json();
  } catch {
    return null;
  }
}

// ── Helpers ───────────────────────────────────

export function formatRelativeTime(iso: string | null): string {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);

  if (mins < 1)   return "just now";
  if (mins < 60)  return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

export function maskPhone(phone: string): string {
  // Show country code + first 3 digits + **** + last 2
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 7) return phone;
  return `+${digits.slice(0, 3)} ${digits.slice(3, 6)}****${digits.slice(-2)}`;
}

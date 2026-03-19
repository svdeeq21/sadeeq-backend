// ─────────────────────────────────────────────
//  Svdeeq Command Center · API Layer
//  All calls go through the FastAPI backend
// ─────────────────────────────────────────────

import type { Lead, Message, MessageVariant, SystemHealth } from "@/types";

const BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "https://svdeeq-bot.onrender.com";
const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SB_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

// ── Supabase REST helper ──────────────────────

async function sb<T>(
  path: string,
  params: Record<string, string> = {},
  options: RequestInit = {}
): Promise<T[]> {
  const url = new URL(`${SB_URL}/rest/v1/${path}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url.toString(), {
    ...options,
    headers: {
      apikey: SB_KEY,
      Authorization: `Bearer ${SB_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...((options.headers as Record<string, string>) || {}),
    },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Supabase ${path} → ${res.status}`);
  // Supabase returns empty body on PATCH/DELETE — guard against JSON parse crash
  const text = await res.text();
  if (!text || text.trim() === "") return [] as T[];
  try {
    return JSON.parse(text);
  } catch {
    return [] as T[];
  }
}

// ── Leads ─────────────────────────────────────

export async function fetchLeads(): Promise<Lead[]> {
  return sb<Lead>("leads", {
    select: "id,name,phone_number,business_name,industry,location,status,ai_paused,conversation_state,interest_score,follow_up_count,last_outreach_at,next_follow_up_at,outreach_variant,created_at,pain_point,suggested_solutions,objections,opportunity_analysis,industry_opening_variant,analysis_generated_at",
    order: "created_at.desc",
  });
}

export async function fetchLead(id: string): Promise<Lead | null> {
  const rows = await sb<Lead>("leads", {
    select: "*",
    id: `eq.${id}`,
  });
  return rows[0] ?? null;
}

export async function updateLead(id: string, patch: Partial<Lead>): Promise<void> {
  await sb(`leads?id=eq.${id}`, {}, {
    method: "PATCH",
    body: JSON.stringify(patch),
    headers: { Prefer: "return=minimal" },
  });
}

export async function pauseLead(id: string, paused: boolean): Promise<void> {
  await updateLead(id, { ai_paused: paused });
}

// ── Messages ──────────────────────────────────

export async function fetchMessages(leadId: string): Promise<Message[]> {
  return sb<Message>("messages", {
    select: "id,lead_id,sender,content,timestamp,latency_ms,message_type,wa_message_id",
    lead_id: `eq.${leadId}`,
    order: "timestamp.asc",
  });
}

// ── Message Variants ──────────────────────────

export async function fetchVariants(): Promise<MessageVariant[]> {
  return sb<MessageVariant>("message_variants", {
    select: "*",
    order: "type.asc",
  });
}

export async function updateVariant(id: string, patch: Partial<MessageVariant>): Promise<void> {
  await sb(`message_variants?id=eq.${id}`, {}, {
    method: "PATCH",
    body: JSON.stringify(patch),
    headers: { Prefer: "return=minimal" },
  });
}

// ── Analytics ─────────────────────────────────

export async function fetchStats(): Promise<{
  total: number;
  pending: number;
  outreached: number;
  replied: number;
  booked: number;
  optedOut: number;
  hotLeads: number;
  warmLeads: number;
}> {
  const leads = await sb<Lead>("leads", { select: "status,interest_score" });
  return {
    total:      leads.length,
    pending:    leads.filter(l => l.status === "PENDING").length,
    outreached: leads.filter(l => l.status === "OUTREACH_SENT").length,
    replied:    leads.filter(l => l.status === "AI_RESPONDED").length,
    booked:     leads.filter(l => l.status === "BOOKED" || l.conversation_state === "BOOKED").length,
    optedOut:   leads.filter(l => l.status === "OPTED_OUT").length,
    hotLeads:   leads.filter(l => (l.interest_score ?? 0) >= 0.7).length,
    warmLeads:  leads.filter(l => (l.interest_score ?? 0) >= 0.4 && (l.interest_score ?? 0) < 0.7).length,
  };
}

// ── System Health (from backend) ──────────────

export async function fetchHealth(): Promise<SystemHealth> {
  try {
    const res = await fetch(`${BASE}/health`, { cache: "no-store" });
    if (res.ok) return res.json();
  } catch { /* fallback */ }

  // Fallback: derive from Supabase directly
  const [leads, messages] = await Promise.all([
    sb<Lead>("leads", { select: "id,status" }),
    sb<{ timestamp: string }>("messages", {
      select: "timestamp",
      timestamp: `gte.${new Date(Date.now() - 86400000).toISOString()}`,
    }),
  ]);

  const today = messages.length;
  const replied = leads.filter(l => l.status === "AI_RESPONDED").length;
  const booked  = leads.filter(l => l.status === "BOOKED").length;

  return {
    wa_connected:    true,
    db_healthy:      true,
    avg_latency_ms:  0,
    leads_total:     leads.length,
    messages_today:  today,
    reply_rate:      leads.length > 0 ? Math.round((replied / leads.length) * 100) : 0,
    calls_booked:    booked,
  };
}

// ── Admin Actions ─────────────────────────────

export async function sendResume(phone: string): Promise<void> {
  // Sends RESUME command via backend
  await fetch(`${BASE}/admin/resume`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone }),
  });
}

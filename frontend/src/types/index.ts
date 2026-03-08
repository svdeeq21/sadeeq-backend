// ─────────────────────────────────────────────
//  Svdeeq-Bot CRM · Type Definitions
// ─────────────────────────────────────────────

export type LeadStatus =
  | "PENDING"
  | "OUTREACH_SENT"
  | "AI_RESPONDED"
  | "HUMAN_REQUIRED"
  | "OPTED_OUT"
  | "INACTIVE"
  | "INVALID_NUMBER";

export type MessageRole = "AI" | "USER" | "SYSTEM";

export interface Lead {
  id: string;
  name: string;
  phone_number: string;
  status: LeadStatus;
  ai_paused: boolean;
  business_name: string | null;
  industry: string | null;
  location: string | null;
  follow_up_count: number;
  last_outreach_at: string | null;
  outreach_variant: string | null;
  interest_score: number | null;
  created_at: string;
  message_count?: number;
  last_active?: string;
}

export interface Message {
  id: string;
  role: MessageRole;
  content: string;
  inserted_at: string | null;
  timestamp: string | null;
  latency_ms?: number | null;
  message_type?: string;
}

export interface SystemMetric {
  key: string;
  label: string;
  value: string;
  good: boolean;
}

export interface StatusConfig {
  label: string;
  color: string;
  bg: string;
  dot: string;
}

export interface MessageVariant {
  id: string;
  type: string;
  message: string;
  sent: number;
  replies: number;
}

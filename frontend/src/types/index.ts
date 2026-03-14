// ─────────────────────────────────────────────
//  Svdeeq Command Center · Type Definitions
// ─────────────────────────────────────────────

export type LeadStatus =
  | "PENDING"
  | "OUTREACH_SENT"
  | "AI_RESPONDED"
  | "HUMAN_REQUIRED"
  | "AI_PAUSED"
  | "OPTED_OUT"
  | "INVALID_NUMBER"
  | "BOOKED";

export type ConversationState =
  | "COLD"
  | "DISCOVERY"
  | "PITCH"
  | "CALL_INVITE"
  | "BOOKED"
  | "NURTURE"
  | "DEAD";

export type MessageSender = "AI" | "USER" | "SYSTEM";

export interface Lead {
  id: string;
  name: string;
  phone_number: string;
  business_name?: string;
  industry?: string;
  location?: string;
  status: LeadStatus;
  ai_paused: boolean;
  conversation_state?: ConversationState;
  interest_score?: number;
  follow_up_count?: number;
  last_outreach_at?: string;
  next_follow_up_at?: string;
  outreach_variant?: string;
  created_at: string;
}

export interface Message {
  id: string;
  lead_id: string;
  sender: MessageSender;
  content: string;
  timestamp: string;
  latency_ms?: number;
  message_type?: string;
  wa_message_id?: string;
}

export interface MessageVariant {
  id: string;
  type: string;
  message: string;
  sent: number;
  replies: number;
  is_active: boolean;
}

export interface DailyStats {
  date: string;
  sent: number;
  replies: number;
  booked: number;
}

export interface SystemHealth {
  wa_connected: boolean;
  db_healthy: boolean;
  avg_latency_ms: number;
  leads_total: number;
  messages_today: number;
  reply_rate: number;
  calls_booked: number;
}

// ─────────────────────────────────────────────
//  Svdeeq-Bot CRM · Type Definitions
// ─────────────────────────────────────────────

export type LeadStatus =
  | "AI_RESPONDED"
  | "HUMAN_REQUIRED"
  | "AI_PAUSED"
  | "INVALID_NUMBER";

export type MessageRole = "AI" | "USER" | "SYSTEM";

export interface Lead {
  id: string;
  name: string;
  phone: string;           // masked by default in UI
  status: LeadStatus;
  ai_paused: boolean;
  location: string;
  budget: string;
  interest: string;
  messages: number;
  lastActive: string;
  score: number;           // RAG similarity score 0–1
  escalated: boolean;
}

export interface Message {
  role: MessageRole;
  text: string;
  time: string;            // "HH:MM" display format
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

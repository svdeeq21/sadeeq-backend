import type { SystemMetric, StatusConfig, LeadStatus } from "@/types";

export const STATUS_CONFIG: Record<LeadStatus, StatusConfig> = {
  PENDING:        { label: "Pending",      color: "#80848E", bg: "#2C2F33", dot: "#4E5058" },
  OUTREACH_SENT:  { label: "Outreach Sent",color: "#00B0F4", bg: "#0A1929", dot: "#00B0F4" },
  AI_RESPONDED:   { label: "AI Active",    color: "#23A55A", bg: "#1A2E22", dot: "#23A55A" },
  HUMAN_REQUIRED: { label: "Needs You",    color: "#F23F43", bg: "#2C1215", dot: "#F23F43" },
  OPTED_OUT:      { label: "Opted Out",    color: "#4E5058", bg: "#2C2F33", dot: "#4E5058" },
  INACTIVE:       { label: "Inactive",     color: "#4E5058", bg: "#2C2F33", dot: "#3A3D43" },
  INVALID_NUMBER: { label: "Invalid",      color: "#4E5058", bg: "#2C2F33", dot: "#4E5058" },
};

export const DEFAULT_SYSTEM_METRICS: SystemMetric[] = [
  { key: "WA",  label: "WhatsApp",  value: "Checking…", good: true },
  { key: "LLM", label: "LLM",       value: "Gemini",    good: true },
  { key: "DB",  label: "Database",  value: "Supabase",  good: true },
  { key: "LAT", label: "Latency",   value: "—",         good: true },
];

export const TICKER_MESSAGES: string[] = [
  "Svdeeq-Bot · AI outreach · live",
  "WhatsApp connected via Evolution API",
  "RAG · gemini-embedding-001",
  "Scheduler active · WAT 09:00–12:00 / 14:00–17:30",
  "A/B testing · tracking reply rates",
  "Follow-up sequence · Day 0 → 2 → 5 → 10",
];

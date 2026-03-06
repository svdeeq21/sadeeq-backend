// ─────────────────────────────────────────────
//  Svdeeq-Bot CRM · Constants & Static Data
// ─────────────────────────────────────────────
import type { Lead, Message, SystemMetric, StatusConfig, LeadStatus } from "@/types";

// --------------- STATUS DISPLAY CONFIG ----------------

export const STATUS_CONFIG: Record<LeadStatus, StatusConfig> = {
  AI_RESPONDED: {
    label: "AI Active",
    color: "#16A34A",
    bg: "#F0FDF4",
    dot: "#22C55E",
  },
  HUMAN_REQUIRED: {
    label: "Needs Attention",
    color: "#DC2626",
    bg: "#FEF2F2",
    dot: "#EF4444",
  },
  AI_PAUSED: {
    label: "AI Paused",
    color: "#D97706",
    bg: "#FFFBEB",
    dot: "#F59E0B",
  },
  INVALID_NUMBER: {
    label: "Invalid",
    color: "#64748B",
    bg: "#F8FAFC",
    dot: "#94A3B8",
  },
};

// --------------- MOCK LEADS ----------------
// TODO: Replace with API call to GET /api/leads

export const MOCK_LEADS: Lead[] = [
  { id: "LD-0041", name: "Khalid Al-Rashidi", phone: "+971 5× ×××× 4421", status: "AI_RESPONDED",   ai_paused: false, location: "Dubai Marina",  budget: "AED 1.2M – 1.8M",  interest: "2BR Apartment",   messages: 14, lastActive: "2m ago",  score: 0.91, escalated: false },
  { id: "LD-0039", name: "Priya Nambiar",     phone: "+91 98×× ×××× 02",  status: "HUMAN_REQUIRED", ai_paused: true,  location: "Bangalore",     budget: "₹80L – 1.2Cr",      interest: "Villa Plot",      messages: 7,  lastActive: "11m ago", score: 0.43, escalated: true  },
  { id: "LD-0038", name: "James Okonkwo",     phone: "+234 8×× ×××× 77",  status: "AI_RESPONDED",   ai_paused: false, location: "Lagos Island",  budget: "$120K – $180K",     interest: "Commercial Unit", messages: 21, lastActive: "34m ago", score: 0.87, escalated: false },
  { id: "LD-0036", name: "Sara Benedetti",    phone: "+39 3×× ×××× 90",   status: "AI_PAUSED",      ai_paused: true,  location: "Milan",         budget: "€400K – €600K",     interest: "Penthouse",       messages: 3,  lastActive: "2h ago",  score: 0.61, escalated: false },
  { id: "LD-0035", name: "Tariq Mossad",      phone: "+20 10×× ×××× 3",   status: "INVALID_NUMBER", ai_paused: false, location: "Cairo",         budget: "—",                 interest: "Studio",          messages: 0,  lastActive: "5h ago",  score: 0.0,  escalated: false },
  { id: "LD-0033", name: "Mei-Lin Chou",      phone: "+886 9×× ×××× 55",  status: "AI_RESPONDED",   ai_paused: false, location: "Taipei",        budget: "NT$15M – NT$22M",   interest: "3BR Apartment",   messages: 9,  lastActive: "1h ago",  score: 0.79, escalated: false },
  { id: "LD-0031", name: "Dmitri Volkov",     phone: "+7 9×× ×××× 18",    status: "HUMAN_REQUIRED", ai_paused: true,  location: "Moscow",        budget: "$90K – $130K",      interest: "Office Space",    messages: 5,  lastActive: "3h ago",  score: 0.38, escalated: true  },
  { id: "LD-0029", name: "Amara Diallo",      phone: "+221 7× ×××× 44",   status: "AI_RESPONDED",   ai_paused: false, location: "Dakar",         budget: "XOF 45M – 70M",     interest: "1BR Apartment",   messages: 12, lastActive: "28m ago", score: 0.83, escalated: false },
];

// --------------- MOCK CONVERSATIONS ----------------
// TODO: Replace with API call to GET /api/leads/:id/messages

export const MOCK_CONVERSATIONS: Record<string, Message[]> = {
  "LD-0041": [
    { role: "AI", text: "Hello Khalid! I'm the digital assistant for Svdeeq Properties. I understand you're interested in a 2-bedroom unit in Dubai Marina — is that right?", time: "09:14" },
    { role: "USER", text: "Yes exactly, looking for something with sea view and gym access", time: "09:16" },
    { role: "AI", text: "Great choice. We have two available units matching that profile — both in Tier 1 towers. Are you looking to move in Q3 or Q4 this year?", time: "09:16" },
    { role: "USER", text: "Q4 ideally, need time to arrange financing", time: "09:19" },
    { role: "AI", text: "Understood. We work with 3 financing partners who offer 5-year fixed rates. Would you like me to have someone from our finance team reach out separately?", time: "09:20" },
    { role: "USER", text: "That would be helpful yes", time: "09:22" },
    { role: "AI", text: "Done — I've flagged your profile for our finance team. In the meantime, shall I send you floor plans for the two available units?", time: "09:22" },
  ],
  "LD-0039": [
    { role: "AI", text: "Hi Priya! Welcome. Are you looking for residential plots or a built villa in Bangalore?", time: "11:02" },
    { role: "USER", text: "I want a plot only, not built property. Also send me all your available plots", time: "11:04" },
    { role: "AI", text: "We have 4 plot listings in your budget range. Shall I share them sorted by size or by location?", time: "11:04" },
    { role: "USER", text: "Can you just send me an Excel file with all of them", time: "11:07" },
    { role: "SYSTEM", text: "⚠ Media/file request detected — escalation triggered. AI paused.", time: "11:07" },
  ],
  "LD-0038": [
    { role: "AI", text: "Good day James! I see you're interested in commercial units on Lagos Island — what's your primary use case: office, retail, or mixed?", time: "08:30" },
    { role: "USER", text: "Retail ground floor, needs loading bay access", time: "08:33" },
    { role: "AI", text: "That narrows it significantly. We have one unit in Victoria Island that qualifies — 420sqm with rear loading access. Would you like to schedule a site visit?", time: "08:33" },
  ],
};

// --------------- SYSTEM METRICS ----------------
// TODO: Replace with API call to GET /api/system/health

export const MOCK_SYSTEM_METRICS: SystemMetric[] = [
  { key: "WA_STATUS",   label: "WhatsApp",     value: "Connected",  good: true  },
  { key: "LLM_QUOTA",   label: "LLM Quota",    value: "82% left",   good: true  },
  { key: "DB_HEALTH",   label: "Database",     value: "Healthy",    good: true  },
  { key: "AVG_LATENCY", label: "Avg. Latency", value: "1.4s",       good: true  },
  { key: "REPLY_RATE",  label: "Reply Rate",   value: "31.2%",      good: true  },
  { key: "ESCALATION",  label: "Escalation",   value: "24.7%",      good: true  },
];

// --------------- TICKER MESSAGES ----------------

export const TICKER_MESSAGES: string[] = [
  "LD-0041 · AI replied · latency 1.1s",
  "LD-0038 · vector match · score 0.87",
  "Daily cap: 18/20 messages sent",
  "LD-0029 · new inbound message",
  "LLM quota check · OK",
  "WA heartbeat · OK",
  "LD-0033 · summary updated",
  "Rate limiter · all clear",
];

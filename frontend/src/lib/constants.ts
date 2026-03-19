import { colors } from "./tokens";
import type { LeadStatus, ConversationState } from "@/types";

export const STATUS_CONFIG: Record<LeadStatus, { label: string; color: string; bg: string; dot: string }> = {
  PENDING:        { label: "Pending",     color: colors.inkC,   bg: colors.slateBg, dot: colors.slate },
  OUTREACH_SENT:  { label: "Outreached",  color: colors.blue,   bg: colors.blueBg,  dot: colors.blue },
  AI_RESPONDED:   { label: "Replied",     color: colors.green,  bg: colors.greenBg, dot: colors.green },
  HUMAN_REQUIRED: { label: "Needs You",   color: colors.red,    bg: colors.redBg,   dot: colors.red },
  AI_PAUSED:      { label: "Paused",      color: colors.amber,  bg: colors.amberBg, dot: colors.amber },
  OPTED_OUT:      { label: "Opted Out",   color: colors.inkD,   bg: colors.slateBg, dot: colors.slate },
  INVALID_NUMBER: { label: "Invalid",     color: colors.inkD,   bg: colors.slateBg, dot: colors.slate },
  BOOKED:         { label: "Booked",      color: colors.green,  bg: colors.greenBg, dot: colors.green },
};

export const STATE_CONFIG: Record<ConversationState, { label: string; color: string }> = {
  COLD:        { label: "Cold",        color: colors.blue },
  DISCOVERY:   { label: "Discovery",   color: colors.amber },
  PITCH:       { label: "Pitching",    color: colors.purple },
  CALL_INVITE: { label: "Invite",      color: colors.amber },
  BOOKED:      { label: "Booked",      color: colors.green },
  NURTURE:     { label: "Nurture",     color: colors.inkC },
  DEAD:        { label: "Dead",        color: colors.inkD },
};

export function heatLabel(score: number): "HOT" | "WARM" | "COLD" | "UNTOUCHED" {
  if (score >= 0.7)  return "HOT";
  if (score >= 0.4)  return "WARM";
  if (score >= 0.15) return "COLD";
  return "UNTOUCHED";
}

export function heatColor(score: number): string {
  const h = heatLabel(score);
  if (h === "HOT")  return colors.hot;
  if (h === "WARM") return colors.warm;
  if (h === "COLD") return colors.cold;
  return colors.inkD;
}

export function formatPhone(phone: string, reveal = false): string {
  if (reveal) return `+${phone}`;
  if (phone.length < 7) return phone;
  return `+${phone.slice(0, 3)} ×× ${phone.slice(-4)}`;
}

export function timeAgo(isoString?: string): string {
  if (!isoString) return "—";
  const diff = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1)   return "just now";
  if (mins < 60)  return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)   return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

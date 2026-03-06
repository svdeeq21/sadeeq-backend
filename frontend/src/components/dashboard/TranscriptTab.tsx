// ─────────────────────────────────────────────
//  Component: TranscriptTab  (v2)
// ─────────────────────────────────────────────
import { colors, fonts, shadows } from "@/lib/tokens";
import type { Message } from "@/types";

function ChatBubble({ msg }: { msg: Message }) {
  const isAI  = msg.role === "AI";
  const isSys = msg.role === "SYSTEM";

  if (isSys) return (
    <div style={{ display: "flex", justifyContent: "center", margin: "12px 0" }}>
      <div style={{
        display: "inline-flex", alignItems: "center", gap: 6,
        padding: "5px 12px", borderRadius: 99,
        background: colors.amberBg, border: `1px solid ${colors.amber}30`,
        fontFamily: fonts.sans, fontSize: 12, color: colors.amber, fontWeight: 500,
      }}>
        <span>⚠</span> {msg.text}
      </div>
    </div>
  );

  return (
    <div style={{ display: "flex", justifyContent: isAI ? "flex-start" : "flex-end", marginBottom: 12, gap: 8, alignItems: "flex-end" }}>
      {isAI && (
        <div style={{
          width: 28, height: 28, borderRadius: 8, flexShrink: 0,
          background: colors.accentSoft, border: `1px solid ${colors.accent}20`,
          display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13,
        }}>🤖</div>
      )}
      <div style={{
        maxWidth: "68%",
        padding: "10px 14px",
        borderRadius: isAI ? "4px 14px 14px 14px" : "14px 4px 14px 14px",
        background: isAI ? colors.surface : colors.accent,
        boxShadow: shadows.sm,
        border: isAI ? `1px solid ${colors.border}` : "none",
      }}>
        <div style={{ fontSize: 11, color: isAI ? colors.inkD : "rgba(255,255,255,0.65)", marginBottom: 4, fontFamily: fonts.mono }}>
          {msg.time}
        </div>
        <div style={{ fontSize: 13.5, lineHeight: 1.55, color: isAI ? colors.ink : "#fff", fontFamily: fonts.sans }}>
          {msg.text}
        </div>
      </div>
      {!isAI && (
        <div style={{
          width: 28, height: 28, borderRadius: 8, flexShrink: 0,
          background: colors.surfaceB, border: `1px solid ${colors.border}`,
          display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13,
        }}>👤</div>
      )}
    </div>
  );
}

interface Props {
  messages: Message[];
  chatRef: React.RefObject<HTMLDivElement>;
}

export function TranscriptTab({ messages, chatRef }: Props) {
  return (
    <div ref={chatRef} style={{ flex: 1, overflowY: "auto", padding: "20px 24px" }}>
      {messages.length === 0
        ? <div style={{ textAlign: "center", color: colors.inkD, fontSize: 13, paddingTop: 60, fontFamily: fonts.sans }}>No messages recorded.</div>
        : messages.map((msg, i) => <ChatBubble key={i} msg={msg} />)
      }
    </div>
  );
}

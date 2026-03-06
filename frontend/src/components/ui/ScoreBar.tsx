// ─────────────────────────────────────────────
//  Component: ScoreRing
//  SVG circular progress ring for RAG similarity
//  scores, colour-coded green / amber / red.
// ─────────────────────────────────────────────
import { colors } from "@/lib/tokens";

interface Props {
  score: number; // 0.0 – 1.0
}

export function ScoreBar({ score }: Props) {
  const pct = Math.round(score * 100);
  const color =
    score >= 0.75 ? colors.green :
    score >= 0.5  ? colors.amber :
    score > 0     ? colors.red   :
                    colors.slate;

  const r = 10;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <svg width={26} height={26} style={{ transform: "rotate(-90deg)", flexShrink: 0 }}>
        <circle
          cx={13} cy={13} r={r}
          fill="none" stroke={colors.border} strokeWidth={2.5}
        />
        <circle
          cx={13} cy={13} r={r}
          fill="none" stroke={color} strokeWidth={2.5}
          strokeDasharray={`${dash} ${circ}`}
          strokeLinecap="round"
          style={{ transition: "stroke-dasharray 0.5s ease" }}
        />
      </svg>
      <span style={{
        fontFamily: "'DM Mono', 'Courier New', monospace",
        fontSize: 11,
        fontWeight: 500,
        color,
        minWidth: 28,
      }}>
        {pct > 0 ? `${pct}%` : "—"}
      </span>
    </div>
  );
}

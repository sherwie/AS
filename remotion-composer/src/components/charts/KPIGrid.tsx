import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

interface Metric {
  label: string;
  value: number;
  prefix?: string;
  suffix?: string;
  change?: number;
  icon?: string;
}

type KPIAnimationStyle = "count-up" | "pop" | "cascade";

interface KPIGridProps {
  metrics: Metric[];
  title?: string;
  columns?: 2 | 3 | 4;
  colors?: string[];
  fontFamily?: string;
  textColor?: string;
  backgroundColor?: string;
  cardBackgroundColor?: string;
  positiveColor?: string;
  negativeColor?: string;
  animationStyle?: KPIAnimationStyle;
}

const MECHANISM_DESCRIPTIONS = [
  "Placing a €150 decoy next to a €79 bundle makes €79 feel like a bargain—even when your budget cap was €40.",
  "Adding €28 of unplanned filler items at checkout just to avoid paying a €5.99 delivery fee.",
  "Splitting a purchase into 4 bi-weekly payments anaesthetizes price pain and inflates cart size by +42%.",
];

export const KPIGrid: React.FC<KPIGridProps> = ({
  metrics,
  title,
  columns = 3,
  colors = ["#EF4444", "#F59E0B", "#22D3EE", "#10B981"],
  fontFamily = "'Space Grotesk', 'Inter', system-ui, sans-serif",
  textColor = "#F8FAFC",
  backgroundColor = "transparent",
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const headerOpacity = spring({ frame, fps, config: { damping: 18 } });

  return (
    <AbsoluteFill
      style={{
        background: backgroundColor,
        justifyContent: "center",
        alignItems: "center",
        padding: "105px 80px 115px 80px",
        fontFamily,
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 1680,
          display: "flex",
          flexDirection: "column",
          gap: 28,
        }}
      >
        {title && (
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-end",
              opacity: headerOpacity,
              padding: "0 8px",
            }}
          >
            <div>
              <div
                style={{
                  fontSize: 15,
                  fontFamily: "'JetBrains Mono', monospace",
                  color: "#F59E0B",
                  fontWeight: 800,
                  letterSpacing: "0.14em",
                  marginBottom: 6,
                }}
              >
                BEHAVIORAL ECONOMICS // RETAIL PRICING TRIGGERS
              </div>
              <div
                style={{
                  fontSize: 42,
                  fontWeight: 900,
                  color: textColor,
                  letterSpacing: "-0.02em",
                }}
              >
                {title}
              </div>
            </div>
            <div
              style={{
                padding: "8px 18px",
                borderRadius: 8,
                background: "rgba(15, 23, 42, 0.85)",
                border: "1px solid rgba(248, 250, 252, 0.18)",
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 15,
                color: "#CBD5E1",
              }}
            >
              3 ACTIVE COGNITIVE TRAPS
            </div>
          </div>
        )}

        <div
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${Math.min(columns, metrics.length)}, 1fr)`,
            gap: 30,
            width: "100%",
          }}
        >
          {metrics.map((metric, idx) => {
            const accent = colors[idx % colors.length];
            const cardSpring = spring({
              frame: frame - idx * 8,
              fps,
              config: { damping: 14, stiffness: 105 },
            });
            const countProgress = spring({
              frame: frame - idx * 8 - 4,
              fps,
              config: { damping: 20, stiffness: 55 },
            });
            const displayVal = Math.round(metric.value * countProgress);
            const barWidth = Math.min(100, Math.round(metric.value * 1.25 * countProgress));

            return (
              <div
                key={metric.label}
                style={{
                  background:
                    "linear-gradient(160deg, rgba(13, 20, 34, 0.92) 0%, rgba(7, 11, 20, 0.95) 100%)",
                  border: "1px solid rgba(248, 250, 252, 0.16)",
                  borderTop: `5px solid ${accent}`,
                  borderRadius: 22,
                  padding: "34px 32px",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  gap: 22,
                  boxShadow: "0 28px 65px rgba(0, 0, 0, 0.65)",
                  opacity: cardSpring,
                  transform: `translateY(${interpolate(cardSpring, [0, 1], [36, 0])}px)`,
                }}
              >
                {/* Top Header */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span
                    style={{
                      padding: "5px 14px",
                      borderRadius: 6,
                      background: `${accent}22`,
                      border: `1px solid ${accent}`,
                      color: accent,
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: 15,
                      fontWeight: 800,
                      letterSpacing: "0.08em",
                    }}
                  >
                    FORMULA 0{idx + 1}
                  </span>
                  <span style={{ fontSize: 32 }}>{metric.icon || "⚡"}</span>
                </div>

                {/* Big Count-Up Stat */}
                <div>
                  <div
                    style={{
                      fontSize: 84,
                      fontWeight: 900,
                      color: "#F8FAFC",
                      fontFamily: "'JetBrains Mono', monospace",
                      lineHeight: 1.0,
                      letterSpacing: "-0.03em",
                      textShadow: `0 0 32px ${accent}55`,
                    }}
                  >
                    {metric.prefix || ""}
                    {displayVal}
                    {metric.suffix || ""}
                  </div>
                  <div
                    style={{
                      fontSize: 27,
                      fontWeight: 800,
                      color: accent,
                      marginTop: 12,
                      letterSpacing: "-0.01em",
                    }}
                  >
                    {metric.label}
                  </div>
                </div>

                {/* Editorial Explanation Paragraph */}
                <div
                  style={{
                    fontSize: 19,
                    lineHeight: 1.48,
                    color: "#CBD5E1",
                    background: "rgba(30, 41, 59, 0.55)",
                    padding: "16px 18px",
                    borderRadius: 12,
                    borderLeft: `3px solid ${accent}`,
                  }}
                >
                  {MECHANISM_DESCRIPTIONS[idx] ||
                    "Empirical checkout multiplier measured across Q4 retail transactions."}
                </div>

                {/* Severity Meter Bar */}
                <div>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      fontSize: 14,
                      fontFamily: "'JetBrains Mono', monospace",
                      color: "#94A3B8",
                      marginBottom: 8,
                    }}
                  >
                    <span>BUDGET EROSION SEVERITY</span>
                    <span style={{ color: accent, fontWeight: 800 }}>HIGH IMPACT</span>
                  </div>
                  <div
                    style={{
                      width: "100%",
                      height: 10,
                      borderRadius: 999,
                      background: "rgba(248, 250, 252, 0.1)",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        width: `${barWidth}%`,
                        height: "100%",
                        background: accent,
                        borderRadius: 999,
                        boxShadow: `0 0 16px ${accent}`,
                      }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
};

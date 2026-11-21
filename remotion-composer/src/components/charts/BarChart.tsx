import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

interface DataPoint {
  label: string;
  value: number;
}

type AnimationStyle = "grow-up" | "grow-right" | "cascade" | "elastic";

interface BarChartProps {
  data: DataPoint[];
  title?: string;
  colors?: string[];
  fontFamily?: string;
  textColor?: string;
  backgroundColor?: string;
  gridColor?: string;
  animationStyle?: AnimationStyle;
  showValues?: boolean;
  showGrid?: boolean;
  valuePrefix?: string;
  valueSuffix?: string;
}

const CATEGORY_INSIGHTS = [
  "BOTTOM OF EXPENSIVE CATEGORY // Signals 'budget compromise'",
  "LOW-TIER ELECTRONICS // High defect rate & zero emotional utility",
  "TOP OF €20 CATEGORY // Best-in-class single-origin consumable",
  "PEAK THOUGHTFULNESS // High intellectual + personal signal",
];

export const BarChart: React.FC<BarChartProps> = ({
  data,
  title,
  colors = ["#EF4444", "#F59E0B", "#10B981", "#22D3EE"],
  fontFamily = "'Space Grotesk', 'Inter', system-ui, sans-serif",
  textColor = "#F8FAFC",
  backgroundColor = "transparent",
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const maxVal = Math.max(...data.map((d) => d.value), 100);
  const titleSpring = spring({ frame, fps, config: { damping: 18 } });

  return (
    <AbsoluteFill
      style={{
        background: backgroundColor,
        justifyContent: "center",
        alignItems: "center",
        padding: "105px 88px 115px 88px",
        fontFamily,
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 1640,
          background:
            "linear-gradient(155deg, rgba(11, 17, 30, 0.91) 0%, rgba(5, 9, 18, 0.95) 100%)",
          border: "1px solid rgba(248, 250, 252, 0.16)",
          borderTop: "5px solid #10B981",
          borderRadius: 24,
          padding: "42px 54px",
          boxShadow: "0 35px 80px rgba(0, 0, 0, 0.72)",
          display: "flex",
          flexDirection: "column",
          gap: 28,
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
            borderBottom: "1px solid rgba(248, 250, 252, 0.12)",
            paddingBottom: 20,
            opacity: titleSpring,
          }}
        >
          <div>
            <div
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 15,
                fontWeight: 800,
                color: "#10B981",
                letterSpacing: "0.12em",
                marginBottom: 6,
              }}
            >
              ASYMMETRIC VALUE ARBITRAGE // CONSUMER PERCEPTION INDEX
            </div>
            <div
              style={{
                fontSize: 36,
                fontWeight: 900,
                color: textColor,
                letterSpacing: "-0.02em",
              }}
            >
              {title || "PERCEIVED LUXURY SCORE (OUT OF 100)"}
            </div>
          </div>

          <div
            style={{
              padding: "8px 18px",
              borderRadius: 8,
              background: "rgba(16, 185, 129, 0.14)",
              border: "1px solid #10B981",
              color: "#6EE7B7",
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 15,
              fontWeight: 800,
            }}
          >
            RULE: BUY TOP OF A €20 CATEGORY
          </div>
        </div>

        {/* Horizontal Editorial Bars */}
        <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
          {data.map((d, i) => {
            const barColor = colors[i % colors.length];
            const rowSpring = spring({
              frame: frame - (8 + i * 7),
              fps,
              config: { damping: 15, stiffness: 100 },
            });
            const pct = Math.min(100, (d.value / maxVal) * 100 * rowSpring);
            const displayScore = Math.round(d.value * rowSpring);
            const isWinner = d.value >= 80;

            return (
              <div
                key={d.label}
                style={{
                  display: "grid",
                  gridTemplateColumns: "380px 1fr 165px",
                  gap: 28,
                  alignItems: "center",
                  padding: "16px 22px",
                  borderRadius: 16,
                  background: isWinner
                    ? "rgba(16, 185, 129, 0.09)"
                    : "rgba(30, 41, 59, 0.42)",
                  border: isWinner
                    ? "1px solid rgba(16, 185, 129, 0.45)"
                    : "1px solid rgba(248, 250, 252, 0.08)",
                  opacity: rowSpring,
                }}
              >
                {/* Left Label + Sub-insight */}
                <div>
                  <div
                    style={{
                      fontSize: 24,
                      fontWeight: 800,
                      color: "#F8FAFC",
                    }}
                  >
                    {d.label}
                  </div>
                  <div
                    style={{
                      fontSize: 13,
                      fontFamily: "'JetBrains Mono', monospace",
                      color: isWinner ? "#6EE7B7" : "#94A3B8",
                      marginTop: 4,
                    }}
                  >
                    {CATEGORY_INSIGHTS[i] || "EMPIRICAL PERCEPTION BENCHMARK"}
                  </div>
                </div>

                {/* Middle Bar Track */}
                <div
                  style={{
                    height: 36,
                    borderRadius: 10,
                    background: "rgba(15, 23, 42, 0.9)",
                    border: "1px solid rgba(248, 250, 252, 0.12)",
                    overflow: "hidden",
                    position: "relative",
                    padding: 4,
                  }}
                >
                  <div
                    style={{
                      width: `${pct}%`,
                      height: "100%",
                      borderRadius: 7,
                      background: `linear-gradient(90deg, ${barColor}99 0%, ${barColor} 100%)`,
                      boxShadow: `0 0 24px ${barColor}88`,
                    }}
                  />
                </div>

                {/* Right Score Readout */}
                <div
                  style={{
                    textAlign: "right",
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: 36,
                    fontWeight: 900,
                    color: barColor,
                  }}
                >
                  {displayScore}
                  <span style={{ fontSize: 18, color: "#94A3B8" }}>/100</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
};

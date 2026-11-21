import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

type ChangeDirection = "up" | "down" | "neutral";

interface ComparisonCardProps {
  leftLabel: string;
  rightLabel: string;
  leftValue: string;
  rightValue: string;
  leftColor?: string;
  rightColor?: string;
  title?: string;
  changeIndicator?: string;
  changeDirection?: ChangeDirection;
  backgroundColor?: string;
  cardBackgroundColor?: string;
  textColor?: string;
  fontFamily?: string;
  titleFontSize?: number;
  labelFontSize?: number;
  valueFontSize?: number;
}

export const ComparisonCard: React.FC<ComparisonCardProps> = ({
  leftLabel,
  rightLabel,
  leftValue,
  rightValue,
  leftColor = "#EF4444",
  rightColor = "#10B981",
  title,
  backgroundColor = "transparent",
  textColor = "#F8FAFC",
  fontFamily = "'Space Grotesk', 'Inter', system-ui, sans-serif",
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const leftSpring = spring({ frame: frame - 4, fps, config: { damping: 14 } });
  const rightSpring = spring({ frame: frame - 14, fps, config: { damping: 14 } });
  const deltaSpring = spring({ frame: frame - 24, fps, config: { damping: 12 } });

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
          display: "flex",
          flexDirection: "column",
          gap: 28,
        }}
      >
        {title && (
          <div
            style={{
              textAlign: "center",
              fontSize: 40,
              fontWeight: 900,
              color: textColor,
              letterSpacing: "-0.02em",
            }}
          >
            {title}
          </div>
        )}

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 120px 1fr",
            alignItems: "stretch",
            gap: 24,
          }}
        >
          {/* Left Path (Wealth Destruction) */}
          <div
            style={{
              background:
                "linear-gradient(155deg, rgba(24, 11, 18, 0.92) 0%, rgba(10, 6, 12, 0.96) 100%)",
              border: "2px solid rgba(239, 68, 68, 0.65)",
              borderRadius: 24,
              padding: "42px 44px",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              gap: 24,
              boxShadow: "0 30px 70px rgba(239, 68, 68, 0.18)",
              opacity: leftSpring,
              transform: `translateX(${interpolate(leftSpring, [0, 1], [-40, 0])}px)`,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span
                style={{
                  padding: "6px 14px",
                  borderRadius: 6,
                  background: "rgba(239, 68, 68, 0.2)",
                  color: "#FCA5A5",
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 15,
                  fontWeight: 800,
                }}
              >
                PATH A // REACTIVE CONSUMER
              </span>
              <span style={{ fontSize: 16, fontFamily: "monospace", color: "#EF4444" }}>
                -€528/YR DRAIN
              </span>
            </div>

            <div>
              <div
                style={{
                  fontSize: 24,
                  fontWeight: 700,
                  color: "#CBD5E1",
                  marginBottom: 12,
                }}
              >
                {leftLabel}
              </div>
              <div
                style={{
                  fontSize: 80,
                  fontWeight: 900,
                  color: leftColor,
                  fontFamily: "'JetBrains Mono', monospace",
                  lineHeight: 1.05,
                  textShadow: "0 0 36px rgba(239, 68, 68, 0.45)",
                }}
              >
                {leftValue}
              </div>
            </div>

            <div
              style={{
                paddingTop: 18,
                borderTop: "1px solid rgba(239, 68, 68, 0.25)",
                fontSize: 18,
                color: "#FCA5A5",
                lineHeight: 1.45,
              }}
            >
              10 consecutive winters of unplanned €528 holiday overspending + zero compounding return.
            </div>
          </div>

          {/* Center VS Delta Badge */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              alignItems: "center",
              gap: 14,
              opacity: deltaSpring,
              transform: `scale(${interpolate(deltaSpring, [0, 1], [0.7, 1])})`,
            }}
          >
            <div
              style={{
                width: 84,
                height: 84,
                borderRadius: "50%",
                background: "rgba(15, 23, 42, 0.95)",
                border: "2px solid #F59E0B",
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 24,
                fontWeight: 900,
                color: "#F59E0B",
                boxShadow: "0 0 30px rgba(245, 158, 11, 0.35)",
              }}
            >
              VS
            </div>
            <div
              style={{
                padding: "6px 12px",
                borderRadius: 8,
                background: "rgba(16, 185, 129, 0.2)",
                border: "1px solid #10B981",
                color: "#6EE7B7",
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 14,
                fontWeight: 800,
                textAlign: "center",
              }}
            >
              €13,541 SWING
            </div>
          </div>

          {/* Right Path (Compounded Capital) */}
          <div
            style={{
              background:
                "linear-gradient(155deg, rgba(8, 26, 24, 0.92) 0%, rgba(5, 14, 15, 0.96) 100%)",
              border: "2px solid rgba(16, 185, 129, 0.75)",
              borderRadius: 24,
              padding: "42px 44px",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              gap: 24,
              boxShadow: "0 30px 70px rgba(16, 185, 129, 0.22)",
              opacity: rightSpring,
              transform: `translateX(${interpolate(rightSpring, [0, 1], [40, 0])}px)`,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span
                style={{
                  padding: "6px 14px",
                  borderRadius: 6,
                  background: "rgba(16, 185, 129, 0.2)",
                  color: "#6EE7B7",
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 15,
                  fontWeight: 800,
                }}
              >
                PATH B // ENGINEERED PROTOCOL
              </span>
              <span style={{ fontSize: 16, fontFamily: "monospace", color: "#10B981" }}>
                8.0% CAGR INDEX
              </span>
            </div>

            <div>
              <div
                style={{
                  fontSize: 24,
                  fontWeight: 700,
                  color: "#CBD5E1",
                  marginBottom: 12,
                }}
              >
                {rightLabel}
              </div>
              <div
                style={{
                  fontSize: 80,
                  fontWeight: 900,
                  color: rightColor,
                  fontFamily: "'JetBrains Mono', monospace",
                  lineHeight: 1.05,
                  textShadow: "0 0 36px rgba(16, 185, 129, 0.45)",
                }}
              >
                {rightValue}
              </div>
            </div>

            <div
              style={{
                paddingTop: 18,
                borderTop: "1px solid rgba(16, 185, 129, 0.25)",
                fontSize: 18,
                color: "#6EE7B7",
                lineHeight: 1.45,
              }}
            >
              Redirecting the €528 annual holiday surplus into a global equity index every January 2nd.
            </div>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

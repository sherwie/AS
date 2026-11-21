import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

interface StatCardProps {
  stat: string;
  subtitle?: string;
  statFontSize?: number;
  subtitleFontSize?: number;
  color?: string;
  accentColor?: string;
  backgroundColor?: string;
}

export const StatCard: React.FC<StatCardProps> = ({
  stat,
  subtitle,
  statFontSize = 116,
  subtitleFontSize = 30,
  color = "#F8FAFC",
  accentColor = "#EF4444",
  backgroundColor = "transparent",
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const cardSpring = spring({
    frame,
    fps,
    config: { damping: 14, stiffness: 110 },
  });

  const highlighterSwipe = spring({
    frame: frame - 14,
    fps,
    config: { damping: 16, stiffness: 90 },
  });

  const badgeSpring = spring({
    frame: frame - 24,
    fps,
    config: { damping: 14, stiffness: 120 },
  });

  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
        background: backgroundColor,
        padding: "110px 96px 120px 96px",
        fontFamily: "'Space Grotesk', 'Inter', system-ui, sans-serif",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 1560,
          background: "linear-gradient(145deg, rgba(11, 17, 30, 0.90) 0%, rgba(5, 9, 18, 0.94) 100%)",
          border: "1px solid rgba(248, 250, 252, 0.16)",
          borderTop: `5px solid ${accentColor}`,
          borderRadius: 24,
          padding: "52px 64px",
          boxShadow: "0 40px 90px rgba(0, 0, 0, 0.78)",
          transform: `scale(${interpolate(cardSpring, [0, 1], [0.92, 1])})`,
          opacity: cardSpring,
          display: "flex",
          flexDirection: "column",
          gap: 28,
        }}
      >
        {/* Top Forensic Dossier Tag Row */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            borderBottom: "1px solid rgba(248, 250, 252, 0.12)",
            paddingBottom: 20,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <span
              style={{
                padding: "6px 14px",
                borderRadius: 6,
                background: `${accentColor}26`,
                border: `1px solid ${accentColor}`,
                color: accentColor,
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 16,
                fontWeight: 800,
                letterSpacing: "0.1em",
              }}
            >
              EXHIBIT A // EMPIRICAL DELTA
            </span>
            <span
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 16,
                color: "#94A3B8",
                letterSpacing: "0.06em",
              }}
            >
              DECEMBER PLANNED CAP vs. JANUARY 15TH BANK CLEARING
            </span>
          </div>

          <div
            style={{
              padding: "6px 16px",
              borderRadius: 999,
              background: "rgba(239, 68, 68, 0.16)",
              border: "1px solid rgba(239, 68, 68, 0.5)",
              color: "#FCA5A5",
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 16,
              fontWeight: 800,
              opacity: badgeSpring,
            }}
          >
            ▲ +130.0% VARIANCE DETECTED
          </div>
        </div>

        {/* Hero Number + Visual Delta Meter */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 40,
            padding: "12px 0",
          }}
        >
          <div>
            <div
              style={{
                fontSize: 18,
                fontWeight: 700,
                color: "#94A3B8",
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                marginBottom: 10,
              }}
            >
              ACTUAL HOUSEHOLD SPEND TRAJECTORY
            </div>
            <div
              style={{
                fontSize: statFontSize,
                color: "#F8FAFC",
                fontWeight: 900,
                letterSpacing: "-0.03em",
                lineHeight: 1.05,
                whiteSpace: "nowrap",
                textShadow: `0 0 48px ${accentColor}55`,
              }}
            >
              {stat}
            </div>
          </div>

          {/* Right Side Vox-Style Breakdown Callout Box */}
          <div
            style={{
              minWidth: 460,
              background: "rgba(15, 23, 42, 0.85)",
              border: "1px solid rgba(248, 250, 252, 0.14)",
              borderRadius: 18,
              padding: "26px 32px",
              display: "flex",
              flexDirection: "column",
              gap: 16,
              opacity: badgeSpring,
              transform: `translateX(${interpolate(badgeSpring, [0, 1], [30, 0])}px)`,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 20 }}>
              <span style={{ fontSize: 17, color: "#94A3B8", fontWeight: 600 }}>NOV. MENTAL BUDGET</span>
              <span style={{ fontSize: 26, color: "#E2E8F0", fontWeight: 800, fontFamily: "monospace", whiteSpace: "nowrap" }}>€400.00</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 20 }}>
              <span style={{ fontSize: 17, color: "#94A3B8", fontWeight: 600 }}>JAN. 15 BANK LEDGER</span>
              <span style={{ fontSize: 26, color: "#EF4444", fontWeight: 800, fontFamily: "monospace", whiteSpace: "nowrap" }}>€920.00</span>
            </div>
            <div
              style={{
                height: 1,
                background: "rgba(248, 250, 252, 0.14)",
              }}
            />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 20 }}>
              <span style={{ fontSize: 17, color: "#F59E0B", fontWeight: 800, whiteSpace: "nowrap" }}>ENGINEERED RETAIL LEAK</span>
              <span
                style={{
                  fontSize: 32,
                  color: "#EF4444",
                  fontWeight: 900,
                  fontFamily: "monospace",
                  whiteSpace: "nowrap",
                }}
              >
                -€520.00
              </span>
            </div>
          </div>
        </div>

        {/* Vox Editorial Highlighter Strip under Subtitle */}
        {subtitle && (
          <div
            style={{
              position: "relative",
              padding: "18px 26px",
              borderRadius: 12,
              background: "rgba(30, 41, 59, 0.72)",
              borderLeft: "5px solid #F59E0B",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                bottom: 0,
                width: `${highlighterSwipe * 100}%`,
                background: "linear-gradient(90deg, rgba(245, 158, 11, 0.22) 0%, rgba(245, 158, 11, 0.04) 100%)",
                pointerEvents: "none",
              }}
            />
            <div
              style={{
                position: "relative",
                fontSize: subtitleFontSize,
                color,
                fontWeight: 700,
                letterSpacing: "-0.01em",
              }}
            >
              {subtitle}
            </div>
          </div>
        )}
      </div>
    </AbsoluteFill>
  );
};

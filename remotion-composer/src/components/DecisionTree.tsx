import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

export interface DecisionBranch {
  label: string;
  condition: string;
  outcome: string;
  costImpact: string;
  verdict: "trap" | "optimal" | "neutral";
}

export interface DecisionTreeProps {
  title?: string;
  rootQuestion: string;
  branches: DecisionBranch[];
  accentColor?: string;
  backgroundColor?: string;
}

export const DecisionTree: React.FC<DecisionTreeProps> = ({
  title = "DECISION-MATH PROTOCOL",
  rootQuestion,
  branches = [],
  accentColor = "#22D3EE",
  backgroundColor = "transparent",
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const rootSpring = spring({ frame, fps, config: { damping: 14, stiffness: 110 } });
  const fadeOut = interpolate(
    frame,
    [durationInFrames - 12, durationInFrames],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  return (
    <AbsoluteFill
      style={{
        background: backgroundColor,
        justifyContent: "center",
        alignItems: "center",
        padding: "105px 84px 115px 84px",
        opacity: fadeOut,
        fontFamily: "'Space Grotesk', 'Inter', system-ui, sans-serif",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 1660,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 36,
        }}
      >
        {/* Top Tag */}
        <div
          style={{
            padding: "8px 24px",
            borderRadius: 999,
            background: "rgba(34, 211, 238, 0.14)",
            border: `1px solid ${accentColor}`,
            color: accentColor,
            fontSize: 20,
            fontWeight: 700,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            opacity: rootSpring,
          }}
        >
          {title}
        </div>

        {/* Root Decision Node */}
        <div
          style={{
            padding: "28px 52px",
            borderRadius: 22,
            background: "linear-gradient(135deg, #1E293B 0%, #0F172A 100%)",
            border: `2px solid ${accentColor}`,
            boxShadow: `0 0 40px rgba(34, 211, 238, 0.2)`,
            fontSize: 40,
            fontWeight: 800,
            color: "#F8FAFC",
            textAlign: "center",
            transform: `scale(${interpolate(rootSpring, [0, 1], [0.85, 1])})`,
            opacity: rootSpring,
            maxWidth: 1200,
          }}
        >
          {rootQuestion}
        </div>

        {/* Branches Grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${Math.min(branches.length, 3)}, 1fr)`,
            gap: 32,
            width: "100%",
            marginTop: 8,
          }}
        >
          {branches.map((b, idx) => {
            const delay = 14 + idx * 10;
            const branchSpring = spring({
              frame: frame - delay,
              fps,
              config: { damping: 14, stiffness: 100 },
            });

            const borderColor =
              b.verdict === "optimal"
                ? "#10B981"
                : b.verdict === "trap"
                ? "#EF4444"
                : "#F59E0B";

            const badgeBg =
              b.verdict === "optimal"
                ? "rgba(16, 185, 129, 0.16)"
                : b.verdict === "trap"
                ? "rgba(239, 68, 68, 0.16)"
                : "rgba(245, 158, 11, 0.16)";

            return (
              <div
                key={idx}
                style={{
                  background: "rgba(15, 23, 42, 0.88)",
                  border: `2px solid ${borderColor}`,
                  borderRadius: 22,
                  padding: "32px 30px",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  gap: 20,
                  opacity: branchSpring,
                  transform: `translateY(${interpolate(
                    branchSpring,
                    [0, 1],
                    [40, 0]
                  )}px)`,
                  boxShadow: "0 20px 45px rgba(0, 0, 0, 0.45)",
                }}
              >
                <div>
                  <div
                    style={{
                      display: "inline-block",
                      padding: "6px 16px",
                      borderRadius: 999,
                      background: badgeBg,
                      color: borderColor,
                      fontSize: 17,
                      fontWeight: 800,
                      letterSpacing: "0.06em",
                      textTransform: "uppercase",
                      marginBottom: 16,
                    }}
                  >
                    {b.label}
                  </div>
                  <div
                    style={{
                      fontSize: 28,
                      fontWeight: 700,
                      color: "#F8FAFC",
                      lineHeight: 1.3,
                      marginBottom: 14,
                    }}
                  >
                    {b.condition}
                  </div>
                  <div
                    style={{
                      fontSize: 22,
                      color: "#94A3B8",
                      lineHeight: 1.45,
                    }}
                  >
                    {b.outcome}
                  </div>
                </div>

                <div
                  style={{
                    paddingTop: 18,
                    borderTop: "1px solid rgba(148, 163, 184, 0.16)",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <span
                    style={{
                      fontSize: 18,
                      color: "#94A3B8",
                      fontWeight: 600,
                    }}
                  >
                    NET RESULT
                  </span>
                  <span
                    style={{
                      fontSize: 32,
                      fontWeight: 900,
                      color: borderColor,
                      fontFamily: "'Fira Code', monospace",
                    }}
                  >
                    {b.costImpact}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
};

import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

export interface SpreadsheetRow {
  category: string;
  planned: string;
  actual: string;
  leak: string;
  status?: "ok" | "warn" | "danger";
}

export interface AnimatedSpreadsheetProps {
  title?: string;
  subtitle?: string;
  headers?: [string, string, string, string];
  rows: SpreadsheetRow[];
  totalPlanned?: string;
  totalActual?: string;
  totalLeak?: string;
  accentColor?: string;
  backgroundColor?: string;
}

export const AnimatedSpreadsheet: React.FC<AnimatedSpreadsheetProps> = ({
  title = "BUDGET AUTOPSY LEDGER",
  subtitle = "Planned Allocation vs. Real Checkout Data",
  headers = ["CATEGORY", "PLANNED", "ACTUAL SPENT", "HIDDEN LEAK"],
  rows = [],
  totalPlanned,
  totalActual,
  totalLeak,
  accentColor = "#22D3EE",
  backgroundColor = "transparent",
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const headerOpacity = spring({ frame, fps, config: { damping: 18 } });
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
        padding: "105px 88px 115px 88px",
        opacity: fadeOut,
        fontFamily: "'Space Grotesk', 'Inter', system-ui, sans-serif",
      }}
    >
      {/* Outer Glass Terminal Card */}
      <div
        style={{
          width: "100%",
          maxWidth: 1680,
          background: "rgba(15, 23, 42, 0.88)",
          border: "1px solid rgba(148, 163, 184, 0.22)",
          borderRadius: 24,
          boxShadow: "0 30px 70px rgba(0, 0, 0, 0.65)",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Top Window Chrome + Title */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "24px 36px",
            background: "rgba(30, 41, 59, 0.9)",
            borderBottom: "1px solid rgba(148, 163, 184, 0.16)",
            opacity: headerOpacity,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ display: "flex", gap: 8 }}>
              <span
                style={{
                  width: 14,
                  height: 14,
                  borderRadius: 7,
                  background: "#EF4444",
                  display: "inline-block",
                }}
              />
              <span
                style={{
                  width: 14,
                  height: 14,
                  borderRadius: 7,
                  background: "#F59E0B",
                  display: "inline-block",
                }}
              />
              <span
                style={{
                  width: 14,
                  height: 14,
                  borderRadius: 7,
                  background: "#10B981",
                  display: "inline-block",
                }}
              />
            </div>
            <div>
              <div
                style={{
                  fontSize: 32,
                  fontWeight: 800,
                  color: "#F8FAFC",
                  letterSpacing: "-0.02em",
                }}
              >
                {title}
              </div>
              {subtitle && (
                <div
                  style={{
                    fontSize: 18,
                    color: "#94A3B8",
                    fontWeight: 500,
                    marginTop: 2,
                  }}
                >
                  {subtitle}
                </div>
              )}
            </div>
          </div>

          <div
            style={{
              padding: "8px 18px",
              borderRadius: 999,
              background: "rgba(34, 211, 238, 0.12)",
              border: `1px solid ${accentColor}`,
              color: accentColor,
              fontSize: 18,
              fontWeight: 700,
              letterSpacing: "0.06em",
            }}
          >
            LIVE DECISION-MATH ENGINE
          </div>
        </div>

        {/* Column Headers */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "2.2fr 1.1fr 1.1fr 1.2fr",
            padding: "18px 36px",
            background: "rgba(15, 23, 42, 0.95)",
            borderBottom: "1px solid rgba(148, 163, 184, 0.2)",
            fontSize: 18,
            fontWeight: 700,
            color: "#94A3B8",
            letterSpacing: "0.08em",
          }}
        >
          <div>{headers[0]}</div>
          <div style={{ textAlign: "right" }}>{headers[1]}</div>
          <div style={{ textAlign: "right" }}>{headers[2]}</div>
          <div style={{ textAlign: "right" }}>{headers[3]}</div>
        </div>

        {/* Animated Rows */}
        <div style={{ display: "flex", flexDirection: "column" }}>
          {rows.map((row, idx) => {
            const delay = 8 + idx * 8;
            const rowSpring = spring({
              frame: frame - delay,
              fps,
              config: { damping: 15, stiffness: 120 },
            });
            const slideX = interpolate(rowSpring, [0, 1], [-28, 0]);
            const statusColor =
              row.status === "danger"
                ? "#EF4444"
                : row.status === "warn"
                ? "#F59E0B"
                : "#10B981";

            return (
              <div
                key={idx}
                style={{
                  display: "grid",
                  gridTemplateColumns: "2.2fr 1.1fr 1.1fr 1.2fr",
                  padding: "22px 36px",
                  alignItems: "center",
                  borderBottom: "1px solid rgba(148, 163, 184, 0.1)",
                  background:
                    idx % 2 === 0
                      ? "rgba(30, 41, 59, 0.35)"
                      : "rgba(15, 23, 42, 0.35)",
                  opacity: rowSpring,
                  transform: `translateX(${slideX}px)`,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 14,
                    fontSize: 26,
                    fontWeight: 700,
                    color: "#F8FAFC",
                  }}
                >
                  <span
                    style={{
                      width: 12,
                      height: 12,
                      borderRadius: 6,
                      background: statusColor,
                      boxShadow: `0 0 12px ${statusColor}`,
                    }}
                  />
                  {row.category}
                </div>

                <div
                  style={{
                    textAlign: "right",
                    fontSize: 26,
                    fontWeight: 600,
                    color: "#CBD5E1",
                    fontFamily: "'Fira Code', monospace",
                  }}
                >
                  {row.planned}
                </div>

                <div
                  style={{
                    textAlign: "right",
                    fontSize: 28,
                    fontWeight: 800,
                    color: "#F8FAFC",
                    fontFamily: "'Fira Code', monospace",
                  }}
                >
                  {row.actual}
                </div>

                <div
                  style={{
                    textAlign: "right",
                    fontSize: 26,
                    fontWeight: 800,
                    color: statusColor,
                    fontFamily: "'Fira Code', monospace",
                  }}
                >
                  {row.leak}
                </div>
              </div>
            );
          })}
        </div>

        {/* Summary Footer Row */}
        {(totalPlanned || totalActual || totalLeak) && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "2.2fr 1.1fr 1.1fr 1.2fr",
              padding: "24px 36px",
              alignItems: "center",
              background: "rgba(30, 41, 59, 0.95)",
              borderTop: `2px solid ${accentColor}`,
              opacity: spring({
                frame: frame - (12 + rows.length * 8),
                fps,
                config: { damping: 16 },
              }),
            }}
          >
            <div
              style={{
                fontSize: 28,
                fontWeight: 800,
                color: accentColor,
                letterSpacing: "0.04em",
              }}
            >
              TOTAL NET IMPACT
            </div>
            <div
              style={{
                textAlign: "right",
                fontSize: 30,
                fontWeight: 800,
                color: "#CBD5E1",
                fontFamily: "'Fira Code', monospace",
              }}
            >
              {totalPlanned}
            </div>
            <div
              style={{
                textAlign: "right",
                fontSize: 34,
                fontWeight: 900,
                color: "#F8FAFC",
                fontFamily: "'Fira Code', monospace",
              }}
            >
              {totalActual}
            </div>
            <div
              style={{
                textAlign: "right",
                fontSize: 34,
                fontWeight: 900,
                color: totalLeak?.startsWith("-") || totalLeak?.includes("SAVED")
                  ? "#10B981"
                  : "#EF4444",
                fontFamily: "'Fira Code', monospace",
              }}
            >
              {totalLeak}
            </div>
          </div>
        )}
      </div>
    </AbsoluteFill>
  );
};

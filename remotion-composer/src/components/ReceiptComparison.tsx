import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

export interface ReceiptItem {
  item: string;
  price: string;
  tag?: string;
  isTrap?: boolean;
}

export interface ReceiptComparisonProps {
  title?: string;
  leftReceiptTitle: string;
  leftItems: ReceiptItem[];
  leftTotal: string;
  rightReceiptTitle: string;
  rightItems: ReceiptItem[];
  rightTotal: string;
  savingsBadge?: string;
  backgroundColor?: string;
}

export const ReceiptComparison: React.FC<ReceiptComparisonProps> = ({
  title = "CHECKOUT AUTOPSY: IMPULSE VS. ENGINEERED",
  leftReceiptTitle,
  leftItems = [],
  leftTotal,
  rightReceiptTitle,
  rightItems = [],
  rightTotal,
  savingsBadge,
  backgroundColor = "transparent",
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const fadeOut = interpolate(
    frame,
    [durationInFrames - 12, durationInFrames],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  const leftCardSpring = spring({ frame: frame - 4, fps, config: { damping: 14 } });
  const rightCardSpring = spring({ frame: frame - 16, fps, config: { damping: 14 } });

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
      <div
        style={{
          width: "100%",
          maxWidth: 1640,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 28,
        }}
      >
        <div
          style={{
            fontSize: 42,
            fontWeight: 800,
            color: "#F8FAFC",
            letterSpacing: "-0.02em",
            textAlign: "center",
          }}
        >
          {title}
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 48,
            width: "100%",
          }}
        >
          {/* Left Receipt (Trap) */}
          <div
            style={{
              background: "rgba(15, 23, 42, 0.9)",
              border: "2px solid #EF4444",
              borderRadius: 24,
              padding: "32px 36px",
              opacity: leftCardSpring,
              transform: `translateX(${interpolate(leftCardSpring, [0, 1], [-40, 0])}px)`,
              boxShadow: "0 24px 60px rgba(239, 68, 68, 0.18)",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
            }}
          >
            <div>
              <div
                style={{
                  fontSize: 28,
                  fontWeight: 800,
                  color: "#EF4444",
                  borderBottom: "2px dashed rgba(239, 68, 68, 0.35)",
                  paddingBottom: 16,
                  marginBottom: 20,
                  display: "flex",
                  justifyContent: "space-between",
                }}
              >
                <span>{leftReceiptTitle}</span>
                <span>TRAP</span>
              </div>

              {leftItems.map((it, i) => {
                const itemSpring = spring({
                  frame: frame - (10 + i * 5),
                  fps,
                  config: { damping: 16 },
                });
                return (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "12px 0",
                      borderBottom: "1px solid rgba(148, 163, 184, 0.1)",
                      opacity: itemSpring,
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 23, fontWeight: 600, color: "#F8FAFC" }}>
                        {it.item}
                      </div>
                      {it.tag && (
                        <div style={{ fontSize: 16, color: "#FCA5A5", marginTop: 2 }}>
                          {it.tag}
                        </div>
                      )}
                    </div>
                    <div
                      style={{
                        fontSize: 25,
                        fontWeight: 800,
                        color: "#FCA5A5",
                        fontFamily: "'Fira Code', monospace",
                      }}
                    >
                      {it.price}
                    </div>
                  </div>
                );
              })}
            </div>

            <div
              style={{
                marginTop: 24,
                paddingTop: 18,
                borderTop: "2px dashed rgba(239, 68, 68, 0.45)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span style={{ fontSize: 26, fontWeight: 800, color: "#94A3B8" }}>
                JANUARY BILL
              </span>
              <span
                style={{
                  fontSize: 40,
                  fontWeight: 900,
                  color: "#EF4444",
                  fontFamily: "'Fira Code', monospace",
                }}
              >
                {leftTotal}
              </span>
            </div>
          </div>

          {/* Right Receipt (Engineered Plan) */}
          <div
            style={{
              background: "rgba(15, 23, 42, 0.9)",
              border: "2px solid #10B981",
              borderRadius: 24,
              padding: "32px 36px",
              opacity: rightCardSpring,
              transform: `translateX(${interpolate(rightCardSpring, [0, 1], [40, 0])}px)`,
              boxShadow: "0 24px 60px rgba(16, 185, 129, 0.18)",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
            }}
          >
            <div>
              <div
                style={{
                  fontSize: 28,
                  fontWeight: 800,
                  color: "#10B981",
                  borderBottom: "2px dashed rgba(16, 185, 129, 0.35)",
                  paddingBottom: 16,
                  marginBottom: 20,
                  display: "flex",
                  justifyContent: "space-between",
                }}
              >
                <span>{rightReceiptTitle}</span>
                <span>OPTIMIZED</span>
              </div>

              {rightItems.map((it, i) => {
                const itemSpring = spring({
                  frame: frame - (20 + i * 5),
                  fps,
                  config: { damping: 16 },
                });
                return (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "12px 0",
                      borderBottom: "1px solid rgba(148, 163, 184, 0.1)",
                      opacity: itemSpring,
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 23, fontWeight: 600, color: "#F8FAFC" }}>
                        {it.item}
                      </div>
                      {it.tag && (
                        <div style={{ fontSize: 16, color: "#6EE7B7", marginTop: 2 }}>
                          {it.tag}
                        </div>
                      )}
                    </div>
                    <div
                      style={{
                        fontSize: 25,
                        fontWeight: 800,
                        color: "#6EE7B7",
                        fontFamily: "'Fira Code', monospace",
                      }}
                    >
                      {it.price}
                    </div>
                  </div>
                );
              })}
            </div>

            <div
              style={{
                marginTop: 24,
                paddingTop: 18,
                borderTop: "2px dashed rgba(16, 185, 129, 0.45)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span style={{ fontSize: 26, fontWeight: 800, color: "#94A3B8" }}>
                TOTAL SPENT
              </span>
              <span
                style={{
                  fontSize: 40,
                  fontWeight: 900,
                  color: "#10B981",
                  fontFamily: "'Fira Code', monospace",
                }}
              >
                {rightTotal}
              </span>
            </div>
          </div>
        </div>

        {savingsBadge && (
          <div
            style={{
              padding: "12px 32px",
              borderRadius: 999,
              background: "rgba(16, 185, 129, 0.2)",
              border: "2px solid #10B981",
              color: "#10B981",
              fontSize: 26,
              fontWeight: 800,
              opacity: spring({ frame: frame - 35, fps, config: { damping: 14 } }),
            }}
          >
            {savingsBadge}
          </div>
        )}
      </div>
    </AbsoluteFill>
  );
};

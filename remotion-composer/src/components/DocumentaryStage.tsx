import React from "react";
import {
  AbsoluteFill,
  Img,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { resolveAsset } from "../lib/resolveAsset";

export interface DocumentaryStageProps {
  backgroundImage?: string;
  overlayOpacity?: number;
  chapterCode?: string;
  chapterTitle?: string;
  sourceCitation?: string;
  accentColor?: string;
  cameraMotion?: "zoom-in" | "zoom-out" | "pan-right" | "pan-left";
  children: React.ReactNode;
}

/**
 * DocumentaryStage — Vox / James Jani / MagnatesMedia Editorial Canvas
 * =====================================================================
 * - 3D Ken-Burns camera dolly over high-contrast B-roll photography
 * - Dual-layer cinematic color grade (anamorphic radial vignette + warm/slate gradient)
 * - Editorial architectural crosshair grid + 35mm fine halftone dot matrix
 * - Broadcast top telemetry bar (Chapter Code, Investigative Case ID, Source Citation)
 */
export const DocumentaryStage: React.FC<DocumentaryStageProps> = ({
  backgroundImage,
  overlayOpacity = 0.68,
  chapterCode = "CASE FILE // 2026-Q4",
  chapterTitle = "CONSUMER BANK LEDGER AUTOPSY",
  sourceCitation = "SOURCE: ECB HOUSEHOLD TRANSACTION DATASET & RETAIL TELEMETRY",
  accentColor = "#F59E0B",
  cameraMotion = "zoom-in",
  children,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const progress = interpolate(frame, [0, Math.max(30, durationInFrames)], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Smooth camera dolly motion
  let scale = 1.06 + progress * 0.14;
  let tx = interpolate(progress, [0, 1], [0, -18]);
  let ty = interpolate(progress, [0, 1], [0, -10]);

  if (cameraMotion === "zoom-out") {
    scale = 1.2 - progress * 0.12;
    tx = interpolate(progress, [0, 1], [-16, 12]);
  } else if (cameraMotion === "pan-right") {
    scale = 1.14;
    tx = interpolate(progress, [0, 1], [-28, 28]);
    ty = 0;
  } else if (cameraMotion === "pan-left") {
    scale = 1.14;
    tx = interpolate(progress, [0, 1], [28, -28]);
    ty = 0;
  }

  const headerSpring = spring({ frame, fps, config: { damping: 18, stiffness: 110 } });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#05070B",
        overflow: "hidden",
        fontFamily: "'Space Grotesk', 'Inter', system-ui, sans-serif",
      }}
    >
      {/* Layer 1: Photographic B-Roll Plate with 3D Camera Dolly */}
      {backgroundImage && (
        <Img
          src={resolveAsset(backgroundImage)}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            transform: `scale(${scale}) translate(${tx}px, ${ty}px)`,
            filter: "contrast(1.14) saturate(0.82) brightness(0.85)",
          }}
        />
      )}

      {/* Layer 2: Anamorphic Documentary Color Grade & Deep Edge Vignette */}
      <AbsoluteFill
        style={{
          background: `
            radial-gradient(ellipse at 50% 46%, rgba(6, 10, 18, ${Math.max(0.35, overlayOpacity - 0.18)}) 0%, rgba(3, 6, 12, ${Math.min(0.94, overlayOpacity + 0.18)}) 85%),
            linear-gradient(180deg, rgba(4, 7, 13, 0.85) 0%, rgba(8, 13, 23, ${overlayOpacity * 0.65}) 25%, rgba(8, 13, 23, ${overlayOpacity * 0.7}) 75%, rgba(3, 5, 10, 0.94) 100%)
          `,
        }}
      />

      {/* Layer 3: Vox / Bloomberg Architectural Blueprint Grid + Crosshairs */}
      <AbsoluteFill
        style={{
          backgroundImage: `
            linear-gradient(rgba(248, 250, 252, 0.035) 1px, transparent 1px),
            linear-gradient(90deg, rgba(248, 250, 252, 0.035) 1px, transparent 1px),
            radial-gradient(rgba(248, 250, 252, 0.08) 1px, transparent 1px)
          `,
          backgroundSize: "120px 120px, 120px 120px, 24px 24px",
          backgroundPosition: "0 0, 0 0, 12px 12px",
          pointerEvents: "none",
        }}
      />

      {/* Layer 4: Subtle Ambient Spotlight Glow matching Scene Accent */}
      <div
        style={{
          position: "absolute",
          top: "-15%",
          left: "18%",
          width: 1100,
          height: 600,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${accentColor}22 0%, transparent 70%)`,
          pointerEvents: "none",
        }}
      />

      {/* Layer 5: Editorial Broadcast Top Telemetry Header Bar */}
      <div
        style={{
          position: "absolute",
          top: 28,
          left: 64,
          right: 64,
          height: 54,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 24px",
          background: "rgba(9, 14, 24, 0.82)",
          border: "1px solid rgba(248, 250, 252, 0.14)",
          borderLeft: `4px solid ${accentColor}`,
          borderRadius: 10,
          opacity: headerSpring,
          zIndex: 20,
          boxShadow: "0 12px 32px rgba(0, 0, 0, 0.45)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <span
            style={{
              display: "inline-block",
              width: 10,
              height: 10,
              borderRadius: "50%",
              background: accentColor,
              boxShadow: `0 0 12px ${accentColor}`,
            }}
          />
          <span
            style={{
              fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
              fontSize: 15,
              fontWeight: 800,
              color: accentColor,
              letterSpacing: "0.12em",
            }}
          >
            {chapterCode}
          </span>
          <span style={{ color: "rgba(248,250,252,0.25)", fontSize: 18 }}>|</span>
          <span
            style={{
              fontSize: 16,
              fontWeight: 700,
              color: "#F8FAFC",
              letterSpacing: "0.06em",
              textTransform: "uppercase",
            }}
          >
            {chapterTitle}
          </span>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 18,
            fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
            fontSize: 13,
            color: "#94A3B8",
            letterSpacing: "0.08em",
          }}
        >
          <span>{sourceCitation}</span>
          <span
            style={{
              padding: "3px 10px",
              borderRadius: 4,
              background: "rgba(248, 250, 252, 0.08)",
              color: "#E2E8F0",
              fontWeight: 700,
            }}
          >
            REC ● 1080P
          </span>
        </div>
      </div>

      {/* Layer 6: Main Foreground Scene Content */}
      <AbsoluteFill style={{ zIndex: 10 }}>{children}</AbsoluteFill>

      {/* Layer 7: Editorial Corner Frame Registration Marks */}
      <div
        style={{
          position: "absolute",
          bottom: 24,
          left: 64,
          right: 64,
          display: "flex",
          justifyContent: "space-between",
          pointerEvents: "none",
          zIndex: 20,
          fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
          fontSize: 12,
          color: "rgba(148, 163, 184, 0.55)",
          letterSpacing: "0.12em",
        }}
      >
        <span>THE DECISION LEDGER // FINANCIAL FORENSICS UNIT</span>
        <span>SCALE: 1:1 EUR // VERIFIED EMPIRICAL MODEL</span>
      </div>
    </AbsoluteFill>
  );
};

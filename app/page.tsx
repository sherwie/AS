"use client";

import React, { useEffect, useRef, useState } from "react";

interface WordTiming {
  word: string;
  start: number;
  end: number;
}

interface SceneRecord {
  id: string;
  section: string;
  narration: string;
  visual_type: string;
  in_seconds: number;
  out_seconds: number;
  duration: number;
  word_count: number;
  thumbnail_url?: string;
  audio_url?: string;
  words?: WordTiming[];
}

interface EpisodeManifest {
  id: string;
  title: string;
  series: string;
  channel: string;
  niche: string;
  target_rpm: string;
  voice: string;
  total_duration_seconds: number;
  total_words: number;
  scene_count: number;
  video_url: string;
  master_audio_url: string;
  voiceover_url: string;
  music_url: string;
  otio_url: string;
  props_url: string;
  loudness_standard: string;
  resolution: string;
  scenes: SceneRecord[];
}

interface RoadmapEpisode {
  episode: number;
  season: string;
  id: string;
  title: string;
  status: string;
  hook_tension: string;
  key_visuals: string[];
  digital_product_cta: string;
}

export default function StudioReviewDashboard() {
  const [data, setData] = useState<{
    status: string;
    manifest: EpisodeManifest | null;
    blueprint: Record<string, unknown> | null;
    ep2Blueprint: Record<string, unknown> | null;
    roadmap: {
      series_title: string;
      positioning: string;
      episodes: RoadmapEpisode[];
    } | null;
  } | null>(null);
  const [activeTab, setActiveTab] = useState<
    "player" | "blueprint" | "roadmap" | "pipeline"
  >("player");
  const [currentTime, setCurrentTime] = useState(0);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    const fetchStatus = async () => {
      try {
        const res = await fetch("/api/studio", { cache: "no-store" });
        const json = await res.json();
        setData(json);
        if (json.status !== "ready") {
          timer = setTimeout(fetchStatus, 3000);
        }
      } catch {
        timer = setTimeout(fetchStatus, 3000);
      }
    };
    fetchStatus();
    return () => clearTimeout(timer);
  }, []);

  const manifest = data?.manifest;
  const activeScene = manifest?.scenes.find(
    (s) => currentTime >= s.in_seconds && currentTime <= s.out_seconds
  );

  const jumpToScene = (sec: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = sec + 0.05;
      videoRef.current.play().catch(() => {});
    }
  };

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    const ms = Math.floor((sec % 1) * 10);
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${ms}`;
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#070B14",
        color: "#F8FAFC",
        fontFamily:
          "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      }}
    >
      {/* Top Studio Header */}
      <header
        style={{
          borderBottom: "1px solid rgba(148, 163, 184, 0.16)",
          background: "rgba(15, 23, 42, 0.85)",
          backdropFilter: "blur(12px)",
          padding: "18px 32px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          position: "sticky",
          top: 0,
          zIndex: 30,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: 10,
              background: "linear-gradient(135deg, #22D3EE 0%, #10B981 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 900,
              color: "#0F172A",
              fontSize: 18,
            }}
          >
            DL
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontWeight: 800, fontSize: 18 }}>
                THE DECISION LEDGER
              </span>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  padding: "3px 10px",
                  borderRadius: 999,
                  background: "rgba(16, 185, 129, 0.16)",
                  color: "#10B981",
                  border: "1px solid rgba(16, 185, 129, 0.4)",
                }}
              >
                AUTOMATED STUDIO • RPM $18–$28+
              </span>
            </div>
            <div style={{ fontSize: 12, color: "#94A3B8", marginTop: 2 }}>
              OpenMontage + Remotion 1080p Engine • Word-Level Neural TTS Sync •
              FFmpeg -14 LUFS • DaVinci Resolve .OTIO
            </div>
          </div>
        </div>

        {/* Navigation Pills */}
        <div style={{ display: "flex", gap: 8 }}>
          {[
            { id: "player", label: "🎬 Episode 1 Review & Timeline" },
            { id: "blueprint", label: "📐 JSON Blueprints (Ep 1 & Ep 2)" },
            { id: "roadmap", label: "🚀 6-Episode Launch Roadmap" },
            { id: "pipeline", label: "⚙️ Mac & GitHub Toolchain" },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() =>
                setActiveTab(
                  t.id as "player" | "blueprint" | "roadmap" | "pipeline"
                )
              }
              style={{
                padding: "9px 16px",
                borderRadius: 10,
                border:
                  activeTab === t.id
                    ? "1px solid #22D3EE"
                    : "1px solid rgba(148, 163, 184, 0.2)",
                background:
                  activeTab === t.id
                    ? "rgba(34, 211, 238, 0.14)"
                    : "rgba(30, 41, 59, 0.6)",
                color: activeTab === t.id ? "#22D3EE" : "#CBD5E1",
                fontWeight: 700,
                fontSize: 13,
                cursor: "pointer",
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </header>

      <main style={{ maxWidth: 1600, margin: "0 auto", padding: "28px 32px" }}>
        {!manifest ? (
          <div
            style={{
              padding: 48,
              borderRadius: 20,
              background: "rgba(15, 23, 42, 0.9)",
              border: "1px solid rgba(34, 211, 238, 0.3)",
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: 22, fontWeight: 800, color: "#22D3EE" }}>
              Rendering 1080p Motion Graphics & Mastering Audio (-14 LUFS)...
            </div>
            <div style={{ fontSize: 14, color: "#94A3B8", marginTop: 8 }}>
              This page automatically refreshes the moment Remotion and FFmpeg
              finish compiling Episode 1.
            </div>
          </div>
        ) : (
          <>
            {activeTab === "player" && (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1.45fr 1fr",
                  gap: 28,
                  alignItems: "start",
                }}
              >
                {/* Left Column: 1080p Video Player & Download Bar */}
                <div
                  style={{ display: "flex", flexDirection: "column", gap: 18 }}
                >
                  <div
                    style={{
                      background: "#0F172A",
                      border: "1px solid rgba(148, 163, 184, 0.22)",
                      borderRadius: 18,
                      overflow: "hidden",
                      boxShadow: "0 24px 60px rgba(0, 0, 0, 0.6)",
                    }}
                  >
                    <video
                      ref={videoRef}
                      src={manifest.video_url}
                      controls
                      onTimeUpdate={(e) =>
                        setCurrentTime(e.currentTarget.currentTime)
                      }
                      style={{
                        width: "100%",
                        aspectRatio: "16 / 9",
                        display: "block",
                        background: "#000",
                      }}
                    />

                    <div style={{ padding: "20px 24px" }}>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          marginBottom: 8,
                        }}
                      >
                        <span
                          style={{
                            fontSize: 12,
                            fontWeight: 700,
                            color: "#22D3EE",
                            letterSpacing: "0.08em",
                            textTransform: "uppercase",
                          }}
                        >
                          EPISODE 01 • {manifest.series}
                        </span>
                        <span
                          style={{
                            fontSize: 12,
                            fontFamily: "monospace",
                            color: "#94A3B8",
                          }}
                        >
                          {formatTime(currentTime)} /{" "}
                          {formatTime(manifest.total_duration_seconds)} •{" "}
                          {manifest.resolution}
                        </span>
                      </div>
                      <h1
                        style={{
                          fontSize: 22,
                          fontWeight: 800,
                          color: "#F8FAFC",
                          margin: "0 0 14px 0",
                          lineHeight: 1.35,
                        }}
                      >
                        {manifest.title}
                      </h1>

                      {/* Production Export & DaVinci Resolve Download Buttons */}
                      <div
                        style={{
                          display: "flex",
                          flexWrap: "wrap",
                          gap: 10,
                          paddingTop: 14,
                          borderTop: "1px solid rgba(148, 163, 184, 0.14)",
                        }}
                      >
                        <a
                          href={manifest.video_url}
                          download
                          style={{
                            padding: "10px 18px",
                            borderRadius: 10,
                            background: "#10B981",
                            color: "#052E16",
                            fontWeight: 800,
                            fontSize: 13,
                            textDecoration: "none",
                          }}
                        >
                          ⬇ Download Final 1080p MP4
                        </a>
                        <a
                          href={manifest.otio_url}
                          download
                          style={{
                            padding: "10px 16px",
                            borderRadius: 10,
                            background: "rgba(34, 211, 238, 0.14)",
                            border: "1px solid #22D3EE",
                            color: "#22D3EE",
                            fontWeight: 700,
                            fontSize: 13,
                            textDecoration: "none",
                          }}
                        >
                          🎬 DaVinci Resolve Timeline (.otio)
                        </a>
                        <a
                          href={manifest.master_audio_url}
                          download
                          style={{
                            padding: "10px 14px",
                            borderRadius: 10,
                            background: "rgba(30, 41, 59, 0.9)",
                            border: "1px solid rgba(148, 163, 184, 0.25)",
                            color: "#CBD5E1",
                            fontWeight: 600,
                            fontSize: 13,
                            textDecoration: "none",
                          }}
                        >
                          🔊 -14 LUFS Master WAV
                        </a>
                        <a
                          href={manifest.props_url}
                          download
                          style={{
                            padding: "10px 14px",
                            borderRadius: 10,
                            background: "rgba(30, 41, 59, 0.9)",
                            border: "1px solid rgba(148, 163, 184, 0.25)",
                            color: "#CBD5E1",
                            fontWeight: 600,
                            fontSize: 13,
                            textDecoration: "none",
                          }}
                        >
                          📄 Remotion Props JSON
                        </a>
                      </div>
                    </div>
                  </div>

                  {/* Multi-Track NLE Timeline Preview (V1 Visuals / A1 Voiceover / A2 Ducked Music) */}
                  <div
                    style={{
                      background: "#0F172A",
                      border: "1px solid rgba(148, 163, 184, 0.2)",
                      borderRadius: 16,
                      padding: "18px 22px",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom: 12,
                      }}
                    >
                      <span
                        style={{
                          fontSize: 13,
                          fontWeight: 800,
                          color: "#CBD5E1",
                          letterSpacing: "0.06em",
                        }}
                      >
                        OPEN-TIMELINE-IO (.OTIO) FRAME-SYNCED TRACKS
                      </span>
                      <span style={{ fontSize: 12, color: "#10B981" }}>
                        ✔ {manifest.loudness_standard}
                      </span>
                    </div>

                    {/* Track V1 */}
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        marginBottom: 8,
                      }}
                    >
                      <span
                        style={{
                          width: 95,
                          fontSize: 11,
                          fontWeight: 700,
                          color: "#22D3EE",
                          fontFamily: "monospace",
                        }}
                      >
                        V1_Visuals
                      </span>
                      <div
                        style={{
                          flex: 1,
                          display: "flex",
                          gap: 3,
                          height: 32,
                        }}
                      >
                        {manifest.scenes.map((s) => {
                          const widthPct =
                            (s.duration / manifest.total_duration_seconds) *
                            100;
                          const isCurrent = activeScene?.id === s.id;
                          return (
                            <div
                              key={s.id}
                              onClick={() => jumpToScene(s.in_seconds)}
                              title={`${s.section} (${s.visual_type})`}
                              style={{
                                width: `${widthPct}%`,
                                background: isCurrent
                                  ? "rgba(34, 211, 238, 0.35)"
                                  : "rgba(30, 41, 59, 0.9)",
                                border: isCurrent
                                  ? "1px solid #22D3EE"
                                  : "1px solid rgba(148, 163, 184, 0.25)",
                                borderRadius: 6,
                                fontSize: 10,
                                fontWeight: 700,
                                color: "#F8FAFC",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                cursor: "pointer",
                                overflow: "hidden",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {s.visual_type}
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Track A1 */}
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        marginBottom: 8,
                      }}
                    >
                      <span
                        style={{
                          width: 95,
                          fontSize: 11,
                          fontWeight: 700,
                          color: "#10B981",
                          fontFamily: "monospace",
                        }}
                      >
                        A1_Voiceover
                      </span>
                      <div
                        style={{
                          flex: 1,
                          display: "flex",
                          gap: 3,
                          height: 26,
                        }}
                      >
                        {manifest.scenes.map((s) => {
                          const widthPct =
                            (s.duration / manifest.total_duration_seconds) *
                            100;
                          return (
                            <div
                              key={s.id}
                              onClick={() => jumpToScene(s.in_seconds)}
                              style={{
                                width: `${widthPct}%`,
                                background: "rgba(16, 185, 129, 0.18)",
                                border: "1px solid rgba(16, 185, 129, 0.45)",
                                borderRadius: 5,
                                fontSize: 10,
                                color: "#6EE7B7",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                cursor: "pointer",
                              }}
                            >
                              {s.word_count}w
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Track A2 */}
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                      }}
                    >
                      <span
                        style={{
                          width: 95,
                          fontSize: 11,
                          fontWeight: 700,
                          color: "#F59E0B",
                          fontFamily: "monospace",
                        }}
                      >
                        A2_Music
                      </span>
                      <div
                        style={{
                          flex: 1,
                          height: 24,
                          background: "rgba(245, 158, 11, 0.14)",
                          border: "1px solid rgba(245, 158, 11, 0.4)",
                          borderRadius: 5,
                          fontSize: 10,
                          color: "#FCD34D",
                          display: "flex",
                          alignItems: "center",
                          padding: "0 12px",
                        }}
                      >
                        Dark Studio Ambient Pulse (Auto-Ducked via FFmpeg
                        Sidechain Compression under A1 Speech)
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right Column: Scene-by-Scene Storyboard & Script Inspector */}
                <div
                  style={{
                    background: "#0F172A",
                    border: "1px solid rgba(148, 163, 184, 0.2)",
                    borderRadius: 18,
                    padding: "20px",
                    maxHeight: "84vh",
                    overflowY: "auto",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: 16,
                    }}
                  >
                    <span style={{ fontWeight: 800, fontSize: 15 }}>
                      SCENE-BY-SCENE STORYBOARD ({manifest.scene_count} SCENES •{" "}
                      {manifest.total_words} WORDS)
                    </span>
                    <span style={{ fontSize: 12, color: "#94A3B8" }}>
                      Click any card to seek
                    </span>
                  </div>

                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 14,
                    }}
                  >
                    {manifest.scenes.map((scene, idx) => {
                      const isCurrent = activeScene?.id === scene.id;
                      return (
                        <div
                          key={scene.id}
                          onClick={() => jumpToScene(scene.in_seconds)}
                          style={{
                            padding: 14,
                            borderRadius: 14,
                            background: isCurrent
                              ? "rgba(34, 211, 238, 0.1)"
                              : "rgba(30, 41, 59, 0.55)",
                            border: isCurrent
                              ? "1px solid #22D3EE"
                              : "1px solid rgba(148, 163, 184, 0.15)",
                            cursor: "pointer",
                            display: "grid",
                            gridTemplateColumns: "150px 1fr",
                            gap: 14,
                            alignItems: "center",
                          }}
                        >
                          {scene.thumbnail_url ? (
                            <img
                              src={scene.thumbnail_url}
                              alt={scene.id}
                              style={{
                                width: 150,
                                height: 84,
                                objectFit: "cover",
                                borderRadius: 8,
                                border: "1px solid rgba(148, 163, 184, 0.25)",
                              }}
                            />
                          ) : (
                            <div
                              style={{
                                width: 150,
                                height: 84,
                                borderRadius: 8,
                                background: "#1E293B",
                              }}
                            />
                          )}

                          <div>
                            <div
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                marginBottom: 4,
                              }}
                            >
                              <span
                                style={{
                                  fontSize: 11,
                                  fontWeight: 800,
                                  color: "#22D3EE",
                                }}
                              >
                                SCENE 0{idx + 1} •{" "}
                                {scene.visual_type.toUpperCase()}
                              </span>
                              <span
                                style={{
                                  fontSize: 11,
                                  fontFamily: "monospace",
                                  color: "#94A3B8",
                                }}
                              >
                                {formatTime(scene.in_seconds)} →{" "}
                                {formatTime(scene.out_seconds)} (
                                {scene.duration.toFixed(1)}s)
                              </span>
                            </div>
                            <div
                              style={{
                                fontSize: 13,
                                fontWeight: 700,
                                color: "#F8FAFC",
                                marginBottom: 6,
                              }}
                            >
                              {scene.section}
                            </div>
                            <p
                              style={{
                                fontSize: 12.5,
                                color: "#CBD5E1",
                                margin: 0,
                                lineHeight: 1.45,
                              }}
                            >
                              &ldquo;{scene.narration}&rdquo;
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {activeTab === "blueprint" && (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 24,
                }}
              >
                <div
                  style={{
                    background: "#0F172A",
                    border: "1px solid rgba(148, 163, 184, 0.2)",
                    borderRadius: 16,
                    padding: 22,
                  }}
                >
                  <h2 style={{ margin: "0 0 8px 0", fontSize: 18 }}>
                    Episode 1 Blueprint: The €400 Christmas Money Trap (Rendered)
                  </h2>
                  <p style={{ fontSize: 13, color: "#94A3B8", marginBottom: 14 }}>
                    File: <code>pipeline/blueprints/ep01_christmas_400_plan.json</code>
                  </p>
                  <pre
                    style={{
                      background: "#070B14",
                      padding: 16,
                      borderRadius: 12,
                      fontSize: 12,
                      color: "#6EE7B7",
                      overflowX: "auto",
                      maxHeight: "70vh",
                    }}
                  >
                    {JSON.stringify(data?.blueprint, null, 2)}
                  </pre>
                </div>

                <div
                  style={{
                    background: "#0F172A",
                    border: "1px solid rgba(148, 163, 184, 0.2)",
                    borderRadius: 16,
                    padding: 22,
                  }}
                >
                  <h2 style={{ margin: "0 0 8px 0", fontSize: 18 }}>
                    Episode 2 Blueprint: The January Debt Reset (Ready to Render)
                  </h2>
                  <p style={{ fontSize: 13, color: "#94A3B8", marginBottom: 14 }}>
                    File: <code>pipeline/blueprints/ep02_january_debt_reset.json</code>
                  </p>
                  <pre
                    style={{
                      background: "#070B14",
                      padding: 16,
                      borderRadius: 12,
                      fontSize: 12,
                      color: "#38BDF8",
                      overflowX: "auto",
                      maxHeight: "70vh",
                    }}
                  >
                    {JSON.stringify(data?.ep2Blueprint, null, 2)}
                  </pre>
                </div>
              </div>
            )}

            {activeTab === "roadmap" && data?.roadmap && (
              <div
                style={{
                  background: "#0F172A",
                  border: "1px solid rgba(148, 163, 184, 0.2)",
                  borderRadius: 18,
                  padding: 28,
                }}
              >
                <h2 style={{ margin: "0 0 6px 0", fontSize: 22 }}>
                  {data.roadmap.series_title}
                </h2>
                <p style={{ color: "#94A3B8", margin: "0 0 24px 0" }}>
                  {data.roadmap.positioning}
                </p>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(2, 1fr)",
                    gap: 18,
                  }}
                >
                  {data.roadmap.episodes.map((ep) => (
                    <div
                      key={ep.id}
                      style={{
                        padding: 20,
                        borderRadius: 14,
                        background: "rgba(30, 41, 59, 0.6)",
                        border:
                          ep.status === "RENDERED_AND_READY"
                            ? "1px solid #10B981"
                            : "1px solid rgba(148, 163, 184, 0.2)",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          marginBottom: 8,
                        }}
                      >
                        <span
                          style={{
                            fontSize: 12,
                            fontWeight: 800,
                            color: "#22D3EE",
                          }}
                        >
                          EPISODE 0{ep.episode} • {ep.season}
                        </span>
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 800,
                            color:
                              ep.status === "RENDERED_AND_READY"
                                ? "#10B981"
                                : "#F59E0B",
                          }}
                        >
                          {ep.status}
                        </span>
                      </div>
                      <h3 style={{ fontSize: 16, margin: "0 0 10px 0" }}>
                        {ep.title}
                      </h3>
                      <p
                        style={{
                          fontSize: 13,
                          color: "#CBD5E1",
                          margin: "0 0 12px 0",
                        }}
                      >
                        <strong>Hook Math:</strong> {ep.hook_tension}
                      </p>
                      <div
                        style={{
                          fontSize: 12,
                          color: "#94A3B8",
                          display: "flex",
                          justifyContent: "space-between",
                        }}
                      >
                        <span>
                          Visuals: {ep.key_visuals.slice(0, 4).join(", ")}
                        </span>
                        <span style={{ color: "#10B981", fontWeight: 700 }}>
                          Product: {ep.digital_product_cta}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === "pipeline" && (
              <div
                style={{
                  background: "#0F172A",
                  border: "1px solid rgba(148, 163, 184, 0.2)",
                  borderRadius: 18,
                  padding: 28,
                  lineHeight: 1.6,
                }}
              >
                <h2 style={{ marginTop: 0 }}>
                  Automated GitHub & Local Mac Production Architecture
                </h2>
                <p style={{ color: "#CBD5E1" }}>
                  Everything is wired in your repository so you can either let me
                  generate and render complete episodes for you here, or run one
                  command on your Mac using your local Apple Silicon voice and{" "}
                  <code>whisper.cpp</code> installation:
                </p>
                <pre
                  style={{
                    background: "#070B14",
                    padding: 18,
                    borderRadius: 12,
                    color: "#22D3EE",
                    fontSize: 13,
                  }}
                >
                  {`# Render Episode 1 or Episode 2 end-to-end (TTS + Word Timestamps + Remotion 1080p + FFmpeg -14 LUFS + DaVinci .otio)
python3 pipeline/produce_episode.py --blueprint pipeline/blueprints/ep01_christmas_400_plan.json
python3 pipeline/produce_episode.py --blueprint pipeline/blueprints/ep02_january_debt_reset.json

# Or on your Mac with local whisper.cpp & Kokoro/Piper TTS:
bash pipeline/mac_local_voice_sync.sh pipeline/blueprints/ep01_christmas_400_plan.json`}
                </pre>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

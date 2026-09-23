import { type RefObject, useEffect, useMemo, useState } from "react";
import type { CameraError } from "../hooks/useCamera";
import type { FaceReadouts } from "../hooks/useFaceDetector";
import CameraCapture from "./CameraCapture";

interface Props {
  videoRef: RefObject<HTMLVideoElement | null>;
  cameraReady: boolean;
  cameraError: CameraError;
  attachStream: (video: HTMLVideoElement | null) => void;
  readouts: FaceReadouts | null;
  onCancel: () => void;
  onRunMatch: () => void;
}

const terminalLines = [
  "booting facial analysis kernel",
  "locking landmark topology [478 points]",
  "measuring pose and landmark stability",
  "reading expression action units",
  "profiling facial geometry",
  "checking image quality and occlusion",
  "preparing archive similarity search",
];

export default function AnalysisTerminal({
  videoRef,
  cameraReady,
  cameraError,
  attachStream,
  readouts,
  onCancel,
  onRunMatch,
}: Props) {
  const [lineCount, setLineCount] = useState(0);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setLineCount((current) => {
        const next = Math.min(current + 1, terminalLines.length);
        if (next === terminalLines.length) setReady(true);
        return next;
      });
    }, 480);
    return () => window.clearInterval(interval);
  }, []);

  const reportRows = useMemo(() => [
    ["EXPRESSION SIGNAL", readouts?.expression ?? "pending"],
    ["JAW GEOMETRY", readouts?.jawShape ?? "pending"],
    ["EYE OPENNESS", readouts?.eyeOpenness ?? "pending"],
    ["EYE SPACING", readouts?.eyeSpacing ?? "pending"],
    ["NOSE PROPORTION", readouts?.noseWidth ?? "pending"],
    ["MOUTH PROPORTION", readouts?.mouthWidth ?? "pending"],
    ["IDENTITY", "deferred to archive match"],
    ["SENSITIVE ATTRIBUTES", "not inferred"],
  ], [readouts]);

  return (
    <main style={shell}>
      <header style={header}>
        <span style={eyebrow}>ARCHIVE DIAGNOSTIC CONSOLE / SESSION 01</span>
        <h1 style={title}>FACIAL ANALYSIS TERMINAL</h1>
        <p style={subtitle}>Model outputs are approximate measurements, not conclusions about identity or character.</p>
      </header>

      <section style={workspace}>
        <div style={terminal} aria-live="polite">
          <div style={terminalHeader}>
            <span>MODEL_PIPELINE</span>
            <span style={online}>● ONLINE</span>
          </div>
          {terminalLines.slice(0, lineCount).map((line, index) => (
            <div key={line} style={logLine}>
              <span style={prompt}>{String(index + 1).padStart(2, "0")} &gt;</span>
              <span>{line}</span>
              <span style={complete}>OK</span>
            </div>
          ))}
          {!ready && <div style={cursor}>▌ processing...</div>}
          {ready && <div style={cursor}>▌ analysis complete</div>}
        </div>

        <div style={readoutPanel}>
          <div style={panelHeading}>OBSERVED SIGNALS</div>
          {reportRows.map(([label, value]) => (
            <div key={label} style={readoutRow}>
              <span>{label}</span>
              <strong style={readoutValue}>{value}</strong>
            </div>
          ))}
        </div>
      </section>

      <div style={footer}>
        <button style={secondaryButton} onClick={onCancel}>RETURN TO SCAN</button>
        <div style={cameraPreview}>
          <CameraCapture videoRef={videoRef} ready={cameraReady} attachStream={attachStream} />
          {!cameraReady && <span style={previewText}>CAMERA OFFLINE</span>}
        </div>
        <button
          style={{ ...matchButton, opacity: ready && cameraReady ? 1 : 0.35 }}
          disabled={!ready || !cameraReady || Boolean(cameraError)}
          onClick={onRunMatch}
        >
          EXECUTE ARCHIVE MATCH
        </button>
      </div>
    </main>
  );
}

const shell: React.CSSProperties = {
  minHeight: "100dvh",
  boxSizing: "border-box",
  padding: "32px clamp(18px, 5vw, 72px) 28px",
  background: "#03080e",
  color: "#91efff",
  fontFamily: "var(--font-mono)",
  display: "flex",
  flexDirection: "column",
  gap: 22,
};
const header: React.CSSProperties = { borderBottom: "1px solid rgba(70, 221, 255, 0.28)", paddingBottom: 16 };
const eyebrow: React.CSSProperties = { fontSize: 10, letterSpacing: "0.2em", color: "#42c8e8" };
const title: React.CSSProperties = { margin: "14px 0 8px", fontSize: "clamp(24px, 4vw, 48px)", letterSpacing: "0.08em", fontWeight: 500, color: "#d7fbff" };
const subtitle: React.CSSProperties = { margin: 0, color: "#5d91a0", fontSize: 11, letterSpacing: "0.04em" };
const workspace: React.CSSProperties = { flex: 1, display: "grid", gridTemplateColumns: "minmax(0, 1.4fr) minmax(280px, 0.8fr)", gap: 18, minHeight: 0 };
const terminal: React.CSSProperties = { background: "#020509", border: "1px solid rgba(63, 207, 238, 0.35)", padding: 20, boxShadow: "inset 0 0 42px rgba(0, 161, 207, 0.08)" };
const terminalHeader: React.CSSProperties = { display: "flex", justifyContent: "space-between", borderBottom: "1px solid rgba(63, 207, 238, 0.2)", paddingBottom: 12, marginBottom: 18, fontSize: 11, letterSpacing: "0.14em" };
const online: React.CSSProperties = { color: "#6dffbf" };
const logLine: React.CSSProperties = { display: "grid", gridTemplateColumns: "34px 1fr auto", gap: 10, marginBottom: 14, fontSize: 12, color: "#9cecf7" };
const prompt: React.CSSProperties = { color: "#247f91" };
const complete: React.CSSProperties = { color: "#69e8b0", fontSize: 10 };
const cursor: React.CSSProperties = { color: "#52d9ee", marginTop: 22, fontSize: 12 };
const readoutPanel: React.CSSProperties = { border: "1px solid rgba(63, 207, 238, 0.3)", padding: 18, background: "rgba(3, 19, 28, 0.64)" };
const panelHeading: React.CSSProperties = { fontSize: 11, letterSpacing: "0.16em", color: "#43c9e6", paddingBottom: 14, borderBottom: "1px solid rgba(63, 207, 238, 0.2)", marginBottom: 4 };
const readoutRow: React.CSSProperties = { display: "flex", justifyContent: "space-between", gap: 14, padding: "12px 0", borderBottom: "1px solid rgba(63, 207, 238, 0.12)", fontSize: 10, color: "#5c9ba9" };
const readoutValue: React.CSSProperties = { color: "#b6f5ff", textAlign: "right" };
const footer: React.CSSProperties = { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, borderTop: "1px solid rgba(70, 221, 255, 0.28)", paddingTop: 18 };
const secondaryButton: React.CSSProperties = { border: "1px solid #246778", background: "transparent", color: "#6bb3c1", padding: "13px 18px", fontFamily: "inherit", letterSpacing: "0.12em", cursor: "pointer" };
const matchButton: React.CSSProperties = { border: "1px solid #65edff", background: "rgba(54, 190, 219, 0.14)", color: "#d9fcff", padding: "13px 18px", fontFamily: "inherit", letterSpacing: "0.1em", cursor: "pointer" };
const cameraPreview: React.CSSProperties = { position: "relative", width: 118, height: 72, overflow: "hidden", border: "1px solid rgba(63, 207, 238, 0.3)" };
const previewText: React.CSSProperties = { position: "absolute", inset: 0, display: "grid", placeItems: "center", fontSize: 9, color: "#d96868" };

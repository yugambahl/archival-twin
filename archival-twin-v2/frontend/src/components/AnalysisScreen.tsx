import { type RefObject, useCallback, useEffect, useRef, useState } from "react";
import { useFaceDetector, type FaceLandmark3D, type FaceReadouts } from "../hooks/useFaceDetector";
import type { CameraError } from "../hooks/useCamera";
import CameraCapture from "./CameraCapture";
import FaceMask3D from "./FaceMask3D";

interface Props {
  videoRef: RefObject<HTMLVideoElement | null>;
  cameraReady: boolean;
  cameraError: CameraError;
  attachStream: (video: HTMLVideoElement | null) => void;
  scanProgress: number;
  onCancel: () => void;
  onAnalysisComplete: (readouts: FaceReadouts | null) => void;
}

export default function AnalysisScreen({
  videoRef,
  cameraReady,
  cameraError,
  attachStream,
  scanProgress,
  onCancel,
  onAnalysisComplete,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [landmarks, setLandmarks] = useState<FaceLandmark3D[] | null>(null);
  const [readouts, setReadouts] = useState<FaceReadouts | null>(null);
  const [videoSize, setVideoSize] = useState({ width: 0, height: 0 });
  const handleLandmarks = useCallback((next: FaceLandmark3D[] | null) => {
    setLandmarks(next);
  }, []);
  useFaceDetector(videoRef, canvasRef, false, scanProgress, handleLandmarks, setReadouts);

  useEffect(() => {
    const updateVideoSize = () => {
      const video = videoRef.current;
      if (video && video.videoWidth > 0 && video.videoHeight > 0) {
        setVideoSize({ width: video.videoWidth, height: video.videoHeight });
      }
    };
    updateVideoSize();
    const interval = window.setInterval(updateVideoSize, 250);
    return () => window.clearInterval(interval);
  }, [videoRef]);

  return (
    <>
      <style>{`
        @keyframes pulse {
          0% { transform: scale(1); box-shadow: 0 0 0 0 rgba(96, 219, 255, 0.8); }
          70% { transform: scale(1.2); box-shadow: 0 0 0 10px rgba(96, 219, 255, 0); }
          100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(96, 219, 255, 0); }
        }
      `}</style>
      <div style={shell}>
      <div style={topBar}>
        <span style={eyebrow}>FACIAL IDENTITY SCAN</span>
        <h1 style={title}>Analysing the Facial Structure</h1>
      </div>

      <div style={stageWrap}>
        <div style={frameWrap}>
          <CameraCapture videoRef={videoRef} ready={cameraReady} attachStream={attachStream} />
          <canvas ref={canvasRef} style={detectorCanvasStyle} />
          <FaceMask3D
            landmarks={landmarks}
            progress={scanProgress}
            videoWidth={videoSize.width}
            videoHeight={videoSize.height}
          />

          <div style={scanStatusBar}>
            <span style={scanLabel}>SCAN PROGRESS</span>
            <span style={scanValue}>{Math.round(scanProgress * 100)}%</span>
          </div>
        </div>
      </div>

      <div style={footerRow}>
        <button style={secondaryBtn} onClick={onCancel}>RETURN</button>
        <button
          style={{
            ...matchBtn,
            opacity: scanProgress >= 1 && cameraReady ? 1 : 0.35,
          }}
          disabled={scanProgress < 1 || !cameraReady}
          onClick={() => onAnalysisComplete(readouts)}
        >
          FIND MATCH
        </button>
      </div>

      {cameraError && (
        <div style={errorBanner}>
          Camera access is required to begin a facial analysis.
        </div>
      )}
    </div>
    </>
  );
}

const shell: React.CSSProperties = {
  position: "relative",
  width: "100vw",
  height: "100dvh",
  display: "flex",
  flexDirection: "column",
  background: "radial-gradient(circle at 50% 30%, rgba(18, 58, 80, 0.8), rgba(3, 10, 18, 1) 48%, rgba(1, 6, 12, 1) 100%)",
  color: "#dfefff",
  overflow: "hidden",
};

const topBar: React.CSSProperties = {
  padding: "28px 32px 8px",
  display: "flex",
  flexDirection: "column",
  gap: 8,
  zIndex: 2,
};

const eyebrow: React.CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: 10,
  letterSpacing: "0.22em",
  color: "#7ad9ff",
  textTransform: "uppercase",
  opacity: 0.8,
};

const title: React.CSSProperties = {
  fontSize: "clamp(28px, 4vw, 54px)",
  lineHeight: 1.1,
  letterSpacing: "0.04em",
  color: "#edf9ff",
  fontWeight: 500,
};

const stageWrap: React.CSSProperties = {
  flex: 1,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "0 24px 22px",
};

const frameWrap: React.CSSProperties = {
  position: "relative",
  width: "min(72vw, 820px)",
  height: "min(78vh, 760px)",
  minWidth: 320,
  minHeight: 420,
  border: "1px solid rgba(120, 214, 255, 0.28)",
  background: "rgba(1, 10, 17, 0.34)",
  boxShadow: "0 0 30px rgba(68, 200, 255, 0.15)",
  overflow: "hidden",
};

const canvasStyle: React.CSSProperties = {
  position: "absolute",
  inset: 0,
  width: "100%",
  height: "100%",
  pointerEvents: "none",
  transform: "scaleX(-1)",
};

const detectorCanvasStyle: React.CSSProperties = {
  ...canvasStyle,
  display: "none",
};

const scanStatusBar: React.CSSProperties = {
  position: "absolute",
  left: 18,
  right: 18,
  bottom: 16,
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "10px 14px",
  background: "rgba(2, 12, 20, 0.58)",
  border: "1px solid rgba(123, 218, 255, 0.4)",
  backdropFilter: "blur(4px)",
};

const scanLabel: React.CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: 10,
  letterSpacing: "0.2em",
  textTransform: "uppercase",
  color: "#8adfff",
};

const scanValue: React.CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: 12,
  letterSpacing: "0.16em",
  color: "#effcff",
};

const footerRow: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "0 32px 26px",
  zIndex: 2,
};

const secondaryBtn: React.CSSProperties = {
  border: "1px solid rgba(122, 217, 255, 0.7)",
  background: "rgba(7, 26, 35, 0.52)",
  color: "#dff7ff",
  padding: "12px 22px",
  fontFamily: "var(--font-mono)",
  letterSpacing: "0.2em",
  textTransform: "uppercase",
  cursor: "pointer",
};

const matchBtn: React.CSSProperties = {
  border: "1px solid rgba(122, 217, 255, 0.9)",
  background: "rgba(76, 194, 232, 0.16)",
  color: "#effcff",
  padding: "12px 22px",
  fontFamily: "var(--font-mono)",
  letterSpacing: "0.2em",
  textTransform: "uppercase",
  cursor: "pointer",
};

const errorBanner: React.CSSProperties = {
  position: "absolute",
  left: "50%",
  bottom: 26,
  transform: "translateX(-50%)",
  background: "rgba(32, 12, 16, 0.82)",
  border: "1px solid rgba(255, 130, 130, 0.5)",
  color: "#ffdfe2",
  padding: "10px 14px",
  fontFamily: "var(--font-mono)",
  fontSize: 12,
  letterSpacing: "0.08em",
};

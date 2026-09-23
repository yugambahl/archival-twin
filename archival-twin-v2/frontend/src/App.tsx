import { useCallback, useEffect, useState } from "react";
import SplitScreen from "./components/SplitScreen";
import AnalysisScreen from "./components/AnalysisScreen";
import AnalysisTerminal from "./components/AnalysisTerminal";
import ArchivalVoicePanel from "./components/ArchivalVoicePanel";
import { useCamera } from "./hooks/useCamera";
import { useMatch } from "./hooks/useMatch";
import { getHealth } from "./api/client";
import type { FaceReadouts } from "./hooks/useFaceDetector";

export default function App() {
  const {
    videoRef,
    ready: cameraReady,
    error: cameraError,
    captureFrame,
    attachStream,
  } = useCamera();
  const { state: matchState, runMatch, reset } = useMatch();
  const [backendStatus, setBackendStatus] = useState<string>("checking");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [isTerminal, setIsTerminal] = useState(false);
  const [analysisReadouts, setAnalysisReadouts] = useState<FaceReadouts | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function check() {
      try {
        const h = await getHealth();
        if (!cancelled) setBackendStatus(h.status);
      } catch {
        if (!cancelled) setBackendStatus("unreachable");
      }
    }
    check();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!isAnalyzing) return;

    let raf = 0;
    let startedAt = 0;

    const tick = (now: number) => {
      if (!startedAt) startedAt = now;
      const next = Math.min((now - startedAt) / 4200, 1);
      setScanProgress(next);
      if (next < 1) {
        raf = requestAnimationFrame(tick);
      }
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [isAnalyzing]);

  const handleScanStart = useCallback(() => {
    setScanProgress(0);
    setIsAnalyzing(true);
  }, []);

  const handleAnalysisCancel = useCallback(() => {
    setIsAnalyzing(false);
    setIsTerminal(false);
    setScanProgress(0);
  }, []);

  const handleAnalysisComplete = useCallback((readouts: FaceReadouts | null) => {
    setAnalysisReadouts(readouts);
    setIsAnalyzing(false);
    setIsTerminal(true);
  }, []);

  const handleRunMatch = useCallback(() => {
    const frame = captureFrame();
    if (!frame) return;
    setIsTerminal(false);
    runMatch(frame);
  }, [captureFrame, runMatch]);

  if (isAnalyzing) {
    return (
      <AnalysisScreen
        videoRef={videoRef}
        cameraReady={cameraReady}
        cameraError={cameraError}
        attachStream={attachStream}
        scanProgress={scanProgress}
        onCancel={handleAnalysisCancel}
        onAnalysisComplete={handleAnalysisComplete}
      />
    );
  }

  if (isTerminal) {
    return (
      <AnalysisTerminal
        videoRef={videoRef}
        cameraReady={cameraReady}
        cameraError={cameraError}
        attachStream={attachStream}
        readouts={analysisReadouts}
        onCancel={() => setIsTerminal(false)}
        onRunMatch={handleRunMatch}
      />
    );
  }

  return (
    <>
      <SplitScreen
        videoRef={videoRef}
        cameraReady={cameraReady}
        cameraError={cameraError}
        attachStream={attachStream}
        matchState={matchState}
        backendStatus={backendStatus}
        onCapture={handleScanStart}
        onReset={reset}
        analysisReadouts={analysisReadouts}
      />
      <ArchivalVoicePanel />
    </>
  );
}

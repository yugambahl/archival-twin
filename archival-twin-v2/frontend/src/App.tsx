import { useCallback, useEffect, useState } from "react";
import SplitScreen from "./components/SplitScreen";
import AnalysisScreen from "./components/AnalysisScreen";
import ArchivalVoicePanel from "./components/ArchivalVoicePanel";
import { useCamera } from "./hooks/useCamera";
import { useMatch } from "./hooks/useMatch";
import { getHealth } from "./api/client";

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
    setScanProgress(0);
  }, []);

  const handleFindMatch = useCallback(() => {
    const frame = captureFrame();
    if (!frame) return;
    setIsAnalyzing(false);
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
        onFindMatch={handleFindMatch}
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
      />
      <ArchivalVoicePanel />
    </>
  );
}

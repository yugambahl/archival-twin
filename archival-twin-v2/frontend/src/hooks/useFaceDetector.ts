/**
 * useFaceDetector — MediaPipe FaceLandmarker
 *
 * Replaces blazeface. Gives:
 *  - bounding box drawn on canvas (same as before)
 *  - landmark-derived FaceReadouts (NEW)
 *
 * All descriptors are geometric approximations; labelled "~" in the UI.
 */

import { useEffect, useRef, useState } from "react";
import type { FaceLandmarker } from "@mediapipe/tasks-vision";

export interface FaceReadouts {
  jawShape: string;     // narrow | oval | wide
  eyeOpenness: string;  // closed | narrowed | open
  eyeSpacing: string;   // close-set | typical | wide-set
  noseWidth: string;    // narrow | medium | broad
  mouthWidth: string;   // narrow | medium | wide
  expression: string;   // neutral | smiling | frowning | surprised | mouth open
}

type Pt = { x: number; y: number };

export interface FaceLandmark3D {
  x: number;
  y: number;
  z: number;
}

function d2(a: Pt, b: Pt) {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

function bucket(v: number, lo: number, hi: number, [a, b, c]: [string, string, string]): string {
  return v < lo ? a : v < hi ? b : c;
}

function computeReadouts(
  lm: Pt[],
  blendshapeCategories: Array<{ categoryName: string; score: number }>
): FaceReadouts {
  // Face width (jaw silhouette: pts 234 ↔ 454) and height (forehead 10 ↔ chin 152)
  const jawW = d2(lm[234], lm[454]);
  const faceH = d2(lm[10], lm[152]);
  const jawRatio = jawW / (faceH || 1);

  // Eye Aspect Ratio (EAR) — left eye: outer 33, inner 133, top 159, bottom 145
  //                          right eye: outer 263, inner 362, top 386, bottom 374
  const earL = d2(lm[159], lm[145]) / (d2(lm[33], lm[133]) || 1);
  const earR = d2(lm[386], lm[374]) / (d2(lm[362], lm[263]) || 1);
  const ear = (earL + earR) / 2;

  // Inter-eye distance (inner corners 133 ↔ 362) relative to jaw width
  const eyeSpacingRatio = d2(lm[133], lm[362]) / (jawW || 1);

  // Nose width (alae 129 ↔ 358) relative to jaw width
  const noseRatio = d2(lm[129], lm[358]) / (jawW || 1);

  // Mouth width (corners 61 ↔ 291) relative to jaw width
  const mouthRatio = d2(lm[61], lm[291]) / (jawW || 1);

  // Expression from blendshapes (52 ARKit-style weights)
  let expression = "neutral";
  if (blendshapeCategories.length > 0) {
    const s: Record<string, number> = {};
    for (const c of blendshapeCategories) s[c.categoryName] = c.score;
    const smile   = ((s.mouthSmileLeft  ?? 0) + (s.mouthSmileRight  ?? 0)) / 2;
    const frown   = ((s.mouthFrownLeft  ?? 0) + (s.mouthFrownRight  ?? 0)) / 2;
    const jawOpen = s.jawOpen ?? 0;
    const wide    = ((s.eyeWideLeft     ?? 0) + (s.eyeWideRight     ?? 0)) / 2;
    if      (smile   > 0.35) expression = "smiling";
    else if (frown   > 0.25) expression = "frowning";
    else if (wide    > 0.30 && jawOpen > 0.25) expression = "surprised";
    else if (jawOpen > 0.30) expression = "mouth open";
  }

  return {
    jawShape:    bucket(jawRatio,        0.72, 0.88, ["narrow",    "oval",    "wide"]),
    eyeOpenness: bucket(ear,             0.15, 0.30, ["closed",   "narrowed", "open"]),
    eyeSpacing:  bucket(eyeSpacingRatio, 0.30, 0.42, ["close-set", "typical", "wide-set"]),
    noseWidth:   bucket(noseRatio,       0.22, 0.31, ["narrow",    "medium",  "broad"]),
    mouthWidth:  bucket(mouthRatio,      0.38, 0.50, ["narrow",    "medium",  "wide"]),
    expression,
  };
}

function drawMovieMask(
  ctx: CanvasRenderingContext2D,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  progress = 1,
) {
  // The analysis view now renders the ML landmarks through FaceMask3D.
  return;

  const width = x1 - x0;
  const height = y1 - y0;

  const padX = width * 0.18;
  const padY = height * 0.12;

  const left = x0 - padX;
  const right = x1 + padX;
  const top = y0 - padY;
  const bottom = y1 + padY * 0.8;
  const centerX = (left + right) / 2;
  const centerY = (top + bottom) / 2;
  const rx = (right - left) * 0.52;
  const ry = (bottom - top) * 0.54;
  const t = performance.now() * 0.0015;

  const visible = Math.max(0, Math.min(1, progress));
  ctx.save();

  const outerAlpha = 0.2 + visible * 0.8;
  ctx.shadowBlur = 20;
  ctx.shadowColor = "rgba(88, 219, 255, 0.95)";
  ctx.lineWidth = 2.4;
  ctx.strokeStyle = `rgba(140, 236, 255, ${outerAlpha})`;
  ctx.fillStyle = `rgba(10, 20, 32, ${0.12 + visible * 0.18})`;
  ctx.beginPath();
  ctx.ellipse(centerX, centerY, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.shadowBlur = 0;
  ctx.strokeStyle = `rgba(120, 220, 255, ${0.18 + visible * 0.55})`;
  ctx.setLineDash([5, 8]);
  ctx.beginPath();
  ctx.ellipse(centerX, centerY, rx * 0.9, ry * 0.86, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);

  const meshPoints: Array<{ x: number; y: number }> = [];
  const cols = 11;
  const rows = 9;

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const nx = (col / (cols - 1)) * 2 - 1;
      const ny = (row / (rows - 1)) * 2 - 1;
      const dr = Math.sqrt(nx * nx + ny * ny);
      const scale = dr > 1 ? 0 : 1 - dr * 0.35;
      const px = centerX + nx * rx * 0.96 * scale;
      const py = centerY + ny * ry * 0.95 * scale;
      meshPoints.push({ x: px, y: py });
    }
  }

  const buildCount = Math.max(6, Math.floor(meshPoints.length * visible));
  const pointAlpha = 0.35 + visible * 0.65;

  for (let i = 0; i < buildCount; i++) {
    const p = meshPoints[i];
    const pulse = 1.2 + Math.sin(p.x * 0.08 + t) * 0.6;
    ctx.beginPath();
    ctx.arc(p.x, p.y, pulse, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(92, 210, 255, ${pointAlpha})`;
    ctx.fill();

    const neighbors = [
      i + 1,
      i + cols,
      i + cols + 1,
      i + cols - 1,
    ].filter((idx) => idx >= 0 && idx < buildCount);

    for (const nidx of neighbors) {
      const q = meshPoints[nidx];
      const dist = Math.hypot(q.x - p.x, q.y - p.y);
      if (dist < rx * 0.38) {
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(q.x, q.y);
        ctx.strokeStyle = `rgba(112, 210, 255, ${pointAlpha * 0.7})`;
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }
  }

  if (visible > 0.18) {
    ctx.strokeStyle = `rgba(120, 220, 255, ${0.28 + visible * 0.7})`;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(centerX - rx * 0.45, centerY + ry * 0.14);
    ctx.lineTo(centerX, centerY + ry * 0.26);
    ctx.lineTo(centerX + rx * 0.45, centerY + ry * 0.14);
    ctx.stroke();
  }

  const bracketInset = 18;
  if (visible > 0.3) {
    ctx.strokeStyle = `rgba(120, 220, 255, ${0.45 + visible * 0.55})`;
    ctx.lineWidth = 2.2;

    ctx.beginPath();
    ctx.moveTo(left + bracketInset, top + bracketInset);
    ctx.lineTo(left + bracketInset * 1.8, top + bracketInset);
    ctx.lineTo(left + bracketInset, top + bracketInset * 1.8);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(right - bracketInset, top + bracketInset);
    ctx.lineTo(right - bracketInset * 1.8, top + bracketInset);
    ctx.lineTo(right - bracketInset, top + bracketInset * 1.8);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(left + bracketInset, bottom - bracketInset);
    ctx.lineTo(left + bracketInset * 1.8, bottom - bracketInset);
    ctx.lineTo(left + bracketInset, bottom - bracketInset * 1.8);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(right - bracketInset, bottom - bracketInset);
    ctx.lineTo(right - bracketInset * 1.8, bottom - bracketInset);
    ctx.lineTo(right - bracketInset, bottom - bracketInset * 1.8);
    ctx.stroke();
  }

  ctx.restore();
}

export function useFaceDetector(
  videoRef: React.RefObject<HTMLVideoElement | null>,
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  paused = false,
  scanProgress = 1,
  onLandmarks?: (landmarks: FaceLandmark3D[] | null) => void,
) {
  const [readouts, setReadouts] = useState<FaceReadouts | null>(null);
  const landmarkerRef = useRef<FaceLandmarker | null>(null);
  const pausedRef = useRef(paused);
  const scanProgressRef = useRef(scanProgress);
  useEffect(() => { pausedRef.current = paused; }, [paused]);
  useEffect(() => { scanProgressRef.current = scanProgress; }, [scanProgress]);

  useEffect(() => {
    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout>;

    async function load() {
      try {
        const { FaceLandmarker, FilesetResolver } = await import("@mediapipe/tasks-vision");
        const vision = await FilesetResolver.forVisionTasks("/mediapipe-wasm");
        landmarkerRef.current = await FaceLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath:
              "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
            delegate: "GPU",
          },
          outputFaceBlendshapes: true,
          runningMode: "VIDEO",
          numFaces: 1,
        });
      } catch {
        return; // silently skip if WASM or model unavailable
      }
      if (!cancelled) detect();
    }

    function detect() {
      if (cancelled) return;
      // When paused: keep the loop alive but skip drawing so the canvas stays frozen
      if (pausedRef.current) {
        timeoutId = setTimeout(detect, 160);
        return;
      }
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const landmarker = landmarkerRef.current;

      if (landmarker && video && canvas && video.readyState >= 2) {
        const ctx = canvas.getContext("2d");
        if (ctx) {
          const W = video.videoWidth;
          const H = video.videoHeight;
          if (canvas.width !== W) canvas.width = W;
          if (canvas.height !== H) canvas.height = H;
          ctx.clearRect(0, 0, W, H);

          try {
            const result = landmarker.detectForVideo(video, performance.now());
            if (result.faceLandmarks.length > 0) {
              const lm = result.faceLandmarks[0]; // normalized [0,1]
              onLandmarks?.(lm);

              // Bounding box from landmark extents
              let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
              for (const p of lm) {
                if (p.x * W < x0) x0 = p.x * W;
                if (p.y * H < y0) y0 = p.y * H;
                if (p.x * W > x1) x1 = p.x * W;
                if (p.y * H > y1) y1 = p.y * H;
              }
              ctx.strokeStyle = "rgba(255,255,255,0.85)";
              ctx.lineWidth = 2;
              ctx.strokeRect(x0, y0, x1 - x0, y1 - y0);

              drawMovieMask(ctx, x0, y0, x1, y1, scanProgressRef.current);

              // Landmark-derived measurements
              const blendshapes = result.faceBlendshapes?.[0]?.categories ?? [];
              setReadouts(computeReadouts(lm, blendshapes));
            } else {
              onLandmarks?.(null);
              setReadouts(null);
            }
          } catch {
            // ignore per-frame errors
          }
        }
      }

      timeoutId = setTimeout(detect, 160); // ~6fps — balanced for mobile battery
    }

    load();

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [videoRef, canvasRef, onLandmarks]);

  return { readouts };
}

import { useEffect, useRef } from "react";
import * as THREE from "three";
import type { FaceLandmark3D } from "../hooks/useFaceDetector";

interface Props {
  landmarks: FaceLandmark3D[] | null;
  progress: number;
  videoWidth: number;
  videoHeight: number;
}

// Landmark loops make the depth field legible without inventing a synthetic face.
const featureLoops = [
  [10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152],
  [152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109, 10],
  [33, 133, 159, 145, 33],
  [263, 362, 386, 374, 263],
  [61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291],
  [1, 98, 2, 327, 1],
];

function landmarkPosition(
  landmark: FaceLandmark3D,
  index: number,
  videoAspect: number,
) {
  const depth = -landmark.z * 2.8;
  return new THREE.Vector3(
    (landmark.x - 0.5) * 2 * videoAspect,
    -(landmark.y - 0.5) * 2,
    depth + index * 0.00001,
  );
}

export default function FaceMask3D({ landmarks, progress, videoWidth, videoHeight }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.OrthographicCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const pointsRef = useRef<THREE.Points | null>(null);
  const linesRef = useRef<THREE.LineSegments | null>(null);
  const animationRef = useRef<number>(0);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
    camera.position.z = 5;
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    host.appendChild(renderer.domElement);
    renderer.domElement.setAttribute("aria-hidden", "true");
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    renderer.domElement.style.objectFit = "cover";

    const pointMaterial = new THREE.PointsMaterial({
      color: 0x4f8ea1,
      size: 4.5,
      transparent: true,
      opacity: 0.82,
      sizeAttenuation: false,
    });
    const lineMaterial = new THREE.LineBasicMaterial({
      color: 0x3e7180,
      transparent: true,
      opacity: 0.5,
      depthTest: false,
    });
    const points = new THREE.Points(new THREE.BufferGeometry(), pointMaterial);
    const lines = new THREE.LineSegments(new THREE.BufferGeometry(), lineMaterial);
    scene.add(points, lines);
    sceneRef.current = scene;
    cameraRef.current = camera;
    rendererRef.current = renderer;
    pointsRef.current = points;
    linesRef.current = lines;

    const resize = () => {
      const width = host.clientWidth || 1;
      const height = host.clientHeight || 1;
      const aspect = videoWidth > 0 && videoHeight > 0 ? videoWidth / videoHeight : width / height;
      renderer.setSize(videoWidth || width, videoHeight || height, false);
      camera.left = -aspect;
      camera.right = aspect;
      camera.top = 1;
      camera.bottom = -1;
      camera.updateProjectionMatrix();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(host);
    resize();

    const render = () => {
      points.rotation.z = Math.sin(performance.now() * 0.001) * 0.002;
      renderer.render(scene, camera);
      animationRef.current = requestAnimationFrame(render);
    };
    render();

    return () => {
      cancelAnimationFrame(animationRef.current);
      observer.disconnect();
      points.geometry.dispose();
      lines.geometry.dispose();
      pointMaterial.dispose();
      lineMaterial.dispose();
      renderer.dispose();
      renderer.domElement.remove();
      sceneRef.current = null;
    };
  }, []);

  useEffect(() => {
    const renderer = rendererRef.current;
    const camera = cameraRef.current;
    const host = hostRef.current;
    if (!renderer || !camera || !host) return;
    const aspect = videoWidth > 0 && videoHeight > 0
      ? videoWidth / videoHeight
      : host.clientWidth / Math.max(host.clientHeight, 1);
    renderer.setSize(videoWidth || host.clientWidth || 1, videoHeight || host.clientHeight || 1, false);
    camera.left = -aspect;
    camera.right = aspect;
    camera.top = 1;
    camera.bottom = -1;
    camera.updateProjectionMatrix();
  }, [videoWidth, videoHeight]);

  useEffect(() => {
    const points = pointsRef.current;
    const lines = linesRef.current;
    if (!points || !lines || !landmarks) {
      if (points) points.visible = false;
      if (lines) lines.visible = false;
      return;
    }

    const videoAspect = videoWidth > 0 && videoHeight > 0
      ? videoWidth / videoHeight
      : (hostRef.current?.clientWidth || 1) / (hostRef.current?.clientHeight || 1);
    const visibleCount = Math.max(1, Math.floor(landmarks.length * Math.min(1, Math.max(0, progress))));
    const pointPositions: number[] = [];
    for (let index = 0; index < visibleCount; index++) {
      const position = landmarkPosition(landmarks[index], index, videoAspect);
      pointPositions.push(position.x, position.y, position.z);
    }
    points.geometry.setAttribute("position", new THREE.Float32BufferAttribute(pointPositions, 3));
    points.geometry.computeBoundingSphere();
    points.visible = true;

    const linePositions: number[] = [];
    for (const loop of featureLoops) {
      for (let index = 1; index < loop.length; index++) {
        const start = loop[index - 1];
        const end = loop[index];
        if (start >= visibleCount || end >= visibleCount) continue;
        const a = landmarkPosition(landmarks[start], start, videoAspect);
        const b = landmarkPosition(landmarks[end], end, videoAspect);
        linePositions.push(a.x, a.y, a.z, b.x, b.y, b.z);
      }
    }
    lines.geometry.setAttribute("position", new THREE.Float32BufferAttribute(linePositions, 3));
    lines.geometry.computeBoundingSphere();
    lines.visible = linePositions.length > 0;
  }, [landmarks, progress, videoWidth, videoHeight]);

  return <div ref={hostRef} style={containerStyle} aria-hidden="true" />;
}

const containerStyle: React.CSSProperties = {
  position: "absolute",
  inset: 0,
  pointerEvents: "none",
  overflow: "hidden",
  transform: "scaleX(-1)",
};
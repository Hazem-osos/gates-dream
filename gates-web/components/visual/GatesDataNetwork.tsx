'use client';

import { useEffect, useRef } from 'react';

type Node = { x: number; y: number; r: number };

const NODES: Node[] = [
  { x: 0.18, y: 0.28, r: 2.2 },
  { x: 0.34, y: 0.18, r: 1.8 },
  { x: 0.52, y: 0.26, r: 2.6 },
  { x: 0.7, y: 0.2, r: 1.7 },
  { x: 0.84, y: 0.36, r: 2.1 },
  { x: 0.22, y: 0.58, r: 1.6 },
  { x: 0.42, y: 0.52, r: 2.4 },
  { x: 0.62, y: 0.62, r: 1.9 },
  { x: 0.78, y: 0.7, r: 2.2 },
  { x: 0.5, y: 0.8, r: 1.8 },
];

const EDGES: Array<[number, number]> = [
  [0, 2],
  [1, 2],
  [2, 3],
  [3, 4],
  [2, 6],
  [0, 5],
  [5, 6],
  [6, 7],
  [7, 8],
  [6, 9],
  [8, 9],
];

type Props = {
  className?: string;
  opacity?: number;
};

/** Lightweight connected-data atmosphere. Isolated canvas, respects reduced motion. */
export function GatesDataNetwork({ className, opacity = 0.55 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let frame = 0;
    let raf = 0;

    const size = { w: 0, h: 0 };

    const draw = (pulse = 0) => {
      const width = size.w;
      const height = size.h;
      ctx.clearRect(0, 0, width, height);
      ctx.lineWidth = 1;
      ctx.strokeStyle = `rgba(14, 120, 170, ${0.18 + pulse * 0.08})`;
      for (const [a, b] of EDGES) {
        const na = NODES[a];
        const nb = NODES[b];
        ctx.beginPath();
        ctx.moveTo(na.x * width, na.y * height);
        ctx.lineTo(nb.x * width, nb.y * height);
        ctx.stroke();
      }
      for (const node of NODES) {
        ctx.beginPath();
        ctx.fillStyle = `rgba(20, 153, 214, ${0.45 + pulse * 0.25})`;
        ctx.arc(node.x * width, node.y * height, node.r + pulse * 0.6, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      size.w = Math.max(1, rect.width);
      size.h = Math.max(1, rect.height);
      canvas.width = Math.max(1, Math.floor(size.w * dpr));
      canvas.height = Math.max(1, Math.floor(size.h * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      canvas.style.width = `${size.w}px`;
      canvas.style.height = `${size.h}px`;
      draw(0);
    };

    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);

    if (!reduce) {
      const tick = () => {
        frame += 1;
        draw((Math.sin(frame / 40) + 1) / 2);
        raf = window.requestAnimationFrame(tick);
      };
      raf = window.requestAnimationFrame(tick);
    }

    return () => {
      observer.disconnect();
      if (raf) window.cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className={className}
      style={{ opacity, pointerEvents: 'none' }}
    />
  );
}

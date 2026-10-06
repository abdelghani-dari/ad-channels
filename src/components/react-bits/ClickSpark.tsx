"use client";

import React, { useCallback, useEffect, useRef } from "react";

type ClickSparkProps = {
  sparkColor?: string;
  sparkSize?: number;
  sparkRadius?: number;
  sparkCount?: number;
  duration?: number;
  children?: React.ReactNode;
  className?: string;
};

type Spark = { x: number; y: number; angle: number; startTime: number };

export default function ClickSpark({
  sparkColor = "#fff",
  sparkSize = 8,
  sparkRadius = 18,
  sparkCount = 8,
  duration = 360,
  children,
  className = "",
}: ClickSparkProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sparksRef = useRef<Spark[]>([]);
  const frameRef = useRef(0);

  const stop = () => {
    if (frameRef.current) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = 0;
    }
  };

  const draw = useCallback(
    (timestamp: number) => {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (!canvas || !ctx) {
        stop();
        return;
      }
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      sparksRef.current = sparksRef.current.filter((spark) => {
        const elapsed = timestamp - spark.startTime;
        if (elapsed >= duration) return false;
        const eased = 1 - (1 - elapsed / duration) * (1 - elapsed / duration);
        const distance = eased * sparkRadius;
        const lineLength = sparkSize * (1 - eased);
        const x1 = spark.x + distance * Math.cos(spark.angle);
        const y1 = spark.y + distance * Math.sin(spark.angle);
        ctx.strokeStyle = sparkColor;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x1 + lineLength * Math.cos(spark.angle), y1 + lineLength * Math.sin(spark.angle));
        ctx.stroke();
        return true;
      });
      if (sparksRef.current.length > 0) {
        frameRef.current = requestAnimationFrame(draw);
      } else {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        frameRef.current = 0;
      }
    },
    [duration, sparkColor, sparkRadius, sparkSize]
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    const parent = canvas?.parentElement;
    if (!canvas || !parent) return;
    const resize = () => {
      const { width, height } = parent.getBoundingClientRect();
      canvas.width = Math.max(1, Math.floor(width));
      canvas.height = Math.max(1, Math.floor(height));
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(parent);
    return () => {
      ro.disconnect();
      stop();
    };
  }, []);

  return (
    <div
      className={`relative ${className}`}
      onClick={(event) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        const now = performance.now();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        for (let i = 0; i < sparkCount; i += 1) {
          sparksRef.current.push({ x, y, angle: (2 * Math.PI * i) / sparkCount, startTime: now });
        }
        if (!frameRef.current) frameRef.current = requestAnimationFrame(draw);
      }}
    >
      <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 z-50" />
      {children}
    </div>
  );
}

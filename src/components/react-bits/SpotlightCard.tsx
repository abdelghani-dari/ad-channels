"use client";

import React, { useRef } from "react";

type SpotlightCardProps = React.HTMLAttributes<HTMLDivElement> & {
  spotlightColor?: string;
};

export default function SpotlightCard({
  children,
  className = "",
  spotlightColor = "rgba(255, 255, 255, 0.18)",
  onMouseMove,
  onMouseEnter,
  onMouseLeave,
  ...rest
}: SpotlightCardProps) {
  const overlayRef = useRef<HTMLDivElement>(null);

  return (
    <div
      {...rest}
      className={`relative overflow-hidden ${className}`}
      onMouseMove={(event) => {
        const node = overlayRef.current;
        const host = event.currentTarget;
        if (node) {
          const rect = host.getBoundingClientRect();
          node.style.background = `radial-gradient(circle at ${event.clientX - rect.left}px ${event.clientY - rect.top}px, ${spotlightColor}, transparent 72%)`;
          node.style.opacity = "1";
        }
        onMouseMove?.(event);
      }}
      onMouseEnter={(event) => {
        if (overlayRef.current) overlayRef.current.style.opacity = "1";
        onMouseEnter?.(event);
      }}
      onMouseLeave={(event) => {
        if (overlayRef.current) overlayRef.current.style.opacity = "0";
        onMouseLeave?.(event);
      }}
    >
      <div
        ref={overlayRef}
        className="pointer-events-none absolute inset-0 z-[1] opacity-0 transition-opacity duration-300"
      />
      <div className="relative z-[2]">{children}</div>
    </div>
  );
}

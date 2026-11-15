"use client";

import { useRef } from "react";

const DRAG_PX = 8;

/** A short press stays a click. A longer move drags the planting. */
export function PlantingDragSurface({
  id,
  label,
  detail,
  testId,
  onDragStart,
  onDragEnd,
  onDrop,
  onActivate,
}: {
  id: string;
  label: string;
  detail: string;
  testId?: string;
  onDragStart: (id: string) => void;
  onDragEnd: () => void;
  onDrop: (id: string, point: { x: number; y: number }) => void;
  onActivate: (id: string) => void;
}) {
  const drag = useRef<{ id: string; label: string; x0: number; y0: number; moved: boolean } | null>(null);
  const ghost = useRef<HTMLDivElement>(null);

  return (
    <>
      <div
        data-testid={testId}
        className="cursor-grab rounded-xl border border-border bg-background px-3 py-2 text-sm active:cursor-grabbing"
        onPointerDown={(event) => {
          if (event.pointerType === "mouse" && event.button !== 0) return;
          event.preventDefault();
          event.currentTarget.setPointerCapture(event.pointerId);
          drag.current = { id, label, x0: event.clientX, y0: event.clientY, moved: false };
        }}
        onPointerMove={(event) => {
          const current = drag.current;
          if (!current || !ghost.current) return;
          const distance = Math.hypot(event.clientX - current.x0, event.clientY - current.y0);
          if (!current.moved && distance < DRAG_PX) return;
          if (!current.moved) {
            current.moved = true;
            onDragStart(current.id);
          }
          ghost.current.hidden = false;
          ghost.current.style.left = `${event.clientX}px`;
          ghost.current.style.top = `${event.clientY}px`;
          ghost.current.textContent = current.label;
        }}
        onPointerUp={(event) => {
          const current = drag.current;
          drag.current = null;
          if (ghost.current) ghost.current.hidden = true;
          if (!current) return;
          if (!current.moved) {
            onDragEnd();
            onActivate(current.id);
            return;
          }
          onDrop(current.id, { x: event.clientX, y: event.clientY });
          onDragEnd();
        }}
        onPointerCancel={() => {
          drag.current = null;
          if (ghost.current) ghost.current.hidden = true;
          onDragEnd();
        }}
      >
        <span className="block font-medium">{label}</span>
        <span className="text-xs text-muted-foreground">{detail}</span>
      </div>
      <div ref={ghost} hidden className="planting-ghost" data-testid="drag-ghost" />
    </>
  );
}

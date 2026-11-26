"use client";

import { useRef } from "react";

const DRAG_PX = 8;

type DragState = {
  id: string;
  label: string;
  x0: number;
  y0: number;
  moved: boolean;
};

/** Pointer drag that follows the cursor. A short press without movement stays a click. */
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
  testId: string;
  onDragStart: (id: string) => void;
  onDragEnd: () => void;
  onDrop: (id: string, point: { x: number; y: number }) => void;
  onActivate: (id: string) => void;
}) {
  const drag = useRef<DragState | null>(null);
  const ghost = useRef<HTMLDivElement>(null);

  function showGhost(x: number, y: number, text: string) {
    const node = ghost.current;
    if (!node) return;
    node.hidden = false;
    node.style.left = `${x}px`;
    node.style.top = `${y}px`;
    node.textContent = text;
  }

  function hideGhost() {
    if (ghost.current) ghost.current.hidden = true;
  }

  return (
    <>
      <div
        data-testid={testId}
        className="planting-card cursor-grab rounded-lg border bg-background px-2 py-1.5 text-sm active:cursor-grabbing"
        onPointerDown={(event) => {
          if (event.pointerType === "mouse" && event.button !== 0) return;
          event.preventDefault();
          event.currentTarget.setPointerCapture(event.pointerId);
          drag.current = { id, label, x0: event.clientX, y0: event.clientY, moved: false };
        }}
        onPointerMove={(event) => {
          const current = drag.current;
          if (!current) return;
          const distance = Math.hypot(event.clientX - current.x0, event.clientY - current.y0);
          if (!current.moved && distance < DRAG_PX) return;
          if (!current.moved) {
            current.moved = true;
            onDragStart(current.id);
          }
          showGhost(event.clientX, event.clientY, current.label);
        }}
        onPointerUp={(event) => {
          const current = drag.current;
          drag.current = null;
          hideGhost();
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
          hideGhost();
          onDragEnd();
        }}
      >
        <span className="block font-medium">{label}</span>
        <span className="text-xs text-muted-foreground">{detail}</span>
        <button
          type="button"
          className="mt-1 block text-left text-xs text-primary underline-offset-2 hover:underline"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation();
            onActivate(id);
          }}
        >
          Put on a bed
        </button>
      </div>
      <div ref={ghost} hidden className="planting-ghost" data-testid="drag-ghost" />
    </>
  );
}

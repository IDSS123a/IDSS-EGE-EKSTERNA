"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import type { GiftCode } from "../catalogue";
import type { Engraving, VitrinaScene } from "../scene/vitrina-scene";

/**
 * The 3D view of one gift (PDL-039). Loads three.js only on this page; honours reduced motion; without WebGL it renders
 * nothing and the page shows the gift in words. `unbox` (read at mount) plays the opening once, then calls `onOpened`;
 * the scene stays as it is afterwards.
 */
export function GiftViewer({ code, engraving, unbox, onOpened, onUnavailable, skipLabel }: {
  code: GiftCode;
  engraving: Engraving;
  unbox: boolean;
  onOpened: () => void;
  onUnavailable: () => void;
  skipLabel: string;
}): ReactNode {
  const host = useRef<HTMLDivElement>(null);
  const scene = useRef<VitrinaScene | null>(null);
  const [playing, setPlaying] = useState(false);
  const callbacks = useRef({ onOpened, onUnavailable });
  // Read once at mount: finishing the unboxing must not rebuild the scene.
  const unboxAtMount = useRef(unbox);
  useEffect(() => {
    callbacks.current = { onOpened, onUnavailable };
  }, [onOpened, onUnavailable]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const sceneModule = await import("../scene/vitrina-scene");
      if (cancelled || !host.current) return;
      if (!sceneModule.webglAvailable()) {
        callbacks.current.onUnavailable();
        return;
      }
      const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      scene.current = new sceneModule.VitrinaScene(host.current, { reducedMotion });
      if (unboxAtMount.current) {
        setPlaying(!reducedMotion);
        scene.current.unbox(code, engraving, () => {
          setPlaying(false);
          callbacks.current.onOpened();
        });
      } else scene.current.show(code, engraving);
    })().catch(() => callbacks.current.onUnavailable());
    return () => {
      cancelled = true;
      scene.current?.dispose();
      scene.current = null;
    };
  }, [code, engraving]);

  return (
    <div className="gift-viewer">
      <div ref={host} className="gift-viewer__canvas" />
      {playing && (
        <button type="button" className="button-secondary gift-viewer__skip" onClick={() => scene.current?.skip()}>
          {skipLabel}
        </button>
      )}
    </div>
  );
}

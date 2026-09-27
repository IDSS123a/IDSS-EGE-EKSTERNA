"use client";

import { useActionState, useEffect, useRef, useState, type ReactNode } from "react";
import { useI18n } from "@/features/localization/i18n-provider";
import { DEFAULT_SPLASH_SHARES, type SplashShares } from "@/features/splash/palette";
import { saveSplashPaletteAction } from "../actions";
import type { SettingsActionResult } from "../types";

/** The four IDSS colours of the splash in the order shown; codes as the Director names them (brand values, PDL-007). */
const COLORS: { key: keyof SplashShares; code: string }[] = [
  { key: "yellow", code: "#FFCB29" },
  { key: "blue", code: "#035EA1" },
  { key: "sky", code: "#08ABE6" },
  { key: "red", code: "#E8262C" },
];
const SHARE_STEP = 0.5;

/** Splash palette in percent with a live total and ratio bar; the server validates again (PDL-020). */
export function SplashPaletteForm({ initial }: { initial: SplashShares }): ReactNode {
  const { dictionary } = useI18n();
  const labels = dictionary.settings.palette;
  const [shares, setShares] = useState<SplashShares>(initial);
  const [result, formAction, pending] = useActionState<SettingsActionResult | null, FormData>(saveSplashPaletteAction, null);
  const total = Math.round((shares.red + shares.yellow + shares.blue + shares.sky) * 10) / 10;
  const balanced = Math.abs(total - 100) < 0.1;
  // Segment widths are set through the CSSOM after render: the CSP forbids inline style attributes in HTML.
  const barRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    barRef.current?.querySelectorAll<HTMLSpanElement>("[data-color]").forEach((segment) => {
      segment.style.flexGrow = String(Math.max(shares[segment.dataset.color as keyof SplashShares] ?? 0, 0));
    });
  }, [shares]);
  const update = (key: keyof SplashShares, value: string) => setShares((current) => ({ ...current, [key]: Number(value) || 0 }));

  return (
    <section className="card" aria-labelledby="palette-title">
      <h2 id="palette-title">{labels.title}</h2>
      <p>{labels.intro}</p>
      <form action={formAction} className="form form--grid">
        {COLORS.map((color) => (
          <div key={color.key} className="form__field">
            <label htmlFor={`share-${color.key}`}>
              <span className="palette-swatch" data-color={color.key} aria-hidden="true" /> {labels.colors[color.key]} <span className="form__optional">{color.code}</span>
            </label>
            <input id={`share-${color.key}`} name={color.key} type="number" inputMode="decimal" min={0} max={100} step={SHARE_STEP} required value={shares[color.key]} onChange={(event) => update(color.key, event.target.value)} />
          </div>
        ))}
        <div className="form__actions">
          <p className={balanced ? "palette-total" : "palette-total action-feedback--error"} aria-live="polite">
            {labels.sum.replace("{sum}", String(total).replace(".", ","))}{balanced ? "" : `. ${labels.sumWrong}`}
          </p>
        </div>
        <div className="form__actions">
          <div className="palette-bar" role="img" aria-label={labels.preview} ref={barRef}>
            {COLORS.map((color) => <span key={color.key} data-color={color.key} />)}
          </div>
        </div>
        <div className="form__actions">
          <button type="submit" className="button-primary" disabled={pending || !balanced} aria-busy={pending}>{pending ? labels.saving : labels.save}</button>
          <button type="button" className="button-secondary" onClick={() => setShares(DEFAULT_SPLASH_SHARES)} disabled={pending}>{labels.reset}</button>
          <p className="action-feedback" aria-live="polite">
            {result?.success && <span className="action-feedback--ok">{dictionary.settings.messages.SAVED}</span>}
            {result && !result.success && <span className="action-feedback--error">{dictionary.settings.errors[result.code]}</span>}
          </p>
        </div>
      </form>
      <p className="form__hint">{labels.note}</p>
    </section>
  );
}

"use client";

import { useMemo, useState, useTransition, type ReactNode } from "react";
import { APP_HOME_PATH } from "@/constants";
import { formatDateTime } from "@/features/canon/components/format";
import { useI18n } from "@/features/localization/i18n-provider";
import { ReviewShell } from "@/features/review/components/review-shell";
import { openGiftAction } from "../actions";
import { engravingLines } from "../domain";
import type { Gift } from "../types";
import { GiftViewer } from "./gift-viewer";

/**
 * Moja vitrina (PDL-039): the student's special gifts. A new gift opens with the unboxing; every gift stands on its
 * engraved pedestal and can be turned. No sharing outside the app (G5): no download, no share button.
 */
export function VitrinaScreen({ gifts }: { gifts: Gift[] }): ReactNode {
  const { dictionary, locale } = useI18n();
  const labels = dictionary.gifts;
  const [selectedId, setSelectedId] = useState<string | null>(gifts[0]?.id ?? null);
  const [opened, setOpened] = useState<Set<string>>(() => new Set(gifts.filter((gift) => gift.openedAt).map((gift) => gift.id)));
  const [unboxing, setUnboxing] = useState<string | null>(null);
  const [noWebgl, setNoWebgl] = useState(false);
  const [, startTransition] = useTransition();
  const selected = gifts.find((gift) => gift.id === selectedId) ?? null;

  const engraving = useMemo(
    () => (selected ? { title: labels.names[selected.code], lines: [labels.vitrina.from.replace("{name}", selected.giver), ...engravingLines(selected.message)] } : null),
    [selected, labels],
  );

  const finishOpening = (id: string) => {
    setOpened((previous) => new Set(previous).add(id));
    setUnboxing(null);
    startTransition(async () => void (await openGiftAction(id)));
  };

  return (
    <ReviewShell backHref={APP_HOME_PATH} backLabel={labels.vitrina.back} title={labels.vitrina.title} subtitle={labels.vitrina.subtitle}>
      {gifts.length === 0 ? (
        <p className="notice">{labels.vitrina.empty}</p>
      ) : (
        <div className="vitrina">
          <section className="card vitrina__stage" aria-labelledby="vitrina-gift">
            {selected && engraving && (
              <>
                <h2 id="vitrina-gift">{labels.names[selected.code]}</h2>
                {!opened.has(selected.id) && unboxing !== selected.id ? (
                  <div className="vitrina__wrapped">
                    <p className="vitrina__new">{labels.vitrina.new}</p>
                    <button type="button" className="button-primary" onClick={() => setUnboxing(selected.id)}>{labels.vitrina.open}</button>
                  </div>
                ) : noWebgl ? (
                  <p className="notice">{labels.vitrina.noWebgl}</p>
                ) : (
                  <GiftViewer
                    key={selected.id}
                    code={selected.code}
                    engraving={engraving}
                    unbox={unboxing === selected.id}
                    onOpened={() => finishOpening(selected.id)}
                    onUnavailable={() => {
                      setNoWebgl(true);
                      if (unboxing === selected.id) finishOpening(selected.id);
                    }}
                    skipLabel={labels.vitrina.skip}
                  />
                )}
                {opened.has(selected.id) && (
                  <div className="vitrina__engraving">
                    <p className="vitrina__message">{selected.message}</p>
                    <p className="form__hint">
                      {labels.vitrina.from.replace("{name}", selected.giver)}, {labels.vitrina.date.replace("{date}", formatDateTime(selected.createdAt, locale))}
                    </p>
                    <p className="form__hint">{labels.meanings[selected.code]}</p>
                    {!noWebgl && <p className="form__hint">{labels.vitrina.drag}</p>}
                  </div>
                )}
              </>
            )}
          </section>
          <section className="card vitrina__shelf" aria-label={labels.vitrina.title}>
            <ul>
              {gifts.map((gift) => (
                <li key={gift.id}>
                  <button type="button" className="vitrina__item" aria-pressed={gift.id === selectedId} onClick={() => { setUnboxing(null); setSelectedId(gift.id); }}>
                    <span className="vitrina__swatch" data-gift={gift.code} aria-hidden="true" />
                    <span>
                      <strong>{labels.names[gift.code]}</strong>
                      <span className="form__hint">{opened.has(gift.id) ? formatDateTime(gift.createdAt, locale) : labels.vitrina.new}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            <p className="form__hint">{labels.vitrina.note}</p>
          </section>
        </div>
      )}
    </ReviewShell>
  );
}

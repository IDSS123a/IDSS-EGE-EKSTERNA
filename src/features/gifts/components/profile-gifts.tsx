"use client";

import { useActionState, type ReactNode } from "react";
import { formatDateTime } from "@/features/canon/components/format";
import { useI18n } from "@/features/localization/i18n-provider";
import { giveGiftAction } from "../actions";
import { GIFT_CODES, GIFT_MESSAGE_MAX_LENGTH } from "../catalogue";
import type { Gift, GiftActionResult } from "../types";

/** Special gifts on the student profile (PDL-039): the list for staff who may see it; the form for subject teachers. */
export function ProfileGifts({ personId, gifts, canGive }: { personId: string; gifts: Gift[]; canGive: boolean }): ReactNode {
  const { dictionary, locale } = useI18n();
  const labels = dictionary.gifts;
  const [result, formAction, pending] = useActionState<GiftActionResult | null, FormData>(giveGiftAction, null);

  return (
    <section className="card no-print" aria-labelledby="profile-gifts">
      <h2 id="profile-gifts">{labels.list.title}</h2>
      {gifts.length === 0 ? (
        <p>{labels.list.none}</p>
      ) : (
        <ul className="canon-history__list">
          {gifts.map((gift) => (
            <li key={gift.id}>
              <span className="canon-history__event">{labels.names[gift.code]}, {gift.openedAt ? labels.list.opened : labels.list.notOpened}</span>
              <span>{gift.message}</span>
              <span className="form__hint">{labels.list.from.replace("{name}", gift.giver).replace("{date}", formatDateTime(gift.createdAt, locale))}</span>
            </li>
          ))}
        </ul>
      )}
      {canGive && (
        <form key={result?.success ? result.data.id : "gift"} action={formAction} className="form gift-form">
          <h3 className="support-subhead">{labels.send.title}</h3>
          <p className="form__hint">{labels.send.hint}</p>
          <input type="hidden" name="personId" value={personId} />
          <fieldset className="form__field">
            <legend>{labels.send.gift}</legend>
            <div className="gift-choices">
              {GIFT_CODES.map((code, index) => (
                <label key={code} className="gift-choice">
                  <input type="radio" name="code" value={code} defaultChecked={index === 0} />
                  <span className="vitrina__swatch" data-gift={code} aria-hidden="true" />
                  <span><strong>{labels.names[code]}</strong><span className="form__hint">{labels.meanings[code]}</span></span>
                </label>
              ))}
            </div>
          </fieldset>
          <div className="form__field">
            <label htmlFor="gift-message">{labels.send.message}</label>
            <textarea id="gift-message" name="message" required maxLength={GIFT_MESSAGE_MAX_LENGTH} rows={2} />
          </div>
          <div className="form__actions">
            <button type="submit" className="button-primary" disabled={pending}>{labels.send.submit}</button>
            <p className="action-feedback" aria-live="polite">
              {result?.success && <span className="action-feedback--ok">{labels.send.sent}</span>}
              {result && !result.success && <span className="action-feedback--error">{labels.errors[result.code]}</span>}
            </p>
          </div>
        </form>
      )}
    </section>
  );
}

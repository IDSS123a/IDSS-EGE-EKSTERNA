"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { VITRINA_PATH } from "@/constants";
import { useI18n } from "@/features/localization/i18n-provider";
import type { Gift } from "../types";

/** "Moja vitrina" on the Game Hub (PDL-039): only shown once the student has a gift. */
export function HubGiftsCard({ gifts }: { gifts: Gift[] }): ReactNode {
  const { dictionary } = useI18n();
  const labels = dictionary.gifts.hub;
  if (gifts.length === 0) return null;
  const unopened = gifts.filter((gift) => !gift.openedAt).length;
  return (
    <section className="card hub-gifts" data-new={unopened > 0} aria-labelledby="hub-gifts">
      <h2 id="hub-gifts">{labels.title}</h2>
      <p>{labels.count.replace("{n}", String(gifts.length))}{unopened > 0 && <strong className="hub-gifts__new"> {labels.unopened.replace("{n}", String(unopened))}</strong>}</p>
      <div className="link-row">
        <Link href={VITRINA_PATH} className="button-primary">{labels.open}</Link>
      </div>
    </section>
  );
}

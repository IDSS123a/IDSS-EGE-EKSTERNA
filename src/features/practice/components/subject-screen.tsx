"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { APP_HOME_PATH, PRACTICE_PATH } from "@/constants";
import type { SubjectCode } from "@/features/knowledge/types";
import { useI18n } from "@/features/localization/i18n-provider";
import { ReviewShell } from "@/features/review/components/review-shell";
import { percent } from "../domain/progress";
import type { AreaProgress } from "../types";

/** Subject page of the Game Hub: every area with mastery and a practice link (Sprint 06). */
export function SubjectScreen({ code, areas }: { code: SubjectCode; areas: AreaProgress[] }): ReactNode {
  const { dictionary } = useI18n();
  const labels = dictionary.hub;
  return (
    <ReviewShell backHref={APP_HOME_PATH} backLabel={dictionary.practice.back} title={dictionary.subjects[code]}>
      {areas.length === 0 && <p className="notice">{labels.noQuestions}</p>}
      <ul className="hub-areas">
        {areas.map((area) => (
          <li key={area.areaId ?? "none"} className="card hub-area">
            {/* Area names are catalogue text, shown verbatim (AMB-13). */}
            <h2 lang={code === "german" ? "de" : "bs"}>{area.area}</h2>
            <p>
              {labels.mastered}: <strong>{percent(area.correct, area.total)} %</strong> ({area.correct} / {area.total})
            </p>
            <progress className="hub-progress" max={area.total} value={area.correct} aria-label={labels.masteredHint} />
            {area.awaiting > 0 && <p className="form__hint">{labels.awaiting.replace("{n}", String(area.awaiting))}</p>}
            {area.areaId && <Link href={`${PRACTICE_PATH}?predmet=${code}&oblast=${area.areaId}`} className="button-primary">{labels.practise}</Link>}
          </li>
        ))}
      </ul>
    </ReviewShell>
  );
}

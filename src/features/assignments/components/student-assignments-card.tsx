"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { PRACTICE_PATH } from "@/constants";
import { formatDateTime } from "@/features/canon/components/format";
import { useI18n } from "@/features/localization/i18n-provider";
import { PushToggle } from "@/features/push/components/push-toggle";
import { answeredPercent } from "../domain/assignments";
import type { StudentAssignment } from "../types";

/** "Zadaci nastavnika" on the Game Hub (PDL-035 Z6): open assignments first, progress, due date, and the push switch. */
export function StudentAssignmentsCard({ assignments }: { assignments: StudentAssignment[] }): ReactNode {
  const { dictionary, locale } = useI18n();
  const labels = dictionary.assignments.student;
  const states = dictionary.assignments.states;

  return (
    <section id="zadaci" className="card hub-assignments" aria-labelledby="hub-assignments">
      <h2 id="hub-assignments">{labels.title}</h2>
      {assignments.length === 0 ? (
        <p>{labels.none}</p>
      ) : (
        <ul className="hub-assignment-list">
          {assignments.map((assignment) => {
            const finished = assignment.state === "complete" || assignment.state === "late";
            return (
              <li key={assignment.id} className="hub-assignment" data-state={assignment.state}>
                <div>
                  <strong>{assignment.title}</strong> <span className="status-pill" data-assignment={assignment.state}>{states[assignment.state]}</span>
                  <p className="form__hint">
                    {dictionary.subjects[assignment.subject]}, {labels.due.replace("{date}", formatDateTime(assignment.dueAt, locale))}, {labels.teacher.replace("{name}", assignment.teacher)}
                  </p>
                  {assignment.instruction && <p>{assignment.instruction}</p>}
                  <progress className="hub-progress" max={Math.max(assignment.total, 1)} value={assignment.answered} aria-label={`${answeredPercent(assignment.answered, assignment.total)} %`} />
                  <p className="form__hint">{labels.progress.replace("{a}", String(assignment.answered)).replace("{t}", String(assignment.total))}</p>
                </div>
                {finished ? (
                  <p className="action-feedback--ok">{labels.done}</p>
                ) : (
                  <div className="link-row">
                    <Link className="button-primary" href={`${PRACTICE_PATH}?zadatak=${assignment.id}`}>{assignment.answered > 0 ? labels.continue : labels.start}</Link>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
      <PushToggle />
    </section>
  );
}

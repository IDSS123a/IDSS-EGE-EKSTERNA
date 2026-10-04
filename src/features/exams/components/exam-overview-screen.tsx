"use client";

import Link from "next/link";
import { useActionState, type ReactNode } from "react";
import { APP_HOME_PATH, EXAM_PATH } from "@/constants";
import { formatDateTime } from "@/features/canon/components/format";
import { useI18n } from "@/features/localization/i18n-provider";
import { ReviewShell } from "@/features/review/components/review-shell";
import { requestExamAction } from "../actions";
import { formatPoints, testLabel } from "../domain/exam";
import type { ExamActionResult, ExamOverview, ExamSubject } from "../types";

/**
 * Mock exams of a student (Sprint 07): per subject the official duration and points, the open exam or a request for a
 * new set, then the earlier exams. Points appear only once a teacher has graded (P-7: grades come from the teacher).
 */
export function ExamOverviewScreen({ overview }: { overview: ExamOverview }): ReactNode {
  const { dictionary, locale } = useI18n();
  const labels = dictionary.exam;

  return (
    <ReviewShell backHref={APP_HOME_PATH} backLabel={labels.back} title={labels.title} subtitle={labels.subtitle} print={{ confidential: false }}>
      <p className="notice">{labels.intro}</p>
      <div className="hub-subjects">
        {overview.subjects.map((subject) => <SubjectCard key={subject.subjectId} subject={subject} />)}
      </div>

      <section className="card" aria-labelledby="exam-history-title">
        <h2 id="exam-history-title">{labels.history}</h2>
        {overview.exams.length === 0 ? (
          <p>{labels.noHistory}</p>
        ) : (
          <ul className="review-list">
            {overview.exams.map((exam) => (
              <li key={exam.id}>
                <Link href={`${EXAM_PATH}/${exam.id}`} className="review-list__item review-list__item--compact">
                  <strong className="review-list__key">{dictionary.subjects[exam.subjectCode]}</strong>
                  <span>{testLabel(exam.kind, exam.positions, { full: labels.kindFull, part: labels.kindPart })}{exam.sent ? `, ${dictionary.grading.queue.sent}` : ""}</span>
                  <span>{formatDateTime(exam.submittedAt ?? exam.createdAt, locale)}</span>
                  <span className="status-pill" data-exam={exam.status}>
                    {exam.status === "graded" && exam.totalPoints !== null
                      ? labels.pointsOf.replace("{p}", formatPoints(exam.totalPoints, locale)).replace("{max}", formatPoints(exam.maxPoints, locale))
                      : labels.states[exam.status]}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </ReviewShell>
  );
}

function SubjectCard({ subject }: { subject: ExamSubject }): ReactNode {
  const { dictionary, locale } = useI18n();
  const labels = dictionary.exam;
  const [result, formAction, pending] = useActionState<ExamActionResult | null, FormData>(requestExamAction, null);

  return (
    <section className="card hub-subject" aria-labelledby={`exam-${subject.subjectCode}`}>
      <h3 id={`exam-${subject.subjectCode}`}>{dictionary.subjects[subject.subjectCode]}</h3>
      {subject.minutes !== null && subject.totalPoints !== null && (
        <p>{labels.facts.replace("{minutes}", String(subject.minutes)).replace("{points}", formatPoints(subject.totalPoints, locale))}</p>
      )}
      {subject.openExamId && subject.openStatus ? (
        <>
          <p><span className="status-pill" data-exam={subject.openStatus}>{labels.states[subject.openStatus]}</span></p>
          {subject.openSent && subject.openStatus === "awaiting_approval" ? (
            <p className="form__hint">{labels.sentWaiting}</p>
          ) : (subject.openSent || subject.openKind === "part") && (
            <p className="form__hint">{subject.openKind === "part" ? labels.kindPartShort : labels.kindFull}{subject.openSent ? `, ${dictionary.grading.queue.sent}` : ""}</p>
          )}
          <div className="link-row">
            <Link href={`${EXAM_PATH}/${subject.openExamId}`} className="button-primary">{labels.open}</Link>
          </div>
        </>
      ) : !subject.available ? (
        <p className="form__hint">{labels.unavailable}</p>
      ) : (
        <form action={formAction} className="link-row">
          <input type="hidden" name="subjectId" value={subject.subjectId} />
          <button type="submit" className="button-primary" disabled={pending} aria-busy={pending}>{labels.request}</button>
          <span aria-live="polite">{result && !result.success && <span className="action-feedback--error">{labels.errors[result.code]}</span>}</span>
        </form>
      )}
    </section>
  );
}

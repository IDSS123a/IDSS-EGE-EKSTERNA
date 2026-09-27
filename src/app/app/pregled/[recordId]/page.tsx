import type { ReactNode } from "react";
import { REVIEW_PATH } from "@/constants";
import { ForbiddenScreen } from "@/features/accounts/components/forbidden-screen";
import { requireAccount } from "@/features/authentication/session";
import { displayNames, listSubjects } from "@/features/knowledge/repository";
import { RecordNotFound } from "@/features/review/components/record-not-found";
import { RecordReviewScreen } from "@/features/review/components/record-review-screen";
import { filterQueue, neighbours, parseFilter } from "@/features/review/domain/queue";
import { findRecordForReview, findSubjectQueue } from "@/features/review/repository";
import { createSupabaseAdminClient } from "@/lib/db/supabase-admin";
import { createSupabaseServerClient } from "@/lib/db/supabase-server";
import { logError } from "@/lib/logger";
import { canOpenReview, canReviewSubject, canReviseAnswerKeys } from "@/lib/permissions";

/**
 * GET /app/pregled/[recordId]?prikaz= — one record beside its source region (Sprint 04).
 * Role required: canon.review for the record's subject, or canon.publish. A record of another
 * subject is answered like a missing one (no hint that it exists).
 */
export default async function RecordReviewPage({ params, searchParams }: { params: Promise<{ recordId: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }): Promise<ReactNode> {
  const account = await requireAccount();
  if (!canOpenReview(account)) return <ForbiddenScreen />;
  const recordId = Number((await params).recordId);
  const filterParam = (await searchParams).prikaz;
  const filter = parseFilter(Array.isArray(filterParam) ? filterParam[0] : filterParam);
  if (!Number.isSafeInteger(recordId) || recordId <= 0) return <RecordNotFound />;

  let view;
  try {
    const client = await createSupabaseServerClient();
    const admin = createSupabaseAdminClient();
    const subjects = await listSubjects(client);
    const review = await findRecordForReview(client, recordId, subjects, (ids) => displayNames(admin, ids));
    const subject = review && canReviewSubject(account, review.subjectId) ? subjects.find((candidate) => candidate.id === review.subjectId) : undefined;
    if (review && subject) {
      const queue = await findSubjectQueue(client, subject);
      view = { review, subject, ...neighbours(filterQueue(queue.items, filter), recordId) };
    }
  } catch (error) {
    logError("app/pregled/[recordId]/page", error);
    throw error;
  }
  if (!view) return <RecordNotFound />;
  return (
    <RecordReviewScreen
      review={view.review}
      subjectCode={view.subject.code}
      sourceUrl={`${REVIEW_PATH}/izvor/${view.review.versionId}`}
      canDecide={view.review.current}
      canRevise={canReviseAnswerKeys(account, view.review.subjectId)}
      filter={filter}
      previous={view.previous}
      next={view.next}
    />
  );
}

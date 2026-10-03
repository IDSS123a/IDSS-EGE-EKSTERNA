import type { ReactNode } from "react";
import { REVIEW_PAGE_SIZE } from "@/constants";
import { ForbiddenScreen } from "@/features/accounts/components/forbidden-screen";
import { requireAccount } from "@/features/authentication/session";
import { listSubjects } from "@/features/knowledge/repository";
import { ReviewQueueScreen } from "@/features/review/components/review-queue-screen";
import { defaultFilter, filterQueue, findByKey, KEY_QUERY_MAX_LENGTH, pageOf, parseFilter } from "@/features/review/domain/queue";
import { canonNotices, findSubjectQueue } from "@/features/review/repository";
import { createSupabaseServerClient } from "@/lib/db/supabase-server";
import { logError } from "@/lib/logger";
import { canOpenReview, canReviewSubject } from "@/lib/permissions";

/**
 * GET /app/pregled?predmet=&prikaz=&stranica=&oznaka= — review queue (Sprint 04). Without prikaz the
 * queue shows waiting records, or all records once nothing waits; oznaka finds records by key.
 * Role required: canon.review (own subjects only) or canon.publish (all subjects).
 * Reads use the user-scoped client; subjects outside the reviewer's scope are never listed.
 */
export default async function ReviewPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }): Promise<ReactNode> {
  const account = await requireAccount();
  if (!canOpenReview(account)) return <ForbiddenScreen />;
  const params = await searchParams;
  const single = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);
  const keyQuery = (single(params.oznaka) ?? "").slice(0, KEY_QUERY_MAX_LENGTH);

  let view;
  try {
    const client = await createSupabaseServerClient();
    const all = await listSubjects(client);
    const subjects = all.filter((subject) => canReviewSubject(account, subject.id));
    const selected = subjects.find((subject) => subject.code === single(params.predmet)) ?? subjects[0] ?? null;
    const queue = selected ? await findSubjectQueue(client, selected) : null;
    const filter = parseFilter(single(params.prikaz), queue ? defaultFilter(queue.counts) : "pending");
    const items = queue ? (keyQuery.trim() ? findByKey(queue.items, keyQuery) : filterQueue(queue.items, filter)) : [];
    const paged = pageOf(items, Number(single(params.stranica) ?? 1), REVIEW_PAGE_SIZE);
    const notices = selected ? await canonNotices(client, selected.id) : [];
    view = { all, subjects, selected, queue, paged, filter, notices };
  } catch (error) {
    // Logged with location here; the /app error boundary shows the friendly message.
    logError("app/pregled/page", error);
    throw error;
  }
  return (
    <ReviewQueueScreen
      subjects={view.subjects.map((subject) => ({ id: subject.id, code: subject.code }))}
      selected={view.selected?.code ?? null}
      filter={view.filter}
      keyQuery={keyQuery}
      notices={view.notices}
      hasQueue={Boolean(view.queue?.jobId)}
      counts={view.queue?.counts ?? { pending: 0, returned: 0, accepted: 0 }}
      items={view.paged.items}
      page={view.paged.page}
      pages={view.paged.pages}
      noSubjects={view.all.length === 0}
    />
  );
}

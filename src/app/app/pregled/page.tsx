import type { ReactNode } from "react";
import { REVIEW_PAGE_SIZE } from "@/constants";
import { ForbiddenScreen } from "@/features/accounts/components/forbidden-screen";
import { requireAccount } from "@/features/authentication/session";
import { listSubjects } from "@/features/knowledge/repository";
import { ReviewQueueScreen } from "@/features/review/components/review-queue-screen";
import { filterQueue, pageOf, parseFilter } from "@/features/review/domain/queue";
import { findSubjectQueue } from "@/features/review/repository";
import { createSupabaseServerClient } from "@/lib/db/supabase-server";
import { logError } from "@/lib/logger";
import { canOpenReview, canReviewSubject } from "@/lib/permissions";

/**
 * GET /app/pregled?predmet=&prikaz=&stranica= — review queue (Sprint 04).
 * Role required: canon.review (own subjects only) or canon.publish (all subjects).
 * Reads use the user-scoped client; subjects outside the reviewer's scope are never listed.
 */
export default async function ReviewPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }): Promise<ReactNode> {
  const account = await requireAccount();
  if (!canOpenReview(account)) return <ForbiddenScreen />;
  const params = await searchParams;
  const single = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);
  const filter = parseFilter(single(params.prikaz));

  let view;
  try {
    const client = await createSupabaseServerClient();
    const all = await listSubjects(client);
    const subjects = all.filter((subject) => canReviewSubject(account, subject.id));
    const selected = subjects.find((subject) => subject.code === single(params.predmet)) ?? subjects[0] ?? null;
    const queue = selected ? await findSubjectQueue(client, selected) : null;
    const paged = pageOf(queue ? filterQueue(queue.items, filter) : [], Number(single(params.stranica) ?? 1), REVIEW_PAGE_SIZE);
    view = { all, subjects, selected, queue, paged };
  } catch (error) {
    // Logged with location here; the /app error boundary shows the friendly message.
    logError("app/pregled/page", error);
    throw error;
  }
  return (
    <ReviewQueueScreen
      subjects={view.subjects.map((subject) => ({ id: subject.id, code: subject.code }))}
      selected={view.selected?.code ?? null}
      filter={filter}
      hasQueue={Boolean(view.queue?.jobId)}
      counts={view.queue?.counts ?? { pending: 0, returned: 0, accepted: 0 }}
      items={view.paged.items}
      page={view.paged.page}
      pages={view.paged.pages}
      noSubjects={view.all.length === 0}
    />
  );
}

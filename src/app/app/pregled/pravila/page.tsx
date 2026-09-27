import type { ReactNode } from "react";
import { REVIEW_PATH } from "@/constants";
import { ForbiddenScreen } from "@/features/accounts/components/forbidden-screen";
import { requireAccount } from "@/features/authentication/session";
import { RulesScreen } from "@/features/knowledge/components/rules-screen";
import { displayNames, listRules, listSubjects } from "@/features/knowledge/repository";
import { createSupabaseAdminClient } from "@/lib/db/supabase-admin";
import { createSupabaseServerClient } from "@/lib/db/supabase-server";
import { logError } from "@/lib/logger";
import { canOpenReview, canReviewSubject } from "@/lib/permissions";

/**
 * GET /app/pregled/pravila?predmet= — canonical exam rules with page quotes (Sprint 04).
 * Role required: canon.review for the subject (confirm or dispute), or canon.publish.
 */
export default async function RulesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }): Promise<ReactNode> {
  const account = await requireAccount();
  if (!canOpenReview(account)) return <ForbiddenScreen />;
  const requested = (await searchParams).predmet;
  const code = Array.isArray(requested) ? requested[0] : requested;

  let view;
  try {
    const client = await createSupabaseServerClient();
    const admin = createSupabaseAdminClient();
    const subjects = (await listSubjects(client)).filter((subject) => canReviewSubject(account, subject.id));
    const selected = subjects.find((subject) => subject.code === code) ?? subjects[0] ?? null;
    const rules = selected ? await listRules(client, [selected], (ids) => displayNames(admin, ids)) : [];
    view = { subjects, selected, rules };
  } catch (error) {
    logError("app/pregled/pravila/page", error);
    throw error;
  }
  const { subjects, selected, rules } = view;
  return (
    <RulesScreen
      subjects={subjects}
      selected={selected}
      subjectEvidence={selected?.evidence ?? []}
      rules={rules}
      canReview={selected !== null && canReviewSubject(account, selected.id)}
      sourceUrl={selected ? `${REVIEW_PATH}/izvor/${selected.sourceVersionId}` : null}
    />
  );
}


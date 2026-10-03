import type { SupabaseClient } from "@supabase/supabase-js";
import type { ReactNode } from "react";
import { AUDIT_PAGE_SIZE } from "@/constants";
import { ForbiddenScreen } from "@/features/accounts/components/forbidden-screen";
import { requireAccount } from "@/features/authentication/session";
import { DirectorScreen, type DirectorData } from "@/features/director/components/director-screen";
import { parseAuditFilter, parsePeriod, parseTab, periodStart } from "@/features/director/domain/period";
import { activeSchoolYearStart, directorAudit, directorContent, directorOverview, directorSubjects, directorSystem, directorTeachers } from "@/features/director/repository";
import { pushConfigured } from "@/features/push/send";
import { readAppSettings } from "@/features/settings/app-settings";
import { createSupabaseAdminClient } from "@/lib/db/supabase-admin";
import { logError } from "@/lib/logger";
import type { DirectorTab, PeriodChoice } from "@/features/director/types";
import { canViewAudit, canViewInstitution } from "@/lib/permissions";

type Params = { tab?: string; period?: string; akcija?: string; osoba?: string; od?: string; do?: string; strana?: string };

/**
 * GET /app/direktor?tab=&period= — Director Command Center (PDL-040, mandate §13). Role required:
 * analytics.view_institution; the audit log tab also audit.view. Aggregates only; figures from fewer students than the
 * minimum group are hidden (K2). Only the active tab is loaded.
 */
export default async function DirectorPage({ searchParams }: { searchParams: Promise<Params> }): Promise<ReactNode> {
  const account = await requireAccount();
  if (!canViewInstitution(account)) return <ForbiddenScreen />;
  const params = await searchParams;
  const canAudit = canViewAudit(account);
  const requested = parseTab(params.tab);
  const tab = requested === "dnevnik" && !canAudit ? "pregled" : requested;
  let loaded: { data: DirectorData; period: PeriodChoice; hasSchoolYear: boolean };
  try {
    loaded = await loadTab(createSupabaseAdminClient(), account.userId, tab, params);
  } catch (error) {
    logError("app/direktor/page", error);
    throw error;
  }
  return <DirectorScreen data={loaded.data} period={loaded.period} hasSchoolYear={loaded.hasSchoolYear} canAudit={canAudit} />;
}

/** Loads only the active tab. */
async function loadTab(admin: SupabaseClient, actorUserId: string, tab: DirectorTab, params: Params): Promise<{ data: DirectorData; period: PeriodChoice; hasSchoolYear: boolean }> {
  const schoolYearStart = await activeSchoolYearStart(admin);
  const period = parsePeriod(params.period, schoolYearStart);
  const since = periodStart(period, new Date(), schoolYearStart);
  const result = (data: DirectorData) => ({ data, period, hasSchoolYear: schoolYearStart !== null });
  if (tab === "pregled") return result({ tab, overview: await directorOverview(admin, actorUserId, since) });
  if (tab === "predmeti") return result({ tab, subjects: await directorSubjects(admin, actorUserId, since), minGroup: (await readAppSettings(admin)).minGroup });
  if (tab === "nastavnici") return result({ tab, teachers: await directorTeachers(admin, actorUserId, since) });
  if (tab === "sadrzaj") return result({ tab, content: await directorContent(admin, actorUserId), minGroup: (await readAppSettings(admin)).minGroup });
  if (tab === "sistem") return result({ tab, system: await directorSystem(admin, actorUserId), pushConfigured: pushConfigured() });
  const filter = parseAuditFilter(params);
  return result({ tab, audit: await directorAudit(admin, actorUserId, filter, AUDIT_PAGE_SIZE, (filter.page - 1) * AUDIT_PAGE_SIZE), filter, pageSize: AUDIT_PAGE_SIZE });
}

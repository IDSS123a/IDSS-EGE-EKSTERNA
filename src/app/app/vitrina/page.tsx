import type { ReactNode } from "react";
import { ForbiddenScreen } from "@/features/accounts/components/forbidden-screen";
import { requireAccount } from "@/features/authentication/session";
import { VitrinaScreen } from "@/features/gifts/components/vitrina-screen";
import { studentGifts } from "@/features/gifts/repository";
import { createSupabaseAdminClient } from "@/lib/db/supabase-admin";
import { logError } from "@/lib/logger";
import { canPractise } from "@/lib/permissions";

/** GET /app/vitrina — Moja vitrina (PDL-039). Role required: practice.participate (the student's own gifts only). */
export default async function VitrinaPage(): Promise<ReactNode> {
  const account = await requireAccount();
  if (!canPractise(account)) return <ForbiddenScreen />;
  let gifts;
  try {
    gifts = await studentGifts(createSupabaseAdminClient(), account.userId);
  } catch (error) {
    logError("app/vitrina/page", error);
    throw error;
  }
  return <VitrinaScreen gifts={gifts} />;
}

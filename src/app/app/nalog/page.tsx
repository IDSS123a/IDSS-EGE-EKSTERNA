import type { ReactNode } from "react";
import { STAFF_PASSWORD_MIN_LENGTH, STUDENT_PASSWORD_MIN_LENGTH } from "@/constants";
import { OwnAccountScreen } from "@/features/account/components/own-account-screen";
import { requireAccount } from "@/features/authentication/session";

/** GET /app/nalog — own account (any active account; own data only). */
export default async function OwnAccountPage(): Promise<ReactNode> {
  const account = await requireAccount();
  const minLength = account.role === "student" ? STUDENT_PASSWORD_MIN_LENGTH : STAFF_PASSWORD_MIN_LENGTH;
  return <OwnAccountScreen displayName={account.displayName} username={account.username} minLength={minLength} />;
}

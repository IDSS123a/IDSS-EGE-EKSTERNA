import type { ReactNode } from "react";
import { AccountHome } from "@/features/account/components/account-home";
import { requireAccount } from "@/features/authentication/session";

/** GET /app — Role required: any active account. Redirects to /prijava otherwise. */
export default async function AppHomePage(): Promise<ReactNode> {
  const account = await requireAccount();
  return <AccountHome account={{ displayName: account.displayName, role: account.role }} />;
}

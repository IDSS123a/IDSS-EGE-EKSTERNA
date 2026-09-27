import type { ReactNode } from "react";
import { ACCOUNT_LIST_LIMIT } from "@/constants";
import { AccountsScreen } from "@/features/accounts/components/accounts-screen";
import { ForbiddenScreen } from "@/features/accounts/components/forbidden-screen";
import { listAccounts } from "@/features/accounts/repository";
import { requireAccount } from "@/features/authentication/session";
import { createSupabaseServerClient } from "@/lib/db/supabase-server";
import { canChangeAccount, canManageAccounts, canResetPasswords, canViewAccounts } from "@/lib/permissions";

/**
 * GET /app/nalozi — account administration.
 * Role required: accounts.view (read) or accounts.manage (changes). The list is read with the
 * user-scoped client, so RLS limits what is visible even if this check were wrong.
 */
export default async function AccountsPage(): Promise<ReactNode> {
  const account = await requireAccount();
  if (!canViewAccounts(account)) return <ForbiddenScreen />;

  const supabase = await createSupabaseServerClient();
  const accounts = await listAccounts(supabase, ACCOUNT_LIST_LIMIT);
  const editableUserIds = accounts.filter((target) => canChangeAccount(account, target)).map((target) => target.userId);

  return (
    <AccountsScreen
      accounts={accounts}
      actorUserId={account.userId}
      canManage={canManageAccounts(account)}
      canResetPassword={canResetPasswords(account)}
      editableUserIds={editableUserIds}
    />
  );
}

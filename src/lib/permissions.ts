import type { AccountRole, CurrentAccount } from "@/features/authentication/types";

/**
 * Single source of truth for permission checks in application code (A-4). Every Server
 * Action and protected page calls these; RLS enforces the same rules again in the database.
 * Capabilities are loaded from the database for the signed-in account on every request.
 */

/** True when the account holds the capability through its role or a granted bundle. */
export function hasCapability(account: CurrentAccount, capability: string): boolean {
  return account.capabilities.has(capability);
}

/** Create accounts, change status, grant bundles (mandate §7A.2). */
export function canManageAccounts(account: CurrentAccount): boolean {
  return hasCapability(account, "accounts.manage");
}

/** See the account list (managers and holders of accounts.view). */
export function canViewAccounts(account: CurrentAccount): boolean {
  return canManageAccounts(account) || hasCapability(account, "accounts.view");
}

/** Reset a password (audited, PDL-003). */
export function canResetPasswords(account: CurrentAccount): boolean {
  return hasCapability(account, "accounts.reset_password");
}

/**
 * Ownership/target rule for lifecycle changes: a manager never changes their own status or
 * grants (no self-lockout, no self-escalation), and Superadministrator accounts are not
 * managed through the UI (designated by the mandate, §7A.1).
 */
export function canChangeAccount(actor: CurrentAccount, target: { userId: string; role: AccountRole }): boolean {
  return canManageAccounts(actor) && actor.userId !== target.userId && target.role !== "superadmin";
}

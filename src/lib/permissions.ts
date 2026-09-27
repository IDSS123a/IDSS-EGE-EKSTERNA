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

/** Upload, activate, supersede, roll back, reject and archive canonical versions (Sprint 02). */
export function canPublishCanon(account: CurrentAccount): boolean {
  return hasCapability(account, "canon.publish");
}

/**
 * True when the account holds the capability for this subject: through the role, an unscoped
 * bundle, or a bundle scoped to exactly this subject (twin of private.has_capability(code, subject)).
 */
export function hasSubjectCapability(account: CurrentAccount, capability: string, subjectId: string): boolean {
  const scope = account.subjectScopes.get(capability);
  return scope === "all" || (scope !== undefined && scope.has(subjectId));
}

/** Review ingested records and canonical rules of one subject (Sprint 04). */
export function canReviewSubject(account: CurrentAccount, subjectId: string): boolean {
  return canPublishCanon(account) || hasSubjectCapability(account, "canon.review", subjectId);
}

/** Record a reviewed answer-key correction for one subject (CF-03). */
export function canReviseAnswerKeys(account: CurrentAccount, subjectId: string): boolean {
  return hasSubjectCapability(account, "answer_keys.propose_revision", subjectId);
}

/** Open the review area at all (reviewers of any subject and publishers). */
export function canOpenReview(account: CurrentAccount): boolean {
  return canPublishCanon(account) || hasCapability(account, "canon.review");
}

/** Search trusted canon (reviewers for their subjects, publishers for all); the database scopes results again. */
export function canSearchCanon(account: CurrentAccount): boolean {
  return canOpenReview(account);
}

/** Build the retrieval index from trusted content (Sprint 05). */
export function canBuildIndex(account: CurrentAccount): boolean {
  return canPublishCanon(account);
}

/** See the canon registry, its history and download source files (publishers and reviewers). */
export function canViewCanon(account: CurrentAccount): boolean {
  return canPublishCanon(account) || hasCapability(account, "canon.review");
}

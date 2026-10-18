import { describe, expect, it, vi } from "vitest";

// The repository is server-only; in unit tests the marker import is a no-op.
vi.mock("server-only", () => ({}));
const signIn = vi.fn();
vi.mock("@/lib/db/supabase-verifier", () => ({ createSupabaseVerifierClient: () => ({ auth: { signInWithPassword: signIn } }) }));

import { removeHalfCreatedAccount, revokeAllSessions } from "@/features/accounts/repository";
import { isPushServiceEndpoint, PushSubscriptionSchema } from "@/lib/validation/schemas";

/** A fake service-role client that records the order of deletes and lets one table fail. */
function fakeAdmin(failing: string | null = null) {
  const calls: string[] = [];
  const signOut = vi.fn(async () => ({ error: null }));
  const admin = {
    from: (table: string) => ({
      delete: () => ({
        eq: async () => {
          calls.push(table);
          return { error: table === failing ? { message: "denied" } : null };
        },
      }),
    }),
    auth: {
      admin: {
        deleteUser: async () => {
          calls.push("auth");
          return { error: failing === "auth" ? { message: "denied" } : null };
        },
        signOut,
      },
    },
  };
  return { admin: admin as never, calls, signOut };
}

describe("removeHalfCreatedAccount (ACC-1): rows referencing the auth user go first", () => {
  it("deletes person, profile, then the auth user", async () => {
    const { admin, calls } = fakeAdmin();
    expect(await removeHalfCreatedAccount(admin, "u1")).toBeNull();
    expect(calls).toEqual(["persons", "profiles", "auth"]);
  });

  it("stops and reports the first failure, keeping the auth user", async () => {
    const { admin, calls } = fakeAdmin("profiles");
    expect(await removeHalfCreatedAccount(admin, "u1")).toBe("profiles: denied");
    expect(calls).toEqual(["persons", "profiles"]);
  });
});

describe("revokeAllSessions (SEC-3): sign-out with scope global after a reset", () => {
  it("signs out every session with the new session's token", async () => {
    signIn.mockResolvedValueOnce({ data: { session: { access_token: "t" } }, error: null });
    const { admin, signOut } = fakeAdmin();
    expect(await revokeAllSessions(admin, "a@b.ba", "secret-password")).toBe(true);
    expect(signOut).toHaveBeenCalledWith("t", "global");
  });

  it("reports false when no session can be opened (blocked account)", async () => {
    signIn.mockResolvedValueOnce({ data: { session: null }, error: { message: "banned" } });
    const { admin, signOut } = fakeAdmin();
    expect(await revokeAllSessions(admin, "a@b.ba", "secret-password")).toBe(false);
    expect(signOut).not.toHaveBeenCalled();
  });
});

describe("isPushServiceEndpoint (SEC-4): only the browsers' push services", () => {
  it.each([
    "https://fcm.googleapis.com/fcm/send/abc",
    "https://updates.push.services.mozilla.com/wpush/v2/abc",
    "https://wns2-par02p.notify.windows.com/w/?token=abc",
    "https://web.push.apple.com/QAbc",
  ])("accepts %s", (endpoint) => expect(isPushServiceEndpoint(endpoint)).toBe(true));

  it.each([
    "https://attacker.example/fcm.googleapis.com",
    "https://fcm.googleapis.com.attacker.example/x",
    "https://notify.windows.com.evil.example/x",
    "https://evilnotify.windows.com/x",
    "http://fcm.googleapis.com/fcm/send/abc",
    "https://fcm.googleapis.com:8443/x",
    "https://user:pass@fcm.googleapis.com/x",
    "not a url",
  ])("refuses %s", (endpoint) => expect(isPushServiceEndpoint(endpoint)).toBe(false));

  it("is applied by the subscription schema", () => {
    const base = { p256dh: "x".repeat(40), auth: "y".repeat(16), userAgent: null };
    expect(PushSubscriptionSchema.safeParse({ ...base, endpoint: "https://fcm.googleapis.com/fcm/send/abc" }).success).toBe(true);
    expect(PushSubscriptionSchema.safeParse({ ...base, endpoint: "https://attacker.example/x" }).success).toBe(false);
  });
});

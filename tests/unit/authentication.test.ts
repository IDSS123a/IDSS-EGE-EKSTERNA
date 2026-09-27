import { describe, expect, it } from "vitest";
import { LOGIN_MAX_FAILURES_PER_IP, LOGIN_MAX_FAILURES_PER_USERNAME, STUDENT_AUTH_EMAIL_DOMAIN } from "@/constants";
import { canSignIn, clientIpFrom, hashUsername, isLoginLocked, usernameToAuthEmail } from "@/features/authentication/domain";
import { LoginSchema } from "@/lib/validation/schemas";

describe("usernameToAuthEmail", () => {
  it("keeps staff e-mail usernames as the auth identity", () => {
    expect(usernameToAuthEmail("direktor@idss.ba")).toBe("direktor@idss.ba");
  });
  it("maps student usernames to the reserved non-routable domain", () => {
    expect(usernameToAuthEmail("ana.test")).toBe(`ana.test@${STUDENT_AUTH_EMAIL_DOMAIN}`);
  });
});

describe("canSignIn", () => {
  it("allows only active accounts", () => {
    expect(canSignIn("active")).toBe(true);
    for (const status of ["invited", "suspended", "blocked", "deactivated", "archived"] as const) {
      expect(canSignIn(status)).toBe(false);
    }
    expect(canSignIn(null)).toBe(false);
  });
});

describe("isLoginLocked (boundary N allowed, N+1 blocked — DONE checklist)", () => {
  it("allows attempts below the username limit and blocks at the limit", () => {
    expect(isLoginLocked(LOGIN_MAX_FAILURES_PER_USERNAME - 1, 0)).toBe(false);
    expect(isLoginLocked(LOGIN_MAX_FAILURES_PER_USERNAME, 0)).toBe(true);
  });
  it("blocks at the IP limit independently of the username", () => {
    expect(isLoginLocked(0, LOGIN_MAX_FAILURES_PER_IP - 1)).toBe(false);
    expect(isLoginLocked(0, LOGIN_MAX_FAILURES_PER_IP)).toBe(true);
  });
});

describe("hashUsername", () => {
  it("returns a stable 64-char hex digest and never the raw username", () => {
    const digest = hashUsername("student.one");
    expect(digest).toMatch(/^[0-9a-f]{64}$/);
    expect(digest).toBe(hashUsername("student.one"));
    expect(digest).not.toContain("student");
  });
});

describe("clientIpFrom", () => {
  it("takes the first forwarded IPv4/IPv6 address", () => {
    expect(clientIpFrom("203.0.113.7, 10.0.0.1")).toBe("203.0.113.7");
    expect(clientIpFrom("2001:db8::1")).toBe("2001:db8::1");
  });
  it("rejects garbage so it never reaches the inet column", () => {
    expect(clientIpFrom("not-an-ip")).toBeNull();
    expect(clientIpFrom("999.1.1.1")).toBeNull();
    expect(clientIpFrom(null)).toBeNull();
  });
});

describe("LoginSchema", () => {
  it("normalises usernames to trimmed lower case", () => {
    const parsed = LoginSchema.parse({ username: "  Direktor@IDSS.ba ", password: "x" });
    expect(parsed.username).toBe("direktor@idss.ba");
  });
  it("accepts school-issued student usernames", () => {
    expect(LoginSchema.safeParse({ username: "ana.test", password: "x" }).success).toBe(true);
  });
  it("rejects empty, too short or injection-shaped input", () => {
    expect(LoginSchema.safeParse({ username: "", password: "x" }).success).toBe(false);
    expect(LoginSchema.safeParse({ username: "ab", password: "x" }).success).toBe(false);
    expect(LoginSchema.safeParse({ username: "a' or 1=1 --", password: "x" }).success).toBe(false);
    expect(LoginSchema.safeParse({ username: "ana.test", password: "" }).success).toBe(false);
    expect(LoginSchema.safeParse({ username: null, password: null }).success).toBe(false);
  });
});

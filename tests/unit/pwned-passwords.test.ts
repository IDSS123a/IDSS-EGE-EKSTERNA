import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";

// The module is server-only; in unit tests the marker import is a no-op.
vi.mock("server-only", () => ({}));

const { isPasswordPwned } = await import("@/lib/security/pwned-passwords");
const { PWNED_PASSWORDS_URL } = await import("@/constants");

type FetchLike = (url: string, init: RequestInit) => Promise<Response>;
const sha1 = (text: string) => createHash("sha1").update(text).digest("hex").toUpperCase();

function rangeApi(lines: string[]) {
  return vi.fn<FetchLike>(async () => new Response(lines.join("\r\n"), { status: 200 }));
}

describe("leaked-password check (PDL-030)", () => {
  it("sends only the five-character prefix and finds the suffix in the answer", async () => {
    const hash = sha1("password123");
    const fetchImpl = rangeApi(["0000000000000000000000000000000000A:0", `${hash.slice(5)}:2413945`]);
    expect(await isPasswordPwned("password123", fetchImpl)).toBe(true);
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe(`${PWNED_PASSWORDS_URL}${hash.slice(0, 5)}`);
    expect(url).not.toContain(hash.slice(5));
    expect((init.headers as Record<string, string>)["Add-Padding"]).toBe("true");
  });

  it("treats padding entries with count 0 and other suffixes as not leaked", async () => {
    const hash = sha1("Zv9#qL2!mW7p");
    expect(await isPasswordPwned("Zv9#qL2!mW7p", rangeApi([`${hash.slice(5)}:0`, "FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF:12"]))).toBe(false);
  });

  it("returns null when the service does not answer, so the caller accepts the password", async () => {
    const failing = vi.fn<FetchLike>(async () => new Response("", { status: 503 }));
    expect(await isPasswordPwned("anything", failing)).toBeNull();
    const throwing = vi.fn<FetchLike>(async () => { throw new Error("network"); });
    expect(await isPasswordPwned("anything", throwing)).toBeNull();
  });
});

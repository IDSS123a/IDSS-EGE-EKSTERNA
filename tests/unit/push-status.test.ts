import webpush from "web-push";
import { afterEach, describe, expect, it, vi } from "vitest";

// The module is server-only; in unit tests the marker import is a no-op.
vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/supabase-admin", () => ({ createSupabaseAdminClient: () => ({}) }));
vi.mock("@/lib/logger", () => ({ logError: () => undefined }));

const keys = webpush.generateVAPIDKeys();

async function statusWith(env: { subject?: string; publicKey?: string; privateKey?: string }) {
  vi.resetModules();
  vi.stubEnv("VAPID_SUBJECT", env.subject ?? "");
  vi.stubEnv("NEXT_PUBLIC_VAPID_PUBLIC_KEY", env.publicKey ?? "");
  vi.stubEnv("VAPID_PRIVATE_KEY", env.privateKey ?? "");
  const { pushStatus } = await import("@/features/push/send");
  return pushStatus();
}

afterEach(() => vi.unstubAllEnvs());

describe("pushStatus (PDL-037): malformed VAPID values are reported, never thrown", () => {
  it("is off when a value is missing", async () => {
    expect(await statusWith({ subject: "mailto:ai@idss.ba", publicKey: keys.publicKey })).toEqual({ state: "off" });
  });
  it("is on with valid values", async () => {
    expect(await statusWith({ subject: "mailto:ai@idss.ba", publicKey: keys.publicKey, privateKey: keys.privateKey })).toEqual({ state: "on" });
  });
  it("names the subject without mailto:", async () => {
    expect(await statusWith({ subject: "ai@idss.ba", publicKey: keys.publicKey, privateKey: keys.privateKey })).toEqual({ state: "invalid", field: "subject" });
  });
  it("names a public key with quotes or spaces", async () => {
    expect(await statusWith({ subject: "mailto:ai@idss.ba", publicKey: `"${keys.publicKey}"`, privateKey: keys.privateKey })).toEqual({ state: "invalid", field: "publicKey" });
  });
  it("names swapped keys", async () => {
    expect(await statusWith({ subject: "mailto:ai@idss.ba", publicKey: keys.privateKey, privateKey: keys.publicKey })).toEqual({ state: "invalid", field: "publicKey" });
  });
});

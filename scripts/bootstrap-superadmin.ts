/**
 * One-time creation of the Superadministrator account (mandate §7A.1–7A.2).
 *
 * Run on the Director's own computer (the password is typed there and never stored or logged):
 *   npm run accounts:bootstrap
 * Requires .env.local with NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.
 *
 * Safe to re-run: it refuses to act when a Superadministrator profile already exists.
 * On any failure after the auth user is created, that auth user is deleted again so no
 * half-created account remains (DONE checklist: cleanup checks every error).
 */
import { createInterface } from "node:readline";
import { Writable } from "node:stream";
import { createClient } from "@supabase/supabase-js";
import { STAFF_PASSWORD_MIN_LENGTH } from "../src/constants";

// Named in the mandate (INSTRUCTION §7A.1) and the project CONSTITUTION P-11.
const SUPERADMIN_USERNAME = "direktor@idss.ba";
const SUPERADMIN_DISPLAY_NAME = "Davor Mulalić";

function fail(message: string): never {
  console.error(`\n[GREŠKA] ${message}`);
  process.exit(1);
}

/** Ask a question; when `hidden`, typed characters are not echoed. */
function ask(question: string, hidden: boolean): Promise<string> {
  let muted = false;
  const output = new Writable({
    write(chunk, _encoding, callback) {
      if (!muted) process.stdout.write(chunk);
      callback();
    },
  });
  const reader = createInterface({ input: process.stdin, output, terminal: true });
  return new Promise((resolve) => {
    reader.question(question, (answer) => {
      reader.close();
      if (hidden) process.stdout.write("\n");
      resolve(answer);
    });
    muted = hidden;
  });
}

async function main(): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) fail("U .env.local nedostaju NEXT_PUBLIC_SUPABASE_URL ili SUPABASE_SERVICE_ROLE_KEY.");

  const admin = createClient(url, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });

  const existing = await admin.from("profiles").select("user_id", { count: "exact", head: true }).eq("role", "superadmin");
  if (existing.error) fail(`Provjera postojećih naloga nije uspjela: ${existing.error.message}`);
  if ((existing.count ?? 0) > 0) fail("Superadministrator već postoji. Ništa nije promijenjeno.");

  console.log(`Kreiranje naloga Superadministratora: ${SUPERADMIN_USERNAME} (${SUPERADMIN_DISPLAY_NAME})`);
  const password = await ask(`Nova lozinka (najmanje ${STAFF_PASSWORD_MIN_LENGTH} znakova): `, true);
  const repeated = await ask("Ponovite lozinku: ", true);
  if (password !== repeated) fail("Lozinke se ne podudaraju. Ništa nije promijenjeno.");
  if (password.length < STAFF_PASSWORD_MIN_LENGTH) fail(`Lozinka mora imati najmanje ${STAFF_PASSWORD_MIN_LENGTH} znakova.`);

  const created = await admin.auth.admin.createUser({ email: SUPERADMIN_USERNAME, password, email_confirm: true });
  if (created.error || !created.data.user) fail(`Kreiranje auth korisnika nije uspjelo: ${created.error?.message ?? "nepoznato"}`);
  const userId = created.data.user.id;

  const profile = await admin.from("profiles").insert({
    user_id: userId,
    username: SUPERADMIN_USERNAME,
    display_name: SUPERADMIN_DISPLAY_NAME,
    role: "superadmin",
    account_status: "active",
  }).select("user_id").maybeSingle();
  if (profile.error || !profile.data) {
    const cleanup = await admin.auth.admin.deleteUser(userId);
    if (cleanup.error) console.error(`[UPOZORENJE] Čišćenje nije uspjelo, obrišite auth korisnika ${userId} ručno: ${cleanup.error.message}`);
    fail(`Kreiranje profila nije uspjelo: ${profile.error?.message ?? "0 redova"}`);
  }

  const audit = await admin.from("audit_logs").insert({
    actor_user_id: userId,
    action: "account.bootstrapped",
    entity_type: "profile",
    entity_id: userId,
    details: { role: "superadmin", channel: "bootstrap-script" },
  });
  if (audit.error) console.error(`[UPOZORENJE] Nalog je kreiran, ali audit zapis nije: ${audit.error.message}`);

  console.log("\n[OK] Superadministrator je kreiran i aktivan. Prijavite se na /prijava.");
}

main().catch((error: unknown) => fail(error instanceof Error ? error.message : String(error)));

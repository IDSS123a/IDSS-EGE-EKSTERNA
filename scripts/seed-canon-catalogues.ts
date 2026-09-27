/**
 * Registers and activates the three current subject catalogues (AMB-02) in the canon registry.
 *
 * Run on the Director's computer (the cloud sandbox cannot reach Supabase Storage):
 *   npm run canon:seed
 * Requires .env.local with NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY, and an active
 * Superadministrator (the registry records who uploaded and activated each version).
 *
 * Uses the same rules and database functions as the /app/kanon screen: PDF signature, size limit,
 * SHA-256 (must match tools/canon-seed/catalogues.json), content-addressed private storage,
 * register_canon_version, activate_canon_version. Safe to re-run: a catalogue that is already
 * registered is only activated if it is not active yet; nothing is ever deleted.
 */
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { CANON_BUCKET, CANON_MIME_TYPE } from "../src/constants";
import { hasPdfSignature, isAcceptableSize, sha256Hex, sourcePath } from "../src/features/canon/domain";
import manifest from "../tools/canon-seed/catalogues.json";

const ROOT = join(__dirname, "..");

function fail(message: string): never {
  console.error(`\n[GREŠKA] ${message}`);
  process.exit(1);
}

async function main(): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) fail("U .env.local nedostaju NEXT_PUBLIC_SUPABASE_URL ili SUPABASE_SERVICE_ROLE_KEY.");
  const admin = createClient(url, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });

  const superadmin = await admin.from("profiles").select("user_id").eq("role", "superadmin").eq("account_status", "active").limit(1).maybeSingle<{ user_id: string }>();
  if (superadmin.error) fail(`Čitanje Superadministratora nije uspjelo: ${superadmin.error.message}`);
  if (!superadmin.data) fail("Nema aktivnog Superadministratora. Prvo pokrenite: npm run accounts:bootstrap");
  const actor = superadmin.data.user_id;

  for (const catalogue of manifest.catalogues) {
    console.log(`\n${catalogue.documentTitle}`);
    const bytes = new Uint8Array(await readFile(join(ROOT, catalogue.file)));
    if (!hasPdfSignature(bytes) || !isAcceptableSize(bytes.byteLength)) fail(`${catalogue.file} nije ispravan PDF ili je prevelik.`);
    const sha256 = await sha256Hex(bytes);
    if (sha256 !== catalogue.sha256) fail(`${catalogue.file}: SHA-256 se ne slaže s tools/canon-seed/catalogues.json. Fajl je izmijenjen, ništa nije učitano.`);

    const existing = await admin.from("canonical_document_versions").select("id, status").eq("sha256", sha256).maybeSingle<{ id: string; status: string }>();
    if (existing.error) fail(`Provjera registra nije uspjela: ${existing.error.message}`);
    let versionId = existing.data?.id ?? null;

    if (!versionId) {
      const path = sourcePath(sha256);
      const stored = await admin.storage.from(CANON_BUCKET).upload(path, bytes, { contentType: CANON_MIME_TYPE, upsert: false });
      if (stored.error && !/exists|duplicate/i.test(stored.error.message)) fail(`Učitavanje u pohranu nije uspjelo: ${stored.error.message}`);
      versionId = crypto.randomUUID();
      const registered = await admin.rpc("register_canon_version", {
        p_actor: actor,
        p_document_id: null,
        p_type_code: catalogue.typeCode,
        p_document_title: catalogue.documentTitle,
        p_scope: { subject_label: catalogue.subjectLabel },
        p_version_id: versionId,
        p_storage_path: path,
        p_sha256: sha256,
        p_mime_type: CANON_MIME_TYPE,
        p_byte_size: bytes.byteLength,
        p_issuing_authority: catalogue.issuingAuthority,
        p_official_title: catalogue.officialTitle,
        p_reference_number: null,
        p_published_on: null,
        p_effective_from: null,
        p_revision_label: catalogue.revisionLabel,
        p_ip: null,
      });
      if (registered.error) fail(`Registracija nije uspjela: ${registered.error.message}`);
      console.log("  registrovan");
    } else {
      console.log("  već je u registru");
    }

    if (existing.data?.status === "active") {
      console.log("  već je važeća verzija");
      continue;
    }
    const activated = await admin.rpc("activate_canon_version", { p_actor: actor, p_version_id: versionId, p_reason: "AMB-02: važeći katalog do izdavanja novog", p_ip: null });
    if (activated.error) fail(`Aktivacija nije uspjela: ${activated.error.message}`);
    console.log("  aktiviran kao važeća verzija");
  }
  console.log("\nGotovo. Registar je na /app/kanon.");
}

main().catch((error: unknown) => fail(error instanceof Error ? error.message : String(error)));

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { CANON_DOWNLOAD_URL_TTL_SECONDS, LOGIN_PATH } from "@/constants";
import { clientIpFrom } from "@/features/authentication/domain";
import { insertAuditLog } from "@/features/authentication/repository";
import { getCurrentAccount } from "@/features/authentication/session";
import { createDownloadUrl, findVersionForDownload } from "@/features/canon/repository";
import { createSupabaseAdminClient } from "@/lib/db/supabase-admin";
import { createSupabaseServerClient } from "@/lib/db/supabase-server";
import { logError } from "@/lib/logger";
import { canViewCanon } from "@/lib/permissions";

/**
 * GET /app/kanon/preuzmi/[versionId] — download a canonical source file.
 * Role required: canon.publish or canon.review. The version is looked up with the user-scoped
 * client (RLS), then a signed URL valid for CANON_DOWNLOAD_URL_TTL_SECONDS is issued and the
 * browser is redirected to it. Every download is audited.
 * Errors: 302 to login when signed out; 403 without the capability; 404 for an unknown or hidden version.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ versionId: string }> }): Promise<NextResponse> {
  const account = await getCurrentAccount();
  if (!account) return NextResponse.redirect(new URL(LOGIN_PATH, request.url));
  if (!canViewCanon(account)) return new NextResponse(null, { status: 403 });
  const versionId = z.uuid().safeParse((await params).versionId);
  if (!versionId.success) return new NextResponse(null, { status: 404 });

  try {
    const version = await findVersionForDownload(await createSupabaseServerClient(), versionId.data);
    if (!version) return new NextResponse(null, { status: 404 });
    const admin = createSupabaseAdminClient();
    const url = await createDownloadUrl(admin, version.storagePath, CANON_DOWNLOAD_URL_TTL_SECONDS, `${version.sha256.slice(0, 12)}.pdf`);
    await insertAuditLog(admin, {
      actorUserId: account.userId,
      action: "canon.version_downloaded",
      entityType: "canonical_document_version",
      entityId: versionId.data,
      ipAddress: clientIpFrom(request.headers.get("x-forwarded-for")),
    });
    return NextResponse.redirect(url, 303);
  } catch (error) {
    logError("app/kanon/preuzmi.GET", error);
    return new NextResponse(null, { status: 503 });
  }
}

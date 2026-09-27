import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { CANON_MIME_TYPE, LOGIN_PATH, REVIEW_SOURCE_MAX_AGE_SECONDS } from "@/constants";
import { getCurrentAccount } from "@/features/authentication/session";
import { sha256Hex } from "@/features/canon/domain";
import { downloadObject } from "@/features/canon/repository";
import { findSourceForReview } from "@/features/review/repository";
import { createSupabaseAdminClient } from "@/lib/db/supabase-admin";
import { createSupabaseServerClient } from "@/lib/db/supabase-server";
import { logError } from "@/lib/logger";
import { canPublishCanon, canReviewSubject } from "@/lib/permissions";

/**
 * GET /app/pregled/izvor/[versionId] — the stored source PDF, same origin, for rendering the
 * source region beside a record in the review screen (pdf.js in the browser; the CSP allows no
 * other origin). Role required: canon.publish, or canon.review for the document's subject.
 * The file's SHA-256 is re-checked before it is served. Viewing is not audited as a download
 * (official, public catalogue text; the explicit download in the registry stays audited).
 * Errors: 302 to login when signed out; 403 without the capability; 404 unknown; 409 integrity; 503.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ versionId: string }> }): Promise<NextResponse> {
  const account = await getCurrentAccount();
  if (!account) return NextResponse.redirect(new URL(LOGIN_PATH, request.url));
  const versionId = z.uuid().safeParse((await params).versionId);
  if (!versionId.success) return new NextResponse(null, { status: 404 });

  try {
    const source = await findSourceForReview(await createSupabaseServerClient(), versionId.data);
    if (!source) return new NextResponse(null, { status: 404 });
    const allowed = canPublishCanon(account) || (source.subjectId !== null && canReviewSubject(account, source.subjectId));
    if (!allowed) return new NextResponse(null, { status: 403 });
    const bytes = await downloadObject(createSupabaseAdminClient(), source.storagePath);
    if (!bytes) return new NextResponse(null, { status: 404 });
    if ((await sha256Hex(bytes)) !== source.sha256) return new NextResponse(null, { status: 409 });
    return new NextResponse(bytes, {
      status: 200,
      headers: {
        "Content-Type": CANON_MIME_TYPE,
        "Content-Disposition": "inline",
        // Content-addressed and immutable per version, but only for this signed-in user.
        "Cache-Control": `private, max-age=${REVIEW_SOURCE_MAX_AGE_SECONDS}, immutable`,
      },
    });
  } catch (error) {
    logError("app/pregled/izvor.GET", error);
    return new NextResponse(null, { status: 503 });
  }
}

import "server-only";
import { NextResponse } from "next/server";
import { formatDateTime } from "@/features/canon/components/format";
import { getDictionary, getRequestLocale } from "@/features/localization/server";
import { exportFileName, toIdssCsv, type ExportCell } from "@/lib/idss-export";

/** Builds an IDSS-format CSV response (PDL-036): heading rows in the interface language, then the table. */
export async function idssCsvResponse(input: { title: string; confidential: boolean; rows: readonly (readonly ExportCell[])[] }): Promise<Response> {
  const locale = await getRequestLocale();
  const dictionary = getDictionary(locale);
  const now = new Date().toISOString();
  const body = toIdssCsv(
    {
      product: dictionary.home.title,
      title: input.title,
      exportedAt: dictionary.print.exportedAt.replace("{date}", formatDateTime(now, locale)),
      confidential: input.confidential ? dictionary.print.confidential : null,
    },
    input.rows,
  );
  const day = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Sarajevo" });
  return new NextResponse(body, {
    status: 200,
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${exportFileName(input.title, day)}"`,
      "cache-control": "no-store",
    },
  });
}

/** The dictionary of the request, for column labels. */
export async function exportDictionary() {
  return getDictionary(await getRequestLocale());
}

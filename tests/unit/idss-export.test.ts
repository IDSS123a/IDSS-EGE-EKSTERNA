import { describe, expect, it } from "vitest";
import { exportFileName, toIdssCsv } from "@/lib/idss-export";

describe("uniform IDSS export format (PDL-036)", () => {
  it("starts with product, title, export time and the confidentiality line, then an empty row and the table", () => {
    const csv = toIdssCsv(
      { product: "IDSS - External Graduate Examination", title: "Praćenje učenika", exportedAt: "Izvezeno: 03.10.2026. 21:00", confidential: "Povjerljivo" },
      [["Učenik", "Dani"], ["A.B.", 3]],
    );
    const lines = csv.replace("﻿", "").split("\r\n");
    expect(lines.slice(0, 7)).toEqual([
      '"IDSS - External Graduate Examination"',
      '"Praćenje učenika"',
      '"Izvezeno: 03.10.2026. 21:00"',
      '"Povjerljivo"',
      "",
      '"Učenik";"Dani"',
      '"A.B.";"3"',
    ]);
    expect(csv.startsWith("﻿")).toBe(true);
  });

  it("leaves out the confidentiality line for aggregates and keeps cells safe against formula injection", () => {
    const csv = toIdssCsv({ product: "P", title: "T", exportedAt: "E", confidential: null }, [["=SUM(A1)"]]);
    expect(csv.split("\r\n")[3]).toBe("");
    expect(csv).toContain(`"'=SUM(A1)"`);
  });

  it("names files idss-<document>-<day>.csv without diacritics", () => {
    expect(exportFileName("Praćenje učenika", "2026-10-03")).toBe("idss-pracenje-ucenika-2026-10-03.csv");
    expect(exportFileName("Dnevni sažetak 2026-10-02", "2026-10-03")).toBe("idss-dnevni-sazetak-2026-10-02-2026-10-03.csv");
    expect(exportFileName("Tageszusammenfassung", "2026-10-03")).toBe("idss-tageszusammenfassung-2026-10-03.csv");
  });
});

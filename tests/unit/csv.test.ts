import { describe, expect, it } from "vitest";

import { csvCell, toCsv } from "@/lib/csv";

describe("csv export", () => {
  it("quotes commas, quotes and line breaks", () => {
    expect(csvCell('Іван "Барбер", Київ')).toBe('"Іван ""Барбер"", Київ"');
    expect(csvCell("рядок\nдругий")).toBe('"рядок\nдругий"');
    expect(csvCell(null)).toBe("");
    expect(csvCell(12)).toBe("12");
  });

  it("neutralises spreadsheet formulas from the public join form, keeps phone numbers", () => {
    expect(csvCell("=HYPERLINK(\"http://evil\")")).toBe("\"'=HYPERLINK(\"\"http://evil\"\")\"");
    expect(csvCell("@SUM(A1)")).toBe("'@SUM(A1)");
    expect(csvCell("-2+3")).toBe("'-2+3");
    expect(csvCell("+380 50 111 22 33")).toBe("+380 50 111 22 33");
  });

  it("starts with a BOM so Excel reads Cyrillic", () => {
    const csv = toCsv(["Ім'я"], [["Олена"]]);
    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv).toBe("﻿Ім'я\r\nОлена\r\n");
  });
});

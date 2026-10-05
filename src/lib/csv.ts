/**
 * CSV for the owner's exports (Excel / Google Sheets). UTF-8 with BOM so Excel
 * shows Cyrillic, ";"-free comma CSV with RFC 4180 quoting. Cells that a
 * spreadsheet would run as a formula (=, +, -, @ at the start) are prefixed
 * with ' — customer names come from a public form (CSV injection). Plain
 * phone numbers ("+380…") are left as they are.
 */

type Cell = string | number | boolean | null | undefined;

const FORMULA_START = /^[=+\-@\t\r]/;
const PHONE = /^\+?\d[\d\s()-]*$/;

export function csvCell(value: Cell): string {
  if (value === null || value === undefined) return "";
  let text = String(value);
  if (typeof value === "string" && FORMULA_START.test(text) && !PHONE.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(header: readonly string[], rows: readonly (readonly Cell[])[]): string {
  const lines = [header, ...rows].map((row) => row.map(csvCell).join(","));
  return `﻿${lines.join("\r\n")}\r\n`;
}

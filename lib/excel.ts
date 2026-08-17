import type ExcelJS from "exceljs";

// Shared by the two xlsx export routes (workspace/export, statistics/export)
// — every sheet in both follows this exact create-columns-rows-bold-header
// shape, just with different columns and data.
export function addSheet(
  workbook: ExcelJS.Workbook,
  name: string,
  columns: Partial<ExcelJS.Column>[],
  rows: Record<string, unknown>[]
): ExcelJS.Worksheet {
  const sheet = workbook.addWorksheet(name);
  sheet.columns = columns;
  sheet.addRows(rows);
  sheet.getRow(1).font = { bold: true };
  return sheet;
}

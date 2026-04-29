/**
 * ─── DPH UI KIT — DATA TABLE — EXPORT UTILS ─────────────────────────────────────
 *
 * CSV is the only format that ships built-in (zero deps, RFC 4180 quoting).
 * XLSX/PDF are emitted via `(exportRequest)` so the host can pull in
 * SheetJS / pdfmake conditionally — keeps the kit's bundle small.
 */
import type { ColumnDef } from '../dph.types';

export function rowsToCsv<T extends Record<string, unknown>>(
  rows: readonly T[],
  columns: readonly ColumnDef<T>[],
): string {
  const exportable = columns.filter((c) => c.exportable !== false && c.type !== 'actions');
  const header = exportable.map((c) => csvCell(c.header)).join(',');
  const lines = rows.map((row) =>
    exportable
      .map((col) => {
        const raw = readNested(row, col.field);
        const formatted = col.format ? col.format(raw, row) : raw == null ? '' : String(raw);
        return csvCell(formatted);
      })
      .join(','),
  );
  return [header, ...lines].join('\r\n');
}

export function downloadCsv(filename: string, csv: string): void {
  const bom = '﻿'; // UTF-8 BOM — Excel-friendly
  const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function csvCell(value: string): string {
  if (value == null) return '';
  const needsQuote = /[",\r\n]/.test(value);
  const escaped = value.replace(/"/g, '""');
  return needsQuote ? `"${escaped}"` : escaped;
}

function readNested(obj: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, part) => {
    if (acc && typeof acc === 'object' && part in (acc as Record<string, unknown>)) {
      return (acc as Record<string, unknown>)[part];
    }
    return undefined;
  }, obj);
}

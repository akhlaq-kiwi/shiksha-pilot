import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'csv-parse/sync';

const DATA_DIR = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '../data');

/**
 * Reads a CSV file from playwright/data and returns an array of row objects,
 * keyed by the header row. Every value comes back as a string except empty
 * cells (empty string) — callers should coerce numbers/booleans themselves.
 *
 * @param {string} fileName e.g. "login-credentials.csv"
 * @param {object} [opts]
 * @param {(row: object) => boolean} [opts.filter] keep only rows matching this predicate
 */
export function readCsv(fileName, opts = {}) {
  const filePath = path.isAbsolute(fileName) ? fileName : path.join(DATA_DIR, fileName);
  const raw = fs.readFileSync(filePath, 'utf-8');
  const rows = parse(raw, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    comment: '#',
  });
  return opts.filter ? rows.filter(opts.filter) : rows;
}

/** Convenience: read a CSV and return only rows where enabled/skip columns allow it.
 *  A row is excluded if it has a truthy `skip` column (values: "1", "true", "yes"). */
export function readActiveCsv(fileName) {
  const SKIP_VALUES = new Set(['1', 'true', 'yes']);
  return readCsv(fileName, {
    filter: (row) => !SKIP_VALUES.has(String(row.skip ?? '').toLowerCase()),
  });
}

/** Reads a CSV and returns rows scoped to a single role, matching a "role" column. */
export function readCsvByRole(fileName, role) {
  return readActiveCsv(fileName).filter((row) => row.role === role);
}

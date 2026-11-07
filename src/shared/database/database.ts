// Provided. A fresh in-memory SQLite database per call, with schema.sql applied.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

export type Database = DatabaseSync;

export function openDatabase(): Database {
  const db = new DatabaseSync(':memory:');
  db.exec(readFileSync(join(__dirname, 'schema.sql'), 'utf8'));
  return db;
}

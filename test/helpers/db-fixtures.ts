// Provided. Test-only helpers that write fixtures straight into the database.
import { randomUUID } from 'node:crypto';
import { Database } from '../../src/shared/database';

export function seedPackage(db: Database, overrides: Partial<{ price: number; walletCredit: number; isActive: boolean }> = {}): string {
  const id = randomUUID();
  db.prepare('INSERT INTO packages (id, name, price, wallet_credit, is_active) VALUES (?, ?, ?, ?, ?)').run(
    id,
    'Bronze',
    overrides.price ?? 10_000,
    overrides.walletCredit ?? 12_000,
    overrides.isActive === false ? 0 : 1,
  );
  return id;
}

export function seedClient(db: Database, overrides: Partial<{ packageId: string | null; walletBalance: number }> = {}): string {
  const id = randomUUID();
  db.prepare('INSERT INTO clients (id, name, package_id, wallet_balance) VALUES (?, ?, ?, ?)').run(
    id,
    'Omar',
    overrides.packageId ?? null,
    overrides.walletBalance ?? 0,
  );
  return id;
}

export function getClient(db: Database, id: string): { packageId: string | null; walletBalance: number } {
  const row = db.prepare('SELECT package_id, wallet_balance FROM clients WHERE id = ?').get(id) as any;
  return { packageId: row.package_id, walletBalance: row.wallet_balance };
}

export function purchasesOf(db: Database, clientId: string): { status: string; chargeId: string | null }[] {
  const rows = db.prepare('SELECT status, charge_id FROM package_purchases WHERE client_id = ? ORDER BY created_at').all(clientId) as any[];
  return rows.map((r) => ({ status: r.status, chargeId: r.charge_id }));
}

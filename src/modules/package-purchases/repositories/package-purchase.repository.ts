import { Database } from '../../../shared/database';
import { PackagePurchaseStatus } from '../enums';
import { CreatePackagePurchaseInput, PackagePurchase } from '../interfaces';

export class PackagePurchaseRepository {
  constructor(private readonly db: Database) {}

  async create(input: CreatePackagePurchaseInput): Promise<PackagePurchase> {
    const { clientId, packageId, amount } = input;
    const now = new Date().toISOString();
    const id = crypto.randomUUID();
    const insert = this.db.prepare(
      'INSERT INTO package_purchases (id, client_id, package_id, amount, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    );
    insert.run(id, clientId, packageId, amount, PackagePurchaseStatus.PENDING, now, now);
    return (await this.findById(id))!;
  }

  async findById(id: string): Promise<PackagePurchase | null> {
    const select = this.db.prepare('SELECT * FROM package_purchases WHERE id = ?');
    const row = select.get(id);
    if (!row) {
      return null;
    }
    return this.mapRowToPackagePurchase(row);
  }

  /** Moves the purchase to `to` ONLY if it is still in `from`. Returns whether a row changed. */
  async updateStatusIf(id: string, from: PackagePurchaseStatus, to: PackagePurchaseStatus, changes?: { chargeId?: string }): Promise<boolean> {
    const now = new Date().toISOString();
    const update = this.db.prepare(
      'UPDATE package_purchases SET status = ?, charge_id = COALESCE(?, charge_id), updated_at = ? WHERE id = ? AND status = ?',
    );
    const result = update.run(to, changes?.chargeId ?? null, now, id, from);
    return result.changes > 0;
  }

  private mapRowToPackagePurchase(row: any): PackagePurchase {
    return {
      id: row.id,
      clientId: row.client_id,
      packageId: row.package_id,
      amount: row.amount,
      status: row.status as PackagePurchaseStatus,
      chargeId: row.charge_id ?? null,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

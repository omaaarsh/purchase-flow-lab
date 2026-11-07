import { Database } from '../../../shared/database';

export class ClientRepository {
  constructor(private readonly db: Database) {}

  /** The client's current package id, or null when they have none. */
  async getPackageId(clientId: string): Promise<string | null> {
    const select = this.db.prepare('SELECT package_id FROM clients WHERE id = ?');
    const row = select.get(clientId);
    if (!row) {
      throw new Error(`Client ${clientId} not found`);
    }
    return row.package_id as string | null;
  }

  /** Sets (or clears, with null) the client's package. */
  async setPackage(clientId: string, packageId: string | null): Promise<void> {
    const update = this.db.prepare('UPDATE clients SET package_id = ? WHERE id = ?');
    const result = update.run(packageId, clientId);
    if (result.changes === 0) {
      throw new Error(`Client ${clientId} not found`);
    }
  }

  /** Adds `amount` to the wallet atomically, in SQL. A negative amount takes credit back. */
  async addToWallet(clientId: string, amount: number): Promise<void> {
    const update = this.db.prepare('UPDATE clients SET wallet_balance = wallet_balance + ? WHERE id = ?');
    const result = update.run(amount, clientId);
    if (result.changes === 0) {
      throw new Error(`Client ${clientId} not found`);
    }
  }
}

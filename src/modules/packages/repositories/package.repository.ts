import { Database } from '../../../shared/database';
import { Package } from '../interfaces';

export class PackageRepository {
  constructor(private readonly db: Database) {}

  /** The package only if it exists AND is active (an admin can hide a package); otherwise null. */
  async findActiveById(id: string): Promise<Package | null> {
    const select = this.db.prepare('SELECT * FROM packages WHERE id = ? AND is_active = 1');
    const row = select.get(id);
    if (!row) {
      return null;
    }
    return this.mapRowToPackage(row);
  }

  private mapRowToPackage(row: any): Package {
    return {
      id: row.id,
      name: row.name,
      price: row.price,
      walletCredit: row.wallet_credit,
      isActive: row.is_active === 1,
    };
  }
}

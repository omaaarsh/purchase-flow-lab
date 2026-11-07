import { openDatabase, Database } from '../../../../src/shared/database';
import { PackageRepository } from '../../../../src/modules/packages/repositories';
import { seedPackage } from '../../../helpers/db-fixtures';

describe('PackageRepository', () => {
  let db: Database;
  let repo: PackageRepository;

  beforeEach(() => {
    db = openDatabase();
    repo = new PackageRepository(db);
  });

  it('returns an active package, mapped to camelCase', async () => {
    const id = seedPackage(db, { price: 10_000, walletCredit: 12_000 });

    expect(await repo.findActiveById(id)).toEqual({ id, name: 'Bronze', price: 10_000, walletCredit: 12_000, isActive: true });
  });

  it('returns null for a package an admin has hidden', async () => {
    const id = seedPackage(db, { isActive: false });

    expect(await repo.findActiveById(id)).toBeNull();
  });

  it('returns null for an unknown id', async () => {
    expect(await repo.findActiveById('nope')).toBeNull();
  });
});

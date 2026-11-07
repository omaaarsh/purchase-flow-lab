import { openDatabase, Database } from '../../../../src/shared/database';
import { PackagePurchaseStatus as S } from '../../../../src/modules/package-purchases/enums';
import { PackagePurchaseRepository } from '../../../../src/modules/package-purchases/repositories';
import { seedClient, seedPackage } from '../../../helpers/db-fixtures';

describe('PackagePurchaseRepository', () => {
  let db: Database;
  let repo: PackagePurchaseRepository;
  let clientId: string;
  let packageId: string;

  beforeEach(() => {
    db = openDatabase();
    repo = new PackagePurchaseRepository(db);
    packageId = seedPackage(db);
    clientId = seedClient(db);
  });

  it('creates a PENDING purchase with an id and no charge yet', async () => {
    const purchase = await repo.create({ clientId, packageId, amount: 10_000 });

    expect(purchase).toMatchObject({ clientId, packageId, amount: 10_000, status: S.PENDING, chargeId: null });
    expect(purchase.id).toEqual(expect.any(String));
    expect(await repo.findById(purchase.id)).toEqual(purchase);
  });

  it('returns null for an unknown id', async () => {
    expect(await repo.findById('nope')).toBeNull();
  });

  it('moves the status when the row is still in the expected status', async () => {
    const { id } = await repo.create({ clientId, packageId, amount: 10_000 });

    const changed = await repo.updateStatusIf(id, S.PENDING, S.PAID, { chargeId: 'chg_1' });

    expect(changed).toBe(true);
    expect(await repo.findById(id)).toMatchObject({ status: S.PAID, chargeId: 'chg_1' });
  });

  it('changes nothing when the row is no longer in the expected status', async () => {
    const { id } = await repo.create({ clientId, packageId, amount: 10_000 });
    await repo.updateStatusIf(id, S.PENDING, S.CANCELLED);

    const changed = await repo.updateStatusIf(id, S.PENDING, S.PAID);

    expect(changed).toBe(false);
    expect((await repo.findById(id))?.status).toBe(S.CANCELLED);
  });
});

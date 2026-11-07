import { openDatabase, Database } from '../../../../src/shared/database';
import { ConcurrentUpdateError, IllegalTransitionError, NotFoundError } from '../../../../src/shared/utils';
import { PackagePurchaseStatus as S } from '../../../../src/modules/package-purchases/enums';
import { PackagePurchaseRepository } from '../../../../src/modules/package-purchases/repositories';
import { PackagePurchasesService } from '../../../../src/modules/package-purchases/services';
import { PackagePurchaseEvent as E, PackagePurchaseStateMachine } from '../../../../src/modules/package-purchases/state-machine';
import { seedClient, seedPackage } from '../../../helpers/db-fixtures';

describe('PackagePurchasesService', () => {
  let db: Database;
  let service: PackagePurchasesService;
  let purchaseId: string;

  beforeEach(async () => {
    db = openDatabase();
    const repo = new PackagePurchaseRepository(db);
    service = new PackagePurchasesService(repo, new PackagePurchaseStateMachine());
    const purchase = await repo.create({ clientId: seedClient(db), packageId: seedPackage(db), amount: 10_000 });
    purchaseId = purchase.id;
  });

  it('applies an allowed event and returns the updated purchase', async () => {
    const purchase = await service.applyEvent(purchaseId, E.PAY_SUCCEEDED, { chargeId: 'chg_1' });

    expect(purchase).toMatchObject({ status: S.PAID, chargeId: 'chg_1' });
  });

  it('refuses an illegal event and says what was refused', async () => {
    await service.applyEvent(purchaseId, E.CANCEL);

    const attempt = service.applyEvent(purchaseId, E.PAY_SUCCEEDED);

    await expect(attempt).rejects.toBeInstanceOf(IllegalTransitionError);
    await expect(attempt).rejects.toMatchObject({ from: S.CANCELLED, event: E.PAY_SUCCEEDED });
  });

  it('throws NotFoundError for an unknown purchase', async () => {
    await expect(service.applyEvent('nope', E.CANCEL)).rejects.toBeInstanceOf(NotFoundError);
  });

  it('lets exactly one of two simultaneous requests win (double tap)', async () => {
    const results = await Promise.allSettled([
      service.applyEvent(purchaseId, E.PAY_SUCCEEDED, { chargeId: 'chg_a' }),
      service.applyEvent(purchaseId, E.PAY_SUCCEEDED, { chargeId: 'chg_b' }),
    ]);

    const won = results.filter((r) => r.status === 'fulfilled');
    const lost = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected');
    expect(won).toHaveLength(1);
    expect(lost).toHaveLength(1);
    expect(lost[0].reason).toBeInstanceOf(ConcurrentUpdateError);
  });
});

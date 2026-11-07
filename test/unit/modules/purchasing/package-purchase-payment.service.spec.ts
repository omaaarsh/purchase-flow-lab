import { openDatabase, Database } from '../../../../src/shared/database';
import { FaultInjector } from '../../../../src/shared/testing';
import { NotFoundError } from '../../../../src/shared/utils';
import { PackagePurchaseStatus as S } from '../../../../src/modules/package-purchases/enums';
import { FakePaymentGateway } from '../../../../src/modules/payments';
import {
  PurchaseDeclinedError,
  PurchaseInProgressError,
  PurchaseOutcomeUnknownError,
  PurchaseRefundedError,
} from '../../../../src/modules/purchasing/errors';
import { PackagePurchasePaymentService } from '../../../../src/modules/purchasing/services';
import { getClient, purchasesOf, seedClient, seedPackage } from '../../../helpers/db-fixtures';

describe('PackagePurchasePaymentService', () => {
  let db: Database;
  let gateway: FakePaymentGateway;
  let faults: FaultInjector;
  let service: PackagePurchasePaymentService;
  let packageId: string;
  let oldPackageId: string;
  let clientId: string;

  beforeEach(() => {
    db = openDatabase();
    gateway = new FakePaymentGateway();
    faults = new FaultInjector();
    service = new PackagePurchasePaymentService(db, gateway, faults);
    packageId = seedPackage(db, { price: 10_000, walletCredit: 12_000 });
    oldPackageId = seedPackage(db);
    clientId = seedClient(db, { packageId: oldPackageId, walletBalance: 500 });
  });

  it('happy path: charges once, sets the package, credits the wallet, ends COMPLETED', async () => {
    const purchase = await service.purchase(clientId, packageId);

    expect(purchase.status).toBe(S.COMPLETED);
    expect(gateway.charges).toHaveLength(1);
    expect(gateway.charges[0]).toMatchObject({ amount: 10_000, reference: purchase.id });
    expect(purchase.chargeId).toBe(gateway.charges[0].chargeId);
    expect(getClient(db, clientId)).toEqual({ packageId, walletBalance: 12_500 });
  });

  it('declined card: PAYMENT_FAILED, nothing changed, nothing refunded', async () => {
    gateway.failNextChargeWith('DECLINED');

    await expect(service.purchase(clientId, packageId)).rejects.toBeInstanceOf(PurchaseDeclinedError);

    expect(purchasesOf(db, clientId)).toEqual([{ status: S.PAYMENT_FAILED, chargeId: null }]);
    expect(gateway.refunds).toHaveLength(0);
    expect(getClient(db, clientId)).toEqual({ packageId: oldPackageId, walletBalance: 500 });
  });

  it('payment timeout: the outcome is unknown, so the purchase stays PENDING and is NOT refunded', async () => {
    gateway.failNextChargeWith('TIMEOUT');

    await expect(service.purchase(clientId, packageId)).rejects.toBeInstanceOf(PurchaseOutcomeUnknownError);

    expect(purchasesOf(db, clientId)).toEqual([{ status: S.PENDING, chargeId: null }]);
    expect(gateway.refunds).toHaveLength(0);
    expect(getClient(db, clientId)).toEqual({ packageId: oldPackageId, walletBalance: 500 });
  });

  it.each(['mark_purchase_paid', 'set_client_package', 'credit_wallet', 'complete_package_purchase'])(
    'failure in %s after the charge: refunds once, restores the client, ends REFUNDED',
    async (stepName) => {
      faults.failStep(stepName);

      await expect(service.purchase(clientId, packageId)).rejects.toBeInstanceOf(PurchaseRefundedError);

      const [purchase] = purchasesOf(db, clientId);
      expect(purchase.status).toBe(S.REFUNDED);
      expect(gateway.refunds).toEqual([gateway.charges[0].chargeId]);
      expect(getClient(db, clientId)).toEqual({ packageId: oldPackageId, walletBalance: 500 });
    },
  );

  it('unknown or inactive package: refused before anything is saved or charged', async () => {
    const hidden = seedPackage(db, { isActive: false });

    await expect(service.purchase(clientId, 'nope')).rejects.toBeInstanceOf(NotFoundError);
    await expect(service.purchase(clientId, hidden)).rejects.toBeInstanceOf(NotFoundError);

    expect(purchasesOf(db, clientId)).toEqual([]);
    expect(gateway.charges).toHaveLength(0);
  });

  it('double tap: two simultaneous purchases → one completes, one is refused, ONE charge', async () => {
    const results = await Promise.allSettled([service.purchase(clientId, packageId), service.purchase(clientId, packageId)]);

    const won = results.filter((r) => r.status === 'fulfilled');
    const lost = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected');
    expect(won).toHaveLength(1);
    expect(lost[0].reason).toBeInstanceOf(PurchaseInProgressError);
    expect(gateway.charges).toHaveLength(1);
    expect(getClient(db, clientId).walletBalance).toBe(12_500);
  });
});

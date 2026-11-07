import { FaultInjector } from '../../../../../../src/shared/testing';
import { PackagePurchaseStatus } from '../../../../../../src/modules/package-purchases/enums';
import { FakePaymentGateway } from '../../../../../../src/modules/payments';
import { PurchasePackageSagaParams } from '../../../../../../src/modules/purchasing/saga/purchase-package.saga.types';
import { ChargePackagePurchaseStep } from '../../../../../../src/modules/purchasing/saga/steps';

describe('ChargePackagePurchaseStep', () => {
  let gateway: FakePaymentGateway;
  let faults: FaultInjector;
  let step: ChargePackagePurchaseStep;
  let params: PurchasePackageSagaParams;

  beforeEach(() => {
    gateway = new FakePaymentGateway();
    faults = new FaultInjector();
    step = new ChargePackagePurchaseStep(gateway, faults);
    params = {
      purchase: {
        id: 'purchase-1',
        clientId: 'client-1',
        packageId: 'package-1',
        amount: 10_000,
        status: PackagePurchaseStatus.PENDING,
        chargeId: null,
        createdAt: '2026-11-07T10:00:00.000Z',
        updatedAt: '2026-11-07T10:00:00.000Z',
      },

      walletCredit: 12_000,
    };
  });

  it('charges the purchase amount with the purchase id as reference, and remembers the chargeId', async () => {
    await step.invoke(params);

    expect(gateway.charges).toHaveLength(1);
    expect(gateway.charges[0]).toMatchObject({ amount: 10_000, reference: 'purchase-1' });
    expect(params.chargeId).toBe(gateway.charges[0].chargeId);
  });

  it('charges nothing when a failure is injected for this step', async () => {
    faults.failStep('charge_package_purchase');

    await expect(step.invoke(params)).rejects.toThrow('charge_package_purchase');

    expect(gateway.charges).toHaveLength(0);
    expect(params.chargeId).toBeUndefined();
  });

  it('refunds the charge on compensate', async () => {
    await step.invoke(params);

    await step.compensate(params);

    expect(gateway.refunds).toEqual([params.chargeId]);
    expect(params.refunded).toBe(true);
  });

  it('refunds once when compensate is called twice, and does not throw', async () => {
    await step.invoke(params);
    await step.compensate(params);

    await expect(step.compensate(params)).resolves.toBeUndefined();

    expect(gateway.refunds).toHaveLength(1);
  });

  it('treats a charge that was already refunded elsewhere as done', async () => {
    await step.invoke(params);
    await gateway.refund(params.chargeId!); // refunded outside the saga (e.g. by support)

    await expect(step.compensate(params)).resolves.toBeUndefined();

    expect(gateway.refunds).toHaveLength(1);
    expect(params.refunded).toBe(true);
  });

  it('rethrows a real refund failure so the runner can report it', async () => {
    params.chargeId = 'chg_unknown'; // the fake rejects charges it never made

    await expect(step.compensate(params)).rejects.toThrow('Unknown charge chg_unknown');

    expect(params.refunded).toBeUndefined();
  });
});

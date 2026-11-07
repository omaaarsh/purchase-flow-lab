import { Step } from '../../../../shared/saga';
import { FaultInjector } from '../../../../shared/testing';
import { PackagePurchasesService } from '../../../package-purchases/services';
import { PurchasePackageSagaParams } from '../purchase-package.saga.types';
import { PackagePurchaseEvent } from '../../../package-purchases/state-machine';

export class MarkPurchasePaidStep extends Step<PurchasePackageSagaParams> {
  readonly name = 'mark_purchase_paid';

  constructor(
    private readonly purchases: PackagePurchasesService,
    private readonly faults: FaultInjector,
  ) {
    super();
  }

  async invoke(params: PurchasePackageSagaParams): Promise<void> {
    this.faults.check(this.name);
    await this.purchases.applyEvent(params.purchase.id, PackagePurchaseEvent.PAY_SUCCEEDED, { chargeId: params.chargeId });
  }

  async compensate(params: PurchasePackageSagaParams): Promise<void> {
    // Nothing to undo: the money is refunded by the charge step, and the service moves the purchase to REFUNDED after the saga fails.
  }
}

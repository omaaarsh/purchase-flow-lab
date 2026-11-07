import { Step } from '../../../../shared/saga';
import { FaultInjector } from '../../../../shared/testing';
import { PackagePurchasesService } from '../../../package-purchases/services';
import { PurchasePackageSagaParams } from '../purchase-package.saga.types';
import { PackagePurchaseEvent } from '../../../package-purchases/state-machine';

export class CompletePackagePurchaseStep extends Step<PurchasePackageSagaParams> {
  readonly name = 'complete_package_purchase';

  constructor(
    private readonly purchases: PackagePurchasesService,
    private readonly faults: FaultInjector,
  ) {
    super();
  }

  async invoke(params: PurchasePackageSagaParams): Promise<void> {
    this.faults.check(this.name);
    await this.purchases.applyEvent(params.purchase.id, PackagePurchaseEvent.COMPLETE);
  }

  async compensate(params: PurchasePackageSagaParams): Promise<void> {
    // Never runs: this is the last step. If it succeeds nothing after it can fail; if it fails, a failed step is not compensated.
  }
}

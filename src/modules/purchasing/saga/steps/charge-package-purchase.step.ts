import { Step } from '../../../../shared/saga';
import { FaultInjector } from '../../../../shared/testing';
import { PaymentGateway, AlreadyRefundedError } from '../../../payments';
import { PurchasePackageSagaParams } from '../purchase-package.saga.types';

export class ChargePackagePurchaseStep extends Step<PurchasePackageSagaParams> {
  readonly name = 'charge_package_purchase';

  constructor(
    private readonly gateway: PaymentGateway,
    private readonly faults: FaultInjector,
  ) {
    super();
  }

  async invoke(params: PurchasePackageSagaParams): Promise<void> {
    this.faults.check(this.name);
    const { purchase } = params;
    const { chargeId } = await this.gateway.charge({ amount: purchase.amount, reference: purchase.id });
    params.chargeId = chargeId;
  }

  async compensate(params: PurchasePackageSagaParams): Promise<void> {
    if (params.refunded) {
      return;
    }
    try {
      await this.gateway.refund(params.chargeId!);
      params.refunded = true;
    } catch (error) {
      if (error instanceof AlreadyRefundedError) {
        params.refunded = true;
      } else {
        throw error;
      }
    }
  }
}

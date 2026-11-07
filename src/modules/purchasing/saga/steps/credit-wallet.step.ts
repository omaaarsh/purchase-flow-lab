import { Step } from '../../../../shared/saga';
import { FaultInjector } from '../../../../shared/testing';
import { ClientRepository } from '../../../clients/repositories';
import { PurchasePackageSagaParams } from '../purchase-package.saga.types';

export class CreditWalletStep extends Step<PurchasePackageSagaParams> {
  readonly name = 'credit_wallet';

  constructor(
    private readonly clients: ClientRepository,
    private readonly faults: FaultInjector,
  ) {
    super();
  }

  async invoke(params: PurchasePackageSagaParams): Promise<void> {
    this.faults.check(this.name);
    await this.clients.addToWallet(params.purchase.clientId, params.walletCredit);
  }

  async compensate(params: PurchasePackageSagaParams): Promise<void> {
    if (params.walletDebited) {
      return;
    }
    await this.clients.addToWallet(params.purchase.clientId, -params.walletCredit);
    params.walletDebited = true;
  }
}

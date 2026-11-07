import { Step } from '../../../../shared/saga';
import { FaultInjector } from '../../../../shared/testing';
import { ClientRepository } from '../../../clients/repositories';
import { PurchasePackageSagaParams } from '../purchase-package.saga.types';

export class SetClientPackageStep extends Step<PurchasePackageSagaParams> {
  readonly name = 'set_client_package';

  constructor(
    private readonly clients: ClientRepository,
    private readonly faults: FaultInjector,
  ) {
    super();
  }

  async invoke(params: PurchasePackageSagaParams): Promise<void> {
    this.faults.check(this.name);
    const previousPackageId = await this.clients.getPackageId(params.purchase.clientId);
    params.previousPackageId = previousPackageId;
    await this.clients.setPackage(params.purchase.clientId, params.purchase.packageId);
  }

  async compensate(params: PurchasePackageSagaParams): Promise<void> {
    await this.clients.setPackage(params.purchase.clientId, params.previousPackageId ?? null);
  }
}

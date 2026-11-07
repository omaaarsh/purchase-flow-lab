import { PackagePurchase } from '../interfaces';
import { PackagePurchaseRepository } from '../repositories';
import { PackagePurchaseEvent, PackagePurchaseStateMachine } from '../state-machine';
import { IllegalTransitionError, NotFoundError, ConcurrentUpdateError } from '../../../shared/utils';

export class PackagePurchasesService {
  constructor(
    private readonly purchases: PackagePurchaseRepository,
    private readonly stateMachine: PackagePurchaseStateMachine,
  ) {}

  async applyEvent(purchaseId: string, event: PackagePurchaseEvent, changes?: { chargeId?: string }): Promise<PackagePurchase> {
    const purchase = await this.purchases.findById(purchaseId);
    if (!purchase) {
      throw new NotFoundError(`Purchase ${purchaseId} not found`);
    }

    const nextStatus = this.stateMachine.nextStatus(purchase.status, event);
    if (!nextStatus) {
      throw new IllegalTransitionError(purchase.status, event);
    }

    const updated = await this.purchases.updateStatusIf(purchaseId, purchase.status, nextStatus, changes);
    if (!updated) {
      throw new ConcurrentUpdateError(purchaseId);
    }

    return (await this.purchases.findById(purchaseId))!;
  }
}

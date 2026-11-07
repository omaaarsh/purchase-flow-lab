import { StatusStateMachine } from '../../../shared/state-machine';
import { PackagePurchaseStatus } from '../enums';
import { PackagePurchaseEvent } from './package-purchase-event.enum';
import { PACKAGE_PURCHASE_STATES } from './package-purchase.machine';

export class PackagePurchaseStateMachine extends StatusStateMachine<PackagePurchaseStatus, PackagePurchaseEvent> {
  constructor() {
    super('package-purchase', PackagePurchaseStatus.PENDING, PACKAGE_PURCHASE_STATES);
  }
}

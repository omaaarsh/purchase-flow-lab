import { StatusStates } from '../../../shared/state-machine';
import { PackagePurchaseStatus } from '../enums';
import { PackagePurchaseEvent } from './package-purchase-event.enum';

export const PACKAGE_PURCHASE_STATES: StatusStates<PackagePurchaseStatus, PackagePurchaseEvent> = {
  [PackagePurchaseStatus.PENDING]: {
    on: {
      [PackagePurchaseEvent.PAY_SUCCEEDED]: PackagePurchaseStatus.PAID,
      [PackagePurchaseEvent.PAY_FAILED]: PackagePurchaseStatus.PAYMENT_FAILED,
      [PackagePurchaseEvent.CANCEL]: PackagePurchaseStatus.CANCELLED,
      [PackagePurchaseEvent.REFUND]: PackagePurchaseStatus.REFUNDED,
    },
  },
  [PackagePurchaseStatus.PAID]: {
    on: {
      [PackagePurchaseEvent.COMPLETE]: PackagePurchaseStatus.COMPLETED,
      [PackagePurchaseEvent.REFUND]: PackagePurchaseStatus.REFUNDED,
    },
  },
  [PackagePurchaseStatus.COMPLETED]: {
    type: 'final',
  },
  [PackagePurchaseStatus.PAYMENT_FAILED]: {
    type: 'final',
  },
  [PackagePurchaseStatus.REFUNDED]: {
    type: 'final',
  },
  [PackagePurchaseStatus.CANCELLED]: {
    type: 'final',
  },
};

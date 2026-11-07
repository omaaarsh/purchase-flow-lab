// Provided.
import { PackagePurchaseStatus } from '../enums';

export interface PackagePurchase {
  id: string;
  clientId: string;
  packageId: string;
  amount: number;
  status: PackagePurchaseStatus;
  chargeId: string | null;
  createdAt: string;
  updatedAt: string;
}

import { PackagePurchase } from '../../package-purchases/interfaces';
export interface PurchasePackageSagaParams {
  purchase: PackagePurchase;
  walletCredit: number;
  chargeId?: string;
  refunded?: boolean;
  walletDebited?: boolean;
  previousPackageId?: string | null;
}

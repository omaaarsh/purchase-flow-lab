import { Database } from '../../../shared/database';
import { SagaFailedError, SagaRunner } from '../../../shared/saga';
import { FaultInjector } from '../../../shared/testing';
import { NotFoundError } from '../../../shared/utils';
import { ClientRepository } from '../../clients/repositories';
import { PackagePurchase } from '../../package-purchases/interfaces';
import { PackagePurchaseRepository } from '../../package-purchases/repositories';
import { PackagePurchasesService } from '../../package-purchases/services';
import { PackagePurchaseEvent, PackagePurchaseStateMachine } from '../../package-purchases/state-machine';
import { PackageRepository } from '../../packages/repositories';
import { PaymentDeclinedError, PaymentGateway } from '../../payments';
import { PurchaseDeclinedError, PurchaseInProgressError, PurchaseOutcomeUnknownError, PurchaseRefundedError } from '../errors';
import { PurchasePackageSagaParams } from '../saga/purchase-package.saga.types';
import { ChargePackagePurchaseStep, CompletePackagePurchaseStep, CreditWalletStep, MarkPurchasePaidStep, SetClientPackageStep } from '../saga/steps';

export class PackagePurchasePaymentService {
  private readonly packages: PackageRepository;
  private readonly purchaseRepo: PackagePurchaseRepository;
  private readonly purchasesService: PackagePurchasesService;
  private readonly clients: ClientRepository;
  private readonly runner = new SagaRunner();

  constructor(
    db: Database,
    private readonly gateway: PaymentGateway,
    private readonly faults: FaultInjector = new FaultInjector(),
  ) {
    this.packages = new PackageRepository(db);
    this.purchaseRepo = new PackagePurchaseRepository(db);
    this.purchasesService = new PackagePurchasesService(this.purchaseRepo, new PackagePurchaseStateMachine());
    this.clients = new ClientRepository(db);
  }

  async purchase(clientId: string, packageId: string): Promise<PackagePurchase> {
    const pkg = await this.packages.findActiveById(packageId);
    if (!pkg) {
      throw new NotFoundError(`Package ${packageId} not found or inactive`);
    }

    const purchase = await this.createPendingPurchase(clientId, packageId, pkg.price);
    const params: PurchasePackageSagaParams = { purchase, walletCredit: pkg.walletCredit };

    try {
      await this.runner.run(this.buildSteps(), params);
    } catch (error) {
      await this.failPurchase(purchase.id, params, error);
    }

    return (await this.purchaseRepo.findById(purchase.id))!;
  }

  private buildSteps() {
    return [
      new ChargePackagePurchaseStep(this.gateway, this.faults),
      new MarkPurchasePaidStep(this.purchasesService, this.faults),
      new SetClientPackageStep(this.clients, this.faults),
      new CreditWalletStep(this.clients, this.faults),
      new CompletePackagePurchaseStep(this.purchasesService, this.faults),
    ];
  }

  /** A client can have only one PENDING purchase: the database's unique index refuses the second one atomically. */
  private async createPendingPurchase(clientId: string, packageId: string, amount: number): Promise<PackagePurchase> {
    try {
      return await this.purchaseRepo.create({ clientId, packageId, amount });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new PurchaseInProgressError(`Client ${clientId} already has a purchase in progress`);
      }
      throw error;
    }
  }

  /** Turns a failed saga into the purchase's final state and a clear error. Always throws. */
  private async failPurchase(purchaseId: string, params: PurchasePackageSagaParams, error: unknown): Promise<never> {
    const cause = error instanceof SagaFailedError ? error.cause : error;

    if (params.refunded) {
      await this.purchasesService.applyEvent(purchaseId, PackagePurchaseEvent.REFUND);
      throw new PurchaseRefundedError(`Purchase ${purchaseId} failed after the charge and was refunded`);
    }

    if (cause instanceof PaymentDeclinedError) {
      await this.purchasesService.applyEvent(purchaseId, PackagePurchaseEvent.PAY_FAILED);
      throw new PurchaseDeclinedError(`Purchase ${purchaseId}: the card was declined`);
    }

    throw new PurchaseOutcomeUnknownError(`Purchase ${purchaseId}: the payment outcome is unknown; it stays PENDING`);
  }
}

/** SQLITE_CONSTRAINT_UNIQUE. Checked by code, not message text, and not with `instanceof Error`: node:sqlite errors come from another realm under Jest. */
const SQLITE_CONSTRAINT_UNIQUE = 2067;

function isUniqueViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { errcode?: number }).errcode === SQLITE_CONSTRAINT_UNIQUE;
}

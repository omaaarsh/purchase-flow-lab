// Provided. The payment provider (think Stripe, Tap, Adyen…). Do not change the fake — your code must survive its behavior.
import { randomUUID } from 'node:crypto';

export interface PaymentGateway {
  /** Charges the card. Resolves with the provider's charge id. */
  charge(input: { amount: number; reference: string }): Promise<{ chargeId: string }>;
  /** Refunds a charge in full. Throws AlreadyRefundedError when the charge was refunded before. */
  refund(chargeId: string): Promise<void>;
}

/** The card was declined. Nothing was charged. */
export class PaymentDeclinedError extends Error {}
/** The provider did not answer in time. The charge MAY have happened — the result is unknown. */
export class PaymentTimeoutError extends Error {}
export class AlreadyRefundedError extends Error {}

type ChargeFailure = 'DECLINED' | 'TIMEOUT';

export class FakePaymentGateway implements PaymentGateway {
  /** Every successful charge, in order. */
  readonly charges: { chargeId: string; amount: number; reference: string }[] = [];
  /** Every refund that went through. */
  readonly refunds: string[] = [];
  private nextFailure: ChargeFailure | null = null;

  failNextChargeWith(failure: ChargeFailure): void {
    this.nextFailure = failure;
  }

  async charge(input: { amount: number; reference: string }): Promise<{ chargeId: string }> {
    await tick();
    const failure = this.nextFailure;
    this.nextFailure = null;
    if (failure === 'DECLINED') throw new PaymentDeclinedError('Card declined');

    const chargeId = `chg_${randomUUID()}`;
    this.charges.push({ chargeId, ...input });
    // Like a real timeout: the money moved, but the answer never reached us.
    if (failure === 'TIMEOUT') throw new PaymentTimeoutError('Payment provider timed out');
    return { chargeId };
  }

  async refund(chargeId: string): Promise<void> {
    await tick();
    if (!this.charges.some((c) => c.chargeId === chargeId)) throw new Error(`Unknown charge ${chargeId}`);
    if (this.refunds.includes(chargeId)) throw new AlreadyRefundedError(`Charge ${chargeId} already refunded`);
    this.refunds.push(chargeId);
  }
}

/** Yields to the event loop, like a network call would — this is what lets two requests interleave. */
const tick = () => new Promise<void>((resolve) => setImmediate(resolve));

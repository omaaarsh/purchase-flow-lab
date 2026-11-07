import { PackagePurchaseStatus as S } from '../../../../src/modules/package-purchases/enums';
import { PackagePurchaseEvent as E, PackagePurchaseStateMachine } from '../../../../src/modules/package-purchases/state-machine';

describe('PackagePurchaseStateMachine', () => {
  const machine = new PackagePurchaseStateMachine();

  // The whole lifecycle. Every pair not listed here must be refused.
  const allowed: [S, E, S][] = [
    [S.PENDING, E.PAY_SUCCEEDED, S.PAID],
    [S.PENDING, E.PAY_FAILED, S.PAYMENT_FAILED],
    [S.PENDING, E.CANCEL, S.CANCELLED],
    [S.PENDING, E.REFUND, S.REFUNDED], // charged, but we failed before we could mark it paid
    [S.PAID, E.COMPLETE, S.COMPLETED],
    [S.PAID, E.REFUND, S.REFUNDED],
  ];

  it.each(allowed)('%s + %s → %s', (from, event, to) => {
    expect(machine.nextStatus(from, event)).toBe(to);
  });

  const refused = Object.values(S).flatMap((from) =>
    Object.values(E)
      .filter((event) => !allowed.some(([f, e]) => f === from && e === event))
      .map((event) => [from, event] as [S, E]),
  );

  it.each(refused)('%s + %s is refused (null)', (from, event) => {
    expect(machine.nextStatus(from, event)).toBeNull();
  });

  it.each([S.COMPLETED, S.PAYMENT_FAILED, S.REFUNDED, S.CANCELLED])('%s is final', (status) => {
    expect(machine.isFinal(status)).toBe(true);
  });

  it.each([S.PENDING, S.PAID])('%s is not final', (status) => {
    expect(machine.isFinal(status)).toBe(false);
  });
});

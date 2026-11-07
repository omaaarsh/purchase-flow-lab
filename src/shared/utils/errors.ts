export class NotFoundError extends Error {}

export class IllegalTransitionError extends Error {
  constructor(
    readonly from: string,
    readonly event: string,
  ) {
    super(`Event ${event} is not allowed in status ${from}`);
  }
}

export class ConcurrentUpdateError extends Error {
  constructor(readonly id: string) {
    super(`Purchase ${id} was changed by another request`);
  }
}

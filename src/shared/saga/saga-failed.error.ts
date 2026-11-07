// TODO (Sunday 2.1)
export class SagaFailedError extends Error {
  constructor(
    readonly failedStep: string,
    readonly cause: unknown,
    readonly compensated: string[],
    readonly compensationFailures: string[],
  ) {
    super(`Saga failed at step ${failedStep}`);
  }
}

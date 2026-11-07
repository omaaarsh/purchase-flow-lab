import { SagaFailedError, SagaRunner, Step } from '../../../../src/shared/saga';

/** A step that records what ran into a shared log. */
class LoggingStep extends Step<string[]> {
  constructor(
    readonly name: string,
    private readonly opts: { fail?: boolean; failCompensation?: boolean } = {},
  ) {
    super();
  }

  async invoke(log: string[]): Promise<void> {
    log.push(`invoke:${this.name}`);
    if (this.opts.fail) throw new Error(`${this.name} broke`);
  }

  async compensate(log: string[]): Promise<void> {
    log.push(`compensate:${this.name}`);
    if (this.opts.failCompensation) throw new Error(`undo ${this.name} broke`);
  }
}

const step = (name: string, opts?: { fail?: boolean; failCompensation?: boolean }) => new LoggingStep(name, opts);

describe('SagaRunner (shared)', () => {
  const runner = new SagaRunner();

  it('runs every step in order and compensates nothing when all succeed', async () => {
    const log: string[] = [];

    await runner.run([step('a'), step('b'), step('c')], log);

    expect(log).toEqual(['invoke:a', 'invoke:b', 'invoke:c']);
  });

  it('stops at the failing step and compensates the completed steps in reverse', async () => {
    const log: string[] = [];

    await expect(runner.run([step('a'), step('b'), step('c', { fail: true }), step('d')], log)).rejects.toThrow();

    expect(log).toEqual(['invoke:a', 'invoke:b', 'invoke:c', 'compensate:b', 'compensate:a']);
  });

  it('throws a SagaFailedError that names the failed step and keeps the original error', async () => {
    const attempt = runner.run([step('a'), step('b', { fail: true })], []);

    await expect(attempt).rejects.toBeInstanceOf(SagaFailedError);
    await expect(attempt).rejects.toMatchObject({
      failedStep: 'b',
      cause: expect.objectContaining({ message: 'b broke' }),
      compensated: ['a'],
      compensationFailures: [],
    });
  });

  it('keeps compensating when one compensation fails, and reports it', async () => {
    const log: string[] = [];
    const attempt = runner.run([step('a'), step('b', { failCompensation: true }), step('c', { fail: true })], log);

    await expect(attempt).rejects.toMatchObject({ failedStep: 'c', compensated: ['a'], compensationFailures: ['b'] });
    expect(log).toEqual(['invoke:a', 'invoke:b', 'invoke:c', 'compensate:b', 'compensate:a']);
  });
});

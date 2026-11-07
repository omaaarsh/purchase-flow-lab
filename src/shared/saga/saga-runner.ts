import { SagaFailedError } from './saga-failed.error';
import { Step } from './step.abstract';

export class SagaRunner {
  async run<TParams>(steps: Step<TParams>[], params: TParams): Promise<void> {
    const completed: Step<TParams>[] = [];

    for (const step of steps) {
      try {
        await step.invoke(params);
        completed.push(step);
      } catch (error) {
        const compensated: string[] = [];
        const compensationFailures: string[] = [];

        for (const done of [...completed].reverse()) {
          try {
            await done.compensate(params);
            compensated.push(done.name);
          } catch {
            compensationFailures.push(done.name);
          }
        }

        throw new SagaFailedError(step.name, error, compensated, compensationFailures);
      }
    }
  }
}

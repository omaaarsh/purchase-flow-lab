// Provided. Lets tests make a named saga step fail. Call `faults.check(this.name)` at the start of each step's invoke.
export class FaultInjector {
  private readonly failing = new Set<string>();

  failStep(stepName: string): void {
    this.failing.add(stepName);
  }

  check(stepName: string): void {
    if (this.failing.has(stepName)) throw new Error(`Injected failure in step "${stepName}"`);
  }
}

// Provided — the shape of one saga step.
export abstract class Step<TParams> {
  abstract readonly name: string;
  abstract invoke(params: TParams): Promise<void>;
  /** Undoes `invoke`. Called only when a LATER step failed. Must be safe to call twice. Nothing to undo? Return. */
  abstract compensate(params: TParams): Promise<void>;
}

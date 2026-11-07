import { StatusStates, StatusTransitions } from './types';
import { createMachine, transition } from 'xstate';

/**
 * a reusable status machine built on XState. Never touches the database.
 * A module extends it with its own status enum, event enum and StatusStates map.
 */
export abstract class StatusStateMachine<TStatus extends string, TEvent extends string> {
  private readonly machine;
  protected constructor(id: string, initial: TStatus, states: StatusStates<TStatus, TEvent>) {
    this.machine = createMachine({
      id,
      types: {} as { events: { type: TEvent } },
      initial,
      states: states as Record<string, StatusTransitions<string, string>>,
    });
  }

  canHandle(current: TStatus, event: TEvent): boolean {
    return this.snapshotOf(current).can({ type: event });
  }

  /** The status `event` moves the entity to, or null when the event is not allowed in `current`. */
  nextStatus(current: TStatus, event: TEvent): TStatus | null {
    if (!this.canHandle(current, event)) {
      return null;
    }
    const [next] = transition(this.machine, this.snapshotOf(current), { type: event });
    return next.value as TStatus;
  }

  isFinal(status: TStatus): boolean {
    return this.snapshotOf(status).status === 'done';
  }

  private snapshotOf(status: TStatus) {
    return this.machine.resolveState({ value: status });
  }
}

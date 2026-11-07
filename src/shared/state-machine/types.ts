// Provided — the shape of a lifecycle.

/** Where an entity in one status can go: each event it accepts and the status that event moves it to. `final` means none. */
export interface StatusTransitions<TStatus extends string, TEvent extends string> {
  on?: Partial<Record<TEvent, TStatus>>;
  type?: 'final';
}

/** A lifecycle: in each status, which event moves the entity to which status. */
export type StatusStates<TStatus extends string, TEvent extends string> = Readonly<Record<TStatus, StatusTransitions<TStatus, TEvent>>>;

import { StatusStateMachine, StatusStates } from '../../../../src/shared/state-machine';

// A toy lifecycle, to prove the shared machine works for ANY module, not just purchases.
enum Door {
  OPEN = 'OPEN',
  CLOSED = 'CLOSED',
  LOCKED = 'LOCKED',
  BROKEN = 'BROKEN',
}
enum DoorEvent {
  CLOSE = 'CLOSE',
  OPEN = 'OPEN',
  LOCK = 'LOCK',
  UNLOCK = 'UNLOCK',
  BREAK = 'BREAK',
}

const DOOR_STATES: StatusStates<Door, DoorEvent> = {
  OPEN: { on: { CLOSE: Door.CLOSED, BREAK: Door.BROKEN } },
  CLOSED: { on: { OPEN: Door.OPEN, LOCK: Door.LOCKED, BREAK: Door.BROKEN } },
  LOCKED: { on: { UNLOCK: Door.CLOSED, BREAK: Door.BROKEN } },
  BROKEN: { type: 'final' },
};

class DoorStateMachine extends StatusStateMachine<Door, DoorEvent> {
  constructor() {
    super('door', Door.CLOSED, DOOR_STATES);
  }
}

describe('StatusStateMachine (shared)', () => {
  const machine = new DoorStateMachine();

  it('moves along an allowed event', () => {
    expect(machine.nextStatus(Door.CLOSED, DoorEvent.LOCK)).toBe(Door.LOCKED);
    expect(machine.nextStatus(Door.LOCKED, DoorEvent.UNLOCK)).toBe(Door.CLOSED);
  });

  it('returns null for an event the current status does not accept', () => {
    expect(machine.nextStatus(Door.OPEN, DoorEvent.LOCK)).toBeNull();
    expect(machine.nextStatus(Door.LOCKED, DoorEvent.OPEN)).toBeNull();
  });

  it('can start from ANY stored status, not only the initial one', () => {
    expect(machine.nextStatus(Door.OPEN, DoorEvent.CLOSE)).toBe(Door.CLOSED);
  });

  it('canHandle agrees with nextStatus', () => {
    expect(machine.canHandle(Door.CLOSED, DoorEvent.LOCK)).toBe(true);
    expect(machine.canHandle(Door.OPEN, DoorEvent.LOCK)).toBe(false);
  });

  it('knows the final statuses, and nothing leaves them', () => {
    expect(machine.isFinal(Door.BROKEN)).toBe(true);
    expect(machine.isFinal(Door.OPEN)).toBe(false);
    for (const event of Object.values(DoorEvent)) {
      expect(machine.nextStatus(Door.BROKEN, event)).toBeNull();
    }
  });
});

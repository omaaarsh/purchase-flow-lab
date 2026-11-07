# Purchase Flow Lab

A weekend lab that rebuilds a real-world package purchase flow (pay, then grant a package and wallet credit) from scratch, with **a production-style NestJS-like layout**: reusable building blocks in `src/shared/`, and one folder per feature in `src/modules/`. You build the ideas yourself, from scratch.

- **Saturday: the state machine.** The shared `StatusStateMachine`, then the `package-purchases` module that uses it, with protection against two requests changing the same row at once.
- **Sunday: the saga.** The shared `SagaRunner`, then the `purchasing` module: charge, then several more steps; if any step fails, undo the earlier ones in reverse.

Sunday builds on your Saturday code, so the two days make one real flow.

## The rules

1. **You write the logic.** Already provided: config, DB schema, the fake payment gateway, the fault injector, test helpers, enums and interfaces, empty stubs that hold only signatures, and the tests. Everything marked `TODO` is yours.
2. **The tests are the spec.** Make them pass without editing them. Tasks marked ✍️ need **tests you write yourself**.
3. **Read the docs before searching.** XState: https://stately.ai/docs (v5). `node:sqlite`: https://nodejs.org/api/sqlite.html
4. **Commit after every task**: small, reviewable steps.
5. Stuck for more than 20 minutes? Read the hint. Still stuck? Ask Claude for **a hint, not the answer**.

## Setup

```bash
cd ~/labs/purchase-flow-lab
npm test                # all 62 tests, all failing at the start
npm run test:saturday   # shared/state-machine + modules/package-purchases
npm run test:sunday     # shared/saga + modules/purchasing
npm run test:watch      # keep it open while you work
npm run typecheck
```

Node 22+ (it uses the built-in `node:sqlite`; no Docker, no Postgres). Each test gets a fresh in-memory database.

## Project structure

Feature modules plus a shared layer. Tests mirror `src/` under `test/unit/`.

```
src/
├── shared/                                   reusable, knows nothing about purchases
│   ├── database/        schema.sql, database.ts                   provided (you MAY add to schema.sql)
│   ├── state-machine/   types.ts                                  provided
│   │                    status-state-machine.abstract.ts          TODO  Saturday 1.1
│   ├── saga/            step.abstract.ts                          provided
│   │                    saga-runner.ts, saga-failed.error.ts      TODO  Sunday 2.1
│   ├── utils/           errors.ts                                 TODO  add the fields
│   └── testing/         fault-injector.ts                         provided
└── modules/
    ├── payments/        payment-gateway.ts (+ FakePaymentGateway) provided, don't change
    ├── package-purchases/                    the purchase record and its lifecycle
    │   ├── enums/           package-purchase-status.enum.ts       provided
    │   ├── interfaces/      package-purchase, create input         provided
    │   ├── state-machine/   package-purchase-event.enum.ts        provided
    │   │                    package-purchase.machine.ts           TODO  Saturday 1.2
    │   │                    package-purchase-state-machine.ts     TODO  Saturday 1.2
    │   ├── repositories/    package-purchase.repository.ts        TODO  Saturday 1.3
    │   └── services/        package-purchases.service.ts          TODO  Saturday 1.4
    └── purchasing/                           the "buy a package" flow
        ├── errors/          purchasing.errors.ts                  TODO  add the fields
        ├── saga/            purchase-package.saga.types.ts        TODO  Sunday 2.2
        │   └── steps/       (empty: one file per step)             TODO  Sunday 2.2
        └── services/        package-purchase-payment.service.ts   TODO  Sunday 2.3
```

**Dependency rule:** `modules/` may import from `shared/`, and `shared/` **never** imports from `modules/`. `purchasing` uses `package-purchases` and `payments`, not the other way round.

## The domain

A client buys a **package**. They pay its `price`, the package becomes **their package**, and `wallet_credit` is added to their wallet. Money is an **integer in halalas** (10 000 = 100 SAR), never a float.

```
          PAY_SUCCEEDED          COMPLETE
PENDING ───────────────▶ PAID ──────────▶ COMPLETED
  │  │  │                  │
  │  │  │ REFUND           │ REFUND
  │  │  └──────────────────┴──────▶ REFUNDED
  │  │ PAY_FAILED
  │  └──────────────▶ PAYMENT_FAILED
  │ CANCEL
  └─────────────▶ CANCELLED

COMPLETED, PAYMENT_FAILED, REFUNDED and CANCELLED are final: no way out.
```

---

## Saturday: the state machine

**Goal:** `npm run test:saturday` is green, and you can explain why the double-tap test passes.

### 1.1 `shared/state-machine`: `StatusStateMachine` (abstract, generic)
A reusable machine for **any** module's statuses. Its test uses a toy door lifecycle (OPEN, CLOSED, LOCKED, BROKEN), not purchases. Build the XState machine in the constructor from the `StatusStates` map, then implement:
- `nextStatus(current, event)`: the next status, or `null` when the event isn't allowed. Don't write a `switch`: **ask the machine**.
- `canHandle(current, event)`
- `isFinal(status)`

> Hint: the database stores a plain string, not a running machine. `machine.resolveState({ value: current })` turns the string into a snapshot. Then look at `snapshot.can(...)` and the pure `transition(machine, snapshot, event)` from `xstate`. Why use the pure one and not `createActor`?
>
> Hint: a snapshot has a `status` field. What is it in a final state?
>
> Hint: TypeScript and a generic `TEvent` don't get along inside `createMachine`. Type the events with `types: {} as { events: { type: TEvent } }`, and cast the states map once if you must.

### 1.2 `modules/package-purchases/state-machine`
- `PACKAGE_PURCHASE_STATES`: every arrow from the diagram, plus `type: 'final'` on the four end states.
- `PackagePurchaseStateMachine extends StatusStateMachine`, with id `'package-purchase'` and initial `PENDING`.

This is the whole point of a shared base: the module adds **only its map**, with no logic.

✍️ Write one test of your own: an event that is allowed in one state and refused in another.

### 1.3 `PackagePurchaseRepository`, the only place with SQL
- `create`: new id (`randomUUID`), status `PENDING`, `chargeId` null, ISO timestamps.
- `findById`: map `snake_case` columns to the camelCase `PackagePurchase`.
- `updateStatusIf(id, from, to, changes?)`: **the most important line of the weekend.** Change the row only if it is *still* in `from`, and return whether a row changed.

> Hint: `UPDATE … WHERE id = ? AND status = ?`, then look at what `.run()` returns.

### 1.4 `PackagePurchasesService.applyEvent(id, event, changes?)`
Read the purchase, ask the state machine for the next status, write it conditionally.
- Unknown id: `NotFoundError`.
- Refused event: `IllegalTransitionError`, with `from` and `event` as fields.
- The row changed under you: `ConcurrentUpdateError`.

### 1.5 Break it on purpose (no code to keep)
Temporarily make `updateStatusIf` ignore `from` (a plain `WHERE id = ?`) and run the double-tap test. Watch both requests "win", then put it back.
✍️ In `NOTES.md`, write in 3 lines **why** two requests in one Node process can interleave between your read and your write. Hint: what happens at every `await`?

### Saturday questions (answer them in `NOTES.md`)
- Why does the state machine live in `shared/` while the lifecycle map lives in the module?
- Why keep the machine **pure** (no DB inside it), with the DB in the repository?
- Why doesn't checking the status in code before writing (`if (p.status === 'PENDING')`) protect you on its own?

---

## Sunday: the saga

**Goal:** `npm run test:sunday` is green, and every step failure leaves the money and the data consistent.

### 2.1 `shared/saga`: `SagaRunner.run(steps, params)` and `SagaFailedError`
Every step extends the provided `Step<TParams>` (`name`, `invoke`, `compensate`). Run the steps in order. If one throws:
- Compensate the steps that **completed**, in **reverse** order. The failed step's own `compensate` does **not** run. Why not?
- A compensation that throws must **not** stop the others; record its name.
- Throw a `SagaFailedError` with `failedStep`, `cause` (the original error), `compensated` and `compensationFailures`.

### 2.2 `modules/purchasing/saga`: the steps
One class per file in `saga/steps/`, each extending `Step<PurchasePackageSagaParams>`. Step names are fixed, because the tests inject failures by name. Call `faults.check(this.name)` first in each `invoke`.

| Step (`name`) | invoke | compensate |
|---|---|---|
| `charge_package_purchase` | `gateway.charge({ amount, reference: purchase.id })`; keep the `chargeId` | refund, **safe to call twice** (the fake throws `AlreadyRefundedError` the 2nd time) |
| `mark_purchase_paid` | `PAY_SUCCEEDED` through **`PackagePurchasesService`**, saving the `chargeId` | (think: does it need one?) |
| `set_client_package` | set the client's package | restore the **previous** package |
| `credit_wallet` | add `wallet_credit` | take it back |
| `complete_package_purchase` | `COMPLETE` through `PackagePurchasesService` | nothing to undo |

Design `PurchasePackageSagaParams` in `purchase-package.saga.types.ts`: what does each step need to read, and what must it remember to undo itself?

> Where does client and wallet SQL go? Not in a step. Give it a home: a small `clients` module (`src/modules/clients/repositories/…`) keeps SQL in repositories.

### 2.3 `PackagePurchasePaymentService.purchase(clientId, packageId)`
1. **Every check before anything is saved:** the package exists and is active, otherwise `NotFoundError`. No row, no charge.
2. Create the purchase (`PENDING`), then run the saga.
3. Map the outcome to a final state and a clear error:

| What happened | Purchase status | Error |
|---|---|---|
| all steps succeeded | `COMPLETED` | none; return the purchase |
| card declined | `PAYMENT_FAILED` | `PurchaseDeclinedError` |
| payment **timeout** | stays `PENDING`, **no refund** | `PurchaseOutcomeUnknownError` |
| a step after the charge failed | `REFUNDED`, refunded once, client restored | `PurchaseRefundedError` |

> Why does a timeout stay PENDING and not get refunded? Read `FakePaymentGateway.charge` carefully: on a timeout, did the money move?

### 2.4 Double tap
Two `purchase()` calls at the same time for the same client: one completes, the other gets `PurchaseInProgressError`, and there is **one** charge.

> Hint: your Saturday conditional update protects a row that already exists, but here the second request creates a **new** row. Which layer can refuse "a second PENDING purchase for the same client" atomically? You're allowed to add to `schema.sql`.

✍️ Write these tests yourself, in `test/unit/modules/purchasing/saga/steps/`:
- The charge compensation called twice refunds only once and doesn't throw.
- A client with **no** previous package gets `null` back after a rollback.
- When a compensation itself fails, the error you throw still says the purchase was not completed.

### Sunday questions (`NOTES.md`)
- What's the difference between a **saga** and a **DB transaction**? Why can't one `BEGIN … COMMIT` cover the charge?
- What would you do in production when a compensation fails (the refund call is down)? (Hint: who can fix it by hand?)
- Draw the order of events when `credit_wallet` fails: invokes, then compensations, then status changes.
- What does your `SagaRunner` do well, and what would a production saga runner add?

---

## Done when

- [ ] `npm test`: 62/62 provided tests, plus your ✍️ tests, all green
- [ ] `npm run typecheck` is clean, with no `any` in your code
- [ ] `shared/` imports nothing from `modules/`
- [ ] `NOTES.md` answers the Saturday and Sunday questions
- [ ] One commit per task

## Stretch (only if you finish early)

- **NestJS:** wrap each module in a `@Module`, inject services through `Constants.*` tokens and interfaces.
- **Retry:** a `retries` option per step for temporary errors, never for the charge. Why not?
- **Outbox:** emit a `package-purchase.completed` event that is saved in the same write as the status change, so it can't get lost (for example, a "purchase succeeded" push notification).
- **Recovery job:** find purchases stuck in `PENDING` for over 10 minutes and ask the gateway what really happened.

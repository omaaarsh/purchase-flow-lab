# Saturday notes

## 1. Why can two requests interleave in single-threaded Node?

Node runs one thing at a time, but every `await` is a pause point. While request A waits for the database or the network, the event loop runs request B. So A's read and A's write are not one step: B can run between them.

## 2. Why doesn't `if (purchase.status === 'PENDING')` in TypeScript protect you, while `WHERE … AND status = ?` does?

In TypeScript the check and the write are two separate steps, and another request can run between them: both requests read PENDING, both pass the check, both write.

`UPDATE … WHERE id = ? AND status = 'PENDING'` makes the check and the write one atomic step inside the database. Nothing can run between them. The first update finds PENDING and changes 1 row; the second finds PAID, the `WHERE` doesn't match, and it changes 0 rows. The number of changed rows tells you who won.

## 3. What is a lost update? What would it cost in a real payment flow?

A lost update is when two writes hit the same row, the second overwrites the first, and nobody gets an error: both requests return success, but one write is gone.

In the broken test, request A wrote `chg_a`, request B wrote `chg_b`, and the database kept only `chg_b`. In a real app, a double tap on "Pay" would make two charges at the payment provider (the customer pays twice), but only one charge id is saved. There is no record of the other charge, so nobody can refund it until the customer complains. It's worse than a crash, because a crash is loud and a lost update is silent.

## 4. Why does the state machine live in `shared/` while the lifecycle map lives in the module?

The machine is the mechanism: "given a status and an event, where do I go?" It is generic, so any module can reuse it (package purchases, orders, the door in the test). The lifecycle map is the policy: which arrows exist for this entity. That is business-specific, so it lives in the module that owns it. Mechanism in `shared/`, policy in the module.

## 5. Why call `resolveState` every time instead of keeping a running actor?

The database is the source of truth: a purchase loaded from it may already be PAID. An actor always starts at `initial` (PENDING); to reach PAID it would have to replay every past event. `resolveState({ value: 'PAID' })` jumps straight to the stored status, we ask our question, and throw the snapshot away. It's pure and has no memory between requests, so it's always in sync with the database.

## 6. The plain lookup also passed the tests. What would make you choose XState anyway?

- Validation: a typo in a target (`REFUND: 'REFUNDD'`) fails when the machine is built, not in production.
- Guards: conditional rules such as "REFUND only within 14 days", without `if`s spread across the code.
- Actions and nested states, for when the lifecycle grows.
- Visualization: paste it into the Stately visualizer and see the diagram, which helps when explaining it to PO and QA.
- A shared vocabulary: every entity with a lifecycle (orders, purchases, subscriptions) uses the same tool across the team.

## 7. Why does `create` return `Promise<PackagePurchase>` and not `| null`, while `findById` returns `| null`?

After an insert, I created the row myself, so it must exist: `create` either works or throws, it never "succeeds with nothing". `findById` gets any id from outside, so "not found" is a normal, expected answer and `null` is honest.

Rule: return `null` when "not found" is a normal outcome; throw when something is broken.

# Sunday notes

## 1. What is the difference between a saga and a database transaction? Why can't one `BEGIN … COMMIT` cover the charge?

A transaction makes many writes all-or-nothing inside one database: on failure, `ROLLBACK` erases them as if they never happened. A saga is a list of steps that may touch different systems, where each step has its own compensation; on failure it runs the compensations of the completed steps in reverse. It doesn't erase history, it adds new actions that cancel it out (the charge happened, then a refund happened).

The charge happens at the payment provider, outside our database. A `ROLLBACK` can't take money back from the provider; only a refund call can. So the charge can't be inside our transaction, and the flow needs a saga.

## 2. What would you do in production when a compensation fails (the refund call is down)?

Never hide it. The runner keeps compensating the other steps and reports the failed undo in `compensationFailures`. Then: log it with the purchase id and charge id, alert (Slack), and leave a clear record so the refund can be retried, by a retry job with backoff or by customer support, who refund manually from the provider's dashboard. The compensation is idempotent, so retrying it is always safe.

## 3. What is the order of events when `credit_wallet` fails?

1. invoke `charge_package_purchase`: the card is charged, `chargeId` saved in params.
2. invoke `mark_purchase_paid`: the purchase moves PENDING → PAID.
3. invoke `set_client_package`: the old package is remembered, the new one set.
4. invoke `credit_wallet`: throws.
5. compensate `set_client_package`: the old package is restored.
6. compensate `mark_purchase_paid`: nothing to undo.
7. compensate `charge_package_purchase`: refund, `refunded = true`.
8. The runner throws `SagaFailedError` (failedStep `credit_wallet`, compensated in that order).
9. The service sees `refunded`, applies REFUND (PAID → REFUNDED) and throws `PurchaseRefundedError`.

`credit_wallet` itself is not compensated: it failed, so it never made it into the completed list.

## 4. Why does the failed step's own `compensate` never run?

A step is added to the completed list only after its `invoke` succeeds. The failed step threw before that, so it was never completed, and only completed steps are compensated. If a step can fail halfway, it must clean up its own half-done work inside `invoke` before throwing.

## 5. What is idempotency, and why must compensations be idempotent?

An operation is idempotent when running it twice has the same effect as running it once, like pressing an elevator button five times. Compensations can run more than once in production: a refund call times out but the provider did refund, the server crashes mid-rollback and a recovery job reruns it, support clicks "retry". If the refund weren't idempotent it would refund twice or crash and stop the other undos. The charge step remembers `refunded` and treats `AlreadyRefundedError` as done; the wallet step remembers `walletDebited`.

## 6. Why does a payment timeout leave the purchase PENDING without a refund?

On a timeout we don't know whether the money moved: the provider may have charged the card, but its answer never reached us, so we have no `chargeId` to refund. Marking it PAYMENT_FAILED could be a lie (the customer was charged and might pay again); refunding is impossible without the charge id. The honest state is "unknown": stay PENDING, throw `PurchaseOutcomeUnknownError`, and let a recovery job ask the provider what happened, or let support resolve it. Never turn "unknown" into "failed" or "succeeded" because it's convenient.

## 7. Why does the double tap need a unique index, when Saturday's conditional update already protects statuses?

`UPDATE … WHERE status = ?` protects a row that already exists. A second tap doesn't update the first purchase; it inserts a new one, and no `WHERE` can stop an insert. The partial unique index `(client_id) WHERE status = 'PENDING'` lets the database refuse a second in-progress purchase for the same client atomically. The service maps that violation to `PurchaseInProgressError`. Once the purchase leaves PENDING, the client can buy again.

## 8. Why does the service check SQLite's error code instead of `error instanceof Error`?

Jest runs each test file in a sandbox with its own `Error` class. Errors from Node's built-in modules, like `node:sqlite`, are created with Node's own `Error`, so `instanceof Error` is false under Jest. Checking `errcode === 2067` (`SQLITE_CONSTRAINT_UNIQUE`) works everywhere, and doesn't break if SQLite rewords its message.

## 9. What does my `SagaRunner` do well, and what would a production saga runner add?

What mine does well:
- It throws a `SagaFailedError` that says which step failed, which undos ran and which undos failed. A runner that only rethrows the original error and logs compensation failures leaves the caller unable to tell whether the refund actually happened.
- It reverses a copy (`[...completed].reverse()`), so the list of completed steps is never mutated.

What a production runner adds:
- Logging of every invoke, failure and compensation, for observability.
- Steps that return results, and a shared context passed to compensations.
- Dependency injection (for example a NestJS `@Injectable`), so steps and the runner are easy to wire and to mock.
- Persisted saga state: saving each step's status to the database, so after a crash in the middle a recovery job can finish or compensate the saga. Mine keeps progress only in memory.

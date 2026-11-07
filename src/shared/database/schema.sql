-- Provided. You may ADD to this file (indexes, columns) when a task needs it; don't remove what is here.
-- Money is stored as integers in halalas (1 SAR = 100 halalas) — never floats.

CREATE TABLE packages (
  id            TEXT PRIMARY KEY,
  name          TEXT    NOT NULL,
  price         INTEGER NOT NULL,          -- what the customer pays
  wallet_credit INTEGER NOT NULL,          -- what lands in the customer's wallet
  is_active     INTEGER NOT NULL DEFAULT 1 -- 0 = hidden by admin, cannot be bought
);

CREATE TABLE clients (
  id             TEXT PRIMARY KEY,
  name           TEXT    NOT NULL,
  package_id     TEXT    NULL REFERENCES packages(id),
  wallet_balance INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE package_purchases (
  id         TEXT PRIMARY KEY,
  client_id  TEXT    NOT NULL REFERENCES clients(id),
  package_id TEXT    NOT NULL REFERENCES packages(id),
  amount     INTEGER NOT NULL,
  status     TEXT    NOT NULL,
  charge_id  TEXT    NULL,                 -- the payment provider's id, set once charged
  created_at TEXT    NOT NULL,
  updated_at TEXT    NOT NULL
);

-- A client can have at most ONE purchase in progress. Two simultaneous "Pay" taps race to insert;
-- the database lets the first in and refuses the second atomically (the service maps it to PurchaseInProgressError).
CREATE UNIQUE INDEX one_pending_purchase_per_client ON package_purchases (client_id) WHERE status = 'PENDING';

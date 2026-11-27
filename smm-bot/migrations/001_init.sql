-- Schema for the SMM order bot. Lives in its own schema so it can share
-- a Supabase project with other apps without mixing tables.
CREATE SCHEMA IF NOT EXISTS smm;

-- The Supabase REST API roles must never read or write bot data.
REVOKE ALL ON SCHEMA smm FROM PUBLIC;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    EXECUTE 'REVOKE ALL ON SCHEMA smm FROM anon';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    EXECUTE 'REVOKE ALL ON SCHEMA smm FROM authenticated';
  END IF;
END $$;

CREATE TABLE smm.services (
  code        text PRIMARY KEY,
  target      text NOT NULL CHECK (target IN ('username', 'post')),
  name_ru     text NOT NULL,
  name_uk     text NOT NULL,
  name_en     text NOT NULL,
  unit_ru     text NOT NULL DEFAULT '',
  unit_uk     text NOT NULL DEFAULT '',
  unit_en     text NOT NULL DEFAULT '',
  asks_notes  boolean NOT NULL DEFAULT false,
  sort        int NOT NULL DEFAULT 0,
  is_active   boolean NOT NULL DEFAULT true
);

CREATE TABLE smm.packages (
  id           serial PRIMARY KEY,
  service_code text NOT NULL REFERENCES smm.services(code),
  quantity     int NOT NULL CHECK (quantity > 0),
  price_cents  int NOT NULL CHECK (price_cents > 0),
  is_active    boolean NOT NULL DEFAULT true,
  UNIQUE (service_code, quantity)
);

CREATE TABLE smm.customers (
  tg_id       bigint PRIMARY KEY,
  first_name  text,
  tg_username text,
  lang        text CHECK (lang IN ('ru', 'uk', 'en')),
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE smm.orders (
  id               serial PRIMARY KEY,
  customer_id      bigint NOT NULL REFERENCES smm.customers(tg_id),
  ig_username      text NOT NULL,
  total_cents      int NOT NULL CHECK (total_cents > 0),
  status           text NOT NULL DEFAULT 'awaiting_payment' CHECK (status IN (
                     'awaiting_payment', 'payment_review', 'paid',
                     'in_progress', 'done', 'cancelled', 'rejected')),
  payment_method   text CHECK (payment_method IN ('card', 'crypto')),
  crypto_invoice_id bigint,
  crypto_pay_url   text,
  team_message_id  bigint,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX orders_customer_idx ON smm.orders (customer_id, created_at DESC);
CREATE INDEX orders_status_idx ON smm.orders (status);

CREATE TABLE smm.order_items (
  id           serial PRIMARY KEY,
  order_id     int NOT NULL REFERENCES smm.orders(id) ON DELETE CASCADE,
  package_id   int NOT NULL REFERENCES smm.packages(id),
  service_code text NOT NULL,
  quantity     int NOT NULL,
  price_cents  int NOT NULL,          -- price at the moment of ordering
  post_url     text,
  notes        text
);

CREATE TABLE smm.order_events (
  id         serial PRIMARY KEY,
  order_id   int NOT NULL REFERENCES smm.orders(id) ON DELETE CASCADE,
  actor_id   bigint,                  -- Telegram ID; NULL = system
  from_status text,
  to_status  text NOT NULL,
  note       text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE smm.settings (
  key   text PRIMARY KEY,
  value text NOT NULL
);

-- Row Level Security with no policies: nothing gets through the REST API
-- even if someone exposes the schema later. The bot connects as the owner.
ALTER TABLE smm.services     ENABLE ROW LEVEL SECURITY;
ALTER TABLE smm.packages     ENABLE ROW LEVEL SECURITY;
ALTER TABLE smm.customers    ENABLE ROW LEVEL SECURITY;
ALTER TABLE smm.orders       ENABLE ROW LEVEL SECURITY;
ALTER TABLE smm.order_items  ENABLE ROW LEVEL SECURITY;
ALTER TABLE smm.order_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE smm.settings     ENABLE ROW LEVEL SECURITY;

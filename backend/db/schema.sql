-- Land Chain database schema (PostgreSQL)
-- Safe to run multiple times.

CREATE TABLE IF NOT EXISTS users (
    id              SERIAL PRIMARY KEY,
    wallet_address  VARCHAR(42) UNIQUE NOT NULL,
    full_name       VARCHAR(120),
    email           VARCHAR(180),
    phone           VARCHAR(30),
    role            VARCHAR(20) NOT NULL DEFAULT 'user',      -- 'user' | 'government'
    kyc_status      VARCHAR(20) NOT NULL DEFAULT 'none',      -- none | pending | approved | rejected
    nonce           VARCHAR(64),
    created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS kyc (
    id              SERIAL PRIMARY KEY,
    user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    full_name       VARCHAR(120) NOT NULL,
    date_of_birth   DATE,
    nationality     VARCHAR(80),
    id_number       VARCHAR(80) NOT NULL,
    address         TEXT,
    document_name   VARCHAR(255),
    document_path   VARCHAR(500),
    status          VARCHAR(20) NOT NULL DEFAULT 'pending',   -- pending | approved | rejected
    reject_reason   TEXT,
    reviewed_at     TIMESTAMP,
    created_at      TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS properties (
    id              SERIAL PRIMARY KEY,
    title           VARCHAR(200) NOT NULL,
    description     TEXT,
    location        VARCHAR(255) NOT NULL,
    property_type   VARCHAR(60),
    area_sqft       NUMERIC(14, 2),
    owner_id        INTEGER NOT NULL REFERENCES users(id),
    owner_wallet    VARCHAR(42) NOT NULL,
    status          VARCHAR(20) NOT NULL DEFAULT 'pending',   -- pending | verified | listed | rejected
    price           NUMERIC(40, 0),                           -- price in wei
    nft_token_id    INTEGER,
    metadata_uri    VARCHAR(400),
    mint_tx_hash    VARCHAR(80),
    reject_reason   TEXT,
    created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ownership_history (
    id              SERIAL PRIMARY KEY,
    property_id     INTEGER NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    owner_id        INTEGER REFERENCES users(id),
    owner_wallet    VARCHAR(42) NOT NULL,
    price           NUMERIC(40, 0),
    tx_hash         VARCHAR(80),
    started_at      TIMESTAMP NOT NULL DEFAULT NOW(),
    ended_at        TIMESTAMP
);

CREATE TABLE IF NOT EXISTS requests (
    id                          SERIAL PRIMARY KEY,
    property_id                 INTEGER NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    buyer_id                    INTEGER NOT NULL REFERENCES users(id),
    buyer_wallet                VARCHAR(42) NOT NULL,
    seller_wallet               VARCHAR(42) NOT NULL,
    price                       NUMERIC(40, 0) NOT NULL,
    status                      VARCHAR(20) NOT NULL DEFAULT 'Pending', -- Pending | Accepted | GovApproved | Paid | Rejected
    document_hash               VARCHAR(80),
    documents_visible_to_seller BOOLEAN NOT NULL DEFAULT FALSE,
    onchain_request_id          INTEGER,
    create_tx_hash              VARCHAR(80),
    accept_tx_hash              VARCHAR(80),
    approve_tx_hash             VARCHAR(80),
    pay_tx_hash                 VARCHAR(80),
    reject_reason               TEXT,
    created_at                  TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at                  TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS documents (
    id                  SERIAL PRIMARY KEY,
    request_id          INTEGER NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
    file_name           VARCHAR(255) NOT NULL,
    file_path           VARCHAR(500) NOT NULL,
    file_hash           VARCHAR(80),
    visible_to_seller   BOOLEAN NOT NULL DEFAULT FALSE,
    uploaded_at         TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Property photos. Public (shown on the marketplace); stored off-chain.
CREATE TABLE IF NOT EXISTS property_images (
    id          SERIAL PRIMARY KEY,
    property_id INTEGER NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    file_name   VARCHAR(255) NOT NULL,
    file_path   VARCHAR(500) NOT NULL,
    file_hash   VARCHAR(80),
    sort_order  INTEGER NOT NULL DEFAULT 0,
    created_at  TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Ownership proof documents supplied by the seller when listing.
-- Private: only the owner, the government, and accepted buyers may view them.
CREATE TABLE IF NOT EXISTS property_documents (
    id          SERIAL PRIMARY KEY,
    property_id INTEGER NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    file_name   VARCHAR(255) NOT NULL,
    file_path   VARCHAR(500) NOT NULL,
    file_hash   VARCHAR(80),
    doc_type    VARCHAR(60),
    uploaded_by INTEGER REFERENCES users(id),
    created_at  TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_properties_owner ON properties(owner_wallet);
CREATE INDEX IF NOT EXISTS idx_requests_property ON requests(property_id);
CREATE INDEX IF NOT EXISTS idx_requests_buyer ON requests(buyer_wallet);
CREATE INDEX IF NOT EXISTS idx_requests_seller ON requests(seller_wallet);
CREATE INDEX IF NOT EXISTS idx_documents_request ON documents(request_id);
CREATE INDEX IF NOT EXISTS idx_history_property ON ownership_history(property_id);
CREATE INDEX IF NOT EXISTS idx_property_images_property ON property_images(property_id);
CREATE INDEX IF NOT EXISTS idx_property_documents_property ON property_documents(property_id);

-- ---------------------------------------------------------------------------
-- Migrations for databases created before a column existed.
-- These are safe to run on every start.
-- ---------------------------------------------------------------------------
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(30);
ALTER TABLE documents ADD COLUMN IF NOT EXISTS doc_type VARCHAR(40);

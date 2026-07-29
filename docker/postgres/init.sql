CREATE SCHEMA IF NOT EXISTS freeledger;
SET search_path TO freeledger;

-- ============================================================
-- ENUM TYPES
-- ============================================================

CREATE TYPE user_role AS ENUM ('client', 'freelancer', 'admin');
CREATE TYPE auth_method AS ENUM ('email', 'wallet');
CREATE TYPE experience_level AS ENUM ('junior', 'mid', 'senior', 'lead');
CREATE TYPE contract_status AS ENUM (
  'draft', 'pending_review', 'pending_signatures', 'pending_funding',
  'active', 'delivered', 'revision_requested', 'completed', 'cancelled', 'disputed'
);
CREATE TYPE milestone_status AS ENUM ('pending', 'in_progress', 'submitted', 'approved', 'rejected', 'paid');
CREATE TYPE dispute_status AS ENUM ('open', 'under_review', 'resolved');
CREATE TYPE dispute_decision AS ENUM ('refund', 'release');

-- ============================================================
-- TABLES
-- ============================================================

-- Users (clients, freelancers, admins)
CREATE TABLE users (
  id              VARCHAR(50) PRIMARY KEY,
  username        VARCHAR(100) NOT NULL,
  email           VARCHAR(255) UNIQUE,
  password_hash   VARCHAR(255),
  auth_method     auth_method NOT NULL DEFAULT 'email',
  wallet_address  VARCHAR(42),
  role            user_role NOT NULL DEFAULT 'freelancer',
  bio             TEXT,
  skills          JSONB DEFAULT '[]',
  hourly_rate     DECIMAL(20, 8) DEFAULT 0,
  rating          DECIMAL(3, 2) DEFAULT 0,
  avatar_cid      VARCHAR(255),
  headline        VARCHAR(255),
  experience_level experience_level DEFAULT 'mid',
  industries      JSONB DEFAULT '[]',
  is_available    BOOLEAN DEFAULT true,
  portfolio_cids  JSONB DEFAULT '[]',
  is_active       BOOLEAN DEFAULT true,
  created_at      TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX idx_users_wallet ON users(wallet_address) WHERE wallet_address IS NOT NULL;
CREATE INDEX idx_users_role ON users(role);

-- Jobs (client-posted work)
CREATE TABLE jobs (
  id              VARCHAR(50) PRIMARY KEY,
  client_id       VARCHAR(50) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title           VARCHAR(255) NOT NULL,
  description     TEXT,
  budget          DECIMAL(20, 8) NOT NULL DEFAULT 0,
  category        VARCHAR(100),
  skills          JSONB DEFAULT '[]',
  duration_days   INTEGER,
  status          VARCHAR(50) NOT NULL DEFAULT 'open',
  on_chain_job_id INTEGER NULL,
  created_at      TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_jobs_client ON jobs(client_id);
CREATE INDEX idx_jobs_status ON jobs(status);

-- Proposals (freelancer bids on jobs)
CREATE TABLE proposals (
  id              VARCHAR(50) PRIMARY KEY,
  job_id          VARCHAR(50) NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  freelancer_id   VARCHAR(50) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  cover_letter    TEXT,
  bid_amount      DECIMAL(20, 8) NOT NULL DEFAULT 0,
  estimated_days  INTEGER,
  status          VARCHAR(50) NOT NULL DEFAULT 'pending',
  contract_id     VARCHAR(50),
  created_at      TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(job_id, freelancer_id)
);

CREATE INDEX idx_proposals_job ON proposals(job_id);
CREATE INDEX idx_proposals_freelancer ON proposals(freelancer_id);

-- Contracts (escrow agreements)
CREATE TABLE contracts (
  id                VARCHAR(50) PRIMARY KEY,
  job_id            VARCHAR(50) NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  client_id         VARCHAR(50) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  freelancer_id     VARCHAR(50) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title             VARCHAR(255) NOT NULL,
  description       TEXT,
  total_amount      DECIMAL(20, 8) NOT NULL DEFAULT 0,
  deadline          DATE,
  terms_cid         VARCHAR(255),
  on_chain_id       INTEGER,
  contract_address  VARCHAR(42),
  status            contract_status NOT NULL DEFAULT 'draft',
  client_signed     BOOLEAN DEFAULT false,
  freelancer_signed BOOLEAN DEFAULT false,
  created_at        TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at        TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_contracts_client ON contracts(client_id);
CREATE INDEX idx_contracts_freelancer ON contracts(freelancer_id);
CREATE INDEX idx_contracts_status ON contracts(status);

-- Contract milestones
CREATE TABLE contract_milestones (
  id                VARCHAR(50) PRIMARY KEY,
  contract_id       VARCHAR(50) NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
  index             INTEGER NOT NULL,
  description       TEXT NOT NULL,
  amount            DECIMAL(20, 8) NOT NULL DEFAULT 0,
  due_date          DATE,
  deliverable_cid   VARCHAR(255),
  submission_notes  TEXT,
  status            milestone_status NOT NULL DEFAULT 'pending',
  submitted_at      TIMESTAMPTZ,
  approved_at       TIMESTAMPTZ,
  created_at        TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at        TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(contract_id, index)
);

CREATE INDEX idx_milestones_contract ON contract_milestones(contract_id);

-- Disputes
CREATE TABLE disputes (
  id                VARCHAR(50) PRIMARY KEY,
  contract_id       VARCHAR(50) NOT NULL UNIQUE REFERENCES contracts(id) ON DELETE CASCADE,
  raised_by         VARCHAR(50) NOT NULL REFERENCES users(id),
  reason            TEXT NOT NULL,
  status            dispute_status NOT NULL DEFAULT 'open',
  decision          dispute_decision,
  resolved_by       VARCHAR(50) REFERENCES users(id),
  resolution_notes  TEXT,
  created_at        TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at        TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_disputes_status ON disputes(status);

-- Message threads
CREATE TABLE threads (
  id              VARCHAR(50) PRIMARY KEY,
  client_id       VARCHAR(50) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  freelancer_id   VARCHAR(50) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  job_id          VARCHAR(50) REFERENCES jobs(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(client_id, freelancer_id, job_id)
);

CREATE INDEX idx_threads_participants ON threads(client_id, freelancer_id);

-- Messages
CREATE TABLE messages (
  id              VARCHAR(50) PRIMARY KEY,
  sender_id       VARCHAR(50) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  receiver_id     VARCHAR(50) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content         TEXT NOT NULL,
  read            BOOLEAN DEFAULT false,
  thread_id       VARCHAR(50) REFERENCES threads(id) ON DELETE CASCADE,
  created_at      TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_messages_sender ON messages(sender_id);
CREATE INDEX idx_messages_receiver ON messages(receiver_id);
CREATE INDEX idx_messages_thread ON messages(thread_id);
CREATE INDEX idx_messages_sender_receiver ON messages(sender_id, receiver_id);

-- Notifications
CREATE TABLE notifications (
  id              VARCHAR(50) PRIMARY KEY,
  user_id         VARCHAR(50) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type            VARCHAR(50) NOT NULL,
  title           VARCHAR(255) NOT NULL,
  body            TEXT,
  is_read         BOOLEAN DEFAULT false,
  metadata        JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_user_read ON notifications(user_id, is_read);

-- Admin accounts
CREATE TABLE admin_accounts (
  id              VARCHAR(50) PRIMARY KEY,
  user_id         VARCHAR(50) NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  role            VARCHAR(50) NOT NULL DEFAULT 'admin'
);

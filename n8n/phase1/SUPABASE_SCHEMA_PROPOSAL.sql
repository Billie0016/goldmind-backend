-- PROPOSAL ONLY. Not executed. No project, user, credential, paid service or activation is created.
-- Target: Supabase PostgreSQL 15+ (gen_random_uuid is built in).
-- Private schema for future n8n PostgreSQL nodes; not exposed through PostgREST by default.
-- Review role grants, backup/retention policy and migrations before Phase 2 deployment.
BEGIN;
CREATE SCHEMA trading;
REVOKE ALL ON SCHEMA trading FROM PUBLIC, anon, authenticated;

CREATE TABLE trading.instruments (
    instrument_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    symbol text NOT NULL,
    provider text NOT NULL DEFAULT 'twelvedata',
    venue text NOT NULL DEFAULT '',
    asset_class text NOT NULL CHECK (asset_class IN ('metal','forex','crypto','equity','index','commodity','other')),
    quote_currency text NOT NULL,
    price_decimals integer NOT NULL CHECK (price_decimals BETWEEN 0 AND 8),
    tick_size numeric CHECK (tick_size > 0),
    contract_specification jsonb NOT NULL DEFAULT '{}'::jsonb,
    calendar_specification jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (provider, symbol, venue)
);

CREATE TABLE trading.strategy_versions (
    strategy_version text PRIMARY KEY,
    parent_version text REFERENCES trading.strategy_versions(strategy_version),
    configuration jsonb NOT NULL CHECK (jsonb_typeof(configuration) = 'object'),
    indicator_implementation_version text NOT NULL,
    prompt_version text NOT NULL,
    model_requested text NOT NULL,
    configuration_sha256 text NOT NULL CHECK (configuration_sha256 ~ '^[a-f0-9]{64}$'),
    created_at timestamptz NOT NULL DEFAULT now(),
    created_by text NOT NULL,
    notes text
);

CREATE TABLE trading.predictions (
    signal_id text PRIMARY KEY,
    request_id text NOT NULL,
    strategy_version text NOT NULL REFERENCES trading.strategy_versions(strategy_version),
    instrument_id uuid REFERENCES trading.instruments(instrument_id),
    symbol text,
    created_at timestamptz NOT NULL,
    -- Availability is derived from append-only delivery_events, not a mutable prediction field.
    evidence_as_of timestamptz,
    decision text NOT NULL CHECK (decision IN ('BUY','SELL','HOLD')),
    signal_timeframe text NOT NULL,
    confirmation_timeframes text[] NOT NULL,
    session_bucket text,
    market_conditions jsonb,
    technical_indicators jsonb,
    entry numeric CHECK (entry > 0),
    stop_loss numeric CHECK (stop_loss > 0),
    take_profit numeric CHECK (take_profit > 0),
    entry_expires_at timestamptz NOT NULL,
    evaluation_horizon_hours numeric NOT NULL CHECK (evaluation_horizon_hours > 0),
    evaluation_deadline timestamptz NOT NULL,
    planned_net_reward_risk numeric,
    confidence numeric CHECK (confidence BETWEEN 0 AND 1),
    confidence_calibrated boolean NOT NULL DEFAULT false,
    confidence_assessment jsonb NOT NULL,
    sentiment jsonb NOT NULL,
    reasoning jsonb NOT NULL,
    execution_assumptions jsonb NOT NULL,
    prediction_snapshot jsonb NOT NULL CHECK (jsonb_typeof(prediction_snapshot) = 'object'),
    hypothetical boolean NOT NULL DEFAULT true CHECK (hypothetical),
    UNIQUE (request_id, strategy_version),
    CHECK (evidence_as_of IS NULL OR evidence_as_of <= created_at),
    CHECK (entry_expires_at >= created_at AND evaluation_deadline > created_at),
    CHECK (evaluation_deadline = created_at + evaluation_horizon_hours * INTERVAL '1 hour'),
    CHECK (
        (decision = 'HOLD' AND entry IS NULL AND stop_loss IS NULL AND take_profit IS NULL)
        OR
        (decision = 'BUY' AND instrument_id IS NOT NULL AND entry IS NOT NULL AND stop_loss IS NOT NULL AND take_profit IS NOT NULL AND planned_net_reward_risk IS NOT NULL AND stop_loss < entry AND entry < take_profit AND planned_net_reward_risk >= 2)
        OR
        (decision = 'SELL' AND instrument_id IS NOT NULL AND entry IS NOT NULL AND stop_loss IS NOT NULL AND take_profit IS NOT NULL AND planned_net_reward_risk IS NOT NULL AND take_profit < entry AND entry < stop_loss AND planned_net_reward_risk >= 2)
    )
);

CREATE TABLE trading.prediction_evidence (
    signal_id text PRIMARY KEY REFERENCES trading.predictions(signal_id),
    frames jsonb NOT NULL, -- Closed OHLC snapshots, source metadata, fetchedAt and quality flags.
    news jsonb NOT NULL, -- Publication/fetch times, selected headlines, source references, coverage.
    candidate jsonb,
    ai_assessment jsonb,
    recorded_at timestamptz NOT NULL DEFAULT now(),
    evidence_sha256 text NOT NULL CHECK (evidence_sha256 ~ '^[a-f0-9]{64}$')
);

CREATE TABLE trading.delivery_events (
    delivery_event_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    signal_id text NOT NULL REFERENCES trading.predictions(signal_id),
    occurred_at timestamptz NOT NULL,
    channel text NOT NULL,
    status text NOT NULL CHECK (status IN ('attempted','api_confirmed','failed_or_unknown','not_requested')),
    external_message_id text,
    deduplication_key text NOT NULL UNIQUE,
    -- Future sender can maintain an outbox separately. Do not store bot tokens or raw error URLs.
    details jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE trading.outcome_tracking_jobs (
    signal_id text PRIMARY KEY REFERENCES trading.predictions(signal_id),
    policy_version text NOT NULL,
    state text NOT NULL DEFAULT 'pending' CHECK (state IN ('pending','monitoring','complete','insufficient_data','failed')),
    next_check_at timestamptz NOT NULL,
    lease_until timestamptz,
    lease_owner text,
    last_checked_at timestamptz,
    attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
    safe_error_code text
);

CREATE TABLE trading.hypothetical_outcomes (
    outcome_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    signal_id text NOT NULL REFERENCES trading.predictions(signal_id),
    evaluation_revision integer NOT NULL CHECK (evaluation_revision >= 1),
    supersedes_outcome_id uuid REFERENCES trading.hypothetical_outcomes(outcome_id),
    policy_version text NOT NULL,
    status text NOT NULL CHECK (status IN ('target_hit','stop_hit','neither','not_entered','ambiguous','insufficient_data','not_applicable')),
    entry_confirmed boolean NOT NULL,
    entered_at timestamptz,
    entry_fill_estimate numeric CHECK (entry_fill_estimate > 0),
    exit_at timestamptz,
    exit_fill_estimate numeric CHECK (exit_fill_estimate > 0),
    first_target_touch_at timestamptz,
    first_stop_touch_at timestamptz,
    spread_price numeric CHECK (spread_price >= 0),
    entry_slippage_price numeric CHECK (entry_slippage_price >= 0),
    exit_slippage_price numeric CHECK (exit_slippage_price >= 0),
    fee_price_equivalent numeric CHECK (fee_price_equivalent >= 0),
    net_r numeric,
    maximum_favourable_excursion_r numeric,
    maximum_adverse_excursion_r numeric,
    conservative_stop_first_r numeric,
    ambiguity_resolution text,
    data_resolution_seconds integer CHECK (data_resolution_seconds > 0),
    coverage_start timestamptz,
    coverage_end timestamptz,
    evaluated_at timestamptz NOT NULL DEFAULT now(),
    input_provenance jsonb NOT NULL,
    evaluator_version text NOT NULL,
    UNIQUE (signal_id, evaluation_revision),
    CHECK (entry_confirmed = (entered_at IS NOT NULL AND entry_fill_estimate IS NOT NULL)),
    CHECK (status NOT IN ('target_hit','stop_hit','neither') OR entry_confirmed),
    CHECK (status NOT IN ('not_entered','not_applicable') OR NOT entry_confirmed),
    CHECK (status NOT IN ('ambiguous','insufficient_data','not_entered','not_applicable') OR net_r IS NULL),
    CHECK (entered_at IS NULL OR exit_at IS NULL OR entered_at <= exit_at)
);

CREATE TABLE trading.actual_trades (
    actual_trade_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    signal_id text REFERENCES trading.predictions(signal_id),
    instrument_id uuid NOT NULL REFERENCES trading.instruments(instrument_id),
    execution_source text NOT NULL CHECK (execution_source IN ('broker_import','manual_verified')),
    account_reference text NOT NULL, -- Pseudonymous reference; never an account password or token.
    external_trade_id text NOT NULL,
    direction text NOT NULL CHECK (direction IN ('BUY','SELL')),
    quantity numeric NOT NULL CHECK (quantity > 0),
    entered_at timestamptz NOT NULL,
    exited_at timestamptz,
    actual_entry_price numeric NOT NULL CHECK (actual_entry_price > 0),
    actual_exit_price numeric CHECK (actual_exit_price > 0),
    initial_risk_account_currency numeric CHECK (initial_risk_account_currency > 0),
    realised_pnl_account_currency numeric,
    fees_account_currency numeric CHECK (fees_account_currency >= 0),
    account_currency text NOT NULL,
    execution_evidence jsonb NOT NULL,
    imported_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (account_reference, external_trade_id),
    CHECK (exited_at IS NULL OR exited_at >= entered_at)
);

CREATE TABLE trading.strategy_proposals (
    proposal_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    baseline_version text NOT NULL REFERENCES trading.strategy_versions(strategy_version),
    candidate_version text NOT NULL REFERENCES trading.strategy_versions(strategy_version),
    hypothesis text NOT NULL,
    proposed_changes jsonb NOT NULL,
    historical_findings jsonb NOT NULL,
    generated_by text NOT NULL,
    status text NOT NULL DEFAULT 'proposed' CHECK (status IN ('proposed','testing','review_required','approved','rejected')),
    created_at timestamptz NOT NULL DEFAULT now(),
    CHECK (baseline_version <> candidate_version)
);

CREATE TABLE trading.research_evaluations (
    evaluation_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    proposal_id uuid NOT NULL REFERENCES trading.strategy_proposals(proposal_id),
    split_id text NOT NULL,
    dataset_manifest jsonb NOT NULL,
    dataset_sha256 text NOT NULL CHECK (dataset_sha256 ~ '^[a-f0-9]{64}$'),
    training_start timestamptz NOT NULL,
    training_end timestamptz NOT NULL,
    validation_start timestamptz NOT NULL,
    validation_end timestamptz NOT NULL,
    holdout_start timestamptz NOT NULL,
    holdout_end timestamptz NOT NULL,
    embargo_seconds integer NOT NULL CHECK (embargo_seconds > 0),
    maximum_label_horizon_seconds integer NOT NULL CHECK (maximum_label_horizon_seconds > 0),
    baseline_metrics jsonb NOT NULL,
    candidate_metrics jsonb NOT NULL,
    cost_policy jsonb NOT NULL,
    position_overlap_policy jsonb NOT NULL,
    sample_counts jsonb NOT NULL,
    uncertainty_analysis jsonb NOT NULL,
    parameter_search_attempts integer NOT NULL CHECK (parameter_search_attempts >= 1),
    leakage_audit jsonb NOT NULL,
    evaluator_version text NOT NULL,
    evidence_quality text NOT NULL CHECK (evidence_quality IN ('insufficient','failed','verified')),
    executed_at timestamptz NOT NULL DEFAULT now(),
    CHECK (training_start < training_end AND validation_start < validation_end AND holdout_start < holdout_end),
    CHECK (embargo_seconds >= maximum_label_horizon_seconds),
    CHECK (validation_start >= training_end + embargo_seconds * INTERVAL '1 second'),
    CHECK (holdout_start >= validation_end + embargo_seconds * INTERVAL '1 second')
);

CREATE TABLE trading.approval_events (
    approval_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    proposal_id uuid NOT NULL REFERENCES trading.strategy_proposals(proposal_id),
    evaluation_id uuid NOT NULL REFERENCES trading.research_evaluations(evaluation_id),
    decision text NOT NULL CHECK (decision IN ('approve_shadow','approve_deployment','reject')),
    approved_by text NOT NULL,
    approved_at timestamptz NOT NULL DEFAULT now(),
    approval_evidence jsonb NOT NULL,
    -- Only a separate human-authorised process may insert approvals. Research role gets no INSERT.
    notes text
);

CREATE INDEX predictions_reporting ON trading.predictions (created_at, strategy_version, symbol, signal_timeframe);
CREATE INDEX predictions_conditions ON trading.predictions USING gin (market_conditions);
CREATE INDEX tracking_due ON trading.outcome_tracking_jobs (next_check_at) WHERE state IN ('pending','monitoring');
CREATE INDEX outcomes_latest ON trading.hypothetical_outcomes (signal_id, evaluation_revision DESC);
CREATE INDEX actual_trades_reporting ON trading.actual_trades (entered_at, instrument_id);

CREATE FUNCTION trading.prevent_evidence_rewrite() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog AS $$
BEGIN
    RAISE EXCEPTION 'Immutable evidence: append a new version or correction record instead';
END;
$$;
CREATE TRIGGER immutable_predictions BEFORE UPDATE OR DELETE ON trading.predictions
FOR EACH ROW EXECUTE FUNCTION trading.prevent_evidence_rewrite();
CREATE TRIGGER immutable_strategy_versions BEFORE UPDATE OR DELETE ON trading.strategy_versions
FOR EACH ROW EXECUTE FUNCTION trading.prevent_evidence_rewrite();
CREATE TRIGGER immutable_prediction_evidence BEFORE UPDATE OR DELETE ON trading.prediction_evidence
FOR EACH ROW EXECUTE FUNCTION trading.prevent_evidence_rewrite();
CREATE TRIGGER immutable_outcomes BEFORE UPDATE OR DELETE ON trading.hypothetical_outcomes
FOR EACH ROW EXECUTE FUNCTION trading.prevent_evidence_rewrite();
CREATE TRIGGER immutable_evaluations BEFORE UPDATE OR DELETE ON trading.research_evaluations
FOR EACH ROW EXECUTE FUNCTION trading.prevent_evidence_rewrite();
CREATE TRIGGER immutable_approvals BEFORE UPDATE OR DELETE ON trading.approval_events
FOR EACH ROW EXECUTE FUNCTION trading.prevent_evidence_rewrite();

-- Deny API access by default. No permissive policies or credentials are created here.
ALTER TABLE trading.instruments ENABLE ROW LEVEL SECURITY;
ALTER TABLE trading.strategy_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE trading.predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE trading.prediction_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE trading.delivery_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE trading.outcome_tracking_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE trading.hypothetical_outcomes ENABLE ROW LEVEL SECURITY;
ALTER TABLE trading.actual_trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE trading.strategy_proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE trading.research_evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE trading.approval_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ALL TABLES IN SCHEMA trading FROM PUBLIC, anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA trading FROM PUBLIC, anon, authenticated;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA trading FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA trading REVOKE ALL ON TABLES FROM PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA trading REVOKE ALL ON FUNCTIONS FROM PUBLIC;
COMMIT;

-- Phase 2 must add explicit least-privilege grants AND matching RLS policies for dedicated
-- n8n writer/evaluator/research roles. Do not use an owner, service_role or BYPASSRLS role.
-- approval_events remains unavailable to autonomous research. No deployment table or
-- operation capable of editing live n8n workflows is included.

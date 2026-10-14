# Proposed persistent memory and controlled learning

This is a design proposal, not an enabled learning system. Phase 1 only generates hypothetical analysis and prepares a record. Supabase remains the proposed Phase 2 database; no project, paid plan, schema, credential or scheduled workflow has been created.

## n8n workflow boundaries

1. **Signal workflow (Phase 1):** authenticated Telegram request → three verified candle series → numeric indicators → deterministic candidate → recent relevant news → OpenAI structured assessment → final deterministic risk gate → memory boundary → Telegram. The file is inactive and trigger-disabled.
2. **Memory writer (Phase 2):** transactionally insert immutable strategy version, prediction and evidence before sending; a stable signal ID supports retries without duplicating rows. Use a delivery outbox/worker to reduce duplicate messages, while acknowledging that Telegram delivery cannot be guaranteed exactly once across a network timeout. Persist HOLD decisions as well as actionable signals.
3. **Outcome tracker (Phase 3):** n8n Schedule Trigger selects due jobs with leases/locking, batches Twelve Data reads by symbol/venue/timeframe, and appends versioned evaluations. Retries must not overwrite original evidence. No broker orders are sent.
4. **Performance reporter (Phase 4):** SQL/n8n calculations first; OpenAI summarises returned metrics second. Telegram `/performance`, `/mistakes`, `/conditions` and `/improvements`, plus natural-language routing to an allowlisted report schema. No AI-generated arbitrary SQL, user cross-chat access, or claim that model narrative proves improvement.
5. **Research workflow (Phase 5):** collect hypotheses, create candidate strategy versions, run bounded historical replay, walk-forward validation and an untouched holdout, and present the results. Its database role cannot approve deployment or modify live n8n workflows.

All orchestration remains in n8n Cloud. Bounded Code-node batches and checkpointed jobs are suitable for initial research; extensive historical searches may exceed n8n Cloud execution/memory limits. No external backend or additional compute service is assumed or provisioned.

## Supabase setup and trade-offs

Supabase supplies managed PostgreSQL, backups/admin features depending on plan, and optional APIs. This proposal uses a PRIVATE `trading` schema with n8n PostgreSQL nodes over verified TLS, rather than exposing trading records to anonymous PostgREST clients. Verify the region's pooler endpoint, IPv4 accessibility, connection mode and connection limits against your n8n Cloud instance. These are future setup checks, not completed configuration.

Before provisioning, confirm your preferred region, data retention, expected daily signals, monitoring frequency, historical-data needs and current provider pricing. A free tier may suit a pilot, but quotas, project pausing, backup/restore coverage and availability must be checked. No price or free capacity is guaranteed. Paid database storage, n8n executions, Twelve Data quota/history, NewsAPI latency and OpenAI token usage are distinct costs. Raw candle snapshots dominate storage; batch tracking by instrument and keep reporting calculations free of unnecessary model calls.

Dedicated least-privilege database roles and n8n encrypted credential bindings must be configured after approval. The SQL includes RLS with no permissive policies; therefore a future non-owner role needs explicit grants AND role-scoped RLS policies. Do not use an owner/service-role/BYPASSRLS credential to bypass that setup. Research must not have permission to insert approval events or change production rules. SQL contains no passwords or role creation and is not an executable complete provisioning script.

Direct managed PostgreSQL would support the same schema with more provider-specific administration; portability is high because the core tables use standard PostgreSQL. The Supabase-specific `anon` and `authenticated` revocations would need adaptation outside Supabase.

## Proposed schema and mapping

| Table | Purpose |
|---|---|
| `instruments` | Provider/venue identity, asset class, quote precision, contract and calendar specifications; supports future instruments |
| `strategy_versions` | Immutable settings, indicator implementation, prompt/model versions and canonical config checksum |
| `predictions` | Immutable original decision, timestamp, levels, horizon, indicators, conditions, sentiment, reasoning and confidence |
| `prediction_evidence` | Closed candles, provenance, quality flags, selected news, deterministic candidate and AI assessment |
| `delivery_events` | Append-only notification attempts and API confirmation timestamps |
| `outcome_tracking_jobs` | Mutable scheduling and leases; keeps operational state separate from immutable evidence |
| `hypothetical_outcomes` | Append-only revisions of entry/exit estimates, event ordering, ambiguity and net R |
| `actual_trades` | Separately imported verified fills, quantity, costs and realised account-currency P&L |
| `strategy_proposals` | Hypotheses, baseline/candidate versions and review status |
| `research_evaluations` | Dataset identity, chronological splits, embargo, costs, sample sizes, leakage audit and comparative metrics |
| `approval_events` | Human-authorised research/shadow/deployment decisions with referenced evidence |

The SQL is a proposed initial migration, not idempotent provisioning code. It deliberately fails if applied twice instead of silently masking a conflicting schema. It has not been applied to a database. Immutability triggers prevent overwriting original predictions, evidence, outcomes, evaluations or approvals. Corrections append a revision. Administrators can still change database objects; roles and operational controls matter.

Map the camelCase Phase 1 record to SQL column names explicitly. For example:

- `prediction.signalId` → `predictions.signal_id`.
- `prediction.strategyVersion` → `strategy_versions.strategy_version` and prediction foreign key.
- `prediction.createdAt`, `evidenceAsOf`, `evaluationDeadline` → UTC timestamp columns.
- `prediction.levels.netRewardRisk` → `planned_net_reward_risk`, null for HOLD.
- `prediction.technicalIndicators`, `marketConditions`, `sentiment`, `reasoning`, `confidenceAssessment`, `executionAssumptions` → corresponding JSONB columns.
- Full `prediction` → `prediction_snapshot`; `memoryRecord.evidence` → evidence table fields.
- Canonically hash configuration/evidence when persisting; Phase 1 does not generate or claim a database checksum.

Operational chat IDs are excluded from `strategyConfig` and OpenAI evidence. If per-user reports become necessary, introduce a separate access-controlled owner mapping; do not give one Telegram chat access to another user's actual trades. The current schema assumes a single-owner research system, with no public access.

## Outcome policy to implement and test in Phase 3

The four-hour horizon is stored with each prediction and configurable for future versions. It begins at signal creation and ends at the stored deadline. Evaluation cannot enter before signal availability: use Telegram API confirmation or a documented signal-availability policy, never a candle that precedes it.

1. HOLD outcomes are `not_applicable`; invalid/missing evidence is `insufficient_data`, not a loss or win.
2. Actionable signals enter only if a post-availability observable price is within the configured 0.5 × 15m ATR tolerance during the five-minute entry window. Otherwise `not_entered`. The evaluator must not invent an exact intrabar entry sequence from OHLC. Fetch finer data or mark uncertain entry ordering ambiguous.
3. Apply instrument-specific full spread, both slippage sides and applicable fees using a consistent bid/ask or midpoint model. Document whether provider bars represent trades, bid, ask or midpoint. If that cannot be established, report bounded estimates rather than claiming fills. Do not deduct spread twice when it is already represented in simulated fills.
4. Determine the first post-entry target/stop event. If both occur in one observation interval, inspect finer data; if unresolved, status `ambiguous`. Report conservative stop-first scenarios separately from confirmed outcomes.
5. If neither event occurs, mark a horizon exit with a documented available-price assumption and net R. Record missing coverage explicitly. Maximum favourable/adverse excursions require continuous covered observations.
6. Store data resolution, fetch provenance, cost assumptions and evaluator version. Revisions supersede earlier estimates without deleting them. Higher-resolution data may resolve a previous ambiguity later.

Twelve Data's actual subscription coverage, historical retention, timestamp semantics, symbol availability and tick/bid-ask access must be checked. One-minute candles cannot guarantee barrier ordering or fills. No upgrade or capability is assumed.

## Performance rules

Separate these quantities rather than showing one misleading win rate:

- **Target-hit rate:** confirmed target hits / confirmed target-plus-stop hits. Show the excluded counts.
- **Profit win rate:** positive net-R outcomes / all resolved entered outcomes, including documented horizon exits; distinguish break-even results.
- **Expectancy:** mean net R for resolved entered hypothetical signals under the same cost/execution policy. Also report entry rate, HOLD rate, ambiguity rate and data coverage.
- **Reward/risk:** planned net ratio and realised R are separate columns/statistics.
- **Drawdown:** construct a chronological equity curve with an explicit sizing, starting capital, concurrency/exposure and mark-to-market policy. Cumulative-R drawdown is a separate statistic and is not actual account drawdown.
- **Breakdowns:** symbol/venue, strategy, signal and confirming timeframes, fixed UTC session bucket, volatility band and trend regime. Show sample sizes and uncertainty. Session labels in Phase 1 do not account for DST.
- **Actual trades:** derive metrics solely from verified fills/costs and account currency. Never combine actual and hypothetical rows in an unlabeled aggregate. Overlapping signals cannot all be treated as independent account trades without an exposure policy.

Confidence is initially uncalibrated. Future calibration must use historical training/validation data and be evaluated separately on unseen outcomes; a model's percentage is not evidence of win probability.

## Controlled research and leakage prevention

Every hypothesis must reference historical evidence, not merely an OpenAI narrative. Compare candidate changes against a fixed baseline under the same instrument coverage, execution assumptions and data-quality policy.

Use chronological training, validation and holdout periods; never random train/test splits for overlapping market labels. Purge observations whose entry/evaluation windows cross a boundary and apply an embargo at least as long as the maximum label horizon. The schema stores that horizon and enforces a minimum temporal separation, but the evaluator must audit the actual rows and information availability.

Historical replay computes indicators from trailing completed candles only. A decision's news must have been published AND available to the system before that decision. Preserve archived as-of snapshots or a suitable historical feed; today's headlines cannot be backfilled as if they were known earlier. Revised data, unavailable instruments and session calendars need explicit point-in-time treatment. Any scaling, thresholds, feature selection or confidence calibration are fitted only in the training period.

Record all parameter searches, datasets/checksums, random settings where applicable, costs, missingness, baseline/candidate metrics and sample uncertainty. Do not repeatedly inspect and optimise against the final holdout; once used for selection it is no longer untouched. Use new future periods for subsequent proposals. Apparent gains need adequate sample sizes, robustness across conditions, and accounting for repeated testing.

Only after verified historical and out-of-sample results should the system recommend a shadow trial. A human approval event is required for shadow/deployment decisions, and an approval is evidence of permission rather than an automatic deployment trigger. A separate explicitly authorised deployment task would create/import a new version. No research workflow may alter live rules, prompts, thresholds or workflow activation.

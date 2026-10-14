# Validation evidence and limits

The generated workflow has 28 nodes. `active` is false, Telegram Trigger is disabled, pinned data is empty, and there are no credential objects or credential identifiers in the export. The four HTTP nodes use n8n credential bindings, not key expressions or embedded values. OpenAI uses the original gpt-5-mini integration; Groq and the standalone backend are not part of this artifact.

The original uploaded workflow was used only for inspection. Its recorded SHA-256 is `4860b57ae56bbd0ffb949e24eb182fb42ff1055ada5845316bf44d47f874869e`. It is not included in the bundle because it contains embedded keys.

## Executed checks

- 25 offline checks in `test_phase1.js` passed on Node.js 24.19.0. They exercise the same source code embedded in the generated JSON.
- EMA recursive/SMA seed reference values, Wilder RSI reference values and boundary cases, MACD constant/linear reference series, and Wilder ATR gap/smoothing values passed.
- Candle normalization, unfinished-bar removal, recent/older gap detection, narrowly permitted FX/metals weekend gaps, timestamp validation, latest completed-candle freshness, invalid prices and provider failures passed.
- Synthetic independent BUY/SELL rule fixtures, disagreement and extreme-RSI blocking, configured costs, rounded levels and net reward/risk validation passed.
- Native OpenAI Responses-shaped string/object parsing, refusal/incomplete/invalid-output rejection, model version checking, confidence/direction/sentiment vetoes and stale-decision HOLD behavior passed.
- Embedded n8n-shaped Code-node adapters passed, including manual no-send and Telegram delivery-status parsing. These are adapters tested in a local VM, not a live n8n runner.
- JSON parsing, graph targets, Code-node syntax, inactive/disabled defaults and absence of credential objects passed. Original exported keys and original credential identifiers were checked for absence across the deliverables without printing those values.
- The SQL proposal parsed with PostgreSQL's pglast parser. Syntax validation is not database execution, permission validation, migration testing or Supabase provisioning.

## Source compatibility checks

Parameter structures were checked against n8n's public source for HTTP Request, OpenAI Responses, IF and Query Auth. Existing integration-node versions match the supplied export. The OpenAI schema option is accompanied by independent strict JavaScript validation; safety does not depend on the provider/node enforcing every schema constraint.

Reference sources:

- https://github.com/n8n-io/n8n/blob/master/packages/nodes-base/nodes/HttpRequest/V3/Description.ts
- https://github.com/n8n-io/n8n/blob/master/packages/%40n8n/nodes-langchain/nodes/vendors/OpenAi/v2/actions/text/response.operation.ts
- https://github.com/n8n-io/n8n/blob/master/packages/%40n8n/nodes-langchain/nodes/vendors/OpenAi/v2/actions/text/helpers/responses.ts
- https://github.com/n8n-io/n8n/blob/master/packages/nodes-base/nodes/If/V2/IfV2.node.ts
- https://github.com/n8n-io/n8n/blob/master/packages/nodes-base/credentials/HttpQueryAuth.credentials.ts

## Not performed or claimed

No import into your n8n Cloud account, live Telegram request, authenticated Twelve Data/NewsAPI/OpenAI call, historical profitability test, Supabase migration, broker execution, outcome monitoring or learning deployment was performed. Account credentials, provider coverage/quota/latency, current n8n build and a separate test bot must be checked during the import procedure.

Phase 1's `memoryPersisted=false` and `outcomeTrackingEnabled=false` are truthful operational markers. The record is prepared but not written. They must not be interpreted as database-state fields after a future persistence step; Phase 2 should return confirmed runtime persistence status separately from immutable prediction evidence.

No paid services were purchased, no workflow activated and no production trading rules changed. Offline passing tests establish calculation and gate behavior, not a profitable strategy.

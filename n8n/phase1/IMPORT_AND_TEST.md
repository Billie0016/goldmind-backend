# Import and test the separate Phase 1 workflow

`Trading_Assistant_Phase1.n8n.json` is the import artifact. It is an n8n Cloud workflow, not an application server. It preserves Telegram, Twelve Data, NewsAPI and OpenAI (gpt-5-mini). There is no Express, Python backend, Groq, broker connection or database connection in it. The Python builder and Node tests included in this folder are optional offline development helpers; n8n needs neither of them.

The original uploaded export was read only. No original nodes, live workflows, credentials, production rules or cloud settings were edited. This new workflow is inactive, with the Telegram Trigger additionally disabled. No Supabase project was provisioned and the proposed SQL was not applied.

## 1. Import into a NEW workflow

1. Download `Trading_Assistant_Phase1.n8n.json`.
2. In n8n Cloud create a new workflow, then use **Import from File** (the menu wording may vary). Do not open your existing live workflow and import over it.
3. Confirm the new name is **Trading Assistant — Phase 1 — Separate Inactive**, activation/publishing is off, and **Telegram Trigger** is disabled. Keep your original workflow unchanged.
4. If a node is shown as unknown or an option is unsupported, stop before testing and report that node/version. This export uses the same HTTP Request 4.4, OpenAI 2.3, Telegram Trigger 1.3 and Telegram 1.2 versions as your original export, plus Code 2, IF 2.2, Manual Trigger 1 and Stop And Error 1. Import/runtime verification must happen in your account; it was not performed remotely.

## 2. Bind credentials inside n8n

No credential values or credential identifiers are in the file. Create/select bindings in the n8n credential manager; never paste keys into node parameters or Code nodes.

| Nodes | Credential type | Credential fields |
|---|---|---|
| Twelve Data 1m, 15m, 1h | Generic credential: **Query Auth** | Name `apikey`; Value your Twelve Data key |
| NewsAPI | Generic credential: **Header Auth** | Name `X-Api-Key`; Value your NewsAPI key |
| OpenAI Evidence Review | **OpenAI API** | Select your existing OpenAI integration |
| Telegram Trigger, Telegram Reply | **Telegram API** | Use a separate TEST bot token during testing |

Your uploaded export contained embedded Twelve Data and NewsAPI keys. Rotate those keys in their provider dashboards before reusing credentials; they are not copied into this export.

Do not select **Listen for test event** or enable/publish a Telegram Trigger using your LIVE bot token. Telegram allows one webhook per bot; testing another trigger with that token can replace the live workflow's webhook. The Manual Test path never registers a Telegram webhook. A separate free test bot is the safe way to test Telegram later.

Manual execution may still cause n8n to flag unbound credentials on a downstream Telegram node even when sending is off. If so, bind a test-bot credential; do not switch to your production token.

## 3. Configure in one place

Open **Configure Request → JavaScript**. Edit `defaultConfig()` at the TOP OF THIS NODE ONLY. Other Code nodes contain the same function definitions but consume the configuration passed from Configure Request; do not edit their unused defaults.

Default settings:

- Instruments: XAU/USD enabled for analysis. EUR/USD, GBP/USD, USD/JPY, BTC/USD and ETH/USD are registry examples, disabled until you verify coverage, precision, cost assumptions and news relevance.
- Indicators: Wilder RSI(14), MACD(12,26,9), EMA(20/50), Wilder ATR(14), independently calculated on 1m, 15m and 1h.
- Data: 250 requested candles; at least 200 completed candles per timeframe. All requests specify `timezone=UTC`, `order=DESC`; the Code nodes sort oldest first.
- Close grace: 10 seconds. The most recent completed candle after this grace must exist. The last six completed candles must be consecutive.
- Decision freshness: latest 1m close at most 120 seconds old; technical calculation to final decision at most 90 seconds. Slow AI/API responses become HOLD.
- Risk: stop = 1.5 × 15m ATR; target = 2.5 × initial gross price risk; final net reward/risk must be at least 2:1 after configured costs.
- Spread and slippage default to `null`. This deliberately forces HOLD until configured. `spreadPrice` must be positive; `slippagePricePerSide` must be nonnegative. Both use quoted PRICE UNITS, not pips, percentages, account currency or lots. The assumed round-trip cost is full spread once plus two slippage sides. Commissions and financing are NOT included; add a tested instrument-specific cost model before using assets for which those costs are material.
- `allowChatIds: []` means no Telegram chat is authorised. Unauthorised messages make no provider requests and receive no reply. Add YOUR test chat ID as a string before testing Telegram.
- `manualSendTelegram: false` and `manualChatId: ''` mean manual tests produce execution output only.
- `evaluationHorizonHours: 4` is configurable. Phase 1 only records the proposed deadline; it does not monitor outcomes.
- `strategyVersion`, `promptVersion` and `modelRequested` are carried into every prediction. If you change approved rules, prompts, model or indicator implementation, assign a new version. If changing the model, also change the actual OpenAI node selection; `modelRequested` is an audit label, not a dynamic model switch.

Fixed UTC session buckets are research labels, not exchange calendars or DST-adjusted sessions. The FX/metals weekend-gap exception is narrow: Friday evening to Sunday evening/early Monday. Other missing historical intervals and holidays fail closed. Recent gaps always fail, including at session reopen. Crypto histories must be continuous. There is no economic-calendar feed or bid/ask feed; NewsAPI headlines are not a verified upcoming-event calendar.

Further instruments can be added to this registry and the future instruments table. Equities, futures, non-hour-aligned sessions, currencies, venues, tick/contract sizes and exchange calendars require explicit extensions and tests; changing a symbol alone is insufficient.

## 4. Run the first manual test

1. Leave Telegram Trigger disabled and the workflow inactive.
2. Open **Manual Input**. Its text defaults to `XAU/USD`; aliases such as `GOLD` are accepted. `/analyze XAU/USD` is also accepted on the Telegram path.
3. Start execution from **Manual Test**. This uses existing provider quotas and OpenAI billing; no paid service is purchased by the workflow.
4. Inspect the execution output:
   - **Configure Request**: `validRequest=true`, `sendTelegram=false`.
   - **Normalize 1m/15m/1h**: numeric chronological candles, `valid=true`, correct symbol/interval, current completed candle, at least 200 rows.
   - **Technical Analysis**: computed indicators and named trends. Costs still unset means `candidate.eligible=false`.
   - **Normalize News**: recent deduplicated headlines with publication/source information, or a specific safe failure reason.
   - **OpenAI Evidence Review**: native Responses API completed JSON with sentiment, reasoning, confidence and risks. When news is unavailable this node is skipped and the workflow returns HOLD.
   - **Manual Result**: `prediction.decision=HOLD`, entry/stop/target are null, `delivery.status=not_requested`, `memoryRecord` present.
5. If data is stale, coverage unsupported, the market is closed, or a provider plan is delayed, HOLD is the expected result. Read failure codes before changing anything. Do not lower safety thresholds to make a test show BUY.

News freshness is strict: at least two unique articles in the last 24h, with the newest at most 12h old, plus OpenAI relevance checks. Delayed NewsAPI plans can prevent trade signals. Verify your existing plan's latency and usage restrictions; no upgrade is purchased or assumed here.

## 5. Test failures and trade gates separately

Use the imported TEST workflow only. Remove temporary pinning and edits afterwards. Do not treat artificial inputs as trading evidence.

| Test | Expected result |
|---|---|
| Unsupported symbol in Manual Input | HOLD without any market/news/AI requests |
| Null spread/slippage configuration | HOLD with `EXECUTION_COSTS_NOT_CONFIGURED` |
| Provider returns an error or incomplete candles | HOLD with timeframe-specific failure codes; no invented indicators |
| Missing newest closed candle or stale history | HOLD; no model analysis of invalid data |
| Missing/old/irrelevant news | HOLD; sentiment is not silently substituted with neutral |
| Malformed, refused or incomplete OpenAI response | HOLD with `AI_FAILED_OR_INVALID_STRUCTURED_OUTPUT` |
| OpenAI recommends opposite direction or low confidence | HOLD |
| Spread too large or rounded net reward/risk below 2 | HOLD; actionable levels suppressed |
| Final decision exceeds freshness/latency limits | HOLD |
| All deterministic, news, AI and risk checks pass | BUY/SELL in manual output only; no order is placed |

For reproducible formula/gate tests, optional helpers in this folder run offline:

```bash
python3 build_workflow.py
node test_phase1.js
```

The test suite exercises formula reference values, synthetic BUY and SELL conditions, bearish/bullish disagreements, invalid data, and native n8n-shaped Code-node adapters. It does not prove profitability or validate a live n8n Cloud import. Never pin synthetic trading data into a live workflow.

After the default HOLD path works, configure realistic instrument costs from your execution venue. Use measured conservative estimates; do not invent values to unlock signals. Test during an open, supported market with fresh real data. Most requests may still return HOLD because the three-timeframe filters are deliberately restrictive.

## 6. Optional Telegram test without touching the live bot

1. Create/select a distinct TEST bot and bind its credential to both Telegram nodes.
2. Send a message to the test bot so it has an accessible chat.
3. To send a manual test reply, set `manualChatId` to your test chat ID and `manualSendTelegram=true`, keeping the trigger disabled. Run Manual Test and verify the Telegram reply and delivery-status node. Revert to false after testing if desired.
4. To test the trigger, enable only the disabled trigger node in this separate workflow, using the TEST bot credential. While the WORKFLOW remains inactive, use n8n's temporary test listener and send `XAU/USD` to the test bot. If you do not know the chat ID, the unauthorised execution can show it at Configure Request with no provider requests or reply; add it to the allowlist and repeat.
5. Confirm authorised messages reach the correct test chat, and other chat IDs are silently rejected. Keep workflow activation off; re-disable the trigger after testing.

Provider transport/HTTP failures use bounded retries (three attempts, 15-second request timeout; OpenAI two attempts). Provider error JSON fails closed rather than retrying endlessly. Telegram sends are not automatically retried because an uncertain timeout can occur after delivery. Failed/unknown delivery deliberately marks the execution failed with a safe error. Inspect the execution before replaying.

Missing credentials detected before execution, platform outages, Code-node crashes and whole-workflow timeouts cannot reliably notify through this same bot. Configure n8n execution alerts or a separate Error Trigger workflow later if desired; that is not activated or provisioned here. Success/error executions are saved for debugging according to your n8n plan's retention. They are NOT persistent trading memory and may contain your chat ID and licensed data; use appropriate access and retention settings.

## 7. Phase 2 handoff

**Prepare Memory Record** is a pass-through boundary. Its input has `memoryRecord.prediction`, `memoryRecord.strategyConfig` and `memoryRecord.evidence`. No database write occurs. The default horizon is four hours and HOLD predictions are included.

Once you separately approve provisioning, insert a transaction here that creates the immutable strategy version if needed, resolves the instrument, and writes the prediction plus evidence idempotently using `signalId`. Database failure must block actionable Telegram notifications. Delivery confirmation is a separate append-only event, not a rewrite of the prediction. Durable duplicate suppression/outbox processing and outcome-job scheduling belong to Phase 2; Phase 1 does not claim cross-execution deduplication.

Read `LEARNING_ARCHITECTURE.md` and the unexecuted `SUPABASE_SCHEMA_PROPOSAL.sql`. Future learning may propose candidate versions but never edit this Configure Request node, model prompts, credentials or production workflow automatically. Deployment requires historical testing, untouched out-of-sample evaluation and your explicit approval.

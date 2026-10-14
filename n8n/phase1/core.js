// Pure JavaScript. Embedded into n8n Code nodes; no imports or external packages.
function defaultConfig() {
  return {
    strategyVersion: 'phase1-mtf-v1.0.0',
    promptVersion: 'evidence-review-v1.0.0',
    modelRequested: 'gpt-5-mini',
    schemaVersion: '1.0',
    evaluationHorizonHours: 4,
    allowChatIds: [], // Configure explicitly before enabling the Telegram trigger.
    manualSendTelegram: false,
    manualChatId: '',
    indicators: { rsi: 14, fast: 12, slow: 26, signal: 9, emaFast: 20, emaSlow: 50, atr: 14 },
    outputSize: 250,
    minimumClosedCandles: 200,
    recentContinuousBars: 6,
    closeGraceSeconds: 10,
    maximumDecisionAgeSeconds: 120,
    maximumAnalysisSeconds: 90,
    minimumRewardRisk: 2,
    targetGrossR: 2.5,
    stopAtrMultiplier: 1.5,
    minimumAtrFraction: 0.00005,
    maximumAtrFraction: 0.02,
    maximumSpreadAtrFraction: 0.15,
    maximumEntryDeviationAtr: 0.5,
    minimumAiConfidence: 0.65,
    confidenceDisplayCap: 0.80,
    sentimentVetoScore: 0.35,
    signalExpiryMinutes: 5,
    newsWindowHours: 24,
    newsMaximumAgeHours: 12,
    newsMinimumArticles: 2,
    newsMaximumArticles: 12,
    requireNews: true,
    instruments: {
      'XAU/USD': { assetClass: 'metal', priceDecimals: 2, newsQuery: '(gold OR bullion OR "precious metals") AND (market OR price OR dollar OR inflation OR rates)', aliases: ['GOLD', 'XAUUSD'], enabled: true, spreadPrice: null, slippagePricePerSide: null },
      'EUR/USD': { assetClass: 'forex', priceDecimals: 5, newsQuery: '(euro OR ECB OR "Federal Reserve") AND (currency OR rates OR dollar)', aliases: ['EURUSD'], enabled: false, spreadPrice: null, slippagePricePerSide: null },
      'GBP/USD': { assetClass: 'forex', priceDecimals: 5, newsQuery: '(sterling OR "Bank of England" OR "Federal Reserve") AND (currency OR rates)', aliases: ['GBPUSD'], enabled: false, spreadPrice: null, slippagePricePerSide: null },
      'USD/JPY': { assetClass: 'forex', priceDecimals: 3, newsQuery: '(yen OR "Bank of Japan" OR "Federal Reserve") AND (currency OR rates)', aliases: ['USDJPY'], enabled: false, spreadPrice: null, slippagePricePerSide: null },
      'BTC/USD': { assetClass: 'crypto', priceDecimals: 2, newsQuery: 'bitcoin AND (market OR price OR ETF OR regulation)', aliases: ['BTCUSD', 'BTC'], enabled: false, spreadPrice: null, slippagePricePerSide: null },
      'ETH/USD': { assetClass: 'crypto', priceDecimals: 2, newsQuery: '(ethereum OR ether) AND (market OR price OR ETF OR regulation)', aliases: ['ETHUSD', 'ETH'], enabled: false, spreadPrice: null, slippagePricePerSide: null }
    }
  };
}
function item(x) { return [{ json: x }]; }
function finite(x) { return typeof x === 'number' && Number.isFinite(x); }
function clone(x) { return JSON.parse(JSON.stringify(x)); }
function iso(ms) { return new Date(ms).toISOString(); }
function bounded(s, n) { return typeof s === 'string' ? s.slice(0, n) : ''; }
function configValid(c) {
  const p = c.indicators;
  return p && Object.values(p).every(x => Number.isInteger(x) && x >= 2 && x <= 100) && p.fast < p.slow && p.emaFast < p.emaSlow &&
    c.minimumClosedCandles >= Math.max(4 * p.emaSlow, p.slow + p.signal + 20) && c.outputSize > c.minimumClosedCandles && c.outputSize <= 5000 &&
    Number.isInteger(c.recentContinuousBars) && c.recentContinuousBars >= 3 && c.recentContinuousBars <= c.minimumClosedCandles &&
    finite(c.evaluationHorizonHours) && c.evaluationHorizonHours > 0 && c.evaluationHorizonHours <= 24 &&
    finite(c.minimumRewardRisk) && c.minimumRewardRisk >= 2 && finite(c.targetGrossR) && c.targetGrossR > c.minimumRewardRisk &&
    finite(c.stopAtrMultiplier) && c.stopAtrMultiplier >= 1 && c.stopAtrMultiplier <= 5 &&
    finite(c.minimumAiConfidence) && c.minimumAiConfidence >= 0.5 && c.minimumAiConfidence <= 1 &&
    finite(c.confidenceDisplayCap) && c.confidenceDisplayCap >= c.minimumAiConfidence && c.confidenceDisplayCap <= 0.9 &&
    finite(c.minimumAtrFraction) && finite(c.maximumAtrFraction) && c.minimumAtrFraction > 0 && c.maximumAtrFraction > c.minimumAtrFraction &&
    finite(c.maximumSpreadAtrFraction) && c.maximumSpreadAtrFraction > 0 && c.maximumSpreadAtrFraction <= 0.25 &&
    finite(c.maximumEntryDeviationAtr) && c.maximumEntryDeviationAtr > 0 && c.maximumEntryDeviationAtr <= 0.5 &&
    finite(c.sentimentVetoScore) && c.sentimentVetoScore > 0 && c.sentimentVetoScore <= 1 &&
    c.requireNews === true && Number.isInteger(c.newsMinimumArticles) && c.newsMinimumArticles >= 2 &&
    Number.isInteger(c.newsMaximumArticles) && c.newsMaximumArticles >= c.newsMinimumArticles && c.newsMaximumArticles <= 20 &&
    finite(c.newsWindowHours) && c.newsWindowHours > 0 && c.newsWindowHours <= 24 &&
    finite(c.newsMaximumAgeHours) && c.newsMaximumAgeHours > 0 && c.newsMaximumAgeHours <= c.newsWindowHours &&
    finite(c.closeGraceSeconds) && c.closeGraceSeconds >= 0 && c.closeGraceSeconds <= 60 &&
    finite(c.maximumDecisionAgeSeconds) && c.maximumDecisionAgeSeconds > 0 && c.maximumDecisionAgeSeconds <= 120 &&
    finite(c.maximumAnalysisSeconds) && c.maximumAnalysisSeconds > 0 && c.maximumAnalysisSeconds <= 90 &&
    finite(c.signalExpiryMinutes) && c.signalExpiryMinutes > 0 && c.signalExpiryMinutes <= 5 &&
    Array.isArray(c.allowChatIds) && typeof c.strategyVersion === 'string' && c.strategyVersion.length > 0 &&
    typeof c.promptVersion === 'string' && c.promptVersion.length > 0 && typeof c.modelRequested === 'string' && c.modelRequested.length > 0;
}
function prepare(input, c, now, executionId) {
  const manual = input._manual === true;
  const m = input.message || {};
  const chatId = manual ? c.manualChatId : String(m.chat && m.chat.id || '');
  const authorised = manual || c.allowChatIds.map(String).includes(chatId);
  const raw = bounded(m.text, 80).trim().toUpperCase();
  const clean = raw.replace(/^\/(?:ANALYZE|ANALYSE)(?:@[A-Z0-9_]+)?\s+/, '').trim();
  let symbol = null;
  for (const [key, info] of Object.entries(c.instruments)) {
    if (clean === key || info.aliases.includes(clean)) { symbol = key; break; }
  }
  const reasons = [];
  if (!configValid(c)) reasons.push('INVALID_STRATEGY_CONFIGURATION');
  if (!authorised) reasons.push('CHAT_NOT_AUTHORISED');
  if (!symbol || !c.instruments[symbol].enabled) reasons.push('UNSUPPORTED_OR_DISABLED_SYMBOL');
  if (!manual && (m.date === undefined || !finite(Number(m.date)) || now - Number(m.date) * 1000 > 120000 || Number(m.date) * 1000 > now + 30000)) reasons.push('STALE_OR_INVALID_TELEGRAM_REQUEST');
  return {
    schemaVersion: c.schemaVersion, config: c,
    request: { requestId: manual ? 'manual:' + String(executionId) : 'telegram:' + String(input.update_id || '') + ':' + String(m.message_id || ''), executionId: String(executionId), receivedAt: iso(now), chatId, symbol, manual, authorised },
    instrument: symbol ? clone(c.instruments[symbol]) : null,
    validRequest: reasons.length === 0,
    sendTelegram: authorised && !!chatId && (!manual || c.manualSendTelegram),
    reasons, frames: {}, news: { available: false, articles: [] }, technical: null, candidate: null, ai: null
  };
}
function parseUtc(s) {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}Z?$/.test(s)) return NaN;
  const t = s.replace(' ', 'T').replace(/Z$/, '') + 'Z';
  const ms = Date.parse(t);
  return Number.isFinite(ms) && iso(ms).slice(0, 19) === t.slice(0, 19) ? ms : NaN;
}
function normalizeFrame(s, raw, label, seconds, now) {
  s = clone(s);
  const failures = [];
  const data = raw && raw.body ? raw.body : raw;
  const meta = data && data.meta || {};
  let rows = [];
  if (!data || data.error || data.status === 'error' || !Array.isArray(data.values)) failures.push('API_OR_RESPONSE_ERROR');
  if (meta.symbol !== s.request.symbol) failures.push('SYMBOL_MISMATCH');
  if (meta.interval !== label) failures.push('INTERVAL_MISMATCH');
  // HTTP requests explicitly use timezone=UTC. exchange_timezone identifies the venue,
  // not necessarily the requested serialization timezone; do not confuse the two.
  if (meta.timezone !== undefined && meta.timezone !== 'UTC') failures.push('RESPONSE_TIMEZONE_MISMATCH');
  const seen = new Set();
  let unfinished = 0;
  if (data && Array.isArray(data.values) && data.values.length > s.config.outputSize) failures.push('OVERSIZED_CANDLE_RESPONSE');
  for (const v of data && Array.isArray(data.values) ? data.values.slice(0, s.config.outputSize) : []) {
    if (!v || typeof v !== 'object' || Array.isArray(v)) { failures.push('INVALID_CANDLE_OBJECT'); continue; }
    const openMs = parseUtc(v.datetime);
    const prices = ['open', 'high', 'low', 'close'].map(k => typeof v[k] === 'number' || typeof v[k] === 'string' && v[k].trim() !== '' ? Number(v[k]) : NaN);
    const [open, high, low, close] = prices;
    if (!finite(openMs) || prices.some(x => !finite(x) || x <= 0) || high < Math.max(open, close) || low > Math.min(open, close) || low > high) { failures.push('INVALID_OHLC_OR_TIMESTAMP'); continue; }
    if (openMs % (seconds * 1000) !== 0) { failures.push('MISALIGNED_CANDLE_TIMESTAMP'); continue; }
    if (seen.has(openMs)) { failures.push('DUPLICATE_CANDLE'); continue; }
    seen.add(openMs);
    if (openMs > now + 30000) { failures.push('FUTURE_CANDLE'); continue; }
    const closeMs = openMs + seconds * 1000;
    if (closeMs > now - s.config.closeGraceSeconds * 1000) { unfinished++; continue; }
    rows.push({ openTime: iso(openMs), closeTime: iso(closeMs), open, high, low, close, volume: v.volume !== undefined && finite(Number(v.volume)) && Number(v.volume) >= 0 ? Number(v.volume) : null });
  }
  rows.sort((a, b) => Date.parse(a.openTime) - Date.parse(b.openTime));
  if (rows.length < s.config.minimumClosedCandles) failures.push('INSUFFICIENT_CLOSED_CANDLES');
  const recent = rows.slice(-s.config.recentContinuousBars);
  let historicalGaps = 0;
  let permittedWeekendGaps = 0;
  for (let i = 1; i < rows.length; i++) {
    const delta = Date.parse(rows[i].openTime) - Date.parse(rows[i - 1].openTime);
    if (delta !== seconds * 1000) {
      historicalGaps++;
      const before = new Date(rows[i - 1].closeTime), after = new Date(rows[i].openTime);
      // Narrow conservative FX/metals weekend exception. No holiday calendar is inferred.
      const weekend = ['forex', 'metal'].includes(s.instrument.assetClass) && before.getUTCDay() === 5 && before.getUTCHours() >= 18 && (after.getUTCDay() === 0 && after.getUTCHours() >= 20 || after.getUTCDay() === 1 && after.getUTCHours() <= 2) && delta >= 24 * 3600000 && delta <= 60 * 3600000;
      if (weekend) permittedWeekendGaps++;
      else failures.push('UNEXPLAINED_HISTORICAL_GAP');
    }
    if (delta < seconds * 1000 || delta % (seconds * 1000) !== 0) failures.push('INVALID_CANDLE_SPACING');
  }
  for (let i = 1; i < recent.length; i++) if (Date.parse(recent[i].openTime) - Date.parse(recent[i - 1].openTime) !== seconds * 1000) failures.push('RECENT_CANDLE_GAP');
  // Continuous markets must not have historical gaps. Sessioned markets retain gaps explicitly.
  if (s.instrument.assetClass === 'crypto' && historicalGaps) failures.push('CONTINUOUS_MARKET_GAP');
  const last = rows[rows.length - 1];
  const age = last ? (now - Date.parse(last.closeTime)) / 1000 : null;
  if (age === null || age < 0 || age > seconds + s.config.closeGraceSeconds + 30) failures.push('STALE_CANDLES');
  const expectedClose = Math.floor((now - s.config.closeGraceSeconds * 1000) / (seconds * 1000)) * seconds * 1000;
  if (last && Date.parse(last.closeTime) !== expectedClose) failures.push('LATEST_COMPLETED_CANDLE_MISSING');
  s.frames[label] = { interval: label, seconds, fetchedAt: iso(now), requestedTimezone: 'UTC', source: 'Twelve Data time_series', metadata: { symbol: meta.symbol || null, interval: meta.interval || null, exchange: bounded(meta.exchange, 100), venueTimezone: bounded(meta.exchange_timezone, 100) }, valid: failures.length === 0, failures: [...new Set(failures)], closedCandles: rows.length, unfinishedExcluded: unfinished, historicalGapCount: historicalGaps, permittedWeekendGapCount: permittedWeekendGaps, latestCloseAgeSeconds: age, candles: rows };
  s.reasons.push(...s.frames[label].failures.map(x => label + ':' + x));
  return s;
}
function sma(values) { return values.reduce((a, b) => a + b, 0) / values.length; }
function emaSeries(values, period) {
  const out = Array(values.length).fill(null);
  if (values.length < period) return out;
  out[period - 1] = sma(values.slice(0, period));
  const alpha = 2 / (period + 1);
  for (let i = period; i < values.length; i++) out[i] = values[i] * alpha + out[i - 1] * (1 - alpha);
  return out;
}
function wilderRsi(values, period) {
  if (values.length <= period) return null;
  let gain = 0, loss = 0;
  for (let i = 1; i <= period; i++) { const d = values[i] - values[i - 1]; gain += Math.max(d, 0); loss += Math.max(-d, 0); }
  gain /= period; loss /= period;
  for (let i = period + 1; i < values.length; i++) { const d = values[i] - values[i - 1]; gain = (gain * (period - 1) + Math.max(d, 0)) / period; loss = (loss * (period - 1) + Math.max(-d, 0)) / period; }
  return gain === 0 && loss === 0 ? 50 : loss === 0 ? 100 : gain === 0 ? 0 : 100 - 100 / (1 + gain / loss);
}
function wilderAtr(rows, period) {
  if (rows.length <= period) return null;
  const tr = rows.slice(1).map((r, i) => Math.max(r.high - r.low, Math.abs(r.high - rows[i].close), Math.abs(r.low - rows[i].close)));
  let result = sma(tr.slice(0, period));
  for (let i = period; i < tr.length; i++) result = (result * (period - 1) + tr[i]) / period;
  return result;
}
function indicators(rows, p) {
  const closes = rows.map(x => x.close);
  const fast = emaSeries(closes, p.fast), slow = emaSeries(closes, p.slow);
  const line = closes.map((_, i) => fast[i] === null || slow[i] === null ? null : fast[i] - slow[i]);
  const start = line.findIndex(x => x !== null);
  const signals = emaSeries(line.slice(start), p.signal);
  const i = rows.length - 1, j = i - start;
  const emaFast = emaSeries(closes, p.emaFast), emaSlow = emaSeries(closes, p.emaSlow);
  return { rsi: wilderRsi(closes, p.rsi), macd: { line: line[i], signal: signals[j], histogram: line[i] - signals[j], previousHistogram: line[i - 1] - signals[j - 1] }, ema: { fast: emaFast[i], slow: emaSlow[i], fastSlopeThreeBars: emaFast[i] - emaFast[i - 3] }, atr: wilderAtr(rows, p.atr), close: closes[i], previousClose: closes[i - 1] };
}
function classifySession(ms) {
  const h = new Date(ms).getUTCHours();
  if (h >= 13 && h < 16) return 'london_new_york_overlap_utc';
  if (h >= 7 && h < 16) return 'london_utc';
  if (h >= 13 && h < 22) return 'new_york_utc';
  return 'asia_or_off_hours_utc';
}
function trend(v) {
  if (v.close > v.ema.fast && v.ema.fast > v.ema.slow && v.ema.fastSlopeThreeBars > 0) return 'bullish';
  if (v.close < v.ema.fast && v.ema.fast < v.ema.slow && v.ema.fastSlopeThreeBars < 0) return 'bearish';
  return 'mixed';
}
function makeLevels(direction, entry, atr, instrument, c) {
  const round = x => Number(x.toFixed(instrument.priceDecimals));
  const distance = atr * c.stopAtrMultiplier;
  const sign = direction === 'BUY' ? 1 : -1;
  const levels = { entry: round(entry), stopLoss: round(entry - sign * distance), takeProfit: round(entry + sign * distance * c.targetGrossR) };
  return validateLevels(direction, levels, instrument, c);
}
function validateLevels(direction, l, instrument, c) {
  const cost = instrument.spreadPrice + 2 * instrument.slippagePricePerSide;
  const risk = Math.abs(l.entry - l.stopLoss), reward = Math.abs(l.takeProfit - l.entry);
  const order = direction === 'BUY' ? l.stopLoss < l.entry && l.entry < l.takeProfit : direction === 'SELL' && l.takeProfit < l.entry && l.entry < l.stopLoss;
  const costValid = finite(instrument.spreadPrice) && instrument.spreadPrice > 0 && finite(instrument.slippagePricePerSide) && instrument.slippagePricePerSide >= 0;
  const netRr = costValid && risk > 0 ? (reward - cost) / (risk + cost) : null;
  return { ...l, grossRiskPrice: risk, grossRewardPrice: reward, estimatedRoundTripCostPrice: costValid ? cost : null, grossRewardRisk: risk > 0 ? reward / risk : null, netRewardRisk: netRr, valid: Object.values(l).every(x => finite(x) && x > 0) && order && costValid && finite(netRr) && netRr >= c.minimumRewardRisk };
}
function analyzeTechnical(s, now) {
  s = clone(s);
  const c = s.config;
  if (!['1min', '15min', '1h'].every(k => s.frames[k] && s.frames[k].valid)) { s.technical = { valid: false }; return s; }
  const metrics = {};
  for (const k of ['1min', '15min', '1h']) metrics[k] = indicators(s.frames[k].candles, c.indicators);
  if (Object.values(metrics).some(v => ![v.rsi, v.macd.line, v.macd.signal, v.macd.histogram, v.macd.previousHistogram, v.ema.fast, v.ema.slow, v.ema.fastSlopeThreeBars, v.atr, v.close].every(finite))) { s.reasons.push('INVALID_INDICATOR_RESULT'); s.technical = { valid: false }; return s; }
  const trends = Object.fromEntries(Object.entries(metrics).map(([k, v]) => [k, trend(v)]));
  const a = metrics['1min'], b = metrics['15min'], h = metrics['1h'];
  let direction = 'HOLD';
  const allBull = Object.values(trends).every(t => t === 'bullish');
  const allBear = Object.values(trends).every(t => t === 'bearish');
  if (allBull && a.rsi >= 50 && a.rsi <= 68 && b.rsi >= 50 && b.rsi <= 68 && h.rsi < 75 && a.macd.histogram > 0 && b.macd.histogram > 0 && h.macd.histogram >= 0 && a.macd.histogram >= a.macd.previousHistogram && b.macd.histogram >= b.macd.previousHistogram) direction = 'BUY';
  if (allBear && a.rsi >= 32 && a.rsi <= 50 && b.rsi >= 32 && b.rsi <= 50 && h.rsi > 25 && a.macd.histogram < 0 && b.macd.histogram < 0 && h.macd.histogram <= 0 && a.macd.histogram <= a.macd.previousHistogram && b.macd.histogram <= b.macd.previousHistogram) direction = 'SELL';
  const blocks = [];
  if (direction === 'HOLD') blocks.push('MULTITIMEFRAME_OR_MOMENTUM_NOT_CONFIRMED');
  const fraction = b.atr / b.close;
  if (fraction < c.minimumAtrFraction || fraction > c.maximumAtrFraction) blocks.push('ATR_VOLATILITY_OUTSIDE_POLICY');
  if (Math.abs(a.close - b.ema.fast) > 2 * b.atr) blocks.push('PRICE_EXTENDED_FROM_SETUP_EMA');
  if (Math.abs(a.close - b.close) > c.maximumEntryDeviationAtr * b.atr) blocks.push('ENTRY_MOVED_FROM_SETUP');
  const ins = s.instrument;
  if (!Number.isInteger(ins.priceDecimals) || ins.priceDecimals < 0 || ins.priceDecimals > 8) blocks.push('INVALID_PRICE_PRECISION');
  if (!(finite(ins.spreadPrice) && ins.spreadPrice > 0 && finite(ins.slippagePricePerSide) && ins.slippagePricePerSide >= 0)) blocks.push('EXECUTION_COSTS_NOT_CONFIGURED');
  else if (ins.spreadPrice / b.atr > c.maximumSpreadAtrFraction) blocks.push('SPREAD_TOO_LARGE');
  const latestCloseTime = s.frames['1min'].candles.slice(-1)[0].closeTime;
  if ((now - Date.parse(latestCloseTime)) / 1000 > c.maximumDecisionAgeSeconds) blocks.push('ENTRY_REFERENCE_STALE');
  const levels = direction !== 'HOLD' && Number.isInteger(ins.priceDecimals) && ins.priceDecimals >= 0 && ins.priceDecimals <= 8 ? makeLevels(direction, a.close, b.atr, ins, c) : null;
  if (levels && !levels.valid) blocks.push('NET_REWARD_RISK_OR_LEVELS_INVALID');
  s.technical = { valid: true, calculatedAt: iso(now), indicators: metrics, trends, marketConditions: { trend: trends['1h'], atrFraction15m: fraction, volatilityBand: fraction < 0.001 ? 'low' : fraction > 0.005 ? 'high' : 'moderate', session: classifySession(now), sessionDefinition: 'Fixed UTC research buckets; not exchange calendars or DST-adjusted sessions', historicalGaps: Object.fromEntries(Object.entries(s.frames).map(([k, f]) => [k, f.historicalGapCount])) }, latestClosed1mAt: latestCloseTime };
  s.candidate = { direction, eligible: blocks.length === 0 && direction !== 'HOLD', blockers: blocks, levels, entryBasis: 'Last closed 1min candle close; indicative midpoint/last price, not an executable bid/ask quote', stopBasis: '15min Wilder ATR x ' + c.stopAtrMultiplier, entryRule: 'Hypothetical next-available-price entry only if deviation <= configured ATR tolerance; no order is placed', entryExpiryMinutes: c.signalExpiryMinutes };
  s.reasons.push(...blocks);
  return s;
}
function normalizeNews(s, raw, now) {
  s = clone(s);
  const data = raw && raw.body ? raw.body : raw;
  const failures = [];
  if (!data || data.status !== 'ok' || !Array.isArray(data.articles)) failures.push('NEWS_API_OR_RESPONSE_ERROR');
  const articles = [], seen = new Set();
  let excluded = 0;
  for (const a of data && Array.isArray(data.articles) ? data.articles.slice(0, 100) : []) {
    if (!a || typeof a !== 'object' || Array.isArray(a)) { excluded++; continue; }
    const ms = typeof a.publishedAt === 'string' && /Z$|[+-]\d\d:\d\d$/.test(a.publishedAt) ? Date.parse(a.publishedAt) : NaN;
    const title = bounded(a.title, 240).trim();
    const description = bounded(a.description, 800).trim();
    const url = bounded(a.url, 1200);
    if (!finite(ms) || ms > now || now - ms > s.config.newsWindowHours * 3600000 || !title || title === '[Removed]' || !/^https?:\/\//.test(url)) { excluded++; continue; }
    const key = title.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (seen.has(key)) { excluded++; continue; }
    seen.add(key);
    articles.push({ title, description, publishedAt: iso(ms), source: bounded(a.source && a.source.name, 100), url });
  }
  articles.sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt));
  const selected = articles.slice(0, s.config.newsMaximumArticles);
  if (selected.length < s.config.newsMinimumArticles) failures.push('INSUFFICIENT_RECENT_NEWS');
  if (!selected.length || now - Date.parse(selected[0].publishedAt) > s.config.newsMaximumAgeHours * 3600000) failures.push('NEWS_TOO_OLD');
  s.news = { available: failures.length === 0, failures: [...new Set(failures)], query: s.instrument.newsQuery, fetchedAt: iso(now), windowHours: s.config.newsWindowHours, excludedCount: excluded, articles: selected, coverage: 'Recent English-language keyword-matched headlines, not a complete market or economic-event feed' };
  s.reasons.push(...s.news.failures);
  // Only compact, named, non-secret evidence goes to OpenAI. Never send chat IDs or full raw responses.
  s.aiEvidence = { symbol: s.request.symbol, strategyVersion: s.config.strategyVersion, asOf: iso(now), indicators: s.technical.indicators, trends: s.technical.trends, marketConditions: s.technical.marketConditions, candidate: s.candidate, dataQuality: Object.fromEntries(Object.entries(s.frames).map(([k, f]) => [k, { valid: f.valid, latestCloseAgeSeconds: f.latestCloseAgeSeconds, historicalGapCount: f.historicalGapCount }])), articles: selected };
  return s;
}
function extractAi(raw) {
  if (!raw || raw.error || raw.status !== 'completed' || !Array.isArray(raw.output)) throw Error('AI_RESPONSE_NOT_COMPLETED');
  const contents = raw.output.filter(x => x.type === 'message').flatMap(x => x.content || []);
  if (contents.some(x => x.type === 'refusal')) throw Error('AI_REFUSAL');
  const texts = contents.filter(x => x.type === 'output_text').map(x => x.text);
  if (texts.length !== 1) throw Error('AI_OUTPUT_NOT_SINGLE_OBJECT');
  const obj = typeof texts[0] === 'string' ? JSON.parse(texts[0]) : texts[0];
  if (!obj || Array.isArray(obj) || typeof obj !== 'object') throw Error('AI_INVALID_OBJECT');
  const keys = ['recommendation', 'confidence', 'confidenceRationale', 'technicalReasoning', 'timeframeAgreement', 'sentiment', 'risks'];
  if (Object.keys(obj).length !== keys.length || !keys.every(k => Object.hasOwn(obj, k))) throw Error('AI_SCHEMA_MISMATCH');
  if (!['BUY', 'SELL', 'HOLD'].includes(obj.recommendation) || !finite(obj.confidence) || obj.confidence < 0 || obj.confidence > 1 || !['aligned', 'mixed'].includes(obj.timeframeAgreement)) throw Error('AI_INVALID_ASSESSMENT');
  if (!['confidenceRationale', 'technicalReasoning'].every(k => typeof obj[k] === 'string' && obj[k].length > 0 && obj[k].length <= 2000)) throw Error('AI_INVALID_REASONING');
  const n = obj.sentiment;
  if (!n || Object.keys(n).length !== 5 || !['category','score','rationale','relevantArticleIndexes','coverage'].every(k => Object.hasOwn(n, k)) || !['Positive', 'Neutral', 'Negative', 'Unavailable'].includes(n.category) || !finite(n.score) || Math.abs(n.score) > 1 || typeof n.rationale !== 'string' || !n.rationale.length || n.rationale.length > 2000 || !['adequate', 'limited', 'irrelevant'].includes(n.coverage) || !Array.isArray(n.relevantArticleIndexes) || !n.relevantArticleIndexes.every(Number.isInteger)) throw Error('AI_INVALID_SENTIMENT');
  if ((n.category === 'Positive' && n.score <= 0.15) || (n.category === 'Negative' && n.score >= -0.15) || (n.category === 'Neutral' && Math.abs(n.score) > 0.15) || (n.category === 'Unavailable' && n.score !== 0)) throw Error('AI_SENTIMENT_SCORE_CONFLICT');
  if (!Array.isArray(obj.risks) || obj.risks.length > 8 || !obj.risks.every(x => typeof x === 'string' && x.length > 0 && x.length <= 300)) throw Error('AI_INVALID_RISKS');
  return obj;
}
function finalize(s, raw, now, useAi) {
  s = clone(s);
  let decision = 'HOLD';
  const reasons = [...s.reasons];
  if (useAi) {
    try { s.ai = extractAi(raw); } catch (_) { reasons.push('AI_FAILED_OR_INVALID_STRUCTURED_OUTPUT'); }
  }
  const a = s.ai, c = s.config;
  if (a) {
    if (typeof raw.model !== 'string' || !(raw.model === c.modelRequested || raw.model.startsWith(c.modelRequested + '-'))) reasons.push('AI_MODEL_VERSION_MISMATCH');
    if (!s.candidate || !s.candidate.eligible) reasons.push('DETERMINISTIC_TRADE_GATE_BLOCKED');
    if (a.recommendation === 'HOLD') reasons.push('AI_RECOMMENDS_HOLD');
    if (s.candidate && a.recommendation !== 'HOLD' && a.recommendation !== s.candidate.direction) reasons.push('AI_DIRECTION_CONFLICT');
    if (a.timeframeAgreement !== 'aligned') reasons.push('AI_TIMEFRAME_CONFLICT');
    if (a.confidence < c.minimumAiConfidence) reasons.push('AI_CONFIDENCE_BELOW_POLICY');
    const refs = a.sentiment.relevantArticleIndexes;
    if (a.sentiment.coverage !== 'adequate' || a.sentiment.category === 'Unavailable' || new Set(refs).size < c.newsMinimumArticles || refs.some(i => i < 0 || i >= s.news.articles.length)) reasons.push('NEWS_RELEVANCE_NOT_CONFIRMED');
    if (s.candidate && (s.candidate.direction === 'BUY' && a.sentiment.score <= -c.sentimentVetoScore || s.candidate.direction === 'SELL' && a.sentiment.score >= c.sentimentVetoScore)) reasons.push('OPPOSING_NEWS_SENTIMENT');
    if (!s.news.available) reasons.push('NEWS_REQUIRED');
    if (!s.technical || !s.technical.valid) reasons.push('TECHNICAL_DATA_REQUIRED');
    if (s.technical && s.technical.valid && (now - Date.parse(s.technical.latestClosed1mAt)) / 1000 > c.maximumDecisionAgeSeconds) reasons.push('DATA_STALE_AT_DECISION');
    if (s.technical && s.technical.valid && (now - Date.parse(s.technical.calculatedAt)) / 1000 > c.maximumAnalysisSeconds) reasons.push('ANALYSIS_TOOK_TOO_LONG');
    if (s.candidate && s.candidate.levels) {
      const checked = validateLevels(s.candidate.direction, { entry: s.candidate.levels.entry, stopLoss: s.candidate.levels.stopLoss, takeProfit: s.candidate.levels.takeProfit }, s.instrument, c);
      if (!checked.valid) reasons.push('FINAL_RISK_VALIDATION_FAILED');
    } else reasons.push('NO_VALIDATED_PRICE_LEVELS');
    if (reasons.length === 0) decision = s.candidate.direction;
  }
  if (!a && reasons.length === 0) reasons.push('NO_VALID_AI_ASSESSMENT');
  const levels = decision === 'HOLD' ? null : clone(s.candidate.levels);
  const signalId = c.strategyVersion + ':' + s.request.requestId;
  const horizonHours = finite(c.evaluationHorizonHours) && c.evaluationHorizonHours > 0 && c.evaluationHorizonHours <= 24 ? c.evaluationHorizonHours : 4;
  const expiryMinutes = finite(c.signalExpiryMinutes) && c.signalExpiryMinutes > 0 && c.signalExpiryMinutes <= 5 ? c.signalExpiryMinutes : 5;
  s.prediction = {
    schemaVersion: c.schemaVersion, signalId, requestId: s.request.requestId, strategyVersion: c.strategyVersion,
    promptVersion: c.promptVersion, modelRequested: c.modelRequested, modelReported: useAi && raw ? bounded(raw.model, 100) || null : null,
    symbol: s.request.symbol, assetClass: s.instrument && s.instrument.assetClass || null,
    createdAt: iso(now), decision, signalTimeframe: '1min', confirmationTimeframes: ['15min', '1h'],
    evaluationHorizonHours: horizonHours, evaluationDeadline: iso(now + horizonHours * 3600000),
    entryExpiresAt: iso(now + expiryMinutes * 60000), entry: levels && levels.entry, stopLoss: levels && levels.stopLoss, takeProfit: levels && levels.takeProfit,
    levels, confidence: a ? Math.min(a.confidence, c.confidenceDisplayCap) : null,
    confidenceAssessment: { rawModelAssessment: a ? a.confidence : null, displayCap: c.confidenceDisplayCap, calibrated: false, meaning: 'Subjective model assessment, not a measured win probability' },
    reasoning: { technical: a ? a.technicalReasoning : 'Trade withheld by deterministic input, data-quality or configuration checks.', confidence: a ? a.confidenceRationale : null, noTradeReasons: [...new Set(reasons)], risks: a ? a.risks : [] },
    sentiment: a ? a.sentiment : { category: 'Unavailable', score: null, coverage: 'unavailable', rationale: 'No verified AI sentiment assessment', relevantArticleIndexes: [] },
    marketConditions: s.technical && s.technical.valid ? s.technical.marketConditions : null,
    technicalIndicators: s.technical && s.technical.valid ? s.technical.indicators : null,
    evidenceAsOf: s.technical && s.technical.valid ? s.technical.latestClosed1mAt : null,
    hypothetical: true, executedTrade: false, memoryPersisted: false, outcomeTrackingEnabled: false,
    executionAssumptions: { entryBasis: s.candidate ? s.candidate.entryBasis : null, entryRule: s.candidate ? s.candidate.entryRule : null, spreadPrice: s.instrument ? s.instrument.spreadPrice : null, slippagePricePerSide: s.instrument ? s.instrument.slippagePricePerSide : null, costModel: 'Full spread once plus slippage on both entry and exit, in quoted price units; excludes commissions/financing', entryDeviationAtr: c.maximumEntryDeviationAtr, evaluationPolicy: 'Future tracker: entry must be confirmed after signal; if both barriers touch inside one candle, resolve with finer data or mark ambiguous; conservative stop-first statistics are separate', noAutomaticDeployment: true }
  };
  // Phase 2 boundary: insert this record and evidence before notification; database failure must fail closed.
  const strategyConfig = clone(c);
  delete strategyConfig.allowChatIds; delete strategyConfig.manualChatId; delete strategyConfig.manualSendTelegram;
  s.memoryRecord = { prediction: clone(s.prediction), strategyConfig, evidence: { frames: clone(s.frames), news: clone(s.news), candidate: clone(s.candidate), ai: clone(s.ai) } };
  return s;
}
function reasonText(code) {
  const parts = code.split(':');
  const label = parts.length > 1 ? parts.shift() + ': ' : '';
  const key = parts.join(':');
  const messages = {
    INVALID_STRATEGY_CONFIGURATION: 'Strategy settings are invalid; analysis is paused.',
    CHAT_NOT_AUTHORISED: 'This chat is not authorised.',
    UNSUPPORTED_OR_DISABLED_SYMBOL: 'Instrument is unsupported or not enabled.',
    STALE_OR_INVALID_TELEGRAM_REQUEST: 'Request was delayed or has an invalid timestamp; send a new request.',
    API_OR_RESPONSE_ERROR: 'Market-data request failed or returned an unusable response.',
    SYMBOL_MISMATCH: 'Provider returned a different instrument.',
    INTERVAL_MISMATCH: 'Provider returned a different timeframe.',
    RESPONSE_TIMEZONE_MISMATCH: 'Provider timestamps do not match the requested UTC timezone.',
    INVALID_OHLC_OR_TIMESTAMP: 'Candle prices or timestamps failed validation.',
    INVALID_CANDLE_OBJECT: 'Market-data response contains a malformed candle.',
    OVERSIZED_CANDLE_RESPONSE: 'Market-data response exceeded the requested history size.',
    DUPLICATE_CANDLE: 'Market history contains duplicate candles.',
    MISALIGNED_CANDLE_TIMESTAMP: 'Candle timestamps do not align with this timeframe.',
    FUTURE_CANDLE: 'Market history contains a future timestamp.',
    INSUFFICIENT_CLOSED_CANDLES: 'Not enough completed candles for reliable indicators.',
    INVALID_CANDLE_SPACING: 'Market history has inconsistent candle spacing.',
    UNEXPLAINED_HISTORICAL_GAP: 'Market history has an unexplained missing interval.',
    RECENT_CANDLE_GAP: 'Recent market history is incomplete.',
    CONTINUOUS_MARKET_GAP: 'Continuous-market history contains missing intervals.',
    STALE_CANDLES: 'Market history is stale.',
    LATEST_COMPLETED_CANDLE_MISSING: 'The newest completed candle is missing.',
    INVALID_INDICATOR_RESULT: 'Indicator calculation failed validation.',
    MULTITIMEFRAME_OR_MOMENTUM_NOT_CONFIRMED: 'Trend or momentum is not confirmed across all three timeframes.',
    ATR_VOLATILITY_OUTSIDE_POLICY: 'Volatility is outside the strategy risk limits.',
    PRICE_EXTENDED_FROM_SETUP_EMA: 'Price is too far from the setup moving average.',
    ENTRY_MOVED_FROM_SETUP: 'Price has moved too far from the confirmed setup.',
    INVALID_PRICE_PRECISION: 'Instrument price precision is not configured correctly.',
    EXECUTION_COSTS_NOT_CONFIGURED: 'Verified spread and slippage estimates are not configured.',
    SPREAD_TOO_LARGE: 'Estimated spread is too large relative to volatility.',
    ENTRY_REFERENCE_STALE: 'The indicative entry price is stale.',
    NET_REWARD_RISK_OR_LEVELS_INVALID: 'Price levels or reward/risk fail validation after estimated costs.',
    NEWS_API_OR_RESPONSE_ERROR: 'News request failed or returned an unusable response.',
    INSUFFICIENT_RECENT_NEWS: 'Not enough distinct recent news reports.',
    NEWS_TOO_OLD: 'News coverage is too old.',
    AI_FAILED_OR_INVALID_STRUCTURED_OUTPUT: 'AI analysis failed or did not return a valid assessment.',
    AI_MODEL_VERSION_MISMATCH: 'AI model does not match this strategy version.',
    DETERMINISTIC_TRADE_GATE_BLOCKED: 'The calculated trade setup did not pass required checks.',
    AI_RECOMMENDS_HOLD: 'AI review recommends waiting.',
    AI_DIRECTION_CONFLICT: 'AI assessment conflicts with the calculated direction.',
    AI_TIMEFRAME_CONFLICT: 'AI review does not confirm timeframe agreement.',
    AI_CONFIDENCE_BELOW_POLICY: 'AI assessment is below the required confidence threshold.',
    NEWS_RELEVANCE_NOT_CONFIRMED: 'Relevant news coverage could not be established.',
    OPPOSING_NEWS_SENTIMENT: 'News sentiment opposes the technical setup.',
    NEWS_REQUIRED: 'Required news evidence is unavailable.',
    TECHNICAL_DATA_REQUIRED: 'Required technical evidence is unavailable.',
    DATA_STALE_AT_DECISION: 'Prices became stale before the decision was ready.',
    ANALYSIS_TOOK_TOO_LONG: 'Analysis took too long for a fresh intraday signal.',
    FINAL_RISK_VALIDATION_FAILED: 'The final risk/reward check failed.',
    NO_VALIDATED_PRICE_LEVELS: 'No validated entry, stop and target are available.',
    NO_VALID_AI_ASSESSMENT: 'No valid AI assessment is available.'
  };
  return label + (messages[key] || 'A required validation check failed.');
}
function formatMessage(s) {
  s = clone(s);
  const p = s.prediction;
  const lines = ['Trading assistant — ' + (p.symbol || 'request'), 'Recommendation: ' + p.decision, 'As of: ' + p.createdAt, 'Strategy: ' + p.strategyVersion];
  if (p.decision !== 'HOLD') {
    lines.push('Indicative entry: ' + p.entry, 'Stop-loss: ' + p.stopLoss, 'Take-profit: ' + p.takeProfit, 'Estimated net reward/risk: ' + p.levels.netRewardRisk.toFixed(2) + ':1', 'Entry expires: ' + p.entryExpiresAt);
  } else lines.push('No trade. Entry / stop / target: N/A', 'Checks: ' + p.reasoning.noTradeReasons.map(reasonText).join(' '));
  lines.push('AI confidence: ' + (p.confidence === null ? 'unavailable' : Math.round(p.confidence * 100) + '% (uncalibrated assessment)'));
  lines.push('Sentiment: ' + p.sentiment.category + ' / ' + (p.sentiment.score === null ? 'N/A' : p.sentiment.score));
  lines.push('Reasoning: ' + bounded(p.reasoning.technical, 900));
  if (p.reasoning.confidence) lines.push('Confidence basis: ' + bounded(p.reasoning.confidence, 300));
  if (p.sentiment.rationale) lines.push('News: ' + bounded(p.sentiment.rationale, 400));
  if (p.reasoning.risks.length) lines.push('Risks: ' + bounded(p.reasoning.risks.join('; '), 450));
  lines.push('Hypothetical analysis only; no order placed or position monitored. Price levels are not executable quotes. No position size calculated.', 'Evaluation horizon: ' + p.evaluationHorizonHours + 'h (tracking is not enabled in Phase 1).');
  const footer = lines.slice(-2).join('\n');
  const body = lines.slice(0, -2).join('\n');
  s.telegramText = body.slice(0, 3900 - footer.length - 1) + '\n' + footer;
  return s;
}

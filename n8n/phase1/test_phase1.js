/* Offline tests of the SAME code embedded in the export; no credentials, APIs or Telegram. */
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const root = __dirname;
const core = fs.readFileSync(path.join(root, 'core.js'), 'utf8');
const ctx = vm.createContext({ console, Date });
vm.runInContext(core + '\nthis.api = {defaultConfig, prepare, normalizeFrame, emaSeries, wilderRsi, wilderAtr, indicators, analyzeTechnical, normalizeNews, extractAi, finalize, formatMessage, makeLevels, validateLevels, configValid, parseUtc};', ctx);
const f = ctx.api;
const now = Date.parse('2026-10-14T12:15:30Z');
const copied = x => JSON.parse(JSON.stringify(x));
let count = 0;
function test(name, run) { run(); count++; console.log('PASS ' + name); }
function approx(a, b, tolerance = 1e-9) { assert.ok(Math.abs(a - b) <= tolerance, a + ' != ' + b); }
function state() { return f.prepare({_manual: true, message: {text: 'XAU/USD'}}, f.defaultConfig(), now, 'offline'); }
function fixture(label, secs, n = 250) {
  const end = Math.floor((now - 10000) / (secs * 1000)) * secs * 1000;
  const rows = [];
  for (let i = 0; i < n; i++) {
    const price = 2500 + 0.01 * i + 0.6 * Math.sin(i / 8);
    rows.push({datetime: new Date(end - (n - i) * secs * 1000).toISOString().slice(0,19).replace('T',' '), open: String(price - 0.1), high: String(price + 1), low: String(price - 1), close: String(price)});
  }
  return {meta: {symbol: 'XAU/USD', interval: label, exchange_timezone: 'Australia/Sydney'}, values: rows.reverse()};
}
function fullState() {
  let s = state();
  for (const [label, secs] of [['1min', 60], ['15min', 900], ['1h', 3600]]) s = f.normalizeFrame(s, fixture(label, secs), label, secs, now);
  return f.analyzeTechnical(s, now);
}
function newsFixture() {
  return {status: 'ok', articles: [0,1,2].map(i => ({title: 'Gold market development ' + i, description: 'Market evidence', publishedAt: new Date(now - (i + 1) * 3600000).toISOString(), source: {name: 'Example'}, url: 'https://example.com/' + i}))};
}
function validAi(direction = 'BUY') {
  return {recommendation: direction, confidence: 0.75, confidenceRationale: 'Aligned evidence, subject to uncertainty', technicalReasoning: 'Three timeframes confirm the configured candidate', timeframeAgreement: 'aligned', sentiment: {category: 'Positive', score: 0.4, rationale: 'Instrument-relevant reports', relevantArticleIndexes: [0,1], coverage: 'adequate'}, risks: ['Indicative entry, not an execution quote']};
}
function response(obj) { return {status: 'completed', model: 'gpt-5-mini-2025-08-07', output: [{type: 'message', content: [{type: 'output_text', text: JSON.stringify(obj)}]}]}; }
function eligibleState(direction = 'BUY') {
  const s = copied(fullState());
  // This fixture isolates the final gate; technical selection has separate real-data tests.
  s.instrument.spreadPrice = 0.1; s.instrument.slippagePricePerSide = 0.05;
  s.reasons = [];
  s.candidate = {direction, eligible: true, blockers: [], levels: f.makeLevels(direction, 2500, 2, s.instrument, s.config), entryBasis: 'fixture', entryRule: 'fixture'};
  return f.normalizeNews(s, newsFixture(), now);
}

test('default config is valid; risk policy cannot silently weaken below 2R', () => {
  assert.equal(f.configValid(f.defaultConfig()), true);
  const c = copied(f.defaultConfig()); c.minimumRewardRisk = 1.5; assert.equal(f.configValid(c), false);
  c.minimumRewardRisk = 2; c.requireNews = false; assert.equal(f.configValid(c), false);
});
test('input aliases, manual isolation, chat authorization and stale request rejection', () => {
  assert.equal(f.prepare({_manual:true,message:{text:'gold'}}, f.defaultConfig(), now, 'x').request.symbol, 'XAU/USD');
  assert.equal(state().sendTelegram, false);
  const s = f.prepare({message: {text:'XAU/USD', chat:{id:12}, date: now/1000}},f.defaultConfig(),now,'x');
  assert.equal(s.validRequest,false); assert.equal(s.sendTelegram,false);
  const c=copied(f.defaultConfig()); c.allowChatIds=['12'];
  assert.equal(f.prepare({message:{text:'/analyze XAU/USD',chat:{id:12},date:now/1000}},c,now,'x').validRequest,true);
  assert.equal(f.prepare({message:{text:'XAU/USD',chat:{id:12},date:(now-180000)/1000}},c,now,'x').validRequest,false);
  assert.equal(f.prepare({_manual:true,message:{text:'BTC/USD'}},c,now,'x').validRequest,false);
});
test('EMA SMA seed and recursive values have independent known answers', () => {
  assert.deepEqual(copied(f.emaSeries([1,2,3,4,5],3)),[null,null,2,3,4]);
  approx(f.emaSeries([3,7,2,9,4],3)[4], 5.25);
});
test('Wilder RSI published reference and flat/rising/falling boundaries', () => {
  const close=[44.34,44.09,44.15,43.61,44.33,44.83,45.10,45.42,45.84,46.08,45.89,46.03,45.61,46.28,46.28,46.00,46.03,46.41,46.22,45.64,46.21];
  approx(f.wilderRsi(close.slice(0,15),14),70.46413502109705,1e-8);
  approx(f.wilderRsi(close,14),62.880718309962404,1e-8);
  assert.equal(f.wilderRsi(Array(40).fill(5),14),50);
  assert.equal(f.wilderRsi(Array.from({length:40},(_,i)=>i),14),100);
  assert.equal(f.wilderRsi(Array.from({length:40},(_,i)=>40-i),14),0);
});
test('ATR includes gaps and uses Wilder smoothing after initial TR average', () => {
  const r=[{high:10,low:8,close:9},{high:11,low:9,close:10},{high:15,low:13,close:14},{high:16,low:12,close:13}];
  approx(f.wilderAtr(r,2),3.75); // TR=2,5,4; seed=3.5; next=(3.5+4)/2
});
test('MACD constant and linear reference series', () => {
  const rows=Array.from({length:250},()=>({close:100,high:101,low:99}));
  const a=f.indicators(rows,f.defaultConfig().indicators);
  approx(a.macd.line,0); approx(a.macd.signal,0); approx(a.macd.histogram,0); approx(a.atr,2);
  const linear=Array.from({length:250},(_,i)=>({close:100+i,high:101+i,low:99+i}));
  const b=f.indicators(linear,f.defaultConfig().indicators);
  approx(b.macd.line,7); approx(b.macd.signal,7); approx(b.macd.histogram,0);
});
test('normalize vendor descending candles to valid chronological numbers', () => {
  const s=f.normalizeFrame(state(),fixture('1min',60),'1min',60,now);
  assert.equal(s.frames['1min'].valid,true);
  assert.equal(s.frames['1min'].candles.length,250);
  assert.ok(Date.parse(s.frames['1min'].candles[0].openTime)<Date.parse(s.frames['1min'].candles[249].openTime));
  assert.equal(typeof s.frames['1min'].candles[0].close,'number');
});
test('unfinished candle excluded and not used by indicators', () => {
  const raw=fixture('1min',60,249);
  raw.values.unshift({datetime:'2026-10-14 12:15:00',open:'9999',high:'10000',low:'9998',close:'9999'});
  const s=f.normalizeFrame(state(),raw,'1min',60,now);
  assert.equal(s.frames['1min'].valid,true); assert.equal(s.frames['1min'].unfinishedExcluded,1);
  assert.ok(s.frames['1min'].candles.at(-1).close<3000);
});
test('missing newest closed candle is rejected even if age nearly passes', () => {
  const raw=fixture('1min',60);raw.values.shift();
  assert.ok(f.normalizeFrame(state(),raw,'1min',60,now).frames['1min'].failures.includes('LATEST_COMPLETED_CANDLE_MISSING'));
});
test('duplicate, malformed, future, misaligned, invalid OHLC and short histories fail closed', () => {
  const mutate=[r=>{r.values[2]=r.values[1];},r=>{r.values[2].close='NaN';},r=>{r.values[2].high='1';},r=>{r.values[2].datetime='2026-10-14 12:14:01';},r=>{r.values[2].datetime='2026-10-14 12:19:00';},r=>{r.values[2]=null;},r=>{r.values=r.values.slice(0,10);}];
  for(const m of mutate){const raw=fixture('1min',60);m(raw);assert.equal(f.normalizeFrame(state(),raw,'1min',60,now).frames['1min'].valid,false);}
  assert.ok(Number.isNaN(f.parseUtc('2026-02-30 12:00:00')));
});
test('provider errors and symbol/interval/timezone mismatches fail closed', () => {
  assert.equal(f.normalizeFrame(state(),{status:'error',code:429},'1min',60,now).frames['1min'].valid,false);
  for(const [key,value] of [['symbol','EUR/USD'],['interval','5min'],['timezone','America/New_York']]) {const raw=fixture('1min',60);raw.meta[key]=value;assert.equal(f.normalizeFrame(state(),raw,'1min',60,now).frames['1min'].valid,false);}
});
test('recent gaps rejected; crypto also rejects historical gaps', () => {
  const r=fixture('1min',60);r.values.splice(3,1);
  assert.ok(f.normalizeFrame(state(),r,'1min',60,now).frames['1min'].failures.includes('RECENT_CANDLE_GAP'));
  const s=state();s.instrument.assetClass='crypto';const r2=fixture('1min',60);r2.values.splice(100,1);
  assert.ok(f.normalizeFrame(s,r2,'1min',60,now).frames['1min'].failures.includes('CONTINUOUS_MARKET_GAP'));
});
test('historical holes are rejected except narrow documented FX/metals weekend closures', () => {
  const r=fixture('1h',3600);r.values.splice(100,1);
  assert.ok(f.normalizeFrame(state(),r,'1h',3600,now).frames['1h'].failures.includes('UNEXPLAINED_HISTORICAL_GAP'));
  const weekend=fixture('1h',3600);
  // Build a continuous valid history backwards, skipping only a Friday-to-Sunday close.
  const end=Date.parse('2026-10-14T12:00:00Z');let time=end-3600000;
  for(const row of weekend.values){
    if(time===Date.parse('2026-10-11T21:00:00Z'))time=Date.parse('2026-10-09T20:00:00Z');
    row.datetime=new Date(time).toISOString().slice(0,19).replace('T',' ');time-=3600000;
  }
  const normalized=f.normalizeFrame(state(),weekend,'1h',3600,now).frames['1h'];
  assert.equal(normalized.valid,true);assert.ok(normalized.permittedWeekendGapCount>0);
});
test('real normalized indicators remain blocked when costs are unset', () => {
  const s=fullState();assert.equal(s.technical.valid,true);
  assert.equal(s.candidate.eligible,false);assert.ok(s.candidate.blockers.includes('EXECUTION_COSTS_NOT_CONFIGURED'));
});
test('three-timeframe BUY and SELL rules, disagreement and extreme RSI block', () => {
  const original=f.indicators;
  // Use explicit indicator fixtures to exercise the rule gates independently of the formula tests.
  const ruleCtx=vm.createContext({Date});vm.runInContext(core,ruleCtx);
  for(const direction of ['BUY','SELL']){
    const bullish=direction==='BUY';
    const v={close:2500,previousClose:2500,rsi:55,atr:2,ema:{fast:bullish?2499:2501,slow:bullish?2498:2502,fastSlopeThreeBars:bullish?0.1:-0.1},macd:{line:bullish?1:-1,signal:0,histogram:bullish?1:-1,previousHistogram:bullish?0.5:-0.5}};
    if(!bullish)v.rsi=45;
    ruleCtx.values=[copied(v),copied(v),copied(v)];
    vm.runInContext('indicators = () => values.shift();',ruleCtx);
    const s=copied(fullState());s.instrument.spreadPrice=0.1;s.instrument.slippagePricePerSide=0.05;s.reasons=[];
    ruleCtx.state=s;ruleCtx.now=now;
    const result=vm.runInContext('analyzeTechnical(state,now)',ruleCtx);
    assert.equal(result.candidate.direction,direction);assert.equal(result.candidate.eligible,true);
    ruleCtx.values=[copied(v),copied(v),{...copied(v),ema:{fast:2500,slow:2500,fastSlopeThreeBars:0}}];
    assert.equal(vm.runInContext('analyzeTechnical(state,now)',ruleCtx).candidate.eligible,false);
    ruleCtx.values=[{...copied(v),rsi:90},copied(v),copied(v)];
    assert.equal(vm.runInContext('analyzeTechnical(state,now)',ruleCtx).candidate.eligible,false);
  }
});
test('rounded levels account for spread and both slippage sides', () => {
  const c=f.defaultConfig(), ins={priceDecimals:2,spreadPrice:0.1,slippagePricePerSide:0.05};
  for(const d of ['BUY','SELL']){const l=f.makeLevels(d,2500,2,ins,c);assert.equal(l.valid,true);approx(l.netRewardRisk,7.3/3.2);}
  assert.equal(f.makeLevels('BUY',2500,2,{...ins,spreadPrice:2},c).valid,false);
  assert.equal(f.validateLevels('BUY',{entry:2500,stopLoss:2501,takeProfit:2502},ins,c).valid,false);
});
test('news filtering excludes future/old/duplicate/malformed entries', () => {
  const s=fullState(), raw=newsFixture();raw.articles.push(copied(raw.articles[0]),null,{title:'Future',publishedAt:new Date(now+1000).toISOString(),url:'https://example.com/future'});
  const r=f.normalizeNews(s,raw,now);assert.equal(r.news.available,true);assert.equal(r.news.articles.length,3);
  assert.equal(f.normalizeNews(s,{status:'error'},now).news.available,false);
  const old=newsFixture();old.articles.forEach(a=>a.publishedAt=new Date(now-25*3600000).toISOString());assert.equal(f.normalizeNews(s,old,now).news.available,false);
});
test('native OpenAI Responses JSON string and parsed object handled', () => {
  assert.equal(f.extractAi(response(validAi())).recommendation,'BUY');
  const r=response(validAi());r.output[0].content[0].text=validAi();assert.equal(f.extractAi(r).recommendation,'BUY');
  assert.throws(()=>f.extractAi({status:'incomplete',output:[]}));
  assert.throws(()=>f.extractAi({status:'completed',output:[{type:'message',content:[{type:'refusal'}]}]}));
  const a=validAi();a.confidence=NaN;assert.throws(()=>f.extractAi(response(a)));
});
test('eligible trades pass the final BUY and SELL gate', () => {
  for(const d of ['BUY','SELL']){const a=validAi(d);a.sentiment.category=d==='BUY'?'Positive':'Negative';a.sentiment.score=d==='BUY'?0.4:-0.4;const p=f.finalize(eligibleState(d),response(a),now+1000,true).prediction;assert.equal(p.decision,d);assert.equal(p.hypothetical,true);assert.equal(p.memoryPersisted,false);}
});
test('AI cannot reverse direction, force blocked candidate or bypass low confidence', () => {
  const cases=[a=>{a.recommendation='SELL';},a=>{a.confidence=0.5;},a=>{a.timeframeAgreement='mixed';},a=>{a.sentiment.category='Negative';a.sentiment.score=-0.6;},a=>{a.sentiment.relevantArticleIndexes=[0,99];},a=>{a.sentiment.relevantArticleIndexes=[0,0];},a=>{a.sentiment.coverage='limited';},a=>{a.extra='unexpected';}];
  for(const mutate of cases){const a=validAi();mutate(a);assert.equal(f.finalize(eligibleState(),response(a),now+1000,true).prediction.decision,'HOLD');}
  const s=eligibleState();s.candidate.eligible=false;assert.equal(f.finalize(s,response(validAi()),now+1000,true).prediction.decision,'HOLD');
});
test('delayed AI, changed cost assumptions and model failure force HOLD', () => {
  assert.equal(f.finalize(eligibleState(),response(validAi()),now+180000,true).prediction.decision,'HOLD');
  const s=eligibleState();s.instrument.spreadPrice=10;assert.equal(f.finalize(s,response(validAi()),now+1000,true).prediction.decision,'HOLD');
  assert.equal(f.finalize(eligibleState(),{error:'request failed'},now,true).prediction.decision,'HOLD');
  const changed=response(validAi());changed.model='other-model';assert.equal(f.finalize(eligibleState(),changed,now,true).prediction.decision,'HOLD');
});
test('invalid horizon configuration still produces a safe HOLD with a valid fallback deadline', () => {
  const c=copied(f.defaultConfig());c.evaluationHorizonHours='invalid';
  const s=f.prepare({_manual:true,message:{text:'XAU/USD'}},c,now,'x');
  assert.equal(s.validRequest,false);
  const p=f.finalize(s,null,now,false).prediction;assert.equal(p.decision,'HOLD');assert.equal(p.evaluationHorizonHours,4);
});
test('HOLD has no actionable levels; memory links strategy; horizon configurable', () => {
  const s=state();s.config.evaluationHorizonHours=6;
  const r=f.finalize(s,null,now,false);assert.equal(r.prediction.decision,'HOLD');assert.equal(r.prediction.entry,null);
  assert.equal(Date.parse(r.prediction.evaluationDeadline)-now,6*3600000);
  assert.equal(r.memoryRecord.prediction.strategyVersion,s.config.strategyVersion);
  assert.equal(Object.hasOwn(r.memoryRecord.strategyConfig,'allowChatIds'),false);
  assert.ok(f.formatMessage(r).telegramText.length<4096);
});

const workflow=JSON.parse(fs.readFileSync(path.join(root,'Trading_Assistant_Phase1.n8n.json'),'utf8'));
test('export inactive, trigger disabled, all graph targets valid and credentials absent', () => {
  assert.equal(workflow.active,false);assert.equal(workflow.nodes.find(n=>n.name==='Telegram Trigger').disabled,true);
  const names=new Set(workflow.nodes.map(n=>n.name));assert.equal(names.size,workflow.nodes.length);
  for(const [source,types] of Object.entries(workflow.connections)){assert.ok(names.has(source));for(const ports of Object.values(types))for(const entries of ports)for(const e of entries)assert.ok(names.has(e.node));}
  for(const n of workflow.nodes){assert.equal(Object.hasOwn(n,'credentials'),false);if(n.type==='n8n-nodes-base.code')new vm.Script('(function(){'+n.parameters.jsCode+'})');}
  const serialized=JSON.stringify(workflow);assert.equal(/(?:[a-f0-9]{32,}|sk-[A-Za-z0-9_-]{10,})/.test(serialized),false);
  assert.equal(workflow.nodes.filter(n=>n.type==='n8n-nodes-base.httpRequest').length,4);
});
test('embedded Code nodes match core and adapters run with n8n-shaped input/context', () => {
  const named={};
  function run(name,input,time=now){
    const n=workflow.nodes.find(n=>n.name===name);
    const DateMock=class extends Date{static now(){return time;}};
    const sandbox=vm.createContext({Date:DateMock,$input:{first:()=>({json:input}),all:()=>[{json:input}]},$execution:{id:'test-execution'},$:key=>({first:()=>({json:named[key]})})});
    const out=vm.runInContext('(function(){'+n.parameters.jsCode+'})()',sandbox);named[name]=copied(out[0].json);return named[name];
  }
  run('Configure Request',{_manual:true,message:{text:'XAU/USD'}});
  run('Normalize 1m',fixture('1min',60));run('Normalize 15m',fixture('15min',900));run('Normalize 1h',fixture('1h',3600));run('Technical Analysis',named['Normalize 1h']);run('Normalize News',newsFixture());
  const r=run('Final Trade Gate',response(validAi('HOLD')));
  assert.equal(r.prediction.decision,'HOLD');run('Prepare Memory Record',r);run('Format Telegram',r);
  assert.equal(run('Manual Result',named['Format Telegram']).delivery.status,'not_requested');
  assert.equal(run('Telegram Delivery Status',{message_id:10}).delivery.status,'api_confirmed');
  assert.equal(run('Telegram Delivery Status',{error:'failed'}).delivery.status,'failed_or_unknown');
  for(const n of workflow.nodes.filter(n=>n.type==='n8n-nodes-base.code'&&n.name!=='Manual Input'))assert.ok(n.parameters.jsCode.startsWith(core));
});
console.log('\n' + count + ' offline checks passed. This is NOT an n8n Cloud import or live-provider test.');

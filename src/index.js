/* ============================================================
   東暦クリッカー — src/index.js
   Game Engine v0.2.0 (Phase 2+)
   ============================================================ */

'use strict';

// ============================================================
// CONSTANTS
// ============================================================
const VERSION = '0.2.0';
const TICK_MS = 50;            // 20 ticks/sec
const SAVE_INTERVAL = 30 * 20;       // ticks → auto-save every 30s
const ERA_START = 2045;
const ERA_SECS_BASE = 600;           // real seconds per 1 era-year (10 min)
const MSG_MAX = 60;            // max messages in log
const REBIRTH_MIN_ERA = 2046;         // minimum era to be able to rebirth
const ROUTE_SPLIT_ERA = 2060;         // Era where divergence happens
const ANSWER_ROUTE_Q_PENALTY = 0.05;  // Answer route Question production penalty
const GOLDEN_Q_APPEAR_SECS_MIN = 5 * 60;  // 黄金の問い最小出現間隔（秒）
const GOLDEN_Q_APPEAR_SECS_MAX = 10 * 60; // 黄金の問い最大出現間隔（秒）
const GOLDEN_Q_LIFETIME = 15;              // 黄金の問い表示時間（秒）
const ULTIMATE_A_LIFETIME = 15;            // 究極の答え表示時間（秒）
const BUFF_QPS_MULT = 10;                  // QPSバフ中の倍率
const BUFF_DURATION = Math.sqrt(53);       // √53秒 ≈ 7.28秒
const ULTIMATE_APPEAR_MIN_ERA = 2050;       // 究極の答えが出現可能になる最小東暦
const ULTIMATE_REBIRTH_ERA = 2060;          // この東暦以降に転生した経験があれば周回初期から出現可能

// ── Building definitions ─────────────────────────────────────
const BUILDINGS_DATA = [
  // Phase 1 (Question)
  { id: 'questioner', type: 'q', emoji: '🤔', baseCost: 10, costMult: 1.15, baseQPS: 0.1, unlockEra: null, synergyFrom: null },
  { id: 'doubt', type: 'q', emoji: '🌫️', baseCost: 100, costMult: 1.15, baseQPS: 1, unlockEra: null, synergyFrom: 'questioner' },
  { id: 'chain', type: 'q', emoji: '🔗', baseCost: 1100, costMult: 1.15, baseQPS: 8, unlockEra: null, synergyFrom: 'doubt' },
  { id: 'unsolved', type: 'q', emoji: '📚', baseCost: 12000, costMult: 1.15, baseQPS: 47, unlockEra: null, synergyFrom: 'chain' },
  { id: 'abyss', type: 'q', emoji: '🌀', baseCost: 130000, costMult: 1.15, baseQPS: 260, unlockEra: 2050, synergyFrom: 'unsolved' },
  { id: 'storm', type: 'q', emoji: '⚡', baseCost: 1400000, costMult: 1.15, baseQPS: 1400, unlockEra: 2075, synergyFrom: 'abyss' },
  { id: 'time_q', type: 'q', emoji: '⏳', baseCost: 20000000, costMult: 1.15, baseQPS: 7800, unlockEra: 2100, synergyFrom: 'storm' },
  // Phase 2 (Answer)
  { id: 'solver', type: 'a', emoji: '💡', baseCost: 50000, costMult: 1.2, baseAPS: 1, unlockEra: 2060, synergyFrom: 'all_q' },
  { id: 'logic', type: 'a', emoji: '⚙️', baseCost: 500000, costMult: 1.2, baseAPS: 12, unlockEra: 2060, synergyFrom: 'solver' },
  { id: 'truth', type: 'a', emoji: '💎', baseCost: 8000000, costMult: 1.2, baseAPS: 150, unlockEra: 2070, synergyFrom: 'logic' },
  { id: 'conclusion', type: 'a', emoji: '🏁', baseCost: 1e9, costMult: 1.25, baseAPS: 2000, unlockEra: 2090, synergyFrom: 'truth' },
];

// ── Upgrade definitions ──────────────────────────────────────
const UPGRADES_DATA = [
  // Phase 1 (Question)
  { id: 'curiosity', type: 'q', cost: 50, effect: { type: 'clickMult', value: 2 }, req: { totalQ: 20 } },
  { id: 'questioner_union', type: 'q', cost: 100, effect: { type: 'buildingMult', target: 'questioner', value: 2 }, req: { buildings: { questioner: 5 } } },
  { id: 'deeper_curiosity', type: 'q', cost: 1000, effect: { type: 'clickMult', value: 2 }, req: { buildings: { questioner: 10 } } },
  { id: 'era_speed_1', type: 'q', cost: 500, effect: { type: 'eraSpeed', value: 2 }, req: { totalQ: 200 } },
  { id: 'questioner_philo', type: 'q', cost: 5000, effect: { type: 'buildingMult', target: 'questioner', value: 2 }, req: { buildings: { questioner: 25 } } },
  { id: 'doubt_deepen', type: 'q', cost: 5000, effect: { type: 'buildingMult', target: 'doubt', value: 2 }, req: { buildings: { doubt: 10 } } },
  { id: 'sharp_question', type: 'q', cost: 5000, effect: { type: 'clickMult', value: 2 }, req: { buildings: { questioner: 25 } } },
  { id: 'click_chain', type: 'q', cost: 10000, effect: { type: 'clickChain', value: 0.1 }, req: { totalQ: 5000 } },
  { id: 'chain_boost', type: 'q', cost: 15000, effects: [{ type: 'buildingMult', target: 'chain', value: 2 }, { type: 'buildingMult', target: 'doubt', value: 1.2 }], req: { buildings: { chain: 10 } } },
  { id: 'doubt_spread', type: 'q', cost: 50000, effect: { type: 'buildingMult', target: 'doubt', value: 2 }, req: { buildings: { doubt: 25 } } },
  { id: 'era_speed_2', type: 'q', cost: 50000, effect: { type: 'eraSpeed', value: 2 }, req: { era: 2055 } },
  { id: 'unsolved_value', type: 'q', cost: 100000, effect: { type: 'buildingMult', target: 'unsolved', value: 2 }, req: { buildings: { unsolved: 10 } } },
  { id: 'abyss_echo', type: 'q', cost: 1000000, effect: { type: 'buildingMult', target: 'abyss', value: 2 }, req: { buildings: { abyss: 10 } } },
  { id: 'era_speed_3', type: 'q', cost: 5000000, effect: { type: 'eraSpeed', value: 2 }, req: { era: 2080 } },
  { id: 'storm_current', type: 'q', cost: 10000000, effect: { type: 'buildingMult', target: 'storm', value: 2 }, req: { buildings: { storm: 10 } } },
  // Phase 2 (Answer) - these cost Answer currency!
  { id: 'solver_efficiency', type: 'a', costA: 100, effect: { type: 'buildingMult', target: 'solver', value: 2 }, req: { buildings: { solver: 5 } } },
  { id: 'logic_upgrade', type: 'a', costA: 5000, effect: { type: 'buildingMult', target: 'logic', value: 2 }, req: { buildings: { logic: 5 } } },
  { id: 'truth_reveal', type: 'a', costA: 100000, effect: { type: 'globalAMult', value: 1.5 }, req: { buildings: { truth: 1 } } },
  // 黄金の問い・究極の答えの出現間隔小化アップグレード
  { id: 'golden_sense', type: 'q', cost: 500000, effect: { type: 'goldenIntervalMult', value: 0.7 }, req: { totalQ: 100000 } },
  { id: 'golden_instinct', type: 'q', cost: 50000000, effect: { type: 'goldenIntervalMult', value: 0.5 }, req: { era: 2070 } },
];

// ── Permanent Upgrades (Rebirth Tree) ─────────────────────────
const PERM_UPGRADES_DATA = [
  { id: 'start_q', cost: 1, maxLevel: 5, effect: { type: 'startQ', base: 10000 } },
  { id: 'q_mult_perm', cost: 2, maxLevel: 10, effect: { type: 'globalQMult', mult: 2 } },
  { id: 'a_mult_perm', cost: 3, maxLevel: 10, effect: { type: 'globalAMult', mult: 2 } },
  { id: 'era_accel_perm', cost: 5, maxLevel: 5, effect: { type: 'eraSpeed', mult: 1.5 } },
  { id: 'rebirth_boost', cost: 10, maxLevel: 5, effect: { type: 'rpBoost', mult: 1.5 } },
];

// ── Achievement definitions ──────────────────────────────────
const ACHIEVEMENTS_DATA = [
  { id: 'first_question', check: gs => gs.totalQuestionsEarned >= 1 },
  { id: 'question_1k', check: gs => gs.totalQuestionsEarned >= 1000 },
  { id: 'question_1m', check: gs => gs.totalQuestionsEarned >= 1e6 },
  { id: 'question_1b', check: gs => gs.totalQuestionsEarned >= 1e9 },
  { id: 'question_1t', check: gs => gs.totalQuestionsEarned >= 1e12 },
  { id: 'first_questioner', check: gs => (gs.buildings.questioner || 0) >= 1 },
  { id: 'questioner_100', check: gs => (gs.buildings.questioner || 0) >= 100 },
  { id: 'era_2050', check: gs => gs.era >= 2050 },
  { id: 'era_2100', check: gs => gs.era >= 2100 },
  { id: 'era_3000', check: gs => gs.era >= 3000 },
  { id: 'era_10000', check: gs => gs.era >= 10000 },
  { id: 'qps_1000', check: gs => calcQPS() >= 1000 },
  { id: 'click_1000', check: gs => gs.totalClicks >= 1000 },
  { id: 'rebirth_first', check: gs => gs.rebirthCount >= 1 },
  { id: 'rebirth_5', check: gs => gs.rebirthCount >= 5 },
  { id: 'no_rebirth_2100', check: gs => gs.era >= 2100 && gs.rebirthCount === 0 },
  { id: 'reborn_instant', check: null },
  { id: 'no_rebirth_99999', check: gs => gs.era >= 99999 && gs.rebirthCount === 0 },
  { id: 'era_high_rebirth', check: null },
  { id: 'developer', check: null },
  { id: 'route_q', check: gs => gs.route === 'question' },
  { id: 'route_a', check: gs => gs.route === 'answer' },
  { id: 'first_answer', check: gs => gs.totalAnswersEarned > 0 },
  { id: 'hello_world', check: null },
  {
    id: 'synergy_first',
    check: gs => {
      for (const bd of BUILDINGS_DATA) {
        if (bd.synergyFrom && typeof getBuildingSynergy === 'function') {
          const syn = getBuildingSynergy(bd.id);
          if (syn.active) return true;
        }
      }
      return false;
    }
  },
  {
    id: 'synergy_full',
    check: gs => {
      const qParents = ['questioner', 'doubt', 'chain', 'unsolved', 'abyss', 'storm'];
      return qParents.every(id => (gs.buildings[id] || 0) >= 25);
    }
  },
  // 建物ごとのシナジー実績（上流建物を25個所持でそれぞれ解除）
  { id: 'synergy_q_questioner', check: gs => (gs.buildings.questioner || 0) >= 25 },
  { id: 'synergy_q_doubt',      check: gs => (gs.buildings.doubt      || 0) >= 25 },
  { id: 'synergy_q_chain',      check: gs => (gs.buildings.chain      || 0) >= 25 },
  { id: 'synergy_q_unsolved',   check: gs => (gs.buildings.unsolved   || 0) >= 25 },
  { id: 'synergy_q_abyss',      check: gs => (gs.buildings.abyss     || 0) >= 25 },
  { id: 'synergy_q_storm',      check: gs => (gs.buildings.storm     || 0) >= 25 },
];

const ERA_MESSAGES = [
  [2046, 'era_2046'], [2050, 'era_2050'], [2060, 'era_2060'], [2075, 'era_2075'],
  [2100, 'era_2100'], [2500, 'era_2500'], [3000, 'era_3000'], [5000, 'era_5000'],
  [10000, 'era_10000'], [50000, 'era_50000'], [99999, 'era_99999'],
];
const UNLOCK_MSGS = { abyss: 'unlock_abyss', storm: 'unlock_storm', time_q: 'unlock_time_q' };

// ============================================================
// GAME STATE
// ============================================================
const DEFAULT_STATE = () => ({
  version: VERSION,
  questions: 0,
  totalQuestionsEarned: 0,
  answers: 0,
  totalAnswersEarned: 0,
  totalClicks: 0,
  buildings: {},
  upgrades: {},
  achievements: {},
  era: ERA_START,
  eraDecimal: 0,
  eraSpeedMult: 1,
  clickMult: 1,
  buildingMults: {},
  clickChainProb: 0,
  globalAMult: 1,
  rebirthCount: 0,
  rebirthPoints: 0,
  permUpgrades: {},
  permanentMult: 1,
  lang: null,
  unitMode: 'toki',
  playTime: 0,
  lastTick: Date.now(),
  eraMessagesShown: {},
  rebirthJustDone: false,
  route: null, // null | 'question' | 'answer'
  debugUsed: false,
  goldenIntervalMult: 1,    // 黄金の問い出現間隔の短縮倍率
  qpsBuffActive: false,     // QPSバフ中か
  qpsBuffRemaining: 0,      // バフ残り秒数
  rebirthedAt2060: false,   // 2060年以降で転生した経験があるか
});

let GS = DEFAULT_STATE();
let L = null;
let lastRebirthTime = 0;

// ============================================================
// UI STATE
// ============================================================
let tickCount = 0;
let buyAmount = 1;
let activeLeftTab = 'buildings';
let activeRightTab = 'stats';
let prevEra = ERA_START;
let unlockedBuildings = {};
let routeModalOpen = false;

// ============================================================
// NUMBER FORMATTING
// ============================================================
function fmt(n) {
  if (!isFinite(n) || isNaN(n)) return '∞';
  if (n < 0) return '-' + fmt(-n);
  const mode = GS.unitMode || 'toki';
  const units = L ? L.units[mode] : (mode === 'toki' ? ['天', '地', '人', '和', '駿', '律', '水'] : mode === 'jp' ? ['', '万', '億', '兆'] : ['', 'k', 'M', 'B', 'T']);

  if (mode === 'toki') {
    for (let i = units.length - 1; i >= 0; i--) {
      const threshold = Math.pow(100, i + 1);
      if (n >= threshold) return (n / threshold).toFixed(2) + units[i];
    }
    return Math.floor(n).toString();
  } else if (mode === 'jp') {
    for (let i = units.length - 1; i > 0; i--) {
      const threshold = Math.pow(10000, i);
      if (n >= threshold) return (n / threshold).toFixed(2) + units[i];
    }
    return Math.floor(n).toString();
  } else {
    for (let i = units.length - 1; i > 0; i--) {
      const threshold = Math.pow(1000, i);
      if (n >= threshold) return (n / threshold).toFixed(2) + units[i];
    }
    return Math.floor(n).toString();
  }
}

function fmtDec(n) {
  if (n < 1000 && n % 1 !== 0) {
    return (Math.floor(n * 10) / 10).toFixed(1);
  }
  return fmt(n);
}

function fmtTime(totalSeconds) {
  totalSeconds = Math.floor(totalSeconds);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const lu = L ? L.ui : { hours: 'h', minutes: 'm', seconds: 's' };
  if (h > 0) return `${h}${lu.hours} ${m}${lu.minutes} ${s}${lu.seconds}`;
  if (m > 0) return `${m}${lu.minutes} ${s}${lu.seconds}`;
  return `${s}${lu.seconds}`;
}
function interpolate(template, vars) {
  return template.replace(/\{(\w+)\}/g, (_, k) => vars[k] !== undefined ? vars[k] : '');
}

// ============================================================
// GAME CALCULATIONS
// ============================================================
function getPermMult(type) {
  let mult = 1;
  for (const p of PERM_UPGRADES_DATA) {
    if (p.effect.type === type && GS.permUpgrades[p.id]) {
      mult *= Math.pow(p.effect.mult, GS.permUpgrades[p.id]);
    }
  }
  return mult;
}

function getBuildingSynergy(bdId) {
  const bd = BUILDINGS_DATA.find(b => b.id === bdId);
  if (!bd || !bd.synergyFrom) return { mult: 1, parentName: '', count: 0, bonusPct: 0, active: false };

  if (bd.synergyFrom === 'all_q') {
    let totalQ = 0;
    for (const b of BUILDINGS_DATA) {
      if (b.type === 'q') totalQ += (GS.buildings[b.id] || 0);
    }
    const bonusPct = Math.min(100, Math.floor(totalQ * 0.2 * 10) / 10);
    const mult = 1 + (bonusPct / 100);
    return {
      mult,
      parentName: L?.ui?.allQBuildings || '全Question建物',
      count: totalQ,
      bonusPct,
      active: bonusPct > 0,
      isAllQ: true,
    };
  }

  const parentId = bd.synergyFrom;
  const count = GS.buildings[parentId] || 0;
  const stacks = Math.floor(count / 25);
  // 1スタック目は+5%、2スタック目以降は+1%ずつ加算、最大+15%（10スタック=250個）
  let bonusPct = 0;
  if (stacks >= 1) bonusPct = 5 + Math.min(stacks - 1, 9); // 5%, 6%, 7%,...15%（上限10スタック）
  bonusPct = Math.min(bonusPct, 15);
  const mult = 1 + (bonusPct / 100);
  const parentName = L?.buildings?.[parentId]?.name || parentId;
  return {
    mult,
    parentName,
    count,
    bonusPct,
    active: bonusPct > 0,
    isAllQ: false,
    nextThreshold: stacks < 10 ? (stacks + 1) * 25 : null,
    stacks,
  };
}

function getBuildingMult(id) {
  const base = GS.buildingMults[id] || 1;
  const syn = getBuildingSynergy(id);
  return base * syn.mult;
}

function calcQPS() {
  let qps = 0;
  for (const bd of BUILDINGS_DATA) {
    if (bd.type !== 'q') continue;
    const count = GS.buildings[bd.id] || 0;
    if (count === 0) continue;
    qps += bd.baseQPS * count * getBuildingMult(bd.id);
  }
  let m = GS.permanentMult * getPermMult('globalQMult');
  if (GS.route === 'question') m *= 2; // Question route bonus
  if (GS.route === 'answer') m *= ANSWER_ROUTE_Q_PENALTY; // Answer route penalty
  if (GS.qpsBuffActive) m *= BUFF_QPS_MULT; // √53秒間 QPS×10バフ
  return qps * m;
}

function calcAPS() {
  if (GS.route !== 'answer') return 0;
  let aps = 0;
  for (const bd of BUILDINGS_DATA) {
    if (bd.type !== 'a') continue;
    const count = GS.buildings[bd.id] || 0;
    if (count === 0) continue;
    aps += bd.baseAPS * count * getBuildingMult(bd.id);
  }
  let m = GS.globalAMult * getPermMult('globalAMult');
  if (GS.qpsBuffActive) m *= BUFF_QPS_MULT; // √53秒間 生産×10バフ
  return aps * m;
}

function calcClickPower() {
  let m = GS.clickMult * GS.permanentMult * getPermMult('globalQMult');
  if (GS.route === 'question') m *= 2;
  if (GS.route === 'answer') m *= ANSWER_ROUTE_Q_PENALTY;
  return m;
}

function getBuildingCost(bd, countOverride) {
  const count = countOverride !== undefined ? countOverride : (GS.buildings[bd.id] || 0);
  return Math.ceil(bd.baseCost * Math.pow(bd.costMult, count));
}

// Cookie Clicker方式のバルク購入コスト（等比級数の和の閉じた式）
// C(n, k) = baseCost * r^n * (r^k - 1) / (r - 1)
function getBulkBuildingCost(bd, amount) {
  if (amount <= 0) return 0;
  const n = GS.buildings[bd.id] || 0;
  const r = bd.costMult;
  const total = bd.baseCost * Math.pow(r, n) * (Math.pow(r, amount) - 1) / (r - 1);
  return Math.ceil(total);
}

function isUpgradeVisible(upg) {
  if (GS.upgrades[upg.id]) return 0; // already purchased
  if (upg.type === 'a' && GS.route !== 'answer') return 0; // completely hidden
  const req = upg.req;
  if (!req) return 2; // fully visible
  if (req.totalQ && GS.totalQuestionsEarned < req.totalQ * 0.25) return 0; // hidden until 25% of Q
  if (req.era && GS.era < req.era - 10) return 0; // hidden until 10 years before

  if (req.totalQ && GS.totalQuestionsEarned < req.totalQ * 0.75) return 1; // shadow until 75%
  if (req.era && GS.era < req.era - 2) return 1; // shadow until 2 years before

  return 2; // fully visible
}

function isUpgradeAvailable(upg) {
  if (GS.upgrades[upg.id]) return false;
  if (upg.type === 'a' && GS.route !== 'answer') return false;
  const req = upg.req;
  if (!req) return true;
  if (req.totalQ && GS.totalQuestionsEarned < req.totalQ) return false;
  if (req.era && GS.era < req.era) return false;
  if (req.buildings) {
    for (const [bid, cnt] of Object.entries(req.buildings)) {
      if ((GS.buildings[bid] || 0) < cnt) return false;
    }
  }
  return true;
}

function isBuildingVisible(bd) {
  if (bd.type === 'a' && GS.route !== 'answer') return false;
  if (!bd.unlockEra) return true;
  return GS.era >= bd.unlockEra - 5;
}
function isBuildingUnlocked(bd) {
  if (bd.type === 'a' && GS.route !== 'answer') return false;
  if (!bd.unlockEra) return true;
  return GS.era >= bd.unlockEra;
}

function calcRebirthPoints() {
  const eraYears = GS.era - ERA_START;
  const qBonus = Math.floor(Math.log10(Math.max(1, GS.totalQuestionsEarned)));
  let base = Math.max(1, Math.floor(eraYears * 0.5 + qBonus));
  if (GS.totalAnswersEarned > 0) {
    base += Math.floor(Math.log10(Math.max(1, GS.totalAnswersEarned)) * 5);
  }
  return Math.floor(base * getPermMult('rpBoost'));
}

// ============================================================
// GAME ACTIONS
// ============================================================
function clickQuestion(event) {
  if (routeModalOpen) return;
  const base = calcClickPower();
  let amount = base;
  let isChain = false;

  if (GS.clickChainProb > 0 && Math.random() < GS.clickChainProb) {
    amount *= 3;
    isChain = true;
  }

  GS.questions += amount;
  GS.totalQuestionsEarned += amount;
  GS.totalClicks += 1;

  if (event) spawnFloatingNumber(event.clientX, event.clientY, amount, isChain);
  const qc = document.getElementById('question-count');
  if (qc) { qc.classList.add('pulse'); setTimeout(() => qc.classList.remove('pulse'), 80); }

  if (isChain) addMessage(L.messages.chain_proc, 'chain');

  checkAchievements();
}

function buyBuilding(bd) {
  if (!isBuildingUnlocked(bd)) return;
  const amount = buyAmount;
  const cost = getBulkBuildingCost(bd, amount);
  if (GS.questions < cost) {
    showToast(L.ui.notEnoughQ || 'Not enough Questions', 'warning');
    return;
  }
  GS.questions -= cost;
  GS.buildings[bd.id] = (GS.buildings[bd.id] || 0) + amount;

  const count = GS.buildings[bd.id];
  addMessage(interpolate(L.messages.buy_building, { name: L.buildings[bd.id].name, count }), 'buy');
  checkAchievements();
  renderBuildings();
}

function buyUpgrade(upg) {
  if (!isUpgradeAvailable(upg)) return;
  if (upg.cost && GS.questions < upg.cost) {
    showToast(L.ui.notEnoughQ || 'Not enough Questions', 'warning');
    return;
  }
  if (upg.costA && GS.answers < upg.costA) {
    showToast(L.ui.notEnoughA || 'Not enough Answers', 'warning');
    return;
  }

  if (upg.cost) GS.questions -= upg.cost;
  if (upg.costA) GS.answers -= upg.costA;

  GS.upgrades[upg.id] = true;
  applyUpgradeEffect(upg);
  addMessage(interpolate(L.messages.buy_upgrade, { name: L.upgrades[upg.id].name }), 'buy');
  checkAchievements();
  renderUpgrades();
}

function buyPermUpgrade(id) {
  const p = PERM_UPGRADES_DATA.find(x => x.id === id);
  if (!p) return;
  const lvl = GS.permUpgrades[id] || 0;
  if (lvl >= p.maxLevel) return;

  // Cost scaling: baseCost * (lvl + 1)
  const cost = p.cost * (lvl + 1);
  if (GS.rebirthPoints < cost) {
    showToast(L.ui.notEnoughRP || 'Not enough Rebirth Points', 'warning');
    return;
  }

  GS.rebirthPoints -= cost;
  GS.permUpgrades[id] = lvl + 1;
  addMessage(interpolate(L.messages.buy_perm, { name: L.perm_upgrades[id].name }), 'meta');
  renderPermUpgrades();
  renderStats();
}

function applyUpgradeEffect(upg) {
  const effects = upg.effects || (upg.effect ? [upg.effect] : []);
  for (const e of effects) {
    switch (e.type) {
      case 'clickMult': GS.clickMult *= e.value; break;
      case 'buildingMult': GS.buildingMults[e.target] = (GS.buildingMults[e.target] || 1) * e.value; break;
      case 'eraSpeed': GS.eraSpeedMult *= e.value; break;
      case 'clickChain': GS.clickChainProb = Math.min(0.9, GS.clickChainProb + e.value); break;
      case 'globalAMult': GS.globalAMult *= e.value; break;
      case 'goldenIntervalMult': GS.goldenIntervalMult *= e.value; break;
    }
  }
}

function reapplyAllUpgrades() {
  GS.clickMult = 1;
  GS.buildingMults = {};
  GS.eraSpeedMult = 1;
  GS.clickChainProb = 0;
  GS.globalAMult = 1;
  GS.goldenIntervalMult = 1;
  for (const upg of UPGRADES_DATA) {
    if (GS.upgrades[upg.id]) applyUpgradeEffect(upg);
  }
}

function doRebirth() {
  const now = Date.now();
  if (lastRebirthTime > 0 && (now - lastRebirthTime) < 10000) {
    unlockAchievement('reborn_instant');
  }
  lastRebirthTime = now;

  const points = calcRebirthPoints();
  const highEra = GS.era;

  GS.rebirthPoints += points;
  GS.permanentMult *= (1 + points * 0.05);
  GS.rebirthCount += 1;

  if (highEra >= ULTIMATE_REBIRTH_ERA) {
    GS.rebirthedAt2060 = true;
  }

  if (highEra >= 9000) unlockAchievement('era_high_rebirth');

  GS.questions = 0;
  GS.totalQuestionsEarned = 0;
  GS.answers = 0;
  GS.totalAnswersEarned = 0;
  GS.totalClicks = 0;
  GS.buildings = {};
  GS.upgrades = {};
  GS.era = ERA_START;
  GS.eraDecimal = 0;
  GS.eraMessagesShown = {};
  GS.rebirthJustDone = false;
  GS.route = null;

  // Apply start_q perm upgrade
  let sq = 0;
  for (const p of PERM_UPGRADES_DATA) {
    if (p.effect.type === 'startQ' && GS.permUpgrades[p.id]) {
      sq += p.effect.base * GS.permUpgrades[p.id];
    }
  }
  if (sq > 0) {
    GS.questions += sq;
    GS.totalQuestionsEarned += sq;
  }

  reapplyAllUpgrades();
  clearSpecialOnRebirth();

  addMessage(L.messages.did_rebirth, 'era');
  checkAchievements();
  prevEra = ERA_START;
  unlockedBuildings = {};

  renderAll();
  saveToLocalStorage();
}

function chooseRoute(route) {
  GS.route = route;
  routeModalOpen = false;
  closeModal('route-modal');
  addMessage(L.messages[route === 'question' ? 'route_q_msg' : 'route_a_msg'], 'meta');
  checkAchievements();
  renderAll();
}

// ============================================================
// SPECIAL CLICK OBJECTS (黄金の問い / 究極の答え)
// ============================================================
let goldenNextSpawnTimer = 0;   // 次のスポーンまでのカウントダウン（秒）
let goldenInitialized = false;  // 初回タイマー設定済みか
let activeSpecialBtn = null;    // 現在画面にある特殊ボタン要素
let activeSpecialTimeout = null;

// 現在の出現間隔（秒）を計算（アップグレードで短縮される）
function getGoldenInterval() {
  const base = GOLDEN_Q_APPEAR_SECS_MIN +
    Math.random() * (GOLDEN_Q_APPEAR_SECS_MAX - GOLDEN_Q_APPEAR_SECS_MIN);
  return base * GS.goldenIntervalMult;
}

// 究極の答えが出現可能か判定
// 1. Questionルート中は出現不可（黄金の問いのみ）
// 2. 東暦2050年以降、または2060年以降に転生した経験があれば出現可能
function canSpawnUltimate() {
  if (GS.route === 'question') return false;
  return GS.era >= ULTIMATE_APPEAR_MIN_ERA || GS.rebirthedAt2060 === true;
}

// どちらのタイプを出すか決定
function pickSpecialType() {
  // 究極の答えの出現条件を満たしていない場合は黄金の問いのみ
  if (!canSpawnUltimate()) return 'golden';
  return Math.random() < 0.5 ? 'golden' : 'ultimate';
}

function spawnSpecialBtn() {
  if (activeSpecialBtn) return; // 既に表示中なら無視

  const type = pickSpecialType();
  const lifetime = type === 'golden' ? GOLDEN_Q_LIFETIME : ULTIMATE_A_LIFETIME;

  const btn = document.createElement('button');
  btn.className = `special-click-btn type-${type}`;
  btn.style.setProperty('--sp-duration', `${lifetime}s`);

  // ランダム位置（中央エリアを避けて端の方）
  const margin = 90;
  const maxX = window.innerWidth - margin * 2;
  const maxY = window.innerHeight - margin * 2;
  // 左か右か上か下のエリアにランダム配置
  let x, y;
  const side = Math.floor(Math.random() * 4);
  if (side === 0) { // 上
    x = margin + Math.random() * maxX;
    y = margin * 0.5 + Math.random() * (window.innerHeight * 0.25);
  } else if (side === 1) { // 右
    x = window.innerWidth * 0.7 + Math.random() * (window.innerWidth * 0.25);
    y = margin + Math.random() * maxY;
  } else if (side === 2) { // 下
    x = margin + Math.random() * maxX;
    y = window.innerHeight * 0.7 + Math.random() * (window.innerHeight * 0.25);
  } else { // 左
    x = margin * 0.5 + Math.random() * (window.innerWidth * 0.15);
    y = margin + Math.random() * maxY;
  }
  btn.style.left = `${Math.max(10, Math.min(window.innerWidth - 90, x))}px`;
  btn.style.top = `${Math.max(60, Math.min(window.innerHeight - 90, y))}px`;

  const labelKey = type === 'golden' ? 'goldenQLabel' : 'ultimateALabel';
  btn.innerHTML = `
    <span class="sp-emoji">${type === 'golden' ? '✨' : '💫'}</span>
    <span class="sp-label">${L.ui[labelKey] || (type === 'golden' ? '黄金の問い' : '究極の答え')}</span>
  `;

  btn.addEventListener('click', () => onSpecialBtnClick(type, btn));
  document.body.appendChild(btn);
  activeSpecialBtn = btn;

  // 時間切れで自動消去
  activeSpecialTimeout = setTimeout(() => removeSpecialBtn(), lifetime * 1000);
}

function removeSpecialBtn() {
  clearTimeout(activeSpecialTimeout);
  activeSpecialTimeout = null;
  if (activeSpecialBtn) {
    activeSpecialBtn.remove();
    activeSpecialBtn = null;
  }
  // 次のスポーンタイマーをセット
  goldenNextSpawnTimer = getGoldenInterval();
}

function onSpecialBtnClick(type, btn) {
  removeSpecialBtn();

  if (type === 'golden') {
    applyGoldenEffect();
  } else {
    applyUltimateEffect();
  }
}

function applyGoldenEffect() {
  // 50/50でQPS×乱数(1-10)一括付与 か √53秒QPS×10バフ
  if (Math.random() < 0.5) {
    // 一括付与
    const mult = 1 + Math.floor(Math.random() * 10); // 1〜10
    const qps = calcQPS();
    const bonus = qps * mult;
    GS.questions += bonus;
    GS.totalQuestionsEarned += bonus;
    const label = L.ui.goldenGranted || `黄金の問い：${mult}秒分のQPSを一括獲得！ (+{bonus})`;
    addMessage(interpolate(label, { mult: mult, bonus: fmt(bonus) }), 'chain');
    spawnFloatingNumber(
      window.innerWidth / 2,
      window.innerHeight / 2,
      bonus,
      true
    );
    checkAchievements();
  } else {
    // QPSバフ
    startQpsBuff();
    addMessage(L.ui.goldenBuffed || `黄金の問い：√53秒間 QPS×${BUFF_QPS_MULT}！`, 'chain');
  }
}

function applyUltimateEffect() {
  if (GS.route !== 'answer') {
    // 分岐前 or Questionルート：Question-10%
    const loss = GS.questions * 0.1;
    GS.questions = Math.max(0, GS.questions - loss);
    addMessage(interpolate(L.ui.ultimatePenalty || '究極の答え：Questionが-10%失われた。', { loss: fmt(loss) }), 'warning');
  } else {
    // Answerルート：黄金の問いと同等効果（Answer通貨版）
    if (Math.random() < 0.5) {
      const mult = 1 + Math.floor(Math.random() * 10);
      const aps = calcAPS();
      const bonus = aps * mult;
      GS.answers += bonus;
      GS.totalAnswersEarned += bonus;
      const label = L.ui.ultimateGranted || `究極の答え：${mult}秒分のAPSを一括獲得！ (+{bonus})`;
      addMessage(interpolate(label, { mult: mult, bonus: fmt(bonus) }), 'chain');
      spawnFloatingNumber(
        window.innerWidth / 2,
        window.innerHeight / 2,
        bonus,
        true
      );
      checkAchievements();
    } else {
      startQpsBuff();
      addMessage(L.ui.goldenBuffed || `究極の答え：√53秒間 QPS×${BUFF_QPS_MULT}！`, 'chain');
    }
  }
}

function startQpsBuff() {
  GS.qpsBuffActive = true;
  GS.qpsBuffRemaining = BUFF_DURATION;
  const bar = document.getElementById('qps-buff-bar');
  if (bar) bar.classList.add('active');
}

function tickQpsBuff(dt) {
  if (!GS.qpsBuffActive) return;
  GS.qpsBuffRemaining -= dt;
  if (GS.qpsBuffRemaining <= 0) {
    GS.qpsBuffActive = false;
    GS.qpsBuffRemaining = 0;
    const bar = document.getElementById('qps-buff-bar');
    if (bar) bar.classList.remove('active');
  }
  // バフバーのUI更新
  const fill = document.getElementById('qps-buff-fill');
  const bar = document.getElementById('qps-buff-bar');
  if (fill) {
    const pct = Math.max(0, (GS.qpsBuffRemaining / BUFF_DURATION) * 100);
    fill.style.width = pct + '%';
  }
  if (bar) {
    const label = bar.querySelector('.buff-label');
    if (label) label.textContent = `QPS×${BUFF_QPS_MULT} (${GS.qpsBuffRemaining.toFixed(1)}s)`;
  }
}

function tickGoldenSpawn(dt) {
  if (!goldenInitialized) {
    goldenNextSpawnTimer = getGoldenInterval();
    goldenInitialized = true;
  }
  if (activeSpecialBtn) return; // 表示中はカウントしない
  goldenNextSpawnTimer -= dt;
  if (goldenNextSpawnTimer <= 0) {
    spawnSpecialBtn();
  }
}

function clearSpecialOnRebirth() {
  removeSpecialBtn();
  GS.qpsBuffActive = false;
  GS.qpsBuffRemaining = 0;
  goldenInitialized = false;
  const bar = document.getElementById('qps-buff-bar');
  if (bar) bar.classList.remove('active');
}



// ============================================================
// ERA PROGRESSION
// ============================================================
function progressEra(dt) {
  if (routeModalOpen) return; // Pause time during route choice

  if (GS.era >= ROUTE_SPLIT_ERA && GS.route === null) {
    routeModalOpen = true;
    populateRouteModal();
    openModal('route-modal');
    return;
  }

  const yearsPerSec = (GS.eraSpeedMult * getPermMult('eraSpeed')) / ERA_SECS_BASE;
  GS.eraDecimal += yearsPerSec * dt;

  if (GS.eraDecimal >= 1) {
    const yearsAdded = Math.floor(GS.eraDecimal);
    GS.era += yearsAdded;
    GS.eraDecimal -= yearsAdded;
    if (GS.era > 99999) { GS.era = 99999; GS.eraDecimal = 0; }
  }

  for (const [threshold, msgKey] of ERA_MESSAGES) {
    if (GS.era >= threshold && !GS.eraMessagesShown[msgKey]) {
      GS.eraMessagesShown[msgKey] = true;
      addMessage(L.messages[msgKey] || '', 'era');
    }
  }

  for (const bd of BUILDINGS_DATA) {
    if (bd.unlockEra && GS.era >= bd.unlockEra && !unlockedBuildings[bd.id] && isBuildingUnlocked(bd)) {
      unlockedBuildings[bd.id] = true;
      const msgKey = UNLOCK_MSGS[bd.id];
      if (msgKey) addMessage(L.messages[msgKey] || '', 'era');
      renderBuildings();
    }
  }

  if (GS.era >= REBIRTH_MIN_ERA && !GS.eraMessagesShown['can_rebirth_shown']) {
    GS.eraMessagesShown['can_rebirth_shown'] = true;
    addMessage(L.messages.can_rebirth, 'warning');
  }
}

// ============================================================
// ACHIEVEMENTS & MESSAGES
// ============================================================
function unlockAchievement(id) {
  if (GS.achievements[id]) return;
  const def = ACHIEVEMENTS_DATA.find(a => a.id === id);
  if (!def) return;
  GS.achievements[id] = true;
  const achL = L.achievements[id];
  if (achL) {
    showAchievementNotif(achL.name);
    addMessage(`🏆 ${L.ui.achievUnlocked} "${achL.name}"`, 'achieve');
  }
  renderAchievements();
}
function checkAchievements() {
  for (const def of ACHIEVEMENTS_DATA) {
    if (!def.check || GS.achievements[def.id]) continue;
    if (def.check(GS)) unlockAchievement(def.id);
  }
}
const messageLog = [];
function addMessage(text, type = 'normal') {
  if (!text) return;
  messageLog.unshift({ text, type, id: Date.now() + Math.random() });
  if (messageLog.length > MSG_MAX) messageLog.length = MSG_MAX;
  renderMessages();
}
function renderMessages() {
  const el = document.getElementById('message-log');
  if (!el) return;
  el.innerHTML = messageLog.slice(0, 20).map(m => `<div class="message-item ${m.type}">${escHtml(m.text)}</div>`).join('');
}

// ============================================================
// SAVE / LOAD
// ============================================================
const SAVE_KEYS = [
  'version', 'questions', 'totalQuestionsEarned', 'answers', 'totalAnswersEarned', 'totalClicks',
  'buildings', 'upgrades', 'achievements', 'era', 'eraDecimal',
  'eraSpeedMult', 'clickMult', 'buildingMults', 'clickChainProb', 'globalAMult',
  'rebirthCount', 'rebirthPoints', 'permUpgrades', 'permanentMult',
  'lang', 'unitMode', 'playTime', 'eraMessagesShown', 'rebirthJustDone', 'route',
  'debugUsed', 'rebirthedAt2060',
];

function buildSaveObj() {
  const obj = {};
  for (const k of SAVE_KEYS) obj[k] = GS[k];
  return obj;
}
const SAVE_KEY_TYPES = {
  version: 'string', questions: 'number', totalQuestionsEarned: 'number',
  answers: 'number', totalAnswersEarned: 'number', totalClicks: 'number',
  buildings: 'object', upgrades: 'object', achievements: 'object',
  era: 'number', eraDecimal: 'number', eraSpeedMult: 'number',
  clickMult: 'number', buildingMults: 'object', clickChainProb: 'number',
  globalAMult: 'number', rebirthCount: 'number', rebirthPoints: 'number',
  permUpgrades: 'object', permanentMult: 'number', lang: 'string',
  unitMode: 'string', playTime: 'number', eraMessagesShown: 'object',
  rebirthJustDone: 'boolean', route: 'route', debugUsed: 'boolean',
  rebirthedAt2060: 'boolean',
};

function isValidSaveValue(k, v) {
  const expected = SAVE_KEY_TYPES[k];
  if (v === null) return expected === 'route'; // route may legitimately be null
  if (expected === 'object') {
    if (typeof v !== 'object' || Array.isArray(v)) return false;
    for (const subKey in v) {
      const subVal = v[subKey];
      if (typeof subVal === 'number' && (!isFinite(subVal) || subVal < 0 || subVal > 1e308)) {
        return false;
      }
    }
    return true;
  }
  if (expected === 'route') return v === 'question' || v === 'answer';
  if (expected === 'number') return typeof v === 'number' && isFinite(v) && v >= 0 && v <= 1e308;
  return typeof v === expected;
}

function applyLoadObj(obj) {
  if (!obj || typeof obj !== 'object') return;
  for (const k of SAVE_KEYS) {
    if (obj[k] === undefined) continue;
    if (!isValidSaveValue(k, obj[k])) continue;
    GS[k] = obj[k];
  }
}
function toBase64(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}
function fromBase64(b64) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

function saveToLocalStorage() {
  try { localStorage.setItem('toki_clicker_save', toBase64(JSON.stringify(buildSaveObj()))); } catch (e) { }
}
function loadFromLocalStorage() {
  try {
    const raw = localStorage.getItem('toki_clicker_save');
    if (!raw) return false;
    applyLoadObj(JSON.parse(fromBase64(raw)));
    reapplyAllUpgrades();
    return true;
  } catch (e) { return false; }
}
function exportSaveTxt() {
  const blob = new Blob([toBase64(JSON.stringify(buildSaveObj()))], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `toki-clicker-${Date.now()}.txt`; a.click();
  URL.revokeObjectURL(url);
  showToast(L.ui.saveSuccess, 'success');
}
function importSaveTxt(file) {
  const reader = new FileReader();
  reader.onload = e => {
    try {
      applyLoadObj(JSON.parse(fromBase64(e.target.result.trim())));
      reapplyAllUpgrades();
      showToast(L.ui.importSuccess, 'success');
      renderAll();
    } catch (err) { showToast(L.ui.importFail, 'warning'); }
  };
  reader.readAsText(file);
}
function resetSave() {
  localStorage.removeItem('toki_clicker_save');
  GS = DEFAULT_STATE(); GS.lang = L.meta.code;
  messageLog.length = 0; prevEra = ERA_START; unlockedBuildings = {};
  addMessage(L.messages.welcome, 'era'); renderAll();
}

// ============================================================
// UI — RENDERING
// ============================================================
function escHtml(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

function renderHeader() {
  const eraEl = document.getElementById('era-display');
  const barEl = document.getElementById('era-progress-bar');
  const titleEl = document.getElementById('header-title');
  const routeInd = document.getElementById('route-indicator');

  if (titleEl) titleEl.textContent = L.ui.title;
  if (eraEl) eraEl.textContent = `${L.ui.era} ${GS.era}${L.ui.eraYear}`;
  if (barEl) barEl.style.width = (GS.eraDecimal * 100).toFixed(1) + '%';

  if (routeInd) {
    if (GS.route) {
      routeInd.className = GS.route;
      routeInd.textContent = GS.route === 'question' ? L.ui.routeQIndicator : L.ui.routeAIndicator;
      routeInd.classList.add('show');
    } else {
      routeInd.classList.remove('show');
    }
  }
}

function renderCenter() {
  const qcEl = document.getElementById('question-count');
  const qlEl = document.getElementById('question-label');
  const qpsEl = document.getElementById('qps-display');
  const cpEl = document.getElementById('click-power-display');

  const divEl = document.getElementById('q-a-divider');
  const aBox = document.getElementById('answer-display');
  const acEl = document.getElementById('answer-count');
  const alEl = document.getElementById('answer-label');
  const apsEl = document.getElementById('aps-display');
  const cycEl = document.getElementById('cycle-display');

  if (qcEl) qcEl.textContent = fmt(GS.questions);
  if (qlEl) qlEl.textContent = L.ui.question;
  if (qpsEl) qpsEl.textContent = `${fmtDec(calcQPS())} ${L.ui.qps}`;
  if (cpEl) cpEl.textContent = `Click: +${fmt(calcClickPower())}`;

  if (GS.route === 'answer' || GS.answers > 0) {
    if (divEl) divEl.style.display = 'block';
    if (aBox) aBox.classList.remove('hidden');
    if (acEl) acEl.textContent = fmt(GS.answers);
    if (alEl) alEl.textContent = L.ui.answer;
    if (apsEl) apsEl.textContent = `${fmtDec(calcAPS())} ${L.ui.aps}`;
    if (cycEl) cycEl.textContent = `${L.ui.cycleLabel}`;
  } else {
    if (divEl) divEl.style.display = 'none';
    if (aBox) aBox.classList.add('hidden');
  }
}

function renderBuildings() {
  const el = document.getElementById('buildings-tab');
  if (!el) return;

  if (!el.querySelector('.buy-amount-row') || el.dataset.lang !== GS.lang) {
    el.dataset.lang = GS.lang;
    el.innerHTML = `
      <div class="buy-amount-row">
        <button class="buy-amount-btn" data-amt="1" onclick="setBuyAmount(1)">${L.ui.buy1}</button>
        <button class="buy-amount-btn" data-amt="10" onclick="setBuyAmount(10)">${L.ui.buy10}</button>
        <button class="buy-amount-btn" data-amt="100" onclick="setBuyAmount(100)">${L.ui.buy100}</button>
      </div>
      <div id="buildings-list"></div>
    `;
  }

  el.querySelectorAll('.buy-amount-btn').forEach(btn => {
    btn.classList.toggle('active', parseInt(btn.dataset.amt) === buyAmount);
  });

  const listEl = document.getElementById('buildings-list');
  const existingCards = new Map();
  Array.from(listEl.children).forEach(child => {
    const id = child.dataset.bdId || child.dataset.secId;
    if (id) existingCards.set(id, child);
  });

  let currentIdx = 0;
  let lastType = '';

  for (const bd of BUILDINGS_DATA) {
    if (!isBuildingVisible(bd)) continue;

    if (bd.type !== lastType) {
      const secId = `sec-${bd.type}`;
      let secEl = existingCards.get(secId);
      if (!secEl) {
        secEl = document.createElement('div');
        secEl.className = 'shop-section-label';
        secEl.dataset.secId = secId;
        secEl.textContent = bd.type === 'q' ? L.ui.question : L.ui.answer;
        listEl.appendChild(secEl);
      } else {
        if (listEl.children[currentIdx] !== secEl) listEl.insertBefore(secEl, listEl.children[currentIdx]);
        existingCards.delete(secId);
      }
      currentIdx++;
      lastType = bd.type;
    }

    const unlocked = isBuildingUnlocked(bd);
    const id = unlocked ? bd.id : `locked-${bd.id}`;
    let card = existingCards.get(id);

    if (!card) {
      card = document.createElement('div');
      card.dataset.bdId = id;
      listEl.appendChild(card);
    } else {
      if (listEl.children[currentIdx] !== card) listEl.insertBefore(card, listEl.children[currentIdx]);
      existingCards.delete(id);
    }
    currentIdx++;

    const bLang = L.buildings[bd.id];

    if (!unlocked) {
      if (card.className !== 'building-locked') {
        card.className = 'building-locked';
        card.innerHTML = `🔒 ${escHtml(bLang.name)} — ${L.ui.locked}`;
      }
    } else {
      const count = GS.buildings[bd.id] || 0;
      const cost = getBulkBuildingCost(bd, buyAmount);
      const canAfford = GS.questions >= cost;
      const bMult = getBuildingMult(bd.id);
      const rate = bd.type === 'q' ? (bd.baseQPS * Math.max(1, buyAmount) * bMult) : (bd.baseAPS * Math.max(1, buyAmount) * bMult);
      const rateStr = bd.type === 'q' ? `+${rate.toFixed(1)} ${L.ui.qps}` : `+${rate.toFixed(1)} ${L.ui.aps}`;
      const cardClass = bd.type === 'a' ? 'answer-building' : '';
      const newClass = `building-card${cardClass ? ' ' + cardClass : ''}${!canAfford ? ' disabled' : ''}${canAfford ? ' affordable' : ''}`;

      if (card.className !== newClass) card.className = newClass;

      const costStr = `${L.ui.cost}(Q): ${fmt(cost)}`;

      if (!card.hasAttribute('data-init') || card.dataset.amt !== String(buyAmount)) {
        card.setAttribute('onclick', `onBuildingClick('${bd.id}')`);
        card.setAttribute('onmousemove', `showTooltip(event, 'building', '${bd.id}')`);
        card.setAttribute('onmouseleave', 'hideTooltip()');
        card.innerHTML = `
          <div class="b-emoji">${bd.emoji}</div>
          <div class="b-name">${escHtml(bLang.name)}</div>
          <div class="b-count">${count}</div>
          <div class="b-cost">${costStr}</div>
          <div class="b-rate">${rateStr}</div>
        `;
        card.setAttribute('data-init', 'true');
        card.dataset.amt = buyAmount;
      } else {
        const countEl = card.querySelector('.b-count');
        const costEl = card.querySelector('.b-cost');
        const rateEl = card.querySelector('.b-rate');
        if (countEl && countEl.textContent !== String(count)) countEl.textContent = count;
        if (costEl && costEl.textContent !== costStr) costEl.textContent = costStr;
        if (rateEl && rateEl.textContent !== rateStr) rateEl.textContent = rateStr;
      }
    }
  }

  existingCards.forEach(c => c.remove());
}

function renderUpgrades() {
  const el = document.getElementById('upgrades-tab');
  if (!el) return;

  if (el.dataset.lang !== GS.lang) {
    el.dataset.lang = GS.lang;
    el.innerHTML = '';
  }

  const visItems = [];
  for (const upg of UPGRADES_DATA) {
    const vis = isUpgradeVisible(upg);
    if (vis === 0) continue;
    visItems.push({ upg, vis });
  }

  if (visItems.length === 0) {
    el.innerHTML = `<div class="building-locked" style="text-align:center;padding:20px">...</div>`;
    return;
  }

  const lockedMsg = el.querySelector('.building-locked');
  if (lockedMsg) lockedMsg.remove();

  const existingCards = new Map();
  Array.from(el.querySelectorAll('.upgrade-card')).forEach(card => {
    const id = card.dataset.upgId;
    if (id) existingCards.set(id, card);
  });

  let currentIdx = 0;
  visItems.forEach(({ upg, vis }) => {
    const id = (vis === 1) ? `shadow-${upg.id}` : upg.id;
    let card = existingCards.get(id);

    if (!card) {
      card = document.createElement('div');
      card.dataset.upgId = id;
      card.className = 'upgrade-card';
      el.appendChild(card);
    } else {
      if (el.children[currentIdx] !== card) {
        el.insertBefore(card, el.children[currentIdx]);
      }
      existingCards.delete(id);
    }

    currentIdx++;

    const purchased = GS.upgrades[upg.id];
    const canAfford = upg.costA ? (GS.answers >= upg.costA) : (GS.questions >= upg.cost);

    if (vis === 1) {
      const targetClass = 'upgrade-card shadow';
      if (card.className !== targetClass) card.className = targetClass;
      if (!card.hasAttribute('data-init')) {
        card.removeAttribute('onclick');
        card.removeAttribute('onmouseenter');
        card.removeAttribute('onmousemove');
        card.removeAttribute('onmouseleave');
        card.innerHTML = `<div class="u-name">???</div><div class="u-desc">...</div><div class="u-cost">???</div>`;
        card.setAttribute('data-init', 'true');
      }
    } else {
      const uLang = L.upgrades[upg.id];
      const cardClass = upg.type === 'a' ? 'answer-upg' : '';
      const costStr = upg.costA ? `${L.ui.cost}(A): ${fmt(upg.costA)}` : `${L.ui.cost}(Q): ${fmt(upg.cost)}`;
      const isDisabled = !purchased && !canAfford;
      const isAffordable = !purchased && canAfford;

      const newClass = `upgrade-card${cardClass ? ' ' + cardClass : ''}${isDisabled ? ' disabled' : ''}${isAffordable ? ' affordable' : ''}`;
      if (card.className !== newClass) card.className = newClass;

      if (!card.hasAttribute('data-init')) {
        card.setAttribute('onclick', `onUpgradeClick('${upg.id}')`);
        card.setAttribute('onmousemove', `showTooltip(event, 'upgrade', '${upg.id}')`);
        card.setAttribute('onmouseleave', 'hideTooltip()');
        card.innerHTML = `
          <div class="u-name">${escHtml(uLang.name)}</div>
          <div class="u-desc">${escHtml(uLang.desc)}</div>
          <div class="u-cost">${costStr}</div>`;
        card.setAttribute('data-init', 'true');
      } else {
        const costEl = card.querySelector('.u-cost');
        if (purchased) {
          if (costEl) costEl.remove();
        } else {
          if (costEl) {
            if (costEl.textContent !== costStr) costEl.textContent = costStr;
          } else {
            const d = document.createElement('div');
            d.className = 'u-cost';
            d.textContent = costStr;
            card.appendChild(d);
          }
        }
      }
    }
  });

  existingCards.forEach(card => card.remove());
}

function renderPermUpgrades() {
  const el = document.getElementById('perm-list');
  const msgEl = document.getElementById('perm-locked-msg');
  const rpEl = document.getElementById('rp-display');
  if (!el || !msgEl || !rpEl) return;

  rpEl.textContent = `${fmt(GS.rebirthPoints)} RP`;

  if (GS.rebirthCount === 0) {
    msgEl.innerHTML = L.ui.lockedPerm.replace('\n', '<br>');
    msgEl.style.display = 'block';
    el.innerHTML = '';
    return;
  }
  msgEl.style.display = 'none';

  let html = '';
  for (const p of PERM_UPGRADES_DATA) {
    const lvl = GS.permUpgrades[p.id] || 0;
    const cost = p.cost * (lvl + 1);
    const canAfford = GS.rebirthPoints >= cost;
    const isMax = lvl >= p.maxLevel;
    const pLang = L.perm_upgrades[p.id];

    html += `<div class="perm-card ${isMax ? 'purchased' : ''} ${!isMax && !canAfford ? 'disabled' : ''}" onclick="buyPermUpgrade('${p.id}')">
      <div class="p-name">${escHtml(pLang.name)} (Lv.${lvl}/${p.maxLevel})</div>
      <div class="p-desc">${escHtml(pLang.desc)}</div>
      ${!isMax ? `<div class="p-cost">${L.ui.cost}: <span class="rp">${fmt(cost)} RP</span></div>` : '<div class="p-cost" style="color:var(--text-muted)">MAX</div>'}
    </div>`;
  }
  el.innerHTML = html;
}

function renderStats() {
  const el = document.getElementById('stats-tab');
  if (!el) return;
  const rows = [
    [L.ui.currentEra, `${L.ui.era} ${GS.era}${L.ui.eraYear}`, false],
    [L.ui.qpsLabel, `${fmtDec(calcQPS())}`, false],
    [L.ui.clickPowerLabel, `${fmt(calcClickPower())}`, false],
    [L.ui.totalQ, `${fmt(GS.totalQuestionsEarned)}`, false],
    [L.ui.totalClicks, `${GS.totalClicks}`, false],
    [L.ui.playTime, fmtTime(GS.playTime)],
    [L.ui.rebirthCount, `${GS.rebirthCount}`, false],
    [L.ui.permMult, `×${GS.permanentMult.toFixed(2)}`, false],
  ];
  if (GS.debugUsed) {
    rows.push([L.ui.debugStatus || 'デバッグ履歴', `⚠ ${L.ui.debugUsedLabel || '使用あり'}`, true]);
  }
  el.innerHTML = `<div class="stats-grid">${rows.map(([l, v, warn]) => `<div class="stat-row ${warn ? 'stat-warn' : ''}"><span class="stat-label">${escHtml(l)}</span><span class="stat-value">${escHtml(v)}</span></div>`).join('')}</div>`;
}

function renderAchievements() {
  const el = document.getElementById('achievements-tab');
  if (!el) return;
  let html = '<div class="achieve-grid">';
  let any = false;
  for (const def of ACHIEVEMENTS_DATA) {
    const unlocked = !!GS.achievements[def.id];
    const aLang = L.achievements[def.id];
    if (!aLang) continue;
    if (aLang.hidden && !unlocked) continue;
    any = true;
    html += `<div class="achieve-card ${unlocked ? 'unlocked' : 'locked'}"
      onmousemove="showTooltip(event, 'achievement', '${def.id}')"
      onmouseleave="hideTooltip()">
      <div class="achieve-name">${unlocked ? '🏆 ' : ''}${escHtml(unlocked ? aLang.name : L.ui.locked)}</div>
      ${unlocked ? `<div class="achieve-desc">${escHtml(aLang.desc)}</div>` : ''}
    </div>`;
  }
  if (!any) html += `<div style="color:var(--text-muted);text-align:center;padding:20px;font-size:.8rem">${L.ui.noAchiev}</div>`;
  html += '</div>';
  el.innerHTML = html;
}

function renderRebirthSection() {
  const btn = document.getElementById('rebirth-btn');
  const info = document.getElementById('rebirth-info');
  if (!btn || !info) return;
  const canRebirth = GS.era >= REBIRTH_MIN_ERA;
  btn.disabled = !canRebirth;
  btn.textContent = L.ui.rebirth;
  if (canRebirth) {
    info.textContent = `${L.ui.rebirthEarned}: ${calcRebirthPoints()} pts`;
  } else info.textContent = '';
}

function renderAll() {
  renderHeader();
  renderCenter();
  renderBuildings();
  renderUpgrades();
  renderPermUpgrades();
  renderStats();
  renderAchievements();
  renderRebirthSection();
  renderMessages();
  renderUnitButtons();
}

function renderUnitButtons() {
  document.querySelectorAll('[data-unit]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.unit === GS.unitMode);
    btn.textContent = L.unitModeNames[btn.dataset.unit] || btn.dataset.unit;
  });
}

function spawnFloatingNumber(x, y, amount, isChain) {
  const el = document.createElement('div');
  el.className = 'float-num' + (isChain ? ' chain' : '');
  el.textContent = '+' + fmt(amount);
  el.style.left = (x - 20) + 'px'; el.style.top = (y - 20) + 'px';
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 1100);
}

// ============================================================
// GLOBAL TOOLTIP
// ============================================================
let currentTooltipType = null;
let currentTooltipId = null;

function showTooltip(e, type, id) {
  const tt = document.getElementById('global-tooltip');
  if (!tt) return;

  if (currentTooltipType !== type || currentTooltipId !== id) {
    const tName = document.getElementById('tt-name');
    const tDesc = document.getElementById('tt-desc');
    const tFlavor = document.getElementById('tt-flavor');

    currentTooltipType = type;
    currentTooltipId = id;

    if (type === 'building') {
      tName.style.display = 'block';
      tDesc.style.display = 'block';
      const bLang = L.buildings[id];
      tName.textContent = bLang.name;
      tDesc.textContent = bLang.desc;
      tFlavor.textContent = bLang.flavor || '';
      tFlavor.style.display = bLang.flavor ? 'block' : 'none';
    } else if (type === 'upgrade') {
      tName.style.display = 'block';
      tDesc.style.display = 'block';
      const uLang = L.upgrades[id];
      tName.textContent = uLang.name;
      tDesc.textContent = uLang.desc;
      tFlavor.style.display = 'none';
    } else if (type === 'achievement') {
      const unlocked = !!GS.achievements[id];
      const aLang = L.achievements[id];
      if (!aLang || !unlocked || !aLang.flavor) {
        tt.classList.remove('show');
        return;
      }

      tName.style.display = 'none';
      tDesc.style.display = 'none';
      tFlavor.textContent = aLang.flavor;
      tFlavor.style.display = 'block';
    }
  }

  // Stats need to stay live-updated every mousemove (building counts/production can change while hovering)
  const tStats = document.getElementById('tt-stats');
  if (type === 'building') {
    const bd = BUILDINGS_DATA.find(b => b.id === id);
    const count = GS.buildings[id] || 0;
    const bMult = getBuildingMult(id);
    const base = bd.type === 'q' ? bd.baseQPS * bMult : bd.baseAPS * bMult;
    const rate = base * count;
    let statText = bd.type === 'q'
      ? `${L.ui.owned}: ${count} | ${base.toFixed(1)} ${L.ui.qps} (Total: +${fmtDec(rate)})`
      : `${L.ui.owned}: ${count} | ${base.toFixed(1)} ${L.ui.aps} (Total: +${fmtDec(rate)})`;

    if (bd.synergyFrom) {
      const syn = getBuildingSynergy(id);
      if (syn.isAllQ) {
        statText += `\n🔗 ${L.ui.synergyLabel || 'シナジー'}: ${syn.parentName} (${syn.count}) → +${syn.bonusPct.toFixed(1)}%`;
      } else if (syn.active) {
        const nextInfo = syn.nextThreshold
          ? ` (次: ${syn.nextThreshold}個で +${syn.bonusPct + 1}%)`
          : ' (MAX)';
        statText += `\n🔗 ${L.ui.synergyLabel || 'シナジー'}: ${syn.parentName} ${syn.count}個 → +${syn.bonusPct}%${nextInfo}`;
      } else {
        statText += `\n🔗 ${L.ui.synergyLabel || 'シナジー'}: ${syn.parentName} 25個で +5% (${syn.count}/25)`;
      }
    }

    tStats.textContent = statText;
    tStats.style.display = 'block';
  } else {
    tStats.style.display = 'none';
  }

  // Position
  const x = e.clientX + 15;
  const y = e.clientY + 15;
  tt.style.transform = `translate(${x}px, ${y}px)`;
  if (!tt.classList.contains('show')) tt.classList.add('show');
}

function hideTooltip() {
  const tt = document.getElementById('global-tooltip');
  if (tt) tt.classList.remove('show');
  currentTooltipType = null;
  currentTooltipId = null;
}

let achievNotifTimeout = null;
function showAchievementNotif(name) {
  const el = document.getElementById('achieve-notif');
  if (!el) return;
  el.querySelector('.achieve-notif-name').textContent = name;
  el.querySelector('.achieve-notif-title').textContent = L.ui.achievUnlocked;
  el.classList.add('show');
  clearTimeout(achievNotifTimeout);
  achievNotifTimeout = setTimeout(() => el.classList.remove('show'), 4000);
}

let toastTimeout = null;
function showToast(text, type = 'success') {
  const el = document.getElementById('save-toast');
  if (!el) return;
  el.textContent = text;
  el.style.background = type === 'warning' ? 'rgba(248,113,113,0.1)' : 'rgba(52,211,153,0.1)';
  el.style.borderColor = type === 'warning' ? 'rgba(248,113,113,0.4)' : 'rgba(52,211,153,0.4)';
  el.style.color = type === 'warning' ? 'var(--danger)' : 'var(--accent3)';
  el.classList.add('show');
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => el.classList.remove('show'), 2000);
}

// ============================================================
// LANGUAGE & MODALS
// ============================================================
function setLang(code) {
  if (!window.LANGS || !window.LANGS[code]) return;
  L = window.LANGS[code];
  GS.lang = code;
  document.documentElement.lang = L.meta.htmlLang || 'ja';
}
function setUnit(mode) {
  GS.unitMode = mode; renderAll();
}

function openModal(id) { document.getElementById(id)?.classList.add('open'); }
function closeModal(id) { document.getElementById(id)?.classList.remove('open'); }

function openSettings() { populateSettingsModal(); openModal('settings-modal'); }
function populateSettingsModal() {
  const m = document.getElementById('settings-modal');
  if (!m) return;
  m.querySelectorAll('.settings-btn[data-lang]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.lang === GS.lang);
    btn.onclick = () => { setLang(btn.dataset.lang); populateSettingsModal(); populateRouteModal(); renderAll(); };
  });
  m.querySelectorAll('.settings-btn[data-unit]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.unit === GS.unitMode);
    btn.onclick = () => { setUnit(btn.dataset.unit); populateSettingsModal(); };
  });
}

function openRebirthModal() {
  if (GS.era < REBIRTH_MIN_ERA) return;
  const pts = calcRebirthPoints();
  const m = document.getElementById('rebirth-modal');
  if (!m) return;
  m.querySelector('.modal-title').textContent = L.ui.rebirthConfirm;
  m.querySelector('.rebirth-reward-label').textContent = L.ui.rebirthRewards;
  m.querySelector('.rebirth-reward-val').textContent = `+${pts} pts → RP: ${GS.rebirthPoints + pts}`;
  m.querySelector('.rebirth-warn').textContent = L.ui.rebirthWarn;
  m.querySelector('.rebirth-yes-btn').textContent = L.ui.rebirthYes;
  m.querySelector('.rebirth-no-btn').textContent = L.ui.rebirthNo;
  openModal('rebirth-modal');
}

function populateRouteModal() {
  const m = document.getElementById('route-modal');
  if (!m) return;
  m.querySelector('#route-modal-title').textContent = L.ui.routeTitle;
  m.querySelector('#route-modal-desc').innerHTML = L.ui.routeDesc.replace('\n', '<br>');
  m.querySelector('#route-q-btn').childNodes[0].textContent = L.ui.routeQBtn;
  m.querySelector('#route-q-sub').textContent = L.ui.routeQSub;
  m.querySelector('#route-a-btn').childNodes[0].textContent = L.ui.routeABtn;
  m.querySelector('#route-a-sub').textContent = L.ui.routeASub;
}

// ============================================================
// MAIN GAME LOOP
// ============================================================
function tick() {
  const now = Date.now();
  const dt = Math.min((now - (GS.lastTick || now)) / 1000, 0.5);
  GS.lastTick = now;

  const qps = calcQPS();
  if (qps > 0) {
    GS.questions += qps * dt;
    GS.totalQuestionsEarned += qps * dt;
  }

  const aps = calcAPS();
  if (aps > 0) {
    GS.answers += aps * dt;
    GS.totalAnswersEarned += aps * dt;
  }

  progressEra(dt);
  tickQpsBuff(dt);
  tickGoldenSpawn(dt);
  GS.playTime += dt;

  if (tickCount % SAVE_INTERVAL === 0 && tickCount > 0) saveToLocalStorage();
  if (tickCount % 10 === 0) checkAchievements();

  tickCount++;
  renderHeader();
  renderCenter();
  if (tickCount % 4 === 0) renderBuildings();
  if (tickCount % 8 === 0) {
    renderUpgrades();
    renderStats();
    renderPermUpgrades();
    renderRebirthSection();
  }
}

// ============================================================
// INITIALIZATION
// ============================================================
function init() {
  const hasSave = loadFromLocalStorage();
  if (!hasSave || !GS.lang || !window.LANGS[GS.lang]) {
    document.getElementById('lang-modal')?.classList.remove('hidden');
    return;
  }
  setLang(GS.lang);
  startGame(hasSave);
}

function startGame(hasSave) {
  document.getElementById('lang-modal')?.classList.add('hidden');
  document.getElementById('game')?.classList.remove('hidden');
  for (const bd of BUILDINGS_DATA) {
    if (bd.unlockEra && GS.era >= bd.unlockEra) unlockedBuildings[bd.id] = true;
  }
  prevEra = GS.era;
  if (!hasSave) addMessage(L.messages.welcome, 'era');

  // check route
  if (GS.era >= ROUTE_SPLIT_ERA && GS.route === null) {
    routeModalOpen = true;
    populateRouteModal();
    openModal('route-modal');
  }

  renderAll();
  GS.lastTick = Date.now();
  setInterval(tick, TICK_MS);
}

// ============================================================
// UI — TAB / CLICK HANDLERS
// ============================================================
function switchTab(panel, tab) {
  const panelEl = document.getElementById(panel === 'left' ? 'left-panel' : 'right-panel');
  if (!panelEl) return;
  panelEl.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tab);
  });
  panelEl.querySelectorAll('.tab-content').forEach(el => {
    el.classList.toggle('active', el.id === tab + '-tab');
  });
  if (panel === 'left') activeLeftTab = tab;
  else activeRightTab = tab;
}

function onBuildingClick(id) {
  const bd = BUILDINGS_DATA.find(b => b.id === id);
  if (bd) buyBuilding(bd);
}

function onUpgradeClick(id) {
  const upg = UPGRADES_DATA.find(u => u.id === id);
  if (upg) buyUpgrade(upg);
}

function setBuyAmount(n) {
  buyAmount = n;
  renderBuildings();
}

// ============================================================
// WINDOW API
// ============================================================
let debugMode = false;

function showToastSafe(msg, type) {
  if (typeof showToast === 'function') showToast(msg, type);
}

window.Game = {
  Win: function (name) {
    if (name === 'Developer') { unlockAchievement('developer'); showToast(L?.ui?.devConsoleHint || 'Achievement unlocked!', 'success'); }
  },
  state: () => GS,
  give: (n) => { GS.debugUsed = true; GS.questions += n; GS.totalQuestionsEarned += n; renderAll(); },
  giveA: (n) => { GS.debugUsed = true; GS.answers += n; GS.totalAnswersEarned += n; renderAll(); },
  setEra: (n) => { GS.debugUsed = true; GS.era = n; renderAll(); },

  // ── Debug mode commands ──────────────────────────────────
  debug: {
    enabled: () => debugMode,

    setQ: (n) => {
      if (!debugMode) return '[debug] Not in debug mode.';
      GS.debugUsed = true;
      GS.questions = n; GS.totalQuestionsEarned = Math.max(GS.totalQuestionsEarned, n);
      renderAll();
      return `[debug] questions = ${n}`;
    },
    setA: (n) => {
      if (!debugMode) return '[debug] Not in debug mode.';
      GS.debugUsed = true;
      GS.answers = n; GS.totalAnswersEarned = Math.max(GS.totalAnswersEarned, n);
      renderAll();
      return `[debug] answers = ${n}`;
    },
    setEra: (n) => {
      if (!debugMode) return '[debug] Not in debug mode.';
      GS.debugUsed = true;
      GS.era = n;
      checkAchievements();
      renderAll();
      return `[debug] era = ${n}`;
    },
    unlockAllBuildings: () => {
      if (!debugMode) return '[debug] Not in debug mode.';
      GS.debugUsed = true;
      for (const bd of BUILDINGS_DATA) {
        if (!GS.buildings[bd.id]) GS.buildings[bd.id] = 1;
      }
      renderAll();
      return '[debug] all buildings unlocked (count set to at least 1).';
    },
    unlockAllUpgrades: () => {
      if (!debugMode) return '[debug] Not in debug mode.';
      GS.debugUsed = true;
      for (const upg of UPGRADES_DATA) {
        GS.upgrades[upg.id] = true;
        applyUpgradeEffect(upg);
      }
      renderAll();
      return '[debug] all upgrades unlocked.';
    },
    unlockAllAchievements: () => {
      if (!debugMode) return '[debug] Not in debug mode.';
      GS.debugUsed = true;
      for (const def of ACHIEVEMENTS_DATA) GS.achievements[def.id] = true;
      renderAchievements();
      return '[debug] all achievements unlocked.';
    },
    unlockAll: () => {
      if (!debugMode) return '[debug] Not in debug mode.';
      GS.debugUsed = true;
      window.Game.debug.unlockAllBuildings();
      window.Game.debug.unlockAllUpgrades();
      window.Game.debug.unlockAllAchievements();
      return '[debug] everything unlocked.';
    },
  },
};

// ── console.log("debug abc2045") toggles debug mode ──────────
const DEBUG_PASSPHRASE = 'debug abc2045';
window.console.log = (text) => {
  if (text === DEBUG_PASSPHRASE) {
    debugMode = !debugMode;
    document.body.classList.toggle('debug-mode', debugMode);
    console.warn(debugMode
      ? '[DEBUG MODE ON] window.Game.debug.{setQ, setA, setEra, unlockAllBuildings, unlockAllUpgrades, unlockAllAchievements, unlockAll}'
      : '[DEBUG MODE OFF]');
    showToastSafe(debugMode ? '🐞 DEBUG MODE ON' : 'DEBUG MODE OFF', debugMode ? 'success' : 'normal');
  } else if (text == "Hello World") {
    unlockAchievement('hello_world');
  } else {
    console.warn(text);
  }
};

// Expose functions called by inline onclick="" (required in strict mode)
window.onBuildingClick = onBuildingClick;
window.onUpgradeClick = onUpgradeClick;
window.setBuyAmount = setBuyAmount;
window.switchTab = switchTab;
window.buyPermUpgrade = buyPermUpgrade;
window.showTooltip = showTooltip;
window.hideTooltip = hideTooltip;

// ============================================================
// DOM READY
// ============================================================
window.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.lang-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      setLang(btn.dataset.lang);
      startGame(false);
    });
  });

  document.getElementById('click-btn')?.addEventListener('click', e => clickQuestion(e));
  document.querySelectorAll('.unit-btn').forEach(btn => btn.addEventListener('click', () => setUnit(btn.dataset.unit)));

  document.querySelectorAll('#left-panel .tab-btn').forEach(btn => btn.addEventListener('click', () => switchTab('left', btn.dataset.tab)));
  document.querySelectorAll('#right-panel .tab-btn').forEach(btn => btn.addEventListener('click', () => switchTab('right', btn.dataset.tab)));

  document.getElementById('settings-btn')?.addEventListener('click', openSettings);
  document.getElementById('settings-modal')?.addEventListener('click', e => { if (e.target.classList.contains('modal-close')) closeModal('settings-modal'); });
  document.getElementById('save-btn')?.addEventListener('click', () => { saveToLocalStorage(); showToast(L.ui.saveSuccess, 'success'); });
  document.getElementById('rebirth-btn')?.addEventListener('click', openRebirthModal);

  document.querySelector('.rebirth-yes-btn')?.addEventListener('click', () => { doRebirth(); closeModal('rebirth-modal'); });
  document.querySelector('.rebirth-no-btn')?.addEventListener('click', () => closeModal('rebirth-modal'));

  document.getElementById('route-q-btn')?.addEventListener('click', () => chooseRoute('question'));
  document.getElementById('route-a-btn')?.addEventListener('click', () => chooseRoute('answer'));

  document.getElementById('export-btn')?.addEventListener('click', exportSaveTxt);
  document.getElementById('import-btn')?.addEventListener('click', () => document.getElementById('import-file-input')?.click());
  document.getElementById('import-file-input')?.addEventListener('change', e => {
    if (e.target.files[0]) importSaveTxt(e.target.files[0]);
    e.target.value = '';
  });
  document.getElementById('reset-btn')?.addEventListener('click', () => {
    if (confirm(L?.ui?.resetConfirm || 'Reset?')) { closeModal('settings-modal'); resetSave(); }
  });

  document.querySelectorAll('.modal-overlay').forEach(ov => ov.addEventListener('click', e => {
    // Route modal cannot be closed by clicking outside
    if (e.target === ov && ov.id !== 'route-modal') ov.classList.remove('open');
  }));
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') document.querySelectorAll('.modal-overlay.open').forEach(m => {
      if (m.id !== 'route-modal') m.classList.remove('open');
    });
    if ((e.code === 'Space' || e.code === 'Enter') && document.activeElement === document.body) {
      e.preventDefault(); document.getElementById('click-btn')?.click();
    }
  });

  init();
});
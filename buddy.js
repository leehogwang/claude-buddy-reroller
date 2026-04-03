#!/usr/bin/env node
// buddy.js — Claude Code Buddy Reroller 대화형 CLI
// 사용법: node buddy.js

'use strict';

const readline    = require('readline');
const fs          = require('fs');
const os          = require('os');
const path        = require('path');
const crypto      = require('crypto');
const { Worker }  = require('worker_threads');
const { execSync, spawnSync } = require('child_process');

const WORKER_FILE  = path.join(__dirname, 'buddy_worker.js');
const NUM_WORKERS  = Math.min(os.cpus().length, 64); // 최대 64 threads

// ── ANSI 색상 ──────────────────────────────────────────────────────────────
const C = {
  reset:  '\x1b[0m',
  bold:   '\x1b[1m',
  dim:    '\x1b[2m',
  gold:   '\x1b[33m',
  green:  '\x1b[32m',
  blue:   '\x1b[34m',
  purple: '\x1b[35m',
  cyan:   '\x1b[36m',
  red:    '\x1b[31m',
  gray:   '\x1b[90m',
};
const RARITY_COLOR = {
  common: C.gray, uncommon: C.green, rare: C.blue, epic: C.purple, legendary: C.gold,
};

// ── 버디 알고리즘 ──────────────────────────────────────────────────────────
const SALT           = 'friend-2026-401';
const SPECIES        = ['duck','goose','blob','cat','dragon','octopus','owl','penguin',
                        'turtle','snail','ghost','axolotl','capybara','cactus','robot',
                        'rabbit','mushroom','chonk'];
const RARITIES       = ['common','uncommon','rare','epic','legendary']; // Claude Code 순서: common 먼저
const RARITY_WEIGHTS = { legendary:1, epic:4, rare:10, uncommon:25, common:60 };
const RARITY_FLOOR   = { common:5, uncommon:15, rare:25, epic:35, legendary:50 };
const EYES           = ['·','✦','×','◉','@','°'];
const HATS           = ['none','crown','tophat','propeller','halo','wizard','beanie','tinyduck'];
const STAT_NAMES     = ['DEBUGGING','PATIENCE','CHAOS','WISDOM','SNARK'];

function mulberry32(seed) {
  return function () {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

// ── wyHash32: Zig Wyhash — pure-JS, no Bun/native required ────────────────
// Matches Bun.hash() == Claude Code's internal buddy hash.
// Official test vectors: wyhash(0,"")=0x409638ee2bde459, wyhash(0,"hello")=0xe24bbd9f93f532d
const _WY_S0H=0xa0761d64,_WY_S0L=0x78bd642f,_WY_S1H=0xe7037ed1,_WY_S1L=0xa0b428db;
const _WY_S2H=0x8ebc6af0,_WY_S2L=0x9c88c6e3,_WY_S3H=0x589965cc,_WY_S3L=0x75374cc3;
function _wyMul64(ah,al,bh,bl) {
  // 64×64→128 bit multiply via 16-bit limbs (avoids float/int32 overflow)
  ah=ah>>>0;al=al>>>0;bh=bh>>>0;bl=bl>>>0;
  const a=[al&0xffff,(al>>>16)&0xffff,ah&0xffff,(ah>>>16)&0xffff];
  const b=[bl&0xffff,(bl>>>16)&0xffff,bh&0xffff,(bh>>>16)&0xffff];
  const t=[0,0,0,0,0,0,0,0];
  for (let i=0;i<4;i++) for (let j=0;j<4;j++) t[i+j]+=a[i]*b[j];
  for (let i=0;i<7;i++) { t[i+1]+=Math.floor(t[i]/0x10000); t[i]&=0xffff; }
  return [((t[3]<<16)|t[2])>>>0,((t[1]<<16)|t[0])>>>0,((t[7]<<16)|t[6])>>>0,((t[5]<<16)|t[4])>>>0];
}
function _wyMix(ah,al,bh,bl) {
  const [lh,ll,hh,hl]=_wyMul64(ah,al,bh,bl);
  return [(lh^hh)>>>0,(ll^hl)>>>0];
}
const [_WY_IH,_WY_IL]=_wyMix(_WY_S0H,_WY_S0L,_WY_S1H,_WY_S1L); // init state for seed=0

function wyHash32(str) {
  const bytes=Buffer.from(str,'utf8'), n=bytes.length;
  const r4=(o)=>((bytes[o+3]<<24)|(bytes[o+2]<<16)|(bytes[o+1]<<8)|bytes[o])>>>0;
  const r8h=(o)=>((bytes[o+7]<<24)|(bytes[o+6]<<16)|(bytes[o+5]<<8)|bytes[o+4])>>>0;
  const r8l=(o)=>((bytes[o+3]<<24)|(bytes[o+2]<<16)|(bytes[o+1]<<8)|bytes[o])>>>0;
  let s0h=_WY_IH,s0l=_WY_IL,s1h=_WY_IH,s1l=_WY_IL,s2h=_WY_IH,s2l=_WY_IL,i=0;
  while (i+48<n) {
    [s0h,s0l]=_wyMix((r8h(i)^_WY_S1H)>>>0,(r8l(i)^_WY_S1L)>>>0,(r8h(i+8)^s0h)>>>0,(r8l(i+8)^s0l)>>>0);
    [s1h,s1l]=_wyMix((r8h(i+16)^_WY_S2H)>>>0,(r8l(i+16)^_WY_S2L)>>>0,(r8h(i+24)^s1h)>>>0,(r8l(i+24)^s1l)>>>0);
    [s2h,s2l]=_wyMix((r8h(i+32)^_WY_S3H)>>>0,(r8l(i+32)^_WY_S3L)>>>0,(r8h(i+40)^s2h)>>>0,(r8l(i+40)^s2l)>>>0);
    i+=48;
  }
  let ah,al,bh,bl;
  if (n<=16) {
    if (n>=4) { const e=n-4,q=(n>>3)<<2; ah=r4(0);al=r4(q);bh=r4(e);bl=r4(e-q); }
    else if (n>0) { ah=0;al=(bytes[0]<<16)|(bytes[n>>1]<<8)|bytes[n-1];bh=0;bl=0; }
    else { ah=al=bh=bl=0; }
  } else {
    if (i>0) { s0h=(s0h^s1h^s2h)>>>0; s0l=(s0l^s1l^s2l)>>>0; }
    let ri=0;
    while (ri+16<n-i) {
      [s0h,s0l]=_wyMix((r8h(i+ri)^_WY_S1H)>>>0,(r8l(i+ri)^_WY_S1L)>>>0,(r8h(i+ri+8)^s0h)>>>0,(r8l(i+ri+8)^s0l)>>>0);
      ri+=16;
    }
    ah=r8h(n-16);al=r8l(n-16);bh=r8h(n-8);bl=r8l(n-8);
  }
  const [lh,ll,hh,hl]=_wyMul64((ah^_WY_S1H)>>>0,(al^_WY_S1L)>>>0,(bh^s0h)>>>0,(bl^s0l)>>>0);
  const [rh,rl,xh,xl]=_wyMul64((lh^_WY_S0H)>>>0,(ll^_WY_S0L^n)>>>0,(hh^_WY_S1H)>>>0,(hl^_WY_S1L)>>>0);
  return (rl^xl)>>>0;
}

function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

function rollRarity(rng) {
  // Claude Code YI4: rng()*100, common(60) 먼저 차감 → legendary는 rng>0.99일 때만
  let roll = rng() * 100;
  for (const r of RARITIES) { roll -= RARITY_WEIGHTS[r]; if (roll < 0) return r; }
  return 'common';
}

function rollStats(rng, rarity) {
  const floor = RARITY_FLOOR[rarity];
  const peak  = pick(rng, STAT_NAMES);
  let   dump  = pick(rng, STAT_NAMES);
  while (dump === peak) dump = pick(rng, STAT_NAMES);
  const stats = {};
  for (const name of STAT_NAMES) {
    if (name === peak)      stats[name] = Math.min(100, floor + 50 + Math.floor(rng() * 30));
    else if (name === dump) stats[name] = Math.max(1,   floor - 10 + Math.floor(rng() * 15));
    else                    stats[name] = floor + Math.floor(rng() * 40);
  }
  return { stats, peak, dump };
}

function getBuddy(uid) {
  const rng    = mulberry32(wyHash32(uid + SALT));
  const rarity = rollRarity(rng);
  const species = pick(rng, SPECIES);
  const eye    = pick(rng, EYES);
  const hat    = rarity === 'common' ? 'none' : pick(rng, HATS); // Claude Code: common → hat 없음 (rng 소비 안 함)
  const shiny  = rng() < 0.01;
  const { stats, peak, dump } = rollStats(rng, rarity);
  return { rarity, species, eye, hat, shiny, stats, peak, dump };
}

function fmtBuddy(b) {
  const rc  = RARITY_COLOR[b.rarity];
  const tag = b.shiny ? ` ${C.cyan}✨ SHINY${C.reset}` : '';
  const s   = STAT_NAMES.map(
    n => n === b.peak ? `${C.gold}【${n}:${b.stats[n]}】${C.reset}` : `${n}:${b.stats[n]}`
  ).join('  ');
  return [
    `  ${rc}${b.rarity} ${b.species}${C.reset}  eye=${b.eye}  hat=${b.hat}${tag}`,
    `  stats: [${s}]`,
  ].join('\n');
}

// ── ~/.claude.json 관련 ────────────────────────────────────────────────────
const CONFIG_PATH = path.join(os.homedir(), '.claude.json');
const CRED_PATH   = path.join(os.homedir(), '.claude', '.credentials.json');

function readConfig() {
  try { return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8')); }
  catch { return null; }
}

function getCurrentIdentity(cfg) {
  if (!cfg) return { id: null, source: '없음' };
  const uuid = cfg.oauthAccount?.accountUuid;
  if (uuid) return { id: uuid, source: 'accountUuid' };
  if (cfg.userID) return { id: cfg.userID, source: `userID ${C.red}⚠️  accountUuid 없음 — credentials UUID로 쓰일 수 있음${C.reset}` };
  return { id: 'anon', source: 'anon' };
}

function _unprotect() {
  try { execSync(`chmod 644 "${CONFIG_PATH}" "${CRED_PATH}" 2>/dev/null`, { stdio: 'ignore' }); } catch {}
}
function _protect() {
  try { execSync(`chmod 444 "${CONFIG_PATH}" "${CRED_PATH}" 2>/dev/null`, { stdio: 'ignore' }); } catch {}
}

function applyId(uid) {
  _unprotect();
  const cfg = readConfig() || {};
  const backup = CONFIG_PATH + '.bak.' + new Date().toISOString().replace(/[:.]/g, '-');
  try { fs.copyFileSync(CONFIG_PATH, backup); } catch {}
  // Claude Code v2: /buddy reads oauthAccount.accountUuid first.
  // SET it to our target UUID so it overrides the credentials.json UUID.
  if (!cfg.oauthAccount) cfg.oauthAccount = {};
  cfg.oauthAccount.accountUuid = uid;
  cfg.userID = uid;
  delete cfg.companion; // clear cached name/personality so /buddy regenerates it
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2));
  _protect();
  return backup;
}

// ── Claude 프로세스 재시작 ────────────────────────────────────────────────
function restartClaude() {
  // 내 UID 소유의 claude 프로세스만 종료
  try {
    const uid = process.getuid();
    const result = spawnSync('pgrep', ['-u', String(uid), '-x', 'claude'], { encoding: 'utf8' });
    const pids = result.stdout.trim().split('\n').filter(Boolean);
    if (pids.length === 0) {
      console.log(`  ${C.dim}실행 중인 Claude 프로세스 없음 — 다음 실행 때 자동 반영됩니다.${C.reset}`);
      return false;
    }
    for (const pid of pids) {
      try { process.kill(parseInt(pid), 'SIGTERM'); } catch {}
    }
    console.log(`  ${C.green}✓ Claude 프로세스(${pids.length}개) 종료 완료.${C.reset} 다시 실행하면 새 buddy가 적용됩니다.`);
    return true;
  } catch (e) {
    console.log(`  ${C.dim}Claude 재시작 실패 (${e.message}) — 직접 재시작해 주세요.${C.reset}`);
    return false;
  }
}

// ── readline 헬퍼 ─────────────────────────────────────────────────────────
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

function ask(prompt) {
  return new Promise(resolve => rl.question(prompt, resolve));
}

async function askNum(prompt, min, max, def = null) {
  while (true) {
    const defStr = def !== null ? ` ${C.dim}[기본: ${def}]${C.reset}` : '';
    const ans = (await ask(`${prompt}${defStr}: `)).trim();
    if (ans === '' && def !== null) return def;
    const n = parseInt(ans);
    if (!isNaN(n) && n >= min && n <= max) return n;
    console.log(`  ${C.red}${min}~${max} 사이의 숫자를 입력하세요.${C.reset}`);
  }
}

// ── 진행 바 ──────────────────────────────────────────────────────────────
function progressBar(cur, total, width = 28) {
  const pct  = cur / total;
  const fill = Math.floor(pct * width);
  const bar  = '█'.repeat(fill) + '░'.repeat(width - fill);
  return `[${bar}] ${(pct * 100).toFixed(1)}%  ${cur.toLocaleString()} / ${total.toLocaleString()}`;
}

// ── Worker 병렬 탐색 ─────────────────────────────────────────────────────
// filters: { targetRarity, targetSpecies, filterEye, filterHat, filterShiny, filterPeak, filterMinStats }
function runWorkers(filters, maxAttempts, onResult) {
  return new Promise((resolve) => {
    const chunkSize  = Math.ceil(maxAttempts / NUM_WORKERS);
    let totalDone    = 0;
    let totalProg    = 0;
    let resultCount  = 0;
    let workersDone  = 0;

    for (let w = 0; w < NUM_WORKERS; w++) {
      const worker = new Worker(WORKER_FILE, {
        workerData: { filters, count: chunkSize },
      });

      worker.on('message', (msg) => {
        if (msg.type === 'progress') {
          totalProg += msg.count;
          process.stdout.write(
            `\r  ${progressBar(Math.min(totalProg, maxAttempts), maxAttempts)}` +
            `  workers:${C.cyan}${NUM_WORKERS}${C.reset}  found:${C.green}${resultCount}${C.reset}   `
          );
        } else if (msg.type === 'result') {
          resultCount++;
          process.stdout.write('\r' + ' '.repeat(80) + '\r');
          onResult(msg.result);
        } else if (msg.type === 'done') {
          workersDone++;
          if (workersDone === NUM_WORKERS) resolve();
        }
      });

      worker.on('error', (err) => {
        console.error(`\nworker error: ${err.message}`);
        workersDone++;
        if (workersDone === NUM_WORKERS) resolve();
      });
    }
  });
}

// ── 메인 메뉴 ─────────────────────────────────────────────────────────────
async function main() {
  console.clear();
  console.log(`${C.gold}${C.bold}🐾 Claude Code Buddy Reroller${C.reset}`);
  console.log('═'.repeat(52));

  const cfg = readConfig();
  const { id, source } = getCurrentIdentity(cfg);
  if (id && id !== 'anon') {
    const b = getBuddy(id);
    console.log(`현재 buddy:`);
    console.log(fmtBuddy(b));
    console.log(`  ${C.dim}(${source})${C.reset}`);
  } else {
    console.log(`${C.gray}현재 상태 확인 불가 (~/.claude.json 없음)${C.reset}`);
  }

  console.log('');
  console.log(`  1) 새 buddy 탐색 (브루트포스)`);
  console.log(`  2) ID로 buddy 확인`);
  console.log(`  3) accountUuid 제거  ${C.dim}(Pro/Team 플랜 사용자)${C.reset}`);
  console.log(`  4) 종료`);
  console.log('');

  const menu = await askNum('선택', 1, 4, 1);
  console.log('');

  if      (menu === 1) await huntMenu({});
  else if (menu === 2) await checkMenu();
  else if (menu === 3) await fixMenu();
  else { rl.close(); }
}

// ── 탐색 메뉴 ─────────────────────────────────────────────────────────────
async function huntMenu(opts = {}) {
  console.log(`${C.bold}[ Buddy 탐색 설정 ]${C.reset}`);
  console.log('─'.repeat(52));

  // ── Species ───────────────────────────────────────────────
  let targetSpecies;
  if (opts.species) {
    if (!SPECIES.includes(opts.species)) {
      console.error(`알 수 없는 species: ${opts.species}\n유효: ${SPECIES.join(', ')}`);
      rl.close(); return;
    }
    targetSpecies = opts.species;
    console.log(`\n종: ${C.bold}${targetSpecies}${C.reset}  ${C.dim}(인수 지정됨)${C.reset}`);
  } else {
    console.log('\n원하는 종 (species):');
    SPECIES.forEach((s, i) => {
      process.stdout.write(`  ${String(i + 1).padStart(2)}) ${s.padEnd(11)}`);
      if ((i + 1) % 4 === 0) process.stdout.write('\n');
    });
    console.log('');
    targetSpecies = SPECIES[await askNum('\n선택', 1, SPECIES.length, 4) - 1];
  }

  // ── Rarity ────────────────────────────────────────────────
  const RARITIES_ASC = [...RARITIES].reverse();
  let targetRarity;
  if (opts.rarity) {
    if (!RARITIES.includes(opts.rarity)) {
      console.error(`알 수 없는 rarity: ${opts.rarity}\n유효: ${RARITIES.join(', ')}`);
      rl.close(); return;
    }
    targetRarity = opts.rarity;
    console.log(`레어리티: ${RARITY_COLOR[targetRarity]}${targetRarity}${C.reset}  ${C.dim}(인수 지정됨)${C.reset}`);
  } else {
    console.log('\n레어리티:');
    RARITIES_ASC.forEach((r, i) => {
      console.log(`  ${i + 1}) ${RARITY_COLOR[r]}${r.padEnd(12)}${C.reset}  (${RARITY_WEIGHTS[r]}%)`);
    });
    targetRarity = RARITIES_ASC[await askNum('선택', 1, RARITIES.length, 1) - 1];
  }

  // ── Eye ───────────────────────────────────────────────────
  let filterEye;
  if ('eye' in opts) {
    if (opts.eye && !EYES.includes(opts.eye)) {
      console.error(`알 수 없는 eye: ${opts.eye}\n유효: ${EYES.join('  ')}`);
      rl.close(); return;
    }
    filterEye = opts.eye || null;
    console.log(`눈: ${filterEye ?? '상관없음'}  ${C.dim}(인수 지정됨)${C.reset}`);
  } else {
    console.log('\n눈 모양 (eye):');
    console.log('  1) 상관없음');
    EYES.forEach((e, i) => console.log(`  ${i + 2}) ${e}`));
    const eyeIdx = await askNum('선택', 1, EYES.length + 1, 1);
    filterEye = eyeIdx === 1 ? null : EYES[eyeIdx - 2];
  }

  // ── Hat ───────────────────────────────────────────────────
  let filterHat;
  if ('hat' in opts) {
    if (opts.hat && !HATS.includes(opts.hat)) {
      console.error(`알 수 없는 hat: ${opts.hat}\n유효: ${HATS.join(', ')}`);
      rl.close(); return;
    }
    filterHat = opts.hat || null;
    console.log(`모자: ${filterHat ?? '상관없음'}  ${C.dim}(인수 지정됨)${C.reset}`);
  } else {
    console.log('\n모자 (hat):');
    console.log('  1) 상관없음');
    HATS.forEach((h, i) => console.log(`  ${i + 2}) ${h}`));
    const hatIdx = await askNum('선택', 1, HATS.length + 1, 1);
    filterHat = hatIdx === 1 ? null : HATS[hatIdx - 2];
  }

  // ── Shiny ─────────────────────────────────────────────────
  let filterShiny;
  if ('shiny' in opts) {
    filterShiny = opts.shiny;
    console.log(`Shiny: ${filterShiny ? `${C.cyan}✨ YES${C.reset}` : 'NO'}  ${C.dim}(인수 지정됨)${C.reset}`);
  } else {
    const shinyAns = (await ask('\nShiny 필터? (y/N): ')).trim().toLowerCase();
    filterShiny = shinyAns === 'y';
  }

  // ── Peak stat ─────────────────────────────────────────────
  let filterPeak;
  if ('peak' in opts) {
    if (opts.peak && !STAT_NAMES.includes(opts.peak)) {
      console.error(`알 수 없는 stat: ${opts.peak}\n유효: ${STAT_NAMES.join(', ')}`);
      rl.close(); return;
    }
    filterPeak = opts.peak || null;
    console.log(`Peak 스탯: ${filterPeak ? C.gold + filterPeak + C.reset : '상관없음'}  ${C.dim}(인수 지정됨)${C.reset}`);
  } else {
    console.log('\nPeak 스탯 (가장 높은 스탯):');
    console.log('  1) 상관없음');
    STAT_NAMES.forEach((s, i) => console.log(`  ${i + 2}) ${s}`));
    const peakIdx = await askNum('선택', 1, STAT_NAMES.length + 1, 1);
    filterPeak = peakIdx === 1 ? null : STAT_NAMES[peakIdx - 2];
  }

  // ── Min stats ─────────────────────────────────────────────
  let filterMinStats;
  if (opts.minStats) {
    for (const sn of Object.keys(opts.minStats)) {
      if (!STAT_NAMES.includes(sn)) {
        console.error(`알 수 없는 stat: ${sn}\n유효: ${STAT_NAMES.join(', ')}`);
        rl.close(); return;
      }
    }
    filterMinStats = opts.minStats;
    const display = Object.entries(filterMinStats).map(([n, v]) => `${n}≥${v}`).join(' ');
    console.log(`스탯 최솟값: ${display}  ${C.dim}(인수 지정됨)${C.reset}`);
  } else if (Object.keys(opts).length > 0) {
    // CLI 모드: --min-STAT 플래그 없으면 자동 스킵
    filterMinStats = {};
  } else {
    filterMinStats = {};
    const minAns = (await ask('\n스탯 최솟값 설정? (y/N): ')).trim().toLowerCase();
    if (minAns === 'y') {
      console.log(`  ${C.dim}숫자 입력 또는 엔터로 스킵${C.reset}`);
      for (const sn of STAT_NAMES) {
        const ans = (await ask(`  ${sn.padEnd(12)} 최솟값: `)).trim();
        if (ans !== '' && !isNaN(ans) && parseInt(ans) > 0) {
          filterMinStats[sn] = parseInt(ans);
        }
      }
    }
  }

  // ── 조건 요약 ─────────────────────────────────────────────
  console.log('\n' + '═'.repeat(52));
  const condParts = [
    `${RARITY_COLOR[targetRarity]}${targetRarity} ${targetSpecies}${C.reset}`,
    filterEye   ? `eye=${filterEye}`   : null,
    filterHat   ? `hat=${filterHat}`   : null,
    filterShiny ? `${C.cyan}✨ shiny${C.reset}` : null,
    filterPeak  ? `peak=${C.gold}${filterPeak}${C.reset}` : null,
    ...Object.entries(filterMinStats).map(([n, v]) => `${n}≥${v}`),
  ].filter(Boolean);
  console.log(`탐색 조건: ${condParts.join('  +  ')}`);

  // 확률 계산 (스탯 필터 포함)
  let prob = (RARITY_WEIGHTS[targetRarity] / 100) * (1 / SPECIES.length);
  if (filterEye)   prob *= 1 / EYES.length;
  if (filterHat)   prob *= 1 / HATS.length;
  if (filterShiny) prob *= 0.01;
  if (filterPeak)  prob *= 1 / STAT_NAMES.length;

  // minStats 확률: peak=항상 100, dump=40~54, other=50~89 (floor=50 기준 legendary)
  const floor = RARITY_FLOOR[targetRarity];
  let   needsDumpForStats = false;
  for (const [sn, sv] of Object.entries(filterMinStats)) {
    if (sn === filterPeak) continue;              // peak는 항상 존재
    const otherMax = floor + 39;                 // other 슬롯 최댓값
    const dumpMax  = floor + 4;                  // dump 슬롯 최댓값
    if (sv > dumpMax) {
      // dump이면 조건 불가 → 이 스탯은 other 슬롯여야 함 (dump이 다른 골로 몰림)
      needsDumpForStats = true;
      const range = otherMax - sv + 1;
      if (range <= 0) { prob = 0; break; }
      prob *= range / 40;  // other 슬롯은 0~39 uniform
    }
    // sv <= dumpMax: dump어도 조건 만족 → 필턴 없음 (always ≥ floor-10)
  }
  if (needsDumpForStats && filterPeak) {
    // peak 지정 시 dump은 나머지 4개 중 1개로 고정되므로
    // 에상 stat들이 dump가 아니려면 특정 stat이 dump가 되어야 함 → 확률 1/4
    prob *= 1 / (STAT_NAMES.length - 1);
  }

  const expected = prob > 0 ? Math.round(1 / prob) : Infinity;
  const expectedStr = expected === Infinity ? '∞ (불가능)' : expected.toLocaleString();
  console.log(`예상 확률: 약 ${C.bold}${expectedStr}${C.reset} 분의 1`);
  if (expected > 1_000_000_000) {
    const hours = (expected / (NUM_WORKERS * 16500) / 3600).toFixed(1);
    console.log(`  ${C.dim}${NUM_WORKERS}코어 기준 예상 시간: ~${hours}시간${C.reset}`);
  }

  const defMax = Math.min(Math.max(Math.round(10 / Math.max(prob, 1e-15)), 1000000), 10000000000);
  const maxAttempts = opts.attempts
    ? Math.min(Math.max(opts.attempts, 10000), 10000000000)
    : await askNum(`시도 횟수`, 10000, 10000000000, defMax);
  if (opts.attempts) console.log(`시도 횟수: ${C.bold}${maxAttempts.toLocaleString()}${C.reset}  ${C.dim}(인수 지정됨)${C.reset}`);
  console.log('═'.repeat(52));
  console.log(`탐색 시작... ${C.dim}(Ctrl+C 로 중단)${C.reset}  ${C.dim}(${NUM_WORKERS} 코어 병렬)${C.reset}\n`);

  // ── 병렬 탐색 ────────────────────────────────────────────
  const results   = [];
  const startTime = Date.now();

  await runWorkers(
    { targetRarity, targetSpecies, filterEye, filterHat, filterShiny, filterPeak, filterMinStats },
    maxAttempts,
    (r) => {
      results.push(r);
      const tag   = r.shiny ? `  ${C.cyan}✨ SHINY${C.reset}` : '';
      const sLine = STAT_NAMES.map(
        n => n === r.peak ? `${C.gold}【${n}:${r.stats[n]}】${C.reset}` : `${n}:${r.stats[n]}`
      ).join('  ');
      console.log(`  ${C.green}✓ 발견!${C.reset}  eye=${r.eye}  hat=${r.hat}${tag}  peak=${C.gold}${r.peak}${C.reset}`);
      console.log(`         stats: [${sLine}]`);
      console.log(`         ID   : ${C.dim}${r.uid}${C.reset}\n`);
    }
  );

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  process.stdout.write('\r' + ' '.repeat(72) + '\r');
  console.log(`\n${'═'.repeat(52)}`);
  console.log(`완료: ${C.bold}${results.length}개 발견${C.reset}  (${maxAttempts.toLocaleString()}회 / ${elapsed}초)\n`);

  if (results.length === 0) {
    console.log(`${C.gray}조건에 맞는 buddy를 찾지 못했습니다.`);
    console.log(`시도 횟수를 ${(defMax * 3).toLocaleString()} 이상으로 늘려보세요.${C.reset}`);
    rl.close();
    return;
  }

  // ── 적용 여부 ─────────────────────────────────────────────
  let chosen = null;
  if (opts.autoApply) {
    chosen = results[0];
    console.log(`${C.dim}--apply: 첫 번째 결과를 자동 적용합니다.${C.reset}`);
  } else if (results.length === 1) {
    const ans = (await ask('이 ID를 지금 바로 적용하시겠습니까? (y/N): ')).trim().toLowerCase();
    if (ans === 'y') chosen = results[0];
  } else {
    console.log('적용할 번호를 선택하세요:');
    results.forEach((r, i) => {
      const tag = r.shiny ? ` ${C.cyan}✨${C.reset}` : '';
      const sLine = STAT_NAMES.map(
        n => n === r.peak ? `${C.gold}【${n}:${r.stats[n]}】${C.reset}` : `${n}:${r.stats[n]}`
      ).join('  ');
      console.log(`  ${i + 1}) eye=${r.eye}  hat=${r.hat}${tag}  peak=${r.peak}`);
      console.log(`       stats: [${sLine}]`);
    });
    console.log('  0) 스킵 (나중에 직접 적용)');
    const sel = await askNum('선택', 0, results.length, 0);
    if (sel > 0) chosen = results[sel - 1];
  }

  if (chosen) {
    const backup = applyId(chosen.uid);
    const b = getBuddy(chosen.uid);
    console.log(`\n${C.green}✓ ~/.claude.json 업데이트 완료!${C.reset}`);
    console.log(`  백업: ${C.dim}${backup}${C.reset}`);
    console.log(fmtBuddy(b));
    restartClaude();
    console.log(`\n  Claude Code를 열고 ${C.bold}/buddy${C.reset} 를 입력하세요.`);
  } else {
    console.log(`\n나중에 적용하려면:`);
    for (const r of results) {
      console.log(`  ${C.dim}node buddy.js apply ${r.uid}${C.reset}`);
    }
  }

  rl.close();
}

// ── CLI 인수 파싱 ────────────────────────────────────────────────────────
// node buddy.js hunt cat legendary --hat=crown --eye=✦ --shiny --peak=CHAOS --min-CHAOS=70 --attempts=5000000 --apply
function parseHuntArgs(rawArgs) {
  const opts = {};
  for (const a of rawArgs) {
    if (!a.startsWith('--')) {
      if (SPECIES.includes(a))  opts.species = a;
      if (RARITIES.includes(a)) opts.rarity  = a;
      continue;
    }
    const eq  = a.indexOf('=');
    const key = eq === -1 ? a.slice(2) : a.slice(2, eq);
    const val = eq === -1 ? null       : a.slice(eq + 1);
    switch (key) {
      case 'rarity':   if (val) opts.rarity   = val; break;
      case 'eye':      opts.eye      = val || '';    break;
      case 'hat':      opts.hat      = val || '';    break;
      case 'peak':     opts.peak     = val || '';    break;
      case 'shiny':    opts.shiny    = true;         break;
      case 'no-shiny': opts.shiny    = false;        break;
      case 'apply':    opts.autoApply = true;        break;
      case 'attempts': if (val) opts.attempts = parseInt(val); break;
      default: {
        const m = key.match(/^min-([A-Z]+)$/);
        if (m && val) {
          opts.minStats = opts.minStats || {};
          opts.minStats[m[1]] = parseInt(val);
        }
      }
    }
  }
  return opts;
}

// ── ID 확인 메뉴 ──────────────────────────────────────────────────────────
async function checkMenu() {
  let uid = process.argv[3];
  if (!uid) uid = (await ask('확인할 ID를 입력하세요: ')).trim();
  if (!uid) { rl.close(); return; }
  const b = getBuddy(uid);
  console.log('\n결과:');
  console.log(fmtBuddy(b));
  rl.close();
}

// ── accountUuid 제거 메뉴 ────────────────────────────────────────────────
async function fixMenu() {
  const cfg = readConfig();
  if (!cfg?.oauthAccount?.accountUuid) {
    console.log(`${C.green}accountUuid가 없습니다. 이미 정상 상태입니다.${C.reset}`);
    rl.close();
    return;
  }
  console.log(`${C.gold}accountUuid 발견:${C.reset} ${cfg.oauthAccount.accountUuid}`);
  const ans = (await ask('제거하시겠습니까? (y/N): ')).trim().toLowerCase();
  if (ans === 'y') {
    const backup = CONFIG_PATH + '.bak.' + new Date().toISOString().replace(/[:.]/g, '-');
    fs.copyFileSync(CONFIG_PATH, backup);
    delete cfg.oauthAccount.accountUuid;
    delete cfg.companion;
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2));
    console.log(`${C.green}✓ 제거 완료!${C.reset}  백업: ${C.dim}${backup}${C.reset}`);
  }
  rl.close();
}

// ── 서브 커맨드 처리 ─────────────────────────────────────────────────────
const subcmd = process.argv[2];
if (subcmd === 'apply') {
  const uid = process.argv[3];
  if (!uid) { console.error('사용법: node buddy.js apply <ID>'); process.exit(1); }
  const backup = applyId(uid);
  const b = getBuddy(uid);
  console.log('\n적용된 buddy:');
  console.log(fmtBuddy(b));
  console.log(`\n${C.green}✓ 적용 완료!${C.reset}  백업: ${C.dim}${backup}${C.reset}`);
  restartClaude();
  console.log(`Claude Code를 열고 ${C.bold}/buddy${C.reset} 를 입력하세요.`);
  rl.close();
} else if (subcmd === 'hunt') {
  const opts = parseHuntArgs(process.argv.slice(3));
  huntMenu(opts).catch(err => { console.error(err); rl.close(); process.exit(1); });
} else if (subcmd === 'check') {
  checkMenu().catch(err => { console.error(err); rl.close(); });
} else if (subcmd === 'fix') {
  fixMenu().catch(err => { console.error(err); rl.close(); });
} else {
  main().catch(err => { console.error(err); rl.close(); process.exit(1); });
}

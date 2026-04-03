'use strict';
// buddy_worker.js — worker thread for parallel buddy search
// Do NOT run directly. Spawned by buddy.js via worker_threads.

const { workerData, parentPort } = require('worker_threads');
const crypto = require('crypto');

const SALT           = 'friend-2026-401';
const SPECIES        = ['duck','goose','blob','cat','dragon','octopus','owl','penguin',
                        'turtle','snail','ghost','axolotl','capybara','cactus','robot',
                        'rabbit','mushroom','chonk'];
const RARITIES       = ['common','uncommon','rare','epic','legendary']; // Claude Code 순서
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
const _WY_S0H=0xa0761d64,_WY_S0L=0x78bd642f,_WY_S1H=0xe7037ed1,_WY_S1L=0xa0b428db;
const _WY_S2H=0x8ebc6af0,_WY_S2L=0x9c88c6e3,_WY_S3H=0x589965cc,_WY_S3L=0x75374cc3;
function _wyMul64(ah,al,bh,bl){
  ah=ah>>>0;al=al>>>0;bh=bh>>>0;bl=bl>>>0;
  const a=[al&0xffff,(al>>>16)&0xffff,ah&0xffff,(ah>>>16)&0xffff];
  const b=[bl&0xffff,(bl>>>16)&0xffff,bh&0xffff,(bh>>>16)&0xffff];
  const t=[0,0,0,0,0,0,0,0];
  for(let i=0;i<4;i++)for(let j=0;j<4;j++)t[i+j]+=a[i]*b[j];
  for(let i=0;i<7;i++){t[i+1]+=Math.floor(t[i]/0x10000);t[i]&=0xffff;}
  return[((t[3]<<16)|t[2])>>>0,((t[1]<<16)|t[0])>>>0,((t[7]<<16)|t[6])>>>0,((t[5]<<16)|t[4])>>>0];
}
function _wyMix(ah,al,bh,bl){const[lh,ll,hh,hl]=_wyMul64(ah,al,bh,bl);return[(lh^hh)>>>0,(ll^hl)>>>0];}
const[_WY_IH,_WY_IL]=_wyMix(_WY_S0H,_WY_S0L,_WY_S1H,_WY_S1L);
function wyHash32(str){
  const bytes=Buffer.from(str,'utf8'),n=bytes.length;
  const r4=(o)=>((bytes[o+3]<<24)|(bytes[o+2]<<16)|(bytes[o+1]<<8)|bytes[o])>>>0;
  const r8h=(o)=>((bytes[o+7]<<24)|(bytes[o+6]<<16)|(bytes[o+5]<<8)|bytes[o+4])>>>0;
  const r8l=(o)=>((bytes[o+3]<<24)|(bytes[o+2]<<16)|(bytes[o+1]<<8)|bytes[o])>>>0;
  let s0h=_WY_IH,s0l=_WY_IL,s1h=_WY_IH,s1l=_WY_IL,s2h=_WY_IH,s2l=_WY_IL,i=0;
  while(i+48<n){
    [s0h,s0l]=_wyMix((r8h(i)^_WY_S1H)>>>0,(r8l(i)^_WY_S1L)>>>0,(r8h(i+8)^s0h)>>>0,(r8l(i+8)^s0l)>>>0);
    [s1h,s1l]=_wyMix((r8h(i+16)^_WY_S2H)>>>0,(r8l(i+16)^_WY_S2L)>>>0,(r8h(i+24)^s1h)>>>0,(r8l(i+24)^s1l)>>>0);
    [s2h,s2l]=_wyMix((r8h(i+32)^_WY_S3H)>>>0,(r8l(i+32)^_WY_S3L)>>>0,(r8h(i+40)^s2h)>>>0,(r8l(i+40)^s2l)>>>0);
    i+=48;
  }
  let ah,al,bh,bl;
  if(n<=16){
    if(n>=4){const e=n-4,q=(n>>3)<<2;ah=r4(0);al=r4(q);bh=r4(e);bl=r4(e-q);}
    else if(n>0){ah=0;al=(bytes[0]<<16)|(bytes[n>>1]<<8)|bytes[n-1];bh=0;bl=0;}
    else{ah=al=bh=bl=0;}
  }else{
    if(i>0){s0h=(s0h^s1h^s2h)>>>0;s0l=(s0l^s1l^s2l)>>>0;}
    let ri=0;
    while(ri+16<n-i){
      [s0h,s0l]=_wyMix((r8h(i+ri)^_WY_S1H)>>>0,(r8l(i+ri)^_WY_S1L)>>>0,(r8h(i+ri+8)^s0h)>>>0,(r8l(i+ri+8)^s0l)>>>0);
      ri+=16;
    }
    ah=r8h(n-16);al=r8l(n-16);bh=r8h(n-8);bl=r8l(n-8);
  }
  const[lh,ll,hh,hl]=_wyMul64((ah^_WY_S1H)>>>0,(al^_WY_S1L)>>>0,(bh^s0h)>>>0,(bl^s0l)>>>0);
  const[rh,rl,xh,xl]=_wyMul64((lh^_WY_S0H)>>>0,(ll^_WY_S0L^n)>>>0,(hh^_WY_S1H)>>>0,(hl^_WY_S1L)>>>0);
  return(rl^xl)>>>0;
}

function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

function rollRarity(rng) {
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

// ── 탐색 루프 ──────────────────────────────────────────────────────────────
const { filters, count } = workerData;
const {
  targetRarity, targetSpecies,
  filterEye, filterHat, filterShiny, filterPeak, filterMinStats,
} = filters;

const TICK = 50000;

for (let i = 0; i < count; i++) {
  if (i > 0 && i % TICK === 0) {
    parentPort.postMessage({ type: 'progress', count: TICK });
  }

  const uid    = crypto.randomUUID();
  const rng    = mulberry32(wyHash32(uid + SALT));
  const rarity = rollRarity(rng);
  if (rarity !== targetRarity) continue;
  const species = pick(rng, SPECIES);
  if (species !== targetSpecies) continue;

  const eye   = pick(rng, EYES);
  const hat   = rarity === 'common' ? 'none' : pick(rng, HATS); // common: hat rng 소비 없음
  const shiny = rng() < 0.01;
  const { stats, peak: peakStat } = rollStats(rng, rarity);

  if (filterEye              && eye      !== filterEye)  continue;
  if (filterHat              && hat      !== filterHat)  continue;
  if (filterShiny            && !shiny)                  continue;
  if (filterPeak             && peakStat !== filterPeak) continue;
  let skip = false;
  for (const [sn, sv] of Object.entries(filterMinStats)) {
    if (stats[sn] < sv) { skip = true; break; }
  }
  if (skip) continue;

  parentPort.postMessage({ type: 'result', result: { eye, hat, shiny, stats, uid, peak: peakStat } });
}

parentPort.postMessage({ type: 'done' });

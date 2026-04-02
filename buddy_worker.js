'use strict';
// buddy_worker.js — worker thread for parallel buddy search
// Do NOT run directly. Spawned by buddy.js via worker_threads.

const { workerData, parentPort } = require('worker_threads');
const crypto = require('crypto');

const SALT           = 'friend-2026-401';
const SPECIES        = ['duck','goose','blob','cat','dragon','octopus','owl','penguin',
                        'turtle','snail','ghost','axolotl','capybara','cactus','robot',
                        'rabbit','mushroom','chonk'];
const RARITIES       = ['legendary','epic','rare','uncommon','common'];
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

function fnv1a(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h;
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

  const uid    = crypto.randomBytes(32).toString('hex');
  const rng    = mulberry32(fnv1a(uid + SALT));
  const rarity = rollRarity(rng);
  if (rarity !== targetRarity) continue;
  const species = pick(rng, SPECIES);
  if (species !== targetSpecies) continue;

  const eye   = pick(rng, EYES);
  const hat   = pick(rng, HATS);
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

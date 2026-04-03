#!/usr/bin/env node
'use strict';
// find_cat.js — finds a shiny legendary cat UUID using wyHash32 + mulberry32
// Usage: node find_cat.js [shiny|any]

const crypto = require('crypto');
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
const os = require('os');
const fs = require('fs');
const path = require('path');

const WANT_SHINY = process.argv[2] !== 'any'; // default: shiny only

if (!isMainThread) {
  // ── Worker code ──────────────────────────────────────────────────────────
  const SALT = 'friend-2026-401';
  const SPECIES = ['duck','goose','blob','cat','dragon','octopus','owl','penguin',
                   'turtle','snail','ghost','axolotl','capybara','cactus','robot',
                   'rabbit','mushroom','chonk'];
  const RARITIES = ['common','uncommon','rare','epic','legendary']; // Claude Code 순서
  const RARITY_WEIGHTS = { legendary:1, epic:4, rare:10, uncommon:25, common:60 };
  const RARITY_FLOOR   = { common:5, uncommon:15, rare:25, epic:35, legendary:50 };
  const EYES   = ['·','✦','×','◉','@','°'];
  const HATS   = ['none','crown','tophat','propeller','halo','wizard','beanie','tinyduck'];
  const STATS  = ['DEBUGGING','PATIENCE','CHAOS','WISDOM','SNARK'];

  function mulberry32(s){return function(){s|=0;s=s+0x6D2B79F5|0;let t=Math.imul(s^s>>>15,1|s);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
  const _S0H=0xa0761d64,_S0L=0x78bd642f,_S1H=0xe7037ed1,_S1L=0xa0b428db;
  const _S2H=0x8ebc6af0,_S2L=0x9c88c6e3,_S3H=0x589965cc,_S3L=0x75374cc3;
  function _mul(ah,al,bh,bl){ah=ah>>>0;al=al>>>0;bh=bh>>>0;bl=bl>>>0;const a=[al&0xffff,(al>>>16)&0xffff,ah&0xffff,(ah>>>16)&0xffff],b=[bl&0xffff,(bl>>>16)&0xffff,bh&0xffff,(bh>>>16)&0xffff],t=[0,0,0,0,0,0,0,0];for(let i=0;i<4;i++)for(let j=0;j<4;j++)t[i+j]+=a[i]*b[j];for(let i=0;i<7;i++){t[i+1]+=Math.floor(t[i]/0x10000);t[i]&=0xffff;}return[((t[3]<<16)|t[2])>>>0,((t[1]<<16)|t[0])>>>0,((t[7]<<16)|t[6])>>>0,((t[5]<<16)|t[4])>>>0];}
  function _mix(ah,al,bh,bl){const[lh,ll,hh,hl]=_mul(ah,al,bh,bl);return[(lh^hh)>>>0,(ll^hl)>>>0];}
  const[_IH,_IL]=_mix(_S0H,_S0L,_S1H,_S1L);
  function wyHash32(s){const b=Buffer.from(s,'utf8'),n=b.length;const r4=(o)=>((b[o+3]<<24)|(b[o+2]<<16)|(b[o+1]<<8)|b[o])>>>0,r8h=(o)=>((b[o+7]<<24)|(b[o+6]<<16)|(b[o+5]<<8)|b[o+4])>>>0,r8l=(o)=>((b[o+3]<<24)|(b[o+2]<<16)|(b[o+1]<<8)|b[o])>>>0;let s0h=_IH,s0l=_IL,s1h=_IH,s1l=_IL,s2h=_IH,s2l=_IL,i=0;while(i+48<n){[s0h,s0l]=_mix((r8h(i)^_S1H)>>>0,(r8l(i)^_S1L)>>>0,(r8h(i+8)^s0h)>>>0,(r8l(i+8)^s0l)>>>0);[s1h,s1l]=_mix((r8h(i+16)^_S2H)>>>0,(r8l(i+16)^_S2L)>>>0,(r8h(i+24)^s1h)>>>0,(r8l(i+24)^s1l)>>>0);[s2h,s2l]=_mix((r8h(i+32)^_S3H)>>>0,(r8l(i+32)^_S3L)>>>0,(r8h(i+40)^s2h)>>>0,(r8l(i+40)^s2l)>>>0);i+=48;}let ah,al,bh,bl;if(n<=16){if(n>=4){const e=n-4,q=(n>>3)<<2;ah=r4(0);al=r4(q);bh=r4(e);bl=r4(e-q);}else if(n>0){ah=0;al=(b[0]<<16)|(b[n>>1]<<8)|b[n-1];bh=0;bl=0;}else{ah=al=bh=bl=0;}}else{if(i>0){s0h=(s0h^s1h^s2h)>>>0;s0l=(s0l^s1l^s2l)>>>0;}let ri=0;while(ri+16<n-i){[s0h,s0l]=_mix((r8h(i+ri)^_S1H)>>>0,(r8l(i+ri)^_S1L)>>>0,(r8h(i+ri+8)^s0h)>>>0,(r8l(i+ri+8)^s0l)>>>0);ri+=16;}ah=r8h(n-16);al=r8l(n-16);bh=r8h(n-8);bl=r8l(n-8);}const[lh,ll,hh,hl]=_mul((ah^_S1H)>>>0,(al^_S1L)>>>0,(bh^s0h)>>>0,(bl^s0l)>>>0);const[rh,rl,xh,xl]=_mul((lh^_S0H)>>>0,(ll^_S0L^n)>>>0,(hh^_S1H)>>>0,(hl^_S1L)>>>0);return(rl^xl)>>>0;}

  function pick(rng,arr){return arr[Math.floor(rng()*arr.length)];}
  function rollRarity(rng){let r=rng()*100;for(const x of RARITIES){r-=RARITY_WEIGHTS[x];if(r<0)return x;}return 'common';}
  function rollStats(rng,rar){const f=RARITY_FLOOR[rar],p=pick(rng,STATS);let d=pick(rng,STATS);while(d===p)d=pick(rng,STATS);const st={};for(const n of STATS){if(n===p)st[n]=Math.min(100,f+50+Math.floor(rng()*30));else if(n===d)st[n]=Math.max(1,f-10+Math.floor(rng()*15));else st[n]=f+Math.floor(rng()*40);}return{stats:st,peak:p,dump:d};}

  const { wantShiny } = workerData;
  const TICK = 50000;
  let count = 0;

  while (true) {
    if (count > 0 && count % TICK === 0) parentPort.postMessage({ type: 'tick', count: TICK });
    count++;
    const uid  = crypto.randomUUID();
    const rng  = mulberry32(wyHash32(uid + SALT));
    const rar  = rollRarity(rng);
    if (rar !== 'legendary') continue;
    const sp   = pick(rng, SPECIES);
    if (sp !== 'cat') continue;
    const eye  = pick(rng, EYES);
    const hat  = pick(rng, HATS); // legendary: hat 있음
    const shy  = rng() < 0.01;
    if (wantShiny && !shy) continue;
    const { stats, peak, dump } = rollStats(rng, rar);
    parentPort.postMessage({ type: 'found', uid, seed: wyHash32(uid+SALT), rarity: rar, species: sp, eye, hat, shiny: shy, stats, peak, dump });
    break;
  }
} else {
  // ── Main thread ──────────────────────────────────────────────────────────
  const N = Math.min(os.cpus().length, 16);
  console.log(`Searching for ${WANT_SHINY ? '✨ shiny ' : ''}legendary cat using ${N} workers...`);
  const start = Date.now();
  let total = 0;
  let done  = false;

  const workers = [];
  for (let i = 0; i < N; i++) {
    const w = new Worker(__filename, { workerData: { wantShiny: WANT_SHINY } });
    w.on('message', msg => {
      if (done) return;
      if (msg.type === 'tick') {
        total += msg.count;
        const elapsed = (Date.now() - start) / 1000;
        const rate    = (total / elapsed / 1000).toFixed(0);
        process.stdout.write(`\r  ${total.toLocaleString()} checked  ${rate}k/s  ${elapsed.toFixed(1)}s`);
      } else if (msg.type === 'found') {
        done = true;
        const elapsed = (Date.now() - start) / 1000;
        process.stdout.write('\r\x1b[K');
        console.log(`\n✅ FOUND after ${total.toLocaleString()} tries in ${elapsed.toFixed(2)}s`);
        const shTag = msg.shiny ? ' ✨ SHINY' : '';
        console.log(`  UUID   : ${msg.uid}`);
        console.log(`  seed   : ${msg.seed}`);
        console.log(`  buddy  : ${msg.rarity} ${msg.species}  eye=${msg.eye}  hat=${msg.hat}${shTag}`);
        console.log(`  peak   : ${msg.peak}  dump: ${msg.dump}`);
        console.log(`  stats  : ${JSON.stringify(msg.stats)}`);
        const result = { uuid: msg.uid, seed: msg.seed, rarity: msg.rarity, species: msg.species, eye: msg.eye, hat: msg.hat, shiny: msg.shiny, stats: msg.stats, peak: msg.peak, dump: msg.dump, found_at: new Date().toISOString() };
        fs.writeFileSync(path.join(__dirname, 'LEGENDARY_CAT_FOUND.json'), JSON.stringify(result, null, 2));
        console.log(`\n  Saved → LEGENDARY_CAT_FOUND.json`);
        console.log(`\n  Apply with:\n    node buddy.js apply "${msg.uid}"`);
        workers.forEach(w => w.terminate());
      }
    });
    w.on('error', err => console.error('Worker error:', err));
    workers.push(w);
  }
}

# Claude Code Buddy Reroll

> 🇰🇷 [한국어 가이드는 아래에 있습니다](#claude-code-buddy-reroll--한국어-가이드)

Reroll your Claude Code `/buddy` companion to the exact species, rarity, cosmetics, and stats you want — using an interactive CLI that guides you through every step.

---

## Quick Start

```bash
cd ~/buddy-reroll
node buddy.js
```

That's it. The CLI walks you through everything.

---

## How to Use

### 1. Launch the CLI

```bash
node buddy.js
```

You'll see a menu like this:

```
=== Buddy Reroll ===
1) Hunt for a buddy
2) Check a buddy ID
3) Apply a buddy ID
4) Fix accountUuid (Pro/Team users)
0) Exit
```

---

### 2. Hunt — find a buddy you want

Choose **[1] Hunt**.

The CLI will ask you one question at a time:

```
Species? (duck / goose / blob / cat / dragon / ...)
Rarity?  (common / uncommon / rare / epic / legendary)
Hat?     (none / crown / tophat / propeller / halo / wizard / beanie / tinyduck / any)
Eye?     (· / ✦ / × / ◉ / @ / ° / any)
Shiny?   (yes / no / any)
Peak stat? (DEBUGGING / PATIENCE / CHAOS / WISDOM / SNARK / any)
```

Just answer each prompt. Press Enter to skip any condition and accept anything.

The search runs in parallel across all your CPU cores. When a match is found, the result is shown with full stats.

---

### 3. Apply — set your buddy

After a hunt you'll be asked which result to apply, or you can choose **[3] Apply** from the main menu and paste the ID directly.

Applying writes the ID to `~/.claude.json` and restarts Claude automatically.

---

### 4. Check — preview any ID

Choose **[2] Check** and paste an ID (or type `auto` to see your current active buddy) to preview what it looks like before committing.

---

### 5. Fix — for Pro/Team plan users

If your buddy resets after re-login, choose **[4] Fix**. This removes `accountUuid` from `~/.claude.json`, which otherwise overrides your custom ID.

> **Why does this happen?** Claude uses `accountUuid` over `userID` when both exist. Re-login writes `accountUuid` back. Running Fix removes it again.

To automate this, add to `~/.bashrc`:
```bash
alias claude='node -e "const f=require(\"os\").homedir()+\"/.claude.json\";try{const c=JSON.parse(require(\"fs\").readFileSync(f));if(c.oauthAccount?.accountUuid){delete c.oauthAccount.accountUuid;delete c.companion;require(\"fs\").writeFileSync(f,JSON.stringify(c,null,2));}}catch{}" && command claude'
```

---

## How It Works (background)

Buddy is **not random** — it's deterministic. Claude hashes your identity with a fixed salt (`friend-2026-401`) using FNV-1a, then drives a Mulberry32 PRNG to produce species, rarity, eye, hat, shiny, and stats.

Same identity → always the same buddy. So the tool brute-forces millions of random IDs until it finds one that produces the buddy you asked for, then writes that ID to your config.

---

## Species, Rarity & Stats — at a glance

**18 species:** `duck` `goose` `blob` `cat` `dragon` `octopus` `owl` `penguin` `turtle` `snail` `ghost` `axolotl` `capybara` `cactus` `robot` `rabbit` `mushroom` `chonk`

**5 rarities:** common (60%) · uncommon (25%) · rare (10%) · epic (4%) · **legendary (1%)**

**6 eye shapes:** `·` `✦` `×` `◉` `@` `°`

**8 hats:** `none` `crown` `tophat` `propeller` `halo` `wizard` `beanie` `tinyduck`

**✨ Shiny:** 1% chance — legendary + shiny ≈ 1 in 8,600,000

**5 stats:** `DEBUGGING` `PATIENCE` `CHAOS` `WISDOM` `SNARK`  
Legendary ranges: peak = 100, others = 50–89, dump = 40–54

---

## Advanced: CLI Flags (skip the prompts)

If you already know exactly what you want, pass everything as flags to skip the interactive questions:

```bash
# legendary cat, crown, star eye, shiny, CHAOS as the peak stat
node buddy.js hunt cat legendary --hat=crown --eye=✦ --shiny --peak=CHAOS

# same, but auto-apply the first result immediately
node buddy.js hunt cat legendary --hat=crown --shiny --apply

# require CHAOS ≥ 70 even though it's not the peak
node buddy.js hunt cat legendary --peak=SNARK --min-CHAOS=70

# check or apply by ID directly
node buddy.js check 1681a12f5d082fe4...
node buddy.js apply 1681a12f5d082fe4...
```

Any flag you omit still gets asked interactively — flags and prompts mix freely.

---

## Notes

- A backup of `~/.claude.json` is saved automatically before any change (`~/.claude.json.bak.<timestamp>`).
- Removing `accountUuid` does **not** affect authentication — OAuth tokens handle that separately.
- If Claude updates its internal salt, a new hunt will be needed.

---

---

# Claude Code Buddy Reroll — 한국어 가이드

> 🇺🇸 [English guide is above](#claude-code-buddy-reroll)

Claude Code의 `/buddy` 컴패니언을 원하는 종류·레어리티·외형·스탯으로 바꿉니다.  
모든 과정은 대화형 CLI가 안내해 줍니다.

---

## 빠른 시작

```bash
cd ~/buddy-reroll
node buddy.js
```

이게 전부입니다. CLI가 차례로 질문합니다.

---

## 사용 방법

### 1. CLI 실행

```bash
node buddy.js
```

아래와 같은 메뉴가 뜹니다:

```
=== Buddy Reroll ===
1) 버디 탐색 (Hunt)
2) ID 미리보기 (Check)
3) ID 적용 (Apply)
4) accountUuid 제거 (Fix) — Pro/Team 사용자
0) 종료
```

---

### 2. Hunt — 원하는 버디 찾기

**[1] Hunt** 를 선택하면 CLI가 하나씩 물어봅니다:

```
종류(species)?  duck / goose / blob / cat / dragon / ...
레어리티?       common / uncommon / rare / epic / legendary
모자(hat)?      none / crown / tophat / propeller / halo / wizard / beanie / tinyduck / 전부
눈(eye)?       · / ✦ / × / ◉ / @ / ° / 전부
Shiny?         yes / no / 전부
Peak 스탯?     DEBUGGING / PATIENCE / CHAOS / WISDOM / SNARK / 전부
```

조건이 없는 항목은 그냥 Enter를 누르면 됩니다.  
탐색은 여러 CPU 코어를 동시에 사용하므로 대부분 수초 내에 완료됩니다.  
결과가 나오면 스탯 전체와 외형을 보여줍니다.

---

### 3. Apply — 버디 적용하기

Hunt 완료 후 바로 적용 여부를 묻거나, 메인 메뉴의 **[3] Apply** 에서 ID를 붙여넣어도 됩니다.

적용하면 `~/.claude.json`에 ID가 저장되고 Claude가 자동으로 재시작됩니다.

---

### 4. Check — ID 미리보기

**[2] Check** 에서 ID를 붙여넣으면 (또는 `auto` 입력 시 현재 적용된 버디를) 적용 전에 외형을 미리 볼 수 있습니다.

---

### 5. Fix — Pro/Team 사용자용

재로그인 후 버디가 바뀌었다면 **[4] Fix** 를 실행하세요.  
`~/.claude.json`에서 `accountUuid`를 제거합니다.

> **왜 바뀌나요?** Claude는 `accountUuid`가 있으면 `userID` 대신 그걸 씁니다. 재로그인하면 `accountUuid`가 다시 생겨서 우리가 설정한 ID가 무시됩니다. Fix는 그걸 지워줍니다.

재로그인할 때마다 자동으로 처리하려면 `~/.bashrc`에 추가:
```bash
alias claude='node -e "const f=require(\"os\").homedir()+\"/.claude.json\";try{const c=JSON.parse(require(\"fs\").readFileSync(f));if(c.oauthAccount?.accountUuid){delete c.oauthAccount.accountUuid;delete c.companion;require(\"fs\").writeFileSync(f,JSON.stringify(c,null,2));}}catch{}" && command claude'
```

---

## 원리 (배경 지식)

버디는 랜덤이 아닙니다. 내 ID + 고정 salt(`friend-2026-401`)를 FNV-1a로 해시하고 Mulberry32 PRNG로 종류·레어리티·눈·모자·shiny·스탯을 결정합니다.

같은 ID → 항상 같은 버디. 그래서 이 도구는 수백만 개의 랜덤 ID를 브루트포스로 돌려서 원하는 버디가 나오는 ID를 찾은 뒤 config에 씁니다.

---

## 종류·레어리티·스탯 한눈에 보기

**18종:** `duck` `goose` `blob` `cat` `dragon` `octopus` `owl` `penguin` `turtle` `snail` `ghost` `axolotl` `capybara` `cactus` `robot` `rabbit` `mushroom` `chonk`

**5단계 레어리티:** common(60%) · uncommon(25%) · rare(10%) · epic(4%) · **legendary(1%)**

**눈 6종:** `·` `✦` `×` `◉` `@` `°`

**모자 8종:** `none` `crown` `tophat` `propeller` `halo` `wizard` `beanie` `tinyduck`

**✨ Shiny:** 1% 확률 — legendary + 특정 종 + shiny ≈ 860만 분의 1

**스탯 5개:** `DEBUGGING` `PATIENCE` `CHAOS` `WISDOM` `SNARK`  
Legendary 범위: peak = 100, 일반 = 50–89, dump = 40–54

---

## 고급: CLI 플래그 (프롬프트 건너뛰기)

원하는 조건을 이미 알고 있다면 플래그로 직접 지정해서 질문을 생략할 수 있습니다:

```bash
# legendary cat, crown 모자, 별 눈, shiny, CHAOS가 peak
node buddy.js hunt cat legendary --hat=crown --eye=✦ --shiny --peak=CHAOS

# 첫 번째 결과를 바로 적용
node buddy.js hunt cat legendary --hat=crown --shiny --apply

# SNARK이 peak이고 CHAOS도 70 이상
node buddy.js hunt cat legendary --peak=SNARK --min-CHAOS=70

# ID로 직접 확인/적용
node buddy.js check 1681a12f5d082fe4...
node buddy.js apply 1681a12f5d082fe4...
```

플래그를 지정한 항목은 질문을 건너뛰고, 지정하지 않은 항목은 여전히 대화형으로 묻습니다.

---

## 종 외형 (ASCII Sprites)

눈 기호는 실제 설정값으로 치환됩니다. 아래는 기본 눈(`·`) 기준.

```
duck                goose               blob
 __                  (·>                 .----.
<(· )___             ||                 ( · · )
 ( ._>               _(__)_             (      )
 `--´                ^^^^               `----´

cat                 dragon              octopus
 /\_/\               /^\ /^\             .----.
( · ·)              < · · >            ( · · )
( ω )               ( ~~ )             (______)
(")_(")              `-vvvv-´            /\/\/\/\

owl                 penguin             turtle
 /\ /\               .---.              _,--._
((·)(·))            (·>·)              ( · · )
( >< )              /( )\              /[______]\
`----´              `---´               ``  ``

snail               ghost               axolotl
 · .--.              .----.           }~(______)~{
 \ ( @ )            / · · \          }~(· .. ·)~{
  \_`--´            |      |           ( .--. )
  ~~~~~~~           ~`~``~`~            (_/ \_)

capybara            cactus              robot
 n______n            n ____ n            .[||].
 ( · · )            | |· ·| |          [ · · ]
 ( oo )             |_|   |_|          [ ==== ]
 `------´             | |              `------´

rabbit              mushroom            chonk
 (\__/)              .-o-OO-o-.          /\ /\
 ( · · )           (__________)        ( · · )
 =( .. )=            |· ·|             ( .. )
 (")__(")            |____|            `------´
```

모자 착용 시 첫 줄에 추가:
```
crown    tophat   propeller  halo     wizard   beanie   tinyduck
\^^^/    [___]      -+-      ( )      /^\      (___)     ,>
```

레어리티별 색상: common 회색 · uncommon 초록 · rare 파랑 · epic 보라 · **legendary 황금**

---

## 주의사항

- 적용/Fix 시 `~/.claude.json`이 수정되기 전에 자동으로 백업됩니다 (`~/.claude.json.bak.날짜시간`).
- `accountUuid` 제거는 인증에 영향 없습니다 (OAuth 토큰이 인증을 처리).
- Claude Code가 내부 salt를 바꾸면 다시 탐색이 필요합니다.

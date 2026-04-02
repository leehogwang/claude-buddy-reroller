# Claude Code Buddy Reroll — 한국어 가이드

Claude Code의 `/buddy` 컴패니언을 원하는 species + rarity로 바꾸는 도구 모음.

---

## 원리 요약

Buddy는 랜덤이 아닙니다. 내 ID + 고정 salt(`friend-2026-401`)를 FNV-1a로 해시한 뒤 Mulberry32 PRNG로 생성합니다.  
같은 ID → 항상 같은 buddy. 따라서 **원하는 buddy가 나오는 ID를 미리 찾아서 config에 적으면** 됩니다.

```
identity + "friend-2026-401"  →  FNV-1a 해시  →  Mulberry32 seed
                                                        │
                                              rarity / species / eye / hat / shiny / stats
```

identity 결정 순서:
```
oauthAccount.accountUuid  ??  userID  ??  "anon"
```
⚠️ **Pro/Team 플랜 사용자**는 `accountUuid`가 `userID`를 덮어씁니다. `fix.sh`로 제거 필요.

---

## 도구 목록

| 파일 | 역할 |
|------|------|
| `buddy.js` | **메인 CLI** — 탐색 / 확인 / 적용 / accountUuid 제거 통합 |
| `buddy_worker.js` | 병렬 탐색 worker (buddy.js가 자동 스폰) |

---

## 단계별 사용법

### Step 1. 현재 상태 확인
```bash
cd ~/buddy-reroll
node verify.js auto
```
→ 어떤 ID가 쓰이고 있는지, 현재 buddy가 뭔지 출력.

### Step 2. 원하는 buddy ID 탐색
```bash
# legendary cat 탐색 (최대 50만 시도, 보통 수초 내 완료)
node reroll.js cat

# 더 안전하게 200만 시도
node reroll.js dragon 2000000

# 모든 종을 동시에 탐색 (백그라운드)
for s in duck goose blob cat dragon octopus owl penguin turtle snail ghost axolotl capybara cactus robot rabbit mushroom chonk; do
  node reroll.js $s 100000 &
done
wait
```

### Step 3. ID 검증
```bash
node verify.js <찾은_ID>
```

### Step 4. ~/.claude.json 수정

**1) accountUuid 없애기 + userID 설정** (Pro/Team 사용자)
```bash
# 먼저 fix.sh로 accountUuid 제거
bash fix.sh

# 그다음 ~/.claude.json 에서 userID를 직접 설정
```

`~/.claude.json` 최종 형태:
```json
{
  "oauthAccount": {
    "emailAddress": "you@example.com",
    "organizationName": "Your Plan"
  },
  "userID": "여기에_찾은_ID_입력"
}
```
※ `accountUuid`는 없어야 하며, `companion` 필드도 있으면 삭제.

**2) Free 플랜 사용자** (accountUuid 없음)
```json
{
  "userID": "여기에_찾은_ID_입력"
}
```

### Step 5. 재시작 및 확인
```bash
# Claude Code 재시작 후
/buddy
```

---

## 재로그인 후 buddy가 바뀌었을 때

재로그인하면 `accountUuid`가 다시 쓰여집니다.  
그냥 fix.sh 다시 실행하면 됩니다:
```bash
bash ~/buddy-reroll/fix.sh
```
`userID`는 재로그인해도 유지되므로 같은 레어리티의 buddy가 돌아옵니다 (이름/성격은 새로 생성됨).

자동화하려면 `~/.bashrc`에 추가:
```bash
alias claude='node -e "const f=require(\"os\").homedir()+\"/.claude.json\";try{const c=JSON.parse(require(\"fs\").readFileSync(f));if(c.oauthAccount?.accountUuid){delete c.oauthAccount.accountUuid;delete c.companion;require(\"fs\").writeFileSync(f,JSON.stringify(c,null,2));}}catch{}" && command claude'
```

---

## shiny / 코스메틱 / 스탯 탐색

눈, 모자, shiny, peak 스탯, 특정 스탯 최솟값까지 원하는 조합을 탐색:
```bash
# 기본 탐색
node shiny_hunt.js cat 5000000

# 옵션 필터
node shiny_hunt.js cat 10000000 --hat=crown           # legend cat + crown
node shiny_hunt.js cat 10000000 --hat=crown --eye=✦   # + 시시별 눈
node shiny_hunt.js cat 10000000 --hat=crown --shiny    # + shiny (= 기본값)
node shiny_hunt.js cat 10000000 --no-shiny             # shiny 없이

# 스탯 필터
node shiny_hunt.js cat 10000000 --peak=CHAOS                  # CHAOS가 peak (100)
node shiny_hunt.js cat 10000000 --peak=SNARK --min-CHAOS=70   # SNARK peak + CHAOS 70이상
node shiny_hunt.js cat 50000000 --hat=crown --eye=✦ --peak=CHAOS  # 모두 조합
```

**`shiny_hunt.js` 전체 플래그 목록:**

| 플래그 | 설명 |
|------|------|
| `--hat=<hat>` | 지정한 모자만 (none/crown/tophat/propeller/halo/wizard/beanie/tinyduck) |
| `--eye=<eye>` | 지정한 눈 모양만 (`·` `✦` `×` `◉` `@` `°`) |
| `--shiny` | shiny만 (= **기본값**) |
| `--no-shiny` | shiny 없는 것도 허용 |
| `--peak=<STAT>` | 해당 스탯이 peak(=100)인 것만 |
| `--min-<STAT>=N` | 해당 스탯이 N 이상인 것만 (eg. `--min-CHAOS=70`) |

**확률 표:**

| 조합 | 확률 |
|------|------|
| Legendary + 특정 species | ~0.056% |
| + 특정 눈 | ~0.0093% |
| + 특정 모자 | ~0.0012% |
| + shiny | ~0.000012% (약 860만 분의 1) |
| + peak 스탯 지정 | ×1/5 추가 |

---

## buddy.js — 대화형 CLI 리롤러

`buddy.js`는 버디 탐색부터 적용까지 한 번에 처리하는 열라운 CLI입니다.  
**CLI 플래그** 로 지정하거나, 지정 안 한 항목은 **대화형 프롬프트**로 업대어 받는 **하이브리드** 방식.

### 서브커맨드 일람

```bash
# 대화형 메인 메뉴 (전체 안내)
node buddy.js

# hunt: 탐색 (= 메인 메뉴 1번)
node buddy.js hunt
node buddy.js hunt cat legendary --hat=crown --eye=✦ --shiny --peak=CHAOS
node buddy.js hunt cat legendary --hat=crown --shiny --apply     # 첫 번째 결과 자동 적용

# check: buddy 미리보기 (수정 없음)
node buddy.js check <ID>

# apply: ID 즉시 적용 + Claude 자동 재시작
node buddy.js apply <ID>

# fix: accountUuid 제거
node buddy.js fix
```

### hunt 플래그 전체 목록

```
node buddy.js hunt [species] [rarity] [options]
```

| 포지셔널 인수 | 설명 |
|------|------|
| `<species>` | duck goose blob cat dragon octopus owl penguin turtle snail ghost axolotl capybara cactus robot rabbit mushroom chonk |
| `<rarity>` | common uncommon rare epic **legendary** |

| 플래그 | 설명 |
|------|------|
| `--rarity=<rarity>` | 레어리티 지정 (포지셔널 대신 사용 가능) |
| `--eye=<eye>` | 눈 모양 (`·` `✦` `×` `◉` `@` `°`) |
| `--hat=<hat>` | 모자 (none/crown/tophat/propeller/halo/wizard/beanie/tinyduck) |
| `--shiny` | shiny인 것만 |
| `--no-shiny` | shiny 없는 것도 허용 |
| `--peak=<STAT>` | Peak 스탯 지정 (DEBUGGING/PATIENCE/CHAOS/WISDOM/SNARK) |
| `--min-<STAT>=N` | 해당 스탯 최솟값 (`--min-CHAOS=70` 등) |
| `--attempts=N` | 루프 최대 횟수 (10,000 ~ 200,000,000) |
| `--apply` | 마족하는 첫 번째 결과를 자동으로 적용 + Claude 재시작 |

### 실제 예시

```bash
# 1) 대화형 (species/rarity만 지정, 나머지는 프롬프트)
node buddy.js hunt cat legendary

# 2) 완전 비대화형 (질문 없이 바로 타)
node buddy.js hunt cat legendary --hat=crown --eye=✦ --shiny --peak=CHAOS --attempts=50000000

# 3) 자동 적용 (첫 번째 결과가 나오면 즉시 ~/.claude.json 수정)
node buddy.js hunt cat legendary --hat=crown --shiny --apply

# 4) 미리보기
node buddy.js check 1681a12f5d082fe4...

# 5) 입마없는 삵이화 (ID만 알면 바로 적용)
node buddy.js apply 1681a12f5d082fe4...
```

> ⚠️ `--apply`는 마지막에 한 번만 적용 원하면 `--apply` 없이 돌리고 탐색 완료 후 이전 결과나 원하는 번호를 직접 `node buddy.js apply <ID>`가 더 안전합니다.

---

## 전체 옵션 목록

### 종류 (Species) — 18종
| | | | |
|---|---|---|---|
| duck | goose | blob | cat |
| dragon | octopus | owl | penguin |
| turtle | snail | ghost | axolotl |
| capybara | cactus | robot | rabbit |
| mushroom | chonk | | |

### 레어리티 (Rarity) — 5단계
| 등급 | 확률 |
|------|------|
| common | 60% |
| uncommon | 25% |
| rare | 10% |
| epic | 4% |
| **legendary** | **1%** |

### 눈 (Eye) — 6종
| 기호 | 이름 |
|------|------|
| `·` | Dot |
| `✦` | Star |
| `×` | Cross |
| `◉` | Bullseye |
| `@` | At sign |
| `°` | Circle |

### 모자 (Hat) — 8종 (common은 항상 none)
| 이름 | 모양 |
|------|------|
| none | — |
| crown | `\^^^/` |
| tophat | `[___]` |
| propeller | `-+-` |
| halo | `( )` |
| wizard | `/^\` |
| beanie | `(___)` |
| tinyduck | 머리 위에 아기 오리 |

### ✨ Shiny
- 확률 **1%** (hat 뽑기 다음에 롤)
- legendary + shiny = **약 100분의 1** (legendary 중에서)
- legendary + 특정 종 + shiny = **약 860만 분의 1**

### 스탯 (Stats) — 5개
`DEBUGGING` / `PATIENCE` / `CHAOS` / `WISDOM` / `SNARK`

레어리티별 스탯 기본값(floor):

| 등급 | floor |
|------|-------|
| common | 5 |
| uncommon | 15 |
| rare | 25 |
| epic | 35 |
| **legendary** | **50** |

peak 스탯은 floor+50~79, dump 스탯은 floor-10~4, 나머지는 floor~floor+39.

---

## 종 외형 (ASCII Sprites)

화면에서 `{E}` 자리에 내 눈 기호가 들어갑니다. 아래는 기본 눈(`·`) 기준 rest 프레임.

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

### 모자 착용 시 외형 (첫 줄에 모자 추가)

```
crown    tophat   propeller  halo     wizard   beanie   tinyduck
\^^^/    [___]      -+-      ( )      /^\      (___)     ,>
```

### 레어리티별 색상 (터미널 렌더 기준)

| 등급 | 색상 |
|------|------|
| common | 회색 |
| uncommon | 초록 |
| rare | 파랑 |
| epic | 보라 |
| **legendary** | **황금** |

---

## 주의사항

- 이 도구들은 **어떤 파일도 자동으로 수정하지 않습니다** (`fix.sh` 제외).
- `fix.sh`는 실행 전 자동으로 백업을 만듭니다 (`~/.claude.json.bak.날짜시간`).
- `accountUuid` 제거는 인증에 영향 없습니다 (인증은 OAuth 토큰이 처리).
- Claude Code 업데이트나 salt 변경 시 reroll이 필요할 수 있습니다.

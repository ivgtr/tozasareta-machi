# Planning 最終ブラッシュアップ計画

> 本ドキュメントは、`#33 Placement Contract` → `#34 Planning配置UX` → `#35 Town FX` の続きとして行う **Planning画面の最終仕上げ計画**である。
>
> 目的は、現在の直接操作UXを維持したまま、人物詳細の閲覧経路を復活し、施設上の幾何学的な配置エフェクトを撤去し、町上の人物駒を高品質な汎用人型pixel tokenへ置き換えること。
>
> この文書自体は実装を含まない。別実装者は本書を実装仕様として使用し、設計判断を増やさず、この契約へ収束させること。

---

## 0. 前提・依存関係

### Base

本計画は以下を前提とする。

```text
#33 refactor: 配置契約とPlanning状態を一本化
 ↓
#34 feat: Planning配置UXを直接操作へ刷新
 ↓
#35 feat: 街の環境FXをワールド表現へ刷新
 ↓
本計画
```

実装開始時点では `feat/town-fx-polish` の最新headを基準とする。#35がmainへmerge済みならmainを基準へ読み替える。

### 現在成立している重要な契約

- `PlanningIntent` が配置操作の正である
- 人物クリックは「人物詳細を開く」ではなく「配置対象人物を選ぶ」操作である
- 人物選択中もTown viewportはoverviewを維持する
- 人物先行、施設先行、DnDは同じ配置契約へ収束している
- 施設の配置可否は `derivePlacementCandidate()` 系の純粋ロジックが正である
- `TownAmbienceModel` は状態意味の正であり、#35でrendererだけがワールド内FXへ刷新されている
- Town / Facility / Tokenは `docs/23-町アセット制作計画.md` のworld art contractに従う
- セーブ形式、GameState、ゲームバランスは本計画の対象外

これらを後方互換目的で二重化しない。

---

## 1. 今回解決する問題

### 1.1 人物詳細の閲覧経路が消えた

#34で旧 `CharacterFocus` を削除し、人物クリックを配置操作へ一本化した結果、以下を確認する常設経路がなくなった。

- 大きなportrait
- 名前 / 二つ名
- 健康状態
- 現在配置
- 労力 / 技術 / 医療 / 人望
- 特性
- flavor
- 成長値

配置UXを旧仕様へ戻すのではなく、**配置操作と人物閲覧を別の状態として再導入する**。

### 1.2 施設グラフィックと配置用フットプリント表示が視覚的にずれている

現在は施設画像とは別に96×48 footprint由来のdiamondを `Graphics` で描いている。

これは入力geometryとしては正しいが、96×112の完成施設アートのシルエットとは一致しない。

完成度の高い施設アートの上に「入力判定可視化」のような幾何学図形が常設され、世界表現を弱めている。

**geometryは入力判定にだけ使い、表示から撤去する。**

### 1.3 町上の人物tokenが施設アートに対して記号的すぎる

現在の24×32 tokenはportrait別画像に加えて、適性badge、矩形outline、負傷tint等のUI表現を重ねている。

町・施設・環境FXの品質向上に対して、人物だけが「UI駒」に見える。

**汎用の人型pixel characterへ置き換え、町の中に人が立っている表現へ寄せる。**

---

## 2. 設計原則

今回の実装は次の4原則を守る。

1. **操作の意味と閲覧の意味を混ぜない**
   - 人物選択 = 配置対象の決定
   - 人物詳細 = 情報閲覧

2. **表示とhit geometryを分離する**
   - footprint = 内部のクリック / drop判定
   - facility art = プレイヤーが見る対象

3. **Town側は世界表現を主役にする**
   - 状態 = facility art + Town FX
   - 配置feedback = 必要最小限の明暗とラベル
   - 人物 = 人型pixel character

4. **ゲームコアへPresentation都合の概念を持ち込まない**
   - `Unit` にgenderやtoken typeを追加しない
   - save schemaを変更しない
   - token appearanceはscene / art層だけで管理する

---

# 3. Track A — Character Inspector

## 3.1 目的

配置操作を維持したまま、人物詳細を確認できる独立Presentationを追加する。

旧 `CharacterFocus` をそのまま戻してはいけない。

旧実装で問題だった、

```text
selectedUnit
= 配置対象
= 詳細対象
= viewport target
= Presentation state
```

という責務混在を再発させない。

---

## 3.2 操作フロー

### 基本フロー

```text
CharacterDeckの人物をクリック
 ↓
従来どおりPlacement mode
 ↓
PlacementStatusを表示
 ↓
[詳細] を押す
 ↓
CharacterInspectorを表示
 ↓
[閉じる] / Escape
 ↓
元のPlacement modeへ戻る
```

CharacterInspectorを開閉しても、選択中の配置人物は維持する。

### PlacementStatus

現在の `PlacementStatus` に `詳細` ボタンを追加する。

概念レイアウト:

```text
┌──────────────────────────┐
│ [portrait] 真壁史子        │
│            配置先を選択     │
│            緑の施設...      │
│                 [詳細][閉じる]│
└──────────────────────────┘
```

実寸はwide / narrowで調整してよいが、Townの可視領域を大きく侵食してはならない。

---

## 3.3 CharacterInspector の内容

旧CharacterFocusの情報設計を参考に、以下を1画面へ収める。

- portrait
- name
- alias
- condition
- current assignment
- aptitude 4種
- traits
- flavor
- xp / growth threshold
- 閉じる

wideでは右側またはTown内の空き側へoverlayする。

narrowではTown上にmodal的に配置してよい。

### 禁止

- Inspectorを開くためにカメラをzoom / panしない
- Inspector用にTown viewport presetを追加しない
- Inspectorを開いた瞬間にplacement intentを解除しない
- `PlanningIntent` にinspect状態を追加しない

---

## 3.4 状態管理

推奨構造:

```ts
private inspectedUnitId: string | null
```

または同等のscene-local Presentation state。

重要なのは、

```ts
PlanningIntent
```

とは独立していること。

### 状態例

```text
PlanningIntent = { kind: 'unit-to-facility', unitId: 'mayor' }
inspectedUnitId = 'mayor'
```

は合法。

Inspectorを閉じると、

```text
PlanningIntent = { kind: 'unit-to-facility', unitId: 'mayor' }
inspectedUnitId = null
```

へ戻る。

---

## 3.5 入力優先順位

Escape等の閉じる操作は次の優先順にする。

```text
CharacterInspector
 ↓
FacilityFocus
 ↓
PlacementStatus / PlanningIntent
 ↓
Planning
```

CharacterInspector表示中はTownへの配置クリックを通さない。

配置intent自体は保存しておき、Inspectorを閉じたら再開する。

---

## 3.6 E2E bridge整理

現在の旧命名を整理する。

削除 / 改名候補:

```text
characterFocusOpen
character-focus-first-open
character-focus-second-open
```

新規:

```text
characterInspectorOpen
placementStatusOpen
```

`PresentationMode === 'unit-focus'` を `characterFocusOpen` とみなすような疑似契約は残さない。

ただし `PresentationMode` 自体の `unit-focus` renameは今回の非目標とする。配置側の既存契約へ不要なchurnを起こさない。

---

# 4. Track B — Art-aligned Facility Interaction

## 4.1 目的

施設上に描いている幾何学的diamond / footprint UIを表示から撤去し、完成facility artそのものを操作対象として見せる。

**入力geometryは維持する。**

---

## 4.2 削除する表示

`TownLayer` の以下の視覚表現を削除する。

- 全施設へ常時描画しているfootprint outline
- working / danger用footprint outline
- selected facility用gold diamond
- placement candidate用fill diamond
- placement candidate用outline diamond
- drag hover用 `dropHighlight` diamond

概念的には以下を削除する。

```text
Graphics.strokePoints(footprintDiamond(...))
Graphics.fillPoints(footprintDiamond(...))
```

footprint geometry関数自体は削除しない。

---

## 4.3 通常Planning

通常時の施設表示は原則として以下だけにする。

```text
facility sprite
+ facility state artwork
+ TownAmbienceのworld FX
```

施設名はhover時に表示する。

危険状態は `power-low` / `road-collapsed` 等の施設画像とTown FXで伝える。

常設の赤枠 / 黄枠を復活させない。

---

## 4.4 Placement mode

配置候補を「図形を足す」のではなく、「不可能な施設を引く」ことで表現する。

### available / current

```text
sprite alpha = 1
通常の施設アートをそのまま表示
```

### blocked / passive

```text
sprite alpha ≒ 0.40–0.55
```

厳密値は実画面で決めてよい。

重要なのは、配置可能施設に緑の大きなoverlayを追加しないこと。

### hover

hoverした施設だけ、ラベルを表示する。

例:

```text
発電設備
配置可能
```

```text
発電設備
予算不足
```

```text
対策本部
配置不可
```

placement mode中に全施設名 / 全ステータスを常設しない。

---

## 4.5 DnD hover

`dropHighlight` を使用しない。

ドラッグ中の現在targetだけを強調する。

### valid target

- target spriteをalpha 1で維持
- 他のblocked spriteはdimのまま
- hover labelに `配置` / `配置可能` を表示

### invalid target

- dim状態を維持
- hover labelに不可理由を表示

必要ならtarget spriteへ弱いTintを使ってよいが、以下は禁止。

- glow / blur
- non-pixelなpost FX
- 大きな半透明fill
- footprint shapeの再導入

---

## 4.6 FacilityFocus中

FacilityFocusを開いている施設は、facility labelをpersistentにしてよい。

ただし選択状態を示すためにgold diamondを再導入しない。

FacilityFocusパネル自体が十分なselected stateなので、Town側は最小表示とする。

---

## 4.7 入力契約は維持

削除してはいけないもの:

- `footprintDiamond()`
- facility transparent pixel + footprintの複合hit判定
- `facilityAt()`
- DnD drop location判定
- E2Eのfacility art point / footprint point検証

つまり、

```text
Geometry = 入力内部契約
Art      = 表示契約
```

へ明確に分離する。

---

# 5. Track C — Human Unit Pixel Tokens

## 5.1 目的

町上の人物をportrait別の「駒アイコン」から、町に存在する小さな人型pixel characterへ置き換える。

人物の個性はportrait / CharacterDeck / CharacterInspectorで表現する。

Town tokenは「そこに人がいること」を自然に表現する責務だけを持つ。

---

## 5.2 新token asset contract

既存のportrait別token 12枚を廃止し、次の4枚へ置換する。

```text
src/assets/token/person_male_a.png
src/assets/token/person_male_b.png
src/assets/token/person_female_a.png
src/assets/token/person_female_b.png
```

### サイズ

```text
24 × 32 px
```

既存Town geometryとの互換のため変更しない。

### 背景

transparent。

### alpha

0 / 255のみ。

### palette

`docs/23-町アセット制作計画.md` と `scripts/validate-town-art.mjs` のWorld paletteのみ。

### 色数

1 assetあたり32色以下。

---

## 5.3 アート方向

目標:

> UI上の駒ではなく、暗い災害後の山村に立っている住民 / 作業者。

### 共通

- 16-bit系pixel art
- 2:1の町と馴染む斜め見下ろし / 3/4 view
- 頭、胴、腕、脚が24×32でも読める
- 左上から弱い環境光
- 右下側に深い影
- 深いnavy / earth / neutral中心
- 暖色は小さなアクセントのみ
- practical rural / work clothing
- ハードpixel edge
- anti-aliasなし
- smooth gradientなし
- outlineは暗いnavy / black系
- 足元を同じbaselineに揃える
- 地面へ浮いて見えない

### male A / B

シルエットと服装を変える。

例:

- A: short hair + work jacket / pants
- B: cap or rough hair + utility vest / boots

### female A / B

シルエットと髪型 / 服装を変える。

例:

- A: tied / medium hair + work jacket
- B: shorter / longer silhouette difference + practical coat / apron-like workwear

過度な性別記号化は不要。

男女差よりも「4人並んだときに同じcloneに見えないこと」を優先する。

---

## 5.4 Presentation-only appearance mapping

`Unit` にgenderを追加してはいけない。

新規にscene層でappearance mappingを持つ。

概念例:

```ts
type TokenAppearance =
  | 'person_male_a'
  | 'person_male_b'
  | 'person_female_a'
  | 'person_female_b'

const TOKEN_APPEARANCE_BY_PORTRAIT: Record<string, TokenAppearance> = {
  mayor: 'person_female_a',
  medic: 'person_male_a',
  engineer: 'person_female_b',
  farmer: 'person_male_b',
  // ...
}
```

### マッピングルール

- 名前文字列から性別を推測しない
- 既存portrait画像の視覚表現を参照して分類する
- 初期4人、汎用portrait 8種、unique portraitを含む現行portraitを明示mappingする
- 現行portraitにmapping漏れがないことをunit testで固定する

将来portrait追加時もmapping追加を要求する。

runtimeで未知portraitへ到達した場合のfallbackは持ってよいが、現行assetではtestによりfallbackへ入らないこと。

---

## 5.5 UnitToken UI簡素化

### 削除

町上tokenから以下を削除する。

- `労 / 技 / 医 / 魅` aptitude badge
- 人物全体を囲う矩形selected outline
- 負傷時の全身red tint

適性はCharacterDeck / CharacterInspectorで確認できるため、Town上で重複表示しない。

### selected state

selected / grabbed stateが必要なら、足元に小さな2–4px程度のgold markerを置く。

```text
   人
  /|\
  / \
  ━━   ← 小さいfoot marker
```

人物全体を枠で囲わない。

### injured state

負傷状態は小さなred pixel markerで示す。

例:

- 頭上または右上に2–3pxのred mark
- 人型sprite自体のpaletteは維持

### hit area

既存44px pointer targetは維持する。

見た目が24×32でも操作性を下げない。

---

## 5.6 Token placement / fan

既存 `TOKEN_FAN` の配置座標は初期値として維持する。

ただし新spriteを実画面へ入れた後、以下だけ目視調整してよい。

- 足がfacility地面へ接地しているか
- 建物へ過剰にめり込まないか
- 2–4人配置時に人物同士が完全に重ならないか
- Y-sortが自然か

24×32契約・facility plot geometry自体は変更しない。

---

# 6. 画像制作手順

## 6.1 参照するもの

画像制作者は必ず以下を参照する。

### Visual Style Reference

- `src/assets/town/base.png`
- `src/assets/facility/*-normal.png`
- `src/assets/facility/*-working.png`
- `src/assets/scene/night.png`
- `src/assets/portrait/*`

### Contract

- `docs/23-町アセット制作計画.md`
- `scripts/validate-town-art.mjs`

portraitは人物の雰囲気参考であり、24×32tokenへportrait固有の顔を再現する必要はない。

---

## 6.2 AI画像生成を使う場合

AI生成物をそのまま完成PNGとして採用しない。

推奨工程:

```text
1. 4キャラクターの統一reference / sprite sheetを生成
2. silhouette / clothing / lightingを決める
3. 24×32 logical pixel gridへ手動でpixel cleanup
4. World paletteへquantize
5. alphaを0 / 255へ整理
6. nearest-neighbor以外のresizeを使わない
7. ゲームへ実装して1x表示を確認
8. art:validateを通す
```

特に以下は生成後に必ず除去する。

- anti-alias pixel
- semi-transparent pixel
- smooth gradient
- palette外色
- soft shadow
- blur
- 1px未満に見える細線
- UI枠 / badge / text

---

## 6.3 画像生成用基準プロンプト

画像生成ツールへ渡す場合は、以下を基準にする。

```text
Create a cohesive set of four small full-body pixel-art characters for a Japanese mountain-village disaster survival management game.

Characters:
1. masculine-presenting adult A — short hair, practical work jacket and pants
2. masculine-presenting adult B — cap or rough hair, utility workwear and boots
3. feminine-presenting adult A — tied or medium hair, practical work jacket and pants
4. feminine-presenting adult B — distinct hair silhouette, practical rural coat or workwear

Art direction:
- classic high-quality 16-bit pixel art
- 3/4 top-down view suitable for a 2:1 isometric town scene
- each character designed to fit a logical 24x32 pixel sprite
- compact readable silhouette: clear head, torso, arms and legs
- deep navy night palette with restrained earth, stone and vegetation colors
- weak light from upper-left, deeper shadow on lower-right
- subtle warm accents only
- generic residents/workers, not heroes and not chibi mascots
- visually consistent with a dark wet rural village after a natural disaster
- hard pixel edges
- transparent background
- no text, no UI, no icons, no badges, no frames
- no anti-aliasing, no smooth gradients, no blur, no soft glow
- same foot baseline and similar body scale for all four
- four characters must be clearly distinguishable without exaggerated gender stereotypes
```

### 補足

生成モデルが24×32を正確に出せない場合、最終画像の解像度を生成モデルへ無理に要求しない。

AI outputは**reference**として使い、最終24×32はpixel grid上で整理する。

---

## 6.4 画像DoD

4枚すべて以下を満たすこと。

- 24×32 exact
- transparent background
- alpha 0 / 255 only
- World palette内
- 32色以下
- hard pixel edge
- 同一の足元baseline
- 1x表示で人型として認識可能
- 4体同時表示でclone感が強くない
- facility artより過度に明るくない
- Town FXの上でも読める
- `npm run art:validate` green

---

# 7. Art contractの更新

現在 `validate-town-art.mjs` はtoken 12枚を含む合計25 assetを固定している。

今回の実装では旧12 tokenを削除し、新4 tokenへ置換する。

想定:

```text
1 town
12 facility
4 token
= 17 assets
```

実装者は以下を同じcommit series内で更新する。

- `scripts/validate-town-art.mjs`
- `docs/23-町アセット制作計画.md`
- token resolver / manifest
- token contract tests

旧12 tokenを互換目的で残してはいけない。

`sceneAssets()` はglobでPNGを読むため、loader側へ不要な二重manifestを追加しない。

---

# 8. 推奨実装順序

1本のimplementation PR内で、以下を直列に進める。

## Commit 1 — Character Inspector

```text
feat: 人物詳細を配置操作から独立して復活する
```

### 主な対象

- `src/scene/planning/placement-status.ts`
- `src/scene/character/character-inspector.ts` 新規
- `src/scene/scenes/PlayScene.ts`
- `src/scene/input/play-scene-shortcuts.ts`
- `src/scene/e2e-bridge.ts`
- E2E / fixture / visual regression

### 完了条件

- 人物クリック → Placement modeは維持
- 詳細ボタンでInspector表示
- Town camera不変
- Inspector close後にplacement継続
- Escape優先順位が正しい

---

## Commit 2 — Art-aligned Facility Feedback

```text
refactor: 施設配置feedbackをアート主体へ統合する
```

### 主な対象

- `src/scene/town/town-layer.ts`
- `src/scene/planning/planning-interaction-controller.ts` 相当
- 必要なE2E
- visual baseline

### 完了条件

- 通常時diamondなし
- placement時diamondなし
- drag hover diamondなし
- blocked facilityのみdim
- hoverしたfacilityだけ名前 / 状態表示
- hit geometryは変わらない

---

## Commit 3 — Human Token Art + Runtime

```text
feat: 町の人物tokenを汎用人型pixel artへ刷新する
```

### 主な対象

- `src/assets/token/*.png`
- `src/scene/ui/token.ts`
- `src/scene/town/token-resolve.ts` または置換module
- `scripts/validate-town-art.mjs`
- `docs/23-町アセット制作計画.md`
- token mapping tests
- visual regression

### 完了条件

- 旧12token削除
- 新4tokenのみ
- portrait → appearance mapping完備
- aptitude badge削除
- rectangle outline削除
- injured全身tint削除
- 44px hit target維持
- art validator green

---

# 9. 想定ファイル変更範囲

## 新規

```text
src/scene/character/character-inspector.ts
src/assets/token/person_male_a.png
src/assets/token/person_male_b.png
src/assets/token/person_female_a.png
src/assets/token/person_female_b.png
```

必要なら純粋mapping module:

```text
src/scene/town/token-appearance.ts
```

## 更新候補

```text
src/scene/planning/placement-status.ts
src/scene/scenes/PlayScene.ts
src/scene/input/play-scene-shortcuts.ts
src/scene/e2e-bridge.ts
src/scene/town/town-layer.ts
src/scene/ui/token.ts
src/scene/town/token-resolve.ts
scripts/e2e.mjs
scripts/e2e-planning-placement.mjs
scripts/visual-regression.mjs
scripts/validate-town-art.mjs
docs/23-町アセット制作計画.md
```

## 削除

既存のportrait別town token 12枚。

---

# 10. テスト計画

## 10.1 Character Inspector E2E

最低限以下を固定する。

```text
人物をクリック
→ placement unit selected
→ PlacementStatusが開く
→ 詳細
→ CharacterInspectorが開く
→ 主要人物情報が見える
→ Town施設座標が開く前後で変化しない
→ Escape
→ Inspectorだけ閉じる
→ placement selectionは残る
→ facilityクリック
→ 配置成功
```

wide / narrow両方を確認する。

---

## 10.2 Facility feedback E2E

以下の機能契約は維持する。

- facility artのopaque pixelクリック
- transparent footprint領域クリック
- Deck → Town DnD
- FacilityFocus empty slot DnD
- facility → unit click placement
- blocked candidateは配置されない

図形表示の存在をテスト条件にしない。

---

## 10.3 Token E2E

既存の `townTokenArtPoint()` 相当で、

- tokenの実画像部分をクリックできる
- 画像上端でもhit可能
- pointerdown → drag開始可能

を維持する。

---

## 10.4 Unit test

追加候補:

### Token appearance completeness

現行portrait一覧を列挙し、すべてappearanceへ解決できること。

```text
INITIAL_UNITS
RANDOM_PORTRAIT_IDS
UNIQUE_UNITS
```

を対象にする。

### Planning

配置候補の純粋判定には不要な変更を加えない。

既存placement testsを通すこと。

---

# 11. Visual Regression

追加推奨fixture:

```text
character-inspector-wide
character-inspector-narrow
```

既存で意図的に差分が出る可能性が高いもの:

```text
planning-wide / narrow
planning-assigned-wide / narrow
facility-focus-wide / narrow
```

ただしbaselineを一括再生成しない。

手順:

```text
1. 旧baselineに対してtest:visual実行
2. 実差分を確認
3. 今回変更対象だけ更新
4. 再度test:visual green
```

Town FXやStory画面など、今回の変更理由がないbaselineを便乗更新しない。

---

# 12. CI / 検証ゲート

最終branchで以下を順に実行する。

```bash
npm ci
npm run typecheck
npm run lint
npm run format:check
npm test
npm run build
npm run test:prod
npm run test:e2e
npm run test:visual
```

`npm test` 内の `art:validate` を必ず通す。

画像変更をvalidatorから除外してCIを通すような暫定修正は禁止。

---

# 13. 非目標

今回行わないもの:

- GameState変更
- save version変更
- genderをゲームデータへ追加
- aptitude / trait / balance変更
- Town geometry変更
- facility plot座標変更
- camera pan / zoom再導入
- character animation
- walk animation
- direction別sprite
- sprite sheet animation system
- unique人物ごとの専用town token
- Deck portraitデザイン刷新
- CharacterDragGhostの大幅刷新
- Town FXの再設計（#35を正とする）

必要以上に範囲を拡大しない。

---

# 14. レビュー時のチェックリスト

## Character Inspector

- [ ] Placement操作とInspector状態が別管理
- [ ] Inspectorを開いてもTownが動かない
- [ ] close後に配置選択が維持される
- [ ] 旧CharacterFocusを互換目的で復活させていない
- [ ] wide / narrowで主要情報が収まる

## Facility interaction

- [ ] 通常時にfootprint diamondが見えない
- [ ] placement中もdiamondが見えない
- [ ] DnD hoverにもdiamondが見えない
- [ ] blocked facilityは視覚的に判別できる
- [ ] hoverで不可理由が分かる
- [ ] opaque pixel / footprint hit contractは維持

## Human tokens

- [ ] 4枚とも24×32
- [ ] World palette内
- [ ] alpha 0/255
- [ ] 旧12 tokenを残していない
- [ ] 町上に適性badgeがない
- [ ] rectangle outlineがない
- [ ] injured full tintがない
- [ ] 44px hit target維持
- [ ] 4 variantが複数配置時に識別可能

## Quality

- [ ] art:validate green
- [ ] typecheck / lint / format green
- [ ] unit tests green
- [ ] production smoke green
- [ ] E2E green
- [ ] visual regression green
- [ ] 意図しないbaseline更新なし

---

# 15. 実装者への依頼文

以下をそのまま別実装者への指示として使用できる。

> `docs/27-Planning最終ブラッシュアップ計画.md` を唯一の実行計画として読み、#35完了状態をbaseにPlanning画面の最終ブラッシュアップを実装してください。
>
> 実装前に現行コード、#33〜#35の責務、`docs/23-町アセット制作計画.md`、art validator、E2E / Visual Regressionの契約を確認してください。
>
> 対応は1本のPRで行い、計画書の順序どおり Character Inspector → facility feedback → human token art の順で進めてください。
>
> 旧UIや旧tokenを後方互換目的で併存させないでください。GameState / save schema / balanceへPresentation都合の変更を入れないでください。
>
> 画像制作も実装範囲です。4枚の24×32人型pixel tokenを制作し、計画書のWorld palette / alpha / pixel edge / visual reference契約を満たしてください。AI画像生成を使う場合も生成物をそのまま採用せず、最終24×32をpixel-cleanupし、`npm run art:validate` を通してください。
>
> 実装完了後はCI相当コマンドをすべて実行し、変更対象の実画面をwide / narrowで目視確認してください。Visual Regression baselineは意図した差分だけ更新してください。
>
> 最終的な目標は「UIの図形を重ねたゲーム盤」ではなく、町・施設・人型pixel characterそのものを操作しているPlanning画面です。

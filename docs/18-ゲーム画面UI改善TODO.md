# ゲーム画面UI改善 TODO

ゲーム画面の実操作確認で見つかった、意思決定に必要な情報と主要操作の距離、モバイル表示、配置操作の曖昧さを解消する。

**状態: P1–P4完了 / P5実装待ち**

## 0. 方針

- ゲームコア、バランス、セーブ形式は変更しない
- CSSだけで症状を隠さず、ナビゲーション、判断情報、配置操作、確定操作の責務を分ける
- フェーズごとに全テスト、型、lint、buildを通してコミットする
- 390×844と1440×1000で実寸を確認する
- 並行作業の差分はコミットへ含めない

## 1. 観察結果

- 1440×1000で文書高は1146px、作戦開始ボタン下端は約1131px
- 390×844で文書高は3020px、作戦開始操作は約1251px地点
- モバイルの本部記録が内容幅に縮み、右側に空白が残る
- 空任務にも高さ62pxの配置領域があり、4任務分の空白を作る
- `.board__commit`用CSSは存在するが、実要素にクラスがない
- ユニットカードの`role="button"`内に詳細`button`があり、操作要素が入れ子になっている
- 配置済みカードを押すと解除されることが表示・読み上げから分からない
- 配給状態がゲーム内方針ではなく`OFF`と表示される

## 2. P1: ゲームメニューとタイトル復帰

### TODO

- [x] TopBarの常設操作を「一手戻る」「メニュー」に整理する
- [x] アクセシブルなゲームメニューダイアログを追加する
- [x] メニューに「ゲームに戻る」「タイトルに戻る」「最初から」を配置する
- [x] Escape、背景クリック、フォーカス移動・復帰に対応する
- [x] タイトル復帰時に未確定の当日配置が保存されないことを明記する
- [x] `planning`と`choice`をタイトルから再開可能にする
- [x] 同一セッションの1日目にタイトルへ戻った場合も「続きから」を表示する
- [x] 再開、最初から、タイトル復帰のUIテストを追加する

### 対象

- `src/ui/App.tsx`
- `src/ui/screens/PlayScreen.tsx`
- `src/ui/components/TopBar.tsx`
- `src/ui/components/GameMenu.tsx`（新規）
- `src/ui/styles/play.css`
- `tests/ui.test.tsx`

### 完了条件

- 「最初から」がTopBarへ常設されていない
- 選択イベント中にタイトルへ戻っても再開できる
- メニューをキーボードだけで開閉・選択できる

## 3. P2: モバイル判断情報と全幅表示

### TODO

- [x] モバイル専用のコンパクト状況HUDを追加する
- [x] 食料、電力、医療、士気、予算、備蓄を表示する
- [x] 状況HUDをスクロール中も画面上部へ固定する
- [x] 詳細なStatusWallは既存位置に残す
- [x] モバイルで`.play__right`を`align-items: stretch`へ戻す
- [x] 本部記録と町の様子を全幅表示する
- [x] 値とレスポンシブ構造のUIテストを追加する

### 対象

- `src/ui/screens/PlayScreen.tsx`
- `src/ui/components/CompactStatus.tsx`（新規）
- `src/ui/styles/play.css`
- `tests/ui.test.tsx`

### 完了条件

- 390px幅で横スクロールが発生しない
- 390px幅で本部記録と町の様子が同じ全幅になる
- ゲーム画面をスクロールしても6資源を確認できる

## 4. P3: 配置操作と配給表現

### TODO

- [x] ユニットカードの主操作と詳細操作を兄弟要素へ分離する
- [x] 待機カードの選択状態を`aria-pressed`で公開する
- [x] 配置済みカードの操作名を「配置を解除」と明示する
- [x] 未選択時は「待機中の人員を先に選択」と表示する
- [x] 選択時は「{ユニット名}をここに配置」と表示する
- [x] 配置不可、費用不足、探索中の既存挙動を維持する
- [x] 配給表示を「通常配給／節約配給」へ変更する
- [x] 節約配給に「食料温存・士気低下」を併記する
- [x] 確認画面の作戦概要も「節約配給」に統一する
- [x] マウス、タップ、キーボード操作のUIテストを更新する

### 対象

- `src/ui/components/DecisionBoard.tsx`
- `src/ui/components/UnitCard.tsx`
- `src/ui/styles/play.css`
- `tests/ui.test.tsx`

### 完了条件

- `.unit-card button button`のような操作要素の入れ子がない
- 選択、配置、解除、詳細表示をキーボードで実行できる
- 配給状態をON/OFFという文言に頼らず判別できる

## 5. P4: CommitBarと画面密度

### TODO

- [x] 空任務では不要な配置領域を描画しない
- [x] 補助操作と確定操作を別グループへ分ける
- [x] 未配置人数と「作戦を開始する」をCommitBarへまとめる
- [x] モバイルでCommitBarを画面下部へ固定する
- [x] safe-areaと固定バー分の本文余白を確保する
- [x] デスクトップで初期状態の作戦開始ボタンを表示領域内に収める
- [x] busy、ended、確認ダイアログの既存状態を維持する
- [x] 1440×1000と390×844でPlaywright実寸確認する

### 対象

- `src/ui/components/DecisionBoard.tsx`
- `src/ui/styles/play.css`
- `tests/ui.test.tsx`

### 完了条件

- 1440×1000で作戦開始ボタンがスクロールせず見える
- 390×844で確定操作が常に親指で届く位置にある
- 固定バーが人員カードやダイアログを覆わない

## 6. 検証

各フェーズで次を実行する。

```bash
npm test
npm run typecheck
npm run lint
npm run build
```

P2とP4ではPlaywrightで次も確認する。

- 1440×1000の初期状態と自動配置後
- 390×844の初期状態と2日目
- 横方向のoverflow
- CompactStatusとCommitBarの固定位置
- 本部記録と町の様子の幅

## 7. コミット境界

1. `docs: add game UI improvement TODO`
2. `feat: add in-game navigation menu`
3. `feat: add mobile resource HUD`
4. `refactor: clarify unit assignment controls`
5. `fix: keep daily commit action reachable`
6. `docs: complete game UI improvement TODO`

## 8. 完了記録

- Vitest 123件、typecheck、lint、buildがすべて成功
- 390×844: 横幅390px / scroll幅390px、本部記録と町の様子はともに366px、スクロール後のCompactStatus上端は0px
- 1440×1000: 初期状態の文書高1000px、作戦開始ボタン下端917.5pxで表示領域内
- 390×844: CommitBar下端832px、確認ダイアログとのz-indexは50/105、2日目も横方向overflowなし
- Playwrightで初期状態、自動配置後、2日目、選択/配置/解除/詳細/配給のキーボード操作を確認

## 9. P5: 日次確定操作の低強調化

### TODO

- [ ] 確定操作を「本日の対応を確定」へ変更する
- [ ] 確定ボタンの黄色全面塗りと大きな影を廃止する
- [ ] 未配置時は「{n}人 待機」、全員配置時は「配置完了」を表示する
- [ ] デスクトップは補助操作、状態、確定操作を1段にまとめる
- [ ] デスクトップの確定ボタンを右寄せ・幅200〜240px・高さ約44pxにする
- [ ] SPのCommitBarは下部固定を維持し、viewportの左右下端へ密着させる
- [ ] SPのCommitBarは全周枠を廃止し、上罫線だけにする
- [ ] SPの固定`bottom: 12px`を廃止し、safe-area分のみ下部を確保する
- [ ] SPのCommitBar高を56〜64px程度に抑える
- [ ] hover/focus、busy、ended、未配置確認ダイアログの挙動を維持する
- [ ] 1440×1000と390×844で実寸確認する

### 変更しないもの

- 日次確定処理と未配置確認ダイアログ
- 配置、リセット、おまかせ配置の挙動
- モバイル資源HUD、セーブ形式、ゲームコア

### 完了条件

- 390×844でCommitBarの下端がviewportの下端と一致する
- SPでCommitBarの左右下に外側余白や全周枠がない
- 確定ボタンの下部に影由来の意図しない空白がない
- 390px幅で横方向overflowがない
- 固定ドックがダイアログや最後の人員カードを覆わない
- 1440×1000で初期状態の確定操作が表示領域内に収まる
- Vitest、typecheck、lint、buildがすべて成功する

### コミット境界

1. `docs: define quieter daily commit controls`
2. `fix: soften daily commit controls`
3. `docs: complete daily commit control refinement`

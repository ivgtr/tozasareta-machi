# ゲーム画面UI改善 TODO

ゲーム画面の実操作確認で見つかった、意思決定に必要な情報と主要操作の距離、モバイル表示、配置操作の曖昧さを解消する。

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

- [ ] ユニットカードの主操作と詳細操作を兄弟要素へ分離する
- [ ] 待機カードの選択状態を`aria-pressed`で公開する
- [ ] 配置済みカードの操作名を「配置を解除」と明示する
- [ ] 未選択時は「待機中の人員を先に選択」と表示する
- [ ] 選択時は「{ユニット名}をここに配置」と表示する
- [ ] 配置不可、費用不足、探索中の既存挙動を維持する
- [ ] 配給表示を「通常配給／節約配給」へ変更する
- [ ] 節約配給に「食料温存・士気低下」を併記する
- [ ] 確認画面の作戦概要も「節約配給」に統一する
- [ ] マウス、タップ、キーボード操作のUIテストを更新する

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

- [ ] 空任務では不要な配置領域を描画しない
- [ ] 補助操作と確定操作を別グループへ分ける
- [ ] 未配置人数と「作戦を開始する」をCommitBarへまとめる
- [ ] モバイルでCommitBarを画面下部へ固定する
- [ ] safe-areaと固定バー分の本文余白を確保する
- [ ] デスクトップで初期状態の作戦開始ボタンを表示領域内に収める
- [ ] busy、ended、確認ダイアログの既存状態を維持する
- [ ] 1440×1000と390×844でPlaywright実寸確認する

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

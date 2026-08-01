# AGENTS.md

ブラウザで動くターン制運営シミュレーション「孤立した町の30日間」（Vite + React 19 + TypeScript）。

**作業前に必ず [`docs/README.md`](docs/README.md) を読むこと**（設計ドキュメントの目次）。
現状・アーキテクチャ・次のステップ・詳細な規律は **[`docs/00-現状と引き継ぎ.md`](docs/00-現状と引き継ぎ.md)** に集約している。そちらが正。

## コマンド

```bash
npm install
npm run dev          # プレイ
npm test             # テスト
npm run typecheck    # 型チェック
npm run lint         # lint（src/game のDOM非依存を強制）
npm run build        # ビルド
npm run sim          # バランス測定
```

## 最低限の規律（詳細は docs/00 参照）

- フェーズごとにコミット（CI緑を条件に）
- 数値は `src/game/data/balance.ts` に集約（マジックナンバー禁止）
- コードにコメントは原則追加しない
- `src/game/` は DOM非依存（UIからの一方向依存を守る）
- 韓国語混入に注意（懸念があれば `[가-힣]` で grep）

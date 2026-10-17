# @acme/platform

インフラチームが配る部品です。アプリチームは、箱（`PlatformStage`）にサービス（`ApiService`）を置くだけで、標準どおりの環境を用意できます。

```ts
const dev = new PlatformStage(app, 'Dev', { envType: 'dev' });   // 箱（環境）
const devApi = new ApiService(dev, 'Dashboard', {                // サービス
  service: 'dashboard',
  image: ContainerImage.fromAsset('../app/api'),
  site: { source: '../app/web/dist' },                           // 画面があれば
  db: 'readExisting',
});
```

## できあがる構成

入口は CloudFront だけです。`https://<サービス>-<環境>.<ドメイン>`（例：`https://dashboard-dev.example.com`）で受けます。

```
利用者 ─HTTPS→ CloudFront（WAF・証明書）─┬─ /api/* → 非公開の ALB（VPC オリジン）→ Fargate → DB
                                          └─ それ以外 → S3（OAC。画面がある場合）
```

- ALB はインターネットに出さず、CloudFront からの通信（AWS 管理のプレフィックスリスト）だけを受けます。
- WAF は全サービス共通の標準で、アプリは選びません。同じIPからの大量アクセス（5分で300回まで。`env/policy.ts`）を止め、AWS のマネージドルール（悪評のあるIP・一般的な Web 攻撃・既知の悪い入力）でよくある攻撃を止めます。IP で絞らないので、本番でもそのまま使えます。
- 検索エンジンに載せないよう、すべての応答に `X-Robots-Tag: noindex, nofollow` を付けます。
- 画面と API が同じドメインなので、CORS の設定は要りません。画面は `/api/...` を相対パスで呼びます。
- CloudFront 用の証明書と WAF は AWS の決まりで us-east-1 にしか置けないため、`ApiService` が隣に `<id>Edge` スタック（us-east-1）を自動で作ります。アプリが書く必要はなく、`cdk deploy 'Dev/*'` で一緒にデプロイされます。そのため、us-east-1 にも `cdk bootstrap` が必要です。

| スタック | リージョン | 中身（construct） |
| --- | --- | --- |
| `Dev/Dashboard`（`ApiService`） | 東京 | `shared-resources`・`service-logs`・`web-service`・`database-access`・`site-content`・`web-entry` |
| `Dev/DashboardEdge`（`ServiceEdge`） | us-east-1 | `edge-resources`・`edge-certificate`・`web-firewall` |

## アプリとの約束

- コンテナは 8080 番で待ち受ける
- `/health` で 200 を返す
- API のパスは `/api/` で始める（画面がある場合、それ以外は画面に流れる）
- DB の接続情報は環境変数（`DB_HOST`・`DB_PORT`・`DB_NAME`・`DB_USER`・`DB_PASSWORD`）で受け取る
- 画面は起動時に `/config.json`（`{ "apiUrl": "", "env": "dev" }`）を読む

## インフラ（infra-foundation）との約束

| 置き場所 | 名前 | 中身 |
| --- | --- | --- |
| 東京の VPC 名 | `acme-<環境>` | 共有の VPC |
| 東京の SSM | `/acme/<環境>/dns/zone-id`・`zone-name` | ホストゾーン |
| 東京の SSM | `/acme/<環境>/reservation-db/...` | 共有の予約DB |
| us-east-1 の SSM | `/acme/edge/dns/zone-id`・`zone-name` | ホストゾーン（証明書の DNS 検証用） |

## フォルダの規則

| フォルダ | 置くもの |
| --- | --- |
| `src/env/` | 変数（基準値 `policy.ts`、環境ごとの既定値 `env-defaults.ts`、インフラとの約束 `shared-contract.ts`） |
| `src/stages/` | Stage（環境の箱） |
| `src/stacks/` | Stack。construct を組み立てるだけで、リソースを直接書かない |
| `src/constructs/` | 1フォルダ＝1つの関心。`index.ts` に1つだけ書いて export する |
| `src/rules/` | チェックシートのルール。1項目＝1ファイル（`items/`） |

`src/index.ts` から公開するのは、アプリが使うもの（`PlatformStage`・`ApiService`・`env` の値・`addException`）だけです。

## チェックシートのルール

`npm run build && npm run rules:list` で一覧を出せます。

| 項目番号 | 内容 | 対象の環境 |
| --- | --- | --- |
| INF-07 | ログを定めた期間保管する | 開発・検証・本番 |
| INF-12 | データベースを保存時に暗号化する | 開発・検証・本番 |
| INF-18 | インターネットからDBへの接続を許可しない | 開発・検証・本番 |
| INF-21 | 外部との通信をTLSで暗号化する（CloudFront は HTTPS だけ。インターネットに出た ALB があれば HTTPS だけ） | 開発・検証・本番 |
| INF-41 | 検証・本番は2タスク以上で動かす（項目番号は仮） | 検証・本番 |

ルールを足すときは、`src/rules/items/` に1ファイル作り（`defineRule` で項目番号・内容・対象の環境・判定の4つを書く）、`src/rules/rule-list.ts` に1行足します。テストは `test/rules/items/` に「止まる例」と「通る例」を書きます。

### 例外

ルールを例外にするときは、アプリ側で理由を書いて登録します。例外はレポートに「例外（理由）」として残ります。

```ts
addException(stgApi, 'INF-41', '検証環境はコストを優先し1タスクで運用する（インフラ承認済み）');
```

### レポート

`cdk synth` のあと、`npx acme-checksheet` で検査結果をチェックシートの形の表にできます。

```bash
npx acme-checksheet                     # ターミナルに表を出す
npx acme-checksheet --markdown          # Markdown（PRのサマリー用）
npx acme-checksheet --exceptions-only   # 例外の行だけ。例外がなければ何も出さない
```

## 公開

```bash
scripts/release.sh minor   # patch：不具合の修正  minor：互換のある変更  major：互換が崩れる変更
```

main の最新でテストし、`npm version` で版を上げてタグ（`v1.2.3`）を push します。タグの push で GitHub Actions（`release.yml`）が CodeArtifact に公開し、スクリプトはその結果を待ちます。同じ位置に `release/v1.2.3` のブランチも作ります（タグは動かせないので、その版から作業するときはこのブランチを使います）。リポジトリ変数 `AWS_ACCOUNT_ID` が必要です。

## メモ

- cdk-nag は v2（2.38.2）に固定しています。v3 は CDK の Policy Validation を使う方式に変わり、`Aspects`・`NagSuppressions`・コンプライアンスレポートの扱いが異なるためです。
- テストでは、偽のVPC・サブネットIDに対する CloudFormation の形式チェックを止めています（`test/setup.js`）。実際の `cdk synth` では有効です。
- 論理IDのスナップショット（`test/stacks/__snapshots__`）は、部品の中を分け直したときにリソースの作り直しに気づくためのものです。意図して変えたときは `npx jest -u` で更新します。

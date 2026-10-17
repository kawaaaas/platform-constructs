import { Annotations, CfnOutput, Stack, StackProps, Tags, aws_ec2 as ec2, aws_ecs as ecs, aws_rds as rds } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { DatabaseAccess, DatabaseMode } from '../../constructs/database-access';
import { ServiceLogs } from '../../constructs/service-logs';
import { SharedResources } from '../../constructs/shared-resources';
import { SiteContent } from '../../constructs/site-content';
import { WebEntry } from '../../constructs/web-entry';
import { WebService } from '../../constructs/web-service';
import { EDGE_REGION, ENV_DEFAULTS, ServiceSpec } from '../../env';
import { PlatformStage } from '../../stages/platform-stage';
import { ServiceEdge } from '../service-edge';

export interface SiteOptions {
  /** 画面のビルド結果のディレクトリ（例：'../app/web/dist'） */
  readonly source: string;
}

export interface ApiServiceProps extends StackProps {
  /** サービス名（'dashboard' など）。ドメイン名とタグに使う */
  readonly service: string;
  /** アプリのコンテナイメージ */
  readonly image: ecs.ContainerImage;
  /** DBの使い方 */
  readonly db: DatabaseMode;
  /** 画面があれば、そのビルド結果。同じドメインで配信し、API は /api/* になる */
  readonly site?: SiteOptions;
  /** 以下は省略すると環境ごとの既定値（env/env-defaults.ts）が入る */
  readonly cpu?: number;
  readonly memoryMiB?: number;
  readonly minTasks?: number;
  readonly maxTasks?: number;
  readonly multiAz?: boolean;
}

/**
 * 1サービス×1環境のスタック。関心ごとの construct を組み立てるだけで、リソースは直接書かない。
 * 入口は CloudFront だけ。us-east-1 にしか置けない証明書と WAF は、隣の ServiceEdge スタックに置く。
 *
 * =====================================================================================
 * 【デモ1／基準1 期限】見ていただく点② 裏側は、インフラの部品が作る（ダッシュボードの app.ts の次に開く）
 *   ・アプリが ApiService を1つ書くと、裏側ではインフラチームの部品がこの順に組み立てる。⓪〜⑥ を上から指す。
 *   ・スタックは「部品を並べるだけ」。リソースを直接書かないので、どこに何があるかがすぐ分かる。
 *   ・標準を変えたいときは、インフラチームがこの部品を直して配る（デモ3）。アプリ側は書き直さない。
 *   ・ここも普段の TypeScript なので、障害のときもアプリの人が中まで読んで追える。
 * =====================================================================================
 */
export class ApiService extends Stack {
  /** 入口のURL（例：https://dashboard-dev.example.com） */
  public readonly url: string;
  /** db: 'new' のときだけ */
  public readonly database?: rds.DatabaseInstance;
  /** このサービスが使うDBへの接続の口 */
  public readonly dbConnections: ec2.Connections;

  constructor(scope: Construct, id: string, props: ApiServiceProps) {
    super(scope, id, { ...props, crossRegionReferences: true });
    const stage = PlatformStage.of(this);
    const { envType } = stage;
    const spec = withDefaults(ENV_DEFAULTS[envType], props);
    const recordName = `${props.service}-${envType}`;

    // ⓪ 入口の証明書と WAF。AWS の決まりで us-east-1 にしか置けないので、隣のスタックに自動で作る（アプリは意識しない）
    //    WAF は全サービス共通の標準（大量アクセスの制限と、よくある攻撃を止める AWS のマネージドルール）
    const edge = new ServiceEdge(stage, `${id}Edge`, {
      env: { account: this.account, region: EDGE_REGION },
      service: props.service,
      envType,
    });
    // ① インフラが管理する共有の VPC・ドメイン・予約DB を参照する（作らない）。ネットワーク設計はインフラに残る
    const shared = new SharedResources(this, 'Shared', { envType });
    // ② ログ。保管期間はお客様の基準（env/policy.ts）で固定 → チェックシート INF-07。デモ3で直すのはこの基準
    const logs = new ServiceLogs(this, 'Logs');
    // ③ コンテナと、非公開のロードバランサー。インターネットには出さず、CloudFront からだけ受ける
    const api = new WebService(this, 'Api', { service: props.service, envType, image: props.image, spec, shared, logs });
    // ④ DB。新規なら暗号化して作る（INF-12）。共有DBなら、このサービスからの接続だけを開ける（INF-18）
    const db = new DatabaseAccess(this, 'Db', { mode: props.db, envType, multiAz: spec.multiAz, shared, web: api });
    // ⑤ 画面の置き場所（非公開の S3）。画面があるときだけ
    const site = props.site ? new SiteContent(this, 'Site', { source: props.site.source }) : undefined;
    // ⑥ 唯一の入口（CloudFront）。HTTPS だけ（INF-21）、WAF を通し、/api/* はロードバランサーへ、それ以外は画面へ。検索には載せない
    const entry = new WebEntry(this, 'Entry', {
      recordName,
      hostedZone: shared.hostedZone,
      certificate: edge.certificate,
      webAclArn: edge.webAclArn,
      api: api.loadBalancer,
      site: site?.bucket,
    });
    site?.publish(entry.distribution, envType);

    // us-east-1 のスタックとの参照は、CDK の既定（strong）のまま使う
    Annotations.of(this).acknowledgeWarning('@aws-cdk/core:crossStackReferencesDefaultStrong', '既定の strong で問題ない');

    Tags.of(this).add('acme:service', props.service);
    new CfnOutput(this, 'Url', { value: entry.url });
    this.url = entry.url;
    this.database = db.instance;
    this.dbConnections = db.connections;
  }
}

const withDefaults = (defaults: ServiceSpec, props: ApiServiceProps): ServiceSpec => ({
  cpu: props.cpu ?? defaults.cpu,
  memoryMiB: props.memoryMiB ?? defaults.memoryMiB,
  minTasks: props.minTasks ?? defaults.minTasks,
  maxTasks: props.maxTasks ?? Math.max(defaults.maxTasks, props.minTasks ?? 0),
  multiAz: props.multiAz ?? defaults.multiAz,
});

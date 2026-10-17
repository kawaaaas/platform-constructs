import { Aspects, Stage, StageProps, Tags } from 'aws-cdk-lib';
import { NagReportFormat } from 'cdk-nag';
import { Construct, IConstruct } from 'constructs';
import { DEFAULT_REGION, EnvType } from '../../env';
import { ChecksheetPack } from '../../rules';

export interface PlatformStageProps extends StageProps {
  /** 環境の種別（dev / stg / prod）。部品はここから環境ごとの既定値を選ぶ */
  readonly envType: EnvType;
}

/**
 * 環境の「箱」。
 * 中に置いたすべてのスタックに、チェックシートのルール検査と環境のタグが自動でかかる。
 *
 * 【デモ2／基準2 セキュリティ】「アプリチームは検査の設定を何もしていない」の根拠（質問されたら開く）
 *   ・アプリが箱（PlatformStage）にサービスを置いた時点で、下の ChecksheetPack が中のすべてのリソースを検査する。
 *   ・アプリ側で検査を外す方法はない。外したいときは理由を書いて例外にし、インフラのレビューを通す（exceptions.ts）。
 */
export class PlatformStage extends Stage {
  /** construct が属する PlatformStage を返す */
  public static of(scope: IConstruct): PlatformStage {
    const stage = Stage.of(scope);
    if (!(stage instanceof PlatformStage)) {
      throw new Error(`${scope.node.path} は PlatformStage の中に置いてください`);
    }
    return stage;
  }

  public readonly envType: EnvType;

  constructor(scope: Construct, id: string, props: PlatformStageProps) {
    super(scope, id, {
      ...props,
      // リージョンは東京に固定する（CLI の既定リージョンに左右されないように）
      env: props.env ?? { account: process.env.CDK_DEFAULT_ACCOUNT, region: DEFAULT_REGION },
    });
    this.envType = props.envType;

    // App に付けた Aspects は Stage の中には効かないので、Stage 自身に付ける
    Aspects.of(this).add(
      new ChecksheetPack({ envType: props.envType, reports: true, reportFormats: [NagReportFormat.JSON] }),
    );
    Tags.of(this).add('acme:env', props.envType);
  }
}

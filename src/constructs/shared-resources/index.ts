import { aws_ec2 as ec2, aws_route53 as route53, aws_secretsmanager as secretsmanager, aws_ssm as ssm } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { EnvType, sharedContract } from '../../env';

export interface SharedResourcesProps {
  readonly envType: EnvType;
}

/**
 * 関心：インフラが管理する共有の資源を参照する（何も作らない）。東京リージョン用。
 * VPCは名前で探し、それ以外はSSMパラメーターからデプロイ時に読む。
 * 使われたものだけをテンプレートに出すため、DB関連は参照されたときに初めて読む。
 */
export class SharedResources extends Construct {
  public readonly vpc: ec2.IVpc;
  public readonly hostedZone: route53.IHostedZone;
  private readonly names: ReturnType<typeof sharedContract>;
  private readonly cache = new Map<string, unknown>();

  constructor(scope: Construct, id: string, props: SharedResourcesProps) {
    super(scope, id);
    this.names = sharedContract(props.envType);
    this.vpc = ec2.Vpc.fromLookup(this, 'Vpc', { vpcName: this.names.vpcName });
    this.hostedZone = route53.HostedZone.fromHostedZoneAttributes(this, 'Zone', {
      hostedZoneId: this.param(this.names.dnsZoneId),
      zoneName: this.param(this.names.dnsZoneName),
    });
  }

  /** 共有DBの接続先 */
  public get dbEndpoint(): string {
    return this.param(this.names.dbEndpoint);
  }

  /** 共有DBのセキュリティグループ（このサービスからの接続を足せるよう mutable） */
  public get dbSecurityGroup(): ec2.ISecurityGroup {
    return this.once('DbSecurityGroup', () =>
      ec2.SecurityGroup.fromSecurityGroupId(this, 'DbSecurityGroup', this.param(this.names.dbSecurityGroupId), {
        mutable: true,
      }),
    );
  }

  /** 共有DBの読み取り専用ユーザー */
  public get dbReadonlySecret(): secretsmanager.ISecret {
    return this.once('DbReadonlyUser', () =>
      secretsmanager.Secret.fromSecretCompleteArn(this, 'DbReadonlyUser', this.param(this.names.dbReadonlySecretArn)),
    );
  }

  /** 共有DBの読み書きユーザー */
  public get dbReadwriteSecret(): secretsmanager.ISecret {
    return this.once('DbReadwriteUser', () =>
      secretsmanager.Secret.fromSecretCompleteArn(this, 'DbReadwriteUser', this.param(this.names.dbReadwriteSecretArn)),
    );
  }

  private param(name: string): string {
    return ssm.StringParameter.valueForStringParameter(this, name);
  }

  private once<T>(key: string, create: () => T): T {
    if (!this.cache.has(key)) this.cache.set(key, create());
    return this.cache.get(key) as T;
  }
}

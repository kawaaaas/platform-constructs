import {
  aws_ec2 as ec2,
  aws_ecs as ecs,
  aws_kms as kms,
  aws_rds as rds,
  aws_secretsmanager as secretsmanager,
} from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { EnvType, POLICY, SHARED_DATABASE_NAME, isDemo, removalPolicyFor } from '../../env';
import { SharedResources } from '../shared-resources';
import { WebService } from '../web-service';

/** new：自分専用のDBを作る／readExisting：共有DBを読む／writeExisting：共有DBに書く */
export type DatabaseMode = 'new' | 'readExisting' | 'writeExisting';

export interface DatabaseAccessProps {
  readonly mode: DatabaseMode;
  readonly envType: EnvType;
  readonly multiAz: boolean;
  readonly shared: SharedResources;
  readonly web: WebService;
}

/**
 * 関心：DB。
 * new なら暗号化したRDSを作る。共有DBなら、このサービスからの接続だけを許可し、
 * 読み取り専用か読み書きのDBユーザーをコンテナに渡す。
 */
export class DatabaseAccess extends Construct {
  /** db: 'new' のときだけ */
  public readonly instance?: rds.DatabaseInstance;
  /** このサービスが使うDBへの接続の口 */
  public readonly connections: ec2.Connections;

  constructor(scope: Construct, id: string, props: DatabaseAccessProps) {
    super(scope, id);
    const { container, service } = props.web;

    if (props.mode === 'new') {
      const key = new kms.Key(this, 'Key', { enableKeyRotation: true, removalPolicy: removalPolicyFor(this) });
      const instance = new rds.DatabaseInstance(this, 'Instance', {
        engine: rds.DatabaseInstanceEngine.postgres({ version: rds.PostgresEngineVersion.VER_16 }),
        instanceType: ec2.InstanceType.of(ec2.InstanceClass.T4G, ec2.InstanceSize.MICRO),
        vpc: props.shared.vpc,
        vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
        port: POLICY.databasePort,
        databaseName: 'app',
        credentials: rds.Credentials.fromGeneratedSecret('app'),
        multiAz: props.multiAz,
        storageEncrypted: true,
        storageEncryptionKey: key,
        deletionProtection: props.envType === 'prod' && !isDemo(this),
        removalPolicy: isDemo(this) ? removalPolicyFor(this) : undefined,
      });
      this.instance = instance;
      // RDSの既定の接続口はポートが参照（Endpoint.Port）になるため、番号を固定した口を作り直す
      this.connections = new ec2.Connections({
        securityGroups: instance.connections.securityGroups,
        defaultPort: ec2.Port.tcp(POLICY.databasePort),
      });
      this.connections.allowDefaultPortFrom(service, 'from the service');
      passToContainer(container, instance.dbInstanceEndpointAddress, 'app', instance.secret!);
      return;
    }

    // 共有DB：インフラが管理するDBのセキュリティグループに、このサービスからの接続だけを足す
    this.connections = new ec2.Connections({
      securityGroups: [props.shared.dbSecurityGroup],
      defaultPort: ec2.Port.tcp(POLICY.databasePort),
    });
    this.connections.allowDefaultPortFrom(service, 'from the service');
    const user = props.mode === 'readExisting' ? props.shared.dbReadonlySecret : props.shared.dbReadwriteSecret;
    passToContainer(container, props.shared.dbEndpoint, SHARED_DATABASE_NAME, user);
  }
}

const passToContainer = (
  container: ecs.ContainerDefinition,
  host: string,
  database: string,
  secret: secretsmanager.ISecret,
) => {
  container.addEnvironment('DB_HOST', host);
  container.addEnvironment('DB_PORT', String(POLICY.databasePort));
  container.addEnvironment('DB_NAME', database);
  container.addSecret('DB_USER', ecs.Secret.fromSecretsManager(secret, 'username'));
  container.addSecret('DB_PASSWORD', ecs.Secret.fromSecretsManager(secret, 'password'));
};

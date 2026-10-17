import { aws_ec2 as ec2, aws_ecs as ecs, aws_ecs_patterns as ecsPatterns, aws_elasticloadbalancingv2 as elbv2 } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { EnvType, ServiceSpec } from '../../env';
import { ServiceLogs } from '../service-logs';
import { SharedResources } from '../shared-resources';

export interface WebServiceProps {
  readonly service: string;
  readonly envType: EnvType;
  readonly image: ecs.ContainerImage;
  readonly spec: ServiceSpec;
  readonly shared: SharedResources;
  readonly logs: ServiceLogs;
}

/**
 * 関心：コンテナ（Fargate）と、その前の非公開のロードバランサー。
 * ロードバランサーはインターネットに出さず、CloudFront（VPC オリジン）からの通信だけを受ける。
 * アプリとの約束は「8080番で待ち受ける」「/health で200を返す」「DBの接続情報は環境変数で受け取る」の3つ。
 */
export class WebService extends Construct {
  public readonly service: ecs.FargateService;
  public readonly loadBalancer: elbv2.ApplicationLoadBalancer;
  public readonly container: ecs.ContainerDefinition;

  constructor(scope: Construct, id: string, props: WebServiceProps) {
    super(scope, id);
    const { shared, spec } = props;

    const pattern = new ecsPatterns.ApplicationLoadBalancedFargateService(this, 'Service', {
      vpc: shared.vpc,
      taskSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      cpu: spec.cpu,
      memoryLimitMiB: spec.memoryMiB,
      desiredCount: spec.minTasks,
      minHealthyPercent: 100, // デプロイ中もタスク数を下回らせない
      publicLoadBalancer: false, // 非公開（入口は CloudFront だけ）
      openListener: false,
      protocol: elbv2.ApplicationProtocol.HTTP, // CloudFront からは AWS の中の経路（VPC オリジン）で届く
      listenerPort: 80,
      circuitBreaker: { rollback: true },
      taskImageOptions: {
        image: props.image,
        containerPort: 8080,
        logDriver: ecs.LogDrivers.awsLogs({ streamPrefix: props.service, logGroup: props.logs.logGroup }),
        environment: { PORT: '8080', SERVICE_NAME: props.service, ENV_TYPE: props.envType },
      },
    });
    pattern.targetGroup.configureHealthCheck({ path: '/health' });
    pattern.service
      .autoScaleTaskCount({ minCapacity: spec.minTasks, maxCapacity: spec.maxTasks })
      .scaleOnCpuUtilization('Cpu', { targetUtilizationPercent: 60 });

    // CloudFront からの通信だけを受ける（AWS が管理する CloudFront のアドレス一覧）
    const cloudFront = ec2.PrefixList.fromLookup(this, 'CloudFrontOriginFacing', {
      prefixListName: 'com.amazonaws.global.cloudfront.origin-facing',
    });
    pattern.loadBalancer.connections.allowFrom(
      ec2.Peer.prefixList(cloudFront.prefixListId),
      ec2.Port.tcp(80),
      'from CloudFront only',
    );

    this.service = pattern.service;
    this.loadBalancer = pattern.loadBalancer;
    this.container = pattern.taskDefinition.defaultContainer!;
  }
}

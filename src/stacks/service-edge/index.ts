import { Stack, StackProps, Tags } from 'aws-cdk-lib';
import { aws_certificatemanager as acm } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { EdgeCertificate } from '../../constructs/edge-certificate';
import { EdgeResources } from '../../constructs/edge-resources';
import { WebFirewall } from '../../constructs/web-firewall';
import { EnvType } from '../../env';

export interface ServiceEdgeProps extends StackProps {
  readonly service: string;
  readonly envType: EnvType;
}

/**
 * 入口（CloudFront）のうち、us-east-1 にしか置けないもの（証明書と WAF）のスタック。
 * アプリは直接使わない。ApiService が自分の隣に作り、デプロイも ApiService と一緒に行われる。
 */
export class ServiceEdge extends Stack {
  public readonly certificate: acm.ICertificate;
  public readonly webAclArn: string;

  constructor(scope: Construct, id: string, props: ServiceEdgeProps) {
    super(scope, id, { ...props, crossRegionReferences: true });
    const name = `${props.service}-${props.envType}`;

    // ① インフラが管理するホストゾーンを参照する
    const shared = new EdgeResources(this, 'Shared');
    // ② 証明書（例：dashboard-dev.example.com）
    const cert = new EdgeCertificate(this, 'Certificate', {
      domainName: `${name}.${shared.hostedZone.zoneName}`,
      hostedZone: shared.hostedZone,
    });
    // ③ WAF（大量アクセスの制限と、AWS のマネージドルール。全サービス共通の標準）
    const waf = new WebFirewall(this, 'Waf', { name });

    Tags.of(this).add('acme:service', props.service);
    this.certificate = cert.certificate;
    this.webAclArn = waf.arn;
  }
}

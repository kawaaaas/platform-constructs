import {
  Validations,
  aws_certificatemanager as acm,
  aws_cloudfront as cloudfront,
  aws_cloudfront_origins as origins,
  aws_elasticloadbalancingv2 as elbv2,
  aws_route53 as route53,
  aws_route53_targets as targets,
  aws_s3 as s3,
} from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { POLICY } from '../../env';

export interface WebEntryProps {
  /** 例：dashboard-dev（ホストゾーンの下の名前） */
  readonly recordName: string;
  readonly hostedZone: route53.IHostedZone;
  /** us-east-1 の証明書（service-edge が作る） */
  readonly certificate: acm.ICertificate;
  /** us-east-1 の WAF の ARN（service-edge が作る） */
  readonly webAclArn: string;
  /** API の非公開のロードバランサー */
  readonly api: elbv2.IApplicationLoadBalancer;
  /** 画面の置き場所（画面がないサービスは省略） */
  readonly site?: s3.IBucket;
}

/**
 * 【全体像】スライド23 の ①入口 ②画面 ③API の実体（入口について聞かれたら開く）
 *   ・利用者が触れるのは CloudFront だけ。HTTPS しか受けず、WAF で大量アクセスやよくある攻撃を止める。
 *   ・/api/* は非公開のロードバランサー（VPC オリジン）へ、それ以外は非公開の S3（OAC）へ流す。
 *
 * 関心：唯一の入口（CloudFront）。
 * HTTPS だけで受け、WAF を通したあと、/api/* は非公開のロードバランサーへ、それ以外は画面（S3）へ流す。
 * 画面がないサービスは、すべてを API へ流す。
 */
export class WebEntry extends Construct {
  public readonly distribution: cloudfront.Distribution;
  public readonly url: string;

  constructor(scope: Construct, id: string, props: WebEntryProps) {
    super(scope, id);
    const domainName = `${props.recordName}.${props.hostedZone.zoneName}`;

    // 検索エンジンに載せない（行儀のよいクローラーを寄せつけない）
    const noIndex = new cloudfront.ResponseHeadersPolicy(this, 'NoIndex', {
      customHeadersBehavior: {
        customHeaders: [{ header: 'X-Robots-Tag', value: 'noindex, nofollow', override: true }],
      },
    });

    const api: cloudfront.BehaviorOptions = {
      origin: origins.VpcOrigin.withApplicationLoadBalancer(props.api, {
        protocolPolicy: cloudfront.OriginProtocolPolicy.HTTP_ONLY,
        httpPort: 80,
      }),
      viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
      cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
      originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
      responseHeadersPolicy: noIndex,
    };

    this.distribution = new cloudfront.Distribution(this, 'Distribution', {
      domainNames: [domainName],
      certificate: props.certificate,
      webAclId: props.webAclArn,
      minimumProtocolVersion: POLICY.minimumTls,
      ...(props.site
        ? {
            defaultBehavior: {
              origin: origins.S3BucketOrigin.withOriginAccessControl(props.site),
              viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
              responseHeadersPolicy: noIndex,
            },
            additionalBehaviors: { '/api/*': api },
            defaultRootObject: 'index.html',
          }
        : { defaultBehavior: api }),
    });

    // ドメイン名はデプロイ時に SSM から決まるため、synth 時の形式チェックの警告は出さない
    Validations.of(this.distribution.node.defaultChild!).acknowledge({
      id: 'CloudFormation-Validate::E3013',
      reason: 'ドメイン名はデプロイ時にSSMから決まる',
    });

    new route53.ARecord(this, 'Alias', {
      zone: props.hostedZone,
      recordName: props.recordName,
      target: route53.RecordTarget.fromAlias(new targets.CloudFrontTarget(this.distribution)),
    });

    this.url = `https://${domainName}`;
  }
}

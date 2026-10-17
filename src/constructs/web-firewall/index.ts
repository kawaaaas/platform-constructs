import { aws_wafv2 as wafv2 } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { POLICY } from '../../env';

export interface WebFirewallProps {
  /** メトリクス名に使う（英数字とハイフン） */
  readonly name: string;
}

/** AWS が無料で提供するマネージドルール（追加料金なし。1つあたり月 $1 のルール料金だけ） */
const MANAGED_RULE_GROUPS = [
  'AWSManagedRulesAmazonIpReputationList', //   悪評のあるIP（ボット・攻撃元として知られるもの）
  'AWSManagedRulesCommonRuleSet', //            一般的な Web 攻撃（OWASP Top 10 のよくある手口）
  'AWSManagedRulesKnownBadInputsRuleSet', //    既知の悪い入力（Log4j など）
];

/**
 * 関心：入口（CloudFront）の WAF。us-east-1 に置く。全サービス共通の標準で、アプリは選ばない。
 * 同じIPからの大量アクセスを止め、AWS のマネージドルールでよくある攻撃を止める。
 * IP で絞らないので、本番でも会場でもそのまま使える。
 * WAFv2 はL2がないためL1で作る。CloudFront 側からこの ARN を指定して付ける。
 */
export class WebFirewall extends Construct {
  public readonly arn: string;

  constructor(scope: Construct, id: string, props: WebFirewallProps) {
    super(scope, id);
    const metric = (suffix: string) => ({
      cloudWatchMetricsEnabled: true,
      sampledRequestsEnabled: true,
      metricName: `${props.name}-${suffix}`.replace(/[^A-Za-z0-9-]/g, ''),
    });

    const acl = new wafv2.CfnWebACL(this, 'WebAcl', {
      scope: 'CLOUDFRONT',
      defaultAction: { allow: {} },
      visibilityConfig: metric('acl'),
      rules: [
        {
          name: 'RateLimit',
          priority: 0,
          action: { block: {} },
          statement: { rateBasedStatement: { limit: POLICY.rateLimitPer5Min, aggregateKeyType: 'IP' } },
          visibilityConfig: metric('rate'),
        },
        ...MANAGED_RULE_GROUPS.map((name, i) => ({
          name,
          priority: i + 1,
          overrideAction: { none: {} },
          statement: { managedRuleGroupStatement: { vendorName: 'AWS', name } },
          visibilityConfig: metric(name.replace('AWSManagedRules', '')),
        })),
      ],
    });
    this.arn = acl.attrArn;
  }
}

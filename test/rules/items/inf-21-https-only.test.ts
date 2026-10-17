import { aws_cloudfront as cloudfront, aws_elasticloadbalancingv2 as elbv2 } from 'aws-cdk-lib';
import { apiService, expectAllowed, expectBlocked } from '../../helpers';

describe('INF-21 外部との通信をTLSで暗号化する', () => {
  test('止まる例：入口（CloudFront）で HTTP をそのまま受ける', () => {
    const { api } = apiService('dev');
    const distribution = api.node.findAll().find((c) => c instanceof cloudfront.CfnDistribution) as cloudfront.CfnDistribution;
    distribution.addPropertyOverride('DistributionConfig.DefaultCacheBehavior.ViewerProtocolPolicy', 'allow-all');
    // addPropertyOverride はテンプレートにだけ効くので、判定は L1 のプロパティで行う
    const config = api.resolve(distribution.distributionConfig);
    distribution.distributionConfig = { ...config, defaultCacheBehavior: { ...config.defaultCacheBehavior, viewerProtocolPolicy: 'allow-all' } };
    expectBlocked(api, 'INF-21');
  });

  test('止まる例：インターネット向けに、転送するだけのHTTPのリスナーを足す', () => {
    const { api } = apiService('dev');
    new elbv2.CfnListener(api, 'PlainHttp', {
      loadBalancerArn: 'arn:aws:elasticloadbalancing:ap-northeast-1:123456789012:loadbalancer/app/x/1',
      port: 8080,
      protocol: 'HTTP',
      defaultActions: [{ type: 'forward', targetGroupArn: 'arn:aws:elasticloadbalancing:ap-northeast-1:123456789012:targetgroup/x/1' }],
    });
    expectBlocked(api, 'INF-21');
  });

  test('通る例：部品の既定（入口は HTTPS だけ、ロードバランサーは非公開）', () => {
    const { api } = apiService('dev');
    expectAllowed(api, 'INF-21');
  });
});

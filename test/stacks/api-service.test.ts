import { mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { POLICY } from '../../src';
import { apiService, expectAllowed } from '../helpers';

const site = () => ({ source: mkdtempSync(join(tmpdir(), 'web-')) });

describe('ApiService', () => {
  test('開発環境：入口は CloudFront だけ。ロードバランサーは非公開で、CloudFront からの通信だけを受ける', () => {
    const { api } = apiService('dev', { site: site() });
    const template = Template.fromStack(api);

    // 期待値は数字ではなく POLICY から取る（policy.ts を変えてもテストは通る）
    template.hasResourceProperties('AWS::Logs::LogGroup', { RetentionInDays: POLICY.logRetention });
    template.hasResourceProperties('AWS::ElasticLoadBalancingV2::LoadBalancer', { Scheme: 'internal' });
    template.hasResourceProperties('AWS::EC2::SecurityGroupIngress', { SourcePrefixListId: 'pl-0cloudfront000000', FromPort: 80 });
    template.hasResourceProperties('AWS::CloudFront::VpcOrigin', Match.anyValue());
    template.hasResourceProperties('AWS::CloudFront::Distribution', {
      DistributionConfig: Match.objectLike({
        DefaultCacheBehavior: Match.objectLike({ ViewerProtocolPolicy: 'redirect-to-https' }),
        CacheBehaviors: [Match.objectLike({ PathPattern: '/api/*', ViewerProtocolPolicy: 'redirect-to-https' })],
        ViewerCertificate: Match.objectLike({ MinimumProtocolVersion: POLICY.minimumTls }),
        WebACLId: Match.anyValue(),
      }),
    });
    template.hasResourceProperties('AWS::Route53::RecordSet', { Type: 'A' });
    template.hasResourceProperties('AWS::EC2::SecurityGroupIngress', { FromPort: POLICY.databasePort, CidrIp: Match.absent() });
    template.resourceCountIs('AWS::WAFv2::WebACL', 0); // WAF は us-east-1 の隣のスタック
    template.resourceCountIs('AWS::RDS::DBInstance', 0);
    template.hasResourceProperties('AWS::ECS::Service', { DesiredCount: 1 });
  });

  test('us-east-1 の隣のスタックに、証明書と CloudFront 用の WAF（標準のルール）ができる', () => {
    const { edge } = apiService('dev');
    expect(edge.region).toBe('us-east-1');
    const template = Template.fromStack(edge);
    template.hasResourceProperties('AWS::CertificateManager::Certificate', { ValidationMethod: 'DNS' });
    template.hasResourceProperties('AWS::WAFv2::WebACL', {
      Scope: 'CLOUDFRONT',
      DefaultAction: { Allow: {} },
      Rules: Match.arrayWith([
        Match.objectLike({ Statement: { RateBasedStatement: Match.objectLike({ Limit: POLICY.rateLimitPer5Min }) } }),
        Match.objectLike({ Statement: { ManagedRuleGroupStatement: { VendorName: 'AWS', Name: 'AWSManagedRulesCommonRuleSet' } } }),
      ]),
    });
  });

  test('画面がないサービスは、すべてを API へ流す', () => {
    const { api } = apiService('dev');
    const template = Template.fromStack(api);
    template.resourceCountIs('AWS::S3::Bucket', 0);
    template.hasResourceProperties('AWS::CloudFront::Distribution', {
      DistributionConfig: Match.objectLike({ CacheBehaviors: Match.absent() }),
    });
  });

  test('本番環境：書かなくても2タスク・Multi-AZになり、新規DBは暗号化される', () => {
    const { api } = apiService('prod', { db: 'new' });
    const template = Template.fromStack(api);

    template.hasResourceProperties('AWS::ECS::Service', { DesiredCount: 2 });
    template.hasResourceProperties('AWS::RDS::DBInstance', { MultiAZ: true, StorageEncrypted: true });
  });

  test('部品の既定のままなら、どのルールにも引っかからない', () => {
    for (const envType of ['dev', 'stg', 'prod'] as const) {
      const { api } = apiService(envType, { site: site() });
      for (const id of ['INF-07', 'INF-12', 'INF-18', 'INF-21', 'INF-41']) expectAllowed(api, id);
    }
  });

  test('論理IDが変わっていない（部品の中を分け直したときに作り直しに気づくため）', () => {
    const { api } = apiService('dev', { site: { source: join(__dirname, 'fixtures', 'web') } });
    const ids = Object.keys(Template.fromStack(api).toJSON().Resources).sort();
    expect(ids).toMatchSnapshot();
  });
});

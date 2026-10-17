import { CfnResource, Stack, aws_cloudfront as cloudfront, aws_elasticloadbalancingv2 as elbv2 } from 'aws-cdk-lib';
import { Verdict, defineRule } from '../define-rule';

const HTTPS_ONLY = ['redirect-to-https', 'https-only'];

/** リスナーの付いたロードバランサーが非公開（internal）か */
const isInternal = (listener: elbv2.CfnListener): boolean => {
  const stack = Stack.of(listener);
  const ref = stack.resolve(listener.loadBalancerArn);
  if (!ref || typeof ref !== 'object' || !('Ref' in ref)) return false; // 分からないものは外向きとみなす
  const lb = stack.node
    .findAll()
    .find((c): c is elbv2.CfnLoadBalancer => c instanceof elbv2.CfnLoadBalancer && stack.resolve(c.logicalId) === ref.Ref);
  return lb !== undefined && stack.resolve(lb.scheme) === 'internal';
};

/**
 * INF-21：外部との通信は TLS だけ。
 * 入口（CloudFront）は、すべての経路で HTTPS だけを受ける（HTTP は HTTPS へのリダイレクトだけ許す）。
 * インターネットに出たロードバランサーがあれば、そのリスナーも HTTPS かリダイレクトだけ。非公開のものは対象外。
 */
export default defineRule({
  id: 'INF-21',
  title: '外部との通信をTLSで暗号化する',
  envs: ['dev', 'stg', 'prod'],
  check: (node: CfnResource): Verdict => {
    const get = (value: unknown) => Stack.of(node).resolve(value);
    if (node instanceof cloudfront.CfnDistribution) {
      const config = get(node.distributionConfig);
      const behaviors = [config.defaultCacheBehavior, ...(config.cacheBehaviors ?? [])];
      return behaviors.every((b: { viewerProtocolPolicy?: string }) => HTTPS_ONLY.includes(b.viewerProtocolPolicy ?? ''));
    }
    if (node instanceof elbv2.CfnListener) {
      if (isInternal(node)) return undefined;
      if (get(node.protocol) === 'HTTPS') return true;
      const actions: Array<{ type?: string }> = get(node.defaultActions) ?? [];
      return actions.length > 0 && actions.every((action) => action.type === 'redirect');
    }
    return undefined;
  },
});

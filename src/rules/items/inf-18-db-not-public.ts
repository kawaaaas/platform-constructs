import { CfnResource, Stack, aws_ec2 as ec2 } from 'aws-cdk-lib';
import { POLICY } from '../../env';
import { Verdict, defineRule } from '../define-rule';

interface IngressLike {
  readonly cidrIp?: string;
  readonly cidrIpv6?: string;
  readonly fromPort?: unknown;
  readonly toPort?: unknown;
}

const opensDbToInternet = (rule: IngressLike): boolean => {
  const anywhere = rule.cidrIp === '0.0.0.0/0' || rule.cidrIpv6 === '::/0';
  if (!anywhere) return false;
  // ポートが参照（例：RDSの Endpoint.Port）で番号が分からないものは、DBのポートとみなして止める
  if (typeof rule.fromPort !== 'number' && rule.fromPort !== undefined) return true;
  if (typeof rule.toPort !== 'number' && rule.toPort !== undefined) return true;
  const from = (rule.fromPort as number | undefined) ?? 0;
  const to = (rule.toPort as number | undefined) ?? 65535;
  return from <= POLICY.databasePort && POLICY.databasePort <= to;
};

/**
 * 【デモ2／基準2 セキュリティ】試すこと1 で止まるルール（ルールの中身を聞かれたら開く）
 *   ・チェックシートの1項目が、この1ファイル。項目番号・内容・対象の環境・判定の4つを書くだけ。
 *   ・判定：DBのポート（5432）を、インターネット全体（0.0.0.0/0）に開けていたら違反。
 *
 * INF-18：インターネットからDBのポートへの接続を許可しない。
 * 別スタックのセキュリティグループに足すと CfnSecurityGroupIngress、
 * 同じスタック内だとインライン指定になるため、両方を検査する。
 */
export default defineRule({
  id: 'INF-18',
  title: 'インターネットからDBへの接続を許可しない',
  envs: ['dev', 'stg', 'prod'],
  check: (node: CfnResource): Verdict => {
    const get = (value: unknown) => Stack.of(node).resolve(value);
    if (node instanceof ec2.CfnSecurityGroupIngress) {
      return !opensDbToInternet({
        cidrIp: get(node.cidrIp),
        cidrIpv6: get(node.cidrIpv6),
        fromPort: get(node.fromPort),
        toPort: get(node.toPort),
      });
    }
    if (node instanceof ec2.CfnSecurityGroup) {
      const rules: IngressLike[] = get(node.securityGroupIngress) ?? [];
      return !rules.some(opensDbToInternet);
    }
    return undefined;
  },
});

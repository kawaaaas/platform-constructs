import { RemovalPolicy } from 'aws-cdk-lib';
import { IConstruct } from 'constructs';

/**
 * デモ用アカウントかどうか（cdk.json の context "acme:demo": true）。
 * true のときだけ、削除しやすい設定（データを残さない）にする。本番の既定は「残す」。
 */
export const isDemo = (scope: IConstruct): boolean => {
  const value = scope.node.tryGetContext('acme:demo');
  return value === true || value === 'true';
};

export const removalPolicyFor = (scope: IConstruct): RemovalPolicy =>
  isDemo(scope) ? RemovalPolicy.DESTROY : RemovalPolicy.RETAIN;

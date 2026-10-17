import { Stack } from 'aws-cdk-lib';
import { NagSuppressions } from 'cdk-nag';
import { IConstruct } from 'constructs';

/**
 * ルールの例外を、理由付きで登録する。
 * 例外はレポートに「例外（理由）」として残り、CIがPRにラベルとコメントを付ける。
 *
 * @param scope 例外にする範囲（スタックを渡すとスタック全体）
 * @param ruleId チェックシートの項目番号（例：'INF-41'）
 * @param reason 理由（誰が承認したかも書く）
 */
export const addException = (scope: IConstruct, ruleId: string, reason: string): void => {
  const suppression = [{ id: `Checksheet-${ruleId}`, reason }];
  if (scope instanceof Stack) {
    NagSuppressions.addStackSuppressions(scope, suppression);
  } else {
    NagSuppressions.addResourceSuppressions(scope, suppression, true);
  }
};

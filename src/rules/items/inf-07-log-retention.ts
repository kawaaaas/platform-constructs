import { aws_logs as logs } from 'aws-cdk-lib';
import { POLICY } from '../../env';
import { defineRule, forEach } from '../define-rule';

/** INF-07：ログは env/policy.ts の期間以上保管する（無期限は準拠） */
export default defineRule({
  id: 'INF-07',
  title: 'ログを定めた期間保管する',
  envs: ['dev', 'stg', 'prod'],
  check: forEach(logs.CfnLogGroup, (logGroup, get) => {
    const days = get(logGroup.retentionInDays);
    return days === undefined || days >= POLICY.logRetention;
  }),
});

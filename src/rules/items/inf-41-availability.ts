import { aws_ecs as ecs } from 'aws-cdk-lib';
import { defineRule, forEach } from '../define-rule';

/**
 * 【デモ2／基準2 セキュリティ】試すこと2 で止まり、例外で通すルール（ルールの中身を聞かれたら開く）
 *   ・判定：検証・本番で、コンテナが2つ（2タスク）未満なら違反。開発環境は対象外（envs）。
 *
 * INF-41（項目番号は仮）：検証・本番は2タスク以上で動かす
 */
export default defineRule({
  id: 'INF-41',
  title: '検証・本番は2タスク以上で動かす',
  envs: ['stg', 'prod'],
  check: forEach(ecs.CfnService, (service, get) => (get(service.desiredCount) ?? 0) >= 2),
});

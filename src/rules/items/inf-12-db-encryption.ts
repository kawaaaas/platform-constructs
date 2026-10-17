import { aws_rds as rds } from 'aws-cdk-lib';
import { defineRule, forEach } from '../define-rule';

/** INF-12：データベースは保存時に暗号化する */
export default defineRule({
  id: 'INF-12',
  title: 'データベースを保存時に暗号化する',
  envs: ['dev', 'stg', 'prod'],
  check: forEach(rds.CfnDBInstance, (db, get) => get(db.storageEncrypted) === true),
});

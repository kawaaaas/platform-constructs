import { aws_rds as rds } from 'aws-cdk-lib';
import { apiService, expectAllowed, expectBlocked } from '../../helpers';

describe('INF-12 データベースを保存時に暗号化する', () => {
  test('止まる例：L1で暗号化を外す', () => {
    const { api } = apiService('dev', { db: 'new' });
    (api.database!.node.defaultChild as rds.CfnDBInstance).storageEncrypted = false;
    expectBlocked(api, 'INF-12');
  });

  test('通る例：部品の既定（暗号化あり）', () => {
    const { api } = apiService('dev', { db: 'new' });
    expectAllowed(api, 'INF-12');
  });
});

import { aws_ec2 as ec2 } from 'aws-cdk-lib';
import { apiService, expectAllowed, expectBlocked } from '../../helpers';

describe('INF-18 インターネットからDBへの接続を許可しない', () => {
  test('止まる例：共有DBを手元から調査するためにインターネットへ開く', () => {
    const { api } = apiService('dev');
    api.dbConnections.allowFromAnyIpv4(ec2.Port.tcp(5432));
    expectBlocked(api, 'INF-18');
  });

  test('止まる例：自分専用のDBをインターネットへ開く（同じスタック内のインライン指定）', () => {
    const { api } = apiService('dev', { db: 'new' });
    api.dbConnections.allowDefaultPortFromAnyIpv4();
    expectBlocked(api, 'INF-18');
  });

  test('止まる例：RDSの接続口を直接使って開く（ポートが参照のまま）', () => {
    const { api } = apiService('dev', { db: 'new' });
    api.database!.connections.allowDefaultPortFromAnyIpv4();
    expectBlocked(api, 'INF-18');
  });

  test('通る例：部品の既定（このサービスからの接続だけを許可）', () => {
    const { api } = apiService('dev');
    expectAllowed(api, 'INF-18');
  });
});

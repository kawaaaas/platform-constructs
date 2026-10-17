import { aws_logs as logs } from 'aws-cdk-lib';
import { apiService, expectAllowed, expectBlocked } from '../../helpers';

describe('INF-07 ログを定めた期間保管する', () => {
  test('止まる例：保管期間が基準より短いロググループを足す', () => {
    const { api } = apiService('dev');
    new logs.LogGroup(api, 'ShortLived', { retention: logs.RetentionDays.ONE_DAY });
    expectBlocked(api, 'INF-07');
  });

  test('通る例：部品の既定', () => {
    const { api } = apiService('dev');
    expectAllowed(api, 'INF-07');
  });
});

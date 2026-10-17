import { addException } from '../../../src';
import { apiService, expectAllowed, expectBlocked } from '../../helpers';

describe('INF-41 検証・本番は2タスク以上で動かす', () => {
  test('止まる例：検証環境を1タスクにする', () => {
    const { api } = apiService('stg', { minTasks: 1 });
    expectBlocked(api, 'INF-41');
  });

  test('通る例：理由を書いて例外にする', () => {
    const { api } = apiService('stg', { minTasks: 1 });
    addException(api, 'INF-41', '検証環境はコストを優先し1タスクで運用する（インフラ承認済み）');
    expectAllowed(api, 'INF-41');
  });

  test('通る例：開発環境は対象外', () => {
    const { api } = apiService('dev', { minTasks: 1 });
    expectAllowed(api, 'INF-41');
  });
});

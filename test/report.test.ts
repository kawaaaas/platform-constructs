import { aws_ecs as ecs } from 'aws-cdk-lib';
import { ApiService, addException } from '../src';
import { buildReport, toMarkdown } from '../src/bin/report';
import { stageOf, testApp } from './helpers';

test('レポート：例外は理由付きで「例外」と出る', () => {
  const app = testApp();
  for (const envType of ['dev', 'stg', 'prod'] as const) {
    const api = new ApiService(stageOf(app, envType), 'Dashboard', {
      service: 'dashboard',
      image: ecs.ContainerImage.fromRegistry('public.ecr.aws/nginx/nginx:stable'),
      db: 'readExisting',
      minTasks: envType === 'stg' ? 1 : undefined,
    });
    if (envType === 'stg') addException(api, 'INF-41', '検証環境はコストを優先し1タスクで運用する（インフラ承認済み）');
  }
  app.synth();

  const report = buildReport(app.outdir);
  expect(report.envs).toEqual(['Dev', 'Stg', 'Prod']);
  const inf41 = report.rows.find((r) => r.id === 'INF-41')!;
  expect(inf41.results).toEqual({ Dev: '—', Stg: '例外', Prod: '準拠' });
  expect(inf41.reasons[0]).toContain('コストを優先');
  expect(report.rows.find((r) => r.id === 'INF-07')!.results).toEqual({ Dev: '準拠', Stg: '準拠', Prod: '準拠' });
  expect(toMarkdown(report)).toContain('| INF-41 |');
});

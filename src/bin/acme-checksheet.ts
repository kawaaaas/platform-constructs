#!/usr/bin/env node
import { existsSync } from 'fs';
import { buildReport, toMarkdown, toText } from './report';

/**
 * 検査結果（cdk.out の NagReport）をチェックシートの形の表にする。
 *
 *   npx acme-checksheet                     ターミナルに表を出す
 *   npx acme-checksheet --markdown          Markdown で出す（PRのサマリー用）
 *   npx acme-checksheet --exceptions-only   例外の行だけ出す。例外がなければ何も出さない
 *   npx acme-checksheet --dir <cdk.out>     読むディレクトリ（既定：./cdk.out）
 */
const args = process.argv.slice(2);
const flag = (name: string) => args.includes(name);
const dirIndex = args.indexOf('--dir');
const dir = dirIndex >= 0 ? args[dirIndex + 1] : 'cdk.out';

if (!existsSync(dir)) {
  console.error(`${dir} がありません。先に cdk synth を実行してください。`);
  process.exit(1);
}

const report = buildReport(dir);
if (report.envs.length === 0) {
  console.error(`${dir} に検査結果（Checksheet-*-NagReport.json）がありません。PlatformStage を使っているか確認してください。`);
  process.exit(1);
}
const rows = flag('--exceptions-only') ? report.rows.filter((r) => r.reasons.length > 0) : report.rows;
if (rows.length === 0) process.exit(0);

if (flag('--markdown')) {
  const title = flag('--exceptions-only') ? '### チェックシートの例外' : '### チェックシートの検査結果';
  console.log(`${title}\n\n${toMarkdown(report, rows)}`);
} else {
  console.log(toText(report, rows));
}

import { readFileSync, readdirSync, statSync } from 'fs';
import { basename, join } from 'path';
import { RULES } from '../rules/rule-list';

/** 1つの項目・1つの環境の結果 */
export type Result = '準拠' | '違反' | '例外' | '—';

export interface ReportRow {
  readonly id: string;
  readonly title: string;
  readonly results: Record<string, Result>;
  readonly reasons: string[];
}

export interface Report {
  readonly envs: string[];
  readonly rows: ReportRow[];
}

interface NagLine {
  readonly ruleId: string;
  readonly compliance: string;
  readonly exceptionReason: string;
}

const ENV_ORDER = ['Dev', 'Stg', 'Prod'];
const FILE = /^Checksheet-(.+?)-(.+)-NagReport\.json$/;

/** cdk.out 配下の Checksheet-<Stage>-<Stack>-NagReport.json を再帰的に探す */
const findReports = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return findReports(path);
    return FILE.test(name) ? [path] : [];
  });

/** 検査結果を「項目番号 × 環境」の表にまとめる */
export const buildReport = (outdir: string): Report => {
  const lines = new Map<string, NagLine[]>(); // key: `${env}/${ruleId}`
  const envs = new Set<string>();
  for (const file of findReports(outdir)) {
    const env = FILE.exec(basename(file))![1];
    envs.add(env);
    const report: { lines: NagLine[] } = JSON.parse(readFileSync(file, 'utf8'));
    for (const line of report.lines) {
      const key = `${env}/${line.ruleId}`;
      lines.set(key, [...(lines.get(key) ?? []), line]);
    }
  }
  const sortedEnvs = [...envs].sort((a, b) => rank(a) - rank(b));

  const rows = RULES.map((rule) => {
    const results: Record<string, Result> = {};
    const reasons = new Set<string>();
    for (const env of sortedEnvs) {
      const found = lines.get(`${env}/Checksheet-${rule.id}`) ?? [];
      if (found.some((l) => l.compliance === 'Non-Compliant')) results[env] = '違反';
      else if (found.some((l) => l.compliance === 'Suppressed')) {
        results[env] = '例外';
        found.filter((l) => l.compliance === 'Suppressed').forEach((l) => reasons.add(`${env}：${l.exceptionReason}`));
      } else if (found.some((l) => l.compliance === 'Compliant')) results[env] = '準拠';
      else results[env] = '—';
    }
    return { id: rule.id, title: rule.title, results, reasons: [...reasons] };
  });
  return { envs: sortedEnvs, rows };
};

const rank = (env: string) => {
  const i = ENV_ORDER.indexOf(env);
  return i === -1 ? ENV_ORDER.length : i;
};

/** Markdown の表にする（PRのサマリーとコメント用） */
export const toMarkdown = (report: Report, rows = report.rows): string => {
  const header = ['項目番号', '内容', ...report.envs, '例外の理由'];
  const body = rows.map((r) => [r.id, r.title, ...report.envs.map((e) => r.results[e]), r.reasons.join('<br>') || ''].join(' | '));
  return [`| ${header.join(' | ')} |`, `| ${header.map(() => '---').join(' | ')} |`, ...body.map((b) => `| ${b} |`)].join('\n');
};

/** ターミナル用に、全角を2文字分として桁をそろえる */
export const toText = (report: Report, rows = report.rows): string => {
  const header = ['項目番号', '内容', ...report.envs, '例外の理由'];
  const table = [header, ...rows.map((r) => [r.id, r.title, ...report.envs.map((e) => r.results[e]), r.reasons.join(' / ')])];
  const widths = header.map((_, i) => Math.max(...table.map((row) => width(row[i]))));
  return table.map((row) => row.map((cell, i) => (i === row.length - 1 ? cell : pad(cell, widths[i]))).join('  ')).join('\n');
};

const width = (s: string) => [...s].reduce((n, c) => n + (c.charCodeAt(0) > 0x2e7f ? 2 : 1), 0);
const pad = (s: string, w: number) => s + ' '.repeat(Math.max(0, w - width(s)));

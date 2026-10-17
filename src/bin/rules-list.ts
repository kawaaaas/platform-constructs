#!/usr/bin/env node
import { RULES } from '../rules/rule-list';

/** 有効なルールの一覧を Markdown の表で出す（README に貼る用） */
const envName = { dev: '開発', stg: '検証', prod: '本番' } as const;
console.log('| 項目番号 | 内容 | 対象の環境 |');
console.log('| --- | --- | --- |');
for (const rule of RULES) {
  console.log(`| ${rule.id} | ${rule.title} | ${rule.envs.map((e) => envName[e]).join('・')} |`);
}

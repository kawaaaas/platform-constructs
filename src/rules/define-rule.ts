import { CfnResource, Stack } from 'aws-cdk-lib';
import { IApplyRule, NagMessageLevel, NagRuleCompliance } from 'cdk-nag';
import { EnvType } from '../env';

/** 判定結果：true＝準拠、false＝違反、undefined＝このリソースは対象外 */
export type Verdict = boolean | undefined;

/** ルールを書く人が書くのは、この4つだけ */
export interface RuleDefinition {
  /** チェックシートの項目番号（例：'INF-18'）。エラー表示は Checksheet-INF-18 になる */
  readonly id: string;
  /** チェックシートの内容 */
  readonly title: string;
  /** このルールをかける環境 */
  readonly envs: readonly EnvType[];
  /** 判定 */
  readonly check: (node: CfnResource) => Verdict;
}

export interface ChecksheetRule extends RuleDefinition {
  /** cdk-nag に渡す形にする（ChecksheetPack が使う） */
  toNagRule(node: CfnResource): IApplyRule;
}

/** cdk-nag の書き方（applyRule、NagRuleCompliance、ルール関数の名前付け）を隠すヘルパー */
export const defineRule = (def: RuleDefinition): ChecksheetRule => {
  const rule = Object.defineProperty(
    (node: CfnResource): NagRuleCompliance => {
      const verdict = def.check(node);
      if (verdict === undefined) return NagRuleCompliance.NOT_APPLICABLE;
      return verdict ? NagRuleCompliance.COMPLIANT : NagRuleCompliance.NON_COMPLIANT;
    },
    'name',
    { value: def.id },
  );
  return {
    ...def,
    toNagRule: (node) => ({
      ruleSuffixOverride: def.id,
      info: `${def.id} ${def.title}`,
      explanation: `チェックシート ${def.id}「${def.title}」に違反しています。例外にする場合は、理由を書いて addException を使ってください。`,
      level: NagMessageLevel.ERROR,
      rule,
      node,
    }),
  };
};

/** Token を解決して値を取り出す */
export type Get = (value: unknown) => any;

/**
 * 指定した型のリソースだけを判定する。それ以外は自動で「対象外」になる。
 * get で Token を値にしてから比べる。
 */
export const forEach =
  <T extends CfnResource>(type: abstract new (...args: any[]) => T, check: (resource: T, get: Get) => boolean) =>
  (node: CfnResource): Verdict =>
    node instanceof type ? check(node as T, (value) => Stack.of(node).resolve(value)) : undefined;

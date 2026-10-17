import { CfnResource } from 'aws-cdk-lib';
import { NagPack, NagPackProps } from 'cdk-nag';
import { IConstruct } from 'constructs';
import { EnvType } from '../env';
import { RULES } from './rule-list';

export interface ChecksheetPackProps extends NagPackProps {
  readonly envType: EnvType;
}

/** チェックシートのルール一式。RULES を順に適用するだけ */
export class ChecksheetPack extends NagPack {
  private readonly envType: EnvType;

  constructor(props: ChecksheetPackProps) {
    super(props);
    this.packName = 'Checksheet';
    this.envType = props.envType;
  }

  public visit(node: IConstruct): void {
    if (!(node instanceof CfnResource)) return;
    for (const rule of RULES) {
      if (rule.envs.includes(this.envType)) this.applyRule(rule.toNagRule(node));
    }
  }
}

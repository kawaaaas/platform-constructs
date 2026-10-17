import { aws_logs as logs } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { POLICY, removalPolicyFor } from '../../env';

/** 関心：サービスのログ。保管期間は env/policy.ts の基準値で固定する */
export class ServiceLogs extends Construct {
  public readonly logGroup: logs.LogGroup;

  constructor(scope: Construct, id: string) {
    super(scope, id);
    this.logGroup = new logs.LogGroup(this, 'LogGroup', {
      retention: POLICY.logRetention,
      removalPolicy: removalPolicyFor(this),
    });
  }
}

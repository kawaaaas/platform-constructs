import { aws_route53 as route53, aws_ssm as ssm } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { edgeContract } from '../../env';

/**
 * 関心：インフラが管理する共有の資源を参照する（何も作らない）。us-east-1 用。
 * ホストゾーンを、us-east-1 の SSM から読む（CloudFront 用の証明書の DNS 検証に使う）。
 */
export class EdgeResources extends Construct {
  public readonly hostedZone: route53.IHostedZone;

  constructor(scope: Construct, id: string) {
    super(scope, id);
    const param = (name: string) => ssm.StringParameter.valueForStringParameter(this, name);
    this.hostedZone = route53.HostedZone.fromHostedZoneAttributes(this, 'Zone', {
      hostedZoneId: param(edgeContract.dnsZoneId),
      zoneName: param(edgeContract.dnsZoneName),
    });
  }
}

import { aws_certificatemanager as acm, aws_route53 as route53 } from 'aws-cdk-lib';
import { Construct } from 'constructs';

export interface EdgeCertificateProps {
  /** 例：dashboard-dev.example.com */
  readonly domainName: string;
  readonly hostedZone: route53.IHostedZone;
}

/** 関心：入口（CloudFront）のサーバー証明書。DNS で自動検証する（us-east-1 に置く） */
export class EdgeCertificate extends Construct {
  public readonly certificate: acm.ICertificate;

  constructor(scope: Construct, id: string, props: EdgeCertificateProps) {
    super(scope, id);
    this.certificate = new acm.Certificate(this, 'Certificate', {
      domainName: props.domainName,
      validation: acm.CertificateValidation.fromDns(props.hostedZone),
    });
  }
}

import { aws_cloudfront as cloudfront, aws_s3 as s3, aws_s3_deployment as s3deploy } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { EnvType, isDemo, removalPolicyFor } from '../../env';

export interface SiteContentProps {
  /** 画面のビルド結果のディレクトリ（例：'../app/web/dist'） */
  readonly source: string;
}

/**
 * 関心：画面の置き場所（非公開のS3）と、その中身の配置。
 * S3 は CloudFront（OAC）からだけ読める。配信の設定は web-entry が持つ。
 */
export class SiteContent extends Construct {
  public readonly bucket: s3.Bucket;
  private readonly source: string;

  constructor(scope: Construct, id: string, props: SiteContentProps) {
    super(scope, id);
    this.source = props.source;
    this.bucket = new s3.Bucket(this, 'Bucket', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      removalPolicy: removalPolicyFor(this),
      autoDeleteObjects: isDemo(this),
    });
  }

  /**
   * 画面のビルド結果と config.json を置き、CloudFront のキャッシュを消す。
   * API は同じドメインの /api/* にあるので、画面は相対パスで呼べる。
   */
  public publish(distribution: cloudfront.IDistribution, envType: EnvType): void {
    new s3deploy.BucketDeployment(this, 'Deploy', {
      destinationBucket: this.bucket,
      distribution,
      sources: [s3deploy.Source.asset(this.source), s3deploy.Source.jsonData('config.json', { apiUrl: '', env: envType })],
    });
  }
}

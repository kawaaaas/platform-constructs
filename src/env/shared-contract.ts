import { EnvType } from './env-defaults';

/** 共有の予約DBのデータベース名 */
export const SHARED_DATABASE_NAME = 'reservation';

/**
 * インフラ（infra-foundation）とアプリの間の約束（東京リージョン）。
 * 共有の資源は、この名前のSSMパラメーターとVPC名で受け渡す。
 * infra-foundation 側の ssm-exports と同じ名前を使う。
 */
export const sharedContract = (envType: EnvType) => {
  const prefix = `/acme/${envType}`;
  return {
    vpcName: `acme-${envType}`,
    dnsZoneId: `${prefix}/dns/zone-id`,
    dnsZoneName: `${prefix}/dns/zone-name`,
    dbEndpoint: `${prefix}/reservation-db/endpoint`,
    dbSecurityGroupId: `${prefix}/reservation-db/sg-id`,
    dbReadonlySecretArn: `${prefix}/reservation-db/readonly-secret-arn`,
    dbReadwriteSecretArn: `${prefix}/reservation-db/readwrite-secret-arn`,
  };
};

/**
 * インフラとアプリの間の約束（us-east-1）。環境によらず共通。
 * CloudFront 用の証明書の DNS 検証に使う。
 */
export const edgeContract = {
  dnsZoneId: '/acme/edge/dns/zone-id',
  dnsZoneName: '/acme/edge/dns/zone-name',
} as const;

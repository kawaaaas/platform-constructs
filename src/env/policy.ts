import { aws_cloudfront as cloudfront, aws_logs as logs } from 'aws-cdk-lib';

/**
 * お客様の基準値。基準はここにだけ書く。
 * 部品の既定値と、チェックシートのルールの閾値の両方がこの値を参照する。
 *
 * =====================================================================================
 * 【デモ3／基準3 今後の拡大】見ていただく点② 直すのは部品の1か所（GitHub のコミットの差分で見せる）
 *   ・想定：商談中の2社目のチェーンのチェックシートでは「ログの保管は1年」（見ていただく点①）。
 *   ・直すのは下の logRetention の1行だけ（SIX_MONTHS → ONE_YEAR）。
 *     この1行を、部品の既定値（ログの作り方）と、検査のルール（INF-07 の閾値）の両方が見ているので、
 *     作るものと確かめるものが同時に新しい基準に変わる。ずれが起きない。
 *   ・タグを打つと CI が新しい版（v1.1.0）を公開する。各チームは取り込む前に cdk diff で、
 *     変わるのがログの保管期間（180日 → 365日）だけで、作り直しが起きないことを確かめられる。
 *   ・基準の変更は 9環境ぶんで 4.5人日 → 約1人日。2社目・3社目の基準にも、ここ1か所で追従できる。
 * =====================================================================================
 */
export const POLICY = {
  /** INF-07 ログを定めた期間保管する ← 【デモ3】2社目の基準に合わせて ONE_YEAR に変える1行 */
  logRetention: logs.RetentionDays.SIX_MONTHS,
  /** INF-21 外部との通信をTLSで暗号化する（入口の CloudFront が受け付ける最低の TLS） */
  minimumTls: cloudfront.SecurityPolicyProtocol.TLS_V1_2_2021,
  /** 入口の WAF：同じIPからのアクセスを、5分あたりこの回数までに抑える（クローラーやボットの連打を止める） */
  rateLimitPer5Min: 300,
  /** 共有DBのポート */
  databasePort: 5432,
} as const;

/** 部品が使うリージョン */
export const DEFAULT_REGION = 'ap-northeast-1';

/** CloudFront 用の証明書と WAF は、この リージョンにしか置けない */
export const EDGE_REGION = 'us-east-1';

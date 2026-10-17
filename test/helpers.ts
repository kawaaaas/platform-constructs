import { mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { App, Stack, aws_ecs as ecs } from 'aws-cdk-lib';
import { Annotations, Match } from 'aws-cdk-lib/assertions';
import { ApiService, ApiServiceProps, EnvType, PlatformStage } from '../src';

export const ACCOUNT = '123456789012';
export const REGION = 'ap-northeast-1';

/** Vpc.fromLookup の結果（AWSにつながずにテストするため） */
const vpcContext = (envType: EnvType) => {
  const subnets = (prefix: string, third: number) =>
    ['a', 'c'].map((az, i) => ({
      subnetId: `subnet-${prefix}${envType}${i}0000000000`,
      cidr: `10.0.${third + i}.0/24`,
      availabilityZone: `${REGION}${az}`,
      routeTableId: `rtb-${prefix}${envType}${i}000000000`,
    }));
  return {
    [`vpc-provider:account=${ACCOUNT}:filter.tag:Name=acme-${envType}:region=${REGION}:returnAsymmetricSubnets=true`]: {
      vpcId: `vpc-0${envType}000000000000`,
      vpcCidrBlock: '10.0.0.0/16',
      availabilityZones: [],
      subnetGroups: [
        { name: 'public', type: 'Public', subnets: subnets('pub', 0) },
        { name: 'app', type: 'Private', subnets: subnets('app', 10) },
        { name: 'data', type: 'Isolated', subnets: subnets('dat', 20) },
      ],
    },
  };
};

/** CloudFront のアドレス一覧（PrefixList.fromLookup）の結果 */
const prefixListContext = {
  [`cc-api-provider:account=${ACCOUNT}:expectedMatchCount=exactly-one:propertiesToReturn.0=PrefixListId:propertyMatch.PrefixListName=com.amazonaws.global.cloudfront.origin-facing:region=${REGION}:typeName=AWS$:$:EC2$:$:PrefixList`]:
    [{ PrefixListId: 'pl-0cloudfront000000' }],
};

export const testApp = (): App =>
  new App({
    outdir: mkdtempSync(join(tmpdir(), 'cdk-out-')),
    context: { ...vpcContext('dev'), ...vpcContext('stg'), ...vpcContext('prod'), ...prefixListContext },
  });

export const stageOf = (app: App, envType: EnvType): PlatformStage =>
  new PlatformStage(app, envType.charAt(0).toUpperCase() + envType.slice(1), {
    envType,
    env: { account: ACCOUNT, region: REGION },
  });

export const apiService = (envType: EnvType, overrides: Partial<ApiServiceProps> = {}) => {
  const app = testApp();
  const stage = stageOf(app, envType);
  const api = new ApiService(stage, 'Dashboard', {
    service: 'dashboard',
    image: ecs.ContainerImage.fromRegistry('public.ecr.aws/nginx/nginx:stable'),
    db: 'readExisting',
    ...overrides,
  });
  const edge = stage.node.findChild('DashboardEdge') as Stack;
  return { app, stage, api, edge };
};

const errorsOf = (stack: Stack, ruleId: string) =>
  Annotations.fromStack(stack).findError('*', Match.stringLikeRegexp(`Checksheet-${ruleId}`));

/** ルール違反で止まること */
export const expectBlocked = (stack: Stack, ruleId: string) => expect(errorsOf(stack, ruleId).length).toBeGreaterThan(0);

/** ルールに引っかからないこと */
export const expectAllowed = (stack: Stack, ruleId: string) => expect(errorsOf(stack, ruleId)).toHaveLength(0);

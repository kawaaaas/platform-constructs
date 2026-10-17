/** 環境の種別 */
export type EnvType = 'dev' | 'stg' | 'prod';

/** 環境ごとに変わるスペック */
export interface ServiceSpec {
  readonly cpu: number;
  readonly memoryMiB: number;
  readonly minTasks: number;
  readonly maxTasks: number;
  readonly multiAz: boolean;
}

/** アプリが書かなければこの値が入る */
export const ENV_DEFAULTS: Record<EnvType, ServiceSpec> = {
  dev: { cpu: 256, memoryMiB: 512, minTasks: 1, maxTasks: 2, multiAz: false },
  stg: { cpu: 256, memoryMiB: 512, minTasks: 2, maxTasks: 2, multiAz: true },
  prod: { cpu: 512, memoryMiB: 1024, minTasks: 2, maxTasks: 4, multiAz: true },
};

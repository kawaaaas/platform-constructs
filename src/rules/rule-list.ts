import { ChecksheetRule } from './define-rule';
import inf07 from './items/inf-07-log-retention';
import inf12 from './items/inf-12-db-encryption';
import inf18 from './items/inf-18-db-not-public';
import inf21 from './items/inf-21-https-only';
import inf41 from './items/inf-41-availability';

/** 有効なルールの一覧。ルールを足したら、ここに1行足す */
export const RULES: readonly ChecksheetRule[] = [inf07, inf12, inf18, inf21, inf41];

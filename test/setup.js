// テストでは、偽のVPC・サブネットIDに対するCloudFormationの形式チェック（警告）を止めて速くする。
// 実際の cdk synth では有効のまま。
process.env.CDK_VALIDATION = 'false';

export type Scenario = 'A' | 'B' | null;
export type DehydrationSeverity = 'none' | 'mild' | 'moderate' | 'severe';

export interface BasicInfoA {
  gestationalAgeWeeks: number;
  gestationalAgeDays: number;
  birthWeight: number;
  deliveryMode: string;
  highRiskFactors: string;
  apgar1: number;
  apgar5: number;
  apgar10: number;
  sampleType: string;
  samplingTime: number;
  delayedCordClamping: boolean;
}

export interface BasicInfoB {
  ageValue: number;
  ageUnit: 'days' | 'months' | 'years';
  weight: number;
  dehydrationSeverity: DehydrationSeverity;
  sampleType: string;
  oxygenStatus: string;
  clinicalDiagnosis: string;
  hasAlbumin: boolean;
}

export interface BGAData {
  pH: number | null;
  PaCO2: number | null;
  PaO2: number | null;
  HCO3: number | null;
  BE: number | null;
  Lactate: number | null;
  Na: number | null;
  K: number | null;
  Cl: number | null;
  Albumin: number | null;
  Glucose: number | null;
}

export interface BGAAnalysisResult {
  step1: {
    calculatedH: number;
    expectedH: number;
    isConsistent: boolean;
  };
  step2: {
    pHStatus: '酸血症' | '碱血症' | '正常pH但可能存在混合紊乱' | '正常范围' | '轻度酸血症' | '中度酸血症' | '重度酸血症' | '极重度酸血症（最高危值）';
    pHRange: string;
    pHEval: '正常' | '偏低' | '偏高';
    PaCO2Range: string;
    PaCO2Eval: '正常' | '偏低' | '偏高';
    HCO3Range: string;
    HCO3Eval: '正常' | '偏低' | '偏高';
    BERange: string;
    BEEval: '正常' | '偏低' | '偏高';
    LactateRange: string;
    LactateEval: '正常' | '偏高';
    PaO2Range: string;
    PaO2Eval: '正常' | '偏低' | '偏高';
    isHighestRisk: boolean;
  };
  step3: {
    pHDir: '偏低' | '偏高' | '正常';
    PaCO2Dir: '偏低' | '偏高' | '正常';
    direction: '相反' | '相同' | '无明显变化';
    primaryDisorder: '呼吸性酸中毒' | '呼吸性碱中毒' | '代谢性酸中毒' | '代谢性碱中毒' | '无原发酸碱紊乱';
  };
  step4: {
    primaryDisorder: string;
    compensationType: '急性' | '慢性' | '不适用';
    formula: string;
    expectedRange: string;
    actualValue: number | null;
    isCompensated: boolean;
    conclusion: string;
  };
  step5: {
    AG: number | null;
    correctedAG: number | null;
    classification: '高AG' | '正常AG' | '低AG' | '无法计算';
    causes: string;
  };
  step6: {
    deltaAG: number | null;
    expectedHCO3: number | null;
    conclusion: string;
  };
  quickCheck: {
    pHDir: '偏碱' | '偏酸' | '正常';
    PaCO2Dir: '偏高' | '偏低' | '正常';
    direction: '同向' | '反向' | '无明显变化';
    primaryDisorder: '代谢性原发' | '呼吸性原发' | '无明显原发';
    isConsistent: boolean;
  };
  uabga?: {
    asphyxia: '无窒息' | '轻度窒息' | '重度窒息';
    riskLevel: '🟢低风险' | '🟡中风险需警惕' | '🔴高风险';
  };
  finalDiagnosis: string;
  clinicalSuggestions: string;
}

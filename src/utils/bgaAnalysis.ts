import { BasicInfoA, BasicInfoB, BGAData, BGAAnalysisResult, Scenario } from '../types';

export function analyzeBGA(scenario: Scenario, infoA: BasicInfoA | null, infoB: BasicInfoB | null, data: BGAData): BGAAnalysisResult {
  const { pH, PaCO2, PaO2, HCO3, BE, Lactate, Na, K, Cl, Albumin, Glucose } = data;

  // Step 1: Internal Consistency
  const calculatedH = (24 * (PaCO2 || 0)) / (HCO3 || 1);
  const expectedH = Math.pow(10, 9 - (pH || 7.4)); // Approximation, or use exact formula: Math.pow(10, -(pH || 7.4)) * 1e9
  const exactExpectedH = Math.pow(10, -(pH || 7.4)) * 1e9;
  const isConsistent = Math.abs(calculatedH - exactExpectedH) / exactExpectedH <= 0.1;

  // Step 2: Acid-Base Status
  let pHRange = '', PaCO2Range = '', HCO3Range = '', BERange = '', LactateRange = '', PaO2Range = '';
  let pHEval: any = '正常', PaCO2Eval: any = '正常', HCO3Eval: any = '正常', BEEval: any = '正常', LactateEval: any = '正常', PaO2Eval: any = '正常';
  let pHStatus: any = '正常pH但可能存在混合紊乱';
  let isHighestRisk = false;

  if (scenario === 'B' && infoB) {
    const { ageValue, ageUnit } = infoB;
    let isPreterm = false; // Need gestational age for B if preterm, but let's assume term if not specified
    let isNeonate = ageUnit === 'days' && ageValue <= 28;
    let isInfant = ageUnit === 'months' && ageValue <= 12;
    let isChild = ageUnit === 'years' && ageValue <= 18;

    if (isNeonate) {
      pHRange = '7.35-7.45'; PaCO2Range = '30-40'; HCO3Range = '19-22'; BERange = '-4~+2';
    } else if (isInfant) {
      pHRange = '7.35-7.45'; PaCO2Range = '30-40'; HCO3Range = '20-24'; BERange = '-2~+2';
    } else {
      pHRange = '7.35-7.45'; PaCO2Range = '35-45'; HCO3Range = '22-26'; BERange = '-2~+2';
    }

    const [pHMin, pHMax] = pHRange.split('-').map(Number);
    if (pH! < pHMin) { pHStatus = '酸血症'; pHEval = '偏低'; }
    else if (pH! > pHMax) { pHStatus = '碱血症'; pHEval = '偏高'; }

    const [pCO2Min, pCO2Max] = PaCO2Range.split('-').map(Number);
    if (PaCO2! < pCO2Min) PaCO2Eval = '偏低'; else if (PaCO2! > pCO2Max) PaCO2Eval = '偏高';

    const [hco3Min, hco3Max] = HCO3Range.split('-').map(Number);
    if (HCO3! < hco3Min) HCO3Eval = '偏低'; else if (HCO3! > hco3Max) HCO3Eval = '偏高';

    const [beMin, beMax] = BERange.split('~').map(Number);
    if (BE! < beMin) BEEval = '偏低'; else if (BE! > beMax) BEEval = '偏高';

  } else if (scenario === 'A') {
    pHRange = '7.24-7.27'; BERange = '-5.60~-2.70'; PaO2Range = '<37.50'; LactateRange = '<6.00';
    
    if (pH! >= 7.24) pHStatus = '正常范围';
    else if (pH! >= 7.20) pHStatus = '轻度酸血症';
    else if (pH! >= 7.10) pHStatus = '中度酸血症';
    else if (pH! >= 7.00) pHStatus = '重度酸血症';
    else { pHStatus = '极重度酸血症（最高危值）'; isHighestRisk = true; }

    if (pH! < 7.24) pHEval = '偏低'; else if (pH! > 7.27) pHEval = '偏高';
    
    const [beMin, beMax] = BERange.split('~').map(Number);
    if (BE! < beMin) BEEval = '偏低'; else if (BE! > beMax) BEEval = '偏高';
    if (BE! < -12.00) isHighestRisk = true;

    if (PaO2! >= 37.50) PaO2Eval = '偏高';
    if (Lactate! >= 6.00) { LactateEval = '偏高'; isHighestRisk = true; }
  }

  // Step 3: Primary Disorder
  let pHDir: any = '正常', PaCO2Dir: any = '正常';
  if (pH! < 7.40) pHDir = '偏低'; else if (pH! > 7.40) pHDir = '偏高';
  if (PaCO2! < 40) PaCO2Dir = '偏低'; else if (PaCO2! > 40) PaCO2Dir = '偏高';

  let direction: any = '无明显变化';
  let primaryDisorder: any = '无原发酸碱紊乱';

  if (pHDir !== '正常' && PaCO2Dir !== '正常') {
    if (pHDir !== PaCO2Dir) {
      direction = '相反';
      primaryDisorder = pHDir === '偏低' ? '呼吸性酸中毒' : '呼吸性碱中毒';
    } else {
      direction = '相同';
      primaryDisorder = pHDir === '偏低' ? '代谢性酸中毒' : '代谢性碱中毒';
    }
  } else if (pHDir !== '正常') {
    primaryDisorder = pHDir === '偏低' ? '代谢性酸中毒' : '代谢性碱中毒';
  } else if (PaCO2Dir !== '正常') {
    primaryDisorder = PaCO2Dir === '偏低' ? '呼吸性碱中毒' : '呼吸性酸中毒';
  }

  // Step 4: Compensation
  let compensationType: any = '急性'; // Default to acute for simplicity, can be refined
  let formula = '';
  let expectedRange = '';
  let actualValue = null;
  let isCompensated = false;
  let compConclusion = '';

  if (primaryDisorder === '呼吸性酸中毒') {
    const expHCO3 = 24 + 0.1 * (PaCO2! - 40);
    formula = '预期HCO₃⁻ = 24 + 0.1 × (PaCO₂ - 40) ± 3';
    expectedRange = `${(expHCO3 - 3).toFixed(1)} ~ ${(expHCO3 + 3).toFixed(1)}`;
    actualValue = HCO3;
    isCompensated = actualValue! >= expHCO3 - 3 && actualValue! <= expHCO3 + 3;
    compConclusion = isCompensated ? '代偿适当，单纯性呼吸性酸中毒' : (actualValue! > expHCO3 + 3 ? '合并代谢性碱中毒' : '合并代谢性酸中毒');
  } else if (primaryDisorder === '呼吸性碱中毒') {
    const expHCO3 = 24 - 0.2 * (40 - PaCO2!);
    formula = '预期HCO₃⁻ = 24 - 0.2 × (40 - PaCO₂) ± 3';
    expectedRange = `${(expHCO3 - 3).toFixed(1)} ~ ${(expHCO3 + 3).toFixed(1)}`;
    actualValue = HCO3;
    isCompensated = actualValue! >= expHCO3 - 3 && actualValue! <= expHCO3 + 3;
    compConclusion = isCompensated ? '代偿适当，单纯性呼吸性碱中毒' : (actualValue! > expHCO3 + 3 ? '合并代谢性碱中毒' : '合并代谢性酸中毒');
  } else if (primaryDisorder === '代谢性酸中毒') {
    const expPaCO2 = 1.5 * HCO3! + 8;
    formula = '预期PaCO₂ = 1.5 × [HCO₃⁻] + 8 ± 2';
    expectedRange = `${(expPaCO2 - 2).toFixed(1)} ~ ${(expPaCO2 + 2).toFixed(1)}`;
    actualValue = PaCO2;
    isCompensated = actualValue! >= expPaCO2 - 2 && actualValue! <= expPaCO2 + 2;
    compConclusion = isCompensated ? '代偿适当，单纯性代谢性酸中毒' : (actualValue! > expPaCO2 + 2 ? '合并呼吸性酸中毒' : '合并呼吸性碱中毒');
  } else if (primaryDisorder === '代谢性碱中毒') {
    const expPaCO2 = 0.7 * HCO3! + 21;
    formula = '预期PaCO₂ = 0.7 × [HCO₃⁻] + 21 ± 2';
    expectedRange = `${(expPaCO2 - 2).toFixed(1)} ~ ${(expPaCO2 + 2).toFixed(1)}`;
    actualValue = PaCO2;
    isCompensated = actualValue! >= expPaCO2 - 2 && actualValue! <= expPaCO2 + 2;
    compConclusion = isCompensated ? '代偿适当，单纯性代谢性碱中毒' : (actualValue! > expPaCO2 + 2 ? '合并呼吸性酸中毒' : '合并呼吸性碱中毒');
  } else {
    compensationType = '不适用';
  }

  // Step 5: Anion Gap
  let AG = null;
  let correctedAG = null;
  let agClass: any = '无法计算';
  let causes = '';

  if (Na !== null && Cl !== null && HCO3 !== null) {
    AG = Na - (Cl + HCO3);
    if (Albumin !== null) {
      correctedAG = AG + 2.5 * (4.0 - Albumin);
    }
    const finalAG = correctedAG !== null ? correctedAG : AG;
    if (finalAG > 14) {
      agClass = '高AG';
      causes = 'MUDPILES（甲醇中毒、尿毒症、DKA、丙二醇、异烟肼/先天性代谢病、乳酸酸中毒、乙二醇、水杨酸中毒），儿童特别关注：先天性代谢病、DKA、乳酸酸中毒、脓毒症、肾功能衰竭';
    } else if (finalAG >= 8) {
      agClass = '正常AG';
      causes = '腹泻、RTA（肾小管酸中毒）、生理盐水大量输注等';
    } else {
      agClass = '低AG';
      causes = '低白蛋白血症、多发性骨髓瘤等';
    }
  }

  // Step 6: Delta AG
  let deltaAG = null;
  let expectedHCO3 = null;
  let deltaConclusion = '不适用';

  if (agClass === '高AG' && AG !== null && HCO3 !== null) {
    deltaAG = AG - 12;
    expectedHCO3 = deltaAG + HCO3;
    if (expectedHCO3 < 22) {
      deltaConclusion = '合并正常AG代谢性酸中毒';
    } else if (expectedHCO3 > 26) {
      deltaConclusion = '合并代谢性碱中毒';
    } else {
      deltaConclusion = '单纯高AG代谢性酸中毒';
    }
  }

  // Quick Check
  let qpHDir: any = '正常', qPaCO2Dir: any = '正常', qDir: any = '无明显变化', qPrimary: any = '无明显原发';
  if (pH! < 7.40) qpHDir = '偏酸'; else if (pH! > 7.40) qpHDir = '偏碱';
  if (PaCO2! < 40) qPaCO2Dir = '偏低'; else if (PaCO2! > 40) qPaCO2Dir = '偏高';
  
  if (qpHDir !== '正常' && qPaCO2Dir !== '正常') {
    if ((qpHDir === '偏酸' && qPaCO2Dir === '偏高') || (qpHDir === '偏碱' && qPaCO2Dir === '偏低')) {
      qDir = '反向'; qPrimary = '呼吸性原发';
    } else {
      qDir = '同向'; qPrimary = '代谢性原发';
    }
  }
  const qIsConsistent = (qPrimary === '呼吸性原发' && primaryDisorder.includes('呼吸')) || 
                        (qPrimary === '代谢性原发' && primaryDisorder.includes('代谢')) ||
                        (qPrimary === '无明显原发');

  // UABGA Specifics
  let uabgaResult: any = undefined;
  if (scenario === 'A' && infoA) {
    let asphyxia: any = '无窒息';
    if ((infoA.apgar1 <= 3 || infoA.apgar5 <= 5) && pH! < 7.00) {
      asphyxia = '重度窒息';
    } else if ((infoA.apgar1 <= 7 || infoA.apgar5 <= 7) && pH! < 7.20) {
      asphyxia = '轻度窒息';
    }

    let riskLevel: any = '🟢低风险';
    if (pH! < 7.00 || BE! < -12.00 || Lactate! >= 6.00) {
      riskLevel = '🔴高风险';
    } else if (pH! <= 7.20 || (BE! >= -16 && BE! <= -12) || Lactate! > 2.0) { // Assuming >2.0 is elevated lactate
      riskLevel = '🟡中风险需警惕';
    }

    uabgaResult = { asphyxia, riskLevel };
  }

  // Final Diagnosis
  let finalDiagnosis = primaryDisorder;
  if (!isCompensated && compConclusion.includes('合并')) {
    finalDiagnosis += ` + ${compConclusion.replace('合并', '')}`;
  }
  if (agClass === '高AG') {
    finalDiagnosis = finalDiagnosis.replace('代谢性酸中毒', '高AG代谢性酸中毒');
    if (deltaConclusion.includes('合并')) {
      finalDiagnosis += ` + ${deltaConclusion.replace('合并', '')}`;
    }
  }

  // Clinical Suggestions
  let clinicalSuggestions = '';
  if (scenario === 'B') {
    clinicalSuggestions = `**针对原发紊乱的处理：**\n`;
    if (finalDiagnosis.includes('呼吸性酸中毒')) clinicalSuggestions += `- 呼吸性酸中毒：改善通气（调整呼吸机参数/评估气道通畅性等）\n`;
    if (finalDiagnosis.includes('代谢性酸中毒')) clinicalSuggestions += `- 代谢性酸中毒：针对病因治疗（纠正脱水、控制感染、DKA处理等）。评估是否需要碳酸氢钠纠酸。\n`;
    if (finalDiagnosis.includes('呼吸性碱中毒')) clinicalSuggestions += `- 呼吸性碱中毒：寻找并解除过度通气原因（疼痛、发热、中枢神经系统疾病等）。\n`;
    if (finalDiagnosis.includes('代谢性碱中毒')) clinicalSuggestions += `- 代谢性碱中毒：纠正低钾、低氯血症，补充血容量。\n`;
    clinicalSuggestions += `\n**监测建议：**\n- 建议1-4小时后复查血气（根据病情严重程度）。\n- 需同时监测电解质、乳酸、血糖、肾功能等。\n- 密切关注临床表现变化。`;
  } else if (scenario === 'A' && uabgaResult) {
    if (uabgaResult.riskLevel === '🟢低风险') {
      clinicalSuggestions = `- 常规新生儿观察\n- 记录UABGA结果于新生儿病历\n- 与新生儿监护人沟通检查结果`;
    } else if (uabgaResult.riskLevel === '🟡中风险需警惕') {
      clinicalSuggestions = `- 加强监护，密切观察神经系统表现\n- 1-2小时内复查动脉血气（外周动脉）\n- 监测血糖、电解质、乳酸\n- 完善头颅超声等检查\n- 评估是否需要转入NICU`;
    } else {
      clinicalSuggestions = `- 立即转入NICU\n- 预见性启动神经重症监护\n- 评估亚低温治疗指征（生后6小时内启动）\n- 动态监测血气、乳酸、血糖、电解质、肝肾功能、凝血功能\n- 头颅影像学检查（超声/MRI）\n- 评估多器官功能\n- 与家属充分沟通病情及预后`;
    }
  }

  return {
    step1: { calculatedH, expectedH: exactExpectedH, isConsistent },
    step2: { pHStatus, pHRange, pHEval, PaCO2Range, PaCO2Eval, HCO3Range, HCO3Eval, BERange, BEEval, LactateRange, LactateEval, PaO2Range, PaO2Eval, isHighestRisk },
    step3: { pHDir, PaCO2Dir, direction, primaryDisorder },
    step4: { primaryDisorder, compensationType, formula, expectedRange, actualValue, isCompensated, conclusion: compConclusion },
    step5: { AG, correctedAG, classification: agClass, causes },
    step6: { deltaAG, expectedHCO3, conclusion: deltaConclusion },
    quickCheck: { pHDir: qpHDir, PaCO2Dir: qPaCO2Dir, direction: qDir, primaryDisorder: qPrimary, isConsistent: qIsConsistent },
    uabga: uabgaResult,
    finalDiagnosis,
    clinicalSuggestions
  };
}

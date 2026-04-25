import { BGAAnalysisResult, BGAData, BasicInfoA, BasicInfoB, DehydrationSeverity, Scenario } from '../types';

type Tone = 'ok' | 'warn' | 'danger' | 'neutral';

export interface CalculationRow {
  label: string;
  value: string;
  tone?: Tone;
}

export interface TreatmentSection {
  title: string;
  tone: Tone;
  summary: string;
  orders: string[];
  formulas: string[];
  calculations: CalculationRow[];
  notes: string[];
}

export interface DeficitOption {
  label: string;
  percent: number;
  deficitMl: number;
  first24Rate: number;
  second24Rate?: number;
  plan: string;
}

export interface DailyFluidOrder {
  day: string;
  title: string;
  totalMl: number;
  durationHours: number;
  rateMlPerHour: number;
  glucose5Ml: number;
  glucose5WithSb5Ml: number;
  sodiumChloride10Ml: number;
  sodiumBicarbonate14Ml: number;
  sodiumBicarbonate5Ml: number;
  potassiumChloride10Ml: number;
  recipeName: string;
  tonicity: string;
  potassiumTargetMmolPerL: number;
  note: string;
}

export interface SelectedDehydration {
  severity: DehydrationSeverity;
  label: string;
  percent: number;
}

export interface TreatmentPlan {
  weightKg: number | null;
  acidosis: TreatmentSection;
  fluids: TreatmentSection & {
    deficitOptions: DeficitOption[];
    dailyOrders: DailyFluidOrder[];
    selectedDehydration: SelectedDehydration;
  };
  sodium: TreatmentSection;
  potassium: TreatmentSection;
  references: Array<{ label: string; url: string }>;
}

const SB5_MEq_PER_ML = 50 / 84;
const SB14_MEq_PER_ML = 14 / 84;
const SB5_TO_SB14_RATIO = 5 / 1.4;
const KCL10_MEq_PER_ML = 100 / 74.55;
const MAINTENANCE_POTASSIUM_MEq_PER_L = 20;
const KCL10_ML_PER_100ML_MAINTENANCE = 1.5;

const dehydrationConfig: Record<DehydrationSeverity, SelectedDehydration> = {
  none: { severity: 'none', label: '无明显脱水', percent: 0 },
  mild: { severity: 'mild', label: '轻度脱水', percent: 3 },
  moderate: { severity: 'moderate', label: '中度脱水', percent: 5 },
  severe: { severity: 'severe', label: '重度脱水', percent: 10 },
};

type RecipeKey = 'isotonic21' | 'twoThirds432' | 'half231' | 'third12' | 'fifth14' | 'maintenance';

interface HospitalFluidRecipe {
  key: RecipeKey;
  name: string;
  tonicity: string;
  sodiumChloride10Rate: number;
  sodiumBicarbonate14Rate: number;
  sodiumBicarbonate5Rate: number;
  note: string;
}

const hospitalFluidRecipes: Record<RecipeKey, HospitalFluidRecipe> = {
  isotonic21: {
    key: 'isotonic21',
    name: '2:1等张含钠液',
    tonicity: '等张',
    sodiumChloride10Rate: 0.06,
    sodiumBicarbonate14Rate: 1 / 3,
    sodiumBicarbonate5Rate: 0.093,
    note: '用于休克/循环障碍扩容；相当于2份0.9%NaCl + 1份1.4%SB。',
  },
  twoThirds432: {
    key: 'twoThirds432',
    name: '4:3:2液',
    tonicity: '2/3张',
    sodiumChloride10Rate: 0.04,
    sodiumBicarbonate14Rate: 2 / 9,
    sodiumBicarbonate5Rate: 0.062,
    note: '常用于低渗性脱水的累积损失量补充。',
  },
  half231: {
    key: 'half231',
    name: '2:3:1液',
    tonicity: '1/2张',
    sodiumChloride10Rate: 0.03,
    sodiumBicarbonate14Rate: 1 / 6,
    sodiumBicarbonate5Rate: 0.047,
    note: '常用于等渗性脱水累积损失量、首日维持+继续损失。',
  },
  third12: {
    key: 'third12',
    name: '1:2液',
    tonicity: '1/3张',
    sodiumChloride10Rate: 0.03,
    sodiumBicarbonate14Rate: 0,
    sodiumBicarbonate5Rate: 0,
    note: '传统用于高渗性脱水；Na+ >=150 mmol/L时需按高钠路径慢纠正并上级复核。',
  },
  fifth14: {
    key: 'fifth14',
    name: '1:4液',
    tonicity: '1/5张',
    sodiumChloride10Rate: 0.018,
    sodiumBicarbonate14Rate: 0,
    sodiumBicarbonate5Rate: 0,
    note: '传统用于生理需要量；重症、低钠或ADH风险高时需谨慎。',
  },
  maintenance: {
    key: 'maintenance',
    name: '生理维持液',
    tonicity: '约1/5张',
    sodiumChloride10Rate: 0.02,
    sodiumBicarbonate14Rate: 0,
    sodiumBicarbonate5Rate: 0,
    note: '按院内表格：每100mL 5%GS约加10%NaCl 2mL；见尿后可加10%KCl 1.5mL。',
  },
};

function round(value: number, digits = 1) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function format(value: number | null | undefined, unit = '', digits = 1) {
  if (value === null || value === undefined || Number.isNaN(value)) return '-';
  return `${round(value, digits)}${unit}`;
}

function getWeightKg(scenario: Scenario, infoA: BasicInfoA | null, infoB: BasicInfoB | null) {
  if (scenario === 'B' && infoB?.weight) return infoB.weight;
  if (scenario === 'A' && infoA?.birthWeight) return infoA.birthWeight / 1000;
  return null;
}

function maintenanceRate(weightKg: number) {
  const first10 = Math.min(weightKg, 10);
  const second10 = Math.min(Math.max(weightKg - 10, 0), 10);
  const above20 = Math.max(weightKg - 20, 0);
  return Math.min(100, 4 * first10 + 2 * second10 + above20);
}

function buildAcidosisPlan(weightKg: number | null, data: BGAData, result: BGAAnalysisResult, scenario: Scenario): TreatmentSection {
  const pH = data.pH;
  const hco3 = data.HCO3;
  const be = data.BE;
  const hasMetabolicAcidosis = result.finalDiagnosis.includes('代谢性酸中毒') || result.step3.primaryDisorder === '代谢性酸中毒';
  const severeAcidosis = (pH !== null && pH < 7.1) || (hco3 !== null && hco3 < 10) || (be !== null && be <= -10);
  const baseDeficit = be !== null && be < 0
    ? Math.abs(be)
    : hco3 !== null
      ? Math.max(0, 15 - hco3)
      : 0;

  if (!weightKg) {
    return {
      title: '纠酸：缺少体重，无法计算剂量',
      tone: 'warn',
      summary: '请先补充体重，再生成碳酸氢钠剂量。',
      orders: ['优先处理原发病、低氧、休克和通气不足；复查血气、电解质、乳酸。'],
      formulas: ['NaHCO3(mEq) = 0.3 x 体重(kg) x 碱缺失(mmol/L)'],
      calculations: [],
      notes: ['不建议仅凭一次血气自动纠酸，需结合循环、通气、病因和动态复查。'],
    };
  }

  const fullDose = 0.3 * weightKg * baseDeficit;
  const initialDose = Math.min(fullDose / 2, 2 * weightKg);
  const sb5Volume = initialDose / SB5_MEq_PER_ML;
  const sb14Volume = initialDose / SB14_MEq_PER_ML;
  const dilutedTotal = sb5Volume * SB5_TO_SB14_RATIO;
  const diluentVolume = Math.max(0, dilutedTotal - sb5Volume);
  const shouldConsiderSB = hasMetabolicAcidosis && severeAcidosis && baseDeficit > 0;

  const calculations: CalculationRow[] = [
    { label: '体重', value: format(weightKg, ' kg') },
    { label: '估算碱缺失', value: format(baseDeficit, ' mmol/L'), tone: baseDeficit >= 10 ? 'danger' : baseDeficit > 5 ? 'warn' : 'neutral' },
    { label: '理论总量', value: format(fullDose, ' mEq') },
    { label: '建议首剂', value: format(initialDose, ' mEq'), tone: shouldConsiderSB ? 'warn' : 'neutral' },
    { label: '5%SB首剂体积', value: format(sb5Volume, ' mL') },
    { label: '稀释至约1.4%需加溶媒', value: format(diluentVolume, ' mL') },
    { label: '1.4%SB首剂体积', value: format(sb14Volume, ' mL') },
    { label: '钠负荷', value: format(initialDose, ' mEq Na+') },
  ];

  const orders = shouldConsiderSB
    ? [
      `先给半量：5%碳酸氢钠 ${format(sb5Volume, ' mL')} + 5%葡萄糖 ${format(diluentVolume, ' mL')}，配成约1.4%碳酸氢钠，静脉泵入30-60分钟。`,
      `等效方案：1.4%碳酸氢钠 ${format(sb14Volume, ' mL')} 静脉泵入30-60分钟。`,
      '给药前确认有效通气和循环灌注；给药后30-60分钟复查血气、Na+/K+/Ca2+、乳酸，按复查结果决定是否补余量。',
    ]
    : [
      '当前不建议常规使用碳酸氢钠；优先处理病因、低氧/通气不足、休克、脱水和乳酸来源。',
      '若出现pH < 7.10、HCO3- < 10 mmol/L、BE <= -10且循环受影响，再按下方公式保守半量纠酸并复查。',
    ];

  const title = shouldConsiderSB ? '纠酸：可考虑保守半量碳酸氢钠' : '纠酸：优先病因治疗，暂不常规补碱';

  return {
    title,
    tone: shouldConsiderSB ? 'warn' : 'neutral',
    summary: shouldConsiderSB
      ? '存在重度代谢性酸中毒触发条件。建议只先给计算量的1/2，并以复查血气调整。'
      : '未达到内置重度纠酸阈值，碳酸氢钠可能增加钠负荷、CO2生成和电解质波动。',
    orders,
    formulas: [
      '理论NaHCO3(mEq) = 0.3 x 体重(kg) x 碱缺失(mmol/L)',
      '首剂 = min(理论总量 x 1/2, 2 mEq/kg)',
      '5%SB浓度约0.595 mEq/mL；1.4%SB浓度约0.167 mEq/mL',
      '5%SB稀释为1.4%：总量 = 5%SB体积 x 5 / 1.4；溶媒量 = 总量 - 5%SB体积',
    ],
    calculations,
    notes: [
      scenario === 'A' ? '脐血结果不宜直接作为持续纠酸医嘱依据，建议复查外周动/静脉血气后执行。' : '如为DKA、乳酸酸中毒、肾衰或中毒，应按相应专病路径处理。',
      '避免与含钙液体同管混合；补碱可降低K+、游离Ca2+并增加CO2，需监测心电和电解质。',
    ],
  };
}

function getPotassiumAdditive(data: BGAData) {
  if (data.K === null || data.K > 5.5) return 0;
  return MAINTENANCE_POTASSIUM_MEq_PER_L;
}

function getDehydrationRecipeBySodium(na: number | null): HospitalFluidRecipe {
  if (na === null) return hospitalFluidRecipes.half231;
  if (na < 130) return hospitalFluidRecipes.twoThirds432;
  if (na > 150) return hospitalFluidRecipes.third12;
  return hospitalFluidRecipes.half231;
}

function getDehydrationNature(na: number | null) {
  if (na === null) return 'Na+未提供，暂按等渗性脱水估算';
  if (na < 130) return '低渗性脱水倾向';
  if (na > 150) return '高渗性/高钠脱水倾向';
  return '等渗性脱水倾向';
}

function buildDailyFluidOrder(
  day: string,
  title: string,
  totalMl: number,
  durationHours: number,
  recipe: HospitalFluidRecipe,
  potassiumTargetMmolPerL: number,
  addPotassium: boolean,
  note: string,
): DailyFluidOrder {
  const sodiumChloride10Ml = totalMl * recipe.sodiumChloride10Rate;
  const sodiumBicarbonate14Ml = totalMl * recipe.sodiumBicarbonate14Rate;
  const sodiumBicarbonate5Ml = totalMl * recipe.sodiumBicarbonate5Rate;
  const potassiumChloride10Ml = addPotassium ? totalMl * potassiumTargetMmolPerL / 1000 / KCL10_MEq_PER_ML : 0;
  const glucose5Ml = Math.max(0, totalMl - sodiumChloride10Ml - sodiumBicarbonate14Ml - potassiumChloride10Ml);
  const glucose5WithSb5Ml = Math.max(0, totalMl - sodiumChloride10Ml - sodiumBicarbonate5Ml - potassiumChloride10Ml);

  return {
    day,
    title,
    totalMl,
    durationHours,
    rateMlPerHour: totalMl / durationHours,
    glucose5Ml,
    glucose5WithSb5Ml,
    sodiumChloride10Ml,
    sodiumBicarbonate14Ml,
    sodiumBicarbonate5Ml,
    potassiumChloride10Ml,
    recipeName: recipe.name,
    tonicity: recipe.tonicity,
    potassiumTargetMmolPerL,
    note: `${note} ${recipe.note}`,
  };
}

function buildFluidPlan(
  weightKg: number | null,
  data: BGAData,
  scenario: Scenario,
  infoB: BasicInfoB | null,
): TreatmentPlan['fluids'] {
  const selectedDehydration = scenario === 'B'
    ? dehydrationConfig[infoB?.dehydrationSeverity ?? 'none']
    : dehydrationConfig.none;

  if (!weightKg) {
    return {
      title: '补液：缺少体重，无法计算',
      tone: 'warn',
      summary: '补液总量需要体重和脱水程度。',
      orders: ['补充体重后再计算维持量、缺失量和继续丢失量。'],
      formulas: ['总液量 = 维持量 + 缺失量 + 继续丢失量'],
      calculations: [],
      deficitOptions: [],
      dailyOrders: [],
      selectedDehydration,
      notes: [],
    };
  }

  const hourly = maintenanceRate(weightKg);
  const daily = hourly * 24;
  const twoThirds = hourly * 2 / 3;
  const bolus10 = 10 * weightKg;
  const bolus20 = 20 * weightKg;
  const potassiumTarget = getPotassiumAdditive(data);
  const addPotassium = potassiumTarget > 0;
  const dehydrationNature = getDehydrationNature(data.Na);
  const cumulativeRecipe = getDehydrationRecipeBySodium(data.Na);
  const firstDayPerKg = selectedDehydration.severity === 'severe'
    ? 180
    : selectedDehydration.severity === 'moderate'
      ? 135
      : selectedDehydration.severity === 'mild'
        ? 100
        : 0;
  const firstDayTotalMl = firstDayPerKg * weightKg;
  const expansionMl = selectedDehydration.severity === 'severe' ? 20 * weightKg : 0;
  const cumulativeTargetMl = firstDayTotalMl / 2;
  const cumulativeMl = Math.max(0, cumulativeTargetMl - expansionMl);
  const cumulativeHours = selectedDehydration.severity === 'none' ? 0 : 10;
  const remainingFirstDayMl = Math.max(0, firstDayTotalMl - expansionMl - cumulativeMl);
  const remainingFirstDayHours = selectedDehydration.severity === 'none' ? 24 : 16;
  const day2BaseMl = selectedDehydration.severity === 'none' ? twoThirds * 24 : 70 * weightKg;
  const day3BaseMl = selectedDehydration.severity === 'none' ? twoThirds * 24 : 70 * weightKg;

  const deficitOptions: DeficitOption[] = [
    { label: '轻度脱水', percent: 5, deficitMl: 50 * weightKg, first24Rate: 100 * weightKg / 24, plan: '首日总量约90-120 mL/kg，轻症优先ORS；需IV时按100 mL/kg估算' },
    { label: '中度脱水', percent: 7.5, deficitMl: 75 * weightKg, first24Rate: 135 * weightKg / 24, plan: '首日总量约120-150 mL/kg，累积损失量约占首日总量1/2' },
    { label: '重度脱水', percent: 10, deficitMl: 100 * weightKg, first24Rate: 180 * weightKg / 24, plan: '首日总量约150-180 mL/kg；有休克先2:1液20 mL/kg扩容' },
  ].map((option) => {
    return {
      ...option,
      second24Rate: 70 * weightKg / 24,
    };
  });

  const dailyOrders: DailyFluidOrder[] = selectedDehydration.severity === 'none'
    ? [
      buildDailyFluidOrder(
        '第1天',
        '无明显脱水：维持/限制液',
        day2BaseMl,
        24,
        hospitalFluidRecipes.maintenance,
        potassiumTarget,
        addPotassium,
        '无脱水但需静脉液时先按2/3维持量；若已能经口/肠内，优先停IV。'
      ),
    ]
    : [
      ...(expansionMl > 0 ? [
        buildDailyFluidOrder(
          '第1天-扩容',
          '2:1等张液 20 mL/kg，30-60分钟',
          expansionMl,
          1,
          hospitalFluidRecipes.isotonic21,
          potassiumTarget,
          false,
          '仅用于休克/循环障碍；扩容后立即复评CRT、脉搏、血压、尿量。'
        ),
      ] : []),
      buildDailyFluidOrder(
        '第1天-累积损失',
        `${dehydrationNature}：${cumulativeRecipe.name}`,
        cumulativeMl,
        cumulativeHours,
        cumulativeRecipe,
        potassiumTarget,
        addPotassium,
        '无休克时从此阶段开始；若已扩容，累积损失量已扣除扩容量。'
      ),
      buildDailyFluidOrder(
        '第1天-维持+继续损失',
        '2:3:1液，补足首日余量',
        remainingFirstDayMl,
        remainingFirstDayHours,
        hospitalFluidRecipes.half231,
        potassiumTarget,
        addPotassium,
        '继续损失按腹泻、呕吐、胃肠减压等实际丢失另行mL:mL补回。'
      ),
      buildDailyFluidOrder(
        '第2天',
        '生理需要量 + 继续损失',
        day2BaseMl,
        24,
        hospitalFluidRecipes.maintenance,
        potassiumTarget,
        addPotassium,
        '脱水纠正后优先ORS/经口；仍需IV时按60-80 mL/kg/day取中值70 mL/kg/day，继续损失另加。'
      ),
      buildDailyFluidOrder(
        '第3天',
        '复评后维持或转口服',
        day3BaseMl,
        24,
        hospitalFluidRecipes.maintenance,
        potassiumTarget,
        addPotassium,
        '按当日体重、尿量、出入量和电解质重算；无继续损失时逐步停IV。'
      ),
    ];

  const na = data.Na;
  const hasDysnatremia = na !== null && (na < 135 || na > 145);
  const potassiumNote = data.K === null
    ? '缺少K+结果：上述液体暂按不加钾更安全；补齐K+且确认有尿/肾功能后再加10%KCl。'
    : data.K > 5.5
      ? 'K+偏高：上述液体不加10%KCl，并按高钾路径复查/处理。'
      : '10%KCl按20 mmol/L维持补钾换算；执行前必须确认有尿、肾功能可、无高钾。';
  const orders = [
    `当前选择：${selectedDehydration.label}；${dehydrationNature}；首日总量 ${firstDayPerKg > 0 ? `${firstDayPerKg} mL/kg = ${format(firstDayTotalMl, ' mL', 0)}` : '按2/3维持量'}。`,
    `如休克/低灌注：2:1等张含钠液 ${round(bolus10, 0)}-${round(bolus20, 0)} mL 快速静滴/推注，复评循环；葡萄糖液不能单独用于休克扩容。`,
    '本院配液统一按最终液量计算：5%GS + 10%NaCl + 1.4%SB；若使用5%SB，界面同步给出等效替代体积。',
    potassiumNote,
  ];

  if (hasDysnatremia) {
    orders.push('Na+异常时不要机械套用普通脱水补液速度；Na+ <130或>150 mmol/L建议上级复核，并4-6小时复查电解质。');
  }

  return {
    title: '补液：本院混合液拟医嘱',
    tone: hasDysnatremia ? 'warn' : 'neutral',
    summary: `按“${selectedDehydration.label} + ${dehydrationNature}”生成可配液医嘱；先看上方处方，公式和推导放在下方复核。`,
    orders,
    formulas: [
      '首日总量：轻度90-120、中度120-150、重度150-180 mL/kg/day；本工具取100/135/180 mL/kg/day',
      '首日累积损失量约=首日总量/2；重度/休克先2:1等张液20 mL/kg扩容，并从累积损失量中扣除',
      '张力选择：低渗Na<130用4:3:2(2/3张)；等渗Na130-150用2:3:1(1/2张)；高渗Na>150需慢纠正/上级复核',
      '10%NaCl(mL)=最终液量 x 张力 x 6%；5%SB(mL)=最终液量 x 张力 x 9.3%',
      '1.4%SB替代量：2:1液=总量/3；4:3:2液=总量x2/9；2:3:1液=总量/6',
      '10%KCl维持加入量=最终液量 x 1.5 mL/100mL，浓度约0.15%，仅见尿且无高钾/肾衰时加入',
    ],
    calculations: [
      { label: '体重', value: format(weightKg, ' kg') },
      { label: '脱水选择', value: `${selectedDehydration.label}${selectedDehydration.percent > 0 ? `（${selectedDehydration.percent}%）` : ''}` },
      { label: '脱水性质', value: dehydrationNature, tone: data.Na !== null && (data.Na < 130 || data.Na > 150) ? 'warn' : 'neutral' },
      { label: '传统首日总量', value: firstDayPerKg > 0 ? `${format(firstDayTotalMl, ' mL/24h', 0)}（${firstDayPerKg} mL/kg）` : '-' },
      { label: '累积损失阶段', value: selectedDehydration.severity === 'none' ? '-' : `${format(cumulativeMl, ' mL', 0)} / ${cumulativeHours}h` },
      { label: '首日余量阶段', value: selectedDehydration.severity === 'none' ? '-' : `${format(remainingFirstDayMl, ' mL', 0)} / ${remainingFirstDayHours}h` },
      { label: '全维持量(4-2-1)', value: `${format(hourly, ' mL/h')} = ${format(daily, ' mL/24h')}` },
      { label: '2/3维持量', value: format(twoThirds, ' mL/h') },
      { label: '第2/3天基础量', value: `${format(day2BaseMl, ' mL/24h', 0)}（继续损失另加）` },
      { label: '10%KCl换算', value: potassiumTarget > 0 ? `${format(KCL10_ML_PER_100ML_MAINTENANCE, ' mL/100mL')}` : '暂不加钾', tone: potassiumTarget > 0 ? 'neutral' : 'warn' },
      { label: '休克单次扩容', value: `${format(bolus10, ' mL', 0)}-${format(bolus20, ' mL', 0)} 等张晶体液`, tone: 'warn' },
    ],
    deficitOptions,
    dailyOrders,
    selectedDehydration,
    notes: [
      scenario === 'A' ? '新生儿补液请按日龄、出生体重、尿量和NICU路径调整；此处仅作公式提示。' : '本模块按院内儿童腹泻/脱水补液资料生成，肾衰、心衰、烧伤、DKA、休克不稳定等需走专病方案。',
      '低张/传统张力液在重症、肺部/CNS疾病、低钠或ADH风险高时需谨慎；严密记录出入量、尿量、体重，4-6小时复查电解质。',
    ],
  };
}

function buildSodiumPlan(weightKg: number | null, data: BGAData): TreatmentSection {
  const na = data.Na;
  if (!weightKg || na === null) {
    return {
      title: '钠：缺少体重或Na+，无法计算',
      tone: 'warn',
      summary: '补液和纠酸前建议补充血钠。',
      orders: ['完善Na+、血糖、血渗/尿渗和尿钠；存在意识改变/抽搐时按低钠急症处理。'],
      formulas: ['低钠/高钠均需限制纠正速度，避免脑水肿或脱髓鞘。'],
      calculations: [],
      notes: [],
    };
  }

  if (na < 135) {
    const correction24h = Math.min(8, 135 - na);
    const sodiumNeed = 0.6 * weightKg * correction24h;
    const hypertonic3 = 3 * weightKg;
    const tone: Tone = na < 125 ? 'danger' : 'warn';

    return {
      title: `钠：低钠血症 Na ${format(na, ' mmol/L')}`,
      tone,
      summary: '低钠处理取决于症状和容量状态；非抽搐患儿24小时纠正不超过8 mmol/L。',
      orders: [
        '立即停用低张液/自由水，评估容量状态、神经系统症状、血糖和用药原因。',
        `若抽搐、昏迷或明显脑水肿表现：3%氯化钠 ${format(hypertonic3, ' mL')} IV 10-20分钟，症状控制后放慢纠正速度并请PICU/上级医师。`,
        `无重症症状时：按病因处理；如需IV液，优先0.9%NaCl + 5%GS，目标24小时Na+上升约6-8 mmol/L。`,
      ],
      formulas: [
        '24h最大补钠估算(mEq) = 0.6 x 体重(kg) x 允许Na+上升值(mmol/L)',
        '3%NaCl急救量 = 3 mL/kg，可使Na+约升高2-3 mmol/L（需复查确认）',
      ],
      calculations: [
        { label: 'Na+', value: format(na, ' mmol/L'), tone },
        { label: '24h允许上升值', value: format(correction24h, ' mmol/L') },
        { label: '24h最大补钠估算', value: format(sodiumNeed, ' mEq') },
        { label: '3%NaCl急救量', value: format(hypertonic3, ' mL'), tone: 'danger' },
      ],
      notes: ['低钠抽搐是急症，不应等待完整检查；但慢性低钠过快纠正有脱髓鞘风险。'],
    };
  }

  if (na > 145) {
    const freeWaterDeficit = 0.6 * weightKg * ((na / 145) - 1) * 1000;
    const tone: Tone = na >= 150 ? 'danger' : 'warn';

    return {
      title: `钠：高钠血症 Na ${format(na, ' mmol/L')}`,
      tone,
      summary: '高钠需慢纠正，先恢复循环，随后控制Na+下降速度。',
      orders: [
        '若休克，先用0.9%NaCl扩容，恢复循环后再处理水缺失。',
        '中重度高钠：0.9%NaCl + 5%GS，水缺失通常48小时或更久补足；避免Na+下降超过0.5 mmol/L/h或10-12 mmol/L/day。',
        'Na+ >=150 mmol/L、神经症状或病因不明：建议上级/PICU会诊，1-2小时后复查电解质，再4-6小时动态调整。',
      ],
      formulas: [
        '自由水缺失估算(mL) = 0.6 x 体重(kg) x (实测Na/145 - 1) x 1000',
        '总液量 = 维持量 + 水缺失(通常>=48h) + 继续丢失量',
      ],
      calculations: [
        { label: 'Na+', value: format(na, ' mmol/L'), tone },
        { label: '自由水缺失估算', value: format(freeWaterDeficit, ' mL') },
        { label: '最大下降速度', value: '<=0.5 mmol/L/h，<=10-12 mmol/L/day', tone: 'warn' },
      ],
      notes: ['高钠时临床脱水体征可能低估缺水程度；需用连续体重、尿量和复查Na+调整。'],
    };
  }

  return {
    title: `钠：Na ${format(na, ' mmol/L')}，目前在常规范围`,
    tone: 'ok',
    summary: '按等张含糖液和临床脱水程度补液，动态监测。',
    orders: ['继续监测Na+；如补碱、利尿、腹泻/呕吐或大量补液，建议4-6小时复查电解质。'],
    formulas: ['常规范围：135-145 mmol/L；补液优先等张液以降低医源性低钠风险。'],
    calculations: [{ label: 'Na+', value: format(na, ' mmol/L'), tone: 'ok' }],
    notes: [],
  };
}

function buildPotassiumPlan(weightKg: number | null, data: BGAData): TreatmentSection {
  const k = data.K;
  if (!weightKg || k === null) {
    return {
      title: '钾：缺少体重或K+，无法计算',
      tone: 'warn',
      summary: '酸碱紊乱会影响血钾判读，建议补充K+、肾功能和尿量。',
      orders: ['补钾前确认尿量、肾功能和心电图；低钾或高钾均需结合酸碱状态复判。'],
      formulas: ['补钾前提：有尿、无高钾/肾衰、无严重心电异常。'],
      calculations: [],
      notes: [],
    };
  }

  if (k < 3.5) {
    const oralSingleMl = weightKg;
    const oralDailyMinMl = 2 * weightKg;
    const oralDailyMaxMl = 3 * weightKg;
    const ivDoseByDeficitMl = Math.max(0, (3.5 - k) * weightKg * 0.3 / KCL10_MEq_PER_ML);
    const ivDoseMinMl = 0.225 * weightKg;
    const ivDoseMaxMl = Math.min(0.75 * weightKg, 40 / KCL10_MEq_PER_ML);
    const ivDoseMl = Math.min(Math.max(ivDoseByDeficitMl, ivDoseMinMl), ivDoseMaxMl);
    const minDilutionMl = Math.ceil(ivDoseMl / 3 * 100);
    const maxRateMlPerHour = 0.5 * weightKg / KCL10_MEq_PER_ML;
    const tone: Tone = k < 3 ? 'danger' : 'warn';
    const urgent = k < 3;

    return {
      title: `钾：低钾血症 K ${format(k, ' mmol/L')}`,
      tone,
      summary: urgent ? 'K+ <3.0 mmol/L按中重度低钾处理，静脉补钾需心电监护。' : '非紧急低钾优先口服/肠内补钾，并在维持液中见尿补钾。',
      orders: urgent
        ? [
          `静脉补钾拟医嘱：10%KCl ${format(ivDoseMl, ' mL')} + 5%GS 至少稀释至 ${format(minDilutionMl, ' mL', 0)}，泵入；速度不超过 ${format(maxRateMlPerHour, ' mL/h')} 10%KCl。`,
          '要求：确认有尿、无肾衰；持续心电监护；2小时复查K+，同时查Mg2+并纠正低镁。',
          `若能口服，后续10%KCl总量 ${format(oralDailyMinMl, ' mL')}-${format(oralDailyMaxMl, ' mL/day')} 分次口服/鼻饲。`,
        ]
        : [
          `口服/鼻饲补钾拟医嘱：10%KCl ${format(oralSingleMl, ' mL')} po/鼻饲一次；全天总量 ${format(oralDailyMinMl, ' mL')}-${format(oralDailyMaxMl, ' mL/day')} 分次。`,
          '见尿后维持液可加10%KCl 1.5 mL/100 mL液体；若腹泻持续或纠酸后K+下降，4-6小时复查。',
        ],
      formulas: [
        '10%KCl 1 mL = 1.34 mmol K+；非紧急口服常按约1 mL/kg/次，全天2-3 mL/kg/day',
        'IV补钾量(mL) = (期望K - 实测K) x 体重 x 0.3 / 1.34',
        'IV单次范围：0.3-1 mmol/kg = 0.225-0.75 mL/kg 10%KCl，单次不超过40 mmol',
        'IV速度 <=0.5 mmol/kg/h；外周浓度 <=0.3%（10%KCl <=3 mL/100 mL液体）',
      ],
      calculations: [
        { label: 'K+', value: format(k, ' mmol/L'), tone },
        { label: '10%KCl口服单次', value: format(oralSingleMl, ' mL') },
        { label: '10%KCl全天口服', value: `${format(oralDailyMinMl, ' mL')}-${format(oralDailyMaxMl, ' mL')}` },
        { label: 'IV计算剂量', value: format(ivDoseMl, ' mL'), tone: urgent ? 'danger' : 'warn' },
        { label: '最低稀释总量', value: format(minDilutionMl, ' mL', 0) },
        { label: '最大泵速', value: format(maxRateMlPerHour, ' mL/h'), tone: 'warn' },
      ],
      notes: ['低镁会导致低钾难纠正；补钾前必须确认尿量和肾功能，避免把10%KCl直接静推。'],
    };
  }

  if (k > 5.5) {
    const tone: Tone = k > 6.5 ? 'danger' : 'warn';
    const sb5Ml = 2 * weightKg;

    return {
      title: `钾：高钾血症 K ${format(k, ' mmol/L')}`,
      tone,
      summary: '高钾可致命性心律失常，需先排除溶血并立即看心电图。',
      orders: [
        '立即停用所有10%KCl和保钾药；补液处方中KCl=0；复查K+排除溶血，查肾功能、血糖、酸碱和心电图。',
        'K+ >=6.0或有心电改变：心电监护，上级/PICU会诊，按高钾急救流程给予钙剂、胰岛素+葡萄糖、β受体激动剂和排钾治疗。',
        `若合并酸中毒且需促钾内移：可按本院流程考虑5%NaHCO3 ${format(sb5Ml, ' mL')}（2 mL/kg）静滴，但不能替代高钾急救处理。`,
      ],
      formulas: [
        '高钾分层：5.5-6轻度，6-7中度，>7 mmol/L重度；心电改变按急症处理',
        '5%NaHCO3经验量：2 mL/kg，仅在酸中毒/高钾流程中作为促钾内移措施之一',
      ],
      calculations: [
        { label: 'K+', value: format(k, ' mmol/L'), tone },
        { label: '5%NaHCO3 2 mL/kg', value: format(sb5Ml, ' mL'), tone: 'warn' },
      ],
      notes: ['高钾处理必须结合心电图和床旁监护；钙剂、胰岛素等医嘱需按本院抢救流程复核。'],
    };
  }

  return {
    title: `钾：K ${format(k, ' mmol/L')}，目前在常规范围`,
    tone: 'ok',
    summary: '若有持续胃肠丢失、利尿、DKA治疗或纠酸，仍需动态复查。',
    orders: ['有尿且无肾衰/高钾时，维持或丢失替代液可考虑KCl 20 mmol/L。'],
    formulas: ['维持补钾常用：KCl 20 mmol/L加入等张维持液，需根据尿量和复查调整。'],
    calculations: [{ label: 'K+', value: format(k, ' mmol/L'), tone: 'ok' }],
    notes: [],
  };
}

export function buildTreatmentPlan(
  scenario: Scenario,
  infoA: BasicInfoA | null,
  infoB: BasicInfoB | null,
  data: BGAData | null,
  result: BGAAnalysisResult,
): TreatmentPlan {
  const safeData: BGAData = data ?? {
    pH: null,
    PaCO2: null,
    PaO2: null,
    HCO3: null,
    BE: null,
    Lactate: null,
    Na: null,
    K: null,
    Cl: null,
    Albumin: null,
    Glucose: null,
  };
  const weightKg = getWeightKg(scenario, infoA, infoB);

  return {
    weightKg,
    acidosis: buildAcidosisPlan(weightKg, safeData, result, scenario),
    fluids: buildFluidPlan(weightKg, safeData, scenario, infoB),
    sodium: buildSodiumPlan(weightKg, safeData),
    potassium: buildPotassiumPlan(weightKg, safeData),
    references: [
      {
        label: 'RCH Melbourne: Intravenous fluids',
        url: 'https://www.rch.org.au/clinicalguide/guideline_index/intravenous_fluids/',
      },
      {
        label: 'RCH Melbourne: Dehydration',
        url: 'https://www.rch.org.au/clinicalguide/guideline_index/dehydration/',
      },
      {
        label: 'RCH Melbourne: Hyponatraemia',
        url: 'https://www.rch.org.au/clinicalguide/guideline_index/hyponatraemia/',
      },
      {
        label: 'RCH Melbourne: Hypernatraemia',
        url: 'https://www.rch.org.au/clinicalguide/guideline_index/Hypernatraemia/',
      },
      {
        label: 'RCH Melbourne: Hypokalaemia',
        url: 'https://www.rch.org.au/clinicalguide/guideline_index/hypokalaemia/',
      },
      {
        label: 'PedMed: Sodium bicarbonate',
        url: 'https://pedmed.org/pedshowdrug.php?drugID=363',
      },
      {
        label: 'PCH: Hypertonic saline monograph',
        url: 'https://www.pch.health.wa.gov.au/~/media/Files/Hospitals/PCH/General-documents/Health-professionals/MedicationMonographs/HypertonicSaline.pdf',
      },
    ],
  };
}

import { BGAAnalysisResult, BGAData, BasicInfoA, BasicInfoB, Scenario } from '../types';

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

export interface TreatmentPlan {
  weightKg: number | null;
  acidosis: TreatmentSection;
  fluids: TreatmentSection & { deficitOptions: DeficitOption[] };
  sodium: TreatmentSection;
  potassium: TreatmentSection;
  references: Array<{ label: string; url: string }>;
}

const SB5_MEq_PER_ML = 50 / 84;
const SB14_MEq_PER_ML = 14 / 84;
const SB5_TO_SB14_RATIO = 5 / 1.4;

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

function buildFluidPlan(weightKg: number | null, data: BGAData, scenario: Scenario): TreatmentPlan['fluids'] {
  if (!weightKg) {
    return {
      title: '补液：缺少体重，无法计算',
      tone: 'warn',
      summary: '补液总量需要体重和脱水程度。',
      orders: ['补充体重后再计算维持量、缺失量和继续丢失量。'],
      formulas: ['总液量 = 维持量 + 缺失量 + 继续丢失量'],
      calculations: [],
      deficitOptions: [],
      notes: [],
    };
  }

  const hourly = maintenanceRate(weightKg);
  const daily = hourly * 24;
  const twoThirds = hourly * 2 / 3;
  const bolus10 = 10 * weightKg;
  const bolus20 = 20 * weightKg;
  const deficitOptions: DeficitOption[] = [3, 5, 10].map((percent) => {
    const deficitMl = weightKg * percent * 10;
    const firstDayDeficit = weightKg * Math.min(percent, 5) * 10;
    const first24Rate = (daily + firstDayDeficit) / 24;
    const remaining = Math.max(0, deficitMl - firstDayDeficit);
    const second24Rate = remaining > 0 ? (daily + remaining) / 24 : undefined;

    return {
      label: `${percent}%脱水`,
      percent,
      deficitMl,
      first24Rate,
      second24Rate,
      plan: percent <= 5 ? '缺失量24小时内补足' : '首24小时最多先补5%缺失，余量后24小时补',
    };
  });

  const na = data.Na;
  const hasDysnatremia = na !== null && (na < 135 || na > 145);
  const orders = [
    `如休克/低灌注：0.9%氯化钠 ${round(bolus10, 0)}-${round(bolus20, 0)} mL 快速静滴/推注，复评循环；休克复苏量不计入后续维持+缺失计算。`,
    `维持液参考：0.9%氯化钠 + 5%葡萄糖 ${format(hourly, ' mL/h')}；多数病重患儿无脱水时可先用2/3维持量 ${format(twoThirds, ' mL/h')}。`,
    '若需补缺失量：按下方3%、5%、10%脱水表选择；继续丢失量按上一小时或4小时实际丢失量 mL:mL 补回。',
    '有尿后且无高钾/肾衰，可考虑在维持或胃肠丢失替代液中加入KCl 20 mmol/L。',
  ];

  if (hasDysnatremia) {
    orders.push('Na+异常时不要机械套用普通脱水补液速度；应按低钠/高钠路径限制纠正速度并4-6小时复查电解质。');
  }

  return {
    title: '补液：维持量、缺失量和张力',
    tone: hasDysnatremia ? 'warn' : 'neutral',
    summary: '优先等张含糖液，按体重计算维持量；脱水缺失量按临床估计分档补充。',
    orders,
    formulas: [
      '总液量 = 维持量 + 脱水缺失量 + 继续丢失量',
      '4-2-1维持量(mL/h) = 4 x 前10kg + 2 x 第二个10kg + 1 x 其余kg，上限约100mL/h',
      '缺失量(mL) = 体重(kg) x 脱水百分比 x 10',
      '等张液张力：0.9%NaCl含Na+ 154 mmol/L，张力约1；常规维持优先0.9%NaCl + 5%GS +/- KCl',
    ],
    calculations: [
      { label: '体重', value: format(weightKg, ' kg') },
      { label: '全维持量', value: `${format(hourly, ' mL/h')} = ${format(daily, ' mL/24h')}` },
      { label: '2/3维持量', value: format(twoThirds, ' mL/h') },
      { label: '休克单次扩容', value: `${format(bolus10, '-')} ${format(bolus20, ' mL')} 等张晶体液`, tone: 'warn' },
    ],
    deficitOptions,
    notes: [
      scenario === 'A' ? '新生儿补液请按日龄、出生体重、尿量和NICU路径调整；此处仅作公式提示。' : '此计算适用于1月龄以上儿童的床旁估算，肾衰、心衰、肝衰、烧伤、DKA等需走专病方案。',
      '严密记录出入量、尿量、体重，电解质异常或大量丢失时4-6小时复查。低张液不作为常规首选。',
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
    const oralDose = Math.min(20, weightKg);
    const ivHourly = 0.2 * weightKg;
    const tone: Tone = k < 2.5 ? 'danger' : 'warn';

    return {
      title: `钾：低钾血症 K ${format(k, ' mmol/L')}`,
      tone,
      summary: '优先口服/肠内补钾；IV补钾为高风险用药，需尿量和监护。',
      orders: [
        `可口服/鼻饲KCl ${format(oralDose, ' mmol')}，必要时按1-2 mmol/kg/次（单次通常不超过20 mmol）调整。`,
        `不能肠内、K <2.5或有心电改变：考虑IV KCl，速度先按 ${format(ivHourly, ' mmol/h')}（0.2 mmol/kg/h）以内，心电监护，复查K+/Mg2+。`,
        '有尿后维持液可加KCl 20 mmol/L；纠酸或胰岛素治疗可能使K+进一步下降，应更密切复查。',
      ],
      formulas: [
        '口服急补：KCl 1-2 mmol/kg/次，单次通常不超过20 mmol',
        'IV补钾起始速度：<=0.2 mmol/kg/h；更高速率需PICU/中心静脉/严密监护',
      ],
      calculations: [
        { label: 'K+', value: format(k, ' mmol/L'), tone },
        { label: '口服KCl起始量', value: format(oralDose, ' mmol') },
        { label: 'IV补钾0.2 mmol/kg/h', value: format(ivHourly, ' mmol/h'), tone: 'warn' },
      ],
      notes: ['低镁会导致低钾难纠正；建议同步查Mg2+并纠正。'],
    };
  }

  if (k > 5.5) {
    const tone: Tone = k > 6.5 ? 'danger' : 'warn';

    return {
      title: `钾：高钾血症 K ${format(k, ' mmol/L')}`,
      tone,
      summary: '高钾可致命性心律失常，需先排除溶血并立即看心电图。',
      orders: [
        '立即停用含钾液体和保钾药；复查K+排除溶血，查肾功能、血糖、酸碱和心电图。',
        'K+ >=6.0或有心电改变：心电监护，上级/PICU会诊；按高钾急救路径给予膜稳定、促钾内移和排钾治疗。',
        '若合并重度酸中毒，纠酸可能有助于促钾内移，但不能替代高钾急救处理。',
      ],
      formulas: ['高钾分层：>5.5 mmol/L；>6.5 mmol/L或心电改变按急症处理。'],
      calculations: [{ label: 'K+', value: format(k, ' mmol/L'), tone }],
      notes: ['此工具不自动生成高钾急救全套处方，需按本院高钾流程执行。'],
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
    fluids: buildFluidPlan(weightKg, safeData, scenario),
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

import React from 'react';
import { motion } from 'motion/react';
import {
  AlertTriangle,
  Activity,
  Calculator,
  CheckCircle2,
  Clipboard,
  Droplets,
  FileText,
  Info,
  Pill,
  Printer,
  RefreshCw,
  ShieldAlert,
} from 'lucide-react';
import { BGAAnalysisResult, BGAData, BasicInfoA, BasicInfoB, Scenario } from '../types';
import { CalculationRow, DailyFluidOrder, TreatmentSection, buildTreatmentPlan } from '../utils/treatmentPlan';

interface Props {
  key?: React.Key;
  scenario: Scenario;
  infoA: BasicInfoA | null;
  infoB: BasicInfoB | null;
  bgaData: BGAData | null;
  result: BGAAnalysisResult;
  onReset: () => void;
}

const metricLabels: Array<{ key: keyof BGAData; label: string; unit?: string; important?: boolean }> = [
  { key: 'pH', label: 'pH', important: true },
  { key: 'PaCO2', label: 'PaCO2', unit: 'mmHg', important: true },
  { key: 'HCO3', label: 'HCO3-', unit: 'mmol/L', important: true },
  { key: 'BE', label: 'BE', unit: 'mmol/L', important: true },
  { key: 'Lactate', label: 'Lac', unit: 'mmol/L', important: true },
  { key: 'PaO2', label: 'PaO2', unit: 'mmHg' },
  { key: 'Na', label: 'Na+', unit: 'mmol/L' },
  { key: 'K', label: 'K+', unit: 'mmol/L' },
  { key: 'Cl', label: 'Cl-', unit: 'mmol/L' },
  { key: 'Glucose', label: 'Glu', unit: 'mmol/L' },
  { key: 'Albumin', label: 'Alb', unit: 'g/dL' },
];

function cleanSuggestionLine(line: string) {
  return line.replace(/\*\*/g, '').replace(/^- /, '').trim();
}

function StatusPill({ tone, children }: { tone: 'ok' | 'warn' | 'danger' | 'neutral'; children: React.ReactNode }) {
  const toneClass = {
    ok: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    warn: 'bg-amber-50 text-amber-700 border-amber-200',
    danger: 'bg-red-50 text-red-700 border-red-200',
    neutral: 'bg-slate-50 text-slate-700 border-slate-200',
  }[tone];

  return <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${toneClass}`}>{children}</span>;
}

function DetailSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border border-slate-200 rounded-lg overflow-hidden bg-white">
      <div className="bg-slate-50 px-4 py-3 border-b border-slate-200">
        <h3 className="font-semibold text-slate-900">{title}</h3>
      </div>
      <div className="p-4 text-sm text-slate-600">{children}</div>
    </section>
  );
}

function compactNumber(value: number, digits = 1) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function TreatmentCard({ section, icon }: { section: TreatmentSection; icon: React.ReactNode }) {
  const borderClass = {
    ok: 'border-emerald-200',
    warn: 'border-amber-200',
    danger: 'border-red-200',
    neutral: 'border-slate-200',
  }[section.tone];

  return (
    <article className={`rounded-lg border bg-white p-4 ${borderClass}`}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <span className="text-slate-500">{icon}</span>
          <h3 className="font-bold text-slate-950">{section.title}</h3>
        </div>
        <StatusPill tone={section.tone}>{section.tone === 'danger' ? '急症' : section.tone === 'warn' ? '需警惕' : section.tone === 'ok' ? '稳定' : '参考'}</StatusPill>
      </div>
      <p className="text-sm text-slate-600 mb-4">{section.summary}</p>

      {section.calculations.length > 0 && (
        <div className="grid sm:grid-cols-2 gap-2 mb-4">
          {section.calculations.map((item: CalculationRow) => (
            <div key={`${section.title}-${item.label}`} className="rounded-lg bg-slate-50 border border-slate-100 p-3">
              <span className="block text-xs text-slate-500">{item.label}</span>
              <span className={`font-bold ${item.tone === 'danger' ? 'text-red-700' : item.tone === 'warn' ? 'text-amber-700' : item.tone === 'ok' ? 'text-emerald-700' : 'text-slate-950'}`}>{item.value}</span>
            </div>
          ))}
        </div>
      )}

      <div className="mb-4">
        <p className="text-xs font-bold text-slate-500 mb-2">医嘱模板</p>
        <ul className="space-y-2 text-sm text-slate-700">
          {section.orders.map((order) => (
            <li key={order} className="flex gap-2">
              <CheckCircle2 className="w-4 h-4 mt-0.5 text-cyan-700 flex-none" />
              <span>{order}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="space-y-2 mb-4">
        <p className="text-xs font-bold text-slate-500">计算公式</p>
        {section.formulas.map((formula) => (
          <div key={formula} className="font-mono text-xs rounded-lg bg-slate-950 text-slate-100 px-3 py-2 overflow-x-auto">
            {formula}
          </div>
        ))}
      </div>

      {section.notes.length > 0 && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600 space-y-1">
          {section.notes.map((note) => <p key={note}>{note}</p>)}
        </div>
      )}
    </article>
  );
}

function DailyFluidOrders({ orders }: { orders: DailyFluidOrder[] }) {
  if (orders.length === 0) return null;

  return (
    <div className="mb-4">
      <p className="text-xs font-bold text-slate-500 mb-2">直接拟医嘱</p>
      <div className="divide-y divide-slate-200 rounded-lg border border-teal-100 bg-teal-50/50 overflow-hidden">
        {orders.map((order) => {
          const hasBicarbonate = order.sodiumBicarbonate14Ml > 0 || order.sodiumBicarbonate5Ml > 0;
          return (
            <div key={order.day} className="p-3">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between mb-3">
                <div>
                  <p className="text-sm font-bold text-teal-950">{order.day}：{order.title}</p>
                  <p className="text-xs text-slate-600 mt-1">{order.recipeName}（{order.tonicity}）</p>
                </div>
                <span className="text-xs font-semibold text-teal-800 bg-white border border-teal-100 rounded-full px-2.5 py-1 w-fit">
                  {compactNumber(order.totalMl, 0)} mL / {compactNumber(order.durationHours, 0)}h，{compactNumber(order.rateMlPerHour)} mL/h
                </span>
              </div>

              <div className="space-y-2 text-sm">
                <div className="rounded-md bg-white border border-teal-100 p-2">
                  <span className="block text-xs font-semibold text-slate-500 mb-1">
                    {hasBicarbonate ? '首选配法：用1.4%SB' : '配法'}
                  </span>
                  <span className="font-bold text-slate-950">
                    5%GS {compactNumber(order.glucose5Ml, 0)} mL + 10%NaCl {compactNumber(order.sodiumChloride10Ml, 1)} mL
                    {hasBicarbonate ? ` + 1.4%SB ${compactNumber(order.sodiumBicarbonate14Ml, 0)} mL` : ''}
                    {` + 10%KCl ${compactNumber(order.potassiumChloride10Ml, 1)} mL`}
                  </span>
                </div>

                {hasBicarbonate && (
                  <div className="rounded-md bg-white border border-teal-100 p-2">
                    <span className="block text-xs font-semibold text-slate-500 mb-1">替代配法：用5%SB</span>
                    <span className="font-bold text-slate-950">
                      5%GS {compactNumber(order.glucose5WithSb5Ml, 0)} mL + 10%NaCl {compactNumber(order.sodiumChloride10Ml, 1)} mL + 5%SB {compactNumber(order.sodiumBicarbonate5Ml, 1)} mL + 10%KCl {compactNumber(order.potassiumChloride10Ml, 1)} mL
                    </span>
                  </div>
                )}
              </div>

              <p className="text-xs text-slate-600 mt-2">{order.note}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function ReportView({ scenario, infoA, infoB, bgaData, result, onReset }: Props) {
  const isA = scenario === 'A';
  const accent = isA ? 'text-cyan-700' : 'text-teal-700';
  const treatmentPlan = buildTreatmentPlan(scenario, infoA, infoB, bgaData, result);
  const riskTone =
    result.step2.isHighestRisk || result.uabga?.riskLevel.includes('高风险') ? 'danger' :
    !result.step1.isConsistent || result.step5.classification === '高AG' || result.uabga?.riskLevel.includes('中风险') ? 'warn' :
    'ok';
  const suggestions = result.clinicalSuggestions.split('\n').map(cleanSuggestionLine).filter(Boolean);
  const missingElectrolytes = !bgaData?.Na || !bgaData?.Cl;
  const summaryText = [
    `PediBGA报告`,
    `场景：${isA ? '新生儿脐动脉血气' : '儿童/新生儿常规血气'}`,
    `诊断：${result.finalDiagnosis}`,
    result.uabga ? `UABGA：${result.uabga.asphyxia}，${result.uabga.riskLevel}` : '',
    `pH状态：${result.step2.pHStatus}`,
    result.step5.AG !== null ? `AG：${result.step5.AG.toFixed(1)} mEq/L（${result.step5.classification}）` : 'AG：未计算',
    `建议：${suggestions.slice(0, 4).join('；')}`,
  ].filter(Boolean).join('\n');

  const copySummary = async () => {
    await navigator.clipboard?.writeText(summaryText);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-6xl mx-auto"
    >
      <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden mb-4">
        <div className="px-5 py-4 border-b border-slate-200 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-950 flex items-center">
              <FileText className={`w-7 h-7 mr-3 ${accent}`} />
              血气分析报告
            </h1>
            <p className="text-slate-500 mt-1 text-sm">面向床旁复核、交班和病程记录的简洁版</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={copySummary}
              className="inline-flex items-center px-3 py-2 text-sm font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
            >
              <Clipboard className="w-4 h-4 mr-2" /> 复制摘要
            </button>
            <button
              onClick={() => window.print()}
              className="inline-flex items-center px-3 py-2 text-sm font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
            >
              <Printer className="w-4 h-4 mr-2" /> 打印
            </button>
            <button
              onClick={onReset}
              className="inline-flex items-center px-3 py-2 text-sm font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors"
            >
              <RefreshCw className="w-4 h-4 mr-2" /> 新评估
            </button>
          </div>
        </div>

        <div className="p-5 grid lg:grid-cols-[1.4fr_0.9fr] gap-4">
          <section className="rounded-lg bg-slate-950 text-white p-5">
            <div className="flex flex-wrap items-center gap-2 mb-4">
              <StatusPill tone={riskTone as 'ok' | 'warn' | 'danger'}>{riskTone === 'danger' ? '高危优先处理' : riskTone === 'warn' ? '需复核/警惕' : '相对稳定'}</StatusPill>
              <StatusPill tone={result.step1.isConsistent ? 'ok' : 'warn'}>
                数据一致性{result.step1.isConsistent ? '通过' : '需复查'}
              </StatusPill>
              {result.step5.classification !== '无法计算' && <StatusPill tone={result.step5.classification === '高AG' ? 'danger' : 'neutral'}>{result.step5.classification}</StatusPill>}
            </div>
            <p className="text-sm text-slate-400 mb-2">酸碱紊乱诊断</p>
            <p className="text-2xl font-bold leading-snug mb-5">{result.finalDiagnosis}</p>
            <p className="text-sm text-slate-400 mb-2">优先处理建议</p>
            <ul className="space-y-2 text-sm leading-relaxed">
              {suggestions.slice(0, 5).map((item) => (
                <li key={item} className="flex gap-2">
                  <CheckCircle2 className="w-4 h-4 mt-0.5 text-cyan-300 flex-none" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="rounded-lg border border-slate-200 bg-slate-50 p-5">
            <h2 className="text-base font-bold text-slate-950 mb-4 flex items-center">
              <Info className="w-5 h-5 mr-2 text-slate-500" /> 患者与标本
            </h2>
            <div className="grid grid-cols-2 gap-3 text-sm">
              {isA && infoA ? (
                <>
                  <div><span className="text-slate-500 block">场景</span><span className="font-semibold">UABGA</span></div>
                  <div><span className="text-slate-500 block">标本</span><span className="font-semibold">{infoA.sampleType}</span></div>
                  <div><span className="text-slate-500 block">胎龄</span><span className="font-semibold">{infoA.gestationalAgeWeeks}周{infoA.gestationalAgeDays}天</span></div>
                  <div><span className="text-slate-500 block">出生体重</span><span className="font-semibold">{infoA.birthWeight}g</span></div>
                  <div><span className="text-slate-500 block">采样时间</span><span className="font-semibold">{infoA.samplingTime} min</span></div>
                  <div><span className="text-slate-500 block">Apgar</span><span className="font-semibold">{infoA.apgar1}/{infoA.apgar5}/{infoA.apgar10}</span></div>
                  <div className="col-span-2"><span className="text-slate-500 block">高危因素</span><span className="font-semibold">{infoA.highRiskFactors || '无'}</span></div>
                </>
              ) : infoB ? (
                <>
                  <div><span className="text-slate-500 block">场景</span><span className="font-semibold">常规血气</span></div>
                  <div><span className="text-slate-500 block">标本</span><span className="font-semibold">{infoB.sampleType}</span></div>
                  <div><span className="text-slate-500 block">年龄</span><span className="font-semibold">{infoB.ageValue}{infoB.ageUnit === 'days' ? '天' : infoB.ageUnit === 'months' ? '月' : '岁'}</span></div>
                  <div><span className="text-slate-500 block">体重</span><span className="font-semibold">{infoB.weight}kg</span></div>
                  <div><span className="text-slate-500 block">脱水程度</span><span className="font-semibold">{treatmentPlan.fluids.selectedDehydration.label}</span></div>
                  <div className="col-span-2"><span className="text-slate-500 block">氧疗/通气</span><span className="font-semibold">{infoB.oxygenStatus || '未提供'}</span></div>
                  <div className="col-span-2"><span className="text-slate-500 block">临床诊断</span><span className="font-semibold">{infoB.clinicalDiagnosis || '未提供'}</span></div>
                </>
              ) : null}
            </div>
          </section>
        </div>
      </div>

      {isA && result.uabga && (
        <section className="mb-4 rounded-lg border-2 border-cyan-100 bg-cyan-50 p-5">
          <h2 className="font-bold text-cyan-950 mb-4 flex items-center">
            <Activity className="w-5 h-5 mr-2" /> UABGA专项评估
          </h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="bg-white rounded-lg border border-cyan-100 p-4">
              <span className="text-sm text-slate-500 block mb-1">窒息诊断</span>
              <span className="text-xl font-bold text-slate-950">{result.uabga.asphyxia}</span>
            </div>
            <div className="bg-white rounded-lg border border-cyan-100 p-4">
              <span className="text-sm text-slate-500 block mb-1">预后风险分层</span>
              <span className={`text-xl font-bold ${result.uabga.riskLevel.includes('高风险') ? 'text-red-700' : result.uabga.riskLevel.includes('中风险') ? 'text-amber-700' : 'text-emerald-700'}`}>
                {result.uabga.riskLevel}
              </span>
            </div>
          </div>
        </section>
      )}

      <div className="grid lg:grid-cols-[0.9fr_1.1fr] gap-4 mb-4">
        <section className="bg-white rounded-lg border border-slate-200 p-5">
          <h2 className="font-bold text-slate-950 mb-4">关键数值</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {metricLabels.map(({ key, label, unit, important }) => {
              const value = bgaData?.[key];
              return (
                <div key={key} className={`rounded-lg border p-3 ${important ? 'border-slate-300 bg-slate-50' : 'border-slate-200 bg-white'}`}>
                  <span className="block text-xs font-medium text-slate-500">{label}</span>
                  <span className="text-lg font-bold text-slate-950">{value ?? '-'}</span>
                  {unit && <span className="block text-xs text-slate-400">{unit}</span>}
                </div>
              );
            })}
          </div>
          {missingElectrolytes && (
            <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 flex gap-2">
              <AlertTriangle className="w-4 h-4 mt-0.5 flex-none" />
              缺少 Na+ 或 Cl-，无法完整判断阴离子间隙；代谢性酸中毒时建议补齐电解质。
            </div>
          )}
        </section>

        <section className="bg-white rounded-lg border border-slate-200 p-5">
          <h2 className="font-bold text-slate-950 mb-4">临床红旗</h2>
          <div className="space-y-3">
            {result.step2.isHighestRisk && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 flex gap-2">
                <ShieldAlert className="w-4 h-4 mt-0.5 flex-none" /> 触发最高危值，请优先复核标本并同步床旁处置。
              </div>
            )}
            {!result.step1.isConsistent && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 flex gap-2">
                <AlertTriangle className="w-4 h-4 mt-0.5 flex-none" /> pH、PaCO2、HCO3- 内在一致性不佳，建议核对报告或复查。
              </div>
            )}
            {result.step5.classification === '高AG' && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 flex gap-2">
                <AlertTriangle className="w-4 h-4 mt-0.5 flex-none" /> 高AG代谢性酸中毒：重点排查乳酸酸中毒、DKA、肾衰、毒物和遗传代谢病。
              </div>
            )}
            {!result.step2.isHighestRisk && result.step1.isConsistent && result.step5.classification !== '高AG' && (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800 flex gap-2">
                <CheckCircle2 className="w-4 h-4 mt-0.5 flex-none" /> 未触发内置最高危或高AG红旗，仍需结合病情动态复评。
              </div>
            )}
          </div>
        </section>
      </div>

      <section className="mb-4 bg-white rounded-lg border border-slate-200 p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between mb-5">
          <div>
            <h2 className="text-xl font-bold text-slate-950 flex items-center">
              <Calculator className="w-5 h-5 mr-2 text-cyan-700" /> 治疗医嘱计算辅助
            </h2>
            <p className="text-sm text-slate-500 mt-1">根据体重、血气和电解质生成纠酸、补液与补钠/补钾模板，执行前需医生复核。</p>
          </div>
          <StatusPill tone={treatmentPlan.weightKg ? 'neutral' : 'warn'}>
            计算体重：{treatmentPlan.weightKg ? `${compactNumber(treatmentPlan.weightKg)} kg` : '缺失'}
          </StatusPill>
        </div>

        <div className="grid xl:grid-cols-2 gap-4">
          <TreatmentCard section={treatmentPlan.acidosis} icon={<Pill className="w-5 h-5" />} />

          <article className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="flex items-center gap-2">
                <Droplets className="w-5 h-5 text-slate-500" />
                <h3 className="font-bold text-slate-950">{treatmentPlan.fluids.title}</h3>
              </div>
              <StatusPill tone={treatmentPlan.fluids.tone}>{treatmentPlan.fluids.tone === 'warn' ? '需警惕' : '参考'}</StatusPill>
            </div>
            <p className="text-sm text-slate-600 mb-4">{treatmentPlan.fluids.summary}</p>

            <DailyFluidOrders orders={treatmentPlan.fluids.dailyOrders} />

            <div className="grid sm:grid-cols-2 gap-2 mb-4">
              {treatmentPlan.fluids.calculations.map((item) => (
                <div key={`fluid-${item.label}`} className="rounded-lg bg-slate-50 border border-slate-100 p-3">
                  <span className="block text-xs text-slate-500">{item.label}</span>
                  <span className={`font-bold ${item.tone === 'warn' ? 'text-amber-700' : 'text-slate-950'}`}>{item.value}</span>
                </div>
              ))}
            </div>

            {treatmentPlan.fluids.deficitOptions.length > 0 && (
              <div className="overflow-x-auto mb-4">
                <table className="w-full text-sm text-left border border-slate-200 rounded-lg overflow-hidden">
                  <thead className="bg-slate-50 text-xs text-slate-500">
                    <tr>
                      <th className="px-3 py-2">脱水分档</th>
                      <th className="px-3 py-2">累积损失估算</th>
                      <th className="px-3 py-2">首日平均速率</th>
                      <th className="px-3 py-2">第2天基础速率</th>
                    </tr>
                  </thead>
                  <tbody>
                    {treatmentPlan.fluids.deficitOptions.map((option) => (
                      <tr key={option.label} className="border-t border-slate-100">
                        <td className="px-3 py-2 font-semibold text-slate-900">{option.label}</td>
                        <td className="px-3 py-2">{compactNumber(option.deficitMl, 0)} mL</td>
                        <td className="px-3 py-2">{compactNumber(option.first24Rate)} mL/h</td>
                        <td className="px-3 py-2">{option.second24Rate ? `${compactNumber(option.second24Rate)} mL/h` : '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="text-xs text-slate-500 mt-2">表内速率已包含维持量；休克扩容和继续丢失需另计。</p>
              </div>
            )}

            <div className="mb-4">
              <p className="text-xs font-bold text-slate-500 mb-2">医嘱模板</p>
              <ul className="space-y-2 text-sm text-slate-700">
                {treatmentPlan.fluids.orders.map((order) => (
                  <li key={order} className="flex gap-2">
                    <CheckCircle2 className="w-4 h-4 mt-0.5 text-cyan-700 flex-none" />
                    <span>{order}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="space-y-2 mb-4">
              <p className="text-xs font-bold text-slate-500">计算公式</p>
              {treatmentPlan.fluids.formulas.map((formula) => (
                <div key={formula} className="font-mono text-xs rounded-lg bg-slate-950 text-slate-100 px-3 py-2 overflow-x-auto">
                  {formula}
                </div>
              ))}
            </div>

            {treatmentPlan.fluids.notes.length > 0 && (
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600 space-y-1">
                {treatmentPlan.fluids.notes.map((note) => <p key={note}>{note}</p>)}
              </div>
            )}
          </article>

          <TreatmentCard section={treatmentPlan.sodium} icon={<Droplets className="w-5 h-5" />} />
          <TreatmentCard section={treatmentPlan.potassium} icon={<Activity className="w-5 h-5" />} />
        </div>

        <div className="mt-4 rounded-lg bg-slate-50 border border-slate-200 p-3 text-xs text-slate-600">
          <p className="font-semibold text-slate-800 mb-1">依据与边界</p>
          <div className="flex flex-wrap gap-x-3 gap-y-1 mb-2">
            {treatmentPlan.references.map((reference) => (
              <a
                key={reference.url}
                href={reference.url}
                target="_blank"
                rel="noreferrer"
                className="font-medium text-cyan-800 hover:text-cyan-950 underline underline-offset-2"
              >
                {reference.label}
              </a>
            ))}
          </div>
          <p>本模块是计算辅助，不替代本院医嘱系统、药品浓度核对和上级医师判断。</p>
        </div>
      </section>

      <div className="grid lg:grid-cols-2 gap-4">
        <DetailSection title="酸碱状态">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="text-xs text-slate-500 bg-slate-50">
                <tr>
                  <th className="px-3 py-2">参数</th>
                  <th className="px-3 py-2">参考范围</th>
                  <th className="px-3 py-2">判断</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ['pH', result.step2.pHRange, result.step2.pHEval],
                  ['PaCO2', result.step2.PaCO2Range || '-', result.step2.PaCO2Eval],
                  ['HCO3-', result.step2.HCO3Range || '-', result.step2.HCO3Eval],
                  ['BE', result.step2.BERange || '-', result.step2.BEEval],
                  ...(isA ? [
                    ['Lac', result.step2.LactateRange, result.step2.LactateEval],
                    ['PaO2', result.step2.PaO2Range, result.step2.PaO2Eval],
                  ] : []),
                ].map(([name, range, evalText]) => (
                  <tr key={name} className="border-t border-slate-100">
                    <td className="px-3 py-2 font-semibold text-slate-800">{name}</td>
                    <td className="px-3 py-2">{range}</td>
                    <td className={`px-3 py-2 font-semibold ${evalText === '正常' ? 'text-emerald-700' : 'text-amber-700'}`}>{evalText}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4 rounded-lg bg-slate-50 p-3">
            <span className="text-slate-500 mr-2">pH状态</span>
            <span className="font-bold text-slate-950">{result.step2.pHStatus}</span>
          </div>
        </DetailSection>

        <DetailSection title="代偿与AG分析">
          <div className="space-y-4">
            <div>
              <span className="block text-slate-500 mb-1">原发紊乱</span>
              <span className="font-bold text-slate-950">{result.step3.primaryDisorder}</span>
            </div>
            {result.step4.compensationType !== '不适用' && (
              <div className="rounded-lg bg-slate-50 p-3">
                <p className="font-mono text-xs text-slate-600 mb-2">{result.step4.formula}</p>
                <p>预期范围：<span className="font-semibold text-slate-900">{result.step4.expectedRange}</span></p>
                <p>实际值：<span className="font-semibold text-slate-900">{result.step4.actualValue ?? '-'}</span></p>
                <p className={result.step4.isCompensated ? 'text-emerald-700 font-semibold mt-2' : 'text-amber-700 font-semibold mt-2'}>
                  {result.step4.conclusion}
                </p>
              </div>
            )}
            <div className="rounded-lg bg-slate-50 p-3">
              {result.step5.AG !== null ? (
                <>
                  <p>AG：<span className="font-bold text-slate-950">{result.step5.AG.toFixed(1)} mEq/L</span></p>
                  {result.step5.correctedAG !== null && <p>校正AG：<span className="font-bold text-slate-950">{result.step5.correctedAG.toFixed(1)} mEq/L</span></p>}
                  <p>分类：<span className={result.step5.classification === '高AG' ? 'font-bold text-red-700' : 'font-bold text-slate-950'}>{result.step5.classification}</span></p>
                </>
              ) : (
                <p className="text-amber-700 font-semibold">缺少 Na+ / Cl-，无法计算 AG。</p>
              )}
            </div>
            {result.step6.deltaAG !== null && (
              <div className="rounded-lg bg-slate-50 p-3">
                <p>Delta AG：<span className="font-bold text-slate-950">{result.step6.deltaAG.toFixed(1)}</span></p>
                <p>预计 HCO3-：<span className="font-bold text-slate-950">{result.step6.expectedHCO3?.toFixed(1)}</span></p>
                <p className="font-semibold text-slate-900 mt-2">{result.step6.conclusion}</p>
              </div>
            )}
          </div>
        </DetailSection>
      </div>

      <div className="mt-4 bg-white border border-slate-200 rounded-lg p-4 text-xs text-slate-500 leading-relaxed">
        <strong className="text-slate-700">临床提示：</strong>
        本结果仅辅助血气解读，不能替代医生综合判断。请结合病史、体征、氧疗/通气设置、实验室检查和动态趋势决定诊疗。
      </div>
    </motion.div>
  );
}

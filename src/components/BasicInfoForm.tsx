import React, { useState } from 'react';
import { motion } from 'motion/react';
import { BasicInfoA, BasicInfoB, DehydrationSeverity, Scenario } from '../types';

interface Props {
  key?: React.Key;
  scenario: Scenario;
  onSubmit: (info: BasicInfoA | BasicInfoB) => void;
  onBack: () => void;
}

const dehydrationOptions: Array<{ value: DehydrationSeverity; label: string; hint: string }> = [
  { value: 'none', label: '无明显脱水', hint: '维持/限制液' },
  { value: 'mild', label: '轻度脱水', hint: '<5%' },
  { value: 'moderate', label: '中度脱水', hint: '约5%' },
  { value: 'severe', label: '重度脱水', hint: '约10%' },
];

export default function BasicInfoForm({ scenario, onSubmit, onBack }: Props) {
  const [infoA, setInfoA] = useState<BasicInfoA>({
    gestationalAgeWeeks: 39,
    gestationalAgeDays: 0,
    birthWeight: 3000,
    deliveryMode: '顺产',
    highRiskFactors: '无',
    apgar1: 9,
    apgar5: 10,
    apgar10: 10,
    sampleType: '脐动脉',
    samplingTime: 1,
    delayedCordClamping: false,
  });

  const [infoB, setInfoB] = useState<BasicInfoB>({
    ageValue: 1,
    ageUnit: 'years',
    weight: 10,
    dehydrationSeverity: 'none',
    sampleType: '动脉血',
    oxygenStatus: '空气 (FiO2 21%)',
    clinicalDiagnosis: '',
    hasAlbumin: false,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (scenario === 'A') {
      onSubmit(infoA);
    } else {
      onSubmit(infoB);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className="max-w-4xl mx-auto p-5 sm:p-6 bg-white rounded-lg shadow-sm border border-slate-200"
    >
      <div className="flex items-start justify-between gap-4 mb-8">
        <div>
          <h2 className="text-2xl font-bold text-slate-950">
            {scenario === 'A' ? '新生儿基本信息' : '患儿基本信息'}
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            {scenario === 'A' ? '保留影响 UABGA 判读和窒息评估的关键字段。' : '填写影响参考范围、氧合解读和病因判断的信息。'}
          </p>
        </div>
        <button onClick={onBack} className="text-slate-500 hover:text-slate-700 text-sm font-medium">
          返回重新选择
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {scenario === 'A' ? (
          <>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">胎龄 (周)</label>
                <input
                  type="number"
                  value={infoA.gestationalAgeWeeks}
                  onChange={e => setInfoA({ ...infoA, gestationalAgeWeeks: Number(e.target.value) })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">胎龄 (天)</label>
                <input
                  type="number"
                  value={infoA.gestationalAgeDays}
                  onChange={e => setInfoA({ ...infoA, gestationalAgeDays: Number(e.target.value) })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">出生体重 (g)</label>
              <input
                type="number"
                value={infoA.birthWeight}
                onChange={e => setInfoA({ ...infoA, birthWeight: Number(e.target.value) })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none"
                required
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Apgar 1min</label>
                <input
                  type="number"
                  value={infoA.apgar1}
                  onChange={e => setInfoA({ ...infoA, apgar1: Number(e.target.value) })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Apgar 5min</label>
                <input
                  type="number"
                  value={infoA.apgar5}
                  onChange={e => setInfoA({ ...infoA, apgar5: Number(e.target.value) })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Apgar 10min</label>
                <input
                  type="number"
                  value={infoA.apgar10}
                  onChange={e => setInfoA({ ...infoA, apgar10: Number(e.target.value) })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">标本类型</label>
                <select
                  value={infoA.sampleType}
                  onChange={e => setInfoA({ ...infoA, sampleType: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none"
                >
                  <option value="脐动脉">脐动脉</option>
                  <option value="脐静脉">脐静脉</option>
                  <option value="外周动脉">外周动脉</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">采样时间 (min)</label>
                <input
                  type="number"
                  step="any"
                  value={infoA.samplingTime}
                  onChange={e => setInfoA({ ...infoA, samplingTime: Number(e.target.value) })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">分娩方式</label>
              <select
                value={infoA.deliveryMode}
                onChange={e => setInfoA({ ...infoA, deliveryMode: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none"
              >
                <option value="顺产">顺产</option>
                <option value="剖宫产">剖宫产</option>
                <option value="产钳助产">产钳助产</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">高危因素</label>
              <input
                type="text"
                value={infoA.highRiskFactors}
                onChange={e => setInfoA({ ...infoA, highRiskFactors: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none"
                placeholder="如：胎心监护异常、脐带绕颈等"
              />
            </div>

            <label className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={infoA.delayedCordClamping}
                onChange={e => setInfoA({ ...infoA, delayedCordClamping: e.target.checked })}
                className="h-4 w-4 rounded border-slate-300 text-cyan-700 focus:ring-cyan-500"
              />
              延迟断脐或采样延迟
            </label>
          </>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">年龄</label>
                <input
                  type="number"
                  value={infoB.ageValue}
                  onChange={e => setInfoB({ ...infoB, ageValue: Number(e.target.value) })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">单位</label>
                <select
                  value={infoB.ageUnit}
                  onChange={e => setInfoB({ ...infoB, ageUnit: e.target.value as any })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none"
                >
                  <option value="days">天</option>
                  <option value="months">月</option>
                  <option value="years">岁</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">体重 (kg)</label>
              <input
                type="number"
                value={infoB.weight}
                onChange={e => setInfoB({ ...infoB, weight: Number(e.target.value) })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none"
                required
              />
            </div>

            <div>
              <div className="flex items-center justify-between gap-3 mb-2">
                <label className="block text-sm font-medium text-slate-700">诊断选择：脱水程度</label>
                <span className="text-xs font-medium text-slate-500">由临床体征选择</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {dehydrationOptions.map((option) => {
                  const active = infoB.dehydrationSeverity === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setInfoB({ ...infoB, dehydrationSeverity: option.value })}
                      className={`rounded-lg border px-3 py-3 text-left transition-colors ${
                        active
                          ? 'border-teal-600 bg-teal-50 text-teal-950 shadow-sm'
                          : 'border-slate-200 bg-white text-slate-700 hover:border-teal-200 hover:bg-teal-50/50'
                      }`}
                    >
                      <span className="block text-sm font-bold">{option.label}</span>
                      <span className={`mt-1 block text-xs ${active ? 'text-teal-700' : 'text-slate-500'}`}>{option.hint}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">标本类型</label>
              <select
                value={infoB.sampleType}
                onChange={e => setInfoB({ ...infoB, sampleType: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none"
              >
                <option value="动脉血">动脉血</option>
                <option value="静脉血">静脉血</option>
                <option value="毛细血管血">毛细血管血</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">吸氧情况</label>
              <input
                type="text"
                value={infoB.oxygenStatus}
                onChange={e => setInfoB({ ...infoB, oxygenStatus: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none"
                placeholder="如：FiO2 30% 或 机械通气 PCV"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">简要诊断</label>
              <input
                type="text"
                value={infoB.clinicalDiagnosis}
                onChange={e => setInfoB({ ...infoB, clinicalDiagnosis: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none"
                placeholder="如：重症肺炎、DKA等"
              />
            </div>

            <label className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={infoB.hasAlbumin}
                onChange={e => setInfoB({ ...infoB, hasAlbumin: e.target.checked })}
                className="h-4 w-4 rounded border-slate-300 text-teal-700 focus:ring-teal-500"
              />
              已有白蛋白结果，可用于校正阴离子间隙
            </label>
          </>
        )}

        <div className="pt-4">
          <button
            type="submit"
            className={`w-full py-3 px-4 rounded-lg text-white font-medium transition-colors ${
              scenario === 'A' ? 'bg-cyan-700 hover:bg-cyan-800' : 'bg-teal-700 hover:bg-teal-800'
            }`}
          >
            下一步：输入血气数据
          </button>
        </div>
      </form>
    </motion.div>
  );
}

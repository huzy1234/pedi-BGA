import React from 'react';
import { motion } from 'motion/react';
import { Activity, Baby, ArrowRight, Stethoscope } from 'lucide-react';
import { Scenario } from '../types';

interface Props {
  key?: React.Key;
  onSelect: (scenario: Scenario) => void;
}

export default function ScenarioSelection({ onSelect }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-5xl mx-auto"
    >
      <div className="mb-8">
        <div className="inline-flex items-center gap-2 text-sm font-semibold text-cyan-800 bg-cyan-50 border border-cyan-100 px-3 py-1.5 rounded-full mb-4">
          <Stethoscope className="w-4 h-4" />
          儿科 / 新生儿血气快速评估
        </div>
        <h1 className="text-3xl sm:text-4xl font-bold text-slate-950 mb-3">选择临床场景</h1>
        <p className="text-base text-slate-600 max-w-3xl">
          按采血场景进入不同参考范围与报告模板。报告会优先显示风险分层、诊断结论和下一步处理建议。
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <button
          onClick={() => onSelect('A')}
          className="group relative bg-white p-6 rounded-lg shadow-sm border border-slate-200 hover:border-cyan-600 hover:shadow-md transition-all text-left"
        >
          <div className="bg-cyan-50 w-12 h-12 rounded-lg flex items-center justify-center mb-5 group-hover:bg-cyan-100 transition-colors">
            <Baby className="w-7 h-7 text-cyan-700" />
          </div>
          <h2 className="text-xl font-semibold text-slate-950 mb-3">
            新生儿脐动脉血气
          </h2>
          <p className="text-slate-600 leading-relaxed mb-5">
            用于出生时 UABGA 评估，突出窒息风险、最高危值和 NICU/亚低温治疗窗口提示。
          </p>
          <span className="inline-flex items-center text-sm font-semibold text-cyan-800">
            进入评估 <ArrowRight className="w-4 h-4 ml-1" />
          </span>
        </button>

        <button
          onClick={() => onSelect('B')}
          className="group relative bg-white p-6 rounded-lg shadow-sm border border-slate-200 hover:border-teal-600 hover:shadow-md transition-all text-left"
        >
          <div className="bg-teal-50 w-12 h-12 rounded-lg flex items-center justify-center mb-5 group-hover:bg-teal-100 transition-colors">
            <Activity className="w-7 h-7 text-teal-700" />
          </div>
          <h2 className="text-xl font-semibold text-slate-950 mb-3">
            儿童 / 新生儿常规血气
          </h2>
          <p className="text-slate-600 leading-relaxed mb-5">
            用于 PICU、急诊、病房复查血气，整合六步法、AG/Delta-Delta 和处理建议。
          </p>
          <span className="inline-flex items-center text-sm font-semibold text-teal-800">
            进入评估 <ArrowRight className="w-4 h-4 ml-1" />
          </span>
        </button>
      </div>
    </motion.div>
  );
}

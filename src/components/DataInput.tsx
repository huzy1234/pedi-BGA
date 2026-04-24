import React, { useState, useRef } from 'react';
import { motion } from 'motion/react';
import { AlertTriangle, Camera, FileText, Keyboard, Loader2, Upload } from 'lucide-react';
import { BGAData, Scenario, BasicInfoA, BasicInfoB } from '../types';
import { extractBGADataFromImage, extractBGADataFromText } from '../services/geminiService';

const emptyBGAData: BGAData = {
  pH: null, PaCO2: null, PaO2: null, HCO3: null, BE: null,
  Lactate: null, Na: null, K: null, Cl: null, Albumin: null, Glucose: null
};

const MAX_IMAGE_EDGE = 1800;
const JPEG_QUALITY = 0.82;

interface PreparedImage {
  dataUrl: string;
  base64Data: string;
  mimeType: 'image/jpeg';
  originalSize: number;
  processedSize: number;
}

function normalizeBGAData(data: Partial<BGAData>): BGAData {
  return { ...emptyBGAData, ...data };
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('无法读取这张图片。手机拍照请使用 JPG/PNG，或先截屏后再上传。'));
    image.src = url;
  });
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('图片读取失败，请重新选择图片。'));
    reader.readAsDataURL(blob);
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
      } else {
        reject(new Error('图片压缩失败，请重新拍照或上传截图。'));
      }
    }, type, quality);
  });
}

async function prepareImageForRecognition(file: File): Promise<PreparedImage> {
  const objectUrl = URL.createObjectURL(file);

  try {
    const image = await loadImage(objectUrl);
    const maxEdge = Math.max(image.naturalWidth, image.naturalHeight);
    const scale = maxEdge > MAX_IMAGE_EDGE ? MAX_IMAGE_EDGE / maxEdge : 1;
    const width = Math.max(1, Math.round(image.naturalWidth * scale));
    const height = Math.max(1, Math.round(image.naturalHeight * scale));
    const canvas = document.createElement('canvas');

    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('当前浏览器不支持图片压缩，请换用手动输入或粘贴文本。');
    }

    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, width, height);
    context.drawImage(image, 0, 0, width, height);

    const blob = await canvasToBlob(canvas, 'image/jpeg', JPEG_QUALITY);
    const dataUrl = await blobToDataUrl(blob);

    return {
      dataUrl,
      base64Data: dataUrl.split(',')[1] || '',
      mimeType: 'image/jpeg',
      originalSize: file.size,
      processedSize: blob.size,
    };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

interface Props {
  key?: React.Key;
  scenario: Scenario;
  infoA: BasicInfoA | null;
  infoB: BasicInfoB | null;
  onSubmit: (data: BGAData) => void;
  onBack: () => void;
}

export default function DataInput({ scenario, infoA, infoB, onSubmit, onBack }: Props) {
  const [activeTab, setActiveTab] = useState<'image' | 'text' | 'manual'>('manual');
  const [bgaData, setBgaData] = useState<BGAData>(emptyBGAData);
  const [isLoading, setIsLoading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState('');
  const [rawText, setRawText] = useState('');
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isConfirming, setIsConfirming] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setIsLoading(true);
    setIsConfirming(false);
    setUploadStatus('正在压缩图片...');

    try {
      const preparedImage = await prepareImageForRecognition(file);
      setImagePreview(preparedImage.dataUrl);
      setUploadStatus('正在识别图片...');

      const extracted = await extractBGADataFromImage(preparedImage.base64Data, preparedImage.mimeType);
      setBgaData(normalizeBGAData(extracted));
      setIsConfirming(true);
    } catch (error) {
      console.error('Failed to extract data from image:', error);
      const message = error instanceof Error ? error.message : '识别失败，请重试或手动输入';
      alert(message.includes('无法读取') ? message : '识别失败。手机拍照请尽量裁到报告区域、保持清晰，或先截图后再上传。');
    } finally {
      setIsLoading(false);
      setUploadStatus('');
    }
  };

  const handleTextExtract = async () => {
    if (!rawText.trim()) return;
    setIsLoading(true);
    try {
      const extracted = await extractBGADataFromText(rawText);
      setBgaData(normalizeBGAData(extracted));
      setIsConfirming(true);
    } catch (error) {
      console.error('Failed to extract data from text:', error);
      alert('识别失败，请重试或手动输入');
    } finally {
      setIsLoading(false);
    }
  };

  const handleManualChange = (field: keyof BGAData, value: string) => {
    setBgaData(prev => ({
      ...prev,
      [field]: value === '' ? null : Number(value)
    }));
  };

  const handleSubmit = () => {
    // Basic validation
    if (bgaData.pH === null || bgaData.PaCO2 === null || bgaData.HCO3 === null) {
      alert('请至少输入 pH, PaCO2 和 HCO3-');
      return;
    }
    onSubmit(bgaData);
  };

  const checkOutOfBounds = (key: keyof BGAData, value: number | null) => {
    if (value === null) return false;
    
    if (scenario === 'A') {
      switch (key) {
        case 'pH': return value < 7.24 || value > 7.27;
        case 'BE': return value < -5.60 || value > -2.70;
        case 'PaO2': return value >= 37.50;
        case 'Lactate': return value >= 6.00;
        default: return false;
      }
    } else if (scenario === 'B' && infoB) {
      const { ageValue, ageUnit } = infoB;
      const isNeonate = ageUnit === 'days' && ageValue <= 28;
      const isInfant = ageUnit === 'months' && ageValue <= 12;
      
      switch (key) {
        case 'pH':
          return value < 7.35 || value > 7.45;
        case 'PaCO2':
          if (isNeonate || isInfant) return value < 30 || value > 40;
          return value < 35 || value > 45;
        case 'HCO3':
          if (isNeonate) return value < 19 || value > 22;
          if (isInfant) return value < 20 || value > 24;
          return value < 22 || value > 26;
        case 'BE':
          if (isNeonate) return value < -4 || value > 2;
          return value < -2 || value > 2;
        default: return false;
      }
    }
    return false;
  };

  const fieldGroups = [
    {
      title: '必填：判断酸碱紊乱',
      items: [
        { key: 'pH', label: 'pH', unit: '' },
        { key: 'PaCO2', label: 'PaCO₂', unit: 'mmHg' },
        { key: 'HCO3', label: 'HCO₃⁻', unit: 'mmol/L' },
      ],
    },
    {
      title: '强烈建议：风险与病因判断',
      items: [
        { key: 'BE', label: 'BE', unit: 'mmol/L' },
        { key: 'Lactate', label: '乳酸 Lac', unit: 'mmol/L' },
        { key: 'PaO2', label: 'PaO₂', unit: 'mmHg' },
        { key: 'Na', label: 'Na⁺', unit: 'mmol/L' },
        { key: 'Cl', label: 'Cl⁻', unit: 'mmol/L' },
      ],
    },
    {
      title: '可选：完善代谢评估',
      items: [
        { key: 'K', label: 'K⁺', unit: 'mmol/L' },
        { key: 'Glucose', label: '血糖 Glu', unit: 'mmol/L' },
        { key: 'Albumin', label: '白蛋白 Alb', unit: 'g/dL' },
      ],
    },
  ];

  const renderField = ({ key, label, unit }: { key: string; label: string; unit: string }) => {
    const isOut = checkOutOfBounds(key as keyof BGAData, bgaData[key as keyof BGAData]);
    const isRequired = key === 'pH' || key === 'PaCO2' || key === 'HCO3';
    return (
      <div key={key}>
        <label className="block text-sm font-medium text-slate-700 mb-1">
          {label} {unit && <span className="text-slate-400 text-xs">({unit})</span>}
          {isRequired && (
            <sup className="text-red-500 ml-0.5 cursor-help" title="必填项目">*</sup>
          )}
        </label>
        <input
          type="number"
          step="any"
          value={bgaData[key as keyof BGAData] ?? ''}
          onChange={e => handleManualChange(key as keyof BGAData, e.target.value)}
          className={`w-full px-3 py-2 border rounded-lg focus:ring-2 outline-none transition-colors ${
            isOut
              ? 'bg-amber-50 border-amber-400 focus:ring-amber-500 focus:border-amber-500 text-amber-950'
              : `border-slate-300 ${scenario === 'A' ? 'focus:ring-cyan-500 focus:border-cyan-500' : 'focus:ring-teal-500 focus:border-teal-500'}`
          }`}
        />
        {isOut && <p className="mt-1 text-xs font-medium text-amber-700">超出当前场景参考范围</p>}
      </div>
    );
  };

  const renderManualForm = () => (
    <div className="space-y-6 mt-6">
      {[
        ...fieldGroups,
      ].map((group) => (
        <section key={group.title}>
          <h3 className="text-sm font-bold text-slate-900 mb-3">{group.title}</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {group.items.map(renderField)}
          </div>
        </section>
      ))}
    </div>
  );

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className="max-w-5xl mx-auto p-5 sm:p-6 bg-white rounded-lg shadow-sm border border-slate-200"
    >
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-950">输入血气数据</h2>
          <p className="text-sm text-slate-500 mt-1">pH、PaCO₂、HCO₃⁻ 为最低分析集；Na⁺/Cl⁻ 用于 AG 判断。</p>
        </div>
        <button onClick={onBack} className="text-slate-500 hover:text-slate-700 text-sm font-medium">
          返回上一步
        </button>
      </div>

      <div className="flex space-x-2 mb-6 p-1 bg-slate-100 rounded-lg">
        <button
          onClick={() => { setActiveTab('manual'); setIsConfirming(false); }}
          className={`flex-1 flex items-center justify-center py-2.5 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'manual' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <Keyboard className="w-4 h-4 mr-2" /> 逐项输入
        </button>
        <button
          onClick={() => { setActiveTab('image'); setIsConfirming(false); }}
          className={`flex-1 flex items-center justify-center py-2.5 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'image' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <Camera className="w-4 h-4 mr-2" /> 拍照/上传
        </button>
        <button
          onClick={() => { setActiveTab('text'); setIsConfirming(false); }}
          className={`flex-1 flex items-center justify-center py-2.5 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'text' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <FileText className="w-4 h-4 mr-2" /> 粘贴文本
        </button>
      </div>

      {activeTab === 'manual' && renderManualForm()}

      {activeTab === 'image' && !isConfirming && (
        <div className="mt-6">
          <input
            type="file"
            accept="image/*,.heic,.heif"
            className="hidden"
            ref={fileInputRef}
            onChange={handleImageUpload}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isLoading}
            className="w-full h-48 border-2 border-dashed border-slate-300 rounded-lg flex flex-col items-center justify-center text-slate-500 hover:bg-slate-50 hover:border-slate-400 transition-colors"
          >
            {isLoading ? (
              <Loader2 className="w-8 h-8 animate-spin mb-2 text-cyan-600" />
            ) : (
              <Upload className="w-8 h-8 mb-2" />
            )}
            <span>{isLoading ? uploadStatus || '正在识别中...' : '点击上传血气报告图片'}</span>
            {!isLoading && <span className="mt-2 text-xs text-slate-400">手机拍照会自动压缩为可识别格式</span>}
          </button>
        </div>
      )}

      {activeTab === 'text' && !isConfirming && (
        <div className="mt-6">
          <textarea
            value={rawText}
            onChange={e => setRawText(e.target.value)}
            placeholder="请在此粘贴血气报告的全部文本内容..."
            className="w-full h-48 p-4 border border-slate-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none resize-none mb-4"
          />
          <button
            onClick={handleTextExtract}
            disabled={isLoading || !rawText.trim()}
            className="w-full py-3 bg-slate-900 text-white rounded-lg font-medium hover:bg-slate-800 disabled:opacity-50 flex items-center justify-center"
          >
            {isLoading ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : null}
            {isLoading ? '正在提取...' : '提取数据'}
          </button>
        </div>
      )}

      {isConfirming && (
        <div className="mt-6">
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
            <h3 className="text-amber-800 font-medium mb-2 flex items-center">
              <AlertTriangle className="w-4 h-4 mr-2" /> 识别结果需核对
            </h3>
            <p className="text-amber-700 text-sm mb-4">请重点核对小数点、单位和 PaCO₂ / PaO₂ 是否被混淆。</p>
            {imagePreview && activeTab === 'image' && (
              <img
                src={imagePreview}
                alt="上传的血气报告预览"
                className="mb-4 max-h-56 w-full rounded-lg border border-amber-200 object-contain bg-white"
              />
            )}
            {renderManualForm()}
          </div>
        </div>
      )}

      <div className="mt-8 pt-6 border-t border-slate-200">
        <button
          onClick={handleSubmit}
          className={`w-full py-3 px-4 rounded-lg text-white font-medium transition-colors ${
            scenario === 'A' ? 'bg-cyan-700 hover:bg-cyan-800' : 'bg-teal-700 hover:bg-teal-800'
          }`}
        >
          {isConfirming ? '确认无误，开始分析' : '开始分析'}
        </button>
      </div>
    </motion.div>
  );
}

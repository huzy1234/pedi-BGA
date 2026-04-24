import { GoogleGenAI, Type } from '@google/genai';
import { BGAData } from '../types';

export async function extractBGADataFromImage(base64Image: string, mimeType: string): Promise<BGAData> {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: {
      parts: [
        {
          inlineData: {
            data: base64Image,
            mimeType: mimeType,
          },
        },
        {
          text: '提取图片中的血气分析数值。如果没有找到某个数值，请返回 null。',
        },
      ],
    },
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          pH: { type: Type.NUMBER, description: 'pH值' },
          PaCO2: { type: Type.NUMBER, description: 'PaCO2或pCO2值 (mmHg)' },
          PaO2: { type: Type.NUMBER, description: 'PaO2或pO2值 (mmHg)' },
          HCO3: { type: Type.NUMBER, description: 'HCO3-或cHCO3-值 (mmol/L)' },
          BE: { type: Type.NUMBER, description: 'BE或BE(ecf)或BE(B)值 (mmol/L)' },
          Lactate: { type: Type.NUMBER, description: '乳酸或Lac值 (mmol/L)' },
          Na: { type: Type.NUMBER, description: 'Na+值 (mmol/L)' },
          K: { type: Type.NUMBER, description: 'K+值 (mmol/L)' },
          Cl: { type: Type.NUMBER, description: 'Cl-值 (mmol/L)' },
          Albumin: { type: Type.NUMBER, description: '白蛋白值 (g/dL)' },
          Glucose: { type: Type.NUMBER, description: '血糖或Glu值 (mmol/L)' },
        },
      },
    },
  });

  const jsonStr = response.text?.trim() || '{}';
  return JSON.parse(jsonStr) as BGAData;
}

export async function extractBGADataFromText(text: string): Promise<BGAData> {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: `提取以下文本中的血气分析数值。如果没有找到某个数值，请返回 null。\n\n${text}`,
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          pH: { type: Type.NUMBER, description: 'pH值' },
          PaCO2: { type: Type.NUMBER, description: 'PaCO2或pCO2值 (mmHg)' },
          PaO2: { type: Type.NUMBER, description: 'PaO2或pO2值 (mmHg)' },
          HCO3: { type: Type.NUMBER, description: 'HCO3-或cHCO3-值 (mmol/L)' },
          BE: { type: Type.NUMBER, description: 'BE或BE(ecf)或BE(B)值 (mmol/L)' },
          Lactate: { type: Type.NUMBER, description: '乳酸或Lac值 (mmol/L)' },
          Na: { type: Type.NUMBER, description: 'Na+值 (mmol/L)' },
          K: { type: Type.NUMBER, description: 'K+值 (mmol/L)' },
          Cl: { type: Type.NUMBER, description: 'Cl-值 (mmol/L)' },
          Albumin: { type: Type.NUMBER, description: '白蛋白值 (g/dL)' },
          Glucose: { type: Type.NUMBER, description: '血糖或Glu值 (mmol/L)' },
        },
      },
    },
  });

  const jsonStr = response.text?.trim() || '{}';
  return JSON.parse(jsonStr) as BGAData;
}

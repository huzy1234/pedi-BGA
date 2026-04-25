import { GoogleGenAI, Type } from '@google/genai';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json; charset=utf-8',
};

const responseSchema = {
  type: Type.OBJECT,
  properties: {
    pH: { type: Type.NUMBER, description: 'pH值' },
    PaCO2: { type: Type.NUMBER, description: 'PaCO2或pCO2值，单位mmHg；如原报告为kPa请换算为mmHg' },
    PaO2: { type: Type.NUMBER, description: 'PaO2或pO2值，单位mmHg；如原报告为kPa请换算为mmHg' },
    HCO3: { type: Type.NUMBER, description: 'HCO3-、cHCO3-或实际碳酸氢根，单位mmol/L' },
    BE: { type: Type.NUMBER, description: 'BE、BE(ecf)、BE(B)或剩余碱，单位mmol/L' },
    Lactate: { type: Type.NUMBER, description: '乳酸、Lac或Lactate，单位mmol/L' },
    Na: { type: Type.NUMBER, description: 'Na+，单位mmol/L' },
    K: { type: Type.NUMBER, description: 'K+，单位mmol/L' },
    Cl: { type: Type.NUMBER, description: 'Cl-，单位mmol/L' },
    Albumin: { type: Type.NUMBER, description: '白蛋白，单位g/dL；如原报告为g/L请换算为g/dL' },
    Glucose: { type: Type.NUMBER, description: '血糖、Glu或Glucose，单位mmol/L' },
  },
};

const emptyBGAData = {
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

function jsonResponse(statusCode, body) {
  return {
    statusCode,
    headers: corsHeaders,
    body: JSON.stringify(body),
  };
}

function parseModelJson(text) {
  const trimmed = (text || '').trim();
  const cleaned = trimmed
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '');

  return JSON.parse(cleaned || '{}');
}

function sanitizeNumber(key, value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return null;
  }

  if (value <= -999 || value === 9999) {
    return null;
  }

  if (key === 'pH' && (value < 6 || value > 8)) return null;
  if (key === 'Albumin' && (value <= 0 || value > 10)) return null;

  return value;
}

function normalizeBGAData(data) {
  const normalized = { ...emptyBGAData };

  for (const key of Object.keys(normalized)) {
    normalized[key] = sanitizeNumber(key, data?.[key]);
  }

  return normalized;
}

async function generateWithGemini(payload) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('Netlify缺少GEMINI_API_KEY环境变量');
  }

  const ai = new GoogleGenAI({ apiKey });

  if (payload.type === 'image') {
    if (!payload.base64Image) {
      throw new Error('缺少图片内容');
    }

    return ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: {
        parts: [
          {
            inlineData: {
              data: payload.base64Image,
              mimeType: payload.mimeType || 'image/jpeg',
            },
          },
          {
            text: '你是临床血气报告OCR助手。请从图片中提取血气和电解质数值，只返回JSON。注意区分PaCO2和PaO2，小数点不能丢失。没有找到的字段返回null。',
          },
        ],
      },
      config: {
        responseMimeType: 'application/json',
        responseSchema,
      },
    });
  }

  if (payload.type === 'text') {
    if (!payload.text?.trim()) {
      throw new Error('缺少文本内容');
    }

    return ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `你是临床血气报告OCR助手。请从以下文本中提取血气和电解质数值，只返回JSON。没有找到的字段返回null。\n\n${payload.text}`,
      config: {
        responseMimeType: 'application/json',
        responseSchema,
      },
    });
  }

  throw new Error('不支持的识别类型');
}

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return jsonResponse(204, {});
  }

  if (event.httpMethod !== 'POST') {
    return jsonResponse(405, { error: 'Method not allowed' });
  }

  try {
    const payload = JSON.parse(event.body || '{}');
    const response = await generateWithGemini(payload);
    const data = normalizeBGAData(parseModelJson(response.text));

    return jsonResponse(200, data);
  } catch (error) {
    console.error('BGA extraction failed:', error);
    const message = error instanceof Error ? error.message : '识别失败';

    return jsonResponse(500, { error: message });
  }
};

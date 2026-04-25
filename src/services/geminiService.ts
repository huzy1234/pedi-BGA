import { BGAData } from '../types';

const FUNCTION_ENDPOINT = '/.netlify/functions/extract-bga';
const REQUEST_TIMEOUT_MS = 30000;

const emptyBGAData: BGAData = {
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

function sanitizeNumber(key: keyof BGAData, value: unknown): number | null {
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

function normalizeBGAData(data: Partial<BGAData>): BGAData {
  const normalized = { ...emptyBGAData };

  (Object.keys(normalized) as Array<keyof BGAData>).forEach((key) => {
    normalized[key] = sanitizeNumber(key, data[key]);
  });

  return normalized;
}

async function callExtractor(payload: Record<string, unknown>): Promise<BGAData> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(FUNCTION_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    const body = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(body.error || '识别服务暂时不可用，请稍后重试');
    }

    return normalizeBGAData(body);
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('识别超时。请裁剪到报告区域后重试，或改用粘贴文本。');
    }

    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
}

export async function extractBGADataFromImage(base64Image: string, mimeType: string): Promise<BGAData> {
  return callExtractor({
    type: 'image',
    base64Image,
    mimeType,
  });
}

export async function extractBGADataFromText(text: string): Promise<BGAData> {
  return callExtractor({
    type: 'text',
    text,
  });
}

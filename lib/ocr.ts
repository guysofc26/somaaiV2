import { createWorker, PSM, type Worker } from "tesseract.js";

/**
 * ── SomaAI v2 — pipeline de OCR ──────────────────────────────────────────
 *
 * O que mudou em relação à v1:
 *  1. O recorte é reamostrado para uma resolução maior (upscale) antes do
 *     OCR — texto pequeno em etiquetas de preço se beneficia muito disso,
 *     já que o Tesseract lê melhor caracteres com altura de ~30-40px.
 *  2. Duas variantes de pré-processamento (contraste + binarização de Otsu).
 *     Tenta a mais barata primeiro; só cai para a segunda se a primeira falhar.
 *  3. `tessedit_pageseg_mode` ajustado para SINGLE_LINE (a etiqueta dentro da
 *     mira normalmente é uma única linha de preço) — reduz drasticamente
 *     falsos positivos comparado ao modo padrão (assume parágrafo).
 *  4. Retry automático com mira "expandida" (1.6×) e modo SPARSE_TEXT, para
 *     o caso do usuário não ter alinhado perfeitamente a etiqueta.
 *  5. `parsePrice` agora lida com separador de milhar (ex.: "1.234,56") e
 *     escolhe o melhor candidato entre múltiplos números encontrados,
 *     em vez de aceitar cegamente o primeiro.
 * ──────────────────────────────────────────────────────────────────────── */

const CHAR_WHITELIST = "0123456789,.";
const MIN_CONFIDENCE_PRIMARY = 65;
const MIN_CONFIDENCE_FALLBACK = 50;

export interface CropRect {
  cropX: number;
  cropY: number;
  cropW: number;
  cropH: number;
}

/**
 * Converte as coordenadas da mira (CSS px, tela) para coordenadas do vídeo
 * nativo, levando em conta `object-fit: cover`. `scale` permite expandir a
 * região (ex.: 1.6 para o retry).
 */
export function computeCropRect(
  video: HTMLVideoElement,
  container: { width: number; height: number },
  viewfinder: { width: number; height: number },
  scale = 1
): CropRect {
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  const rw = container.width;
  const rh = container.height;

  const coverScale = Math.max(rw / vw, rh / vh);
  const displayedW = vw * coverScale;
  const displayedH = vh * coverScale;
  const offsetX = (rw - displayedW) / 2;
  const offsetY = (rh - displayedH) / 2;

  const cx = rw / 2;
  const cy = rh / 2;
  const crossW = viewfinder.width * scale;
  const crossH = viewfinder.height * scale;

  const cropX = Math.max(0, Math.round((cx - crossW / 2 - offsetX) / coverScale));
  const cropY = Math.max(0, Math.round((cy - crossH / 2 - offsetY) / coverScale));
  const cropW = Math.min(vw - cropX, Math.round(crossW / coverScale));
  const cropH = Math.min(vh - cropY, Math.round(crossH / coverScale));

  return { cropX, cropY, cropW, cropH };
}

/** Desenha o recorte do vídeo já ampliado (upscale) num canvas offscreen. */
function drawUpscaledCrop(video: HTMLVideoElement, rect: CropRect): HTMLCanvasElement {
  const TARGET_MIN_WIDTH = 900; // px — alvo aproximado para caracteres legíveis
  const upscale = Math.min(4, Math.max(1, TARGET_MIN_WIDTH / rect.cropW));

  const canvas = document.createElement("canvas");
  canvas.width = Math.round(rect.cropW * upscale);
  canvas.height = Math.round(rect.cropH * upscale);

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Não foi possível criar contexto 2D do canvas");

  // Suaviza a interpolação do upscale (melhor que "nearest" para texto).
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(
    video,
    rect.cropX,
    rect.cropY,
    rect.cropW,
    rect.cropH,
    0,
    0,
    canvas.width,
    canvas.height
  );

  return canvas;
}

function toGrayscale(imageData: ImageData): Float32Array {
  const { data } = imageData;
  const gray = new Float32Array(data.length / 4);
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    gray[p] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
  }
  return gray;
}

function writeGrayscale(imageData: ImageData, gray: Float32Array): void {
  const { data } = imageData;
  for (let p = 0, i = 0; p < gray.length; p++, i += 4) {
    const v = gray[p];
    data[i] = v;
    data[i + 1] = v;
    data[i + 2] = v;
    data[i + 3] = 255;
  }
}

/** Variante A: escala de cinza + estiramento de contraste (equivalente à v1). */
function applyContrastStretch(imageData: ImageData): void {
  const gray = toGrayscale(imageData);
  let min = 255;
  let max = 0;
  for (const v of gray) {
    if (v < min) min = v;
    if (v > max) max = v;
  }
  const range = max - min;
  if (range > 20) {
    for (let p = 0; p < gray.length; p++) {
      gray[p] = ((gray[p] - min) / range) * 255;
    }
  }
  writeGrayscale(imageData, gray);
}

/**
 * Variante B: escala de cinza + binarização de Otsu (preto/branco puro).
 * Costuma performar melhor que o contraste simples em etiquetas com
 * iluminação irregular ou baixo contraste entre tinta e fundo.
 */
function applyOtsuThreshold(imageData: ImageData): void {
  const gray = toGrayscale(imageData);

  const histogram = new Array(256).fill(0);
  for (const v of gray) histogram[Math.round(v)]++;

  const total = gray.length;
  let sum = 0;
  for (let t = 0; t < 256; t++) sum += t * histogram[t];

  let sumB = 0;
  let wB = 0;
  let maxVariance = 0;
  let threshold = 127;

  for (let t = 0; t < 256; t++) {
    wB += histogram[t];
    if (wB === 0) continue;
    const wF = total - wB;
    if (wF === 0) break;

    sumB += t * histogram[t];
    const mB = sumB / wB;
    const mF = (sum - sumB) / wF;
    const variance = wB * wF * (mB - mF) * (mB - mF);

    if (variance > maxVariance) {
      maxVariance = variance;
      threshold = t;
    }
  }

  for (let p = 0; p < gray.length; p++) {
    gray[p] = gray[p] > threshold ? 255 : 0;
  }
  writeGrayscale(imageData, gray);
}

type PreprocessVariant = "contrast" | "otsu";

function preprocessCanvas(canvas: HTMLCanvasElement, variant: PreprocessVariant): string {
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Não foi possível criar contexto 2D do canvas");

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  if (variant === "contrast") {
    applyContrastStretch(imageData);
  } else {
    applyOtsuThreshold(imageData);
  }
  ctx.putImageData(imageData, 0, 0);

  return canvas.toDataURL("image/jpeg", 0.92);
}

/** Extrai todas as palavras (hierarquia blocks→paragraphs→lines→words) de um resultado do Tesseract. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractWords(data: any): { text: string; confidence: number }[] {
  const words: { text: string; confidence: number }[] = [];
  for (const block of data.blocks ?? []) {
    for (const paragraph of block.paragraphs ?? []) {
      for (const line of paragraph.lines ?? []) {
        for (const word of line.words ?? []) {
          words.push({ text: word.text, confidence: word.confidence });
        }
      }
    }
  }
  return words;
}

function isValidPrice(value: number): boolean {
  return Number.isFinite(value) && value > 0 && value < 10000;
}

/**
 * Faz o parse do texto reconhecido para um valor em reais.
 * Três estratégias em cascata; dentro de cada uma, testa todos os
 * candidatos encontrados (não só o primeiro) até achar um valor plausível.
 */
export function parsePrice(text: string): number | null {
  const cleaned = text.replace(/\s+/g, "");

  // 1) Formato brasileiro: vírgula decimal, ponto como separador de milhar opcional.
  for (const m of cleaned.matchAll(/(\d{1,3}(?:\.\d{3})+|\d+),(\d{2})/g)) {
    const value = parseFloat(`${m[1].replace(/\./g, "")}.${m[2]}`);
    if (isValidPrice(value)) return value;
  }

  // 2) Formato internacional: ponto decimal, vírgula como separador de milhar opcional.
  for (const m of cleaned.matchAll(/(\d{1,3}(?:,\d{3})+|\d+)\.(\d{2})/g)) {
    const value = parseFloat(`${m[1].replace(/,/g, "")}.${m[2]}`);
    if (isValidPrice(value)) return value;
  }

  // 3) Fallback: sequência de dígitos puros — assume que os últimos 2 são centavos.
  for (const m of cleaned.matchAll(/\d{3,5}/g)) {
    const digits = m[0];
    const value = parseFloat(`${digits.slice(0, -2)}.${digits.slice(-2)}`);
    if (isValidPrice(value)) return value;
  }

  return null;
}

export interface OcrAttemptResult {
  price: number | null;
  thumbnail: string;
  confidence: number;
}

/**
 * Roda uma tentativa completa de OCR (recorte → upscale → pré-processamento
 * → reconhecimento → parse) para uma dada variante/escala de mira.
 */
async function runAttempt(
  worker: Worker,
  video: HTMLVideoElement,
  container: { width: number; height: number },
  viewfinder: { width: number; height: number },
  variant: PreprocessVariant,
  pageSegMode: PSM,
  cropScale: number
): Promise<OcrAttemptResult> {
  const rect = computeCropRect(video, container, viewfinder, cropScale);
  const canvas = drawUpscaledCrop(video, rect);
  const dataUrl = preprocessCanvas(canvas, variant);

  await worker.setParameters({
    tessedit_char_whitelist: CHAR_WHITELIST,
    tessedit_pageseg_mode: pageSegMode,
  });

  const { data } = await worker.recognize(dataUrl, {}, { blocks: true });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const words = extractWords(data as any);
  const confidentWords = words.filter((w) => w.confidence > MIN_CONFIDENCE_PRIMARY);
  const text = confidentWords.length > 0 ? confidentWords.map((w) => w.text).join(" ") : data.text;

  const price = parsePrice(text);
  const avgConfidence =
    words.length > 0 ? words.reduce((sum, w) => sum + w.confidence, 0) / words.length : 0;

  return { price, thumbnail: dataUrl, confidence: avgConfidence };
}

/**
 * Pipeline completo com retries progressivos:
 *   1. Mira normal   + contraste       + linha única
 *   2. Mira normal    + Otsu            + linha única
 *   3. Mira expandida (1.6×) + Otsu     + texto esparso (aceita confiança menor)
 * Retorna o primeiro resultado com preço válido, ou o último resultado
 * tentado (para exibir a miniatura mesmo em caso de falha).
 */
export async function recognizePrice(
  worker: Worker,
  video: HTMLVideoElement,
  container: { width: number; height: number },
  viewfinder: { width: number; height: number }
): Promise<OcrAttemptResult> {
  const attempts: Array<[PreprocessVariant, PSM, number]> = [
    ["contrast", PSM.SINGLE_LINE, 1],
    ["otsu", PSM.SINGLE_LINE, 1],
    ["otsu", PSM.SPARSE_TEXT, 1.6],
  ];

  let last: OcrAttemptResult | null = null;

  for (const [variant, psm, cropScale] of attempts) {
    const result = await runAttempt(worker, video, container, viewfinder, variant, psm, cropScale);
    last = result;
    if (result.price !== null) return result;
    if (result.confidence < MIN_CONFIDENCE_FALLBACK && variant === "contrast") {
      // confiança muito baixa já na 1ª tentativa: pula direto pra Otsu (não perde tempo)
      continue;
    }
  }

  return last as OcrAttemptResult;
}

export async function createOcrWorker(): Promise<Worker> {
  const worker = await createWorker("por");
  await worker.setParameters({
    tessedit_char_whitelist: CHAR_WHITELIST,
    tessedit_pageseg_mode: PSM.SINGLE_LINE,
  });
  return worker;
}

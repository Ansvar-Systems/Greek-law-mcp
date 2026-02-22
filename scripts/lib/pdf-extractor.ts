import { execFileSync } from 'child_process';
import { createRequire } from 'module';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const ARTICLE_MARKER_REGEX =
  /(?:^|\n)\s*(?:Άρθρο|Αρθρο|ΑΡΘΡΟ|Άρδρο|Αρδρο|ΑΡΔΡΟ|Αρϑρο|Αρθρο)\s+[0-9Α-ΩA-Za-z]/gmu;

export interface TextQualityMetrics {
  charCount: number;
  greekRatio: number;
  articleHeadingCount: number;
  mojibakeRatio: number;
}

export interface PdfExtractionOptions {
  enableOcr: boolean;
  maxOcrPages?: number;
  allowLowQualityFallback?: boolean;
}

export interface PdfExtractionResult {
  text: string;
  method: 'pdftotext' | 'pdftotext_windows1253' | 'ocr_tesseract_cli' | 'ocr_tesseract_js';
  pageCount: number;
  metrics: TextQualityMetrics;
  warnings: string[];
}

function normalizeText(raw: string): string {
  const cleaned = raw
    .replace(/\r/g, '')
    .replace(/\f/g, '\n')
    .replace(/\u0000/g, '');

  const lines = cleaned.split('\n');
  const filtered = lines.filter(line => {
    const trimmed = line.trim();
    if (!trimmed) return true;

    if (/^\d{1,4}$/.test(trimmed)) return false;
    if (/^[\/*\-_=]{3,}$/.test(trimmed)) return false;
    if (/^Αρ\.\s*Φύλλου\s+\d+/iu.test(trimmed)) return false;
    if (/ΕΦΗΜΕΡΙ[ΣΣ]\s+ΤΗΣ\s+ΚΥΒΕΡΝΗΣΕΩΣ/iu.test(trimmed)) return false;
    if (/ΤΕΥΧΟΣ\s+[Α-ΩA-Za-z]/iu.test(trimmed) && /Μαΐου|Ιουν|Ιουλ|Αυγ|Σεπ|Οκτ|Νοε|Δεκ|Ιαν|Φεβ|Μαρ|Απρ/iu.test(trimmed)) {
      return false;
    }

    return true;
  });

  return filtered
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function decodeWindows1253(raw: string): string {
  const bytes = Uint8Array.from(Array.from(raw).map(char => char.charCodeAt(0) & 0xff));
  return new TextDecoder('windows-1253').decode(bytes);
}

function detectMojibake(raw: string): boolean {
  const greek = (raw.match(/[\u0370-\u03ff\u1f00-\u1fff]/gu) ?? []).length;
  const latinExtended = (raw.match(/[\u00c0-\u00ff]/g) ?? []).length;
  return latinExtended > 250 && greek < latinExtended / 4;
}

function assessTextQuality(text: string): TextQualityMetrics {
  const charCount = text.length;
  const greekLetters = (text.match(/[\u0370-\u03ff\u1f00-\u1fff]/gu) ?? []).length;
  const letters = (text.match(/\p{L}/gu) ?? []).length;
  const articleHeadingCount = (text.match(ARTICLE_MARKER_REGEX) ?? []).length;
  const mojibakeChars = (text.match(/[\u00c0-\u00ff]/g) ?? []).length;

  return {
    charCount,
    greekRatio: letters > 0 ? greekLetters / letters : 0,
    articleHeadingCount,
    mojibakeRatio: charCount > 0 ? mojibakeChars / charCount : 0,
  };
}

function isTextUsable(metrics: TextQualityMetrics): boolean {
  if (metrics.charCount < 1200) return false;
  if (metrics.articleHeadingCount >= 2 && metrics.greekRatio >= 0.3) return true;
  if (metrics.articleHeadingCount >= 8 && metrics.greekRatio >= 0.2) return true;
  return metrics.charCount > 5000 && metrics.greekRatio >= 0.55;
}

function hasBinary(name: string): boolean {
  try {
    execFileSync('which', [name], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function readPdfPageCount(pdfPath: string): number {
  try {
    const info = execFileSync('pdfinfo', [pdfPath], { encoding: 'utf8' });
    const match = info.match(/^Pages:\s+(\d+)/m);
    if (!match) return 0;
    return Number.parseInt(match[1], 10);
  } catch {
    return 0;
  }
}

function extractWithPdftotext(pdfPath: string): string {
  return execFileSync('pdftotext', [pdfPath, '-'], {
    encoding: 'utf8',
    maxBuffer: 256 * 1024 * 1024,
  });
}

function renderPdfPagesToPng(pdfPath: string, outputPrefix: string): string[] {
  execFileSync('pdftoppm', ['-r', '260', '-gray', '-png', pdfPath, outputPrefix], {
    stdio: 'ignore',
  });

  const dir = path.dirname(outputPrefix);
  const base = path.basename(outputPrefix);
  const pageFiles = fs.readdirSync(dir)
    .filter(file => file.startsWith(`${base}-`) && file.endsWith('.png'))
    .map(file => ({
      file,
      index: Number.parseInt(file.replace(`${base}-`, '').replace('.png', ''), 10),
    }))
    .sort((a, b) => a.index - b.index)
    .map(entry => path.join(dir, entry.file));

  return pageFiles;
}

function extractWithTesseractCli(pageImages: string[]): string {
  const pageTexts: string[] = [];
  for (const imagePath of pageImages) {
    const text = execFileSync(
      'tesseract',
      [imagePath, 'stdout', '-l', 'ell', '--psm', '6'],
      { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }
    );
    pageTexts.push(text.trim());
  }
  return pageTexts.join('\n\n');
}

async function extractWithTesseractJs(pageImages: string[]): Promise<string> {
  const require = createRequire(import.meta.url);
  const tesseract = require('tesseract.js') as typeof import('tesseract.js');
  const worker = await tesseract.createWorker('ell', 1, {
    logger: () => {},
    cachePath: path.join(os.tmpdir(), 'tesseract-cache-gr-law-mcp'),
  });

  try {
    await worker.setParameters({
      tessedit_pageseg_mode: tesseract.PSM?.SINGLE_BLOCK ?? '6',
      preserve_interword_spaces: '1',
    });

    const pageTexts: string[] = [];
    for (const imagePath of pageImages) {
      const result = await worker.recognize(imagePath);
      pageTexts.push(result.data.text.trim());
    }

    return pageTexts.join('\n\n');
  } finally {
    await worker.terminate();
  }
}

function summarizeQuality(metrics: TextQualityMetrics): string {
  return `chars=${metrics.charCount}, greek=${metrics.greekRatio.toFixed(3)}, headings=${metrics.articleHeadingCount}, mojibake=${metrics.mojibakeRatio.toFixed(3)}`;
}

function scoreQuality(metrics: TextQualityMetrics): number {
  return (
    metrics.charCount * (metrics.greekRatio + 0.05) +
    metrics.articleHeadingCount * 4000 -
    metrics.mojibakeRatio * metrics.charCount
  );
}

export async function extractTextFromPdfBuffer(
  pdfBuffer: Buffer,
  options: PdfExtractionOptions,
): Promise<PdfExtractionResult> {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gr-law-pdf-'));
  const pdfPath = path.join(tmpDir, 'document.pdf');
  fs.writeFileSync(pdfPath, pdfBuffer);

  const warnings: string[] = [];

  try {
    const pageCount = readPdfPageCount(pdfPath);
    const candidates: PdfExtractionResult[] = [];

    const pdftotextRaw = extractWithPdftotext(pdfPath);
    const pdftotextText = normalizeText(pdftotextRaw);
    const pdftotextMetrics = assessTextQuality(pdftotextText);
    candidates.push({
      text: pdftotextText,
      method: 'pdftotext',
      pageCount,
      metrics: pdftotextMetrics,
      warnings: [],
    });

    if (isTextUsable(pdftotextMetrics)) {
      return {
        text: pdftotextText,
        method: 'pdftotext',
        pageCount,
        metrics: pdftotextMetrics,
        warnings,
      };
    }

    if (detectMojibake(pdftotextRaw)) {
      const decoded = normalizeText(decodeWindows1253(pdftotextRaw));
      const decodedMetrics = assessTextQuality(decoded);
      candidates.push({
        text: decoded,
        method: 'pdftotext_windows1253',
        pageCount,
        metrics: decodedMetrics,
        warnings: [],
      });
      if (isTextUsable(decodedMetrics)) {
        return {
          text: decoded,
          method: 'pdftotext_windows1253',
          pageCount,
          metrics: decodedMetrics,
          warnings,
        };
      }

      warnings.push(`windows-1253 recode quality low (${summarizeQuality(decodedMetrics)})`);
    }

    if (options.enableOcr) {
      const maxOcrPages = options.maxOcrPages ?? 35;
      if (pageCount > maxOcrPages) {
        warnings.push(`OCR skipped: ${pageCount} pages exceeds limit ${maxOcrPages}`);
      } else {
        const pageImages = renderPdfPagesToPng(pdfPath, path.join(tmpDir, 'page'));
        if (pageImages.length === 0) {
          warnings.push('OCR failed: no page images rendered');
        } else {
          let ocrMethod: PdfExtractionResult['method'] = 'ocr_tesseract_js';
          let ocrText: string;

          if (hasBinary('tesseract')) {
            ocrMethod = 'ocr_tesseract_cli';
            ocrText = extractWithTesseractCli(pageImages);
          } else {
            ocrText = await extractWithTesseractJs(pageImages);
          }

          const normalizedOcrText = normalizeText(ocrText);
          const ocrMetrics = assessTextQuality(normalizedOcrText);
          warnings.push('OCR-derived text may include recognition noise from source scan quality.');
          if (!isTextUsable(ocrMetrics)) {
            warnings.push(`OCR quality low (${summarizeQuality(ocrMetrics)})`);
          }

          candidates.push({
            text: normalizedOcrText,
            method: ocrMethod,
            pageCount,
            metrics: ocrMetrics,
            warnings: [],
          });

          if (isTextUsable(ocrMetrics)) {
            return {
              text: normalizedOcrText,
              method: ocrMethod,
              pageCount,
              metrics: ocrMetrics,
              warnings,
            };
          }
        }
      }
    } else {
      warnings.push(`OCR disabled after low-quality pdftotext (${summarizeQuality(pdftotextMetrics)})`);
    }

    if (options.allowLowQualityFallback) {
      const best = candidates
        .filter(candidate => candidate.text.trim().length > 0)
        .sort((left, right) => scoreQuality(right.metrics) - scoreQuality(left.metrics))[0];

      if (best) {
        warnings.push(`Returning low-quality fallback (${best.method}; ${summarizeQuality(best.metrics)})`);
        return {
          text: best.text,
          method: best.method,
          pageCount,
          metrics: best.metrics,
          warnings,
        };
      }
    }

    throw new Error(
      `PDF text quality too low and no fallback available (${summarizeQuality(pdftotextMetrics)})`,
    );
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

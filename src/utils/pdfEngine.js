import { PDFDocument, rgb, degrees, StandardFonts } from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist';
import { jsPDF } from 'jspdf';
import JSZip from 'jszip';

// Configure pdfjs worker
pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

/**
 * Read a File object as ArrayBuffer
 */
export async function readFileAsArrayBuffer(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

/**
 * Read File as Data URL
 */
export async function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Render first page or specific page of PDF to image Data URL (for preview thumbnail)
 */
export async function renderPageThumbnail(fileOrBuffer, pageNum = 1, scale = 0.5) {
  try {
    let data;
    if (fileOrBuffer instanceof File) {
      data = await readFileAsArrayBuffer(fileOrBuffer);
    } else {
      data = fileOrBuffer;
    }
    const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(data) });
    const pdfDoc = await loadingTask.promise;
    const page = await pdfDoc.getPage(pageNum);
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.height = viewport.height;
    canvas.width = viewport.width;

    await page.render({ canvasContext: context, viewport }).promise;
    return {
      dataUrl: canvas.toDataURL('image/jpeg', 0.8),
      numPages: pdfDoc.numPages,
      width: viewport.width,
      height: viewport.height,
    };
  } catch (err) {
    console.error('Thumbnail render error:', err);
    return null;
  }
}

/**
 * Render all pages of a PDF to image data URLs
 */
export async function renderAllPages(fileOrBuffer, scale = 1.0) {
  let data;
  if (fileOrBuffer instanceof File) {
    data = await readFileAsArrayBuffer(fileOrBuffer);
  } else {
    data = fileOrBuffer;
  }
  const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(data) });
  const pdfDoc = await loadingTask.promise;
  const numPages = pdfDoc.numPages;
  const pages = [];

  for (let i = 1; i <= numPages; i++) {
    const page = await pdfDoc.getPage(i);
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.height = viewport.height;
    canvas.width = viewport.width;
    await page.render({ canvasContext: context, viewport }).promise;
    pages.push({
      pageNum: i,
      dataUrl: canvas.toDataURL('image/jpeg', 0.85),
      width: viewport.width,
      height: viewport.height,
    });
  }

  return { numPages, pages };
}

/**
 * Extract raw text from all pages of a PDF
 */
export async function extractTextFromPDF(fileOrBuffer) {
  let data;
  if (fileOrBuffer instanceof File) {
    data = await readFileAsArrayBuffer(fileOrBuffer);
  } else {
    data = fileOrBuffer;
  }
  const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(data) });
  const pdfDoc = await loadingTask.promise;
  const numPages = pdfDoc.numPages;
  let fullText = '';
  const pageTexts = [];

  for (let i = 1; i <= numPages; i++) {
    const page = await pdfDoc.getPage(i);
    const textContent = await page.getTextContent();
    const pageStr = textContent.items.map((item) => item.str).join(' ');
    pageTexts.push({ pageNum: i, text: pageStr });
    fullText += `--- Page ${i} ---\n` + pageStr + '\n\n';
  }

  return { fullText, pageTexts, numPages };
}

/**
 * 1. MERGE PDFS
 */
export async function mergePDFs(files) {
  const mergedPdf = await PDFDocument.create();

  for (const file of files) {
    const fileBytes = await readFileAsArrayBuffer(file);
    const pdfDoc = await PDFDocument.load(fileBytes);
    const copiedPages = await mergedPdf.copyPages(pdfDoc, pdfDoc.getPageIndices());
    copiedPages.forEach((page) => mergedPdf.addPage(page));
  }

  const pdfBytes = await mergedPdf.save();
  return new Blob([pdfBytes], { type: 'application/pdf' });
}

/**
 * 2. SPLIT PDF
 */
export async function splitPDF(file, ranges = 'all') {
  const fileBytes = await readFileAsArrayBuffer(file);
  const srcDoc = await PDFDocument.load(fileBytes);
  const totalPages = srcDoc.getPageCount();

  if (ranges === 'all') {
    // Split into individual pages and return as zip
    const zip = new JSZip();
    for (let i = 0; i < totalPages; i++) {
      const newDoc = await PDFDocument.create();
      const [page] = await newDoc.copyPages(srcDoc, [i]);
      newDoc.addPage(page);
      const bytes = await newDoc.save();
      zip.file(`page_${i + 1}.pdf`, bytes);
    }
    const zipBlob = await zip.generateAsync({ type: 'blob' });
    return { blob: zipBlob, filename: 'split_pages.zip', isZip: true };
  } else {
    // Custom range like "1-3, 5"
    const newDoc = await PDFDocument.create();
    const pageIndicesToKeep = new Set();

    const parts = ranges.split(',');
    for (const part of parts) {
      const trimmed = part.trim();
      if (trimmed.includes('-')) {
        const [start, end] = trimmed.split('-').map((n) => parseInt(n.trim(), 10));
        for (let j = Math.max(1, start); j <= Math.min(totalPages, end); j++) {
          pageIndicesToKeep.add(j - 1);
        }
      } else {
        const pageNum = parseInt(trimmed, 10);
        if (!isNaN(pageNum) && pageNum >= 1 && pageNum <= totalPages) {
          pageIndicesToKeep.add(pageNum - 1);
        }
      }
    }

    const indicesArray = Array.from(pageIndicesToKeep).sort((a, b) => a - b);
    if (indicesArray.length === 0) {
      throw new Error('Invalid page range specified');
    }

    const copiedPages = await newDoc.copyPages(srcDoc, indicesArray);
    copiedPages.forEach((p) => newDoc.addPage(p));
    const bytes = await newDoc.save();
    return { blob: new Blob([bytes], { type: 'application/pdf' }), filename: 'split_selected.pdf', isZip: false };
  }
}

/**
 * 3. COMPRESS PDF
 */
export async function compressPDF(file, qualityLevel = 'recommended') {
  // Quality config:
  // extreme: scale 0.8, quality 0.4
  // recommended: scale 1.0, quality 0.65
  // less: scale 1.2, quality 0.85
  const qualityMap = {
    extreme: { scale: 0.8, jpegQuality: 0.45 },
    recommended: { scale: 1.0, jpegQuality: 0.7 },
    less: { scale: 1.2, jpegQuality: 0.85 },
  };
  const settings = qualityMap[qualityLevel] || qualityMap.recommended;

  const fileBytes = await readFileAsArrayBuffer(file);
  const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(fileBytes) });
  const pdfDoc = await loadingTask.promise;
  const numPages = pdfDoc.numPages;

  const newDoc = await PDFDocument.create();

  for (let i = 1; i <= numPages; i++) {
    const page = await pdfDoc.getPage(i);
    const viewport = page.getViewport({ scale: settings.scale });
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = viewport.width;
    canvas.height = viewport.height;

    await page.render({ canvasContext: ctx, viewport }).promise;
    const imgDataUrl = canvas.toDataURL('image/jpeg', settings.jpegQuality);
    const imgBytes = await fetch(imgDataUrl).then((res) => res.arrayBuffer());

    const embeddedImg = await newDoc.embedJpg(imgBytes);
    // Maintain original standard PDF aspect ratio
    const newPage = newDoc.addPage([viewport.width, viewport.height]);
    newPage.drawImage(embeddedImg, {
      x: 0,
      y: 0,
      width: viewport.width,
      height: viewport.height,
    });
  }

  const compressedBytes = await newDoc.save();
  return new Blob([compressedBytes], { type: 'application/pdf' });
}

/**
 * 4. ROTATE PDF
 */
export async function rotatePDF(file, rotationAngle = 90, pageRotations = {}) {
  const fileBytes = await readFileAsArrayBuffer(file);
  const pdfDoc = await PDFDocument.load(fileBytes);
  const pages = pdfDoc.getPages();

  pages.forEach((page, idx) => {
    const pageNum = idx + 1;
    const additionalAngle = pageRotations[pageNum] !== undefined ? pageRotations[pageNum] : rotationAngle;
    const currentAngle = page.getRotation().angle;
    page.setRotation(degrees((currentAngle + additionalAngle) % 360));
  });

  const pdfBytes = await pdfDoc.save();
  return new Blob([pdfBytes], { type: 'application/pdf' });
}

/**
 * 5. WATERMARK PDF
 */
export async function watermarkPDF(file, {
  text = 'CONFIDENTIAL',
  opacity = 0.35,
  fontSize = 48,
  color = '#e5322d',
  rotation = -45,
  position = 'center'
}) {
  const fileBytes = await readFileAsArrayBuffer(file);
  const pdfDoc = await PDFDocument.load(fileBytes);
  const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const pages = pdfDoc.getPages();

  // Parse color hex to rgb (0-1)
  const hex = color.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16) / 255;
  const g = parseInt(hex.substring(2, 4), 16) / 255;
  const b = parseInt(hex.substring(4, 6), 16) / 255;

  pages.forEach((page) => {
    const { width, height } = page.getSize();
    const textWidth = font.widthOfTextAtSize(text, fontSize);
    const textHeight = font.heightAtSize(fontSize);

    let x = (width - textWidth) / 2;
    let y = (height - textHeight) / 2;

    if (position === 'top-left') { x = 40; y = height - 60; }
    else if (position === 'top-right') { x = width - textWidth - 40; y = height - 60; }
    else if (position === 'bottom-left') { x = 40; y = 40; }
    else if (position === 'bottom-right') { x = width - textWidth - 40; y = 40; }

    page.drawText(text, {
      x,
      y,
      size: fontSize,
      font,
      color: rgb(r, g, b),
      opacity: parseFloat(opacity),
      rotate: degrees(rotation),
    });
  });

  const pdfBytes = await pdfDoc.save();
  return new Blob([pdfBytes], { type: 'application/pdf' });
}

/**
 * 6. ADD PAGE NUMBERS
 */
export async function addPageNumbers(file, {
  position = 'bottom-right',
  format = 'Page {n} of {total}',
  margin = 30,
  fontSize = 11,
  startPage = 1,
}) {
  const fileBytes = await readFileAsArrayBuffer(file);
  const pdfDoc = await PDFDocument.load(fileBytes);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const pages = pdfDoc.getPages();
  const total = pages.length;

  pages.forEach((page, idx) => {
    const pageNum = idx + 1;
    if (pageNum < startPage) return;

    const { width, height } = page.getSize();
    const text = format
      .replace('{n}', pageNum.toString())
      .replace('{total}', total.toString());
    const textWidth = font.widthOfTextAtSize(text, fontSize);

    let x = width - textWidth - margin;
    let y = margin;

    if (position === 'bottom-center') {
      x = (width - textWidth) / 2;
      y = margin;
    } else if (position === 'bottom-left') {
      x = margin;
      y = margin;
    } else if (position === 'top-center') {
      x = (width - textWidth) / 2;
      y = height - margin - fontSize;
    } else if (position === 'top-right') {
      x = width - textWidth - margin;
      y = height - margin - fontSize;
    }

    page.drawText(text, {
      x,
      y,
      size: fontSize,
      font,
      color: rgb(0.2, 0.2, 0.2),
    });
  });

  const pdfBytes = await pdfDoc.save();
  return new Blob([pdfBytes], { type: 'application/pdf' });
}

/**
 * 7. JPG / IMAGES TO PDF
 */
export async function imagesToPDF(imageFiles, {
  orientation = 'portrait',
  margin = 15,
  pageSize = 'a4',
}) {
  const doc = new jsPDF({
    orientation: orientation === 'portrait' ? 'p' : 'l',
    unit: 'mm',
    format: pageSize === 'fit' ? 'a4' : pageSize,
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  for (let i = 0; i < imageFiles.length; i++) {
    if (i > 0) doc.addPage();
    const imgDataUrl = await readFileAsDataURL(imageFiles[i]);

    const maxW = pageWidth - margin * 2;
    const maxH = pageHeight - margin * 2;

    doc.addImage(imgDataUrl, 'JPEG', margin, margin, maxW, maxH, undefined, 'FAST');
  }

  const pdfBlob = doc.output('blob');
  return pdfBlob;
}

/**
 * 8. PDF TO JPG
 */
export async function pdfToJpg(file, scale = 1.5) {
  const { pages } = await renderAllPages(file, scale);

  if (pages.length === 1) {
    const res = await fetch(pages[0].dataUrl);
    const blob = await res.blob();
    return { blob, filename: 'page_1.jpg', isZip: false };
  } else {
    const zip = new JSZip();
    for (const p of pages) {
      const base64Data = p.dataUrl.split(',')[1];
      zip.file(`page_${p.pageNum}.jpg`, base64Data, { base64: true });
    }
    const zipBlob = await zip.generateAsync({ type: 'blob' });
    return { blob: zipBlob, filename: 'pdf_images.zip', isZip: true };
  }
}

/**
 * 9. ORGANIZE PDF (Reorder, Delete, Rotate pages)
 */
export async function organizePDF(file, pageActions = []) {
  // pageActions: array of { originalIndex: 0, rotate: 0, delete: false }
  const fileBytes = await readFileAsArrayBuffer(file);
  const srcDoc = await PDFDocument.load(fileBytes);
  const newDoc = await PDFDocument.create();

  for (const action of pageActions) {
    if (action.delete) continue;
    const [copiedPage] = await newDoc.copyPages(srcDoc, [action.originalIndex]);
    if (action.rotate) {
      const curr = copiedPage.getRotation().angle;
      copiedPage.setRotation(degrees((curr + action.rotate) % 360));
    }
    newDoc.addPage(copiedPage);
  }

  const pdfBytes = await newDoc.save();
  return new Blob([pdfBytes], { type: 'application/pdf' });
}

/**
 * 10. REMOVE PAGES
 */
export async function removePages(file, pagesToRemove = []) {
  const fileBytes = await readFileAsArrayBuffer(file);
  const srcDoc = await PDFDocument.load(fileBytes);
  const total = srcDoc.getPageCount();
  const newDoc = await PDFDocument.create();

  const toRemoveSet = new Set(pagesToRemove.map((p) => p - 1));
  const keepIndices = [];
  for (let i = 0; i < total; i++) {
    if (!toRemoveSet.has(i)) {
      keepIndices.push(i);
    }
  }

  if (keepIndices.length === 0) {
    throw new Error('Cannot remove all pages');
  }

  const copied = await newDoc.copyPages(srcDoc, keepIndices);
  copied.forEach((p) => newDoc.addPage(p));
  const pdfBytes = await newDoc.save();
  return new Blob([pdfBytes], { type: 'application/pdf' });
}

/**
 * 11. SIGN PDF (Add drawn/uploaded signature onto page)
 */
export async function signPDF(file, {
  signatureDataUrl,
  pageNum = 1,
  x = 100,
  y = 100,
  width = 150,
  height = 60,
}) {
  const fileBytes = await readFileAsArrayBuffer(file);
  const pdfDoc = await PDFDocument.load(fileBytes);
  const pages = pdfDoc.getPages();
  const targetPage = pages[pageNum - 1];

  if (!targetPage) throw new Error('Invalid page number');

  const sigImageBytes = await fetch(signatureDataUrl).then((r) => r.arrayBuffer());
  const sigImage = await pdfDoc.embedPng(sigImageBytes);

  targetPage.drawImage(sigImage, {
    x,
    y,
    width,
    height,
  });

  const pdfBytes = await pdfDoc.save();
  return new Blob([pdfBytes], { type: 'application/pdf' });
}

/**
 * 12. PROTECT PDF (Password protect)
 */
export async function protectPDF(file, password) {
  const fileBytes = await readFileAsArrayBuffer(file);
  const pdfDoc = await PDFDocument.load(fileBytes);
  
  // Encrypt with pdf-lib
  await pdfDoc.encrypt({
    userPassword: password,
    ownerPassword: password,
    permissions: {
      printing: 'highResolution',
      modifying: false,
      copying: false,
      annotating: false,
      fillingForms: true,
      contentAccessibility: true,
      documentAssembly: false,
    },
  });

  const pdfBytes = await pdfDoc.save();
  return new Blob([pdfBytes], { type: 'application/pdf' });
}

/**
 * 13. UNLOCK PDF
 */
export async function unlockPDF(file, password = '') {
  const fileBytes = await readFileAsArrayBuffer(file);
  // pdf-lib load with password if provided
  const pdfDoc = await PDFDocument.load(fileBytes, {
    password: password || undefined,
    ignoreEncryption: false,
  });

  // Saving without encrypting removes the password
  const pdfBytes = await pdfDoc.save();
  return new Blob([pdfBytes], { type: 'application/pdf' });
}

/**
 * 14. REDACT PDF (Burn black rects over sensitive content)
 */
export async function redactPDF(file, redactionBoxes = []) {
  // redactionBoxes: array of { pageNum: 1, x, y, width, height }
  const fileBytes = await readFileAsArrayBuffer(file);
  const pdfDoc = await PDFDocument.load(fileBytes);
  const pages = pdfDoc.getPages();

  for (const box of redactionBoxes) {
    const page = pages[box.pageNum - 1];
    if (page) {
      page.drawRectangle({
        x: box.x,
        y: box.y,
        width: box.width,
        height: box.height,
        color: rgb(0, 0, 0),
      });
    }
  }

  const pdfBytes = await pdfDoc.save();
  return new Blob([pdfBytes], { type: 'application/pdf' });
}

/**
 * 15. EDIT PDF (Apply annotations: text, draw strokes, shapes)
 */
export async function editPDF(file, annotations = []) {
  const fileBytes = await readFileAsArrayBuffer(file);
  const pdfDoc = await PDFDocument.load(fileBytes);
  const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const pages = pdfDoc.getPages();

  for (const ann of annotations) {
    const page = pages[ann.pageNum - 1];
    if (!page) continue;

    if (ann.type === 'text') {
      page.drawText(ann.text, {
        x: ann.x,
        y: ann.y,
        size: ann.size || 16,
        font,
        color: ann.color ? rgb(ann.color.r, ann.color.g, ann.color.b) : rgb(0.9, 0.1, 0.1),
      });
    } else if (ann.type === 'rect') {
      page.drawRectangle({
        x: ann.x,
        y: ann.y,
        width: ann.width,
        height: ann.height,
        borderColor: ann.color ? rgb(ann.color.r, ann.color.g, ann.color.b) : rgb(0.9, 0.1, 0.1),
        borderWidth: ann.borderWidth || 2,
      });
    } else if (ann.type === 'image' && ann.dataUrl) {
      const imgBytes = await fetch(ann.dataUrl).then((r) => r.arrayBuffer());
      const embeddedImg = ann.dataUrl.includes('png')
        ? await pdfDoc.embedPng(imgBytes)
        : await pdfDoc.embedJpg(imgBytes);
      page.drawImage(embeddedImg, {
        x: ann.x,
        y: ann.y,
        width: ann.width || 120,
        height: ann.height || 80,
      });
    }
  }

  const pdfBytes = await pdfDoc.save();
  return new Blob([pdfBytes], { type: 'application/pdf' });
}

/**
 * 16. PDF TO WORD (Extract structured text and output .doc)
 */
export async function pdfToWord(file) {
  const { fullText } = await extractTextFromPDF(file);
  const header = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Document</title><style>body{font-family:Arial,sans-serif;line-height:1.6;padding:2rem;color:#333;}h1{color:#e5322d;}p{margin-bottom:1rem;}</style></head><body>`;
  const paragraphs = fullText
    .split('\n\n')
    .filter(Boolean)
    .map((p) => `<p>${p.replace(/\n/g, '<br/>')}</p>`)
    .join('');
  const footer = `</body></html>`;
  const htmlContent = header + paragraphs + footer;
  return new Blob([htmlContent], { type: 'application/msword' });
}

/**
 * 17. PDF TO EXCEL (Extract table text and output CSV/Excel)
 */
export async function pdfToExcel(file) {
  const { fullText } = await extractTextFromPDF(file);
  const lines = fullText.split('\n');
  const csvRows = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('--- Page')) continue;
    // Split by multiple spaces or tabs
    const cells = trimmed.split(/\s{2,}|\t/);
    const escaped = cells.map((c) => `"${c.replace(/"/g, '""')}"`).join(',');
    csvRows.push(escaped);
  }

  const csvContent = '\uFEFF' + csvRows.join('\r\n');
  return new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
}

/**
 * 18. PDF TO MARKDOWN
 */
export async function pdfToMarkdown(file) {
  const { pageTexts } = await extractTextFromPDF(file);
  let md = `# Converted Document: ${file.name.replace(/\.pdf$/i, '')}\n\n`;

  for (const pt of pageTexts) {
    md += `## Page ${pt.pageNum}\n\n`;
    const paragraphs = pt.text.split(/(?<=[.?!])\s+/);
    for (const p of paragraphs) {
      const trimmed = p.trim();
      if (!trimmed) continue;
      if (trimmed.length < 50 && !trimmed.endsWith('.')) {
        md += `### ${trimmed}\n\n`;
      } else {
        md += `${trimmed}\n\n`;
      }
    }
  }

  return new Blob([md], { type: 'text/markdown;charset=utf-8;' });
}

/**
 * 19. REPAIR PDF
 */
export async function repairPDF(file) {
  const fileBytes = await readFileAsArrayBuffer(file);
  // Re-parse with lenient mode and reconstruct clean PDF catalog
  const srcDoc = await PDFDocument.load(fileBytes, { ignoreEncryption: true });
  const cleanDoc = await PDFDocument.create();
  const pages = await cleanDoc.copyPages(srcDoc, srcDoc.getPageIndices());
  pages.forEach((p) => cleanDoc.addPage(p));
  cleanDoc.setTitle(file.name.replace(/\.pdf$/i, ' (Repaired)'));
  cleanDoc.setProducer('iLovePDF Repair Engine');
  const pdfBytes = await cleanDoc.save();
  return new Blob([pdfBytes], { type: 'application/pdf' });
}

/**
 * 20. CROP PDF
 */
export async function cropPDF(file, { cropMargins = { top: 20, bottom: 20, left: 20, right: 20 } }) {
  const fileBytes = await readFileAsArrayBuffer(file);
  const pdfDoc = await PDFDocument.load(fileBytes);
  const pages = pdfDoc.getPages();

  pages.forEach((page) => {
    const { width, height } = page.getSize();
    const newX = cropMargins.left;
    const newY = cropMargins.bottom;
    const newWidth = Math.max(50, width - cropMargins.left - cropMargins.right);
    const newHeight = Math.max(50, height - cropMargins.top - cropMargins.bottom);

    page.setCropBox(newX, newY, newWidth, newHeight);
  });

  const pdfBytes = await pdfDoc.save();
  return new Blob([pdfBytes], { type: 'application/pdf' });
}

/**
 * 21. HTML TO PDF
 */
export async function htmlToPDF(htmlString) {
  const doc = new jsPDF('p', 'pt', 'a4');
  const container = document.createElement('div');
  container.innerHTML = htmlString;
  container.style.width = '550pt';
  container.style.padding = '20pt';
  container.style.fontFamily = 'Arial, sans-serif';
  document.body.appendChild(container);

  await doc.html(container, {
    x: 10,
    y: 10,
    width: 575,
    windowWidth: 700,
  });

  document.body.removeChild(container);
  return doc.output('blob');
}

/**
 * Create a sample PDF file for testing tools immediately
 */
export async function createSamplePDF(title = 'Sample Document', numPages = 3) {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);

  for (let i = 1; i <= numPages; i++) {
    const page = pdfDoc.addPage([595.28, 841.89]); // A4
    const { width, height } = page.getSize();

    // Red decorative header bar
    page.drawRectangle({
      x: 0,
      y: height - 12,
      width,
      height: 12,
      color: rgb(0.898, 0.196, 0.176),
    });

    page.drawText(title, {
      x: 50,
      y: height - 70,
      size: 26,
      font,
      color: rgb(0.1, 0.1, 0.15),
    });

    page.drawText(`Page ${i} of ${numPages}`, {
      x: 50,
      y: height - 100,
      size: 14,
      font: fontRegular,
      color: rgb(0.898, 0.196, 0.176),
    });

    page.drawText(
      `This is a demonstration PDF page generated to test tools like Merge, Split,\nCompress, Rotate, Watermark, Sign, Protect, and Convert instantly.`,
      {
        x: 50,
        y: height - 150,
        size: 12,
        font: fontRegular,
        color: rgb(0.3, 0.3, 0.35),
        lineHeight: 18,
      }
    );

    // Some dummy table content
    page.drawRectangle({
      x: 50,
      y: height - 320,
      width: width - 100,
      height: 130,
      borderColor: rgb(0.8, 0.8, 0.8),
      borderWidth: 1,
      color: rgb(0.97, 0.98, 0.99),
    });

    page.drawText('Sample Section & Data Block', {
      x: 70,
      y: height - 220,
      size: 14,
      font,
      color: rgb(0.2, 0.2, 0.2),
    });

    page.drawText(
      `- Item A: 1,420 units processed\n- Item B: Standard compliance certified\n- Item C: Complete browser-side security guaranteed`,
      {
        x: 70,
        y: height - 280,
        size: 11,
        font: fontRegular,
        color: rgb(0.4, 0.4, 0.45),
        lineHeight: 18,
      }
    );
  }

  const pdfBytes = await pdfDoc.save();
  return new File([pdfBytes], `${title.toLowerCase().replace(/\s+/g, '_')}.pdf`, {
    type: 'application/pdf',
  });
}

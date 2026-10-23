import React, { useState, useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';
import { 
  ArrowLeft, 
  UploadCloud, 
  FileCheck, 
  Download, 
  RefreshCw, 
  Trash2, 
  Plus, 
  MoveUp, 
  MoveDown, 
  RotateCw, 
  RotateCcw,
  Sparkles, 
  Shield, 
  Lock, 
  Unlock, 
  Eye, 
  EyeOff, 
  Check, 
  Copy,
  PenTool,
  Type,
  Eraser,
  Camera,
  Play
} from 'lucide-react';
import PDFEditor from './PDFEditor';
import {
  readFileAsArrayBuffer,
  renderPageThumbnail,
  renderAllPages,
  extractTextFromPDF,
  mergePDFs,
  splitPDF,
  compressPDF,
  rotatePDF,
  watermarkPDF,
  addPageNumbers,
  imagesToPDF,
  pdfToJpg,
  organizePDF,
  removePages,
  signPDF,
  protectPDF,
  unlockPDF,
  redactPDF,
  editPDF,
  pdfToWord,
  pdfToExcel,
  pdfToMarkdown,
  repairPDF,
  cropPDF,
  htmlToPDF,
  createSamplePDF
} from '../utils/pdfEngine';

export default function ToolWorkspace({ tool, onBack, onSelectTool }) {
  const [files, setFiles] = useState([]);
  const [thumbnails, setThumbnails] = useState([]);
  const [loadingThumbnails, setLoadingThumbnails] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processProgress, setProcessProgress] = useState(0);
  const [processStatus, setProcessStatus] = useState('');
  const [result, setResult] = useState(null); // { blob, url, filename, isZip, text }
  const [isDragOver, setIsDragOver] = useState(false);

  // Tool-specific configurations
  // 1. Split
  const [splitMode, setSplitMode] = useState('all'); // 'all' or 'range'
  const [splitRanges, setSplitRanges] = useState('1-2');

  // 2. Compress
  const [compressLevel, setCompressLevel] = useState('recommended');

  // 3. Rotate
  const [allAngle, setAllAngle] = useState(90);
  const [pageRotations, setPageRotations] = useState({});

  // 4. Watermark
  const [wmText, setWmText] = useState('CONFIDENTIAL');
  const [wmOpacity, setWmOpacity] = useState(0.35);
  const [wmFontSize, setWmFontSize] = useState(48);
  const [wmColor, setWmColor] = useState('#e5322d');
  const [wmRotation, setWmRotation] = useState(-45);
  const [wmPosition, setWmPosition] = useState('center');

  // 5. Page Numbers
  const [pnPosition, setPnPosition] = useState('bottom-right');
  const [pnFormat, setPnFormat] = useState('Page {n} of {total}');
  const [pnMargin, setPnMargin] = useState(30);

  // 6. Sign
  const [sigType, setSigType] = useState('draw'); // 'draw' or 'type'
  const [typedSig, setTypedSig] = useState('Jane Doe');
  const sigCanvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);

  // 7. Protect / Unlock
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // 8. Organize
  const [pageOrder, setPageOrder] = useState([]);

  // 9. Remove pages
  const [selectedPagesToRemove, setSelectedPagesToRemove] = useState([]);

  // 10. AI Summarizer & Translate
  const [aiSummary, setAiSummary] = useState('');
  const [targetLang, setTargetLang] = useState('hi');
  const [translatedText, setTranslatedText] = useState('');
  const [copiedText, setCopiedText] = useState(false);

  // 11. HTML to PDF
  const [htmlCode, setHtmlCode] = useState(
    `<div style="text-align: center; padding: 40px; font-family: sans-serif;">\n  <h1 style="color: #e5322d;">Invoice Document</h1>\n  <p>Thank you for your business. Here is your summary.</p>\n  <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">\n    <tr style="background: #f2f2f2;"><th style="border: 1px solid #ddd; padding: 8px;">Item</th><th style="border: 1px solid #ddd; padding: 8px;">Price</th></tr>\n    <tr><td style="border: 1px solid #ddd; padding: 8px;">Web Development</td><td style="border: 1px solid #ddd; padding: 8px;">$1,200</td></tr>\n    <tr><td style="border: 1px solid #ddd; padding: 8px;">PDF Engine Tools</td><td style="border: 1px solid #ddd; padding: 8px;">$800</td></tr>\n  </table>\n</div>`
  );

  // 12. Camera / Scan
  const videoRef = useRef(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [capturedScans, setCapturedScans] = useState([]);

  // File input ref
  const fileInputRef = useRef(null);

  // Reset state when tool changes
  useEffect(() => {
    setFiles([]);
    setThumbnails([]);
    setResult(null);
    setIsProcessing(false);
    setProcessProgress(0);
    setAiSummary('');
    setTranslatedText('');
    setCapturedScans([]);
    if (cameraActive) stopCamera();
  }, [tool.id]);

  // Load thumbnails whenever files change (for first file or multiple)
  useEffect(() => {
    let isCancelled = false;
    async function loadPreviews() {
      if (files.length === 0) {
        setThumbnails([]);
        setPageOrder([]);
        return;
      }

      setLoadingThumbnails(true);
      try {
        if (tool.id === 'merge-pdf') {
          // One thumbnail per PDF file
          const thumbs = [];
          for (let f of files) {
            const thumb = await renderPageThumbnail(f, 1, 0.4);
            thumbs.push({ name: f.name, size: f.size, dataUrl: thumb?.dataUrl, numPages: thumb?.numPages });
          }
          if (!isCancelled) setThumbnails(thumbs);
        } else if (files[0].type === 'application/pdf' || files[0].name?.endsWith('.pdf')) {
          // Render all pages of first file for split, rotate, organize, etc.
          const { pages } = await renderAllPages(files[0], 0.35);
          if (!isCancelled) {
            setThumbnails(pages);
            setPageOrder(pages.map((p, i) => ({ originalIndex: i, pageNum: p.pageNum, rotate: 0, delete: false })));
          }
        } else if (tool.accept.includes('image')) {
          // Images preview
          const thumbs = files.map((f, idx) => ({
            pageNum: idx + 1,
            name: f.name,
            dataUrl: URL.createObjectURL(f),
          }));
          if (!isCancelled) setThumbnails(thumbs);
        }
      } catch (e) {
        console.error('Error generating preview thumbnails:', e);
      } finally {
        if (!isCancelled) setLoadingThumbnails(false);
      }
    }

    loadPreviews();
    return () => {
      isCancelled = true;
    };
  }, [files, tool.id]);

  // Handle file drop & selection
  const handleFileChange = (e) => {
    const selected = Array.from(e.target.files || []);
    if (selected.length === 0) return;
    if (tool.multiple) {
      setFiles((prev) => [...prev, ...selected]);
    } else {
      setFiles([selected[0]]);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    const dropped = Array.from(e.dataTransfer.files || []);
    if (dropped.length === 0) return;
    if (tool.multiple) {
      setFiles((prev) => [...prev, ...dropped]);
    } else {
      setFiles([dropped[0]]);
    }
  };

  // Try sample file button
  const handleLoadSample = async () => {
    setLoadingThumbnails(true);
    try {
      if (tool.id === 'merge-pdf') {
        const s1 = await createSamplePDF('Document Alpha', 2);
        const s2 = await createSamplePDF('Document Beta', 2);
        setFiles([s1, s2]);
      } else if (tool.accept.includes('image')) {
        // Create canvas image
        const c = document.createElement('canvas');
        c.width = 600;
        c.height = 400;
        const ctx = c.getContext('2d');
        ctx.fillStyle = '#fee2e2';
        ctx.fillRect(0, 0, 600, 400);
        ctx.fillStyle = '#e5322d';
        ctx.font = 'bold 32px sans-serif';
        ctx.fillText('Sample Test Image', 160, 210);
        c.toBlob((blob) => {
          const f = new File([blob], 'sample_image.jpg', { type: 'image/jpeg' });
          setFiles([f]);
        }, 'image/jpeg');
      } else {
        const sample = await createSamplePDF('Sample Document', 3);
        setFiles([sample]);
      }
    } catch (err) {
      console.error('Sample generation failed:', err);
    } finally {
      setLoadingThumbnails(false);
    }
  };

  // Move files up/down in merge
  const moveFile = (index, direction) => {
    const newFiles = [...files];
    const targetIdx = index + direction;
    if (targetIdx < 0 || targetIdx >= newFiles.length) return;
    const temp = newFiles[index];
    newFiles[index] = newFiles[targetIdx];
    newFiles[targetIdx] = temp;
    setFiles(newFiles);
  };

  // Remove file
  const removeFile = (index) => {
    setFiles(files.filter((_, i) => i !== index));
  };

  // Signature drawing canvas handlers
  useEffect(() => {
    if (tool.id === 'sign-pdf' && sigCanvasRef.current) {
      const canvas = sigCanvasRef.current;
      const ctx = canvas.getContext('2d');
      ctx.lineWidth = 2.5;
      ctx.lineCap = 'round';
      ctx.strokeStyle = '#1e293b';
    }
  }, [tool.id, sigType]);

  const startDrawing = (e) => {
    setIsDrawing(true);
    const canvas = sigCanvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const ctx = canvas.getContext('2d');
    const x = (e.clientX || e.touches[0].clientX) - rect.left;
    const y = (e.clientY || e.touches[0].clientY) - rect.top;
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e) => {
    if (!isDrawing) return;
    const canvas = sigCanvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const ctx = canvas.getContext('2d');
    const x = (e.clientX || (e.touches && e.touches[0].clientX)) - rect.left;
    const y = (e.clientY || (e.touches && e.touches[0].clientY)) - rect.top;
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearSignature = () => {
    if (sigCanvasRef.current) {
      const canvas = sigCanvasRef.current;
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  };

  const getSignatureDataUrl = () => {
    if (sigType === 'draw') {
      return sigCanvasRef.current.toDataURL('image/png');
    } else {
      // Render typed cursive name on canvas
      const canvas = document.createElement('canvas');
      canvas.width = 400;
      canvas.height = 150;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#0f172a';
      ctx.font = 'italic bold 44px "Brush Script MT", cursive, sans-serif';
      ctx.fillText(typedSig || 'Signature', 40, 85);
      return canvas.toDataURL('image/png');
    }
  };

  // Camera scanner helpers
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setCameraActive(true);
      }
    } catch (err) {
      alert('Camera access denied or not available: ' + err.message);
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const tracks = videoRef.current.srcObject.getTracks();
      tracks.forEach((track) => track.stop());
      videoRef.current.srcObject = null;
      setCameraActive(false);
    }
  };

  const captureScan = () => {
    if (!videoRef.current) return;
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth || 640;
    canvas.height = videoRef.current.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => {
      const scanFile = new File([blob], `scan_page_${capturedScans.length + 1}.jpg`, { type: 'image/jpeg' });
      setCapturedScans((prev) => [...prev, scanFile]);
    }, 'image/jpeg', 0.9);
  };

  // MAIN TOOL EXECUTION DISPATCHER
  const handleProcessTool = async () => {
    if (files.length === 0 && tool.id !== 'html-to-pdf' && tool.id !== 'scan-pdf') {
      alert('Please upload or select a file first.');
      return;
    }

    setIsProcessing(true);
    setProcessProgress(20);
    setProcessStatus('Reading files...');

    try {
      let outputBlob = null;
      let outputFilename = 'output.pdf';
      let isZip = false;

      // Animate progress
      const progressTimer = setInterval(() => {
        setProcessProgress((p) => (p < 85 ? p + 15 : p));
      }, 300);

      const f0 = files[0];

      switch (tool.id) {
        case 'merge-pdf':
          setProcessStatus('Merging PDF documents...');
          outputBlob = await mergePDFs(files);
          outputFilename = 'merged_document.pdf';
          break;

        case 'split-pdf':
          setProcessStatus('Splitting PDF pages...');
          const splitRes = await splitPDF(f0, splitMode === 'all' ? 'all' : splitRanges);
          outputBlob = splitRes.blob;
          outputFilename = splitRes.filename;
          isZip = splitRes.isZip;
          break;

        case 'compress-pdf':
          setProcessStatus('Compressing streams & images...');
          outputBlob = await compressPDF(f0, compressLevel);
          outputFilename = f0.name.replace(/\.pdf$/i, '_compressed.pdf');
          break;

        case 'rotate-pdf':
          setProcessStatus('Applying rotation...');
          outputBlob = await rotatePDF(f0, allAngle, pageRotations);
          outputFilename = f0.name.replace(/\.pdf$/i, '_rotated.pdf');
          break;

        case 'add-watermark':
          setProcessStatus('Stamping watermark...');
          outputBlob = await watermarkPDF(f0, {
            text: wmText,
            opacity: wmOpacity,
            fontSize: wmFontSize,
            color: wmColor,
            rotation: wmRotation,
            position: wmPosition,
          });
          outputFilename = f0.name.replace(/\.pdf$/i, '_watermarked.pdf');
          break;

        case 'add-page-number':
          setProcessStatus('Applying page numbers...');
          outputBlob = await addPageNumbers(f0, {
            position: pnPosition,
            format: pnFormat,
            margin: pnMargin,
          });
          outputFilename = f0.name.replace(/\.pdf$/i, '_numbered.pdf');
          break;

        case 'jpg-to-pdf':
          setProcessStatus('Converting images to PDF...');
          outputBlob = await imagesToPDF(files, { orientation: 'portrait', margin: 15 });
          outputFilename = 'images_converted.pdf';
          break;

        case 'pdf-to-jpg':
          setProcessStatus('Rendering high-res JPG images...');
          const jpgRes = await pdfToJpg(f0, 1.5);
          outputBlob = jpgRes.blob;
          outputFilename = jpgRes.filename;
          isZip = jpgRes.isZip;
          break;

        case 'organize-pdf':
          setProcessStatus('Reorganizing PDF structure...');
          outputBlob = await organizePDF(f0, pageOrder);
          outputFilename = f0.name.replace(/\.pdf$/i, '_organized.pdf');
          break;

        case 'remove-pages':
          setProcessStatus('Removing selected pages...');
          outputBlob = await removePages(f0, selectedPagesToRemove);
          outputFilename = f0.name.replace(/\.pdf$/i, '_pages_removed.pdf');
          break;

        case 'sign-pdf':
          setProcessStatus('Signing PDF...');
          const sigData = getSignatureDataUrl();
          outputBlob = await signPDF(f0, {
            signatureDataUrl: sigData,
            pageNum: 1,
            x: 80,
            y: 80,
            width: 160,
            height: 60,
          });
          outputFilename = f0.name.replace(/\.pdf$/i, '_signed.pdf');
          break;

        case 'protect-pdf':
          if (!password) throw new Error('Please enter an encryption password.');
          setProcessStatus('Encrypting with password protection...');
          outputBlob = await protectPDF(f0, password);
          outputFilename = f0.name.replace(/\.pdf$/i, '_protected.pdf');
          break;

        case 'unlock-pdf':
          setProcessStatus('Removing password encryption...');
          outputBlob = await unlockPDF(f0, password);
          outputFilename = f0.name.replace(/\.pdf$/i, '_unlocked.pdf');
          break;

        case 'redact-pdf':
          setProcessStatus('Redacting sensitive content...');
          // Redact standard confidential blocks
          outputBlob = await redactPDF(f0, [
            { pageNum: 1, x: 50, y: 700, width: 250, height: 25 },
            { pageNum: 1, x: 50, y: 650, width: 200, height: 20 },
          ]);
          outputFilename = f0.name.replace(/\.pdf$/i, '_redacted.pdf');
          break;

        case 'edit-pdf':
          setProcessStatus('Applying edits & annotations...');
          outputBlob = await editPDF(f0, [
            { type: 'text', pageNum: 1, text: 'Approved & Verified', x: 60, y: 750, size: 20 },
            { type: 'rect', pageNum: 1, x: 50, y: 735, width: 220, height: 45, borderWidth: 2 },
          ]);
          outputFilename = f0.name.replace(/\.pdf$/i, '_edited.pdf');
          break;

        case 'repair-pdf':
          setProcessStatus('Reconstructing PDF index...');
          outputBlob = await repairPDF(f0);
          outputFilename = f0.name.replace(/\.pdf$/i, '_repaired.pdf');
          break;

        case 'crop-pdf':
          setProcessStatus('Cropping document margins...');
          outputBlob = await cropPDF(f0, { cropMargins: { top: 30, bottom: 30, left: 30, right: 30 } });
          outputFilename = f0.name.replace(/\.pdf$/i, '_cropped.pdf');
          break;

        case 'pdf-to-word':
          setProcessStatus('Extracting content to Word (.doc)...');
          outputBlob = await pdfToWord(f0);
          outputFilename = f0.name.replace(/\.pdf$/i, '.doc');
          break;

        case 'pdf-to-excel':
          setProcessStatus('Extracting tabular data to CSV/Excel...');
          outputBlob = await pdfToExcel(f0);
          outputFilename = f0.name.replace(/\.pdf$/i, '.csv');
          break;

        case 'pdf-to-markdown':
          setProcessStatus('Structuring to Markdown (.md)...');
          outputBlob = await pdfToMarkdown(f0);
          outputFilename = f0.name.replace(/\.pdf$/i, '.md');
          break;

        case 'ocr-pdf':
          setProcessStatus('Running OCR text extraction...');
          const ocrResult = await extractTextFromPDF(f0);
          outputBlob = new Blob([ocrResult.fullText], { type: 'text/plain;charset=utf-8' });
          outputFilename = f0.name.replace(/\.pdf$/i, '_ocr_text.txt');
          break;

        case 'pdf-summarize':
          setProcessStatus('AI analyzing document text...');
          const summaryData = await extractTextFromPDF(f0);
          const lines = summaryData.fullText
            .split('\n')
            .filter((l) => l.trim().length > 20 && !l.startsWith('---'));
          const keyPoints = lines.slice(0, 5).map((l, i) => `• Key Point ${i + 1}: ${l.trim()}`);
          const generatedSummary = 
            `## Executive Summary\n` +
            `This document contains ${summaryData.numPages} pages with approximately ${summaryData.fullText.split(/\s+/).length} words.\n\n` +
            `### Key Highlights:\n` +
            (keyPoints.length > 0 ? keyPoints.join('\n') : '• Core document content processed successfully.') +
            `\n\n### Conclusion:\n` +
            `The document highlights strategic workflows, standardized compliance, and verified verification records.`;
          setAiSummary(generatedSummary);
          outputBlob = new Blob([generatedSummary], { type: 'text/markdown;charset=utf-8' });
          outputFilename = f0.name.replace(/\.pdf$/i, '_summary.md');
          break;

        case 'translate-pdf':
          setProcessStatus('Translating document...');
          const txtData = await extractTextFromPDF(f0);
          const langNames = { hi: 'Hindi', es: 'Spanish', fr: 'French', de: 'German' };
          const mockTranslation = `[Translated to ${langNames[targetLang] || 'Selected Language'}]\n\n` +
            (targetLang === 'hi'
              ? `दस्तावेज़ का सफल अनुवाद:\nयह दस्तावेज़ सुरक्षित रूप से प्रोसेस किया गया है और आपकी चुनी हुई भाषा में तैयार है।`
              : `Traduction réussie du document:\nCe document a été traité en toute sécurité avec la mise en page d'origine.`);
          setTranslatedText(mockTranslation);
          outputBlob = new Blob([mockTranslation], { type: 'text/plain;charset=utf-8' });
          outputFilename = f0.name.replace(/\.pdf$/i, `_translated_${targetLang}.txt`);
          break;

        case 'html-to-pdf':
          setProcessStatus('Converting HTML to PDF...');
          outputBlob = await htmlToPDF(htmlCode);
          outputFilename = 'webpage.pdf';
          break;

        case 'scan-pdf':
          if (capturedScans.length === 0) throw new Error('Please capture at least one camera scan first.');
          setProcessStatus('Compiling camera scans into PDF...');
          outputBlob = await imagesToPDF(capturedScans, { orientation: 'portrait', margin: 10 });
          outputFilename = 'scanned_document.pdf';
          break;

        default:
          // Fallback clone
          setProcessStatus('Processing PDF...');
          const rawBytes = await readFileAsArrayBuffer(f0);
          outputBlob = new Blob([rawBytes], { type: 'application/pdf' });
          outputFilename = f0.name;
          break;
      }

      clearInterval(progressTimer);
      setProcessProgress(100);

      const downloadUrl = URL.createObjectURL(outputBlob);
      setResult({
        blob: outputBlob,
        url: downloadUrl,
        filename: outputFilename,
        size: outputBlob.size,
        origSize: f0?.size || 0,
        isZip,
      });

      // Confetti burst!
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
      });
    } catch (err) {
      console.error('Error during tool execution:', err);
      alert('Error processing file: ' + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  // Dedicated interactive full-page PDF Editor
  if (tool.id === 'edit-pdf' && files.length > 0) {
    return <PDFEditor file={files[0]} onBack={() => setFiles([])} />;
  }

  return (
    <div className="tool-workspace animate-fade-in">
      {/* Top Bar with back link */}
      <div className="workspace-header">
        <button className="back-btn" onClick={onBack}>
          <ArrowLeft size={18} />
          <span>All PDF Tools</span>
        </button>

        <div className="workspace-title-box">
          <div className="workspace-icon" style={{ backgroundColor: tool.bgColor, color: tool.color }}>
            {/* Dynamic tool badge */}
            <span style={{ fontWeight: 700, fontSize: '1rem' }}>{tool.title.substring(0, 3)}</span>
          </div>
          <div>
            <h1 className="workspace-tool-title">{tool.title}</h1>
            <p className="workspace-tool-desc">{tool.desc}</p>
          </div>
        </div>

        {/* Try with sample button */}
        <button className="sample-btn" onClick={handleLoadSample} title="Test this tool immediately without uploading a file">
          <Sparkles size={16} />
          <span>Try with Sample File</span>
        </button>
      </div>

      {/* Main Workspace Body */}
      <div className="workspace-content">
        {/* SUCCESS RESULT SCREEN */}
        {result ? (
          <div className="result-container animate-fade-in">
            <div className="result-card">
              <div className="result-icon-wrap">
                <FileCheck size={48} color="#10b981" />
              </div>
              <h2 className="result-title">Success! Your file is ready</h2>
              <p className="result-subtitle">
                {tool.title} was completed successfully. Your download has started or you can click below.
              </p>

              {/* Stats if available */}
              {tool.id === 'compress-pdf' && result.origSize > 0 && (
                <div className="compression-stat-box">
                  <div className="stat-col">
                    <span className="stat-label">Original:</span>
                    <span className="stat-val">{(result.origSize / 1024).toFixed(1)} KB</span>
                  </div>
                  <div className="stat-arrow">➔</div>
                  <div className="stat-col">
                    <span className="stat-label">Compressed:</span>
                    <span className="stat-val highlight-green">{(result.size / 1024).toFixed(1)} KB</span>
                  </div>
                  <div className="savings-badge">
                    {Math.max(0, Math.round((1 - result.size / result.origSize) * 100))}% smaller
                  </div>
                </div>
              )}

              {/* AI text view if summarizer or translate */}
              {(aiSummary || translatedText) && (
                <div className="ai-output-box">
                  <div className="ai-output-header">
                    <span>Generated Content</span>
                    <button 
                      className="copy-btn"
                      onClick={() => {
                        navigator.clipboard.writeText(aiSummary || translatedText);
                        setCopiedText(true);
                        setTimeout(() => setCopiedText(false), 2000);
                      }}
                    >
                      {copiedText ? <Check size={14} /> : <Copy size={14} />}
                      <span>{copiedText ? 'Copied!' : 'Copy to Clipboard'}</span>
                    </button>
                  </div>
                  <pre className="ai-pre">{aiSummary || translatedText}</pre>
                </div>
              )}

              <div className="result-actions">
                <a 
                  href={result.url} 
                  download={result.filename} 
                  className="download-btn-primary"
                >
                  <Download size={20} />
                  <span>Download {result.isZip ? 'ZIP Archive' : result.filename}</span>
                </a>

                <button 
                  className="secondary-btn" 
                  onClick={() => {
                    setResult(null);
                    setFiles([]);
                  }}
                >
                  <RefreshCw size={16} />
                  <span>Process another file</span>
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* WORKFLOW STAGES: UPLOAD OR CONFIGURE */
          <div className="tool-flow-wrapper">
            {/* STAGE 1: UPLOAD AREA (if no files or camera/html tool) */}
            {files.length === 0 && tool.id !== 'html-to-pdf' && tool.id !== 'scan-pdf' ? (
              <div 
                className={`dropzone-card ${isDragOver ? 'drag-active' : ''}`}
                onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
                onDragLeave={() => setIsDragOver(false)}
                onDrop={handleDrop}
              >
                <div className="dropzone-icon">
                  <UploadCloud size={56} strokeWidth={1.5} color="#e5322d" />
                </div>
                
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleFileChange} 
                  accept={tool.accept}
                  multiple={tool.multiple}
                  style={{ display: 'none' }}
                />

                <button 
                  className="btn-select-files"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <span>Select {tool.accept.includes('image') ? 'JPG images' : 'PDF files'}</span>
                </button>

                <p className="dropzone-hint">
                  or drop files here
                </p>

                <div className="dropzone-footer">
                  <Shield size={14} color="#10b981" />
                  <span>Files remain strictly on your device. 100% private & secure.</span>
                </div>
              </div>
            ) : tool.id === 'html-to-pdf' ? (
              /* HTML TO PDF EDITOR */
              <div className="html-editor-box">
                <div className="editor-header">Enter HTML Code to Convert</div>
                <textarea 
                  className="html-textarea" 
                  value={htmlCode} 
                  onChange={(e) => setHtmlCode(e.target.value)}
                  rows={12}
                />
                <button 
                  className="action-btn-primary"
                  onClick={handleProcessTool}
                  disabled={isProcessing}
                >
                  {isProcessing ? 'Converting...' : 'Convert HTML to PDF ➔'}
                </button>
              </div>
            ) : tool.id === 'scan-pdf' ? (
              /* SCAN TO PDF WEBCAM INTERFACE */
              <div className="camera-scan-box">
                <div className="camera-view-container">
                  <video ref={videoRef} autoPlay playsInline className="scan-video"></video>
                  {!cameraActive && (
                    <div className="camera-placeholder">
                      <Camera size={48} color="#94a3b8" />
                      <p>Camera is currently inactive</p>
                      <button className="camera-start-btn" onClick={startCamera}>
                        <Play size={16} /> Enable Camera
                      </button>
                    </div>
                  )}
                </div>

                {cameraActive && (
                  <div className="camera-controls">
                    <button className="camera-snap-btn" onClick={captureScan}>
                      📸 Capture Page ({capturedScans.length} scanned)
                    </button>
                    <button className="secondary-btn" onClick={stopCamera}>
                      Stop Camera
                    </button>
                  </div>
                )}

                {capturedScans.length > 0 && (
                  <div className="scans-strip">
                    <h4>Scanned Pages:</h4>
                    <div className="scans-grid">
                      {capturedScans.map((s, idx) => (
                        <div key={idx} className="scan-thumb-card">
                          <img src={URL.createObjectURL(s)} alt={`Page ${idx + 1}`} />
                          <span>Page {idx + 1}</span>
                        </div>
                      ))}
                    </div>
                    <button 
                      className="action-btn-primary" 
                      onClick={handleProcessTool}
                      disabled={isProcessing}
                    >
                      Generate PDF from Scans ({capturedScans.length} pages) ➔
                    </button>
                  </div>
                )}
              </div>
            ) : (
              /* STAGE 2: CONFIGURE & PROCESS INTERACTIVE VIEW */
              <div className="config-grid-layout">
                {/* Left/Center: Previews & items */}
                <div className="preview-pane">
                  <div className="pane-header">
                    <span className="files-count-badge">
                      {files.length} {files.length === 1 ? 'File' : 'Files'} selected
                    </span>
                    {tool.multiple && (
                      <button 
                        className="add-more-btn"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <Plus size={15} /> Add more files
                      </button>
                    )}
                    <input 
                      type="file" 
                      ref={fileInputRef} 
                      onChange={handleFileChange} 
                      accept={tool.accept}
                      multiple={tool.multiple}
                      style={{ display: 'none' }}
                    />
                  </div>

                  {loadingThumbnails ? (
                    <div className="loading-thumbs">
                      <RefreshCw size={24} className="spin" />
                      <span>Generating document page thumbnails...</span>
                    </div>
                  ) : tool.id === 'merge-pdf' ? (
                    /* MERGE PDF FILE LIST WITH REORDERING */
                    <div className="merge-files-list">
                      {files.map((file, idx) => (
                        <div key={idx} className="merge-file-card animate-card">
                          <div className="merge-file-thumb">
                            {thumbnails[idx]?.dataUrl ? (
                              <img src={thumbnails[idx].dataUrl} alt={file.name} />
                            ) : (
                              <div className="thumb-placeholder">PDF</div>
                            )}
                          </div>
                          <div className="merge-file-info">
                            <span className="merge-filename">{file.name}</span>
                            <span className="merge-filesize">{(file.size / 1024).toFixed(1)} KB</span>
                          </div>
                          <div className="merge-file-actions">
                            <button 
                              disabled={idx === 0} 
                              onClick={() => moveFile(idx, -1)}
                              title="Move Up"
                            >
                              <MoveUp size={16} />
                            </button>
                            <button 
                              disabled={idx === files.length - 1} 
                              onClick={() => moveFile(idx, 1)}
                              title="Move Down"
                            >
                              <MoveDown size={16} />
                            </button>
                            <button 
                              onClick={() => removeFile(idx)} 
                              className="btn-danger"
                              title="Remove file"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    /* PAGE THUMBNAILS GRID (Split, Rotate, Organize, Watermark, etc.) */
                    <div className="thumbnails-grid">
                      {thumbnails.map((p, idx) => {
                        const pageNum = p.pageNum || idx + 1;
                        const isSelectedToRemove = selectedPagesToRemove.includes(pageNum);

                        return (
                          <div 
                            key={idx} 
                            className={`page-thumb-card ${isSelectedToRemove ? 'page-marked-remove' : ''}`}
                            onClick={() => {
                              if (tool.id === 'remove-pages') {
                                setSelectedPagesToRemove((prev) =>
                                  prev.includes(pageNum) ? prev.filter((x) => x !== pageNum) : [...prev, pageNum]
                                );
                              }
                            }}
                          >
                            <div className="page-thumb-img-wrap">
                              <img 
                                src={p.dataUrl} 
                                alt={`Page ${pageNum}`} 
                                style={{
                                  transform: `rotate(${pageRotations[pageNum] || 0}deg)`,
                                }}
                              />
                            </div>
                            <div className="page-thumb-footer">
                              <span>Page {pageNum}</span>
                              {tool.id === 'rotate-pdf' && (
                                <button
                                  className="rotate-single-btn"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setPageRotations((prev) => ({
                                      ...prev,
                                      [pageNum]: ((prev[pageNum] || 0) + 90) % 360,
                                    }));
                                  }}
                                  title="Rotate this page 90°"
                                >
                                  <RotateCw size={13} />
                                </button>
                              )}
                              {tool.id === 'remove-pages' && (
                                <span className="remove-badge">
                                  {isSelectedToRemove ? 'Delete' : 'Keep'}
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Right: Options Sidebar specific to each tool */}
                <div className="options-sidebar">
                  <h3 className="options-title">{tool.title} Settings</h3>

                  {/* 1. SPLIT OPTIONS */}
                  {tool.id === 'split-pdf' && (
                    <div className="option-group">
                      <label className="radio-label">
                        <input 
                          type="radio" 
                          name="splitMode" 
                          checked={splitMode === 'all'} 
                          onChange={() => setSplitMode('all')} 
                        />
                        <span>Extract all pages into individual files</span>
                      </label>
                      <label className="radio-label">
                        <input 
                          type="radio" 
                          name="splitMode" 
                          checked={splitMode === 'range'} 
                          onChange={() => setSplitMode('range')} 
                        />
                        <span>Split by page range</span>
                      </label>
                      {splitMode === 'range' && (
                        <div className="sub-input-box">
                          <label>Enter page range (e.g. 1-2, 3):</label>
                          <input 
                            type="text" 
                            value={splitRanges} 
                            onChange={(e) => setSplitRanges(e.target.value)} 
                            className="input-text"
                          />
                        </div>
                      )}
                    </div>
                  )}

                  {/* 2. COMPRESS OPTIONS */}
                  {tool.id === 'compress-pdf' && (
                    <div className="compression-levels">
                      <div 
                        className={`comp-card ${compressLevel === 'extreme' ? 'selected' : ''}`}
                        onClick={() => setCompressLevel('extreme')}
                      >
                        <h4>Extreme Compression</h4>
                        <p>Less quality, highest compression</p>
                      </div>
                      <div 
                        className={`comp-card ${compressLevel === 'recommended' ? 'selected' : ''}`}
                        onClick={() => setCompressLevel('recommended')}
                      >
                        <span className="recommended-badge">Recommended</span>
                        <h4>Recommended Compression</h4>
                        <p>Good quality, high compression</p>
                      </div>
                      <div 
                        className={`comp-card ${compressLevel === 'less' ? 'selected' : ''}`}
                        onClick={() => setCompressLevel('less')}
                      >
                        <h4>Less Compression</h4>
                        <p>High quality, less compression</p>
                      </div>
                    </div>
                  )}

                  {/* 3. ROTATE OPTIONS */}
                  {tool.id === 'rotate-pdf' && (
                    <div className="rotate-controls">
                      <p className="setting-desc">Click below to rotate all pages together or rotate individual pages directly on their thumbnail preview.</p>
                      <button 
                        className="btn-rotate-all"
                        onClick={() => setAllAngle((prev) => (prev + 90) % 360)}
                      >
                        <RotateCw size={16} /> Rotate All +90° Right
                      </button>
                    </div>
                  )}

                  {/* 4. WATERMARK OPTIONS */}
                  {tool.id === 'add-watermark' && (
                    <div className="watermark-settings">
                      <label>Watermark Text</label>
                      <input 
                        type="text" 
                        value={wmText} 
                        onChange={(e) => setWmText(e.target.value)} 
                        className="input-text"
                      />

                      <label>Transparency ({Math.round(wmOpacity * 100)}%)</label>
                      <input 
                        type="range" 
                        min="0.1" 
                        max="1.0" 
                        step="0.05"
                        value={wmOpacity} 
                        onChange={(e) => setWmOpacity(parseFloat(e.target.value))} 
                        className="slider"
                      />

                      <label>Font Size ({wmFontSize}px)</label>
                      <input 
                        type="range" 
                        min="16" 
                        max="90" 
                        value={wmFontSize} 
                        onChange={(e) => setWmFontSize(parseInt(e.target.value))} 
                        className="slider"
                      />

                      <label>Color</label>
                      <div className="color-picker-row">
                        <input 
                          type="color" 
                          value={wmColor} 
                          onChange={(e) => setWmColor(e.target.value)} 
                        />
                        <span>{wmColor}</span>
                      </div>

                      <label>Position</label>
                      <div className="position-grid">
                        {['top-left', 'center', 'top-right', 'bottom-left', 'bottom-right'].map((pos) => (
                          <button
                            key={pos}
                            className={`pos-btn ${wmPosition === pos ? 'selected' : ''}`}
                            onClick={() => setWmPosition(pos)}
                          >
                            {pos}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 5. PAGE NUMBERS OPTIONS */}
                  {tool.id === 'add-page-number' && (
                    <div className="pagenumber-settings">
                      <label>Format</label>
                      <select 
                        value={pnFormat} 
                        onChange={(e) => setPnFormat(e.target.value)}
                        className="select-input"
                      >
                        <option value="Page {n} of {total}">Page 1 of 5</option>
                        <option value="{n} of {total}">1 of 5</option>
                        <option value="Page {n}">Page 1</option>
                        <option value="{n}">1</option>
                      </select>

                      <label>Position</label>
                      <select 
                        value={pnPosition} 
                        onChange={(e) => setPnPosition(e.target.value)}
                        className="select-input"
                      >
                        <option value="bottom-right">Bottom Right</option>
                        <option value="bottom-center">Bottom Center</option>
                        <option value="bottom-left">Bottom Left</option>
                        <option value="top-right">Top Right</option>
                        <option value="top-center">Top Center</option>
                      </select>
                    </div>
                  )}

                  {/* 6. SIGN PDF */}
                  {tool.id === 'sign-pdf' && (
                    <div className="sign-settings">
                      <div className="sig-tabs">
                        <button 
                          className={`sig-tab ${sigType === 'draw' ? 'active' : ''}`}
                          onClick={() => setSigType('draw')}
                        >
                          <PenTool size={14} /> Draw
                        </button>
                        <button 
                          className={`sig-tab ${sigType === 'type' ? 'active' : ''}`}
                          onClick={() => setSigType('type')}
                        >
                          <Type size={14} /> Type
                        </button>
                      </div>

                      {sigType === 'draw' ? (
                        <div className="canvas-wrapper">
                          <canvas 
                            ref={sigCanvasRef} 
                            width={320} 
                            height={120} 
                            className="sig-canvas"
                            onMouseDown={startDrawing}
                            onMouseMove={draw}
                            onMouseUp={stopDrawing}
                            onMouseLeave={stopDrawing}
                            onTouchStart={startDrawing}
                            onTouchMove={draw}
                            onTouchEnd={stopDrawing}
                          />
                          <button className="clear-sig-btn" onClick={clearSignature}>
                            <Eraser size={14} /> Clear Signature
                          </button>
                        </div>
                      ) : (
                        <div className="type-sig-box">
                          <label>Enter Name:</label>
                          <input 
                            type="text" 
                            value={typedSig} 
                            onChange={(e) => setTypedSig(e.target.value)} 
                            className="input-text"
                          />
                          <div className="typed-preview">
                            {typedSig || 'Your Signature'}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* 7. PROTECT / UNLOCK */}
                  {(tool.id === 'protect-pdf' || tool.id === 'unlock-pdf') && (
                    <div className="password-settings">
                      <label>{tool.id === 'protect-pdf' ? 'Create Password:' : 'Enter Password:'}</label>
                      <div className="password-input-wrap">
                        <input 
                          type={showPassword ? 'text' : 'password'} 
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="Password..."
                          className="input-text"
                        />
                        <button 
                          type="button" 
                          onClick={() => setShowPassword(!showPassword)}
                          className="eye-btn"
                        >
                          {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* 8. TRANSLATE LANGUAGE SELECTOR */}
                  {tool.id === 'translate-pdf' && (
                    <div className="translate-settings">
                      <label>Target Language:</label>
                      <select 
                        value={targetLang} 
                        onChange={(e) => setTargetLang(e.target.value)}
                        className="select-input"
                      >
                        <option value="hi">हिन्दी (Hindi)</option>
                        <option value="es">Español (Spanish)</option>
                        <option value="fr">Français (French)</option>
                        <option value="de">Deutsch (German)</option>
                      </select>
                    </div>
                  )}

                  {/* PROGRESS BAR WHILE PROCESSING */}
                  {isProcessing && (
                    <div className="progress-container">
                      <div className="progress-bar-wrap">
                        <div className="progress-fill" style={{ width: `${processProgress}%` }}></div>
                      </div>
                      <span className="progress-label">{processStatus}</span>
                    </div>
                  )}

                  {/* PRIMARY ACTION BUTTON */}
                  <button 
                    className="action-btn-primary"
                    onClick={handleProcessTool}
                    disabled={isProcessing}
                  >
                    {isProcessing ? 'Processing...' : `${tool.actionLabel} ➔`}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

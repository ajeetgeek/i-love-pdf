import React, { useState, useEffect, useRef } from 'react';
import { 
  Type, 
  PenTool, 
  Square, 
  Circle,
  Highlighter, 
  Image as ImageIcon, 
  Trash2, 
  ChevronLeft, 
  ChevronRight, 
  Download, 
  ZoomIn, 
  ZoomOut, 
  MousePointer, 
  Sparkles, 
  ArrowRight,
  FileEdit,
  Check,
  Undo2
} from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import confetti from 'canvas-confetti';
import { readFileAsArrayBuffer } from '../utils/pdfEngine';

export default function PDFEditor({ file, onBack }) {
  const [numPages, setNumPages] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageThumbnails, setPageThumbnails] = useState([]);

  // Main Editor Mode: 'edit-text' (Edit existing PDF text directly) vs 'annotate' (Add new elements/drawings)
  const [editorMode, setEditorMode] = useState('edit-text');

  // Active annotation tool when in 'annotate' mode: 'select', 'text', 'draw', 'highlight', 'rect', 'circle'
  const [activeTool, setActiveTool] = useState('select');
  const [selectedElementId, setSelectedElementId] = useState(null);

  // Existing PDF text detected on current page: array of { id, str, pdfX, pdfY, pdfWidth, pdfHeight, vx, vy, width, height, fontSize }
  const [detectedTextItems, setDetectedTextItems] = useState([]);
  
  // Map of user-modified existing text: { [itemId]: { originalText, newText, pdfX, pdfY, pdfWidth, pdfHeight, vx, vy, width, height, fontSize, color } }
  const [editedTextByPage, setEditedTextByPage] = useState({});

  // Active existing text item being edited
  const [activeEditingTextId, setActiveEditingTextId] = useState(null);

  // Styling properties
  const [color, setColor] = useState('#1e293b');
  const [fontSize, setFontSize] = useState(18);
  const [brushSize, setBrushSize] = useState(3);
  const [isBold, setIsBold] = useState(false);

  // Zoom scale
  const [zoom, setZoom] = useState(1.0);

  // Per-page annotations: { [pageNum]: { elements: [], drawingDataUrl: null } }
  const [pageAnnotations, setPageAnnotations] = useState({});
  const [pageDimensions, setPageDimensions] = useState({ width: 650, height: 900 });
  const [pdfNativeDimensions, setPdfNativeDimensions] = useState({ width: 595, height: 842 });
  
  const [isRendering, setIsRendering] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveProgress, setSaveProgress] = useState(0);

  // Canvas refs
  const stageRef = useRef(null);
  const bgCanvasRef = useRef(null);
  const drawCanvasRef = useRef(null);
  const fileInputRef = useRef(null);

  // Drawing state
  const [isDrawing, setIsDrawing] = useState(false);
  const [draggingElementId, setDraggingElementId] = useState(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  const COLOR_PRESETS = ['#1e293b', '#e5322d', '#2563eb', '#16a34a', '#facc15', '#9333ea'];

  // Load PDF and generate page thumbnails
  useEffect(() => {
    let isCancelled = false;

    async function loadPDF() {
      if (!file) return;
      setIsRendering(true);

      try {
        const fileBytes = await readFileAsArrayBuffer(file);
        const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(fileBytes) });
        const pdfDoc = await loadingTask.promise;

        if (isCancelled) return;
        setNumPages(pdfDoc.numPages);

        // Thumbnails for left strip
        const thumbs = [];
        for (let i = 1; i <= pdfDoc.numPages; i++) {
          const p = await pdfDoc.getPage(i);
          const v = p.getViewport({ scale: 0.2 });
          const c = document.createElement('canvas');
          c.width = v.width;
          c.height = v.height;
          await p.render({ canvasContext: c.getContext('2d'), viewport: v }).promise;
          thumbs.push({ pageNum: i, dataUrl: c.toDataURL('image/jpeg', 0.8) });
        }
        if (!isCancelled) setPageThumbnails(thumbs);

        await renderCurrentPage(pdfDoc, currentPage);
      } catch (err) {
        console.error('Error loading PDF in editor:', err);
      } finally {
        if (!isCancelled) setIsRendering(false);
      }
    }

    loadPDF();
    return () => { isCancelled = true; };
  }, [file]);

  // Re-render when page or zoom changes
  useEffect(() => {
    let isCancelled = false;
    async function updatePage() {
      if (!file) return;
      setIsRendering(true);
      try {
        const fileBytes = await readFileAsArrayBuffer(file);
        const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(fileBytes) });
        const pdfDoc = await loadingTask.promise;
        if (!isCancelled) {
          await renderCurrentPage(pdfDoc, currentPage);
        }
      } catch (err) {
        console.error('Error rendering page:', err);
      } finally {
        if (!isCancelled) setIsRendering(false);
      }
    }

    updatePage();
    return () => { isCancelled = true; };
  }, [currentPage, zoom]);

  const renderCurrentPage = async (pdfDoc, pageNum) => {
    const page = await pdfDoc.getPage(pageNum);
    const unscaledViewport = page.getViewport({ scale: 1.0 });
    setPdfNativeDimensions({ width: unscaledViewport.width, height: unscaledViewport.height });

    // Scale calculation
    const baseWidth = 720;
    const baseScale = baseWidth / unscaledViewport.width;
    const effectiveScale = baseScale * zoom;
    const viewport = page.getViewport({ scale: effectiveScale });

    setPageDimensions({ width: viewport.width, height: viewport.height });

    // 1. Render background canvas
    const bgCanvas = bgCanvasRef.current;
    if (bgCanvas) {
      bgCanvas.width = viewport.width;
      bgCanvas.height = viewport.height;
      const ctx = bgCanvas.getContext('2d');
      await page.render({ canvasContext: ctx, viewport }).promise;
    }

    // 2. Extract and parse existing text items from PDF
    const textContent = await page.getTextContent();
    const rawItems = textContent.items || [];
    
    // Group and map raw text items to viewport coordinates
    const extracted = [];
    rawItems.forEach((item, idx) => {
      if (!item.str || item.str.trim() === '') return;

      const tx = item.transform[4];
      const ty = item.transform[5];
      const [vx, vy] = viewport.convertToViewportPoint(tx, ty);

      const fontHeight = Math.hypot(item.transform[2], item.transform[3]);
      const scaledHeight = fontHeight * (viewport.height / unscaledViewport.height);
      const scaledWidth = item.width * (viewport.width / unscaledViewport.width);

      extracted.push({
        id: `page-${pageNum}-text-${idx}`,
        str: item.str,
        pdfX: tx,
        pdfY: ty,
        pdfWidth: item.width,
        pdfHeight: fontHeight,
        vx: Math.max(0, vx),
        vy: Math.max(0, vy - scaledHeight), // baseline to top-left
        width: Math.max(scaledWidth, 18),
        height: Math.max(scaledHeight, 14),
        fontSize: Math.round(scaledHeight * 0.95),
      });
    });

    setDetectedTextItems(extracted);

    // 3. Setup overlay drawing canvas
    const drawCanvas = drawCanvasRef.current;
    if (drawCanvas) {
      drawCanvas.width = viewport.width;
      drawCanvas.height = viewport.height;
      const drawCtx = drawCanvas.getContext('2d');
      drawCtx.clearRect(0, 0, drawCanvas.width, drawCanvas.height);

      const savedData = pageAnnotations[pageNum]?.drawingDataUrl;
      if (savedData) {
        const img = new Image();
        img.onload = () => drawCtx.drawImage(img, 0, 0, viewport.width, viewport.height);
        img.src = savedData;
      }
    }
  };

  // Current page edited text map
  const currentEditedText = editedTextByPage[currentPage] || {};
  const currentElements = pageAnnotations[currentPage]?.elements || [];

  // Handle clicking on existing text in "Edit Existing Text" mode
  const handleSelectExistingText = (item) => {
    setActiveEditingTextId(item.id);
    if (!currentEditedText[item.id]) {
      setEditedTextByPage((prev) => ({
        ...prev,
        [currentPage]: {
          ...prev[currentPage],
          [item.id]: {
            originalText: item.str,
            newText: item.str,
            pdfX: item.pdfX,
            pdfY: item.pdfY,
            pdfWidth: item.pdfWidth,
            pdfHeight: item.pdfHeight,
            vx: item.vx,
            vy: item.vy,
            width: item.width,
            height: item.height,
            fontSize: item.fontSize,
            color: '#1e293b',
          },
        },
      }));
    }
  };

  // Update existing text value
  const handleUpdateExistingText = (itemId, newText) => {
    setEditedTextByPage((prev) => ({
      ...prev,
      [currentPage]: {
        ...prev[currentPage],
        [itemId]: {
          ...prev[currentPage]?.[itemId],
          newText: newText,
        },
      },
    }));
  };

  // Revert/undo an edited text item
  const handleRevertExistingText = (itemId) => {
    setEditedTextByPage((prev) => {
      const pageEdits = { ...(prev[currentPage] || {}) };
      delete pageEdits[itemId];
      return {
        ...prev,
        [currentPage]: pageEdits,
      };
    });
    if (activeEditingTextId === itemId) setActiveEditingTextId(null);
  };

  // Persist freehand drawing
  const persistDrawing = () => {
    if (!drawCanvasRef.current) return;
    const dataUrl = drawCanvasRef.current.toDataURL('image/png');
    setPageAnnotations((prev) => ({
      ...prev,
      [currentPage]: {
        ...prev[currentPage],
        drawingDataUrl: dataUrl,
      },
    }));
  };

  // FREEHAND DRAWING / ANNOTATION
  const handleMouseDownCanvas = (e) => {
    if (editorMode === 'edit-text') return;
    if (activeTool === 'select') {
      setSelectedElementId(null);
      return;
    }

    const canvas = drawCanvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (activeTool === 'text') {
      const newEl = {
        id: Date.now(),
        type: 'text',
        x: Math.max(10, x - 20),
        y: Math.max(10, y - 10),
        width: 180,
        height: 38,
        text: 'New text...',
        color: color,
        fontSize: fontSize,
        isBold: isBold,
      };
      setPageAnnotations((prev) => ({
        ...prev,
        [currentPage]: {
          ...prev[currentPage],
          elements: [...(prev[currentPage]?.elements || []), newEl],
        },
      }));
      setSelectedElementId(newEl.id);
      setActiveTool('select');
      return;
    }

    if (activeTool === 'rect' || activeTool === 'circle') {
      const newEl = {
        id: Date.now(),
        type: activeTool,
        x: Math.max(10, x - 50),
        y: Math.max(10, y - 30),
        width: 120,
        height: 70,
        color: color,
      };
      setPageAnnotations((prev) => ({
        ...prev,
        [currentPage]: {
          ...prev[currentPage],
          elements: [...(prev[currentPage]?.elements || []), newEl],
        },
      }));
      setSelectedElementId(newEl.id);
      setActiveTool('select');
      return;
    }

    if (activeTool === 'draw' || activeTool === 'highlight') {
      setIsDrawing(true);
      const ctx = canvas.getContext('2d');
      ctx.beginPath();
      ctx.moveTo(x, y);

      if (activeTool === 'highlight') {
        ctx.strokeStyle = 'rgba(250, 204, 21, 0.45)';
        ctx.lineWidth = 18;
        ctx.lineCap = 'square';
      } else {
        ctx.strokeStyle = color;
        ctx.lineWidth = brushSize;
        ctx.lineCap = 'round';
      }
    }
  };

  const handleMouseMoveCanvas = (e) => {
    if (!isDrawing || editorMode === 'edit-text') return;
    const canvas = drawCanvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const ctx = canvas.getContext('2d');
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const handleMouseUpCanvas = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    persistDrawing();
  };

  // DRAGGING PLACED ELEMENTS
  const handleStartDrag = (e, el) => {
    e.stopPropagation();
    setSelectedElementId(el.id);
    setDraggingElementId(el.id);
    const rect = e.currentTarget.getBoundingClientRect();
    setDragOffset({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
  };

  const handleStageMouseMove = (e) => {
    if (!draggingElementId || !stageRef.current) return;
    const stageRect = stageRef.current.getBoundingClientRect();
    const newX = e.clientX - stageRect.left - dragOffset.x;
    const newY = e.clientY - stageRect.top - dragOffset.y;

    setPageAnnotations((prev) => {
      const els = (prev[currentPage]?.elements || []).map((item) =>
        item.id === draggingElementId ? { ...item, x: Math.max(0, newX), y: Math.max(0, newY) } : item
      );
      return {
        ...prev,
        [currentPage]: {
          ...prev[currentPage],
          elements: els,
        },
      };
    });
  };

  const handleStageMouseUp = () => {
    setDraggingElementId(null);
  };

  // Add Image Stamp
  const handleImageStamp = (e) => {
    const imgFile = e.target.files?.[0];
    if (!imgFile) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const newEl = {
        id: Date.now(),
        type: 'image',
        x: (pageDimensions.width - 150) / 2,
        y: (pageDimensions.height - 100) / 2,
        width: 150,
        height: 100,
        imgUrl: event.target.result,
      };
      setPageAnnotations((prev) => ({
        ...prev,
        [currentPage]: {
          ...prev[currentPage],
          elements: [...(prev[currentPage]?.elements || []), newEl],
        },
      }));
      setSelectedElementId(newEl.id);
      setActiveTool('select');
    };
    reader.readAsDataURL(imgFile);
  };

  // Clear all additions on current page
  const handleClearPage = () => {
    const drawCanvas = drawCanvasRef.current;
    if (drawCanvas) {
      const ctx = drawCanvas.getContext('2d');
      ctx.clearRect(0, 0, drawCanvas.width, drawCanvas.height);
    }
    setPageAnnotations((prev) => ({
      ...prev,
      [currentPage]: {
        elements: [],
        drawingDataUrl: null,
      },
    }));
    setEditedTextByPage((prev) => ({
      ...prev,
      [currentPage]: {},
    }));
    setSelectedElementId(null);
    setActiveEditingTextId(null);
  };

  // FINALIZE & SAVE EDITED PDF
  const handleSavePDF = async () => {
    setIsSaving(true);
    setSaveProgress(20);

    try {
      const fileBytes = await readFileAsArrayBuffer(file);
      const pdfDoc = await PDFDocument.load(fileBytes);
      const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
      const pages = pdfDoc.getPages();

      setSaveProgress(40);

      for (let i = 0; i < pages.length; i++) {
        const pNum = i + 1;
        const page = pages[i];
        const { width, height } = page.getSize();

        // 1. APPLY EDITED EXISTING TEXT: White-out original text & draw new text
        const pageEditedTexts = editedTextByPage[pNum] || {};
        const editedKeys = Object.keys(pageEditedTexts);

        for (const k of editedKeys) {
          const item = pageEditedTexts[k];
          if (!item || item.newText === undefined) continue;

          // White-out rectangle to completely erase original PDF text
          const coverW = Math.max(item.pdfWidth + 6, 20);
          const coverH = item.pdfHeight + 4;
          const coverX = item.pdfX - 1;
          const coverY = item.pdfY - 2;

          page.drawRectangle({
            x: coverX,
            y: coverY,
            width: coverW,
            height: coverH,
            color: rgb(1, 1, 1), // Clean white background
          });

          // Draw replacement text at exact same coordinates
          page.drawText(item.newText, {
            x: item.pdfX,
            y: item.pdfY,
            size: item.pdfHeight || 12,
            font: fontRegular,
            color: rgb(0.12, 0.16, 0.22),
          });
        }

        // 2. APPLY OVERLAY DRAWINGS
        const annotations = pageAnnotations[pNum];
        if (annotations?.drawingDataUrl) {
          const drawBytes = await fetch(annotations.drawingDataUrl).then((r) => r.arrayBuffer());
          const embeddedDraw = await pdfDoc.embedPng(drawBytes);
          page.drawImage(embeddedDraw, {
            x: 0,
            y: 0,
            width,
            height,
          });
        }

        // 3. APPLY ADDED ELEMENTS (New Text, Shapes, Images)
        if (annotations?.elements && annotations.elements.length > 0) {
          const compCanvas = document.createElement('canvas');
          compCanvas.width = width * 2;
          compCanvas.height = height * 2;
          const compCtx = compCanvas.getContext('2d');
          compCtx.scale(2, 2);

          const scaleX = width / pageDimensions.width;
          const scaleY = height / pageDimensions.height;

          for (const el of annotations.elements) {
            const rx = el.x * scaleX;
            const ry = el.y * scaleY;
            const rw = (el.width || 120) * scaleX;
            const rh = (el.height || 40) * scaleY;

            if (el.type === 'text') {
              compCtx.fillStyle = el.color || '#e5322d';
              const fSize = (el.fontSize || 20) * scaleX;
              compCtx.font = `${el.isBold ? 'bold ' : ''}${fSize}px Arial, sans-serif`;
              compCtx.fillText(el.text, rx + 4, ry + fSize);
            } else if (el.type === 'rect') {
              compCtx.strokeStyle = el.color || '#e5322d';
              compCtx.lineWidth = 3 * scaleX;
              compCtx.strokeRect(rx, ry, rw, rh);
            } else if (el.type === 'circle') {
              compCtx.strokeStyle = el.color || '#e5322d';
              compCtx.lineWidth = 3 * scaleX;
              compCtx.beginPath();
              compCtx.ellipse(rx + rw / 2, ry + rh / 2, rw / 2, rh / 2, 0, 0, 2 * Math.PI);
              compCtx.stroke();
            } else if (el.type === 'image' && el.imgUrl) {
              const imgObj = await new Promise((res) => {
                const im = new Image();
                im.onload = () => res(im);
                im.src = el.imgUrl;
              });
              compCtx.drawImage(imgObj, rx, ry, rw, rh);
            }
          }

          const compDataUrl = compCanvas.toDataURL('image/png');
          const compBytes = await fetch(compDataUrl).then((r) => r.arrayBuffer());
          const embeddedComp = await pdfDoc.embedPng(compBytes);

          page.drawImage(embeddedComp, {
            x: 0,
            y: 0,
            width,
            height,
          });
        }
      }

      setSaveProgress(90);
      const pdfBytes = await pdfDoc.save();
      const outputBlob = new Blob([pdfBytes], { type: 'application/pdf' });
      const downloadUrl = URL.createObjectURL(outputBlob);

      // Trigger instant download
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = file.name.replace(/\.pdf$/i, '_edited.pdf');
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      confetti({
        particleCount: 100,
        spread: 80,
        origin: { y: 0.6 },
      });

      setSaveProgress(100);
    } catch (err) {
      console.error('Save PDF error:', err);
      alert('Error saving PDF: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  // Edited items list for sidebar
  const editedCount = Object.keys(currentEditedText).length;

  return (
    <div 
      className="ilovepdf-editor-container animate-fade-in" 
      onMouseMove={handleStageMouseMove} 
      onMouseUp={handleStageMouseUp}
    >
      {/* 1. TOP FLOATING iLovePDF TOOLBAR */}
      <header className="ilovepdf-top-toolbar">
        <div className="toolbar-left-group">
          <button className="tb-back-btn" onClick={onBack} title="Back to All Tools">
            <ChevronLeft size={18} />
            <span>Back</span>
          </button>
          <span className="tb-filename" title={file.name}>{file.name}</span>
        </div>

        {/* Center Mode Switcher: Edit Existing Text vs Annotate */}
        <div className="toolbar-center-tools">
          <div className="editor-mode-toggle">
            <button
              className={`mode-toggle-btn ${editorMode === 'edit-text' ? 'active' : ''}`}
              onClick={() => {
                setEditorMode('edit-text');
                setActiveTool('select');
              }}
              title="Click on any text in the document to edit it directly!"
            >
              <FileEdit size={16} />
              <span>Edit Existing Text</span>
            </button>

            <button
              className={`mode-toggle-btn ${editorMode === 'annotate' ? 'active' : ''}`}
              onClick={() => setEditorMode('annotate')}
              title="Add new text, shapes, stamps and freehand drawings"
            >
              <PenTool size={16} />
              <span>Annotate</span>
            </button>
          </div>

          <div className="tb-divider" />

          {/* Tools available in Annotate mode */}
          {editorMode === 'annotate' && (
            <>
              <button
                className={`tb-tool-btn ${activeTool === 'select' ? 'active' : ''}`}
                onClick={() => setActiveTool('select')}
                title="Select & Move (Hand)"
              >
                <MousePointer size={18} />
              </button>

              <button
                className={`tb-tool-btn ${activeTool === 'text' ? 'active' : ''}`}
                onClick={() => setActiveTool('text')}
                title="Add New Text"
              >
                <Type size={18} />
              </button>

              <button
                className={`tb-tool-btn ${activeTool === 'draw' ? 'active' : ''}`}
                onClick={() => setActiveTool('draw')}
                title="Freehand Pen"
              >
                <PenTool size={18} />
              </button>

              <button
                className={`tb-tool-btn ${activeTool === 'highlight' ? 'active' : ''}`}
                onClick={() => setActiveTool('highlight')}
                title="Highlighter"
              >
                <Highlighter size={18} />
              </button>

              <button
                className={`tb-tool-btn ${activeTool === 'rect' ? 'active' : ''}`}
                onClick={() => setActiveTool('rect')}
                title="Add Rectangle"
              >
                <Square size={18} />
              </button>

              <button
                className={`tb-tool-btn ${activeTool === 'circle' ? 'active' : ''}`}
                onClick={() => setActiveTool('circle')}
                title="Add Circle"
              >
                <Circle size={18} />
              </button>

              <button
                className="tb-tool-btn"
                onClick={() => fileInputRef.current?.click()}
                title="Add Image Stamp"
              >
                <ImageIcon size={18} />
              </button>
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleImageStamp} 
                accept="image/*" 
                style={{ display: 'none' }} 
              />

              <div className="tb-divider" />

              <div className="tb-colors">
                {COLOR_PRESETS.map((c) => (
                  <button
                    key={c}
                    className={`tb-color-dot ${color === c ? 'active' : ''}`}
                    style={{ backgroundColor: c }}
                    onClick={() => setColor(c)}
                  />
                ))}
              </div>

              <div className="tb-divider" />
            </>
          )}

          {/* Zoom controls */}
          <div className="tb-zoom-group">
            <button 
              disabled={zoom <= 0.6} 
              onClick={() => setZoom((z) => Math.max(0.6, z - 0.15))}
              className="tb-zoom-btn"
              title="Zoom out"
            >
              <ZoomOut size={16} />
            </button>
            <span className="tb-zoom-val">{Math.round(zoom * 100)}%</span>
            <button 
              disabled={zoom >= 2.0} 
              onClick={() => setZoom((z) => Math.min(2.0, z + 0.15))}
              className="tb-zoom-btn"
              title="Zoom in"
            >
              <ZoomIn size={16} />
            </button>
          </div>
        </div>

        {/* Right Action Button */}
        <div className="toolbar-right-group">
          <button 
            className="ilovepdf-btn-save" 
            onClick={handleSavePDF}
            disabled={isSaving}
          >
            <span>{isSaving ? `Processing (${saveProgress}%)...` : 'Edit PDF'}</span>
            <ArrowRight size={18} />
          </button>
        </div>
      </header>

      {/* 2. MAIN WORKSPACE */}
      <div className="ilovepdf-main-workspace">
        {/* LEFT PAGE THUMBNAILS STRIP */}
        <aside className="ilovepdf-left-pages">
          <div className="pages-strip-header">Pages ({numPages})</div>
          <div className="pages-thumbnails-list">
            {pageThumbnails.map((thumb) => (
              <div
                key={thumb.pageNum}
                className={`page-thumb-item ${currentPage === thumb.pageNum ? 'active' : ''}`}
                onClick={() => setCurrentPage(thumb.pageNum)}
              >
                <div className="thumb-wrap">
                  <img src={thumb.dataUrl} alt={`Page ${thumb.pageNum}`} />
                </div>
                <span className="thumb-num">{thumb.pageNum}</span>
              </div>
            ))}
          </div>
        </aside>

        {/* CENTER VIEWPORT & CANVAS STAGE */}
        <main className="ilovepdf-canvas-viewport">
          {isRendering && (
            <div className="editor-loading-badge">
              <Sparkles size={16} className="spin" color="#e5322d" />
              <span>Analyzing Document & Text...</span>
            </div>
          )}

          <div 
            ref={stageRef}
            className="ilovepdf-paper-stage"
            style={{ width: pageDimensions.width, height: pageDimensions.height }}
          >
            {/* 1. Base PDF Canvas */}
            <canvas ref={bgCanvasRef} className="ilovepdf-bg-canvas" />

            {/* 2. OVERLAY LAYER: DETECTED EXISTING PDF TEXT ITEMS */}
            <div className={`detected-text-layer ${editorMode === 'edit-text' ? 'mode-active' : ''}`}>
              {detectedTextItems.map((item) => {
                const isEdited = !!currentEditedText[item.id];
                const isSelected = activeEditingTextId === item.id;
                const displayText = isEdited ? currentEditedText[item.id].newText : item.str;

                return (
                  <div
                    key={item.id}
                    className={`detected-text-box ${isEdited ? 'has-edit' : ''} ${isSelected ? 'selected' : ''}`}
                    style={{
                      left: item.vx,
                      top: item.vy,
                      minWidth: item.width,
                      height: item.height,
                    }}
                    onClick={() => handleSelectExistingText(item)}
                    title="Click to edit this text directly!"
                  >
                    {isEdited ? (
                      /* Solid white cover + editable input to replace original text seamlessly */
                      <input
                        type="text"
                        value={displayText}
                        autoFocus={isSelected}
                        onChange={(e) => handleUpdateExistingText(item.id, e.target.value)}
                        className="existing-text-input"
                        style={{
                          fontSize: `${item.fontSize}px`,
                        }}
                        onClick={(e) => e.stopPropagation()}
                      />
                    ) : (
                      /* Invisible hover hotspot */
                      <span className="text-hotspot-label">{item.str}</span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* 3. Annotation Drawing Overlay Canvas */}
            {editorMode === 'annotate' && (
              <canvas 
                ref={drawCanvasRef}
                className={`ilovepdf-fg-canvas ${activeTool === 'select' ? 'mode-select' : 'mode-draw'}`}
                onMouseDown={handleMouseDownCanvas}
                onMouseMove={handleMouseMoveCanvas}
                onMouseUp={handleMouseUpCanvas}
              />
            )}

            {/* 4. Newly Added Annotation Elements (Text, Shapes, Images) */}
            {currentElements.map((el) => {
              const isSelected = selectedElementId === el.id;

              return (
                <div
                  key={el.id}
                  className={`interactive-el ${isSelected ? 'selected' : ''}`}
                  style={{
                    left: el.x,
                    top: el.y,
                    width: el.type === 'text' ? 'auto' : el.width,
                    height: el.type === 'text' ? 'auto' : el.height,
                  }}
                  onMouseDown={(e) => handleStartDrag(e, el)}
                  onClick={(e) => e.stopPropagation()}
                >
                  {el.type === 'text' && (
                    <input
                      type="text"
                      value={el.text}
                      onChange={(e) => {
                        const val = e.target.value;
                        setPageAnnotations((prev) => {
                          const els = (prev[currentPage]?.elements || []).map((item) =>
                            item.id === el.id ? { ...item, text: val } : item
                          );
                          return {
                            ...prev,
                            [currentPage]: {
                              ...prev[currentPage],
                              elements: els,
                            },
                          };
                        });
                      }}
                      style={{
                        color: el.color,
                        fontSize: `${el.fontSize}px`,
                        fontWeight: el.isBold ? 'bold' : 'normal',
                      }}
                      className="live-text-input"
                    />
                  )}

                  {el.type === 'rect' && (
                    <div 
                      className="shape-rect-box" 
                      style={{ borderColor: el.color, width: '100%', height: '100%' }} 
                    />
                  )}

                  {el.type === 'circle' && (
                    <div 
                      className="shape-circle-box" 
                      style={{ borderColor: el.color, width: '100%', height: '100%' }} 
                    />
                  )}

                  {el.type === 'image' && (
                    <img 
                      src={el.imgUrl} 
                      alt="Stamp" 
                      style={{ width: '100%', height: '100%', objectFit: 'contain' }} 
                    />
                  )}

                  {isSelected && (
                    <button 
                      className="el-delete-handle" 
                      onClick={() => {
                        setPageAnnotations((prev) => {
                          const els = (prev[currentPage]?.elements || []).filter((item) => item.id !== el.id);
                          return {
                            ...prev,
                            [currentPage]: {
                              ...prev[currentPage],
                              elements: els,
                            },
                          };
                        });
                        setSelectedElementId(null);
                      }}
                      title="Delete element"
                    >
                      ✕
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </main>

        {/* RIGHT SIDEBAR */}
        <aside className="ilovepdf-right-sidebar">
          <div className="sidebar-section-title">Edit PDF</div>
          
          {editorMode === 'edit-text' ? (
            <div className="mode-instruction-card">
              <div className="instruction-badge">💡 Direct Text Editing</div>
              <p>Click on <b>any text</b> inside the PDF document (like names, numbers, dates) to edit it directly in place!</p>
            </div>
          ) : (
            <div className="mode-instruction-card">
              <div className="instruction-badge">🎨 Annotation Mode</div>
              <p>Add new text boxes, shapes, stamps, or freehand drawing annotations to your document.</p>
            </div>
          )}

          {/* EDITED EXISTING TEXT SECTION */}
          <div className="elements-manager-box">
            <div className="elements-header">
              <span>Edited Text Items ({editedCount})</span>
              {editedCount > 0 && (
                <button className="clear-all-link" onClick={() => setEditedTextByPage((prev) => ({ ...prev, [currentPage]: {} }))}>
                  Revert all
                </button>
              )}
            </div>

            {editedCount === 0 ? (
              <div className="no-elements-msg">
                Hover over and click any text in the PDF to modify it in place.
              </div>
            ) : (
              <div className="elements-list">
                {Object.keys(currentEditedText).map((k) => {
                  const itm = currentEditedText[k];
                  return (
                    <div key={k} className="edited-text-item-card">
                      <div className="orig-vs-new">
                        <span className="orig-text">Old: "{itm.originalText}"</span>
                        <span className="new-text">New: "{itm.newText}"</span>
                      </div>
                      <button 
                        className="revert-btn" 
                        onClick={() => handleRevertExistingText(k)}
                        title="Revert back to original"
                      >
                        <Undo2 size={13} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Clear page additions button */}
          <button className="clear-page-btn" onClick={handleClearPage}>
            <Trash2 size={15} />
            <span>Clear Page Changes</span>
          </button>

          {/* Bottom Action button */}
          <div className="sidebar-action-footer">
            <button 
              className="ilovepdf-btn-save large" 
              onClick={handleSavePDF}
              disabled={isSaving}
            >
              <span>{isSaving ? `Processing (${saveProgress}%)...` : 'Edit PDF'}</span>
              <ArrowRight size={20} />
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}

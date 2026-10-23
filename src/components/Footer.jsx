import React from 'react';
import { Heart, ShieldCheck, Zap, Lock, Sparkles } from 'lucide-react';

export default function Footer({ onSelectTool }) {
  return (
    <footer className="site-footer">
      {/* Feature highlights bar */}
      <div className="footer-features-bar">
        <div className="footer-feature">
          <ShieldCheck size={20} color="#10b981" />
          <div>
            <strong>100% Client-Side Privacy</strong>
            <p>Your documents are never uploaded to any cloud server.</p>
          </div>
        </div>
        <div className="footer-feature">
          <Zap size={20} color="#f59e0b" />
          <div>
            <strong>Lightning Fast</strong>
            <p>Processes megabytes of PDF instantly on your CPU.</p>
          </div>
        </div>
        <div className="footer-feature">
          <Sparkles size={20} color="#8b5cf6" />
          <div>
            <strong>AI & Smart Tools</strong>
            <p>Summarization, OCR, translation, and automated conversion.</p>
          </div>
        </div>
      </div>

      {/* Footer navigation links */}
      <div className="footer-links-grid">
        <div className="footer-brand-col">
          <div className="footer-brand">
            <span className="brand-i">i</span>
            <Heart size={20} fill="#e5322d" color="#e5322d" />
            <span className="brand-pdf">PDF</span>
            <span className="brand-sub">STUDIO</span>
          </div>
          <p className="footer-tagline">
            The free, easy-to-use, and completely private online PDF suite. All 27 iLovePDF tools at your fingertips.
          </p>
        </div>

        <div className="footer-links-col">
          <span className="footer-col-title">Organize & Optimize</span>
          <button onClick={() => onSelectTool('merge-pdf')}>Merge PDF</button>
          <button onClick={() => onSelectTool('split-pdf')}>Split PDF</button>
          <button onClick={() => onSelectTool('compress-pdf')}>Compress PDF</button>
          <button onClick={() => onSelectTool('organize-pdf')}>Organize PDF</button>
          <button onClick={() => onSelectTool('repair-pdf')}>Repair PDF</button>
        </div>

        <div className="footer-links-col">
          <span className="footer-col-title">Convert</span>
          <button onClick={() => onSelectTool('jpg-to-pdf')}>JPG to PDF</button>
          <button onClick={() => onSelectTool('pdf-to-jpg')}>PDF to JPG</button>
          <button onClick={() => onSelectTool('pdf-to-word')}>PDF to Word</button>
          <button onClick={() => onSelectTool('pdf-to-excel')}>PDF to Excel</button>
          <button onClick={() => onSelectTool('pdf-to-markdown')}>PDF to Markdown</button>
        </div>

        <div className="footer-links-col">
          <span className="footer-col-title">Edit & Security</span>
          <button onClick={() => onSelectTool('edit-pdf')}>Edit PDF</button>
          <button onClick={() => onSelectTool('rotate-pdf')}>Rotate PDF</button>
          <button onClick={() => onSelectTool('sign-pdf')}>Sign PDF</button>
          <button onClick={() => onSelectTool('add-watermark')}>Add Watermark</button>
          <button onClick={() => onSelectTool('protect-pdf')}>Protect PDF</button>
          <button onClick={() => onSelectTool('unlock-pdf')}>Unlock PDF</button>
        </div>
      </div>

      <div className="footer-bottom">
        <p>© 2026 iLovePDF Studio. Crafted for PDF Lovers worldwide.</p>
        <div className="footer-badges">
          <span className="badge-free">100% FREE</span>
          <span className="badge-private">NO SERVER UPLOADS</span>
        </div>
      </div>
    </footer>
  );
}

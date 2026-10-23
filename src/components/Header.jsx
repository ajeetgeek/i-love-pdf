import React, { useState } from 'react';
import { 
  Heart, 
  ChevronDown, 
  Globe, 
  Moon, 
  Sun, 
  Menu, 
  X, 
  Layers, 
  Scissors, 
  Minimize2, 
  FileText, 
  Sparkles,
  ShieldCheck,
  Search
} from 'lucide-react';
import { TOOLS } from '../data/toolsData';

export default function Header({ 
  onSelectTool, 
  onGoHome, 
  currentTool, 
  isDarkMode, 
  setIsDarkMode,
  currentLang,
  setCurrentLang 
}) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [convertDropdownOpen, setConvertDropdownOpen] = useState(false);
  const [allToolsDropdownOpen, setAllToolsDropdownOpen] = useState(false);
  const [langDropdownOpen, setLangDropdownOpen] = useState(false);

  const languages = [
    { code: 'en', name: 'English', flag: '🇺🇸' },
    { code: 'hi', name: 'हिन्दी (Hindi)', flag: '🇮🇳' },
    { code: 'es', name: 'Español', flag: '🇪🇸' },
    { code: 'fr', name: 'Français', flag: '🇫🇷' },
    { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
  ];

  const handleToolClick = (toolId) => {
    onSelectTool(toolId);
    setConvertDropdownOpen(false);
    setAllToolsDropdownOpen(false);
    setMobileMenuOpen(false);
  };

  return (
    <header className="site-header">
      <div className="header-inner">
        {/* Brand Logo */}
        <div className="brand" onClick={onGoHome} role="button" tabIndex={0}>
          <div className="brand-logo-wrap">
            <span className="brand-i">i</span>
            <Heart className="brand-heart" size={24} fill="#e5322d" color="#e5322d" />
            <span className="brand-pdf">PDF</span>
          </div>
          <span className="brand-sub">STUDIO</span>
        </div>

        {/* Desktop Nav */}
        <nav className="desktop-nav">
          <button 
            className={`nav-link ${currentTool?.id === 'merge-pdf' ? 'active' : ''}`}
            onClick={() => handleToolClick('merge-pdf')}
          >
            Merge PDF
          </button>
          
          <button 
            className={`nav-link ${currentTool?.id === 'split-pdf' ? 'active' : ''}`}
            onClick={() => handleToolClick('split-pdf')}
          >
            Split PDF
          </button>

          <button 
            className={`nav-link ${currentTool?.id === 'compress-pdf' ? 'active' : ''}`}
            onClick={() => handleToolClick('compress-pdf')}
          >
            Compress PDF
          </button>

          {/* Convert PDF Dropdown */}
          <div className="dropdown-wrapper">
            <button 
              className="nav-link dropdown-toggle"
              onClick={() => {
                setConvertDropdownOpen(!convertDropdownOpen);
                setAllToolsDropdownOpen(false);
              }}
            >
              Convert PDF <ChevronDown size={14} className={`chevron ${convertDropdownOpen ? 'open' : ''}`} />
            </button>

            {convertDropdownOpen && (
              <div className="dropdown-menu convert-dropdown animate-fade-in">
                <div className="dropdown-col">
                  <div className="dropdown-header">CONVERT TO PDF</div>
                  <button onClick={() => handleToolClick('jpg-to-pdf')} className="dropdown-item">
                    <span className="icon-badge yellow">JPG</span> JPG to PDF
                  </button>
                  <button onClick={() => handleToolClick('word-to-pdf')} className="dropdown-item">
                    <span className="icon-badge blue">DOC</span> Word to PDF
                  </button>
                  <button onClick={() => handleToolClick('excel-to-pdf')} className="dropdown-item">
                    <span className="icon-badge green">XLS</span> Excel to PDF
                  </button>
                  <button onClick={() => handleToolClick('html-to-pdf')} className="dropdown-item">
                    <span className="icon-badge yellow">HTML</span> HTML to PDF
                  </button>
                </div>
                <div className="dropdown-col divider-left">
                  <div className="dropdown-header">CONVERT FROM PDF</div>
                  <button onClick={() => handleToolClick('pdf-to-jpg')} className="dropdown-item">
                    <span className="icon-badge yellow">IMG</span> PDF to JPG
                  </button>
                  <button onClick={() => handleToolClick('pdf-to-word')} className="dropdown-item">
                    <span className="icon-badge blue">DOC</span> PDF to Word
                  </button>
                  <button onClick={() => handleToolClick('pdf-to-excel')} className="dropdown-item">
                    <span className="icon-badge green">XLS</span> PDF to Excel
                  </button>
                  <button onClick={() => handleToolClick('pdf-to-markdown')} className="dropdown-item">
                    <span className="icon-badge purple">MD</span> PDF to Markdown
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* All PDF Tools Mega Dropdown */}
          <div className="dropdown-wrapper">
            <button 
              className="nav-link dropdown-toggle primary-nav-btn"
              onClick={() => {
                setAllToolsDropdownOpen(!allToolsDropdownOpen);
                setConvertDropdownOpen(false);
              }}
            >
              All PDF tools <ChevronDown size={14} className={`chevron ${allToolsDropdownOpen ? 'open' : ''}`} />
            </button>

            {allToolsDropdownOpen && (
              <div className="dropdown-menu mega-dropdown animate-fade-in">
                <div className="mega-col">
                  <div className="mega-title">Organize PDF</div>
                  <button onClick={() => handleToolClick('merge-pdf')}>Merge PDF</button>
                  <button onClick={() => handleToolClick('split-pdf')}>Split PDF</button>
                  <button onClick={() => handleToolClick('remove-pages')}>Remove pages</button>
                  <button onClick={() => handleToolClick('organize-pdf')}>Organize PDF</button>
                  <button onClick={() => handleToolClick('scan-pdf')}>Scan to PDF</button>
                </div>
                <div className="mega-col">
                  <div className="mega-title">Optimize PDF</div>
                  <button onClick={() => handleToolClick('compress-pdf')}>Compress PDF</button>
                  <button onClick={() => handleToolClick('repair-pdf')}>Repair PDF</button>
                  <button onClick={() => handleToolClick('ocr-pdf')}>OCR PDF</button>
                </div>
                <div className="mega-col">
                  <div className="mega-title">Edit PDF</div>
                  <button onClick={() => handleToolClick('rotate-pdf')}>Rotate PDF</button>
                  <button onClick={() => handleToolClick('add-page-number')}>Page numbers</button>
                  <button onClick={() => handleToolClick('add-watermark')}>Add watermark</button>
                  <button onClick={() => handleToolClick('crop-pdf')}>Crop PDF</button>
                  <button onClick={() => handleToolClick('edit-pdf')}>Edit PDF</button>
                </div>
                <div className="mega-col">
                  <div className="mega-title">Security & AI</div>
                  <button onClick={() => handleToolClick('unlock-pdf')}>Unlock PDF</button>
                  <button onClick={() => handleToolClick('protect-pdf')}>Protect PDF</button>
                  <button onClick={() => handleToolClick('sign-pdf')}>Sign PDF</button>
                  <button onClick={() => handleToolClick('redact-pdf')}>Redact PDF</button>
                  <button onClick={() => handleToolClick('pdf-summarize')} className="highlight-ai">
                    <Sparkles size={13} /> AI Summarizer
                  </button>
                  <button onClick={() => handleToolClick('translate-pdf')} className="highlight-ai">
                    <Globe size={13} /> Translate PDF
                  </button>
                </div>
              </div>
            )}
          </div>
        </nav>

        {/* Right Actions */}
        <div className="header-actions">
          {/* Privacy badge */}
          <div className="privacy-pill hide-mobile" title="100% Client-side processing. Your files never leave your device!">
            <ShieldCheck size={15} color="#10b981" />
            <span>100% Private</span>
          </div>

          {/* Language Switcher */}
          <div className="dropdown-wrapper">
            <button 
              className="lang-btn"
              onClick={() => setLangDropdownOpen(!langDropdownOpen)}
              title="Select Language"
            >
              <Globe size={16} />
              <span className="lang-code">{currentLang.toUpperCase()}</span>
            </button>
            {langDropdownOpen && (
              <div className="dropdown-menu lang-dropdown animate-fade-in">
                {languages.map((l) => (
                  <button
                    key={l.code}
                    className={`dropdown-item ${currentLang === l.code ? 'selected' : ''}`}
                    onClick={() => {
                      setCurrentLang(l.code);
                      setLangDropdownOpen(false);
                    }}
                  >
                    <span>{l.flag}</span>
                    <span>{l.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Dark Mode Toggle */}
          <button 
            className="theme-btn" 
            onClick={() => setIsDarkMode(!isDarkMode)}
            title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          >
            {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
          </button>

          {/* Mobile Menu Button */}
          <button 
            className="mobile-menu-btn" 
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="mobile-drawer animate-fade-in">
          <div className="mobile-drawer-inner">
            <div className="mobile-group-title">Popular Tools</div>
            <div className="mobile-tools-grid">
              <button onClick={() => handleToolClick('merge-pdf')}>Merge PDF</button>
              <button onClick={() => handleToolClick('split-pdf')}>Split PDF</button>
              <button onClick={() => handleToolClick('compress-pdf')}>Compress PDF</button>
              <button onClick={() => handleToolClick('pdf-to-word')}>PDF to Word</button>
              <button onClick={() => handleToolClick('jpg-to-pdf')}>JPG to PDF</button>
              <button onClick={() => handleToolClick('edit-pdf')}>Edit PDF</button>
              <button onClick={() => handleToolClick('sign-pdf')}>Sign PDF</button>
              <button onClick={() => handleToolClick('add-watermark')}>Watermark</button>
              <button onClick={() => handleToolClick('pdf-summarize')}>AI Summarizer</button>
            </div>
            <div className="mobile-group-title" style={{ marginTop: '1rem' }}>All Categories</div>
            <button className="mobile-all-btn" onClick={onGoHome}>
              Browse All 27 PDF Tools
            </button>
          </div>
        </div>
      )}
    </header>
  );
}

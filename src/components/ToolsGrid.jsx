import React from 'react';
import {
  Layers,
  Scissors,
  FileMinus,
  LayoutGrid,
  Camera,
  Minimize2,
  Wrench,
  ScanText,
  Image,
  FileText,
  Table,
  Presentation,
  Code,
  FileImage,
  FileSpreadsheet,
  Hash,
  Edit3,
  RotateCw,
  Stamp,
  ListOrdered,
  Crop,
  PenTool,
  Lock,
  Unlock,
  EyeOff,
  Columns,
  Sparkles,
  Languages,
  ArrowRight
} from 'lucide-react';

const ICON_MAP = {
  Layers,
  Scissors,
  FileMinus,
  LayoutGrid,
  Camera,
  Minimize2,
  Wrench,
  ScanText,
  Image,
  FileText,
  Table,
  Presentation,
  Code,
  FileImage,
  FileSpreadsheet,
  Hash,
  Edit3,
  RotateCw,
  Stamp,
  ListOrdered,
  Crop,
  PenTool,
  Lock,
  Unlock,
  EyeOff,
  Columns,
  Sparkles,
  Languages,
};

export default function ToolsGrid({ tools, onSelectTool, searchQuery }) {
  if (tools.length === 0) {
    return (
      <div className="empty-state">
        <p className="empty-title">No tools found matching "{searchQuery}"</p>
        <p className="empty-desc">Try searching for "merge", "compress", "sign", or "convert".</p>
      </div>
    );
  }

  return (
    <section className="tools-grid-section">
      <div className="tools-grid">
        {tools.map((tool) => {
          const IconComponent = ICON_MAP[tool.icon] || FileText;

          return (
            <div 
              key={tool.id} 
              className="tool-card animate-card"
              onClick={() => onSelectTool(tool.id)}
              role="button"
              tabIndex={0}
            >
              {tool.badge && (
                <span className={`tool-badge badge-${tool.badge.toLowerCase().replace(/[^a-z]/g, '')}`}>
                  {tool.badge}
                </span>
              )}

              <div 
                className="tool-icon-wrapper" 
                style={{ backgroundColor: tool.bgColor, color: tool.color }}
              >
                <IconComponent size={30} strokeWidth={2.2} />
              </div>

              <h3 className="tool-card-title">{tool.title}</h3>
              <p className="tool-card-desc">{tool.desc}</p>

              <div className="tool-card-footer">
                <span className="tool-action-hint">Use tool</span>
                <ArrowRight size={15} className="arrow-icon" style={{ color: tool.color }} />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

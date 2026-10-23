import React from 'react';
import { Search, Sparkles } from 'lucide-react';
import { CATEGORIES } from '../data/toolsData';

export default function Hero({ 
  searchQuery, 
  setSearchQuery, 
  activeCategory, 
  setActiveCategory,
  totalToolsCount
}) {
  return (
    <section className="hero-section">
      <div className="hero-bg-pattern"></div>
      <div className="hero-content">
        <h1 className="hero-title">
          Every tool you need to work with <span className="highlight-red">PDFs</span> in one place
        </h1>
        <p className="hero-subtitle">
          Every tool you need to use PDFs, at your fingertips. All are 100% FREE, easy to use, and run entirely in your browser with bank-grade local privacy!
        </p>

        {/* Search Bar */}
        <div className="search-bar-wrap">
          <div className="search-bar">
            <Search size={20} className="search-icon" />
            <input 
              type="text" 
              placeholder="Search PDF tools (e.g. merge, compress, watermark, sign, convert, ocr)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="search-input"
            />
            {searchQuery && (
              <button 
                className="search-clear-btn" 
                onClick={() => setSearchQuery('')}
                title="Clear search"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Category Pills Filter */}
        <div className="category-filters">
          {CATEGORIES.map((cat) => {
            const isActive = activeCategory === cat.id;
            const isIntelligence = cat.id === 'intelligence';
            return (
              <button
                key={cat.id}
                className={`category-pill ${isActive ? 'active' : ''} ${isIntelligence ? 'pill-ai' : ''}`}
                onClick={() => setActiveCategory(cat.id)}
              >
                {isIntelligence && <Sparkles size={13} className="sparkle-icon" />}
                {cat.label}
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}

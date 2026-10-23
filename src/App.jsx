import React, { useState, useEffect, useMemo } from 'react';
import Header from './components/Header';
import Hero from './components/Hero';
import ToolsGrid from './components/ToolsGrid';
import ToolWorkspace from './components/ToolWorkspace';
import Footer from './components/Footer';
import { TOOLS } from './data/toolsData';

export default function App() {
  const [activeToolId, setActiveToolId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [isDarkMode, setIsDarkMode] = useState(() => {
    return localStorage.getItem('theme') === 'dark';
  });
  const [currentLang, setCurrentLang] = useState('en');

  // Sync theme to root class & localStorage
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDarkMode]);

  // Handle URL hash changes
  useEffect(() => {
    const handleHash = () => {
      const hash = window.location.hash.replace('#', '');
      if (hash && TOOLS.some((t) => t.id === hash)) {
        setActiveToolId(hash);
      } else if (!hash) {
        setActiveToolId(null);
      }
    };

    handleHash();
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, []);

  const handleSelectTool = (toolId) => {
    setActiveToolId(toolId);
    window.location.hash = toolId;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleGoHome = () => {
    setActiveToolId(null);
    window.location.hash = '';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const currentTool = useMemo(() => {
    return TOOLS.find((t) => t.id === activeToolId);
  }, [activeToolId]);

  // Filter tools by category and search query
  const filteredTools = useMemo(() => {
    return TOOLS.filter((tool) => {
      const matchesCategory =
        activeCategory === 'all' || tool.category === activeCategory;
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        tool.title.toLowerCase().includes(q) ||
        tool.desc.toLowerCase().includes(q) ||
        tool.id.toLowerCase().includes(q);
      return matchesCategory && matchesSearch;
    });
  }, [activeCategory, searchQuery]);

  return (
    <div className={`app-container ${isDarkMode ? 'dark-theme' : 'light-theme'}`}>
      <Header
        onSelectTool={handleSelectTool}
        onGoHome={handleGoHome}
        currentTool={currentTool}
        isDarkMode={isDarkMode}
        setIsDarkMode={setIsDarkMode}
        currentLang={currentLang}
        setCurrentLang={setCurrentLang}
      />

      <main className="main-content">
        {currentTool ? (
          <ToolWorkspace 
            tool={currentTool} 
            onBack={handleGoHome}
            onSelectTool={handleSelectTool}
          />
        ) : (
          <>
            <Hero
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              activeCategory={activeCategory}
              setActiveCategory={setActiveCategory}
              totalToolsCount={TOOLS.length}
            />

            <ToolsGrid
              tools={filteredTools}
              onSelectTool={handleSelectTool}
              searchQuery={searchQuery}
            />
          </>
        )}
      </main>

      <Footer onSelectTool={handleSelectTool} />
    </div>
  );
}

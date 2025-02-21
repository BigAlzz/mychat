import React, { useEffect, useState } from 'react';
import ChatPanel from './components/ChatPanel';
import SettingsPanel from './components/SettingsPanel';
import './App.css';

const STORAGE_KEY = 'lastUsedModel';

function App() {
  const [selectedModel, setSelectedModel] = useState(() => {
    // Initialize from localStorage if available
    return localStorage.getItem(STORAGE_KEY) || '';
  });
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Save model selection to localStorage whenever it changes
  useEffect(() => {
    if (selectedModel) {
      localStorage.setItem(STORAGE_KEY, selectedModel);
    }
  }, [selectedModel]);

  return (
    <div className="app">
      <div className="app-container">
        <ChatPanel 
          selectedModel={selectedModel}
        />
        <SettingsPanel
          selectedModel={selectedModel}
          onModelSelect={setSelectedModel}
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
        />
        <button 
          className="settings-toggle"
          onClick={() => setIsSettingsOpen(!isSettingsOpen)}
          aria-label="Toggle Settings"
          title="Toggle Settings"
        >
          ⚙️
        </button>
      </div>
    </div>
  );
}

export default App;

import React, { useState, useEffect } from 'react';
import { getAvailableModels, testModelAvailability, Model } from '../services/llmService';
import { loadSearchConfig, saveSearchConfig, SearchConfig } from '../services/localSearchService';
import { getServerUrl, setServerUrl, resetServerUrl } from '../services/serverConfig';
import './SettingsPanel.css';

interface SettingsPanelProps {
  onModelSelect: (modelId: string) => void;
  selectedModel: string;
  isOpen: boolean;
  onClose: () => void;
}

function SettingsPanel({ onModelSelect, selectedModel, isOpen, onClose }: SettingsPanelProps) {
  const [models, setModels] = useState<Model[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchPaths, setSearchPaths] = useState<string[]>([]);
  const [fileTypes, setFileTypes] = useState<string[]>([]);
  const [newSearchPath, setNewSearchPath] = useState('');
  const [newFileType, setNewFileType] = useState('');
  const [loadingModelId, setLoadingModelId] = useState<string | null>(null);
  const [serverUrl, setServerUrlState] = useState(getServerUrl());

  const loadModels = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const availableModels = await getAvailableModels();
      setModels(availableModels);

      // If we have a selectedModel from localStorage but it's not in the list,
      // clear it to avoid using an invalid model
      if (selectedModel && !availableModels.some(model => model.id === selectedModel)) {
        onModelSelect('');
      }
    } catch (error) {
      setError('Failed to load models. Please check if LM Studio is running.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadModels();
      // Load search paths and file types
      const config = loadSearchConfig();
      setSearchPaths(config.searchPaths);
      setFileTypes(config.fileTypes);
    }
  }, [isOpen, selectedModel, onModelSelect]);

  const handleModelSelect = async (modelId: string) => {
    try {
      setLoadingModelId(modelId);
      setError(null);

      // First, verify the model exists in the list
      const modelExists = models.some(model => model.id === modelId);
      if (!modelExists) {
        setError('Selected model is not available in LM Studio');
        return;
      }

      // Send a test request to trigger model loading
      const isAvailable = await testModelAvailability(modelId);
      if (!isAvailable) {
        setError('Failed to load the model. Please check LM Studio.');
        return;
      }

      // Update the selected model
      onModelSelect(modelId);
    } catch (error) {
      setError('Failed to verify model availability. Please check if LM Studio is running.');
      console.error('Error selecting model:', error);
    } finally {
      setLoadingModelId(null);
    }
  };

  const saveConfig = (paths: string[], types: string[]) => {
    const config: SearchConfig = {
      searchPaths: paths,
      fileTypes: types
    };
    saveSearchConfig(config);
  };

  const handleAddSearchPath = () => {
    if (newSearchPath && !searchPaths.includes(newSearchPath)) {
      const updatedPaths = [...searchPaths, newSearchPath];
      setSearchPaths(updatedPaths);
      setNewSearchPath('');
      saveConfig(updatedPaths, fileTypes);
    }
  };

  const handleRemoveSearchPath = (path: string) => {
    const updatedPaths = searchPaths.filter(p => p !== path);
    setSearchPaths(updatedPaths);
    saveConfig(updatedPaths, fileTypes);
  };

  const handleAddFileType = () => {
    if (newFileType && !fileTypes.includes(newFileType)) {
      const updatedTypes = [...fileTypes, newFileType];
      setFileTypes(updatedTypes);
      setNewFileType('');
      saveConfig(searchPaths, updatedTypes);
    }
  };

  const handleRemoveFileType = (type: string) => {
    const updatedTypes = fileTypes.filter(t => t !== type);
    setFileTypes(updatedTypes);
    saveConfig(searchPaths, updatedTypes);
  };

  const handleKeyPress = (e: React.KeyboardEvent, type: 'path' | 'filetype') => {
    if (e.key === 'Enter') {
      if (type === 'path') {
        handleAddSearchPath();
      } else {
        handleAddFileType();
      }
    }
  };

  const handleServerUrlChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newUrl = event.target.value;
    setServerUrlState(newUrl);
    setServerUrl(newUrl);
    // Reload models when URL changes
    loadModels();
  };

  const handleResetUrl = () => {
    resetServerUrl();
    setServerUrlState(getServerUrl());
    // Reload models when URL resets
    loadModels();
  };

  if (!isOpen) return null;

  return (
    <div className={`settings-panel ${isOpen ? 'open' : ''}`}>
      <div className="settings-content">
        <button className="close-button" onClick={onClose}>×</button>
        <h2>Settings</h2>

        <div className="settings-section">
          <h3>LM Studio Server</h3>
          <div className="server-settings">
            <input
              type="text"
              value={serverUrl}
              onChange={handleServerUrlChange}
              placeholder="Enter LM Studio server URL"
              className="server-url-input"
            />
            <button onClick={handleResetUrl} className="reset-button">
              Reset to Default
            </button>
          </div>
        </div>

        <div className="settings-section">
          <h3>Model Selection</h3>
          {isLoading && <div className="loading">Loading models...</div>}
          {error && <div className="error">{error}</div>}
          <div className="models-list">
            {models.map(model => (
              <div 
                key={model.id}
                className={`model-item ${model.id === selectedModel ? 'selected' : ''} ${loadingModelId === model.id ? 'loading' : ''}`}
                onClick={() => handleModelSelect(model.id)}
              >
                <div className="model-name">{model.id}</div>
                {loadingModelId === model.id ? (
                  <span className="loading-indicator">Loading...</span>
                ) : model.id === selectedModel ? (
                  <span className="selected-indicator">✓</span>
                ) : null}
              </div>
            ))}
            {!isLoading && models.length === 0 && !error && (
              <div className="no-models">
                No models found. Please load a model in LM Studio first.
              </div>
            )}
          </div>
          <button 
            className="refresh-button"
            onClick={() => loadModels()}
            disabled={isLoading}
          >
            Refresh Models
          </button>
        </div>

        <div className="settings-section">
          <h3>Search Paths</h3>
          <div className="search-paths">
            <div className="search-path-input">
              <input
                type="text"
                value={newSearchPath}
                onChange={(e) => setNewSearchPath(e.target.value)}
                onKeyPress={(e) => handleKeyPress(e, 'path')}
                placeholder="Enter path to search..."
              />
              <button onClick={handleAddSearchPath}>Add Path</button>
            </div>
            {searchPaths.length > 0 && (
              <ul className="search-paths-list">
                {searchPaths.map((path, index) => (
                  <li key={index}>
                    {path}
                    <button onClick={() => handleRemoveSearchPath(path)}>Remove</button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="settings-section">
          <h3>File Types</h3>
          <div className="search-paths">
            <div className="search-path-input">
              <input
                type="text"
                value={newFileType}
                onChange={(e) => setNewFileType(e.target.value)}
                onKeyPress={(e) => handleKeyPress(e, 'filetype')}
                placeholder="Enter file type (e.g., .txt, .md)..."
              />
              <button onClick={handleAddFileType}>Add Type</button>
            </div>
            {fileTypes.length > 0 && (
              <ul className="search-paths-list">
                {fileTypes.map((type, index) => (
                  <li key={index}>
                    {type}
                    <button onClick={() => handleRemoveFileType(type)}>Remove</button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default SettingsPanel;

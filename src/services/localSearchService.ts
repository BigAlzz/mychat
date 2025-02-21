// Default configuration
const DEFAULT_CONFIG: SearchConfig = {
  searchPaths: [],
  fileTypes: [
    '.txt', '.doc', '.docx', '.xls', '.xlsx', '.pdf', '.csv', 
    '.rtf', '.odt', '.ods', '.md', '.json', '.xml', '.html',
    '.htm', '', // Include files without extension
  ]
};

// Use the same port as the server
const API_BASE_URL = 'http://localhost:3001/api';

export interface LocalSearchResult {
  filePath: string;
  fileName: string;
  fileType: string;
  snippet: string;
  lastModified: Date;
}

export interface SearchConfig {
  searchPaths: string[];
  fileTypes: string[];
}

// Load search configuration from localStorage
export const loadSearchConfig = (): SearchConfig => {
  try {
    const savedConfig = localStorage.getItem('localSearchConfig');
    if (savedConfig) {
      const parsedConfig = JSON.parse(savedConfig);
      return {
        searchPaths: parsedConfig.searchPaths || DEFAULT_CONFIG.searchPaths,
        fileTypes: parsedConfig.fileTypes || DEFAULT_CONFIG.fileTypes
      };
    }
  } catch (error) {
    console.error('Error loading search config:', error);
  }
  return { ...DEFAULT_CONFIG };
};

// Save search configuration to localStorage
export const saveSearchConfig = (config: SearchConfig): void => {
  try {
    localStorage.setItem('localSearchConfig', JSON.stringify(config));
  } catch (error) {
    console.error('Error saving search config:', error);
  }
};

// Helper function to check if server is running
const checkServerStatus = async (): Promise<boolean> => {
  try {
    const response = await fetch(`${API_BASE_URL}/validate-path`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ path: '.' }),
    });
    return response.ok;
  } catch (error) {
    return false;
  }
};

// Validate a path using the backend API
export const validatePath = async (path: string): Promise<boolean> => {
  try {
    console.log('Validating path:', path);

    // Check if server is running
    if (!await checkServerStatus()) {
      throw new Error('Search server is not running. Please start the server first.');
    }

    const response = await fetch(`${API_BASE_URL}/validate-path`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ path }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: 'Invalid server response' }));
      console.error('Path validation failed:', errorData);
      throw new Error(errorData.message || 'Failed to validate path');
    }

    const data = await response.json();
    console.log('Path validation result:', data);
    return data.isValid;
  } catch (error) {
    console.error('Error validating path:', error);
    if (error instanceof Error) {
      throw error;
    }
    return false;
  }
};

// Search local documents using the backend API
export const searchLocalDocuments = async (
  query: string,
  config: SearchConfig
): Promise<LocalSearchResult[]> => {
  console.log('Starting local document search:', { query, config });

  if (!config.searchPaths.length) {
    throw new Error('No search paths configured. Please add search paths in settings.');
  }

  if (!config.fileTypes.length) {
    throw new Error('No file types selected. Please select at least one file type in settings.');
  }

  try {
    // Check if server is running
    if (!await checkServerStatus()) {
      throw new Error('Search server is not running. Please start the server first.');
    }

    console.log('Sending search request to server');
    const response = await fetch(`${API_BASE_URL}/search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query,
        searchPaths: config.searchPaths,
        fileTypes: config.fileTypes,
      }),
    });

    if (!response.ok) {
      let errorMessage = 'Failed to search documents';
      try {
        const errorData = await response.json();
        errorMessage = errorData.message || errorMessage;
      } catch (e) {
        console.error('Failed to parse error response:', e);
      }
      throw new Error(errorMessage);
    }

    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      throw new Error('Invalid response from server (not JSON)');
    }

    const data = await response.json();
    console.log('Search response:', data);

    if (!data.results || !Array.isArray(data.results)) {
      console.error('Invalid response format:', data);
      throw new Error('Invalid response format from server');
    }

    return data.results.map((result: any) => ({
      ...result,
      lastModified: new Date(result.lastModified),
    }));
  } catch (error) {
    console.error('Error searching documents:', error);
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Failed to search local documents. Please try again.');
  }
};

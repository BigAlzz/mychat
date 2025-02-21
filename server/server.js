const express = require('express');
const cors = require('cors');
const fs = require('fs');
const fsPromises = require('fs').promises;
const path = require('path');
const { glob } = require('glob');
const http = require('http');

const app = express();
const port = process.env.PORT || 3001;

// Check if port is in use
function isPortInUse(port) {
  return new Promise((resolve) => {
    const server = http.createServer();
    server.once('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        resolve(true);
      }
    });
    server.once('listening', () => {
      server.close();
      resolve(false);
    });
    server.listen(port);
  });
}

// Enable detailed logging
const logRequest = (req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  if (req.method === 'POST') {
    console.log('Request body:', req.body);
  }
  next();
};

// Configure CORS
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:3001'],
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type']
}));

app.use(logRequest);
app.use(express.json());

// Handle root path
app.get('/', (req, res) => {
  res.json({ status: 'Server is running' });
});

// Handle favicon request
app.get('/favicon.ico', (req, res) => {
  res.status(204).end(); // No content response for favicon
});

// Check if build directory exists
const buildPath = path.join(__dirname, '../build');
if (!fs.existsSync(buildPath)) {
  console.log('Build directory not found. Server will only handle API requests.');
}

// Serve static files from the React app build directory if it exists
if (fs.existsSync(buildPath)) {
  app.use(express.static(buildPath));
}

// Validate path exists and is accessible
async function validatePath(pathToCheck) {
  try {
    console.log(`Validating path: ${pathToCheck}`);
    await fsPromises.access(pathToCheck);
    const stats = await fsPromises.stat(pathToCheck);
    const isDir = stats.isDirectory();
    console.log(`Path ${pathToCheck} is ${isDir ? 'valid' : 'not a'} directory`);
    return isDir;
  } catch (error) {
    console.error(`Error validating path ${pathToCheck}:`, error.message);
    return false;
  }
}

// Search files in given paths
app.post('/api/search', async (req, res) => {
  console.log('Received search request');
  try {
    const { query, searchPaths, fileTypes } = req.body;

    if (!query || !searchPaths || !fileTypes || !Array.isArray(searchPaths) || !Array.isArray(fileTypes)) {
      console.error('Invalid request parameters:', { query, searchPaths, fileTypes });
      return res.status(400).json({ 
        error: 'Invalid request parameters',
        details: {
          queryPresent: !!query,
          searchPathsValid: Array.isArray(searchPaths),
          fileTypesValid: Array.isArray(fileTypes)
        }
      });
    }

    console.log(`Searching for "${query}" in paths:`, searchPaths);
    console.log('File types:', fileTypes);

    const results = [];
    const validationResults = {};

    // First validate all paths
    for (const searchPath of searchPaths) {
      validationResults[searchPath] = await validatePath(searchPath);
    }

    // Process search terms
    const searchTerms = query.toLowerCase().split(' ').filter(term => term.length > 1);
    
    // Search in each valid path
    for (const searchPath of searchPaths) {
      if (!validationResults[searchPath]) {
        console.log(`Skipping invalid path: ${searchPath}`);
        continue;
      }

      const pattern = `${searchPath}/**/*`;
      console.log(`Searching in pattern: ${pattern}`);
      
      try {
        const files = await glob(pattern, {
          ignore: ['**/node_modules/**', '**/.*/**'],
          nodir: true,
          absolute: true
        });
        
        console.log(`Found ${files.length} files in ${searchPath}`);
        
        for (const file of files) {
          try {
            const fileName = path.basename(file);
            const fileNameLower = fileName.toLowerCase();
            const fileType = path.extname(file).toLowerCase();
            
            // Check if file extension is in the allowed list or if we accept all extensions
            if (!fileTypes.includes(fileType) && !fileTypes.includes('')) {
              continue;
            }

            // First check if the filename matches
            const fileNameMatch = searchTerms.some(term => fileNameLower.includes(term));
            let contentMatch = false;
            let contentMatchDetails = [];
            let contentLower = '';

            try {
              const content = await fsPromises.readFile(file, 'utf-8');
              contentLower = content.toLowerCase();
              
              // Check for exact matches and partial matches in content
              contentMatchDetails = searchTerms.map(term => {
                const matches = contentLower.match(new RegExp(term, 'g'));
                return {
                  term,
                  count: matches ? matches.length : 0,
                  found: matches !== null
                };
              });

              contentMatch = contentMatchDetails.some(detail => detail.found);
            } catch (error) {
              console.log(`Note: Could not read file content for ${file}. Will only check filename.`);
            }

            // Calculate relevance score based on filename and content matches
            const relevanceScore = contentMatchDetails.reduce((score, detail) => {
              return score + (detail.count * (detail.term.length / query.length));
            }, 0) + (fileNameMatch ? 1 : 0);

            if (fileNameMatch || contentMatch) {
              // Extract a relevant snippet around the matches
              let snippet = '';
              if (contentMatch && contentLower) {
                const firstMatchIndex = searchTerms.reduce((index, term) => {
                  const termIndex = contentLower.indexOf(term);
                  return termIndex !== -1 && (index === -1 || termIndex < index) ? termIndex : index;
                }, -1);

                if (firstMatchIndex !== -1) {
                  const start = Math.max(0, firstMatchIndex - 100);
                  const end = Math.min(contentLower.length, firstMatchIndex + 200);
                  snippet = contentLower.slice(start, end).replace(/\\n/g, ' ').trim();
                }
              }

              const stats = await fsPromises.stat(file);
              
              results.push({
                filePath: file,
                fileName,
                fileType,
                snippet: snippet || `File name match: ${fileName}`,
                lastModified: stats.mtime,
                relevanceScore,
                matchType: fileNameMatch ? (contentMatch ? 'filename and content' : 'filename only') : 'content only'
              });
            }
          } catch (error) {
            console.error(`Error processing file ${file}:`, error.message);
          }
        }
      } catch (error) {
        console.error(`Error searching in path ${searchPath}:`, error.message);
      }
    }

    // Sort results by relevance score
    results.sort((a, b) => b.relevanceScore - a.relevanceScore);

    res.json({
      results,
      searchPaths: Object.keys(validationResults).filter(path => validationResults[path])
    });
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// Validate path endpoint
app.post('/api/validate-path', async (req, res) => {
  console.log('Received path validation request');
  try {
    const { path: pathToValidate } = req.body;
    console.log(`Validating path: ${pathToValidate}`);
    const isValid = await validatePath(pathToValidate);
    console.log(`Path ${pathToValidate} validation result: ${isValid}`);
    res.setHeader('Content-Type', 'application/json');
    res.json({ isValid });
  } catch (error) {
    console.error('Path validation error:', error.message);
    res.status(500).json({ 
      error: 'Error validating path',
      message: error.message 
    });
  }
});

// Handle React routing, return all requests to React app
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../build', 'index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    error: 'Internal Server Error',
    message: err.message
  });
});

// Start server with better error handling
async function startServer() {
  try {
    // Check if port is already in use
    const portInUse = await isPortInUse(port);
    if (portInUse) {
      console.error(`Error: Port ${port} is already in use`);
      console.error('Please either:');
      console.error('1. Close the application using that port');
      console.error('2. Or change the port number in server.js');
      process.exit(1);
    }

    // Start the server
    app.listen(port, () => {
      console.log('=================================');
      console.log(`Server is running!`);
      console.log(`Local: http://localhost:${port}`);
      console.log('=================================');
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();

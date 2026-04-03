// index.js
require('dotenv').config();
const express = require('express');
const { validateCode, validateLanguage } = require('./security');
const { execute } = require('./executor');
const executionQueue = require('./queue');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 4000;

// Taaki sirf tumhara server.js hi call kar sake
const SECRET_KEY = process.env.SECRET_KEY || null;

function checkSecret(req, res, next) {
  if (!SECRET_KEY) return next();
  const key = req.headers['x-secret-key'];
  if (key !== SECRET_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

// Health check
app.get('/health', (req, res) => {
  const status = executionQueue.getStatus();
  res.json({
    status: 'ok',
    queue: status,
    timestamp: new Date().toISOString()
  });
});

// Main execute route
app.post('/execute', checkSecret, async (req, res) => {
  const { language, code, stdin } = req.body;

  if (!language || !code) {
    return res.status(400).json({
      error: 'language aur code dono required hain'
    });
  }

  const langCheck = validateLanguage(language);
  if (!langCheck.valid) {
    return res.status(400).json({ error: langCheck.reason });
  }

  const codeCheck = validateCode(code, language);
  if (!codeCheck.valid) {
    return res.status(400).json({ error: codeCheck.reason });
  }

  try {
    const result = await executionQueue.add(() =>
      execute(language, code, stdin || '')
    );

    return res.json({
      output: result.output || '',
      error: result.error || null,
      success: result.success
    });

  } catch (err) {
    return res.status(503).json({
      error: err.message || 'Execution failed',
      success: false
    });
  }
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Code Executor running on port ${PORT}`);
});
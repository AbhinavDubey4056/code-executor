// security.js

const MAX_CODE_SIZE = 10000; // 10KB max code
const MAX_OUTPUT_SIZE = 50000; // 50KB max output

// ── BANNED PATTERNS ──
const BANNED = {
  // Common to all languages
  universal: [
    'rm -rf',
    'mkfs',
    'dd if',
    ':(){ :|:& };:',  // fork bomb bash
    '/etc/passwd',
    '/etc/shadow',
    'chmod 777',
    'wget ',
    'curl ',
    'nc ',             // netcat
    'ncat ',
  ],

  python: [
    'os.system',
    'os.popen',
    'subprocess',
    'shutil.rmtree',
    '__import__',
    'open(',           // file access
    'eval(',
    'exec(',
    'importlib',
    'pty',
    'socket',
    'requests',
    'urllib',
  ],

  javascript: [
    'process.exit',
    'require(',        // fs, child_process etc block
    'child_process',
    'fs.',
    'net.',
    'http.',
    'https.',
    'fetch(',
    'eval(',
    'Function(',
    'WebSocket',
    'XMLHttpRequest',
  ],

  c: [
    'system(',
    'popen(',
    'fork(',
    'exec(',
    'remove(',
    'unlink(',
    'rmdir(',
    'fopen(',          // file access
    '#include <sys/socket', // network
    'socket(',
  ]
};

// ── ALLOWED IMPORTS (Python whitelist) ──
const PYTHON_ALLOWED_IMPORTS = [
  'math',
  'random',
  'collections',
  'itertools',
  'functools',
  'string',
  're',
  'sys',
  'heapq',
  'bisect',
  'queue',
  'copy',
  'time',
  'datetime',
  'json',
  'struct',
  'decimal',
  'fractions',
];

// ── MAIN VALIDATION FUNCTION ──
function validateCode(code, language) {

  // 1. Code size check
  if (!code || code.trim().length === 0) {
    return { valid: false, reason: "Code is empty" };
  }

  if (code.length > MAX_CODE_SIZE) {
    return { 
      valid: false, 
      reason: `Code too large. Max ${MAX_CODE_SIZE / 1000}KB allowed` 
    };
  }

  // 2. Universal banned patterns check
  for (const pattern of BANNED.universal) {
    if (code.includes(pattern)) {
      return { 
        valid: false, 
        reason: `Banned operation detected: "${pattern}"` 
      };
    }
  }

  // 3. Language specific checks
  const langBanned = BANNED[language] || [];
  for (const pattern of langBanned) {
    if (code.includes(pattern)) {
      return { 
        valid: false, 
        reason: `Banned operation detected: "${pattern}"` 
      };
    }
  }

  // 4. Python import whitelist check
  if (language === 'python') {
    const importMatches = code.match(/^\s*import\s+(\w+)/gm) || [];
    const fromMatches = code.match(/^\s*from\s+(\w+)/gm) || [];

    const allImports = [
      ...importMatches.map(m => m.trim().split(/\s+/)[1]),
      ...fromMatches.map(m => m.trim().split(/\s+/)[1]),
    ];

    for (const imp of allImports) {
      if (!PYTHON_ALLOWED_IMPORTS.includes(imp)) {
        return { 
          valid: false, 
          reason: `Import not allowed: "${imp}". Allowed: ${PYTHON_ALLOWED_IMPORTS.join(', ')}` 
        };
      }
    }
  }

  // 5. Infinite loop basic detection
  // Agar code mein sirf while True: ya for(;;) hai aur kuch nahi
  if (language === 'python' && /while\s+True\s*:/i.test(code)) {
    // Allow karo agar break bhi hai
    if (!code.includes('break') && !code.includes('return')) {
      return { 
        valid: false, 
        reason: "Potential infinite loop detected" 
      };
    }
  }

  if (language === 'javascript' && /while\s*\(\s*true\s*\)/i.test(code)) {
    if (!code.includes('break') && !code.includes('return')) {
      return { 
        valid: false, 
        reason: "Potential infinite loop detected" 
      };
    }
  }

  if (language === 'c' && /for\s*\(\s*;\s*;\s*\)/.test(code)) {
    if (!code.includes('break') && !code.includes('return')) {
      return { 
        valid: false, 
        reason: "Potential infinite loop detected" 
      };
    }
  }

  return { valid: true };
}

// ── OUTPUT SANITIZER ──
function sanitizeOutput(output) {
  if (!output) return "";

  // Output size limit
  if (output.length > MAX_OUTPUT_SIZE) {
    return output.substring(0, MAX_OUTPUT_SIZE) + "\n... [Output truncated]";
  }

  return output;
}

// ── LANGUAGE CHECK ──
function validateLanguage(language) {
  const supported = ['python', 'javascript', 'c'];
  if (!supported.includes(language)) {
    return { 
      valid: false, 
      reason: `Language "${language}" not supported. Supported: ${supported.join(', ')}` 
    };
  }
  return { valid: true };
}

module.exports = { 
  validateCode, 
  sanitizeOutput, 
  validateLanguage,
  MAX_OUTPUT_SIZE 
};
// executor.js

const { execSync, exec } = require('child_process');
const vm = require('vm');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { sanitizeOutput } = require('./security');

const EXECUTION_TIMEOUT = 5000;  // 5 seconds
const TEMP_DIR = '/tmp';

// ── JAVASCRIPT EXECUTOR ──
async function runJavaScript(code, stdin) {
  return new Promise((resolve) => {
    let output = '';
    let errorOutput = '';

    try {
      const sandbox = {
        console: {
          log: (...args) => {
            output += args.map(a =>
              typeof a === 'object' ? JSON.stringify(a) : String(a)
            ).join(' ') + '\n';
          },
          error: (...args) => {
            errorOutput += args.join(' ') + '\n';
          },
          warn: (...args) => {
            output += args.join(' ') + '\n';
          }
        },
        Math,
        JSON,
        Array,
        Object,
        String,
        Number,
        Boolean,
        parseInt,
        parseFloat,
        isNaN,
        isFinite,
        Map,
        Set,
        Date,
        __stdin: stdin ? stdin.split('\n') : [],
      };

      const stdinHelper = `
        const __lines = __stdin;
        let __index = 0;
        function input() {
          if (__index < __lines.length) {
            return __lines[__index++].trim();
          }
          return '';
        }
      `;

      const fullCode = stdinHelper + '\n' + code;
      const script = new vm.Script(fullCode);
      const context = vm.createContext(sandbox);
      script.runInContext(context, { timeout: EXECUTION_TIMEOUT });

      resolve({
        output: sanitizeOutput(output),
        error: errorOutput || null,
        success: true
      });

    } catch (err) {
      if (err.code === 'ERR_SCRIPT_EXECUTION_TIMEOUT') {
        resolve({
          output: '',
          error: 'Time Limit Exceeded (5 seconds)',
          success: false
        });
      } else {
        resolve({
          output: output || '',
          error: err.message,
          success: false
        });
      }
    }
  });
}

// ── PYTHON EXECUTOR ──
async function runPython(code, stdin) {
  return new Promise((resolve) => {
    const fileId = uuidv4();
    const filePath = path.join(TEMP_DIR, `${fileId}.py`);

    try {
      fs.writeFileSync(filePath, code);

      const childProc = exec(
        `python3 ${filePath}`,
        {
          timeout: EXECUTION_TIMEOUT,
          maxBuffer: 1024 * 1024,
          env: {
            PATH: process.env.PATH,
            PYTHONDONTWRITEBYTECODE: '1',
            PYTHONUNBUFFERED: '1',
          }
        },
        (error, stdout, stderr) => {
          try { fs.unlinkSync(filePath); } catch {}

          if (error) {
            if (error.killed || error.signal === 'SIGTERM') {
              resolve({
                output: '',
                error: 'Time Limit Exceeded (5 seconds)',
                success: false
              });
              return;
            }

            resolve({
              output: stdout || '',
              error: stderr || error.message,
              success: false
            });
            return;
          }

          resolve({
            output: sanitizeOutput(stdout),
            error: stderr || null,
            success: true
          });
        }
      );

      // EPIPE fix
      try {
        if (stdin && stdin.trim().length > 0) {
          childProc.stdin.write(stdin + '\n');
        }
        childProc.stdin.end();
      } catch (stdinErr) {}

      childProc.stdin.on('error', () => {});

    } catch (err) {
      try { fs.unlinkSync(filePath); } catch {}

      resolve({
        output: '',
        error: err.message,
        success: false
      });
    }
  });
}

// ── C EXECUTOR ──
async function runC(code, stdin) {
  return new Promise((resolve) => {
    const fileId = uuidv4();
    const sourcePath = path.join(TEMP_DIR, `${fileId}.c`);
    const binaryPath = path.join(TEMP_DIR, `${fileId}.out`);

    try {
      fs.writeFileSync(sourcePath, code);

      // Compile karo
      try {
        execSync(
          `gcc ${sourcePath} -o ${binaryPath} -lm`,
          { timeout: 10000 }
        );
      } catch (compileErr) {
        try { fs.unlinkSync(sourcePath); } catch {}
        try { fs.unlinkSync(binaryPath); } catch {}

        resolve({
          output: '',
          error: compileErr.stderr?.toString() || 'Compilation failed',
          success: false
        });
        return;
      }

      // Run karo
      const childProc = exec(
        binaryPath,
        {
          timeout: EXECUTION_TIMEOUT,
          maxBuffer: 1024 * 1024,
        },
        (error, stdout, stderr) => {
          try { fs.unlinkSync(sourcePath); } catch {}
          try { fs.unlinkSync(binaryPath); } catch {}

          if (error) {
            if (error.killed || error.signal === 'SIGTERM') {
              resolve({
                output: '',
                error: 'Time Limit Exceeded (5 seconds)',
                success: false
              });
              return;
            }

            resolve({
              output: stdout || '',
              error: stderr || error.message,
              success: false
            });
            return;
          }

          resolve({
            output: sanitizeOutput(stdout),
            error: stderr || null,
            success: true
          });
        }
      );

      if (stdin) {
        childProc.stdin.write(stdin);
      }
      childProc.stdin.end();

    } catch (err) {
      try { fs.unlinkSync(sourcePath); } catch {}
      try { fs.unlinkSync(binaryPath); } catch {}

      resolve({
        output: '',
        error: err.message,
        success: false
      });
    }
  });
}

// ── MAIN FUNCTION ──
async function execute(language, code, stdin) {
  switch (language) {
    case 'javascript':
      return runJavaScript(code, stdin);
    case 'python':
      return runPython(code, stdin);
    case 'c':
      return runC(code, stdin);
    default:
      return {
        output: '',
        error: `Language "${language}" not supported`,
        success: false
      };
  }
}

module.exports = { execute };
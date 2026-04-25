const path = require('path');
const { spawn } = require('child_process');

class PythonBridgeRunner {
  constructor(options = {}) {
    this.pythonPath = options.pythonPath || process.env.PYTHON_PATH || 'python';
    this.scriptPath =
      options.scriptPath || path.join(__dirname, 'python_bridge_service.py');
    this.timeoutMs = options.timeoutMs || 30000;
  }

  invoke(payload) {
    return new Promise((resolve) => {
      const child = spawn(this.pythonPath, [this.scriptPath], {
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      let stdout = '';
      let stderr = '';
      let settled = false;

      const finish = (result) => {
        if (settled) return;
        settled = true;
        resolve(result);
      };

      const timer = setTimeout(() => {
        child.kill();
        finish({
          success: false,
          status: 'TIMEOUT',
          error: `Python bridge timed out after ${this.timeoutMs}ms`,
          stderr: stderr.trim() || null,
        });
      }, this.timeoutMs);

      child.stdout.on('data', (chunk) => {
        stdout += chunk.toString();
      });

      child.stderr.on('data', (chunk) => {
        stderr += chunk.toString();
      });

      child.on('error', (error) => {
        clearTimeout(timer);
        finish({
          success: false,
          status: 'PROCESS_ERROR',
          error: error.message,
          stderr: stderr.trim() || null,
        });
      });

      child.on('close', (code) => {
        clearTimeout(timer);

        const trimmed = stdout.trim();
        if (!trimmed) {
          finish({
            success: false,
            status: code === 0 ? 'EMPTY_RESPONSE' : 'PROCESS_EXIT',
            error: stderr.trim() || `Python bridge exited with code ${code}`,
            stderr: stderr.trim() || null,
          });
          return;
        }

        try {
          const parsed = JSON.parse(trimmed);
          if (stderr.trim() && !parsed.stderr) {
            parsed.stderr = stderr.trim();
          }
          finish(parsed);
        } catch (error) {
          finish({
            success: false,
            status: 'INVALID_RESPONSE',
            error: `Could not parse Python bridge response: ${error.message}`,
            stdout: trimmed,
            stderr: stderr.trim() || null,
          });
        }
      });

      child.stdin.write(JSON.stringify(payload));
      child.stdin.end();
    });
  }
}

module.exports = { PythonBridgeRunner };

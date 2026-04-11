import { spawn } from 'child_process';
import { writeFile, unlink, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';

const TIMEOUT_MS = 10000;

async function runProcess(cmd, args, stdin, cwd) {
  return new Promise((resolve) => {
    const proc = spawn(cmd, args, { cwd, stdio: ['pipe', 'pipe', 'pipe'] });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', d => { stdout += d.toString(); });
    proc.stderr.on('data', d => { stderr += d.toString(); });

    if (stdin) {
      proc.stdin.write(stdin);
      proc.stdin.end();
    } else {
      proc.stdin.end();
    }

    const timer = setTimeout(() => {
      proc.kill();
      resolve({ stdout, stderr: stderr + '\nTime limit exceeded (10s)', exitCode: 1 });
    }, TIMEOUT_MS);

    proc.on('close', (code) => {
      clearTimeout(timer);
      resolve({ stdout, stderr, exitCode: code ?? 0 });
    });

    proc.on('error', (err) => {
      clearTimeout(timer);
      resolve({ stdout: '', stderr: err.message, exitCode: 1 });
    });
  });
}

export async function runLocally(language, code, stdin) {
  const id  = randomUUID();
  const dir = join(tmpdir(), `testforge_${id}`);
  await mkdir(dir, { recursive: true });

  try {
    if (language === 'python') {
      const file = join(dir, 'main.py');
      await writeFile(file, code);
      return await runProcess('python', [file], stdin, dir);
    }

    if (language === 'cpp' || language === 'c') {
      const ext    = language === 'cpp' ? 'cpp' : 'c';
      const src    = join(dir, `main.${ext}`);
      const out    = join(dir, 'main.exe');
      const compiler = language === 'cpp' ? 'g++' : 'gcc';
      await writeFile(src, code);

      // Compile
      const compile = await runProcess(compiler, [src, '-o', out, '-std=c++17'], '', dir);
      if (compile.exitCode !== 0) {
        return { stdout: '', stderr: compile.stderr, exitCode: 1 };
      }

      // Run
      return await runProcess(out, [], stdin, dir);
    }

    if (language === 'java') {
      const src = join(dir, 'Main.java');
      await writeFile(src, code);
      const compile = await runProcess('javac', [src], '', dir);
      if (compile.exitCode !== 0) {
        return { stdout: '', stderr: compile.stderr, exitCode: 1 };
      }
      return await runProcess('java', ['-cp', dir, 'Main'], stdin, dir);
    }

    return { stdout: '', stderr: `Unsupported language: ${language}`, exitCode: 1 };
  } finally {
    // Cleanup temp files
    try {
      const { rm } = await import('node:fs/promises');
      await rm(dir, { recursive: true, force: true });
    } catch {}
  }
}

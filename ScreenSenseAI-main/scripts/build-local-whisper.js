const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const platformDir = process.platform === 'win32'
  ? 'win'
  : process.platform === 'darwin'
    ? 'mac'
    : 'linux';
const exeName = process.platform === 'win32'
  ? 'local-whisper-server.exe'
  : 'local-whisper-server';
const outputDir = path.join(root, 'local-whisper-bin', platformDir);
const configuredPython = process.env.PYTHON
  ? [{ cmd: process.env.PYTHON, args: [] }]
  : [];
const pythonCandidates = configuredPython.concat(process.platform === 'win32'
  ? [
      { cmd: 'py', args: ['-3.13'] },
      { cmd: 'py', args: ['-3'] },
      { cmd: 'python', args: [] }
    ]
  : [
      { cmd: 'python3', args: [] },
      { cmd: 'python', args: [] }
    ]);

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: root,
    stdio: 'inherit',
    shell: false,
    ...options
  });
  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}

function findPython() {
  for (const candidate of pythonCandidates) {
    const result = spawnSync(candidate.cmd, [...candidate.args, '--version'], {
      cwd: root,
      stdio: 'ignore',
      shell: false
    });
    if (result.status === 0) return candidate;
  }
  console.error('Python was not found. Install Python 3.13 and make sure it is available on PATH.');
  process.exit(1);
}

fs.mkdirSync(outputDir, { recursive: true });
const python = findPython();

run(python.cmd, [...python.args, '-m', 'pip', 'install', '--upgrade', 'pip']);
run(python.cmd, [...python.args, '-m', 'pip', 'install', '-r', 'requirements-local-whisper.txt', 'pyinstaller']);
run(python.cmd, [
  ...python.args,
  '-m',
  'PyInstaller',
  '--clean',
  '--onefile',
  '--name',
  'local-whisper-server',
  '--distpath',
  outputDir,
  '--workpath',
  path.join(root, '.tmp', 'pyinstaller-work'),
  '--specpath',
  path.join(root, '.tmp', 'pyinstaller-spec'),
  '--collect-all',
  'faster_whisper',
  '--collect-all',
  'ctranslate2',
  '--collect-all',
  'imageio_ffmpeg',
  'local_whisper_server.py'
]);

const builtPath = path.join(outputDir, exeName);
if (!fs.existsSync(builtPath)) {
  console.error(`Expected bundled server was not created: ${builtPath}`);
  process.exit(1);
}

if (process.platform !== 'win32') {
  fs.chmodSync(builtPath, 0o755);
}

console.log(`Bundled local Whisper server ready: ${builtPath}`);

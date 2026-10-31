const fs = require('fs');
const path = require('path');

function getPlatformDir(platformName) {
  if (platformName === 'darwin') return 'mac';
  if (platformName === 'win32') return 'win';
  return 'linux';
}

function getExecutableName(platformName) {
  return platformName === 'win32'
    ? 'local-whisper-server.exe'
    : 'local-whisper-server';
}

exports.default = async function verifyPackagedWhisper(context) {
  const platformName = context.electronPlatformName || process.platform;
  const platformDir = getPlatformDir(platformName);
  const executableName = getExecutableName(platformName);
  const productName = context.packager.appInfo.productFilename;

  const candidates = [
    path.join(context.appOutDir, 'resources', 'local-whisper-bin', platformDir, executableName),
    path.join(context.appOutDir, productName + '.app', 'Contents', 'Resources', 'local-whisper-bin', platformDir, executableName)
  ];

  const bundledServerPath = candidates.find((candidate) => fs.existsSync(candidate));
  if (!bundledServerPath) {
    throw new Error(
      'Packaged local Whisper server is missing. Expected one of:\n' + candidates.join('\n') + '\n' +
      'Run npm run build:whisper before packaging, then rebuild the installer.'
    );
  }

  const stat = fs.statSync(bundledServerPath);
  if (!stat.isFile() || stat.size === 0) {
    throw new Error('Packaged local Whisper server is invalid: ' + bundledServerPath);
  }

  console.log('Verified packaged local Whisper server: ' + bundledServerPath);
};

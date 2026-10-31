import os
import platform
import shutil
import subprocess
import sys

ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
SCRIPT_PATH = os.path.join(ROOT_DIR, 'local_whisper_server.py')
BUILD_DIR = os.path.join(ROOT_DIR, 'build', 'local-whisper')
DIST_DIR = BUILD_DIR
NAME = 'local_whisper_server'

if not os.path.exists(SCRIPT_PATH):
    raise FileNotFoundError(f'Could not find {SCRIPT_PATH}')

if os.path.exists(BUILD_DIR):
    shutil.rmtree(BUILD_DIR)

os.makedirs(BUILD_DIR, exist_ok=True)

print('Building local Whisper server executable...')
print(f'  Python: {sys.executable}')
print(f'  Script: {SCRIPT_PATH}')
print(f'  Output dir: {DIST_DIR}')

args = [
    sys.executable,
    '-m',
    'PyInstaller',
    '--clean',
    '--onefile',
    '--noconsole',
    '--name',
    NAME,
    '--distpath',
    DIST_DIR,
    '--workpath',
    os.path.join(BUILD_DIR, 'build'),
    '--specpath',
    os.path.join(BUILD_DIR, 'spec'),
    SCRIPT_PATH,
    '--collect-all',
    'imageio_ffmpeg',
    '--collect-all',
    'faster_whisper',
    '--collect-submodules',
    'flask'
]

try:
    result = subprocess.run(args, check=True, capture_output=True, text=True)
    print('PyInstaller output:')
    print(result.stdout)
    if result.stderr:
        print('PyInstaller stderr:')
        print(result.stderr)
except subprocess.CalledProcessError as e:
    print(f'PyInstaller failed with code {e.returncode}')
    print('stdout:', e.stdout)
    print('stderr:', e.stderr)
    raise

output_name = NAME + ('.exe' if platform.system() == 'Windows' else '')
output_path = os.path.join(DIST_DIR, output_name)
print(f'Looking for executable at: {output_path}')
print(f'Files in {DIST_DIR}:')
for f in os.listdir(DIST_DIR):
    print(f'  - {f}')

if not os.path.exists(output_path):
    raise FileNotFoundError(f'Expected built executable at {output_path}')

final_path = os.path.join(ROOT_DIR, output_name)
print(f'Copying from {output_path} to {final_path}')
shutil.copy2(output_path, final_path)
print(f'Built bundled local Whisper server at {final_path}')
print(f'Final executable size: {os.path.getsize(final_path)} bytes')

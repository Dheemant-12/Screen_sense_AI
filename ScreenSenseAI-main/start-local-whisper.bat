@echo off
setlocal
cd /d "%~dp0"

set "PYTHON_CMD=python"
py -3.13 --version >nul 2>nul
if not errorlevel 1 (
  set "PYTHON_CMD=py -3.13"
) else (
  where python >nul 2>nul
  if errorlevel 1 (
    echo Python was not found on PATH.
    echo Install Python 3.13 from https://www.python.org/downloads/windows/
    echo During install, tick "Add python.exe to PATH".
    pause
    exit /b 1
  )
)

%PYTHON_CMD% --version
if errorlevel 1 (
  echo Python did not start correctly.
  echo If Windows opened Microsoft Store, disable the Python app execution aliases
  echo in Settings ^> Apps ^> Advanced app settings ^> App execution aliases.
  pause
  exit /b 1
)

%PYTHON_CMD% -m pip install -r requirements-local-whisper.txt
if errorlevel 1 (
  echo Failed to install local Whisper requirements.
  pause
  exit /b 1
)

%PYTHON_CMD% local_whisper_server.py
pause

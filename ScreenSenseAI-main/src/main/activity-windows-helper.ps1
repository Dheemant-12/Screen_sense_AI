$ErrorActionPreference = 'Stop'

Add-Type @"
using System;
using System.Text;
using System.Runtime.InteropServices;
public class ScreenSenseWin32 {
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr hWnd);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern int GetWindowText(IntPtr hWnd, StringBuilder lpString, int nMaxCount);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);
  [DllImport("user32.dll")] public static extern bool IsIconic(IntPtr hWnd);
}
"@

function Get-ScreenSenseForeground {
  $hwnd = [ScreenSenseWin32]::GetForegroundWindow()
  $sb = New-Object System.Text.StringBuilder 512
  [void][ScreenSenseWin32]::GetWindowText($hwnd, $sb, 512)
  $pid = 0
  [void][ScreenSenseWin32]::GetWindowThreadProcessId($hwnd, [ref]$pid)
  $app = ''
  if ($pid -gt 0) {
    $p = Get-Process -Id $pid -ErrorAction SilentlyContinue
    if ($p) { $app = $p.ProcessName }
  }
  [pscustomobject]@{ app = $app; title = $sb.ToString() } | ConvertTo-Json -Compress
}

function Get-ScreenSenseRunning {
  $items = Get-Process |
    Where-Object {
      $_.MainWindowHandle -ne 0 -and
      $_.MainWindowTitle -and
      [ScreenSenseWin32]::IsWindowVisible($_.MainWindowHandle) -and
      -not [ScreenSenseWin32]::IsIconic($_.MainWindowHandle)
    } |
    Select-Object ProcessName, MainWindowTitle
  if (-not $items) {
    return '[]'
  }
  @($items) | ConvertTo-Json -Compress
}

while ($true) {
  $cmd = [Console]::In.ReadLine()
  if ($null -eq $cmd) { break }
  switch ($cmd.Trim().ToLowerInvariant()) {
    'foreground' { Get-ScreenSenseForeground }
    'running' { Get-ScreenSenseRunning }
    'quit' { break }
    default { '{}' }
  }
}

$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$Target = Join-Path $Root "Start-TaskManager.ps1"
$Desktop = [Environment]::GetFolderPath("Desktop")
$ShortcutName = "$([char]0x4efb)$([char]0x52a1)$([char]0x7ba1)$([char]0x7406).lnk"
$StartMenu = Join-Path ([Environment]::GetFolderPath("Programs")) $ShortcutName
$DesktopLink = Join-Path $Desktop $ShortcutName
$Powershell = Join-Path $env:SystemRoot "System32\WindowsPowerShell\v1.0\powershell.exe"

function New-AppShortcut {
  param([string]$Path)
  $Shell = New-Object -ComObject WScript.Shell
  $Shortcut = $Shell.CreateShortcut($Path)
  $Shortcut.TargetPath = $Powershell
  $Shortcut.Arguments = "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$Target`""
  $Shortcut.WorkingDirectory = $Root
  $Shortcut.IconLocation = "$Powershell,0"
  $Shortcut.Description = "Local task manager"
  $Shortcut.Save()
}

New-AppShortcut -Path $DesktopLink
New-AppShortcut -Path $StartMenu

Write-Host "Install complete. Desktop and Start Menu shortcuts were created."

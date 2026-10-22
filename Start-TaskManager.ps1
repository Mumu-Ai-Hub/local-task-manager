$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$Port = 41730
$Url = "http://127.0.0.1:$Port/index.html"

function Test-PortOpen {
  param([int]$Port)
  try {
    $Client = [System.Net.Sockets.TcpClient]::new()
    $Async = $Client.BeginConnect("127.0.0.1", $Port, $null, $null)
    $Open = $Async.AsyncWaitHandle.WaitOne(200)
    if ($Open) { $Client.EndConnect($Async) }
    $Client.Close()
    return $Open
  } catch {
    return $false
  }
}

function Open-AppWindow {
  if ($env:TASK_MANAGER_NO_BROWSER -eq "1") { return }

  $EdgePaths = @(
    "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe",
    "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe"
  )
  $ChromePaths = @(
    "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
    "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe"
  )

  $Browser = @($EdgePaths + $ChromePaths) | Where-Object { $_ -and (Test-Path $_) } | Select-Object -First 1
  if ($Browser) {
    Start-Process -FilePath $Browser -ArgumentList "--app=$Url"
  } else {
    Start-Process $Url
  }
}

function Start-StaticServer {
  $Python = Get-Command python -ErrorAction SilentlyContinue
  if ($Python) {
    Start-Process -FilePath $Python.Source -ArgumentList "-m", "http.server", "$Port", "--bind", "127.0.0.1", "--directory", "`"$Root`"" -WindowStyle Hidden
    return $true
  }

  $PythonLauncher = Get-Command py -ErrorAction SilentlyContinue
  if ($PythonLauncher) {
    Start-Process -FilePath $PythonLauncher.Source -ArgumentList "-3", "-m", "http.server", "$Port", "--bind", "127.0.0.1", "--directory", "`"$Root`"" -WindowStyle Hidden
    return $true
  }

  return $false
}

if (-not (Test-PortOpen -Port $Port)) {
  if (-not (Start-StaticServer)) {
    Start-Process (Join-Path $Root "index.html")
    Write-Host "Python was not found. Opened index.html directly; offline install and system notifications may be limited."
    exit 0
  }
  Start-Sleep -Milliseconds 900
}

Open-AppWindow

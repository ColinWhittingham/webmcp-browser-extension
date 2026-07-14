#Requires -Version 5.1
<#
.SYNOPSIS
    Registers the WebMCP gcloud token native messaging host with Chrome and Edge.

.DESCRIPTION
    Writes a native messaging host manifest and adds the required registry key so
    Chrome/Edge will allow the WebMCP extension to call gcloud auth print-access-token
    automatically. No admin rights required (writes to HKCU).

.PARAMETER ExtensionId
    The Chrome extension ID shown on chrome://extensions/ (32-character string).
    If omitted the script will prompt for it.

.EXAMPLE
    .\install.ps1
    .\install.ps1 -ExtensionId abcdefghijklmnopqrstuvwxyzabcdef
#>
param(
    [string]$ExtensionId = ''
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$HostName    = 'com.webmcp.gcloud_token'
$ScriptDir   = $PSScriptRoot
$LauncherPath = Join-Path $ScriptDir 'webmcp_token_host.bat'
$ManifestPath = Join-Path $ScriptDir 'manifest.json'

# ── Validate Python ──────────────────────────────────────────────────────────
if (-not (Get-Command python -ErrorAction SilentlyContinue)) {
    Write-Error 'Python is not in PATH. Install Python 3 and try again.'
    exit 1
}

# ── Get extension ID ─────────────────────────────────────────────────────────
if ($ExtensionId -eq '') {
    Write-Host ''
    Write-Host 'Open chrome://extensions/, enable Developer mode, and copy the' -ForegroundColor Cyan
    Write-Host 'ID shown under "WebMCP Tool Inference" (32 lowercase letters).' -ForegroundColor Cyan
    Write-Host ''
    $ExtensionId = (Read-Host 'Extension ID').Trim()
}

if ($ExtensionId.Length -ne 32) {
    Write-Error "Extension ID must be 32 characters. Got $($ExtensionId.Length): '$ExtensionId'"
    exit 1
}

# ── Write manifest.json ───────────────────────────────────────────────────────
$Manifest = [ordered]@{
    name            = $HostName
    description     = 'Provides gcloud access tokens to the WebMCP extension'
    path            = $LauncherPath
    type            = 'stdio'
    allowed_origins = @("chrome-extension://$ExtensionId/")
} | ConvertTo-Json -Depth 3

# Write with UTF-8 without BOM (Chrome requires this)
[System.IO.File]::WriteAllText($ManifestPath, $Manifest, [System.Text.UTF8Encoding]::new($false))
Write-Host "Manifest written to: $ManifestPath" -ForegroundColor Green

# ── Register for Chrome ───────────────────────────────────────────────────────
$ChromeKey = "HKCU:\Software\Google\Chrome\NativeMessagingHosts\$HostName"
New-Item -Path $ChromeKey -Force | Out-Null
Set-ItemProperty -Path $ChromeKey -Name '(Default)' -Value $ManifestPath
Write-Host 'Registered for Chrome.' -ForegroundColor Green

# ── Register for Edge (same Chromium host; works for both) ────────────────────
$EdgeKey = "HKCU:\Software\Microsoft\Edge\NativeMessagingHosts\$HostName"
New-Item -Path $EdgeKey -Force | Out-Null
Set-ItemProperty -Path $EdgeKey -Name '(Default)' -Value $ManifestPath
Write-Host 'Registered for Edge.' -ForegroundColor Green

Write-Host ''
Write-Host 'Installation complete!' -ForegroundColor Green
Write-Host 'Restart Chrome and reload the WebMCP extension at chrome://extensions/.' -ForegroundColor Cyan

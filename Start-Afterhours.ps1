$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
$node = Get-Command node -ErrorAction SilentlyContinue
if (-not $node) { throw 'Install Node.js 22 or newer, then run this launcher again.' }
$unoRoot = Join-Path $PSScriptRoot 'release\uno\wwwroot'
if (Test-Path -LiteralPath (Join-Path $unoRoot 'index.html')) {
    $env:AFTERHOURS_STATIC = $unoRoot
}
Write-Host 'Afterhours is opening at http://127.0.0.1:4176'
Write-Host 'Keep this window open while playing. Press Ctrl+C to stop.'
Start-Process 'http://127.0.0.1:4176'
& $node.Source (Join-Path $PSScriptRoot 'server.mjs')

param(
  [int]$Port = 8000,
  [string]$Root = "."
)

$ErrorActionPreference = 'Stop'

function Get-ContentType($path) {
  $ext = [System.IO.Path]::GetExtension($path).ToLowerInvariant()
  switch ($ext) {
    ".html" { "text/html; charset=utf-8"; break }
    ".htm"  { "text/html; charset=utf-8"; break }
    ".css"  { "text/css; charset=utf-8"; break }
    ".js"   { "application/javascript; charset=utf-8"; break }
    ".json" { "application/json; charset=utf-8"; break }
    ".svg"  { "image/svg+xml"; break }
    ".png"  { "image/png"; break }
    ".jpg"  { "image/jpeg"; break }
    ".jpeg" { "image/jpeg"; break }
    ".gif"  { "image/gif"; break }
    ".ico"  { "image/x-icon"; break }
    ".txt"  { "text/plain; charset=utf-8"; break }
    default  { "application/octet-stream" }
  }
}

$listener = [System.Net.HttpListener]::new()
$prefix = "http://localhost:$Port/"
$listener.Prefixes.Add($prefix)
$listener.Start()

$rootFull = (Resolve-Path $Root).Path
Write-Host "Serving $rootFull on $prefix (Ctrl+C to stop)" -ForegroundColor Green

try {
  while ($listener.IsListening) {
    $ctx = $listener.GetContext()
    try {
      $req = $ctx.Request
      $res = $ctx.Response
      $res.Headers.Add("Access-Control-Allow-Origin", "*")
      $res.Headers.Add("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")

      $localPath = $req.Url.AbsolutePath.TrimStart('/')
      if ([string]::IsNullOrWhiteSpace($localPath)) { $localPath = 'index.html' }

      $fullPath = Join-Path $rootFull $localPath
      if ((Test-Path $fullPath) -and -not (Get-Item $fullPath).PSIsContainer) {
        $bytes = [System.IO.File]::ReadAllBytes($fullPath)
        $res.ContentType = (Get-ContentType -path $fullPath)
        $res.StatusCode = 200
        $res.OutputStream.Write($bytes, 0, $bytes.Length)
      } else {
        $res.StatusCode = 404
        $msg = [System.Text.Encoding]::UTF8.GetBytes("Not Found")
        $res.OutputStream.Write($msg, 0, $msg.Length)
      }
    } catch {
      Write-Host ("Error handling request: {0}" -f $_.Exception.Message) -ForegroundColor Red
      try { $ctx.Response.StatusCode = 500 } catch {}
    } finally {
      try { $ctx.Response.OutputStream.Close() } catch {}
    }
  }
} finally {
  $listener.Stop()
  $listener.Close()
}



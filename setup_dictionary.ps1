param(
  [switch]$Force
)

$ErrorActionPreference = 'Stop'

function Ensure-Directory {
  param([string]$Path)
  if (-not (Test-Path -Path $Path)) { [void](New-Item -ItemType Directory -Path $Path) }
}

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = Resolve-Path (Join-Path $scriptDir '..')
$dataDir = Join-Path $projectRoot 'data'
Ensure-Directory -Path $dataDir

$jsonPath = Join-Path $dataDir 'allowed_words.json'
$jsPath = Join-Path $dataDir 'allowed_words.js'

# Sources to merge
$sources = @(
  @{ Name = 'dwyl_words_alpha'; Url = 'https://raw.githubusercontent.com/dwyl/english-words/master/words_alpha.txt'; Out = (Join-Path $dataDir 'words_alpha.txt') },
  @{ Name = 'tabatkins_wordle_list'; Url = 'https://raw.githubusercontent.com/tabatkins/wordle-list/main/words'; Out = (Join-Path $dataDir 'wordle_list_tabatkins.txt') },
  @{ Name = 'cfreshman_allowed'; Url = 'https://gist.githubusercontent.com/cfreshman/cdcdf777450c5b5301e439061d29694c/raw/'; Out = (Join-Path $dataDir 'wordle_allowed_cfreshman.txt') }
)

Write-Host "Downloading source word lists..." -ForegroundColor Cyan
foreach ($s in $sources) {
  try {
    if ($Force -or -not (Test-Path $s.Out)) {
      Invoke-WebRequest -UseBasicParsing -Uri $s.Url -OutFile $s.Out
      Write-Host ("Downloaded {0}" -f $s.Name)
    } else {
      Write-Host ("{0} already exists, skipping. Use -Force to re-download." -f $s.Name)
    }
  }
  catch {
    Write-Warning ("Failed to download {0} from {1}: {2}" -f $s.Name, $s.Url, $_.Exception.Message)
  }
}

# Ensure custom words file exists
$customPath = Join-Path $dataDir 'custom_words.txt'
if (-not (Test-Path $customPath)) {
  @(
    '# Add one lowercase word per line. Only letters a-z will be considered.'
    '# Example custom entries:'
    'farts'
  ) | Set-Content -Path $customPath -Encoding UTF8
  Write-Host ("Created {0} with example entries. Edit this file to add your own words." -f $customPath) -ForegroundColor Yellow
}

Write-Host "Building merged 5-letter dictionary..." -ForegroundColor Cyan
$all = @()
foreach ($s in $sources) {
  if (Test-Path $s.Out) {
    $all += Get-Content $s.Out -ErrorAction SilentlyContinue
  }
}
if (Test-Path $customPath) {
  $all += Get-Content $customPath -ErrorAction SilentlyContinue
}

# Normalize to lowercase, filter 5-letter a-z only, unique + sort
$five = $all | ForEach-Object { ($_ -as [string]).ToLower() } | Where-Object { $_ -match '^[a-z]{5}$' }
$five = $five | Sort-Object -Unique

# Convert to JSON array
$json = $five | ConvertTo-Json
Set-Content -Path $jsonPath -Value $json -Encoding UTF8

# Also emit a JS file to allow loading from file:// without CORS
$js = "window.WORDLE_ALLOWED_WORDS = $json;"
Set-Content -Path $jsPath -Value $js -Encoding UTF8

Write-Host "Done. Output: $jsonPath and $jsPath (count=$($five.Count))" -ForegroundColor Green



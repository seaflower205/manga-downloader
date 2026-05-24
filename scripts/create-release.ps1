# Script to create a release ZIP for Manga Downloader
# Usage: .\scripts\create-release.ps1

$manifestJson = Get-Content manifest.json | ConvertFrom-Json
$version = $manifestJson.version
$zipName = "manga-downloader-v${version}.zip"
$buildDir = "build"

Write-Host "[*] Creating release package for v${version}..." -ForegroundColor Green

# Create build directory
if (!(Test-Path $buildDir)) {
    New-Item -ItemType Directory -Path $buildDir | Out-Null
}

Push-Location $buildDir

# Copy only necessary files
Write-Host "[*] Copying files..."
Copy-Item -Path ..\background -Destination . -Recurse -Force
Copy-Item -Path ..\content -Destination . -Recurse -Force
Copy-Item -Path ..\popup -Destination . -Recurse -Force
Copy-Item -Path ..\config -Destination . -Recurse -Force
Copy-Item -Path ..\icons -Destination . -Recurse -Force
Copy-Item -Path ..\utils -Destination . -Recurse -Force
Copy-Item -Path ..\manifest.json -Destination . -Force

# Create ZIP using Compress-Archive (built-in, no lock issues)
Write-Host "[*] Creating ZIP file..."

# Remove old ZIP if exists
if (Test-Path $zipName) {
    Remove-Item $zipName -Force
}

# Create ZIP using PowerShell's built-in Compress-Archive
$filesToCompress = @('background', 'content', 'popup', 'config', 'icons', 'utils', 'manifest.json')
try {
    Compress-Archive -Path $filesToCompress -DestinationPath $zipName -Force -ErrorAction Stop
} catch {
    Write-Host "[ERROR] Failed to create ZIP: $_" -ForegroundColor Red
    Pop-Location
    exit 1
}

if (Test-Path $zipName) {
    $size = (Get-Item $zipName).Length / 1MB
    Write-Host "[SUCCESS] Release package created: $zipName" -ForegroundColor Green
    Write-Host "[INFO] File size: $([Math]::Round($size, 2)) MB"
    Pop-Location
    Write-Host ""
    Write-Host "[NEXT STEPS]" -ForegroundColor Cyan
    Write-Host "1. Go to: https://github.com/seaflower205/manga-downloader/releases"
    Write-Host "2. Click 'Draft a new release'"
    Write-Host "3. Tag version: v${version}"
    Write-Host "4. Upload: build/$zipName"
}
else {
    Write-Host "[ERROR] Failed to create ZIP file" -ForegroundColor Red
    Pop-Location
    exit 1
}

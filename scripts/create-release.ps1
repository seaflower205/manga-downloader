# Script to create a release ZIP for Manga Downloader
# Usage: .\scripts\create-release.ps1

$manifestJson = Get-Content manifest.json | ConvertFrom-Json
$version = $manifestJson.version
$zipName = "manga-downloader-v${version}.zip"
$buildDir = "build"

Write-Host "📦 Creating release package for v${version}..." -ForegroundColor Green

# Create build directory
if (!(Test-Path $buildDir)) {
    New-Item -ItemType Directory -Path $buildDir | Out-Null
}

Push-Location $buildDir

# Copy only necessary files
Write-Host "📋 Copying files..."
Copy-Item -Path ..\background -Destination . -Recurse -Force
Copy-Item -Path ..\content -Destination . -Recurse -Force
Copy-Item -Path ..\popup -Destination . -Recurse -Force
Copy-Item -Path ..\config -Destination . -Recurse -Force
Copy-Item -Path ..\icons -Destination . -Recurse -Force
Copy-Item -Path ..\utils -Destination . -Recurse -Force
Copy-Item -Path ..\manifest.json -Destination . -Force

# Create ZIP using PowerShell
Write-Host "🔧 Creating ZIP file..."
$files = @('background', 'content', 'popup', 'config', 'icons', 'utils', 'manifest.json')

# Remove old ZIP if exists
if (Test-Path $zipName) {
    Remove-Item $zipName -Force
}

# Create ZIP
Add-Type -AssemblyName System.IO.Compression.FileSystem
[System.IO.Compression.ZipFile]::CreateFromDirectory((Get-Location).Path, (Join-Path (Get-Location).Path $zipName), 'Optimal', $true)

if (Test-Path $zipName) {
    $size = (Get-Item $zipName).Length / 1MB
    Write-Host "✅ Release package created: $zipName" -ForegroundColor Green
    Write-Host "📊 File size: $([Math]::Round($size, 2)) MB"
    Pop-Location
    Write-Host ""
    Write-Host "📖 Next steps:" -ForegroundColor Cyan
    Write-Host "1. Go to: https://github.com/seaflower205/manga-downloader/releases"
    Write-Host "2. Click 'Draft a new release'"
    Write-Host "3. Tag version: v${version}"
    Write-Host "4. Upload: build/$zipName"
}
else {
    Write-Host "❌ Failed to create ZIP file" -ForegroundColor Red
    Pop-Location
    exit 1
}

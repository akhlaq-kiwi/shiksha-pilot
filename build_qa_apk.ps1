# PowerShell script to build QA APK for Shiksha Pilot School Hub Flutter app
$ErrorActionPreference = "Stop"

$workspaceRoot = $PSScriptRoot
$appDir = Join-Path $workspaceRoot "app"
$buildsDir = Join-Path $workspaceRoot ".builds"

$mainFile = Join-Path $appDir "lib/main.dart"
$homeFile = Join-Path $appDir "lib/screens/home_screen.dart"

$mainBackup = Join-Path $appDir "lib/main.dart.bak"
$homeBackup = Join-Path $appDir "lib/screens/home_screen.dart.bak"

$flutterCmd = "C:\Users\flutter\bin\flutter.bat"

if (-not (Test-Path $flutterCmd)) {
    Write-Error "Error: Flutter SDK not found at $flutterCmd"
}

# Ensure builds directory exists
if (-not (Test-Path $buildsDir)) {
    New-Item -ItemType Directory -Path $buildsDir | Out-Null
}

Write-Host "1. Backing up original Dart files..." -ForegroundColor Yellow
Copy-Item $mainFile $mainBackup -Force
Copy-Item $homeFile $homeBackup -Force

try {
    Write-Host "2. Replacing development IP with QA server URL..." -ForegroundColor Yellow
    
    # Read files
    $mainContent = Get-Content $mainFile -Raw
    $homeContent = Get-Content $homeFile -Raw
    
    # Replace IP with QA server URL
    $qaUrl = "https://qa.shikshapilot.com"
    $devUrl = "http://10.227.152.71:8000"
    
    $mainContentNew = $mainContent.Replace($devUrl, $qaUrl)
    $homeContentNew = $homeContent.Replace($devUrl, $qaUrl)
    
    # Write back
    Set-Content $mainFile -Value $mainContentNew -Encoding utf8
    Set-Content $homeFile -Value $homeContentNew -Encoding utf8
    
    Write-Host "Url replacement complete. Verification:" -ForegroundColor Gray
    # Perform a quick verification
    $mainCheck = Get-Content $mainFile -Raw
    if ($mainCheck -match "10.227.152.71") {
        Write-Error "Error: Development IP still present in main.dart after replacement!"
    }
    
    Write-Host "3. Building QA Release APK..." -ForegroundColor Yellow
    Push-Location $appDir
    try {
        & $flutterCmd clean
        & $flutterCmd build apk --release
    } finally {
        Pop-Location
    }
    
    $apkSource = Join-Path $appDir "build/app/outputs/flutter-apk/app-release.apk"
    $apkDestination = Join-Path $buildsDir "school_hub_qa.apk"
    
    if (Test-Path $apkSource) {
        Write-Host "4. Copying built APK to .builds directory..." -ForegroundColor Yellow
        Copy-Item $apkSource $apkDestination -Force
        Write-Host "APK successfully copied to $apkDestination" -ForegroundColor Green
    } else {
        throw "Build finished but release APK was not found at expected path: $apkSource"
    }
    
} finally {
    Write-Host "5. Restoring original Dart files..." -ForegroundColor Yellow
    if (Test-Path $mainBackup) {
        Copy-Item $mainBackup $mainFile -Force
        Remove-Item $mainBackup -Force
    }
    if (Test-Path $homeBackup) {
        Copy-Item $homeBackup $homeFile -Force
        Remove-Item $homeBackup -Force
    }
    Write-Host "Original files restored." -ForegroundColor Green
}

Write-Host "`nQA APK Build Completed Successfully!" -ForegroundColor Green
Write-Host "Output file: $apkDestination" -ForegroundColor Green

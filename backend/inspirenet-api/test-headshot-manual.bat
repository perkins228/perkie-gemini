@echo off
REM Manual Test Script for Perkie Print Headshot Endpoint (Windows)
REM Quick single-image test without Python dependencies

setlocal enabledelayedexpansion

echo ========================================
echo Perkie Print Headshot - Manual Test
echo ========================================
echo.

REM Configuration
set API_URL=http://localhost:8000/api/v2/headshot
set OUTPUT_DIR=test_output\manual

REM Check if image path provided
if "%~1"=="" (
    echo [ERROR] No image provided
    echo Usage: test-headshot-manual.bat ^<path-to-pet-image.jpg^>
    echo Example: test-headshot-manual.bat test_images\golden_retriever.jpg
    exit /b 1
)

set IMAGE_PATH=%~1

REM Check if image exists
if not exist "%IMAGE_PATH%" (
    echo [ERROR] Image not found: %IMAGE_PATH%
    exit /b 1
)

echo [OK] Found image: %IMAGE_PATH%

REM Check if curl is available
where curl >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] curl not found. Please install curl or use WSL to run the .sh version
    exit /b 1
)

REM Check if server is running
echo.
echo [INFO] Checking if API server is running...
curl -s -f http://localhost:8000/health >nul 2>&1
if %errorlevel% equ 0 (
    echo [OK] API server is running
) else (
    echo [ERROR] API server is not running
    echo [INFO] Please start the server first:
    echo    cd backend\inspirenet-api
    echo    python src\main.py
    exit /b 1
)

REM Create output directory
if not exist "%OUTPUT_DIR%" mkdir "%OUTPUT_DIR%"

REM Get filename without path and extension
for %%F in ("%IMAGE_PATH%") do (
    set BASENAME=%%~nF
)
set OUTPUT_PATH=%OUTPUT_DIR%\%BASENAME%_headshot.png

REM Test the endpoint
echo.
echo [INFO] Testing headshot endpoint...
echo    Input:  %IMAGE_PATH%
echo    Output: %OUTPUT_PATH%
echo.

REM Send request
curl -X POST "%API_URL%" ^
  -F "file=@%IMAGE_PATH%" ^
  -o "%OUTPUT_PATH%" ^
  -w "HTTP Status: %%{http_code}\nTotal Time: %%{time_total}s\n" ^
  --max-time 120

if %errorlevel% equ 0 (
    echo.
    echo [OK] Request completed

    REM Check if output file exists and has content
    if exist "%OUTPUT_PATH%" (
        for %%A in ("%OUTPUT_PATH%") do set FILE_SIZE=%%~zA
        echo [OK] Output saved: %OUTPUT_PATH% (!FILE_SIZE! bytes^)

        echo.
        echo ========================================
        echo [SUCCESS] Test completed!
        echo ========================================
        echo.
        echo Next steps:
        echo 1. Open the output image to verify quality:
        echo    %OUTPUT_PATH%
        echo 2. Check for:
        echo    - Tight headshot crop (not full body^)
        echo    - 4:5 portrait aspect ratio
        echo    - Head in top third of frame
        echo    - Professional B^&W quality
        echo    - Transparent background
        echo    - Soft neck fade at bottom
        echo.
        echo 3. Run full test suite:
        echo    python test_headshot_local.py

    ) else (
        echo [ERROR] Output file is empty or missing
        exit /b 1
    )

) else (
    echo.
    echo [ERROR] Request failed
    echo Check server logs for errors
    exit /b 1
)

endlocal

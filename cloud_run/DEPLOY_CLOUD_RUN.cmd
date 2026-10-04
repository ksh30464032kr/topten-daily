@echo off
setlocal
cd /d "%~dp0"

echo ==========================================
echo TOPTEN Cloud Run deploy
echo ==========================================
echo.

where gcloud >nul 2>nul
if errorlevel 1 (
  echo ERROR: Google Cloud CLI ^(gcloud^) is not installed.
  echo Install Google Cloud CLI first, then run this file again.
  pause
  exit /b 1
)

set /p PROJECT_ID=Google Cloud Project ID: 
if "%PROJECT_ID%"=="" (
  echo Project ID is required.
  pause
  exit /b 1
)

set REGION=asia-northeast3
set SERVICE=topten-ocr

call gcloud config set project "%PROJECT_ID%"
if errorlevel 1 goto ERROR

call gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com
if errorlevel 1 goto ERROR

echo.
echo Deploying. The first build can take several minutes...
call gcloud run deploy "%SERVICE%" ^
  --source "." ^
  --region "%REGION%" ^
  --allow-unauthenticated ^
  --memory 2Gi ^
  --cpu 2 ^
  --concurrency 1 ^
  --min-instances 0 ^
  --max-instances 2 ^
  --startup-probe="httpGet.path=/healthz,httpGet.port=8080,timeoutSeconds=3,periodSeconds=5,failureThreshold=48" ^
  --timeout 300
if errorlevel 1 goto ERROR

for /f "delims=" %%i in ('gcloud run services describe "%SERVICE%" --region "%REGION%" --format^="value(status.url)"') do set SERVICE_URL=%%i

echo.
echo ==========================================
echo CLOUD RUN READY
echo %SERVICE_URL%
echo ==========================================
echo.
echo GitHub repository variable:
echo Name  : API_BASE_URL
echo Value : %SERVICE_URL%
echo.
> cloud-run-url.txt echo %SERVICE_URL%
pause
exit /b 0

:ERROR
echo.
echo Deployment failed. Copy the first ERROR shown above.
pause
exit /b 1

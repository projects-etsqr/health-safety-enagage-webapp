@echo off
setlocal
set "PROJECT_DIR=%~dp0"
set "JAVA_HOME=C:\Program Files\Android\Android Studio\jbr"
set "PATH=%JAVA_HOME%\bin;%PATH%"
set "ADB=%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe"
set "EMULATOR=%LOCALAPPDATA%\Android\Sdk\emulator\emulator.exe"
set "SDK_DIR=%LOCALAPPDATA%\Android\Sdk"

:: Create short path drive Z: -> project root (avoids spaces / long paths in gradle args)
subst Z: "%PROJECT_DIR%" 2>nul

:: Make sure Android SDK is known to gradle. Without local.properties the first
:: build fails with "SDK location not found".
if not exist "Z:\android\local.properties" (
    echo sdk.dir=%SDK_DIR:\=/% > "Z:\android\local.properties"
    echo Created android\local.properties -> %SDK_DIR%
)

:: Start emulator if not already running
"%ADB%" devices | findstr "emulator" >nul 2>&1
if %errorlevel% neq 0 (
    echo Starting Pixel_6a emulator...
    start "" "%EMULATOR%" -avd Pixel_6a -no-snapshot-load
    echo Waiting for emulator to boot...
    :waitloop
    timeout /t 5 /nobreak >nul
    "%ADB%" -e shell getprop sys.boot_completed 2>nul | findstr "1" >nul
    if %errorlevel% neq 0 goto waitloop
    echo Emulator ready.
) else (
    echo Emulator already running.
)

:: Build and install
cd /d Z:\android
call gradlew.bat app:installDebug -PreactNativeDevServerPort=8081
if %errorlevel% neq 0 exit /b %errorlevel%

:: Forward Metro port and launch app
"%ADB%" reverse tcp:8081 tcp:8081
"%ADB%" shell monkey -p com.supervisormobileapp -c android.intent.category.LAUNCHER 1
endlocal

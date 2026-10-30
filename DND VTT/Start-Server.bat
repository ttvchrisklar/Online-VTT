@echo off
title DND VTT - Local Server
cd /d "%~dp0"

echo ========================================================
echo             DND VTT - Local Web Server
echo ========================================================
echo.

set PYTHON_BIN=""
if exist "C:\Users\chris\AppData\Local\Python\pythoncore-3.15-64\python.exe" (
    set PYTHON_BIN="C:\Users\chris\AppData\Local\Python\pythoncore-3.15-64\python.exe"
) else (
    where python >nul 2>&1
    if %errorlevel% equ 0 (
        set PYTHON_BIN=python
    )
)

if not %PYTHON_BIN%=="" (
    echo Starting server with Python on port 8080...
    echo Open in your browser: http://localhost:8080
    start http://localhost:8080
    %PYTHON_BIN% -m http.server 8080
    pause
    exit /b
)

echo Starting PowerShell Web Server on port 8080...
start http://localhost:8080
powershell -ExecutionPolicy Bypass -Command "$listener = New-Object System.Net.HttpListener; $listener.Prefixes.Add('http://*:8080/'); try { $listener.Start() } catch { $listener.Prefixes.Clear(); $listener.Prefixes.Add('http://localhost:8080/'); $listener.Start() }; Write-Host 'Server running at http://localhost:8080 (Press Ctrl+C to stop)'; while($true) { $ctx = $listener.GetContext(); $req = $ctx.Request; $path = '.' + $req.RawUrl.Split('?')[0]; if($path -eq './') { $path = './index.html' }; if(Test-Path $path) { $bytes = [System.IO.File]::ReadAllBytes($path); $ext = [System.IO.Path]::GetExtension($path); switch($ext) { '.html' { $ctx.Response.ContentType = 'text/html' } '.js' { $ctx.Response.ContentType = 'application/javascript' } '.css' { $ctx.Response.ContentType = 'text/css' } }; $ctx.Response.ContentLength64 = $bytes.Length; $ctx.Response.OutputStream.Write($bytes, 0, $bytes.Length) } else { $ctx.Response.StatusCode = 404 }; $ctx.Response.Close() }"
pause


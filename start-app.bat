@echo off
echo Starting LLM Conversation App...

:: Kill any existing processes on ports 3000 and 3001
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":3000"') do taskkill /F /PID %%a 2>NUL
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":3001"') do taskkill /F /PID %%a 2>NUL

:: Start the search server (in a new window)
start "Search Server" cmd /k "cd server && npm start"

:: Wait for the search server to start
timeout /t 3

:: Start the React development server (in a new window)
start "React App" cmd /k "npm start"

echo Both servers have been started!
echo Search server is running on http://localhost:3001
echo React app is running on http://localhost:3000
echo.
echo Press any key to close this window...
pause > nul

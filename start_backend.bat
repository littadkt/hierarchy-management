@echo off
title Hierarchy Backend (FastAPI)
cd /d %~dp0backend
echo Starting Backend on 0.0.0.0:8000...
if exist littad-env\Scripts\python.exe (
    littad-env\Scripts\python.exe -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
) else if exist venv\Scripts\python.exe (
    venv\Scripts\python.exe -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
) else (
    python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
)
pause


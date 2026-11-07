@echo off
title Hierarchy Backend (FastAPI)
cd /d %~dp0backend
echo Starting Backend on 0.0.0.0:8000...
venv\Scripts\python.exe -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
pause


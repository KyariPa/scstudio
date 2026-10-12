@echo off
rem Dashboard agen Claude Code - klik dua kali, lalu browser terbuka ke http://localhost:8790
cd /d "%~dp0"
start "" http://localhost:8790
python agen_dashboard.py 8790


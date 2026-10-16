#!/bin/bash

# PTIT-STEM-CUBE - Dev Environment Launcher Script
# Starts both FastAPI Backend and Vite Frontend concurrently with colored output and clean shutdown.

# Function to stop background processes when exiting
cleanup() {
    echo ""
    echo "🛑 Shutting down development servers..."
    kill 0
    exit 0
}

# Trap SIGINT (Ctrl+C) and SIGTERM
trap cleanup SIGINT SIGTERM

echo "=================================================="
echo "🚀 Starting PTIT-STEM-CUBE Dev Environment"
echo "   - Frontend: http://localhost:5175"
echo "   - Backend:  http://localhost:8005"
echo "=================================================="
echo ""

# Detect stemcube conda environment or fallback to python3
if [ -f "$HOME/miniconda3/envs/stemcube/bin/python" ]; then
    PYTHON_BIN="$HOME/miniconda3/envs/stemcube/bin/python"
    echo "🐍 Using Conda env: stemcube ($PYTHON_BIN)"
else
    PYTHON_BIN=$(which python3 2>/dev/null || echo "python3")
    echo "🐍 Using Python: $PYTHON_BIN"
fi

# Run backend in background
(
    cd fastapi-backend || exit 1
    echo "[BE] Starting FastAPI Backend on port 8005..."
    $PYTHON_BIN -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8005
) &

# Run frontend in foreground/background via vite
(
    echo "[FE] Starting Vite Frontend on port 5175..."
    npx vite
) &

# Wait for both processes
wait

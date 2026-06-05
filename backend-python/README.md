# Stonkfish Engine Backend (Python FastAPI)

This directory contains the Python FastAPI server powering the core chess engine and machine learning evaluation.

## Overview
The Python backend processes heavy calculations like legal move generation, ML evaluations, and full-game historical analysis. It communicates over REST APIs.

### Key Features
- **FastAPI Framework:** High-performance async web framework handling concurrent move evaluations.
- **Custom Chess Engine:** Features a `ChessEngine` using greedy heuristics and ML-based models (`ml3`).
- **Machine Learning Integration:** Uses `onnxruntime` to efficiently load and infer using `evaluator_kaggle.onnx` models.
- **In-Memory Caching:** Pre-loads all models and engine depths into RAM upon startup to minimize latency for every engine request.

## Running the Engine

Make sure you run this from within the activated virtual environment, from the **root directory** of the project (`chess_webapp`).

```bash
uvicorn backend-python.main:app --reload --port 8000
```

*Note: Please see the root `README.md` for comprehensive instructions on starting the entire stack.*

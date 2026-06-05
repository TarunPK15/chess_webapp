# ♟ Stonkfish Chess Web App

A full-stack chess platform featuring a **custom-built chess engine**, **machine-learning-based board evaluation**, and a **modern React web interface** with real-time multiplayer support.

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [Architecture](#architecture)
3. [The Chess Engine](#the-chess-engine)
4. [Machine Learning Evaluator](#machine-learning-evaluator)
5. [Frontend](#frontend)
6. [Node.js Backend](#nodejs-backend)
7. [Python FastAPI Backend](#python-fastapi-backend)
8. [Setup & Installation](#setup--installation)
9. [Running the Full Stack](#running-the-full-stack)
10. [Developer Utilities](#developer-utilities)
11. [Running Tests](#running-tests)

---

## Project Overview

Stonkfish started as a Tkinter GUI chess application (`baseline.py`) and evolved into a distributed, microservices-based web platform. It supports:

- **vs. Bot:** Play against the Stonkfish engine in two modes — a high-performance C++-based greedy minimax engine, or a neural-network-powered ML evaluator.
- **vs. Player (PvP):** Real-time online matches against other registered users via WebSockets.
- **Game Analysis:** Review any completed game move-by-move with engine evaluation scores, an evaluation bar, and a one-click "Ideal Move" overlay that shows the best move the engine would have played.
- **User Profiles & Leaderboards:** Persistent user accounts, game history, win/loss statistics, and a global ranked leaderboard.

---

## Architecture

The application is composed of **three independent services** that communicate over HTTP and WebSockets:

```
┌──────────────────────┐         ┌──────────────────────────────┐
│                      │ HTTP/WS │                              │
│   React Frontend     │◄───────►│   Node.js Express Backend   │
│   (Vite, Port 5173)  │         │   (Port 5000)               │
│                      │         │   - Auth, Users, Games, PvP  │
└──────────────────────┘         │   - MongoDB persistence      │
            │                    └──────────────────────────────┘
            │ HTTP (engine calls)           │
            │                              │ HTTP (engine proxy)
            ▼                              ▼
┌──────────────────────────────────────────────────────────────┐
│          Python FastAPI Engine Backend (Port 8000)           │
│   - Custom Chess Engine (Greedy C++ DLL + Python ML)         │
│   - ONNX Neural Network Evaluation (onnxruntime)             │
│   - Game State Analysis endpoint                             │
└──────────────────────────────────────────────────────────────┘
```

---

## The Chess Engine

The core engine lives in the `engine/` directory and is implemented in two layers:

### Board Representation (`game_state.py`)
Board state is stored as two Python dictionaries — `gs.white` and `gs.black` — where keys are unique piece IDs (e.g., `WP4`, `BK1`) and values are `[col, row]` coordinates. This makes piece tracking, move history, and state snapshotting straightforward and efficient.

### Move Generator (`move_generator.py`)
A fully hand-crafted legal move generator supporting:
- All standard piece movements (Pawn, Knight, Bishop, Rook, Queen, King)
- **En passant** capture
- **Castling** (Kingside and Queenside)
- **Check** detection and move legality filtering
- **Pawn promotion**

### Engine Modes (`chess_engine.py`)

| Mode | Implementation | Description |
|------|---------------|-------------|
| `greedy` | C++ DLL via `ctypes` | High-performance alpha-beta minimax written in C++ (`greedy.cpp`), compiled to `greedy.dll`. Includes **adaptive depth** — if the engine has a material advantage ≥7 pawns, it automatically increases its search depth to close out the game. |
| `ml3` | Python Minimax + ONNX | Alpha-beta minimax in Python using a neural network (`evaluator_kaggle.onnx`) for positional evaluation instead of hand-coded heuristics. |

#### C++ Bridge (`cpp_bridge.py`)
The Python `ctypes` bridge serialises the Python game state into a flat 64-integer board array and calls `greedy.dll` via the `get_best_move` exported function. It also maintains a running history of past board positions to detect and penalise repetition.

#### Move Ordering
Before entering the minimax tree, moves are sorted by MVV-LVA (Most Valuable Victim – Least Valuable Aggressor) to dramatically improve alpha-beta pruning effectiveness.

---

## Machine Learning Evaluator

The ML pipeline lives in the `ml/` directory.

### Models

| File | Description |
|------|-------------|
| `evaluator.onnx` | First-generation model trained on PGN game data. Outputs a win-probability (0.0–1.0). |
| `evaluator_cp.onnx` | Second-generation model trained on centipawn evaluation data. Uses `tanh` output for a ±1.0 score. |
| `evaluator_kaggle.onnx` (**Production**) | **"Goliath."** The strongest model, trained on 2 million Kaggle-sourced board evaluations using a 768→256→64→1 network with Dropout. This is the model the live web app uses. |

### Neural Network Architecture (`train_kaggle.py`)
```
Input:  768 features (12 piece-type planes × 64 squares, AlphaZero encoding)
        → Linear(768, 256) + ReLU + Dropout(0.3)
        → Linear(256, 64)  + ReLU + Dropout(0.3)
        → Linear(64, 1)    + Tanh
Output: 1 scalar value in [-1.0, +1.0]
        (scaled to ±15 pawn-advantage units for the minimax)
```

**Training:**
- Dataset: `kaggle_2M.parquet` (2,000,000 board positions with Stockfish centipawn evaluations)
- Split: 80% train / 10% validation / 10% test
- Optimizer: Adam (lr=0.001), Loss: MSELoss
- Batch size: 4096, Epochs: 10
- Hardware: GPU (CUDA) accelerated
- Export: Saved as PyTorch `.pth` then exported to ONNX for fast CPU inference via `onnxruntime`

**Feature Encoding:**  
Each board position is encoded as a 768-element float32 array — 12 planes (6 piece types × 2 colours), each 64 squares. This is the same AlphaZero-style encoding used by world-class engines.

### Supporting Scripts

| Script | Purpose |
|--------|---------|
| `parse_pgn.py` | Parses raw PGN game files into training data |
| `parse_evals.py` | Extracts centipawn eval labels from game data |
| `preprocess_kaggle.py` | Prepares the Kaggle dataset for training |
| `train_model.py` | Trains the first-generation win-probability model |
| `train_evals.py` | Trains the centipawn-based second-generation model |
| `train_kaggle.py` | Trains the production "Goliath" model |
| `sanity_check.py` | Validates that the model scores the starting position ≈0.5 |
| `evaluator.py` | ONNX inference wrapper (`MLEvaluator` class) |

---

## Frontend

The frontend (`frontend/`) is built with **React + Vite** and communicates with the Node.js backend over REST and WebSocket, and directly with the Python engine for analysis rendering.

### Pages

| Page | Description |
|------|-------------|
| `Login.jsx` / `Register.jsx` | JWT-based authentication forms |
| `Dashboard.jsx` | Main hub: game history tabs (active & completed), win/loss stats, PvP challenge system, and settings |
| `Play.jsx` | The main game page. Handles both bot games and real-time PvP matches |
| `Analyze.jsx` | Move-by-move game analysis with evaluation bar, move highlighting, and ideal move overlay |
| `Leaderboard.jsx` | Global ranked leaderboard of all users |
| `Profile.jsx` | User profile with avatar selection and game statistics |

### Components

| Component | Description |
|-----------|-------------|
| `ChessBoard.jsx` | The core board renderer using `react-chessboard`. Handles legal move highlighting, last-move highlighting, dragging, engine thinking overlay, and dynamic themes/pieces via `SettingsContext` |
| `PlayModal.jsx` | The game setup dialog — choose vs. Bot or vs. Player, colour, engine mode (Greedy/ML3), and search depth |
| `SettingsModal.jsx` | User settings panel: board theme selector and piece set selector |
| `ThemeToggle.jsx` | Light/Dark UI theme switcher |
| `ProtectedRoute.jsx` | JWT-gated route wrapper |

### Settings & Customisation

- **4 Board Themes:** Green (default), Blue, Classic Wood, Purple — applied globally via `SettingsContext`
- **2 Piece Sets:** Standard Unicode text pieces, or high-quality Lichess Merida SVG pieces (stored in `frontend/public/pieces/merida/`)
- Settings are persisted to `localStorage` across sessions

### Key Frontend Libraries

| Library | Purpose |
|---------|---------|
| `react-chessboard` | Chess board UI component |
| `chess.js` | Client-side FEN validation and legal move checking |
| `socket.io-client` | Real-time WebSocket communication |
| `zustand` | Lightweight global auth state management |
| `react-router-dom` | Client-side routing |

### Analysis Features
- **Evaluation Bar:** Dynamically fills based on the engine's `eval_score`, animating smoothly between moves
- **Move Timeline:** Clickable move list in the sidebar; the board updates to that exact board state
- **Ideal Move Overlay:** Click the "Ideal Move" chip to temporarily swap the board to what it would look like after the engine's recommended move (highlighted in blue). Click again to return
- **Move Highlighting:** Actual move played is highlighted in emerald; ideal move overlay is highlighted in blue
- **Navigation:** Prev/Next buttons in the sidebar, plus `←` / `→` arrow key keyboard shortcuts

---

## Node.js Backend

The Express.js server (`backend-node/`) handles all user-facing persistence and real-time communication.

### MongoDB Models

| Model | Fields |
|-------|--------|
| `User` | `username`, `password_hash`, `avatar`, `created_at` |
| `Game` | `user_id`, `game_type` (bot/pvp), `white_player_id`, `black_player_id`, `moves[]`, `result`, `player_color`, `engine_mode`, `engine_depth`, `current_state`, `duration` |
| `Challenge` | `sender_id`, `receiver_id`, `status`, `created_at` |

### API Routes

| Route | Description |
|-------|-------------|
| `POST /api/auth/register` | Create a new account |
| `POST /api/auth/login` | Login and receive a JWT |
| `GET  /api/leaderboard` | Fetch global ranked leaderboard |
| `POST /api/games` | Start a new game session |
| `GET  /api/games/:id` | Fetch game state by ID |
| `POST /api/games/:id/move` | Submit a human move; triggers engine response for bot games |
| `POST /api/games/:id/engine-move-only` | Trigger the engine's opening move (when human plays black) |
| `GET  /api/games/:id/analyze` | Run full game analysis via the Python engine |
| `GET  /api/games/my-games` | Fetch game history for the current user |
| `POST /api/challenges/:id/accept` | Accept a PvP challenge |

### Real-time WebSockets (`socket.io`)

- Clients join named rooms (`join_game`, `join_user`) upon connecting
- The server emits `engine_move` events when the Python engine responds with a move
- Challenge notifications (`new_challenge`, `challenge_accepted`) are pushed to individual user rooms in real-time

---

## Python FastAPI Backend

The Python engine server (`backend-python/main.py`) is a dedicated microservice for CPU-intensive computation.

### Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/move` | POST | Given a game state and engine config, returns the best move |
| `/engine-move-only` | POST | Triggers a single engine move (used by Node.js after a human move) |
| `/analyze` | POST | Replays an entire game from move history, capturing evaluation scores and ideal moves at every step |

### Startup Preloading
On startup, the FastAPI server pre-instantiates **all 6 engine combinations** (modes: `greedy`, `ml3` × depths: 1, 2, 3) into a global dictionary. This eliminates cold-start latency and means every move request is served from a warm, preloaded model.

---

## Setup & Installation

### Prerequisites
- **Python 3.8+**
- **Node.js 18+**
- **MongoDB** (local on `mongodb://localhost:27017`, or configure via `.env`)

### 1. Python Environment

From the root `chess_webapp` directory:

```bash
# Create a virtual environment
python -m venv venv

# Activate it
# Windows PowerShell:
.\venv\Scripts\Activate.ps1
# Windows CMD:
.\venv\Scripts\activate.bat
# macOS / Linux:
source venv/bin/activate

# Install all Python dependencies
pip install --upgrade pip
pip install -r requirements.txt
```

### 2. Node.js Backend

```bash
cd backend-node
npm install
```

Create a `.env` file inside `backend-node/` with your config:
```
MONGO_URI=mongodb://localhost:27017/stonkfish
JWT_SECRET=your_secret_key_here
PORT=5000
```

### 3. React Frontend

```bash
cd frontend
npm install
```

---

## Running the Full Stack

You need **three terminal windows** running simultaneously.

### Terminal 1 — Python Engine (from `chess_webapp/` root, with venv active)
```bash
uvicorn backend-python.main:app --reload --port 8000
```
> The engine preloads all ML models into RAM. Allow 5–10 seconds for startup.

### Terminal 2 — Node.js Backend (from `backend-node/`)
```bash
npm run dev
```
> Starts the Express server on port 5000.

### Terminal 3 — React Frontend (from `frontend/`)
```bash
npm run dev
```
> Starts the Vite dev server, typically at `http://localhost:5173`.

Open your browser and navigate to `http://localhost:5173`.

---

## Developer Utilities

### Engine Arena (`arena2.py`)
Runs an automated match in the terminal between **David** (C++ Greedy, Depth 5) and **Goliath** (ML3 Neural Net, Depth 2) to benchmark engine performance:
```bash
python arena2.py
```

### Legacy GUI (`baseline.py`)
The original Tkinter desktop GUI — a complete, standalone chess game that predates the web app:
```bash
python baseline.py
```

### Piece Downloader (`download_pieces.js`)
Downloads the Lichess Merida SVG piece set into `frontend/public/pieces/merida/`:
```bash
node download_pieces.js
```

---

## Running Tests

Unit and end-to-end tests are in the `tests/` directory and `test_e2e.py`:

```bash
pytest
```

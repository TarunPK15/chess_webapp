# Stonkfish Chess Web App

A full-stack, state-of-the-art chess application featuring a custom chess engine, machine-learning-based evaluation, and a modern, responsive web interface. 

## Features & Achievements

We have transformed Stonkfish from a simple GUI script into a robust, distributed microservices architecture:

1. **Modern Frontend (React + Vite)**
   - **Play Modes:** Play locally against a friend, or challenge the internal Stonkfish engine (Greedy or ML-based modes with configurable depths).
   - **Post-Game Analysis:** Review games move-by-move. The board displays the evaluation bar, highlights actual moves played, and allows you to dynamically overlay the engine's "Ideal Move" on the board.
   - **User Customization:** A fully integrated settings panel allowing you to swap between distinct board themes (Green, Blue, Classic Wood, Purple) and piece sets (Unicode text or high-quality Lichess Merida SVGs).
   - **Live Leaderboards & Profiles:** Track your game stats (Win/Loss, average moves, rating).
   
2. **Node.js Express Backend**
   - Handles user authentication (JWT), profiles, leaderboards, and persistent game storage using MongoDB.
   - Handles real-time communication for PvP matches and challenges.

3. **Python Engine Backend (FastAPI)**
   - Hosts the core `ChessEngine` using FastAPI. 
   - Exposes REST endpoints to calculate the "next best move" or to perform full-game analysis move-by-move.
   - Computes game state snapshots using deep-copied boards for correct historical timeline generation.

4. **Machine Learning Evaluator**
   - Uses `onnxruntime` to run a compiled neural network (`ml/evaluator_kaggle.onnx`).
   - The engine can operate in **Greedy** mode (simple material counting) or **ML3** mode (using the neural network to evaluate positional advantages).
   - Pre-loads into memory during the FastAPI startup to guarantee low-latency move generation.

---

## Prerequisites

Before setting up the project, make sure you have:
1. **Python 3.8+** (for the engine and ML backend)
2. **Node.js 18+** (for the web backend and frontend)
3. **MongoDB** (running locally on `mongodb://localhost:27017` or configured via `.env`)

---

## Installation & Setup

### 1. Python Backend (Engine API)

The Python backend powers the chess engine and analysis tools.

Navigate to the project root and create a virtual environment:
```bash
python -m venv venv
```

Activate the environment:
- **Windows PowerShell:** `.\venv\Scripts\Activate.ps1`
- **Windows CMD:** `.\venv\Scripts\activate.bat`
- **macOS / Linux:** `source venv/bin/activate`

Install dependencies:
```bash
pip install --upgrade pip
pip install -r requirements.txt
```

### 2. Node.js Backend (User API)

The Node.js backend handles user accounts, stats, and database interactions.

Navigate to the `backend-node` folder:
```bash
cd backend-node
npm install
```

Ensure your MongoDB instance is running. (By default, the app looks for `mongodb://localhost:27017/chess_db`).

### 3. React Frontend (Web App)

Navigate to the `frontend` folder:
```bash
cd frontend
npm install
```

---

## Running the Application

To run the full stack, you will need three separate terminal windows.

### Terminal 1: Python Engine
Make sure your virtual environment is activated! Run this from the root `chess_webapp` directory:
```bash
uvicorn backend-python.main:app --reload --port 8000
```
*Note: The engine preloads the ML models into RAM on startup, which may take 5-10 seconds.*

### Terminal 2: Node.js Server
From the `backend-node` directory:
```bash
npm run dev
```
*This starts the Express server (typically on port 5000).*

### Terminal 3: Vite Frontend
From the `frontend` directory:
```bash
npm run dev
```
*This starts the React development server (typically on port 5173).*

Open your browser and navigate to the localhost URL provided by Vite (e.g., `http://localhost:5173`) to play Stonkfish!

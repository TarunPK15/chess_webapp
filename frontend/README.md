# Stonkfish Frontend (React + Vite)

This directory contains the user interface for the Stonkfish Chess Web App, built with React and Vite.

## Overview
The frontend connects to the **Node.js Express Backend** (for authentication, challenges, and user stats) and dynamically interacts with the **Python FastAPI Engine** (for engine moves and game analysis).

### Key Features
- **Live Gameplay:** Real-time matches using WebSockets via `socket.io-client`.
- **Game Analysis:** Move-by-move breakdown, evaluation bar, and the "Ideal Move" overlay.
- **Customizable Interface:** Choose from 4 board themes and between Unicode text pieces or high-quality Lichess Merida SVGs.

## Running the Frontend

To run the development server:

```bash
cd frontend
npm install
npm run dev
```

*Note: The frontend requires both the Node.js backend (default port 5000) and the Python Engine backend (default port 8000) to be running simultaneously to be fully functional. Please see the root `README.md` for comprehensive instructions on starting the entire stack.*

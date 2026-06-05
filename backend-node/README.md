# Stonkfish Backend (Node.js)

This directory contains the Express.js server for the Stonkfish Chess Web App.

## Overview
The Node.js backend handles user persistence, matchmaking, and proxying requests to the Python Engine.

### Key Features
- **Authentication:** JWT-based user registration and login.
- **Database:** MongoDB integration to store User profiles, Leaderboard stats, and Game Histories.
- **Real-time Engine:** Uses `socket.io` for live multiplayer challenges and game updates.
- **API Endpoints:** 
  - `/api/auth` for login/signup.
  - `/api/games` for starting games and recording moves.
  - Proxy endpoints that forward heavy engine evaluations to the Python backend.

## Running the Backend

Ensure MongoDB is running locally on `mongodb://localhost:27017` (or provide your own `.env` file).

```bash
cd backend-node
npm install
npm run dev
```

*Note: Please see the root `README.md` for comprehensive instructions on starting the entire stack.*

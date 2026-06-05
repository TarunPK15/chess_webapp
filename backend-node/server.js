require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const http = require('http'); // Added for Socket.io
const { Server } = require('socket.io'); // Added for Socket.io

const app = express();
const server = http.createServer(app); // Wrap express in standard HTTP server

// --- DEFINE ALLOWED ORIGINS ---
// This ensures both local development and your live Vercel app can connect
const allowedOrigins = [
    'https://stonkfish.vercel.app', 
    'http://localhost:5173'
];

// Initialize WebSockets with restricted CORS
const io = new Server(server, {
    cors: { 
        origin: allowedOrigins, 
        methods: ['GET', 'POST'],
        credentials: true
    }
});

// Make 'io' globally accessible to our routes (like game.js)
app.set('io', io);

// WebSocket Connection Logic
io.on('connection', (socket) => {
    console.log(`🔌 New client connected: ${socket.id}`);
    
    // Clients will join a room named after their game ID
    socket.on('join_game', (gameId) => {
        socket.join(gameId);
        console.log(`Client joined game room: ${gameId}`);
    });

    socket.on('join_user', (userId) => {
        socket.join(`user_${userId}`);
    });

    socket.on('disconnect', () => {
        console.log(`❌ Client disconnected: ${socket.id}`);
    });
});

// Middleware - Restricted Express CORS
app.use(cors({
    origin: function (origin, callback) {
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin) return callback(null, true);
        
        if (allowedOrigins.indexOf(origin) === -1) {
            var msg = 'The CORS policy for this site does not allow access from the specified Origin.';
            return callback(new Error(msg), false);
        }
        return callback(null, true);
    },
    credentials: true
}));
app.use(express.json());

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/leaderboard', require('./routes/leaderboard'));
app.use('/api/games', require('./routes/game')); 
app.use('/api/challenges', require('./routes/challenge')); 

// Database Connection
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('✅ Connected to MongoDB Atlas'))
    .catch((err) => console.error('❌ MongoDB connection error:', err));

const PORT = process.env.PORT || 5000;
// CRITICAL: use server.listen instead of app.listen for WebSockets!
server.listen(PORT, () => {
    console.log(`🚀 Node API & WebSockets running on port ${PORT}`);
});
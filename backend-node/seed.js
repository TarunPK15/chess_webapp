require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/User');

mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('✅ Connected to MongoDB for Seeding'))
    .catch((err) => console.error('❌ MongoDB connection error:', err));

const seedDatabase = async () => {
    try {
        // Clear out old test users
        await User.deleteMany({ username: { $in: ['GM_Magnus', 'Tactical_Tina', 'Rookie_Ron'] } });

        const salt = await bcrypt.genSalt(10);
        const password_hash = await bcrypt.hash('StonkPassword123!', salt);

        const testUsers = [
            {
                username: 'GM_Magnus',
                password_hash: password_hash,
                games_played: 150,
                wins: 120, // 80% win rate
                avg_moves: 35
            },
            {
                username: 'Tactical_Tina',
                password_hash: password_hash,
                games_played: 45,
                wins: 25, // ~55% win rate
                avg_moves: 42
            },
            {
                username: 'Rookie_Ron',
                password_hash: password_hash,
                games_played: 10,
                wins: 1, // 10% win rate
                avg_moves: 18
            }
        ];

        await User.insertMany(testUsers);
        console.log('🌱 3 Test Users successfully seeded into the database!');
        process.exit();

    } catch (error) {
        console.error('❌ Seeding Error:', error);
        process.exit(1);
    }
};

seedDatabase();
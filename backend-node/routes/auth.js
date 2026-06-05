const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const router = express.Router();

router.post('/register', async (req, res) => {
    try {
        const { username, password } = req.body;
        let user = await User.findOne({ username });
        if (user) return res.status(400).json({ message: 'User already exists' });

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Map frontend 'password' to backend 'password_hash'
        user = new User({
            username,
            password_hash: hashedPassword
        });
        await user.save();

        const payload = { userId: user._id, username: user.username };
        const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '7d' });
        
        res.status(201).json({ 
            token, 
            user: {
                ...payload,
                email: user.email,
                avatar_piece: user.avatar_piece,
                avatar_color: user.avatar_color
            } 
        });
    } catch (error) {
        console.error("Registration Error:", error);
        res.status(500).json({ message: 'Server error during registration' });
    }
});

router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const user = await User.findOne({ username });
        if (!user) return res.status(400).json({ message: 'Invalid credentials' });

        // Compare against password_hash
        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) return res.status(400).json({ message: 'Invalid credentials' });

        const payload = { userId: user._id, username: user.username };
        const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '7d' });
        
        res.json({ 
            token, 
            user: {
                ...payload,
                email: user.email,
                avatar_piece: user.avatar_piece,
                avatar_color: user.avatar_color
            } 
        });
    } catch (error) {
        console.error("Login Error:", error);
        res.status(500).json({ message: 'Server error during login' });
    }
});

// @route   PATCH /api/auth/profile
// @desc    Update user profile details
router.patch('/profile', require('../middleware/auth'), async (req, res) => {
    try {
        const { email, avatar_piece, avatar_color } = req.body;
        const user = await User.findById(req.user.userId);
        
        if (!user) return res.status(404).json({ message: 'User not found' });

        if (email !== undefined) user.email = email;
        if (avatar_piece !== undefined) user.avatar_piece = avatar_piece;
        if (avatar_color !== undefined) user.avatar_color = avatar_color;

        await user.save();
        
        res.json({
            message: 'Profile updated successfully',
            user: {
                username: user.username,
                email: user.email,
                avatar_piece: user.avatar_piece,
                avatar_color: user.avatar_color
            }
        });
    } catch (error) {
        console.error("Profile Update Error:", error);
        res.status(500).json({ message: 'Server error during profile update' });
    }
});

module.exports = router;
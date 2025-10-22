require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Profile } = require('./db');
const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('.'));

// Get profile data
app.get('/api/profile/:userId', async (req, res) => {
    try {
        const profile = await Profile.findOne({ userId: req.params.userId });
        if (!profile) {
            return res.status(404).json({ error: 'Profile not found' });
        }
        res.json(profile);
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

// Update profile data
app.put('/api/profile/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const updateData = req.body;
        
        const profile = await Profile.findOneAndUpdate(
            { userId },
            { $set: updateData },
            { new: true, upsert: true }
        );
        
        res.json(profile);
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

// Increment view count
app.post('/api/profile/:userId/view', async (req, res) => {
    try {
        const profile = await Profile.findOneAndUpdate(
            { userId: req.params.userId },
            { $inc: { viewCount: 1 } },
            { new: true }
        );
        
        if (!profile) {
            return res.status(404).json({ error: 'Profile not found' });
        }
        
        res.json({ viewCount: profile.viewCount });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

// Update status
app.put('/api/profile/:userId/status', async (req, res) => {
    try {
        const { status } = req.body;
        const profile = await Profile.findOneAndUpdate(
            { userId: req.params.userId },
            { 
                $set: { 
                    status,
                    lastActiveTime: status === 'offline' ? Date.now() : undefined
                }
            },
            { new: true }
        );
        
        if (!profile) {
            return res.status(404).json({ error: 'Profile not found' });
        }
        
        res.json({ status: profile.status, lastActiveTime: profile.lastActiveTime });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '127.0.0.1', (err) => {
    if (err) {
        console.error('Error starting server:', err);
        return;
    }
    console.log(`Server running on port ${PORT}`);
}); 
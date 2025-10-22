const mongoose = require('mongoose');

// MongoDB connection URI (replace with your actual MongoDB URI)
const MONGODB_URI = process.env.MONGODB_URI || '';

// Connect to MongoDB
mongoose.connect(MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => {
    console.log('Connected to MongoDB');
}).catch((error) => {
    console.error('MongoDB connection error:', error);
});

// Profile Schema
const profileSchema = new mongoose.Schema({
    userId: {
        type: String,
        required: true,
        unique: true
    },
    username: {
        type: String,
        required: true
    },
    avatar: String,
    banner: String,
    accentColor: String,
    status: {
        type: String,
        enum: ['online', 'idle', 'dnd', 'offline'],
        default: 'offline'
    },
    lastActiveTime: {
        type: Date,
        default: Date.now
    },
    viewCount: {
        type: Number,
        default: 0
    },
    activities: [{
        type: {
            type: String,
            required: true
        },
        name: String,
        details: String,
        state: String,
        timestamps: {
            start: Date,
            end: Date
        }
    }]
});

// Create the model
const Profile = mongoose.model('Profile', profileSchema);

module.exports = {
    Profile,
    mongoose
}; 
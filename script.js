// Configuration Discord
// Real Discord Avatar Decorations:
// - Загружает реальные GIF/PNG украшения из Discord CDN
// - Автоматически получает украшения профиля из Discord API
// - Fallback на 8 preset'ов если реальное украшение не загружается
// - Функции: testRealDecoration(), loadDecorationByAsset('asset_id'), setPreset('blue_glow')
// - Демо: showDecoration('red_angry') - показать на 5 секунд
const DISCORD_TOKEN = 'MTQxMTI2OTA4NDY3ODcyMTY0Nw.G_PgrI.VeGg4KWti0p9TTicd4GE3r_x6mfMn5VX-J4VPI';
// Public presence (no token) via Lanyard
let DISCORD_USER_ID = '1370102381441978510';
let ws = null;
let heartbeatInterval = null;
let userData = null;
let currentStatus = 'online';

// Lanyard realtime presence
let lanyardWs = null;
let lanyardHeartbeat = null;
let lanyardLastUpdateTs = 0;

// Global variable for storing user data
let storedUserData = null;

// Global variable for storing view count
let viewCounter = 0;

// Paths to icons
const statusIcons = {
    'online': 'assets/online.svg',
    'idle': 'assets/idle.svg',
    'dnd': 'assets/dnd.svg',
    'offline': 'assets/offline.svg'
};

const activityIcons = {
    'game': 'assets/game.svg',
    'spotify': 'assets/spotify.svg',
    'music': 'assets/music.svg'
};

// Update social icons
const socialIcons = {
    'music': '<i class="fas fa-music"></i>',
    'envelope': '<i class="fas fa-envelope"></i>',
    'globe': '<i class="fas fa-globe"></i>',
    'mobile': '<i class="fas fa-mobile-alt"></i>',
    'folder': '<i class="fas fa-folder"></i>'
};
// Update player icons
const playerIcons = {
    'prev': '<i class="fas fa-backward"></i>',
    'play': '<i class="fas fa-play"></i>',
    'pause': '<i class="fas fa-pause"></i>',
    'next': '<i class="fas fa-forward"></i>'
};

// CSS for activities
const activityCSS = `
    .activity-container {
        display: flex;
        align-items: center;
        margin: 10px 0;
        padding: 10px;
        background: rgba(0, 0, 0, 0.35);
        border-radius: 10px;
        border: 1px solid rgba(255,255,255,0.06);
        box-shadow: 0 6px 20px rgba(0,0,0,0.35);
    }
    .discord-activity-card {
        display: grid;
        grid-template-columns: 56px 1fr auto;
        grid-template-rows: auto auto;
        grid-column-gap: 12px;
        grid-row-gap: 2px;
        align-items: center;
        width: 100%;
    }
    .activity-cover {
        width: 56px;
        height: 56px;
        border-radius: 8px;
        overflow: hidden;
        background: #2b2d31;
        grid-row: 1 / span 2;
    }
    .activity-cover img { width: 100%; height: 100%; object-fit: cover; display:block; }
    .activity-title { color:#fff; font-weight:600; font-size:14px; }
    .activity-sub { color:#b9bbbe; font-size:12px; }
    .activity-chip { color:#b9bbbe; font-size:11px; padding:2px 8px; border-radius:999px; background:rgba(255,255,255,0.08); }
    .activity-details { margin-top: 6px; font-size: 12px; color: #b9bbbe; }
    .activity-type { font-weight: 500; margin-bottom: 2px; }
    .activity-duration { font-size: 11px; opacity: 0.9; }
`;

// Add styles
const style = document.createElement('style');
style.textContent = activityCSS;
document.head.appendChild(style);

// Add CSS styles for glowing
const glowStyles = `
    .container {
        --glow-color: rgba(255, 255, 255, 0.8);
    }

    #username {
        text-shadow: 0 0 10px var(--glow-color),
                     0 0 20px var(--glow-color),
                     0 0 30px var(--glow-color),
                     0 0 40px var(--glow-color);
    }

    .activity-name, .activity-status, #view-count, #ip-address {
        text-shadow: 0 0 5px var(--glow-color),
                     0 0 10px var(--glow-color);
    }

    .typing-cursor {
        display: inline-block;
        width: 2px;
        height: 1em;
        background: white;
        margin-left: 2px;
        animation: blink 0.7s infinite;
        vertical-align: middle;
    }

    @keyframes blink {
        0%, 100% { opacity: 1; }
        50% { opacity: 0; }
    }
`;

// Add styles to page
const styleElement = document.createElement('style');
styleElement.textContent = glowStyles;
document.head.appendChild(styleElement);

// Music playlist
const playlist = [
    {
        title: "asd",
        url: "assets/asd.mp3"
    },
];

let currentTrack = 0;

// DOM elements
const avatar = document.getElementById('avatar');
const bannerContainer = document.getElementById('banner-container');
const username = document.getElementById('username');
const statusIndicator = document.getElementById('status');
const viewCount = document.getElementById('view-count');
const ipAddress = document.getElementById('ip-address');
const activityAvatar = document.getElementById('activity-avatar');
const activityName = document.querySelector('.activity-name');
const activityStatus = document.querySelector('.activity-status');

// Player elements
const audio = document.createElement('audio');
const playPauseBtn = document.querySelector('.play-pause');
const prevBtn = document.querySelector('.prev');
const nextBtn = document.querySelector('.next');
const progress = document.querySelector('.progress');
const progressBar = document.querySelector('.progress-bar');
const currentTime = document.querySelector('.current-time');
const totalTime = document.querySelector('.total-time');

// Add global volume slider handler
const globalVolumeSlider = document.querySelector('.volume-slider-global');
const globalVolumeIcon = document.querySelector('.volume-control-global i');

// Create global audio element
window.audioPlayer = document.createElement('audio');
window.audioPlayer.volume = 1.0; // Set initial volume
document.body.appendChild(window.audioPlayer);

// Add global variable for storing last known status
let lastKnownStatus = 'offline';

// Add flag for ignoring initial updates
let ignoreInitialUpdates = true;
let readyEventReceived = false;

// Render control: debounce and diffing to avoid flicker
let _pendingProfileData = null;
let _profileDebounceTimer = null;
const PROFILE_DEBOUNCE_MS = 400;
let _lastRenderedSnapshot = {
    id: null,
    username: null,
    avatar: null,
    banner: null,
    status: null,
    activityKey: null
};

function scheduleProfileUpdate(data) {
    _pendingProfileData = { ...(_pendingProfileData || {}), ...data };
    if (_profileDebounceTimer) clearTimeout(_profileDebounceTimer);
    _profileDebounceTimer = setTimeout(() => {
        updateProfile(_pendingProfileData);
        _pendingProfileData = null;
    }, PROFILE_DEBOUNCE_MS);
}

function activityToKey(activity) {
    if (!activity) return 'none';
    const t = activity.type;
    const n = activity.name || '';
    const d = activity.details || '';
    const s = activity.state || '';
    const app = activity.application_id || '';
    const start = activity.timestamps && activity.timestamps.start ? String(activity.timestamps.start) : '';
    return [t, n, d, s, app, start].join('|');
}

// Preloader handler
document.addEventListener('DOMContentLoaded', () => {
    const preloader = document.querySelector('.preloader');
    const container = document.querySelector('.container');
    const globalVolumeSlider = document.querySelector('.volume-slider-global');
    const globalVolumeIcon = document.querySelector('.volume-control-global i');
    
    // Load view count from MongoDB
    loadViewCount();
    
    // Initialize volume slider
    function updateVolumeIcon(volume) {
        if (volume === 0) {
            globalVolumeIcon.className = 'fas fa-volume-mute';
        } else if (volume < 0.5) {
            globalVolumeIcon.className = 'fas fa-volume-down';
        } else {
            globalVolumeIcon.className = 'fas fa-volume-up';
        }
    }

    // Volume handler
    globalVolumeSlider.addEventListener('input', (e) => {
        const volume = e.target.value / 100;
        window.audioPlayer.volume = volume;
        updateVolumeIcon(volume);
    });

    // Set initial volume
    globalVolumeSlider.value = window.audioPlayer.volume * 100;
    updateVolumeIcon(window.audioPlayer.volume);
    
    // Hide preloader and show content on click
    preloader.addEventListener('click', async () => {
        preloader.classList.add('hidden');
        container.classList.add('visible');
        
        // Load and play music
        try {
            loadTrack(currentTrack);
            await window.audioPlayer.play();
            playPauseBtn.innerHTML = playerIcons.pause;
        } catch (error) {
            console.error('Error playing music:', error);
        }
        
        // Update view count only on first load
        incrementViewCount();
        
        // Connect to Discord Gateway
        connectToGateway();
        connectToLanyard();
    });
    
    // Initialize other components
    const fontAwesome = document.createElement('link');
    fontAwesome.rel = 'stylesheet';
    fontAwesome.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/5.15.4/css/all.min.css';
    document.head.appendChild(fontAwesome);

    // Update social icons
    const socialLinks = document.getElementById('social-links');
    socialLinks.innerHTML = Object.values(socialIcons).map(icon => 
        `<a href="#" class="social-icon">${icon}</a>`
    ).join('');

    // Update player icons
    prevBtn.innerHTML = playerIcons.prev;
    playPauseBtn.innerHTML = playerIcons.play;
    nextBtn.innerHTML = playerIcons.next;

    // Initialize audio handlers
    window.audioPlayer.addEventListener('timeupdate', updateTime);
    window.audioPlayer.addEventListener('ended', () => {
        // When a track ends, immediately load and play the next one
        currentTrack = (currentTrack + 1) % playlist.length;
        loadTrack(currentTrack);
        if (!window.audioPlayer.paused) {
            window.audioPlayer.play().catch(error => {
                console.error('Error playing next track after end:', error);
                // If play fails, try the next track
                currentTrack = (currentTrack + 1) % playlist.length;
                loadTrack(currentTrack);
                window.audioPlayer.play();
            });
        }
    });
    window.audioPlayer.addEventListener('error', () => {
        // If there's an error, try the next track
        console.error('Audio error occurred, trying next track');
        currentTrack = (currentTrack + 1) % playlist.length;
        loadTrack(currentTrack);
        if (!window.audioPlayer.paused) {
            window.audioPlayer.play();
        }
    });
    window.audioPlayer.addEventListener('play', () => {
        fetchDiscordUser();
    });
    window.audioPlayer.addEventListener('pause', () => {
        fetchDiscordUser();
    });

    // Player button handlers
    playPauseBtn.addEventListener('click', playPause);
    prevBtn.addEventListener('click', prevTrack);
    nextBtn.addEventListener('click', nextTrack);

    progressBar.addEventListener('click', (e) => {
        const progressBarRect = progressBar.getBoundingClientRect();
        const percent = (e.clientX - progressBarRect.left) / progressBar.offsetWidth;
        window.audioPlayer.currentTime = percent * window.audioPlayer.duration;
    });

    fetchDiscordUser();
    connectToLanyard();
    
    // Show setup guidance if needed
    setTimeout(() => {
        if (window.location.protocol === 'file:') {
            console.log('📁 Running from file:// - some features may not work');
            console.log('💡 For full functionality, run from a web server');
        }
        
        // Check for common issues and show help
        console.log(`
🔧 Quick Setup Check:
1. Is your server running? Run: checkServer()
2. Need Discord token help? Run: helpDiscordToken()
3. Full setup guide? Run: showSetup()
        `);
    }, 2000);
});

// Music track loader
function loadTrack(trackIndex) {
    try {
        window.audioPlayer.src = playlist[trackIndex].url;
        window.audioPlayer.load();
        window.audioPlayer.loop = false; // We'll handle looping ourselves
    } catch (error) {
        console.error('Error loading track:', error);
        // If loading fails, try the next track after a short delay
        setTimeout(() => {
            currentTrack = (currentTrack + 1) % playlist.length;
            loadTrack(currentTrack);
        }, 1000);
    }
}

// Play/pause handler
function playPause() {
    if (window.audioPlayer.paused) {
        window.audioPlayer.play().catch(error => {
            console.error('Error playing audio:', error);
            // If play fails, try loading the next track
            currentTrack = (currentTrack + 1) % playlist.length;
            loadTrack(currentTrack);
            window.audioPlayer.play();
        });
        playPauseBtn.innerHTML = playerIcons.pause;
    } else {
        window.audioPlayer.pause();
        playPauseBtn.innerHTML = playerIcons.play;
    }
}

// Next track handler
function nextTrack() {
    currentTrack = (currentTrack + 1) % playlist.length;
    loadTrack(currentTrack);
    if (!window.audioPlayer.paused) {
        window.audioPlayer.play().catch(error => {
            console.error('Error playing next track:', error);
            // If play fails, try the next track
            currentTrack = (currentTrack + 1) % playlist.length;
            loadTrack(currentTrack);
            window.audioPlayer.play();
        });
    }
}

// Previous track handler
function prevTrack() {
    currentTrack = (currentTrack - 1 + playlist.length) % playlist.length;
    loadTrack(currentTrack);
    if (!window.audioPlayer.paused) {
        window.audioPlayer.play().catch(error => {
            console.error('Error playing previous track:', error);
            // If play fails, try the next track
            currentTrack = (currentTrack + 1) % playlist.length;
            loadTrack(currentTrack);
            window.audioPlayer.play();
        });
    }
}

// Time update handler
function updateTime() {
    if (isNaN(window.audioPlayer.duration)) {
        currentTime.textContent = '0:00';
        totalTime.textContent = 'NaN:NaN';
        progress.style.width = '0%';
        return;
    }

    const currentMinutes = Math.floor(window.audioPlayer.currentTime / 60);
    const currentSeconds = Math.floor(window.audioPlayer.currentTime % 60);
    const totalMinutes = Math.floor(window.audioPlayer.duration / 60);
    const totalSeconds = Math.floor(window.audioPlayer.duration % 60);

    currentTime.textContent = `${currentMinutes}:${currentSeconds.toString().padStart(2, '0')}`;
    totalTime.textContent = `${totalMinutes}:${totalSeconds.toString().padStart(2, '0')}`;
    
    const progressPercent = (window.audioPlayer.currentTime / window.audioPlayer.duration) * 100;
    progress.style.width = `${progressPercent}%`;
}

// Add mouse movement handler for 3D effect
document.addEventListener('mousemove', (e) => {
    const container = document.querySelector('.container');
    const rect = container.getBoundingClientRect();
    
    // Calculate center point
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    
    // Calculate distance from center with dampening factor
    const mouseX = (e.clientX - centerX) * 0.8; // Add dampening
    const mouseY = (e.clientY - centerY) * 0.8; // Add dampening
    
    // Normalize and reduce rotation angle to 8 degrees for subtlety
    const rotateX = (mouseY / (rect.height / 2)) * 8;
    const rotateY = (mouseX / (rect.width / 2)) * 8;
    
    // Apply smooth animation with easing
    container.style.transition = 'transform 0.15s cubic-bezier(0.215, 0.61, 0.355, 1)';
    container.style.transform = `perspective(1200px) rotateX(${-rotateX}deg) rotateY(${rotateY}deg) scale3d(1.02, 1.02, 1.02)`;
});

// Return to original position with smooth transition
document.querySelector('.container').addEventListener('mouseleave', () => {
    const container = document.querySelector('.container');
    container.style.transition = 'transform 0.5s cubic-bezier(0.215, 0.61, 0.355, 1)';
    container.style.transform = 'perspective(1200px) rotateX(0) rotateY(0) scale3d(1, 1, 1)';
});

// Load view count from MongoDB
async function loadViewCount() {
    try {
        // Use relative path for local development
        const baseUrl = window.location.protocol === 'file:' ? 'http://localhost:3000' : '';
        const response = await fetch(`${baseUrl}/api/profile/${DISCORD_USER_ID}`);
        if (response.ok) {
            const profile = await response.json();
            viewCounter = profile.viewCount || 0;
        }
    } catch (error) {
        console.error('Error loading view count:', error);
        viewCounter = 0;
        
        // Show user-friendly message if server is not running
        if (error.message.includes('ERR_CONNECTION_REFUSED')) {
            console.warn('⚠️ Server not running! Please start your server with: npm start');
            document.getElementById('view-count').textContent = 'Server offline';
        }
    }
    
    const viewCountText = viewCounter === 1 ? '1 view' : 
                         `${viewCounter} views`;
    document.getElementById('view-count').textContent = viewCountText;
}

// Increment view count in MongoDB
async function incrementViewCount() {
    try {
        // Use relative path for local development
        const baseUrl = window.location.protocol === 'file:' ? 'http://localhost:3000' : '';
        const response = await fetch(`${baseUrl}/api/profile/${DISCORD_USER_ID}/view`, {
            method: 'POST'
        });
        if (response.ok) {
            const data = await response.json();
            viewCounter = data.viewCount;
            const viewCountText = viewCounter === 1 ? '1 view' : 
                                 `${viewCounter} views`;
            document.getElementById('view-count').textContent = viewCountText;
        }
    } catch (error) {
        console.error('Error incrementing view count:', error);
        
        // Show user-friendly message if server is not running
        if (error.message.includes('ERR_CONNECTION_REFUSED')) {
            console.warn('⚠️ Server not running! Please start your server with: npm start');
            document.getElementById('view-count').textContent = 'Server offline';
        }
    }
}

// Save profile data to MongoDB
async function saveProfileToMongoDB(userData) {
    try {
        const profileData = {
            userId: userData.id || DISCORD_USER_ID,
            username: userData.username,
            avatar: userData.avatar,
            banner: userData.banner,
            accentColor: userData.accent_color,
            status: userData.status || 'offline',
            lastActiveTime: userData.status === 'offline' ? Date.now() : undefined,
            activities: userData.activities || []
        };

        // Use relative path for local development
        const baseUrl = window.location.protocol === 'file:' ? 'http://localhost:3000' : '';
        const response = await fetch(`${baseUrl}/api/profile/${profileData.userId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(profileData)
        });

        if (!response.ok) {
            console.error('Error saving profile to MongoDB:', response.status);
        }
    } catch (error) {
        console.error('Error saving profile to MongoDB:', error);
        
        // Show user-friendly message if server is not running
        if (error.message.includes('ERR_CONNECTION_REFUSED')) {
            console.warn('⚠️ Server not running! Please start your server with: npm start');
        }
    }
}

// Get status handler
async function getCurrentStatus() {
    try {
        const response = await fetch('https://discord.com/api/v9/users/@me/settings', {
            headers: {
                'Authorization': DISCORD_TOKEN
            }
        });
        
        if (response.ok) {
            const settings = await response.json();
            return settings.status || 'offline';
        } else if (response.status === 401) {
            console.warn('Discord token is invalid or expired');
            return 'offline';
        }
        return 'offline';
    } catch (error) {
        console.error('Error fetching status:', error);
        return 'offline';
    }
}

// Connection state tracking
let isConnecting = false;
let reconnectAttempts = 0;
let maxReconnectAttempts = 10;
let reconnectDelay = 1000; // Start with 1 second

// Update connectToGateway handler
async function connectToGateway() {
    // Prevent multiple simultaneous connections
    if (isConnecting || (ws && ws.readyState === WebSocket.OPEN)) {
        console.log('Already connected or connecting, skipping...');
        return;
    }
    
    // Clean up existing connection
    if (ws) {
        try {
            ws.close();
        } catch (e) {
            // Ignore errors when closing
        }
        ws = null;
    }
    
    isConnecting = true;
    
    try {
        const gatewayResponse = await fetch('https://discord.com/api/v9/gateway', {
            method: 'GET'
        });
        
        if (!gatewayResponse.ok) {
            throw new Error(`Failed to get gateway URL: ${gatewayResponse.status}`);
        }
        
        const gatewayData = await gatewayResponse.json();
        
        ws = new WebSocket(`${gatewayData.url}?v=9&encoding=json`);
        
        ws.onopen = () => {
            console.log('Connected to Discord Gateway');
            isConnecting = false;
            reconnectAttempts = 0; // Reset on successful connection
            reconnectDelay = 1000; // Reset delay
            
            ws.send(JSON.stringify({
                op: 2,
                d: {
                    token: DISCORD_TOKEN,
                    intents: 32767,
                    properties: {
                        $os: 'windows',
                        $browser: 'chrome',
                        $device: 'chrome'
                    }
                }
            }));
        };
        
        ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            handleGatewayMessage(data);
        };
        
        ws.onclose = (event) => {
            console.log('Disconnected from Gateway', event.code, event.reason);
            isConnecting = false;
            clearInterval(heartbeatInterval);
            
            // Don't reconnect if authentication failed (4004)
            if (event.code === 4004) {
                console.log('Authentication failed, not reconnecting');
                return;
            }
            
            // Only reconnect if we haven't exceeded max attempts
            if (reconnectAttempts < maxReconnectAttempts) {
                reconnectAttempts++;
                const delay = Math.min(reconnectDelay * Math.pow(2, reconnectAttempts - 1), 30000); // Max 30 seconds
                console.log(`Reconnecting in ${delay}ms (attempt ${reconnectAttempts}/${maxReconnectAttempts})`);
                setTimeout(connectToGateway, delay);
            } else {
                console.log('Max reconnection attempts reached, giving up');
            }
        };
        
        ws.onerror = (error) => {
            console.error('WebSocket Error:', error);
            isConnecting = false;
        };
    } catch (error) {
        console.error('Failed to connect to Gateway:', error);
        isConnecting = false;
        
        if (reconnectAttempts < maxReconnectAttempts) {
            reconnectAttempts++;
            const delay = Math.min(reconnectDelay * Math.pow(2, reconnectAttempts - 1), 30000);
            console.log(`Retrying connection in ${delay}ms (attempt ${reconnectAttempts}/${maxReconnectAttempts})`);
            setTimeout(connectToGateway, delay);
        }
    }
}

// Обновляем функцию handleGatewayMessage
function handleGatewayMessage(data) {
    if (!data) return;

    switch (data.op) {
        case 10:
            const heartbeatInterval = data.d?.heartbeat_interval;
            if (heartbeatInterval) {
                setHeartbeat(heartbeatInterval);
            }
            break;
            
        case 0:
            if (data.t === 'READY' && data.d?.user) {
                storedUserData = {
                    ...data.d.user,
                    activities: data.d?.users?.[0]?.presence?.activities || [],
                    profile_decorations: data.d?.user?.profile_decorations || null
                };
                // Обновляем статус из API
                getCurrentStatus().then(status => {
                    if (storedUserData) {
                        updateProfile({
                            ...storedUserData,
                            status: status
                        });
                    }
                });
            }
            break;
    }
}

// Обновляем функцию fetchDiscordUser
async function fetchDiscordUser() {
    try {
        const userResponse = await fetch('https://discord.com/api/v9/users/@me', {
            headers: {
                'Authorization': DISCORD_TOKEN
            }
        });
        
        if (!userResponse.ok) {
            if (userResponse.status === 401) {
                console.warn('Discord token is invalid or expired, skipping Discord API calls');
                return;
            }
            throw new Error(`Failed to fetch user data: ${userResponse.status}`);
        }
        
        const userData = await userResponse.json();
        // Save ID for Lanyard if available
        if (userData && userData.id) {
            if (DISCORD_USER_ID !== String(userData.id)) {
                DISCORD_USER_ID = String(userData.id);
                // Reconnect Lanyard with the correct ID
                try { if (lanyardWs) lanyardWs.close(); } catch(_) {}
                connectToLanyard();
            }
        }
        const status = await getCurrentStatus();
        
        // Получаем украшения профиля из основного ответа пользователя
        let profileDecorations = null;
        
        // Проверяем есть ли украшения в основном ответе пользователя
        if (userData.avatar_decoration_data) {
            profileDecorations = userData.avatar_decoration_data;
            console.log('Found decorations in user data:', profileDecorations);
        } else {
            // Пробуем получить через отдельный запрос
            try {
                const decorationsResponse = await fetch('https://discord.com/api/v9/users/@me', {
                    headers: {
                        'Authorization': DISCORD_TOKEN
                    }
                });
                
                if (decorationsResponse.ok) {
                    const userDataWithDecorations = await decorationsResponse.json();
                    console.log('User data with decorations:', userDataWithDecorations);
                    
                    profileDecorations = userDataWithDecorations.avatar_decoration_data || null;
                    console.log('Found decorations in separate request:', profileDecorations);
                } else {
                    console.log('Decorations response not ok:', decorationsResponse.status);
                }
            } catch (error) {
                console.log('Profile decorations not available:', error);
            }
        }
        
        storedUserData = {
            ...userData,
            status: status,
            profile_decorations: profileDecorations
        };
        
        updateProfile(storedUserData);
        
    } catch (error) {
        console.error('Error fetching Discord data:', error);
        if (storedUserData) {
            updateProfile(storedUserData);
        } else {
            username.textContent = 'prince';
            updateStatusIndicator('offline');
        }
    }
}

// Установка heartbeat
function setHeartbeat(interval) {
    if (heartbeatInterval) clearInterval(heartbeatInterval);
    
    heartbeatInterval = setInterval(() => {
        if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
                op: 1,
                d: null
            }));
        }
    }, interval);
}

// Update status texts (English)
const STATUS_TEXTS = {
    'online': 'Online',
    'idle': 'Idle',
    'dnd': 'Do Not Disturb',
    'offline': 'Offline'
};

// Update time format
function formatTimeSince(timestamp) {
    const now = Date.now();
    const diff = Math.floor((now - timestamp) / 1000); // difference in seconds

    if (diff < 60) {
        return 'just now';
    } else if (diff < 3600) {
        const minutes = Math.floor(diff / 60);
        return `${minutes} ${minutes === 1 ? 'minute' : 'minutes'} ago`;
    } else if (diff < 86400) {
        const hours = Math.floor(diff / 3600);
        return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`;
    } else {
        const days = Math.floor(diff / 86400);
        return `${days} ${days === 1 ? 'day' : 'days'} ago`;
    }
}

// Добавляем переменную для хранения времени последней активности
let lastActiveTime = Date.now();

// Add title animation function
function animateTitle(text) {
    let isAnimating = true;
    let fullText = text;
    let currentText = '';
    let isTyping = true;
    let cursorVisible = true;

    function updateTitle() {
        if (!isAnimating) return;

        if (isTyping) {
            if (currentText.length < fullText.length) {
                currentText = fullText.slice(0, currentText.length + 1);
                document.title = currentText + (cursorVisible ? '|' : '');
                setTimeout(updateTitle, 100);
            } else {
                setTimeout(() => {
                    isTyping = false;
                    updateTitle();
                }, 2000);
            }
        } else {
            if (currentText.length > 0) {
                currentText = currentText.slice(0, -1);
                document.title = currentText + (cursorVisible ? '|' : '');
                setTimeout(updateTitle, 50);
            } else {
                setTimeout(() => {
                    isTyping = true;
                    updateTitle();
                }, 1000);
            }
        }
        cursorVisible = !cursorVisible;
    }

    // Start animation
    updateTitle();

    // Return function to stop animation
    return () => {
        isAnimating = false;
    };
}

// Обновляем функцию обновления статус-индикатора
function updateStatusIndicator(status) {
    if (!status) return;
    
    const statusIndicator = document.getElementById('status');
    if (!statusIndicator) return;

    const colors = {
        'online': '#43b581',
        'idle': '#faa61a',
        'dnd': '#f04747',
        'offline': '#747f8d'
    };
    
    statusIndicator.style.backgroundColor = colors[status] || colors.offline;
}

// Duration formatter (English)
function formatActivityDuration(startTime) {
    if (!startTime) return '';
    const now = Date.now();
    const diff = Math.floor((now - startTime) / 1000); // разница в секундах

    if (diff < 60) {
        return 'just now';
    } else if (diff < 3600) {
        const minutes = Math.floor(diff / 60);
        return `${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`;
    } else if (diff < 86400) {
        const hours = Math.floor(diff / 3600);
        return `${hours} ${hours === 1 ? 'hour' : 'hours'}`;
    } else {
        const days = Math.floor(diff / 86400);
        return `${days} ${days === 1 ? 'day' : 'days'}`;
    }
}

// Обновляем функцию updateProfile для отображения активности
function updateProfile(userData) {
    if (!userData) return;
    console.log('Updating profile with:', userData);
    
    // Защита от множественных обновлений украшений
    if (window._isUpdatingDecorations) {
        console.log('Decoration update already in progress, skipping...');
        return;
    }

    try {
        // Check diff to prevent unnecessary rerenders
        const primaryActivity = userData.activities && userData.activities.length ? selectPrimaryActivity(userData.activities) : null;
        const nextSnapshot = {
            id: userData.id || _lastRenderedSnapshot.id,
            username: userData.username || _lastRenderedSnapshot.username,
            avatar: userData.avatar || _lastRenderedSnapshot.avatar,
            banner: userData.banner || _lastRenderedSnapshot.banner,
            status: userData.status || _lastRenderedSnapshot.status,
            activityKey: activityToKey(primaryActivity)
        };
        const unchanged = Object.keys(nextSnapshot).every(k => nextSnapshot[k] === _lastRenderedSnapshot[k]);
        if (unchanged) {
            return; // skip rerender
        }
        _lastRenderedSnapshot = nextSnapshot;

        // Save profile data to MongoDB
        saveProfileToMongoDB(userData);

        // Update title with username
        if (userData.username) {
            if (window._stopTitleAnimation) {
                window._stopTitleAnimation();
            }
            window._stopTitleAnimation = animateTitle(userData.username);
        }

        // Обновляем аватар и маленькую аватарку со статусом
        if (userData.id && userData.avatar) {
            const avatarUrl = `https://cdn.discordapp.com/avatars/${userData.id}/${userData.avatar}`;
            const smallAvatarUrl = `${avatarUrl}?size=128`;
            
            const img = new Image();
            img.onload = () => {
                try {
                    // Создаем контейнер для большой аватарки если его нет
                    let avatarContainer = avatar.parentElement;
                    if (!avatarContainer?.classList?.contains('avatar-container')) {
                        const newContainer = document.createElement('div');
                        newContainer.className = 'avatar-container';
                        newContainer.style.position = 'relative';
                        newContainer.style.display = 'inline-block';
                        avatar.parentElement.insertBefore(newContainer, avatar);
                        newContainer.appendChild(avatar);
                        avatarContainer = newContainer;
                    }

                    avatar.src = `${avatarUrl}?size=512`;
                    activityAvatar.src = smallAvatarUrl;

                    // Добавляем украшения профиля если они есть
                    if (userData.profile_decorations) {
                        window._isUpdatingDecorations = true;
                        updateProfileDecorations(avatarContainer, userData.profile_decorations);
                        setTimeout(() => {
                            window._isUpdatingDecorations = false;
                        }, 1000);
                    }

                    // Обновляем статус для большой аватарки
                    if (avatarContainer) {
                        const mainStatusIndicator = document.createElement('div');
                        mainStatusIndicator.className = 'status-indicator';
                        mainStatusIndicator.style.cssText = `
                            position: absolute;
                            bottom: 12%;
                            right: 12%;
                            width: 20px;
                            height: 20px;
                            border-radius: 50%;
                            border: 3px solid #2f3136;
                            background-color: ${getStatusColor(userData.status || 'offline')};
                            z-index: 2;
                        `;

                        // Удаляем старый индикатор если есть
                        const oldMainIndicator = avatarContainer.querySelector('.status-indicator');
                        if (oldMainIndicator) {
                            oldMainIndicator.remove();
                        }
                        avatarContainer.appendChild(mainStatusIndicator);
                    }
                } catch (error) {
                    console.error('Error updating avatar container:', error);
                }
            };
            img.onerror = (e) => {
                console.error('Failed to load avatar:', e);
                const defaultAvatar = `https://cdn.discordapp.com/embed/avatars/${userData.discriminator % 5}.png`;
                if (avatar) avatar.src = defaultAvatar;
                if (activityAvatar) activityAvatar.src = defaultAvatar;
            };
            img.src = avatarUrl;
        }

        // Обновляем баннер
        if (userData.banner) {
            const bannerUrl = `https://cdn.discordapp.com/banners/${userData.id}/${userData.banner}?size=600`;
            const bannerImg = new Image();
            bannerImg.onload = () => {
                bannerContainer.style.backgroundImage = `url(${bannerUrl})`;
                bannerContainer.style.backgroundColor = 'transparent';
            };
            bannerImg.onerror = () => {
                if (userData.accent_color) {
                    bannerContainer.style.backgroundImage = 'none';
                    bannerContainer.style.backgroundColor = '#' + userData.accent_color.toString(16).padStart(6, '0');
                } else {
                    bannerContainer.style.backgroundImage = 'none';
                    bannerContainer.style.backgroundColor = '#000000';
                }
            };
            bannerImg.src = bannerUrl;
        } else if (userData.accent_color) {
            bannerContainer.style.backgroundImage = 'none';
            bannerContainer.style.backgroundColor = '#' + userData.accent_color.toString(16).padStart(6, '0');
        } else {
            bannerContainer.style.backgroundImage = 'none';
            bannerContainer.style.backgroundColor = '#000000';
        }

        // Обновляем имя пользователя с анимацией
        if (userData.username) {
            if (username._stopAnimation) {
                username._stopAnimation();
            }
            username._stopAnimation = typeText(username, userData.username);
            activityName.textContent = userData.username;
        }
        
        ipAddress.textContent = '♥ 0.1.0.1.0.1.0.1.0';
        
        const userStatus = userData.status || 'offline';
        
        // Обновляем время последней активности и статус
        if (userStatus === 'online' || userStatus === 'dnd') {
            lastActiveTime = Date.now();
            if (activityStatus) activityStatus.textContent = STATUS_TEXTS[userStatus];
        } else {
            const timeAgo = formatTimeSince(lastActiveTime);
            if (activityStatus) {
                activityStatus.textContent = `${STATUS_TEXTS[userStatus]} ${timeAgo}`;
            }
            
            if (!window._statusUpdateInterval) {
                window._statusUpdateInterval = setInterval(() => {
                    if (userData.status === 'idle' || userData.status === 'offline') {
                        const newTimeAgo = formatTimeSince(lastActiveTime);
                        if (activityStatus) {
                            activityStatus.textContent = `${STATUS_TEXTS[userData.status]} ${newTimeAgo}`;
                        }
                    }
                }, 60000);
            }
        }

        // Обновляем маленький индикатор статуса
        const smallAvatarContainer = activityAvatar?.parentElement;
        if (smallAvatarContainer) {
            smallAvatarContainer.style.position = 'relative';
            
            const smallStatusIndicator = document.createElement('div');
            smallStatusIndicator.className = 'status-indicator';
            smallStatusIndicator.style.cssText = `
                position: absolute;
                bottom: -2px;
                right: -2px;
                width: 12px;
                height: 12px;
                border-radius: 50%;
                border: 2px solid #2f3136;
                background-color: ${getStatusColor(userStatus)};
            `;
            
            const oldIndicator = smallAvatarContainer.querySelector('.status-indicator');
            if (oldIndicator) {
                oldIndicator.remove();
            }
            
            smallAvatarContainer.appendChild(smallStatusIndicator);
        }

        updateStatusIndicator(userStatus);

        // Обновляем информацию об активности
        const activityDetails = document.querySelector('.activity-details');
        const activityType = document.querySelector('.activity-type');
        const activityDuration = document.querySelector('.activity-duration');

        if (primaryActivity) {
            const activity = primaryActivity;
            const { title, subtitle } = toEnglishActivityText(activity);
            const durationText = activity.timestamps && activity.timestamps.start ? formatActivityDuration(activity.timestamps.start) : '';
            if (activityType) activityType.textContent = title;
            if (activityDuration) activityDuration.textContent = durationText;
            if (activityDetails) activityDetails.style.display = 'block';
            renderDiscordActivityCard(activity, subtitle, durationText);
        } else {
            if (activityType) activityType.textContent = '';
            if (activityDuration) activityDuration.textContent = '';
            if (activityDetails) activityDetails.style.display = 'none';
            renderDiscordActivityCard(null, '', '');
        }

    } catch (error) {
        console.error('Error in updateProfile:', error);
    }
}

// Lanyard connection state tracking
let isLanyardConnecting = false;
let lanyardReconnectAttempts = 0;
let maxLanyardReconnectAttempts = 10;
let lanyardReconnectDelay = 2000; // Start with 2 seconds

// ---- Lanyard presence (public, no token) ----
function connectToLanyard() {
    // Prevent multiple simultaneous connections
    if (isLanyardConnecting || (lanyardWs && (lanyardWs.readyState === WebSocket.OPEN || lanyardWs.readyState === WebSocket.CONNECTING))) {
        console.log('Lanyard already connected or connecting, skipping...');
        return;
    }
    
    // Clean up existing connection
    if (lanyardWs) {
        try {
            lanyardWs.close();
        } catch (e) {
            // Ignore errors when closing
        }
        lanyardWs = null;
    }
    
    isLanyardConnecting = true;
    
    try {
        lanyardWs = new WebSocket('wss://api.lanyard.rest/socket');

        lanyardWs.onopen = () => {
            console.log('Connected to Lanyard');
            isLanyardConnecting = false;
            lanyardReconnectAttempts = 0; // Reset on successful connection
            lanyardReconnectDelay = 2000; // Reset delay
            
            // Identify and subscribe
            lanyardWs.send(JSON.stringify({ op: 2, d: { subscribe_to_id: String(DISCORD_USER_ID) } }));
        };

        lanyardWs.onmessage = (ev) => {
            const payload = JSON.parse(ev.data);
            if (payload.op === 1 && typeof payload.d?.heartbeat_interval === 'number') {
                if (lanyardHeartbeat) clearInterval(lanyardHeartbeat);
                lanyardHeartbeat = setInterval(() => {
                    try { lanyardWs.send(JSON.stringify({ op: 3 })); } catch (_) {}
                }, payload.d.heartbeat_interval);
            }
            // Initial state or updates
            if (payload.t === 'INIT_STATE' || payload.t === 'PRESENCE_UPDATE') {
                const d = payload.d || payload.data || payload;
                const p = d?.data || d;
                if (!p) return;
                const enriched = mapLanyardToUser(p);
                storedUserData = { ...(storedUserData || {}), ...enriched };
                scheduleProfileUpdate(storedUserData);
                lanyardLastUpdateTs = Date.now();
            }
        };

        lanyardWs.onclose = (event) => {
            console.log('Disconnected from Lanyard', event.code, event.reason);
            isLanyardConnecting = false;
            if (lanyardHeartbeat) clearInterval(lanyardHeartbeat);
            
            // Only reconnect if we haven't exceeded max attempts
            if (lanyardReconnectAttempts < maxLanyardReconnectAttempts) {
                lanyardReconnectAttempts++;
                const delay = Math.min(lanyardReconnectDelay * Math.pow(2, lanyardReconnectAttempts - 1), 30000); // Max 30 seconds
                console.log(`Reconnecting to Lanyard in ${delay}ms (attempt ${lanyardReconnectAttempts}/${maxLanyardReconnectAttempts})`);
                setTimeout(connectToLanyard, delay);
            } else {
                console.log('Max Lanyard reconnection attempts reached, giving up');
            }
        };

        lanyardWs.onerror = (error) => {
            console.error('Lanyard WebSocket Error:', error);
            isLanyardConnecting = false;
        };
    } catch (error) {
        console.error('Failed to connect to Lanyard:', error);
        isLanyardConnecting = false;
        
        if (lanyardReconnectAttempts < maxLanyardReconnectAttempts) {
            lanyardReconnectAttempts++;
            const delay = Math.min(lanyardReconnectDelay * Math.pow(2, lanyardReconnectAttempts - 1), 30000);
            console.log(`Retrying Lanyard connection in ${delay}ms (attempt ${lanyardReconnectAttempts}/${maxLanyardReconnectAttempts})`);
            setTimeout(connectToLanyard, delay);
        }
    }
}

function mapLanyardToUser(p) {
    // p has: discord_user, discord_status, activities, spotify, etc.
    const du = p.discord_user || p.user || {};
    const activities = Array.isArray(p.activities) ? p.activities : (Array.isArray(p?.kv?.activities) ? p.kv.activities : []);
    // Convert Lanyard structure to our updateProfile() shape
    return {
        id: du.id,
        username: du.username,
        discriminator: Number(du.discriminator || 0),
        avatar: du.avatar,
        status: p.discord_status || 'offline',
        activities: activities.map(a => ({
            type: a.type,
            name: a.name,
            details: a.details,
            state: a.state,
            timestamps: a.timestamps ? { start: a.timestamps.start } : undefined
        })),
        // banner/accent not available here; keep previous values if any
        banner: (storedUserData && storedUserData.banner) || undefined,
        accent_color: (storedUserData && storedUserData.accent_color) || undefined,
        profile_decorations: (storedUserData && storedUserData.profile_decorations) || null
    };
}

// REST fallback if socket gives nothing
async function fetchLanyardOnce() {
    try {
        const res = await fetch(`https://api.lanyard.rest/v1/users/${encodeURIComponent(String(DISCORD_USER_ID))}`);
        const json = await res.json();
        if (json && json.success && json.data) {
            const enriched = mapLanyardToUser(json.data);
            storedUserData = { ...(storedUserData || {}), ...enriched };
            scheduleProfileUpdate(storedUserData);
            lanyardLastUpdateTs = Date.now();
            return true;
        }
        if (res.status === 404) {
            showPresenceUnavailable('Пользователь не отслеживается Lanyard (404).');
        }
        return false;
    } catch (_) {
        showPresenceUnavailable('Не удалось получить активность через Lanyard.');
        return false;
    }
}

// Periodic watchdog for presence
setInterval(() => {
    const tooOld = Date.now() - lanyardLastUpdateTs > 15000; // 15s without updates
    if (tooOld) {
        fetchLanyardOnce();
    }
}, 5000);

// Allow manual change of Discord ID from console
window.setDiscordId = (id) => {
    if (!id) return;
    DISCORD_USER_ID = String(id);
    try { if (lanyardWs) lanyardWs.close(); } catch(_) {}
    connectToLanyard();
    fetchLanyardOnce();
};

// Function to check if server is running
async function checkServerStatus() {
    try {
        const baseUrl = window.location.protocol === 'file:' ? 'http://localhost:3000' : '';
        const response = await fetch(`${baseUrl}/api/health`, { method: 'GET' });
        return response.ok;
    } catch (error) {
        return false;
    }
}

// Function to manually reset all connections
window.resetConnections = () => {
    console.log('Resetting all connections...');
    
    // Reset Discord Gateway connection
    if (ws) {
        try { ws.close(); } catch(_) {}
        ws = null;
    }
    isConnecting = false;
    reconnectAttempts = 0;
    
    // Reset Lanyard connection
    if (lanyardWs) {
        try { lanyardWs.close(); } catch(_) {}
        lanyardWs = null;
    }
    isLanyardConnecting = false;
    lanyardReconnectAttempts = 0;
    
    // Clear intervals
    if (heartbeatInterval) clearInterval(heartbeatInterval);
    if (lanyardHeartbeat) clearInterval(lanyardHeartbeat);
    
    // Reconnect after a short delay
    setTimeout(() => {
        connectToGateway();
        connectToLanyard();
    }, 1000);
    
    console.log('Connections reset, reconnecting...');
};

// Function to check server status
window.checkServer = async () => {
    const isRunning = await checkServerStatus();
    console.log('Server status:', isRunning ? 'Running' : 'Not running');
    if (!isRunning) {
        console.log('Please start your server with: npm start or node server.js');
    }
    return isRunning;
};

// Function to help with Discord token issues
window.helpDiscordToken = () => {
    console.log(`
🔧 Discord Token Help:
1. Your current token appears to be invalid or expired
2. To get a new token:
   - Open Discord in your browser
   - Press F12 to open Developer Tools
   - Go to Network tab
   - Send a message in any channel
   - Look for requests to discord.com/api
   - Find the Authorization header in the request
   - Copy the token (without "Bearer ")
3. Update the DISCORD_TOKEN variable in script.js
4. Refresh the page

⚠️ Note: Tokens expire, so you may need to do this periodically
    `);
};

// Function to show setup instructions
window.showSetup = () => {
    console.log(`
🚀 Setup Instructions:

1. Start your server:
   npm start
   (or: node server.js)

2. Get a Discord token:
   - Open Discord in browser
   - F12 → Network tab
   - Send a message
   - Find Authorization header in requests
   - Copy the token

3. Update script.js:
   - Replace DISCORD_TOKEN with your token
   - Save and refresh

4. Check status:
   checkServer() - check if server is running
   helpDiscordToken() - get token help
    `);
};

// Quick fix function
window.quickFix = async () => {
    console.log('🔧 Running quick diagnostics...');
    
    // Check server
    const serverRunning = await checkServerStatus();
    console.log(`Server: ${serverRunning ? '✅ Running' : '❌ Not running'}`);
    
    if (!serverRunning) {
        console.log(`
❌ SERVER NOT RUNNING!
Please run in your terminal:
npm start
(or: node server.js)
        `);
    }
    
    // Check Discord token
    console.log(`
❌ DISCORD TOKEN INVALID!
Your current token is expired or invalid.
Run: helpDiscordToken() for instructions
    `);
    
    console.log(`
📋 Next steps:
1. Start server: npm start
2. Get new token: helpDiscordToken()
3. Update script.js with new token
4. Refresh page
    `);
};

function showPresenceUnavailable(message) {
    const activityDetails = document.querySelector('.activity-details');
    const activityType = document.querySelector('.activity-type');
    const activityDuration = document.querySelector('.activity-duration');
    if (activityType) activityType.textContent = message || 'Активность недоступна.';
    if (activityDuration) activityDuration.textContent = '';
    if (activityDetails) activityDetails.style.display = 'block';
    const block = document.getElementById('discord-activity');
    if (block) {
        block.innerHTML = `<div class="discord-activity-row"><span class="discord-activity-icon"><i class="fas fa-exclamation-circle"></i></span><span class="discord-activity-title">${message || 'Активность недоступна.'}</span><span class="discord-activity-duration"></span></div>`;
    }
}

// Helpers for activity rendering and stability
let lastGoodActivity = null;
let lastGoodTs = 0;

function selectPrimaryActivity(activities) {
    const meaningful = activities.filter(a => [0,1,2,3,5].includes(a.type));
    const picked = meaningful[0] || activities[0];
    if (picked) {
        lastGoodActivity = picked;
        lastGoodTs = Date.now();
        return picked;
    }
    // Return cached for 2 minutes if present
    if (lastGoodActivity && Date.now() - lastGoodTs < 120000) {
        return lastGoodActivity;
    }
    return null;
}

function toEnglishActivityText(activity) {
    if (!activity) return { title: '', subtitle: '' };
    let verb = '';
    switch (activity.type) {
        case 0: verb = 'Playing'; break;
        case 1: verb = 'Streaming'; break;
        case 2: verb = 'Listening to'; break;
        case 3: verb = 'Watching'; break;
        case 5: verb = 'Competing in'; break;
        default: verb = '';
    }
    const title = verb ? `${verb} ${activity.name || ''}`.trim() : (activity.state || activity.name || '');
    const subtitle = [activity.details, activity.state].filter(Boolean).join(' • ');
    return { title, subtitle };
}

function getActivityImages(activity) {
    if (!activity) return { large: '', small: '' };
    const appId = activity.application_id;
    const assets = activity.assets || {};
    const large = assets.large_image ? assets.large_image.replace('mp:', '') : '';
    const small = assets.small_image ? assets.small_image.replace('mp:', '') : '';
    const largeUrl = large ? (large.startsWith('http') ? large : `https://cdn.discordapp.com/app-assets/${appId}/${large}.png`) : '';
    const smallUrl = small ? (small.startsWith('http') ? small : `https://cdn.discordapp.com/app-assets/${appId}/${small}.png`) : '';
    return { large: largeUrl, small: smallUrl };
}

function renderDiscordActivityCard(activity, subtitle, durationText) {
    const block = document.getElementById('discord-activity');
    if (!block) return;
    if (!activity) { block.innerHTML = ''; return; }
    const { large, small } = getActivityImages(activity);
    const icon = activity.type === 0 ? 'fa-gamepad' : activity.type === 2 ? 'fa-music' : activity.type === 1 ? 'fa-video' : activity.type === 3 ? 'fa-eye' : 'fa-trophy';
    block.innerHTML = `
        <div class="discord-activity-card">
            <div class="activity-cover">${large ? `<img src="${large}" alt="cover">` : `<i class="fas ${icon}" style="color:#b9bbbe;display:flex;align-items:center;justify-content:center;width:100%;height:100%;"></i>`}</div>
            <div class="activity-title">${toEnglishActivityText(activity).title}</div>
            <div class="activity-chip">${durationText || ''}</div>
            <div class="activity-sub">${subtitle || ''}</div>
        </div>
    `;
}

// Добавляем функцию для получения цвета статуса
function getStatusColor(status) {
    const colors = {
        'online': '#43b581',
        'idle': '#faa61a',
        'dnd': '#f04747',
        'offline': '#747f8d'
    };
    return colors[status] || colors.offline;
}

// Функция для обновления украшений профиля
function updateProfileDecorations(avatarContainer, decorations) {
    console.log('updateProfileDecorations called with:', decorations);
    
    // Проверяем, есть ли уже загруженное украшение с тем же asset
    const existingDecoration = avatarContainer.querySelector('.real-discord-decoration');
    if (existingDecoration && decorations && decorations.asset) {
        const existingAsset = existingDecoration.dataset.asset;
        if (existingAsset === decorations.asset) {
            console.log('Decoration already loaded with same asset, skipping...');
            return;
        }
    }
    
    // Удаляем старые украшения
    const existingDecorations = avatarContainer.querySelectorAll('.profile-decoration');
    existingDecorations.forEach(decoration => decoration.remove());
    
    // Если украшения есть, добавляем их
    if (decorations) {
        // Сначала пробуем загрузить реальное украшение из Discord
        if (decorations.asset) {
            console.log('Loading real Discord decoration with asset:', decorations.asset);
            loadRealDiscordDecoration(avatarContainer, decorations);
            return;
        }
        
        // Если нет asset, используем fallback на preset'ы
        let decorationId = null;
        
        if (decorations.id) {
            // Старая структура
            decorationId = decorations.id;
        } else if (decorations.sku_id) {
            // Используем sku_id как идентификатор
            decorationId = decorations.sku_id;
        }
        
        if (decorationId) {
            console.log('Applying fallback decoration with ID:', decorationId);
            const decorationType = getDecorationType(decorationId);
            console.log('Decoration type:', decorationType);
            applyDecorationPreset(avatarContainer, decorationType);
        } else {
            console.log('Decorations found but no recognizable ID:', decorations);
            // Применяем дефолтный preset если есть украшения но нет ID
            applyDecorationPreset(avatarContainer, 'default');
        }
    } else {
        console.log('No decorations found');
    }
}

// Функция для применения preset'а украшения
function applyDecorationPreset(avatarContainer, presetName) {
    const preset = AVATAR_DECORATION_PRESETS[presetName];
    if (!preset) return;
    
    const decorationElement = document.createElement('div');
    decorationElement.className = 'profile-decoration';
    decorationElement.classList.add(presetName);
    
    // Применяем стили из preset'а
    decorationElement.style.border = preset.border;
    decorationElement.style.background = preset.background;
    decorationElement.style.boxShadow = preset.boxShadow;
    decorationElement.style.animation = preset.animation;
    
    // Если есть иконка, добавляем её
    if (preset.hasIcon) {
        const iconElement = document.createElement('div');
        iconElement.className = 'decoration-icon';
        iconElement.style.cssText = `
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: 24px;
            height: 24px;
            background: ${preset.iconColor};
            border-radius: 4px;
            z-index: 2;
            border: 2px solid ${preset.iconColor}88;
            box-shadow: 0 0 8px ${preset.iconColor}66;
        `;
        decorationElement.appendChild(iconElement);
    }
    
    // Вставляем украшение перед аватаркой
    avatarContainer.insertBefore(decorationElement, avatarContainer.firstChild);
}

// Функция для загрузки реального украшения из Discord
function loadRealDiscordDecoration(avatarContainer, decorationData) {
    console.log('Loading real Discord decoration:', decorationData);
    
    if (!decorationData || !decorationData.asset) {
        console.log('No decoration asset found');
        return;
    }
    
    // Создаем контейнер для украшения
    const decorationElement = document.createElement('div');
    decorationElement.className = 'profile-decoration real-discord-decoration';
    decorationElement.dataset.asset = decorationData.asset; // Сохраняем asset для проверки
    decorationElement.style.cssText = `
        position: absolute;
        top: -12px;
        left: -12px;
        right: -12px;
        bottom: -12px;
        border-radius: 50%;
        pointer-events: none;
        z-index: 1;
        background: transparent;
    `;
    
    // Создаем изображение украшения
    const decorationImg = document.createElement('img');
    decorationImg.style.cssText = `
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        border-radius: 50%;
        object-fit: cover;
    `;
    
    // URL для загрузки украшения из Discord CDN
    const decorationUrl = `https://cdn.discordapp.com/avatar-decoration-presets/${decorationData.asset}.png`;
    
    decorationImg.onload = () => {
        console.log('Discord decoration loaded successfully');
        decorationElement.appendChild(decorationImg);
        avatarContainer.insertBefore(decorationElement, avatarContainer.firstChild);
    };
    
    decorationImg.onerror = () => {
        console.log('Failed to load Discord decoration, trying GIF...');
        // Пробуем загрузить как GIF
        decorationImg.src = `https://cdn.discordapp.com/avatar-decoration-presets/${decorationData.asset}.gif`;
        
        decorationImg.onerror = () => {
            console.log('Failed to load decoration as GIF too, using fallback');
            // Если не удалось загрузить, используем fallback preset
            applyDecorationPreset(avatarContainer, 'red_angry');
        };
    };
    
    decorationImg.src = decorationUrl;
}

// Функция для демонстрации украшений (для тестирования)
function showDemoDecoration(presetName = 'blue_glow') {
    const avatarContainer = document.querySelector('.avatar-container');
    if (avatarContainer) {
        // Удаляем существующие украшения
        const existingDecorations = avatarContainer.querySelectorAll('.profile-decoration');
        existingDecorations.forEach(decoration => decoration.remove());
        
        // Применяем preset
        applyDecorationPreset(avatarContainer, presetName);
        
        // Автоматически убираем демо украшение через 5 секунд
        setTimeout(() => {
            const demoDecoration = avatarContainer.querySelector('.profile-decoration');
            if (demoDecoration) demoDecoration.remove();
        }, 5000);
    }
}

// Функция для получения списка доступных preset'ов
function getAvailablePresets() {
    return Object.keys(AVATAR_DECORATION_PRESETS).map(key => ({
        id: key,
        name: AVATAR_DECORATION_PRESETS[key].name
    }));
}

// Функция для применения случайного preset'а
function applyRandomPreset() {
    const presets = Object.keys(AVATAR_DECORATION_PRESETS);
    const randomPreset = presets[Math.floor(Math.random() * presets.length)];
    const avatarContainer = document.querySelector('.avatar-container');
    if (avatarContainer) {
        applyDecorationPreset(avatarContainer, randomPreset);
        console.log(`Applied preset: ${AVATAR_DECORATION_PRESETS[randomPreset].name}`);
    }
}

// Avatar decoration presets
const AVATAR_DECORATION_PRESETS = {
    'default': {
        name: 'Default',
        border: '2px solid #333',
        background: 'rgba(0, 0, 0, 0.3)',
        boxShadow: '0 0 10px rgba(0, 0, 0, 0.5)',
        animation: 'decorationGlow 3s ease-in-out infinite alternate'
    },
    'blue_glow': {
        name: 'Blue Glow',
        border: '3px solid #00bfff',
        background: 'transparent',
        boxShadow: '0 0 20px rgba(0, 191, 255, 0.5)',
        animation: 'decorationGlow 3s ease-in-out infinite alternate'
    },
    'purple_pulse': {
        name: 'Purple Pulse',
        border: '3px solid #4169e1',
        background: 'transparent',
        boxShadow: '0 0 25px rgba(65, 105, 225, 0.6)',
        animation: 'decorationPulse 2s ease-in-out infinite'
    },
    'cyan_ring': {
        name: 'Cyan Ring',
        border: '3px solid #1e90ff',
        background: 'transparent',
        boxShadow: '0 0 30px rgba(30, 144, 255, 0.7)',
        animation: 'decorationRotate 4s linear infinite'
    },
    'red_angry': {
        name: 'Red Angry',
        border: '2px solid #ff4444',
        background: 'rgba(255, 68, 68, 0.1)',
        boxShadow: '0 0 15px rgba(255, 68, 68, 0.4)',
        animation: 'decorationPulse 1.5s ease-in-out infinite',
        hasIcon: true,
        iconColor: '#ff4444'
    },
    'golden': {
        name: 'Golden',
        border: '3px solid #ffd700',
        background: 'radial-gradient(circle, rgba(255, 215, 0, 0.1) 0%, transparent 70%)',
        boxShadow: '0 0 25px rgba(255, 215, 0, 0.6)',
        animation: 'decorationGlow 2.5s ease-in-out infinite alternate'
    },
    'dark_evil': {
        name: 'Dark Evil',
        border: '2px solid #8b0000',
        background: 'radial-gradient(circle, rgba(139, 0, 0, 0.2) 0%, transparent 70%)',
        boxShadow: '0 0 20px rgba(139, 0, 0, 0.5)',
        animation: 'decorationParticles 2s ease-in-out infinite'
    },
    'neon_green': {
        name: 'Neon Green',
        border: '2px solid #00ff00',
        background: 'transparent',
        boxShadow: '0 0 20px rgba(0, 255, 0, 0.6)',
        animation: 'decorationGlow 1.8s ease-in-out infinite alternate'
    }
};

// Функция для определения типа украшения
function getDecorationType(decorationId) {
    console.log('Getting decoration type for ID:', decorationId);
    
    // Маппинг реальных ID украшений Discord на наши preset'ы
    const decorationTypes = {
        // Старые тестовые ID
        'profile_effect_1': 'blue_glow',
        'profile_effect_2': 'purple_pulse', 
        'profile_effect_3': 'cyan_ring',
        'profile_effect_4': 'red_angry',
        
        // Реальные ID украшений Discord (по asset или sku_id)
        'a_3c97a2d37f433a7913a1c7b7a735d000': 'red_angry', // Ваше украшение
        '1144308439720394944': 'red_angry', // SKU ID вашего украшения
        
        // Другие возможные украшения (добавьте по мере необходимости)
        'a_1': 'blue_glow',
        'a_2': 'purple_pulse',
        'a_3': 'cyan_ring',
        'a_4': 'golden',
        'a_5': 'dark_evil',
        'a_6': 'neon_green'
    };
    
    const preset = decorationTypes[decorationId] || 'default';
    console.log('Selected preset:', preset);
    return preset;
}

// Функция для анимации текста
function typeText(element, text, speed = 100) {
    let isAnimating = true;
    let fullText = text;
    
    function updateText(currentText, isTyping) {
        if (!isAnimating) return;
        
        if (isTyping) {
            if (currentText.length < fullText.length) {
                element.textContent = fullText.slice(0, currentText.length + 1);
                setTimeout(() => updateText(element.textContent, true), speed);
            } else {
                setTimeout(() => updateText(fullText, false), 2000);
            }
        } else {
            if (currentText.length > 0) {
                element.textContent = fullText.slice(0, currentText.length - 1) + '|';
                setTimeout(() => updateText(element.textContent.slice(0, -1), false), speed / 2);
            } else {
                element.textContent = '|';
                setTimeout(() => updateText('', true), 1000);
            }
        }
    }

    // Запускаем анимацию
    updateText('', true);

    // Возвращаем функцию для остановки анимации если нужно
    return () => {
        isAnimating = false;
    };
}

// Очищаем интервал при выгрузке страницы
window.addEventListener('unload', () => {
    if (window._statusUpdateInterval) {
        clearInterval(window._statusUpdateInterval);
    }
});

// Добавляем глобальные функции для работы с preset'ами украшений
window.showDecoration = showDemoDecoration;
window.applyPreset = applyDecorationPreset;
window.getPresets = getAvailablePresets;
window.randomPreset = applyRandomPreset;

// Функция для демонстрации всех preset'ов
window.testAllPresets = () => {
    const presets = Object.keys(AVATAR_DECORATION_PRESETS);
    let currentIndex = 0;
    
    const showNext = () => {
        if (currentIndex < presets.length) {
            showDemoDecoration(presets[currentIndex]);
            console.log(`Showing preset: ${AVATAR_DECORATION_PRESETS[presets[currentIndex]].name}`);
            currentIndex++;
            setTimeout(showNext, 6000); // 5 секунд показа + 1 секунда пауза
        }
    };
    
    showNext();
};

// Функция для применения конкретного preset'а
window.setPreset = (presetName) => {
    const avatarContainer = document.querySelector('.avatar-container');
    if (avatarContainer && AVATAR_DECORATION_PRESETS[presetName]) {
        applyDecorationPreset(avatarContainer, presetName);
        console.log(`Applied preset: ${AVATAR_DECORATION_PRESETS[presetName].name}`);
    } else {
        console.log('Available presets:', Object.keys(AVATAR_DECORATION_PRESETS));
    }
};

// Функция для отладки - показать что получаем от Discord
window.debugDecorations = () => {
    console.log('Current stored user data:', storedUserData);
    console.log('Profile decorations:', storedUserData?.profile_decorations);
    console.log('Available presets:', Object.keys(AVATAR_DECORATION_PRESETS));
    
    // Принудительно применим тестовый preset
    const avatarContainer = document.querySelector('.avatar-container');
    if (avatarContainer) {
        applyDecorationPreset(avatarContainer, 'red_angry');
        console.log('Applied test preset: red_angry');
    }
};

// Функция для принудительного обновления профиля
window.refreshProfile = () => {
    console.log('Refreshing profile...');
    fetchDiscordUser();
};

// Функция для тестирования загрузки реального украшения
window.testRealDecoration = () => {
    const avatarContainer = document.querySelector('.avatar-container');
    if (avatarContainer && storedUserData?.profile_decorations) {
        console.log('Testing real decoration with data:', storedUserData.profile_decorations);
        loadRealDiscordDecoration(avatarContainer, storedUserData.profile_decorations);
    } else {
        console.log('No decoration data available. Current data:', storedUserData);
    }
};

// Функция для принудительной загрузки украшения по asset ID
window.loadDecorationByAsset = (assetId) => {
    const avatarContainer = document.querySelector('.avatar-container');
    if (avatarContainer) {
        const mockDecorationData = {
            asset: assetId,
            sku_id: 'test',
            expires_at: null
        };
        loadRealDiscordDecoration(avatarContainer, mockDecorationData);
    }
};

// Функция для принудительного сохранения украшения
window.forceKeepDecoration = () => {
    const avatarContainer = document.querySelector('.avatar-container');
    if (avatarContainer && storedUserData?.profile_decorations) {
        // Удаляем все украшения
        const existingDecorations = avatarContainer.querySelectorAll('.profile-decoration');
        existingDecorations.forEach(decoration => decoration.remove());
        
        // Принудительно загружаем украшение
        loadRealDiscordDecoration(avatarContainer, storedUserData.profile_decorations);
        console.log('Forced decoration reload');
    }

}; 

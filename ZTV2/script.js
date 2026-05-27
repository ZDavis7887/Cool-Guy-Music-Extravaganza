const API_KEY = "67151f1c5943c2b35b9750ab48ac296f";
let tracklist = [], featurelist = [], playbackQueue = [];
let player, typing, fullTextGlobal = "";
let currentTrackIndex = 0;
let isFeatureMode = false;
let isFirstLoad = true; // CRITICAL: Resets only when page is refreshed

// --- THE BROADCAST SCHEDULE CONFIGURATION ---
// Structure your blocks cleanly by hour (0 to 23).
// true = FEATURE block, false = MUSIC block.
const BROADCAST_SCHEDULE = {
    0: false,  1: false,  2: false,  3: false,  // Midnight - 4 AM: Music
    4: true,   5: false,  6: false,  7: false,  // 4 AM: Documentary Feature
    8: false,  9: false,  10: false, 11: false, // 8 AM - Noon: Music
    12: true,  13: false, 14: false, 15: false, // Noon: Midday Documentary Feature
    16: false, 17: false, 18: false, 19: false, // 4 PM - 8 PM: Prime Music Rotation
    20: true,  21: true,  22: false, 23: false  // 8 PM - 10 PM: Blockbuster Feature Blocks
};

async function loadTracks() {
    try {
        const res = await fetch('upgraded_tracks.json');
        tracklist = await res.json();
        try {
            const featRes = await fetch('features.json');
            featurelist = await featRes.json();
        } catch (e) {}
        
        // Stabilize random generation based on the current date so everyone gets the same rotation daily
        const seed = new Date().toDateString();
        playbackQueue = [...tracklist].sort(() => seedShuffle(seed));
        
        loadYouTubeAPI();
        
        setupSearch(document.getElementById('search-bar'), document.getElementById('search-results'));
        setupSearch(document.getElementById('search-bar-mobile'), document.getElementById('search-results-mobile'));
    } catch (e) { console.error(e); }
}

// Simple deterministic string hash algorithm to unify visitor playlist arrays
function seedShuffle(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    return (hash % 100) / 100 - 0.5;
}

function loadYouTubeAPI() {
    const tag = document.createElement('script');
    tag.src = "https://https://www.youtube.com/iframe_api";
    document.body.appendChild(tag);
}

window.onYouTubeIframeAPIReady = () => {
    // Determine target mode dynamically by evaluating the clock immediately on launch
    const currentHour = new Date().getHours();
    isFeatureMode = BROADCAST_SCHEDULE[currentHour] || false;
    
    playNextContent();
};

function playNextContent() {
    let startAt = 0;

    // Check the live schedule to verify what should be playing *right now*
    const currentHour = new Date().getHours();
    const scheduledFeatureMode = BROADCAST_SCHEDULE[currentHour] || false;

    // If the clock ticked over into a new programming tier, switch modes
    if (isFeatureMode !== scheduledFeatureMode) {
        isFeatureMode = scheduledFeatureMode;
    }

    // THE JUMP-IN MECHANISM: Emulates tuning into an ongoing live broadcast feed
    if (isFirstLoad) {
        // Music joins mid-stream (0-3 mins). Feature documentaries join deeply mid-stream (0-25 mins).
        startAt = isFeatureMode ? Math.floor(Math.random() * 1500) : Math.floor(Math.random() * 180);
        isFirstLoad = false; 
    }

    if (isFeatureMode) {
        if (featurelist.length > 0) {
            const randomFeature = featurelist[Math.floor(Math.random() * featurelist.length)];
            playTrack(randomFeature, 'FEATURE', startAt);
        } else {
            // Fallback cleanly to music if no features are found
            playTrack(playbackQueue[currentTrackIndex], 'MUSIC', startAt);
        }
    } else {
        playTrack(playbackQueue[currentTrackIndex], 'MUSIC', startAt);
    }
}

async function playTrack(track, type, startTime = 0) {
    const videoId = extractVideoId(track.YouTubeLink);
    if (!videoId) { window.nextSong(); return; }

    if (player && player.loadVideoById) { 
        player.loadVideoById({
            videoId: videoId,
            startSeconds: startTime
        }); 
    } else {
        player = new YT.Player('player', {
            videoId: videoId,
            playerVars: { 
                'autoplay': 1, 
                'origin': location.origin,
                'start': startTime 
            },
            events: { 
                'onStateChange': (e) => {
                    if (e.data === 0) handleMediaEnd();
                }
            }
        });
    }
    updateUI(track, type);
}

function handleMediaEnd() {
    // Instead of resetting manual timers, we advance track indices or let features chain
    if (!isFeatureMode) {
        currentTrackIndex = (currentTrackIndex + 1) % playbackQueue.length;
    }
    playNextContent();
}

function updateUI(track, type) {
    const prefix = type === 'FEATURE' ? '[ ZTV FEATURE PRESENTATION ]' : '[ ZTV MUSIC ROTATION ]';
    document.getElementById('now-playing').innerText = `${prefix} ${track.Artist || track.Source} - ${track.Title}`;
    document.getElementById('album-art').src = track.AlbumArtLink || 'default_album.png';
    document.getElementById('album-name').innerText = track.Album || (type === 'FEATURE' ? 'ZTV Special' : "");
    document.getElementById('album-year').innerText = track.Year || "";

    const summaryEl = document.getElementById('artist-summary');
    const toggleBtn = document.getElementById('summary-toggle');
    fullTextGlobal = track.Summary || "";

    if (fullTextGlobal.length > 450) {
        typeRPG(fullTextGlobal.slice(0, 450) + "...", summaryEl);
        toggleBtn.style.display = "block";
    } else {
        typeRPG(fullTextGlobal, summaryEl);
        toggleBtn.style.display = "none";
    }
}

function extractVideoId(url) {
    if (!url) return null;
    try {
        const urlObj = new URL(url);
        const videoId = urlObj.searchParams.get('v');
        if (videoId) return videoId.substring(0, 11);
        if (url.includes('youtu.be/')) return url.split('youtu.be/')[1].substring(0, 11);
    } catch (e) {
        const match = url.match(/[?&]v=([^&#]*)/);
        return match ? match[1].substring(0, 11) : null;
    }
    return null;
}

function typeRPG(text, container) {
    clearInterval(typing);
    let i = 0; container.innerText = "";
    typing = setInterval(() => {
        if (i < text.length) { container.innerText += text.charAt(i); i++; } 
        else clearInterval(typing);
    }, 10);
}

function setupSearch(input, results) {
    if (!input || !results) return;
    input.addEventListener('input', () => {
        const q = input.value.toLowerCase().trim();
        results.innerHTML = "";
        if (!q) return;
        tracklist.filter(t => t.Artist.toLowerCase().includes(q) || t.Title.toLowerCase().includes(q)).slice(0, 10).forEach(t => {
            const d = document.createElement('div');
            d.innerHTML = `<b>${t.Artist}</b> - ${t.Title}`;
            d.style.cursor = "pointer";
            d.style.padding = "5px";
            d.onclick = () => { playTrack(t, 'MUSIC'); input.value = ""; results.innerHTML = ""; };
            results.appendChild(d);
        });
    });
}

window.nextSong = () => { 
    if (!isFeatureMode) {
        currentTrackIndex = (currentTrackIndex + 1) % playbackQueue.length;
    }
    playNextContent(); 
};

window.tuneIn = () => { 
    if(player) { player.unMute(); player.playVideo(); } 
    document.getElementById('tv-tuner-overlay').style.display = "none"; 
};

window.showFullDescription = () => {
    document.getElementById('artist-summary').innerText = fullTextGlobal;
    document.getElementById('summary-toggle').style.display = "none";
};

loadTracks();
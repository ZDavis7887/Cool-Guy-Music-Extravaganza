const API_KEY = "67151f1c5943c2b35b9750ab48ac296f";
let tracklist = [];
let featurelist = []; 
let player;
let currentTrackIndex = 0;
let playbackQueue = [];
let typing = null;

// NEW: Timer State
let musicPlaytimeMs = 0;
const MUSIC_BLOCK_LIMIT = 60 * 60 * 1000; // 60 Minutes
let isFeatureMode = false;

// 1. LOADING & QUEUE
async function loadTracks() {
    try {
        const musicResponse = await fetch('tracks.json');
        tracklist = await musicResponse.json();
        
        try {
            const featureResponse = await fetch('features.json');
            featurelist = await featureResponse.json();
        } catch (e) { console.warn("features.json missing."); }

        // Standard Shuffle for the session
        playbackQueue = [...tracklist].sort(() => Math.random() - 0.5);
        
        loadYouTubeAPI();
        setupSearchAll();
    } catch (e) {
        console.error("Load error:", e);
    }
}

function loadYouTubeAPI() {
    const tag = document.createElement('script');
    tag.src = "https://www.youtube.com/iframe_api";
    const firstScriptTag = document.getElementsByTagName('script')[0];
    firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
}

window.onYouTubeIframeAPIReady = function() {
    // Start with Music
    playNextContent();
};

// 2. THE CONTENT SWITCHER
function playNextContent() {
    if (isFeatureMode) {
        // We just finished a feature, go back to music
        isFeatureMode = false;
        musicPlaytimeMs = 0; 
        console.log("ZTV: Feature ended. Starting 60-minute Music Block.");
        playTrack(playbackQueue[currentTrackIndex], 'MUSIC');
    } else if (musicPlaytimeMs >= MUSIC_BLOCK_LIMIT) {
        // Music block is over, play ONE feature
        isFeatureMode = true;
        const randomFeature = featurelist[Math.floor(Math.random() * featurelist.length)];
        console.log("ZTV: 60m Music Limit reached. Playing Feature Intermission.");
        playTrack(randomFeature, 'FEATURE');
    } else {
        // Keep playing music
        playTrack(playbackQueue[currentTrackIndex], 'MUSIC');
    }
}

// 3. CORE PLAYBACK
async function playTrack(track, type = 'MUSIC') {
    if (!track || !track.YouTubeLink) {
        skipToNext();
        return;
    }

    const videoId = extractVideoId(track.YouTubeLink);
    if (!videoId) return;

    if (player) {
        player.loadVideoById({ videoId: videoId });
    } else {
        player = new YT.Player('player', {
            height: '315', width: '560',
            videoId: videoId,
            playerVars: { 'autoplay': 1, 'origin': 'https://zdavis7887.github.io', 'rel': 0 },
            events: { 
                'onStateChange': onPlayerStateChange,
                'onReady': (e) => e.target.playVideo() 
            }
        });
    }

    // UI Updates
    updateUI(track, type);
    renderTimerStatus();
}

function updateUI(track, type) {
    const statusPrefix = type === 'FEATURE' ? `[ FEATURE ]` : 'Now Playing:';
    document.getElementById('now-playing').innerText = `${statusPrefix} ${track.Artist || track.Source} - ${track.Title}`;
    
    if (document.getElementById('album-art')) {
        document.getElementById('album-art').src = track.AlbumArtLink || 'default_album.png';
    }
    
    const summaryEl = document.getElementById('artist-summary');
    if (summaryEl) {
        summaryEl.innerText = "";
        typeRPG(track.Summary || 'ZTV Broadcast in progress...', summaryEl);
    }
}

function onPlayerStateChange(event) {
    if (event.data === YT.PlayerState.ENDED) {
        handleMediaEnd();
    }
}

function handleMediaEnd() {
    if (!isFeatureMode) {
        // Assume avg song is 3.5 mins if metadata fails, else use real duration
        const duration = player.getDuration() * 1000 || (3.5 * 60 * 1000);
        musicPlaytimeMs += duration;
        currentTrackIndex = (currentTrackIndex + 1) % playbackQueue.length;
    }
    playNextContent();
}

function renderTimerStatus() {
    const container = document.getElementById('upcoming-tracks');
    if (!container) return;
    
    if (isFeatureMode) {
        container.innerHTML = `<h3>Currently in Feature Intermission</h3><p>Music returns after this video.</p>`;
    } else {
        const remainingMins = Math.ceil((MUSIC_BLOCK_LIMIT - musicPlaytimeMs) / (60 * 1000));
        container.innerHTML = `<h3>Next Feature in: ~${remainingMins} minutes</h3>`;
    }
}

// 4. UTILITIES
function extractVideoId(url) {
    if (!url) return null;
    try {
        const urlObj = new URL(url);
        const videoId = urlObj.searchParams.get('v');
        if (videoId) return videoId.substring(0, 11);
        if (url.includes('youtu.be/')) return url.split('youtu.be/')[1].split(/[?&]/)[0].substring(0, 11);
    } catch (e) {
        const match = url.match(/[?&]v=([^&#]*)/);
        return match ? match[1].substring(0, 11) : null;
    }
    return null;
}

window.nextSong = function() {
    if (!isFeatureMode) {
        // Manual skip adds 3.5 mins to the timer so skips still count toward the hour
        musicPlaytimeMs += (3.5 * 60 * 1000);
        currentTrackIndex = (currentTrackIndex + 1) % playbackQueue.length;
    }
    playNextContent();
};

function typeRPG(text, container, speed = 15) {
    clearInterval(typing);
    let i = 0;
    typing = setInterval(() => {
        if (i < text.length) {
            container.innerText += text.charAt(i);
            i++;
        } else { clearInterval(typing); }
    }, speed);
}

// 5. SEARCH (Overrides current track)
function setupSearchAll() {
    const input = document.getElementById('search-bar');
    const results = document.getElementById('search-results');
    if (!input || !results) return;

    input.addEventListener('input', () => {
        const query = input.value.toLowerCase().trim();
        results.innerHTML = '';
        if (!query) { results.style.display = 'none'; return; }

        const matches = tracklist.filter(t => 
            t.Artist.toLowerCase().includes(query) || t.Title.toLowerCase().includes(query)
        ).slice(0, 10);

        matches.forEach(track => {
            const div = document.createElement('div');
            div.className = 'search-result';
            div.innerHTML = `<strong>${track.Artist}</strong> - ${track.Title}`;
            div.onclick = () => {
                isFeatureMode = false; // Search always returns to music mode
                playTrack(track, 'MUSIC');
                input.value = '';
                results.style.display = 'none';
            };
            results.appendChild(div);
        });
        results.style.display = 'block';
    });
}

window.tuneIn = function() {
    if (player) {
        player.unMute();
        player.setVolume(80);
        player.playVideo();
    }
    const overlay = document.getElementById('tv-tuner-overlay');
    if (overlay) overlay.style.display = "none";
};

loadTracks();
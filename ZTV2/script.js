const API_KEY = "67151f1c5943c2b35b9750ab48ac296f";
let tracklist = [], featurelist = [], playbackQueue = [];
let player, typing, fullTextGlobal = "";
let currentTrackIndex = 0, musicPlaytimeMs = 0;
const MUSIC_BLOCK_LIMIT = 60 * 60 * 1000; 
let isFeatureMode = false;
let isFirstLoad = true; // Flag for the initial session start

async function loadTracks() {
    try {
        const res = await fetch('tracks.json');
        tracklist = await res.json();
        try {
            const featRes = await fetch('features.json');
            featurelist = await featRes.json();
        } catch (e) {}
        
        playbackQueue = [...tracklist].sort(() => Math.random() - 0.5);
        loadYouTubeAPI();
        
        setupSearch(document.getElementById('search-bar'), document.getElementById('search-results'));
        setupSearch(document.getElementById('search-bar-mobile'), document.getElementById('search-results-mobile'));
    } catch (e) { console.error(e); }
}

function loadYouTubeAPI() {
    const tag = document.createElement('script');
    tag.src = "https://www.youtube.com/iframe_api";
    document.body.appendChild(tag);
}

window.onYouTubeIframeAPIReady = () => {
    // INITIAL SESSION START: Randomly decide starting mode
    if (featurelist.length > 0 && Math.random() > 0.5) {
        isFeatureMode = true;
    } else {
        isFeatureMode = false;
    }
    playNextContent();
};

function playNextContent() {
    let startAt = 0;

    // THE ILLUSION: If it's the very first load, pick a random jump-in point
    if (isFirstLoad) {
        // Music starts within first 2 mins, Features within first 20 mins
        startAt = isFeatureMode ? Math.floor(Math.random() * 1200) : Math.floor(Math.random() * 120);
        isFirstLoad = false;
    }

    if (isFeatureMode) {
        const randomFeature = featurelist[Math.floor(Math.random() * featurelist.length)];
        playTrack(randomFeature, 'FEATURE', startAt);
    } else {
        // Standard Music Block Logic
        if (musicPlaytimeMs >= MUSIC_BLOCK_LIMIT) {
            isFeatureMode = true;
            playNextContent(); // Pivot to feature
        } else {
            playTrack(playbackQueue[currentTrackIndex], 'MUSIC', startAt);
        }
    }
}

// 3. CORE PLAYBACK (Now with "Tune-In" Random Start)
async function playTrack(track, type = 'MUSIC') {
    if (!track || !track.YouTubeLink) {
        window.nextSong();
        return;
    }

    const videoId = extractVideoId(track.YouTubeLink);
    if (!videoId) return;

    // RANDOM START LOGIC
    // If it's a regular track, jump 5-45 seconds in. 
    // If it's a feature, jump 1-5 minutes in to feel like you "caught" it.
    let startAt = 0;
    if (type === 'MUSIC') {
        startAt = Math.floor(Math.random() * 45); 
    } else if (type === 'FEATURE') {
        startAt = Math.floor(Math.random() * 300); // Up to 5 mins in
    }

    if (player) {
        player.loadVideoById({ 
            videoId: videoId,
            startSeconds: startAt 
        });
    } else {
        player = new YT.Player('player', {
            height: '315', width: '560',
            videoId: videoId,
            playerVars: { 
                'autoplay': 1, 
                'origin': location.origin, 
                'rel': 0,
                'start': startAt // Starts the very first video at a random spot too
            },
            events: { 
                'onStateChange': (e) => { if(e.data === 0) handleMediaEnd(); },
                'onReady': (e) => e.target.playVideo() 
            }
        });
    }

    updateUI(track, type);
    renderTimerStatus();
}

function handleMediaEnd() {
    if (isFeatureMode) {
        // After a Feature ends, switch back to Music and reset the hour timer
        isFeatureMode = false; 
        musicPlaytimeMs = 0; 
    } else {
        // Accumulate playtime to see when we hit the 60min limit
        musicPlaytimeMs += (player.getDuration() * 1000) || 210000;
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

// REST OF UTILITIES (Remains exactly as your provided script)
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
        musicPlaytimeMs += 210000; 
        currentTrackIndex++; 
    } else {
        isFeatureMode = false;
        musicPlaytimeMs = 0;
    }
    playNextContent(); 
};

window.tuneIn = () => { 
    if(player) { player.unMute(); player.playVideo(); } 
    document.getElementById('tv-tuner-overlay').style.display = "none"; 
};

loadTracks();
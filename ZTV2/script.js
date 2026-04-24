const API_KEY = "67151f1c5943c2b35b9750ab48ac296f";
let tracklist = [];
let featurelist = []; 
let player;
let currentTrackIndex = -1;
let playbackQueue = [];
let typing = null;

// 1. GLOBAL SYNC & SCHEDULING LOGIC
function seededRandom(seed) {
    return function() {
        seed = (seed * 1664525 + 1013904223) % 4294967296;
        return seed / 4294967296;
    };
}

function generatePlaybackQueue() {
    const array = [...tracklist];
    const today = new Date();
    const seedValue = today.getFullYear() * 10000 + (today.getMonth() + 1) * 100 + today.getDate();
    const random = seededRandom(seedValue);

    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    playbackQueue = array;
}

// THE NETWORK DIRECTOR: Decides the Block based on the Hour
function getBroadcastContent() {
    const now = new Date();
    const currentHour = now.getHours();
    const minutes = now.getMinutes();
    const seconds = now.getSeconds();
    const secondsIntoHour = (minutes * 60) + seconds;

    // EVEN HOURS = MUSIC VIDEOS | ODD HOURS = FEATURE PRESENTATIONS
    const isMusicBlock = (currentHour % 2 === 0);

    if (isMusicBlock) {
        return getLiveMusic(secondsIntoHour, currentHour);
    } else {
        return getLiveFeature(currentHour, secondsIntoHour);
    }
}

function getLiveMusic(secondsIntoHour, currentHour) {
    const AVG_DURATION = 210; 
    const tracksPerHour = 3600 / AVG_DURATION;
    const trackIndexInHour = Math.floor(secondsIntoHour / AVG_DURATION);
    const seekTo = Math.floor(secondsIntoHour % AVG_DURATION);

    // Seed logic to ensure UI and Player stay locked together
    const finalIndex = (currentHour + trackIndexInHour) % playbackQueue.length;

    return { 
        track: playbackQueue[finalIndex], 
        index: finalIndex,
        startAt: seekTo,
        type: 'MUSIC'
    };
}

function getLiveFeature(hour, secondsIntoHour) {
    if (featurelist.length === 0) return getLiveMusic(secondsIntoHour, hour);

    const now = new Date();
    const seed = now.getFullYear() + now.getMonth() + now.getDate() + hour;
    const random = seededRandom(seed);
    const featureIndex = Math.floor(random() * featurelist.length);
    
    return {
        track: featurelist[featureIndex],
        index: featureIndex,
        startAt: secondsIntoHour, 
        type: 'FEATURE'
    };
}

// 2. LOADING & API
async function loadTracks() {
    try {
        const musicResponse = await fetch('upgraded_tracks.json');
        tracklist = await musicResponse.json();
        
        try {
            const featureResponse = await fetch('features.json');
            featurelist = await featureResponse.json();
        } catch (e) { console.warn("features.json not found yet, skipping feature block."); }

        generatePlaybackQueue();
        loadYouTubeAPI();
        setupSearchAll();
    } catch (e) {
        console.error("Critical Error loading JSON:", e);
    }
}

function loadYouTubeAPI() {
    const tag = document.createElement('script');
    tag.src = "https://www.youtube.com/iframe_api";
    const firstScriptTag = document.getElementsByTagName('script')[0];
    firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
}

window.onYouTubeIframeAPIReady = async function() {
    const broadcast = getBroadcastContent();
    currentTrackIndex = broadcast.index;
    await playTrack(broadcast.track, broadcast.index, broadcast.startAt, broadcast.type);
};

// 3. CORE PLAYBACK (FIXED REGEX FOR CLEAN IDS)
async function playTrack(track, index = null, startTime = 0, type = 'MUSIC') {
    if (!track || !track.YouTubeLink || track.YouTubeLink === "Not Found") {
        window.nextSong();
        return;
    }

    const videoId = extractVideoId(track.YouTubeLink);
    if (!videoId) return;

    if (index !== null) currentTrackIndex = index;

    if (player) {
        player.loadVideoById({
            videoId: videoId,
            startSeconds: startTime
        });
    } else {
        player = new YT.Player('player', {
            height: '315', width: '560',
            videoId: videoId,
            playerVars: { 
                'autoplay': 1, 'mute': 1, 'start': startTime,
                'origin': 'https://zdavis7887.github.io',
                'rel': 0 
            },
            events: { 'onStateChange': onPlayerStateChange }
        });
    }

    // UI Updates
    const statusPrefix = type === 'FEATURE' ? `[ ${track.Type.toUpperCase()} ]` : 'Now Playing:';
    document.getElementById('now-playing').innerText = `${statusPrefix} ${track.Artist || track.Source} - ${track.Title}`;
    
    const artEl = document.getElementById('album-art');
    if (artEl) artEl.src = track.AlbumArtLink || 'default_album.png';

    const albumEl = document.getElementById('album-name');
    if (albumEl) albumEl.innerText = track.Album || (type === 'FEATURE' ? 'ZTV Feature' : 'Unknown Album');
    
    const summaryEl = document.getElementById('artist-summary');
    const fullSummary = track.Summary || 'No additional broadcast data available.';
    if (summaryEl) {
        summaryEl.innerText = "";
        typeRPG(fullSummary.slice(0, 450), summaryEl);
    }

    renderUpcomingTracks();
}

// 4. UTILITIES (STRICT VIDEO ID EXTRACTION)
function extractVideoId(url) {
    if (!url) return null;
    try {
        const urlObj = new URL(url);
        // Specifically grab the 'v' parameter and ignore EVERYTHING else (lists, radios, etc)
        const videoId = urlObj.searchParams.get('v');
        if (videoId) return videoId.substring(0, 11);
        
        // Handle shortlinks youtu.be/ID
        if (url.includes('youtu.be/')) {
            return url.split('youtu.be/')[1].split(/[?&]/)[0].substring(0, 11);
        }
    } catch (e) {
        const match = url.match(/[?&]v=([^&#]*)/);
        return match ? match[1].substring(0, 11) : null;
    }
    return null;
}

function onPlayerStateChange(event) {
    if (event.data === YT.PlayerState.ENDED) {
        window.nextSong();
    }
}

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

function renderUpcomingTracks() {
    const container = document.getElementById('upcoming-tracks');
    if (!container) return;
    const now = new Date();
    const nextHour = (now.getHours() + 1) % 24;
    const nextBlock = (nextHour % 2 === 0) ? "Music Rotation" : "Feature Presentation";
    
    container.innerHTML = `<h3>Next Broadcast Block (${nextHour}:00): ${nextBlock}</h3>`;
}

// 5. SEARCH & CONTROLS
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
                playTrack(track, null, 0, 'MUSIC');
                input.value = '';
                results.style.display = 'none';
            };
            results.appendChild(div);
        });
        results.style.display = 'block';
    });
}

window.nextSong = () => {
    const next = getBroadcastContent();
    playTrack(next.track, next.index, 0, next.type);
};

window.tuneIn = function() {
    if (player) {
        player.unMute();
        player.setVolume(80);
        player.playVideo();
    }
    const overlay = document.getElementById('tv-tuner-overlay');
    if (overlay) {
        overlay.style.opacity = "0";
        setTimeout(() => overlay.style.display = "none", 500);
    }
    console.log("ZTV: Broadcast Synchronized.");
};

// INITIALIZE
loadTracks();
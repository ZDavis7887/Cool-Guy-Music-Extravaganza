const API_KEY = "67151f1c5943c2b35b9750ab48ac296f";
let tracklist = [], featurelist = [], playbackQueue = [];
let player, typing, fullTextGlobal = "";
let currentTrackIndex = 0, musicPlaytimeMs = 0;
const MUSIC_BLOCK_LIMIT = 60 * 60 * 1000; 
let isFeatureMode = false;

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

window.onYouTubeIframeAPIReady = () => playNextContent();

function playNextContent() {
    if (isFeatureMode) {
        isFeatureMode = false; musicPlaytimeMs = 0;
        playTrack(playbackQueue[currentTrackIndex], 'MUSIC');
    } else if (musicPlaytimeMs >= MUSIC_BLOCK_LIMIT) {
        isFeatureMode = true;
        playTrack(featurelist[Math.floor(Math.random() * featurelist.length)], 'FEATURE');
    } else {
        playTrack(playbackQueue[currentTrackIndex], 'MUSIC');
    }
}

async function playTrack(track, type) {
    const videoId = extractVideoId(track.YouTubeLink);
    if (!videoId) { window.nextSong(); return; }
    if (player) { player.loadVideoById(videoId); } 
    else {
        player = new YT.Player('player', {
            videoId: videoId,
            playerVars: { 'autoplay': 1, 'origin': location.origin },
            events: { 'onStateChange': (e) => e.data === 0 && handleMediaEnd() }
        });
    }
    updateUI(track, type);
}

function updateUI(track, type) {
    document.getElementById('now-playing').innerText = `${type === 'FEATURE' ? '[FEATURE]' : 'Now Playing:'} ${track.Artist || track.Source} - ${track.Title}`;
    document.getElementById('album-art').src = track.AlbumArtLink || 'default_album.png';
    document.getElementById('album-name').innerText = track.Album || "";
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

window.showFullDescription = () => {
    document.getElementById('artist-summary').innerText = fullTextGlobal;
    document.getElementById('summary-toggle').style.display = "none";
};

function handleMediaEnd() {
    if (!isFeatureMode) {
        musicPlaytimeMs += (player.getDuration() * 1000) || 210000;
        currentTrackIndex = (currentTrackIndex + 1) % playbackQueue.length;
    }
    playNextContent();
}

function extractVideoId(url) {
    if (!url) return null;
    const match = url.match(/[?&]v=([^&#]*)/);
    return match ? match[1].substring(0, 11) : (url.includes('youtu.be/') ? url.split('youtu.be/')[1].substring(0, 11) : null);
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

window.nextSong = () => { musicPlaytimeMs += 210000; currentTrackIndex++; playNextContent(); };
window.tuneIn = () => { if(player) { player.unMute(); player.playVideo(); } document.getElementById('tv-tuner-overlay').style.display = "none"; };

loadTracks();
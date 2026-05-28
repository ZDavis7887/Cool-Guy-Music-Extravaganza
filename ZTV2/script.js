// ==========================================
// CONFIGURATION & GLOBAL STATE
// ==========================================
const LAST_FM_API_KEY = "67151f1c5943c2b35b9750ab48ac296f"; // <-- Drop your Last.fm API key string here

let featureQueue = [];
let trackQueue = [];
let continuousPlaylist = [];
let currentTrackIndex = 0;
let player; 
let isVideoHidden = false;

// ==========================================
// 1. DATA INITIALIZATION & SHUFFLE
// ==========================================
function shuffleArray(array) {
    if (!Array.isArray(array)) return [];
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

Promise.all([
    fetch('features.json').then(res => { if (!res.ok) throw new Error(); return res.json(); }).catch(() => []),
    fetch('tracks.json').then(res => { if (!res.ok) throw new Error(); return res.json(); }).catch(() => [])
])
.then(([features, tracks]) => {
    featureQueue = shuffleArray(features);
    trackQueue = shuffleArray(tracks);
    
    buildContinuousBroadcast();
    setupSearchFunctionality(); // Bind original search bar listeners
})
.catch(err => console.error("[ZTV Core] Init error:", err));

// ==========================================
// 2. BROADCAST TIMELINE CLOCK (1 to 7 Rotation)
// ==========================================
function buildContinuousBroadcast() {
    continuousPlaylist = [];
    let fIndex = 0;
    let tIndex = 0;
    
    const hasFeatures = featureQueue.length > 0;
    const hasTracks = trackQueue.length > 0;
    const startWithFeature = hasFeatures && (Math.random() < 0.5);
    
    for (let block = 0; block < 100; block++) {
        // Feature block
        if (hasFeatures) {
            if (block === 0 && !startWithFeature) {
                // Skip opening feature slot if coin flip dictates starting with music tracks
            } else {
                continuousPlaylist.push({
                    ...featureQueue[fIndex % featureQueue.length],
                    broadcastType: 'feature'
                });
                fIndex++;
            }
        }
        // 7 Music Tracks block
        if (hasTracks) {
            for (let s = 0; s < 7; s++) {
                continuousPlaylist.push({
                    ...trackQueue[tIndex % trackQueue.length],
                    broadcastType: 'song'
                });
                tIndex++;
            }
        }
    }
    console.log("[ZTV Clock] Continuous playlist compiled:", continuousPlaylist.length, "items.");
}

// ==========================================
// 3. CORE UI & INTERACTIVE PLAYER CONTROLS
// ==========================================
function tuneIn() {
    const overlay = document.getElementById('tv-tuner-overlay');
    if (overlay) overlay.style.display = 'none';
    
    if (!player && continuousPlaylist.length > 0) {
        loadYouTubePlayer(continuousPlaylist[currentTrackIndex]);
    }
}

function loadYouTubePlayer(item) {
    const videoId = extractVideoId(item.YouTubeLink);
    
    if (typeof YT === 'undefined' || typeof YT.Player === 'undefined') {
        const tag = document.createElement('script');
        tag.src = "https://www.youtube.com/iframe_api";
        const firstScriptTag = document.getElementsByTagName('script')[0];
        firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
        
        window.onYouTubeIframeAPIReady = () => { initPlayerInstance(videoId, item); };
    } else {
        initPlayerInstance(videoId, item);
    }
}

function initPlayerInstance(videoId, item) {
    player = new YT.Player('player', {
        height: '100%',
        width: '100%',
        videoId: videoId,
        playerVars: { 'autoplay': 1, 'controls': 1, 'modestbranding': 1, 'rel': 0 },
        events: {
            'onReady': (e) => { e.target.playVideo(); updateUIElements(item); },
            'onStateChange': (e) => { if (e.data === YT.PlayerState.ENDED) nextSong(); }
        }
    });
}

function changeTrack(index) {
    if (index < 0 || index >= continuousPlaylist.length || !player) return;
    currentTrackIndex = index;
    const item = continuousPlaylist[currentTrackIndex];
    const videoId = extractVideoId(item.YouTubeLink);
    player.loadVideoById(videoId);
    updateUIElements(item);
}

function nextSong() { changeTrack((currentTrackIndex + 1) % continuousPlaylist.length); }
function prevSong() { changeTrack((currentTrackIndex - 1 + continuousPlaylist.length) % continuousPlaylist.length); }
function shuffleSong() { buildContinuousBroadcast(); changeTrack(0); }
function toggleVideo() {
    const pEl = document.getElementById('player');
    if (!pEl) return;
    isVideoHidden = !isVideoHidden;
    pEl.style.display = isVideoHidden ? 'none' : 'block';
}

// ==========================================
// 4. LAST.FM API ART & METADATA FETCHING
// ==========================================
function updateUIElements(item) {
    if (!item) return;
    
    const nowPlayingText = document.getElementById('now-playing');
    const albumNameText = document.getElementById('album-name');
    const albumYearText = document.getElementById('album-year');
    
    // Clear old data values out of your Winamp slots
    resetMetadataUI();

    if (item.broadcastType === 'feature') {
        if (nowPlayingText) nowPlayingText.innerText = `[FEATURE] ${item.Title}`;
        if (albumNameText) albumNameText.innerText = item.Source || "Music Authority";
        if (albumYearText) albumYearText.innerText = "Video Deep Dive";
        
        // Use static placeholders or video summaries for documentary features
        setAlbumArt("default_album.png");
        setArtistSummary(item.Summary || "A curated music feature presentation.");
    } else {
        if (nowPlayingText) nowPlayingText.innerText = `${item.Artist} - ${item.Title}`;
        if (albumNameText) albumNameText.innerText = item.Album || "Single Track";
        if (albumYearText) albumYearText.innerText = item.Year || "";
        
        // Query Last.fm for authentic songs
        fetchLastFmData(item.Artist, item.Album || item.Title);
    }
    
    updateUpcomingTracksList();
}

function fetchLastFmData(artist, albumOrTrack) {
    if (!LAST_FM_API_KEY || LAST_FM_API_KEY === "YOUR_LAST_FM_API_KEY") return;

    // Call 1: Fetch Album Art Details
    const albumUrl = `https://ws.audioscrobbler.com/2.0/?method=album.getinfo&api_key=${LAST_FM_API_KEY}&artist=${encodeURIComponent(artist)}&album=${encodeURIComponent(albumOrTrack)}&format=json`;
    
    fetch(albumUrl)
        .then(res => res.json())
        .then(data => {
            const img = data?.album?.image?.find(i => i.size === 'extralarge') || data?.album?.image?.find(i => i.size === 'large');
            if (img && img['#text']) {
                setAlbumArt(img['#text']);
            } else {
                setAlbumArt("default_album.png");
            }
        })
        .catch(() => setAlbumArt("default_album.png"));

    // Call 2: Fetch Biography / Artist Summaries
    const artistUrl = `https://ws.audioscrobbler.com/2.0/?method=artist.getinfo&api_key=${LAST_FM_API_KEY}&artist=${encodeURIComponent(artist)}&format=json`;
    
    fetch(artistUrl)
        .then(res => res.json())
        .then(data => {
            const summary = data?.artist?.bio?.summary || "Continuous music rotation active.";
            setArtistSummary(summary);
        })
        .catch(() => setArtistSummary("Continuous music rotation active."));
}

function setAlbumArt(src) {
    const art = document.getElementById('album-art');
    if (art) art.src = src;
}

function setArtistSummary(text) {
    const box = document.getElementById('artist-summary');
    const toggleBtn = document.getElementById('summary-toggle');
    if (box) {
        box.innerHTML = text;
        // Strip out Last.fm user links if they interfere with your stylesheet layout
        if (box.querySelector('a')) box.querySelector('a').target = "_blank";
    }
    if (toggleBtn) toggleBtn.style.display = text.length > 100 ? 'block' : 'none';
}

function resetMetadataUI() {
    setAlbumArt("default_album.png");
    setArtistSummary("Loading metadata spectrum...");
}

// ==========================================
// 5. INTERACTIVE QUEUE & PLAYLIST GENERATOR
// ==========================================
function updateUpcomingTracksList() {
    const upcomingContainer = document.getElementById('upcoming-tracks');
    if (!upcomingContainer) return;
    
    upcomingContainer.innerHTML = '<h3>Up Next</h3>';
    
    for (let i = 1; i <= 10; i++) {
        const targetIndex = (currentTrackIndex + i) % continuousPlaylist.length;
        const nextItem = continuousPlaylist[targetIndex];
        if (!nextItem) continue;
        
        const trackRow = document.createElement('div');
        trackRow.className = 'upcoming-item';
        trackRow.style.cursor = 'pointer'; // Make it look clickable
        
        // INTERACTIVE ROW TRIGGER: Click to jump straight to this timeline slot
        trackRow.onclick = () => { changeTrack(targetIndex); };
        
        if (nextItem.broadcastType === 'feature') {
            trackRow.innerHTML = `<span style="color: #ff0055; font-weight: bold;">[TV] ${nextItem.Title}</span>`;
        } else {
            trackRow.innerHTML = `<span>${nextItem.Artist} - ${nextItem.Title}</span>`;
        }
        upcomingContainer.appendChild(trackRow);
    }
}

// ==========================================
// 6. TRACK SEARCH ENGINE INTERACTION
// ==========================================
function setupSearchFunctionality() {
    const desktopSearch = document.getElementById('search-bar');
    const mobileSearch = document.getElementById('search-bar-mobile');
    
    if (desktopSearch) {
        desktopSearch.oninput = (e) => runSearchFilter(e.target.value, 'search-results');
    }
    if (mobileSearch) {
        mobileSearch.oninput = (e) => runSearchFilter(e.target.value, 'search-results-mobile');
    }
}

function runSearchFilter(query, resultContainerId) {
    const container = document.getElementById(resultContainerId);
    if (!container) return;
    
    container.innerHTML = '';
    if (!query.trim()) return;
    
    const cleanQuery = query.toLowerCase();
    
    // Scan our active running timeline for matching query strings
    continuousPlaylist.forEach((item, index) => {
        const titleMatch = item.Title?.toLowerCase().includes(cleanQuery);
        const artistMatch = item.Artist?.toLowerCase().includes(cleanQuery);
        const sourceMatch = item.Source?.toLowerCase().includes(cleanQuery);
        
        if (titleMatch || artistMatch || sourceMatch) {
            const row = document.createElement('div');
            row.className = 'search-result-item';
            row.style.padding = '5px';
            row.style.cursor = 'pointer';
            
            if (item.broadcastType === 'feature') {
                row.innerHTML = `<small style="color:#ff0055;">[Feature]</small> ${item.Title}`;
            } else {
                row.innerHTML = `<strong>${item.Artist}</strong> - ${item.Title}`;
            }
            
            // Clicking a search item instantly updates your context indices and streams it
            row.onclick = () => {
                container.innerHTML = '';
                const dBar = document.getElementById('search-bar');
                const mBar = document.getElementById('search-bar-mobile');
                if (dBar) dBar.value = '';
                if (mBar) mBar.value = '';
                changeTrack(index);
            };
            
            container.appendChild(row);
        }
    });
}

function extractVideoId(url) {
    if (!url) return '';
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : url;
}

function showFullDescription() {
    const box = document.getElementById('artist-summary');
    if (box) box.style.maxHeight = 'none';
}
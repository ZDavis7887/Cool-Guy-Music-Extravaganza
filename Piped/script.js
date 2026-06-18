// ==========================================
// 1. CONFIGURATION & STATE
// ==========================================
const LAST_FM_API_KEY = "67151f1c5943c2b35b9750ab48ac296f";
let featureQueue = [], trackQueue = [], deepDiveQueue = [];
let continuousPlaylist = [], currentTrackIndex = 0, videoJSInstance = null;
let currentChannelMode = 'music'; // Tracks if we are in 'music' or 'deep-dives'
let fullBiographyText = "";

// ==========================================
// 2. CHANNEL SWITCHING LOGIC
// ==========================================
function switchChannel(channelName) {
    currentChannelMode = channelName; 
    
    document.querySelectorAll('.channel-btn').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');

    if (channelName === 'deep-dives') {
        continuousPlaylist = shuffle([...deepDiveQueue]);
    } else {
        buildContinuousBroadcast();
    }

    currentTrackIndex = 0;
    if (continuousPlaylist.length > 0) {
        loadVideoJSPlayer(continuousPlaylist[currentTrackIndex]);
    }
}

// ==========================================
// 3. BROADCAST BUILDER & UTILS
// ==========================================
function shuffle(array) {
    let currentIndex = array.length, randomIndex;
    while (currentIndex !== 0) {
        randomIndex = Math.floor(Math.random() * currentIndex);
        currentIndex--;
        [array[currentIndex], array[randomIndex]] = [array[randomIndex], array[currentIndex]];
    }
    return array;
}

function buildContinuousBroadcast() {
    const sTracks = shuffle([...trackQueue]);
    const sFeatures = shuffle([...featureQueue]);
    continuousPlaylist = [];
    let fPtr = 0;
    for (let i = 0; i < sTracks.length; i++) {
        continuousPlaylist.push({...sTracks[i], broadcastType: 'song'});
        if ((i + 1) % 7 === 0 && fPtr < sFeatures.length) {
            continuousPlaylist.push({...sFeatures[fPtr], broadcastType: 'feature'});
            fPtr++;
        }
    }
}

// ==========================================
// 4. SEARCH ENGINE (Channel-Aware)
// ==========================================
function setupSearchFunctionality() {
    // Changed 'search-input' to 'search-bar' to match your HTML
    const searchInput = document.getElementById('search-bar'); 
    const resultsContainer = document.getElementById('search-results');

    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            runSearchFilter(e.target.value, 'search-results');
        });
    } else {
        console.error("Could not find element with id='search-bar'. Check your HTML.");
    }
}
function runSearchFilter(query, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '';
    if (!query.trim()) return;
    
    const lowerQuery = query.toLowerCase();
    const activeQueue = (currentChannelMode === 'deep-dives') ? deepDiveQueue : trackQueue;

    const results = activeQueue.filter(item => 
        item.Title?.toLowerCase().includes(lowerQuery) || 
        item.Artist?.toLowerCase().includes(lowerQuery) ||
        item.Source?.toLowerCase().includes(lowerQuery)
    ).slice(0, 10);

    results.forEach(item => {
        const row = document.createElement('div');
        row.className = 'search-result-item';
        row.style.cursor = 'pointer'; row.style.padding = '5px';
        row.innerText = (currentChannelMode === 'deep-dives') ? `[TV] ${item.Title}` : `${item.Artist || 'Unknown'} - ${item.Title}`;
        
        row.onclick = () => {
            document.querySelectorAll('input').forEach(i => i.value = '');
            container.innerHTML = '';
            continuousPlaylist.splice(currentTrackIndex + 1, 0, { ...item });
            currentTrackIndex++;
            loadVideoJSPlayer(continuousPlaylist[currentTrackIndex]);
        };
        container.appendChild(row);
    });
}
// ==========================================
// 4.5. TUNE IN
// ==========================================
function tuneIn() {
    const overlay = document.getElementById('tv-tuner-overlay');
    if (overlay) overlay.style.display = 'none';
    
    // Pick a random track from the current playlist to start
    if (continuousPlaylist.length > 0) {
        currentTrackIndex = Math.floor(Math.random() * continuousPlaylist.length);
        loadVideoJSPlayer(continuousPlaylist[currentTrackIndex]);
    } else {
        console.warn("Playlist is empty, cannot tune in.");
    }
}

// ==========================================
// 5. PLAYER ENGINE
// ==========================================
function loadVideoJSPlayer(item, index = null) {
    if (index !== null) currentTrackIndex = index;
    const playerContainer = document.getElementById('player');
    let cleanURL = item.YouTubeLink?.includes('&list=') ? item.YouTubeLink.split('&list=')[0] : item.YouTubeLink;

    if (!videoJSInstance) {
        playerContainer.innerHTML = `<video id="ztv-stream-player" class="video-js vjs-default-skin" controls autoplay playsinline style="width: 100%; height: 100%;"></video>`;
        videoJSInstance = videojs('ztv-stream-player', { autoplay: true, techOrder: ["youtube"], sources: [{ type: "video/youtube", src: cleanURL }] });
        videoJSInstance.on('ended', () => nextSong());
    } else {
        videoJSInstance.src({ type: "video/youtube", src: cleanURL });
        videoJSInstance.play();
    }
    updateUIElements(item);
}

function nextSong() { 
    currentTrackIndex = (currentTrackIndex + 1) % continuousPlaylist.length;
    loadVideoJSPlayer(continuousPlaylist[currentTrackIndex]); 
}

// ==========================================
// 6. METADATA & INITIALIZATION
// ==========================================
function updateUIElements(item) {
    if (!item) return;
    const nowPlaying = document.getElementById('now-playing');
    const albumName = document.getElementById('album-name');
    
    // Distinguish between Deep Dive and Music tracks
    if (nowPlaying) nowPlaying.innerText = item.Source ? item.Title : `${item.Artist} - ${item.Title}`;
    if (albumName) albumName.innerText = item.Source || item.Album || "Music Authority";
}

Promise.all([
    fetch('features.json').then(res => res.json()).catch(() => []),
    fetch('upgraded_tracks.json').then(res => res.json()).catch(() => []),
    fetch('deep_dives_master.json').then(res => res.json()).catch(() => [])
]).then(([features, tracks, deepDives]) => {
    featureQueue = features; 
    trackQueue = tracks;
    deepDiveQueue = deepDives;
    
    buildContinuousBroadcast();
    setupSearchFunctionality(); // <-- THIS IS THE MISSING PIECE
    
    console.log("System Ready. Deep Dives Loaded: " + deepDiveQueue.length);
});
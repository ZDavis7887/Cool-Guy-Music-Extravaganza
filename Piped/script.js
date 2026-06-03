// ==========================================
// 1. CONFIGURATION & STATE
// ==========================================
const LAST_FM_API_KEY = "67151f1c5943c2b35b9750ab48ac296f"; 
let featureQueue = [], trackQueue = [], continuousPlaylist = [], currentTrackIndex = 0, videoJSInstance = null;

// Helper to shuffle arrays
function shuffle(array) {
    return array.sort(() => Math.random() - 0.5);
}

// ==========================================
// 2. PLAYER ENGINE
// ==========================================
function tuneIn() {
    document.getElementById('tv-tuner-overlay').style.display = 'none';
    if (continuousPlaylist.length > 0) loadVideoJSPlayer(continuousPlaylist[currentTrackIndex]);
}

function loadVideoJSPlayer(item, index = null) {
    const playerContainer = document.getElementById('player');
    if (index !== null) currentTrackIndex = index;
    
    let cleanURL = item.YouTubeLink?.includes('&list=') ? item.YouTubeLink.split('&list=')[0] : item.YouTubeLink;

    if (!videoJSInstance) {
        playerContainer.innerHTML = `<video id="ztv-stream-player" class="video-js vjs-default-skin" controls autoplay playsinline style="width: 100%; height: 100%;"></video>`;
        videoJSInstance = videojs('ztv-stream-player', {
            autoplay: true, techOrder: ["youtube"],
            sources: [{ type: "video/youtube", src: cleanURL }],
            youtube: { iv_load_policy: 3, modestbranding: 1, rel: 0 }
        });
        videoJSInstance.on('ended', () => nextSong());
    } else {
        videoJSInstance.src({ type: "video/youtube", src: cleanURL });
        videoJSInstance.play();
    }
    updateUIElements(item);
    updateUpcomingTracksList();
}

function nextSong() { 
    currentTrackIndex = Math.floor(Math.random() * continuousPlaylist.length);
    loadVideoJSPlayer(continuousPlaylist[currentTrackIndex]); 
}

// ==========================================
// 3. BROADCAST & SEARCH LOGIC
// ==========================================
function buildContinuousBroadcast() {
    continuousPlaylist = [];
    // Shuffle the queues before building the rotation
    const sFeatures = shuffle([...featureQueue]);
    const sTracks = shuffle([...trackQueue]);
    
    let fIndex = 0, tIndex = 0;
    for (let block = 0; block < 100; block++) {
        // Feature flip (50% chance if features exist)
        if (sFeatures.length > 0 && Math.random() < 0.5) {
            continuousPlaylist.push({...sFeatures[fIndex % sFeatures.length], broadcastType: 'feature'});
            fIndex++;
        }
        // 7 Music Tracks
        for (let s = 0; s < 7; s++) {
            continuousPlaylist.push({...sTracks[tIndex % sTracks.length], broadcastType: 'song'});
            tIndex++;
        }
    }
}

function updateUpcomingTracksList() {
    const container = document.getElementById('upcoming-tracks');
    if (!container) return;
    container.innerHTML = '<h3>Up Next</h3>';
    
    for (let i = 1; i <= 10; i++) {
        const targetIndex = (currentTrackIndex + i) % continuousPlaylist.length;
        const item = continuousPlaylist[targetIndex];
        const div = document.createElement('div');
        div.className = 'upcoming-item';
        div.style.cursor = 'pointer';
        div.innerText = item.broadcastType === 'feature' ? `[TV] ${item.Title}` : `${item.Artist} - ${item.Title}`;
        
        // Restore Clickability
        div.onclick = () => loadVideoJSPlayer(item, targetIndex);
        container.appendChild(div);
    }
}

// ==========================================
// 4. METADATA & INIT
// ==========================================
function updateUIElements(item) {
    const nowPlaying = document.getElementById('now-playing');
    if (nowPlaying) nowPlaying.innerText = item.broadcastType === 'feature' ? `[TV] ${item.Title}` : `${item.Artist} - ${item.Title}`;
    if (item.broadcastType === 'song') fetchLastFmData(item.Artist, item.Album || item.Title);
}

function fetchLastFmData(artist, album) {
    fetch(`https://ws.audioscrobbler.com/2.0/?method=album.getinfo&api_key=${LAST_FM_API_KEY}&artist=${encodeURIComponent(artist)}&album=${encodeURIComponent(album)}&format=json`)
        .then(res => res.json())
        .then(data => {
            const img = data?.album?.image?.find(i => i.size === 'extralarge');
            if (img) document.getElementById('album-art').src = img['#text'];
        });
}

Promise.all([
    fetch('features.json').then(res => res.json()).catch(() => []),
    fetch('upgraded_tracks.json').then(res => res.json()).catch(() => [])
]).then(([features, tracks]) => {
    featureQueue = features; trackQueue = tracks;
    buildContinuousBroadcast();
    setupSearchFunctionality();
});
// ==========================================
// 6. SEARCH ENGINE (Restored & Fixed)
// ==========================================
function setupSearchFunctionality() {
    const dBar = document.getElementById('search-bar');
    const mBar = document.getElementById('search-bar-mobile');
    
    if (dBar) dBar.oninput = (e) => runSearchFilter(e.target.value, 'search-results');
    if (mBar) mBar.oninput = (e) => runSearchFilter(e.target.value, 'search-results-mobile');
}

function runSearchFilter(query, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    container.innerHTML = '';
    if (!query.trim()) return;

    const lowerQuery = query.toLowerCase();
    
    // We search the raw 'trackQueue' and 'featureQueue' 
    // to give the user the best results from the database
    const results = [
        ...trackQueue.filter(t => t.Title.toLowerCase().includes(lowerQuery) || t.Artist.toLowerCase().includes(lowerQuery)),
        ...featureQueue.filter(f => f.Title.toLowerCase().includes(lowerQuery))
    ].slice(0, 10);

    results.forEach(item => {
        const row = document.createElement('div');
        row.className = 'search-result-item';
        row.style.cursor = 'pointer';
        row.style.padding = '5px';
        row.innerText = item.Artist ? `${item.Artist} - ${item.Title}` : `[TV] ${item.Title}`;
        
   row.onclick = () => {
            // 1. Clear search results
            document.querySelectorAll('input').forEach(i => i.value = '');
            container.innerHTML = '';
            
            // 2. Prepare the track
            const trackToPlay = { ...item, broadcastType: item.Artist ? 'song' : 'feature' };
            
            // 3. Inject it immediately after the CURRENT playing song
            continuousPlaylist.splice(currentTrackIndex + 1, 0, trackToPlay);
            
            // 4. Force the player to jump to the index of the newly added track
            // We set the currentTrackIndex to the index of the new track
            currentTrackIndex = currentTrackIndex + 1;
            loadVideoJSPlayer(continuousPlaylist[currentTrackIndex]);
        };
        container.appendChild(row);
    });
}
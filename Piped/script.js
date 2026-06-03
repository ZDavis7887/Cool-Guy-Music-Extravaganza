// ==========================================
// 1. CONFIGURATION & STATE
// ==========================================
const LAST_FM_API_KEY = "67151f1c5943c2b35b9750ab48ac296f"; 
let featureQueue = [], trackQueue = [], continuousPlaylist = [], currentTrackIndex = 0, videoJSInstance = null, fullBiographyText = "";

// ==========================================
// 2. PLAYER ENGINE (Persistent / Fullscreen-Safe)
// ==========================================
function tuneIn() {
    const overlay = document.getElementById('tv-tuner-overlay');
    if (overlay) overlay.style.display = 'none';
    if (continuousPlaylist.length > 0) loadVideoJSPlayer(continuousPlaylist[currentTrackIndex]);
}

function loadVideoJSPlayer(item) {
    const playerContainer = document.getElementById('player');
    if (!playerContainer) return;

    let cleanURL = item.YouTubeLink?.includes('&list=') ? item.YouTubeLink.split('&list=')[0] : item.YouTubeLink;

    if (!videoJSInstance) {
        playerContainer.innerHTML = `<video id="ztv-stream-player" class="video-js vjs-default-skin" controls autoplay playsinline style="width: 100%; height: 100%;"></video>`;
        videoJSInstance = videojs('ztv-stream-player', {
            autoplay: true,
            techOrder: ["youtube"],
            sources: [{ type: "video/youtube", src: cleanURL }],
            youtube: { iv_load_policy: 3, modestbranding: 1, rel: 0 }
        });
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
// 3. DATA & SEARCH LOGIC
// ==========================================
function buildContinuousBroadcast() {
    continuousPlaylist = [];
    let fIndex = 0, tIndex = 0;
    for (let block = 0; block < 100; block++) {
        if (featureQueue.length > 0) {
            continuousPlaylist.push({...featureQueue[fIndex % featureQueue.length], broadcastType: 'feature'});
            fIndex++;
        }
        for (let s = 0; s < 7; s++) {
            continuousPlaylist.push({...trackQueue[tIndex % trackQueue.length], broadcastType: 'song'});
            tIndex++;
        }
    }
}

function setupSearchFunctionality() {
    const dBar = document.getElementById('search-bar'), mBar = document.getElementById('search-bar-mobile');
    if (dBar) dBar.oninput = (e) => runSearchFilter(e.target.value, 'search-results');
    if (mBar) mBar.oninput = (e) => runSearchFilter(e.target.value, 'search-results-mobile');
}

function runSearchFilter(query, containerId) {
    const container = document.getElementById(containerId);
    if (!container || !query.trim()) return;
    container.innerHTML = '';
    trackQueue.filter(t => t.Title.toLowerCase().includes(query.toLowerCase())).slice(0, 10).forEach(item => {
        const row = document.createElement('div');
        row.className = 'search-result-item';
        row.innerText = `${item.Artist} - ${item.Title}`;
        row.onclick = () => {
            container.innerHTML = '';
            continuousPlaylist.splice(currentTrackIndex, 0, {...item, broadcastType: 'song'});
            loadVideoJSPlayer(continuousPlaylist[currentTrackIndex]);
        };
        container.appendChild(row);
    });
}

// ==========================================
// 4. METADATA & LAST.FM
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

// ==========================================
// 5. INITIALIZATION
// ==========================================
Promise.all([
    fetch('features.json').then(res => res.json()).catch(() => []),
    fetch('upgraded_tracks.json').then(res => res.json()).catch(() => [])
]).then(([features, tracks]) => {
    featureQueue = features; trackQueue = tracks;
    buildContinuousBroadcast();
    setupSearchFunctionality();
});
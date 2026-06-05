// ==========================================
// 1. CONFIGURATION & STATE
// ==========================================
const LAST_FM_API_KEY = "67151f1c5943c2b35b9750ab48ac296f"; 
let featureQueue = [], trackQueue = [], continuousPlaylist = [], currentTrackIndex = 0, videoJSInstance = null;

function shuffle(array) { return array.sort(() => Math.random() - 0.5); }

// ==========================================
// 2. PLAYER ENGINE
// ==========================================
function tuneIn() {
    document.getElementById('tv-tuner-overlay').style.display = 'none';
    
    // 50/50 chance to start at a random point in the playlist
    // OR you can just set currentTrackIndex = 0 if you want it to start at the beginning
    currentTrackIndex = Math.floor(Math.random() * continuousPlaylist.length);
    
    if (continuousPlaylist.length > 0) {
        loadVideoJSPlayer(continuousPlaylist[currentTrackIndex]);
    }
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
    // Move to the next index, and loop back to 0 if at the end
    currentTrackIndex = (currentTrackIndex + 1) % continuousPlaylist.length;
    loadVideoJSPlayer(continuousPlaylist[currentTrackIndex]); 
}

// ==========================================
// 3. BROADCAST & SEARCH LOGIC
// ==========================================
function buildContinuousBroadcast() {
    // 1. Randomize all source data first
    const sFeatures = shuffle([...featureQueue]);
    const sTracks = shuffle([...trackQueue]);
    
    continuousPlaylist = [];
    let fPtr = 0;
    
    // 2. Distribute features across the songs
    // We want a feature every ~7 songs.
    for (let i = 0; i < sTracks.length; i++) {
        // Always add the song
        continuousPlaylist.push({...sTracks[i], broadcastType: 'song'});
        
        // Every 7th position, inject a feature
        if ((i + 1) % 7 === 0 && fPtr < sFeatures.length) {
            continuousPlaylist.push({...sFeatures[fPtr], broadcastType: 'feature'});
            fPtr++;
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
        div.onclick = () => loadVideoJSPlayer(item, targetIndex);
        container.appendChild(div);
    }
}

// ==========================================
// 4. LAST.FM API ART & METADATA FETCHING
// ==========================================
function updateUIElements(item) {
    if (!item) return;
    
    const nowPlayingText = document.getElementById('now-playing');
    const albumNameText = document.getElementById('album-name');
    const albumYearText = document.getElementById('album-year');
    
    resetMetadataUI();

    if (item.broadcastType === 'feature') {
        if (nowPlayingText) nowPlayingText.innerText = `[FEATURE] ${item.Title}`;
        if (albumNameText) albumNameText.innerText = item.Source || "Music Authority";
        if (albumYearText) albumYearText.innerText = "Video Deep Dive";
        
        setAlbumArt("default_album.png");
        setArtistSummary(item.Summary || "A curated music feature presentation.");
    } else {
        if (nowPlayingText) nowPlayingText.innerText = `${item.Artist} - ${item.Title}`;
        if (albumNameText) albumNameText.innerText = item.Album || "Single Track";
        
        // Preserved mapping for your custom layout key
        if (albumYearText) albumYearText.innerText = item.ReleaseDate || "Unknown Year";
        
        fetchLastFmData(item.Artist, item.Album || item.Title);
    }
    
    updateUpcomingTracksList();
}

function fetchLastFmData(artist, albumOrTrack) {
    if (!LAST_FM_API_KEY) return;

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
            const summary = data?.artist?.bio?.summary;
            if (summary && summary.trim().length > 0) {
                setArtistSummary(summary);
            } else {
                setArtistSummary("No biography available for this artist on Last.fm.");
            }
        })
        .catch(() => setArtistSummary("Continuous music rotation active."));
}

function setAlbumArt(src) {
    const art = document.getElementById('album-art');
    if (art) art.src = src;
}

// --- RESTORED TYPEWRITER ENGINE FOR SCROLLING TEXT ---
function setArtistSummary(text) {
    const box = document.getElementById('artist-summary');
    const toggleBtn = document.getElementById('summary-toggle');
    if (!box) return;

    // Clean up HTML anchors or tags Last.fm passes for clean character limits
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = text;
    fullBiographyText = tempDiv.innerText || tempDiv.textContent;

    box.innerHTML = "";
    if (toggleBtn) toggleBtn.style.display = 'none';

    const characterLimit = 180; 
    let textToType = fullBiographyText;
    let isTooLong = false;

    if (fullBiographyText.length > characterLimit) {
        textToType = fullBiographyText.substring(0, characterLimit) + "...";
        isTooLong = true;
    }

    let currentCharIndex = 0;
    if (window.ztvTypeTimer) clearInterval(window.ztvTypeTimer);

    window.ztvTypeTimer = setInterval(() => {
        if (currentCharIndex < textToType.length) {
            box.innerHTML += textToType.charAt(currentCharIndex);
            currentCharIndex++;
        } else {
            clearInterval(window.ztvTypeTimer);
            if (isTooLong && toggleBtn) {
                toggleBtn.style.display = 'block';
                toggleBtn.innerText = "Read more";
            }
        }
    }, 15); 
}

// --- RESTORED MULTI-DIRECTIONAL TOGGLE ENGINE ---
function showFullDescription() {
    const box = document.getElementById('artist-summary');
    const toggleBtn = document.getElementById('summary-toggle');
    if (!box) return;

    if (toggleBtn.innerText === "Read less") {
        setArtistSummary(fullBiographyText);
        return;
    }

    if (window.ztvTypeTimer) clearInterval(window.ztvTypeTimer);
    box.innerHTML = fullBiographyText;
    
    if (toggleBtn) {
        toggleBtn.innerText = "Read less";
    }
}

function resetMetadataUI() {
    setAlbumArt("default_album.png");
    if (window.ztvTypeTimer) clearInterval(window.ztvTypeTimer);
    const box = document.getElementById('artist-summary');
    if (box) box.innerHTML = "Loading metadata spectrum...";
}


// ==========================================
// 5. SEARCH ENGINE
// ==========================================
function setupSearchFunctionality() {
    const dBar = document.getElementById('search-bar');
    const mBar = document.getElementById('search-bar-mobile');

    if (dBar) {
        dBar.oninput = (e) => runSearchFilter(e.target.value, 'search-results');
    }

    if (mBar) {
        // Adding both input and keyup for broader mobile support
        const handleSearch = (e) => runSearchFilter(e.target.value, 'search-results-mobile');
        mBar.addEventListener('input', handleSearch);
        mBar.addEventListener('keyup', handleSearch);
    }
}

function runSearchFilter(query, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '';
    if (!query.trim()) return;
    const lowerQuery = query.toLowerCase();
    const results = [...trackQueue.filter(t => t.Title.toLowerCase().includes(lowerQuery) || t.Artist.toLowerCase().includes(lowerQuery)), ...featureQueue.filter(f => f.Title.toLowerCase().includes(lowerQuery))].slice(0, 10);
    results.forEach(item => {
        const row = document.createElement('div');
        row.className = 'search-result-item';
        row.style.cursor = 'pointer'; row.style.padding = '5px';
        row.innerText = item.Artist ? `${item.Artist} - ${item.Title}` : `[TV] ${item.Title}`;
        row.onclick = () => {
            document.querySelectorAll('input').forEach(i => i.value = '');
            container.innerHTML = '';
            const trackToPlay = { ...item, broadcastType: item.Artist ? 'song' : 'feature' };
            continuousPlaylist.splice(currentTrackIndex + 1, 0, trackToPlay);
            currentTrackIndex = currentTrackIndex + 1;
            loadVideoJSPlayer(continuousPlaylist[currentTrackIndex]);
        };
        container.appendChild(row);
    });
}

// ==========================================
// 6. INITIALIZATION
// ==========================================
Promise.all([
    fetch('features.json').then(res => res.json()).catch(() => []),
    fetch('upgraded_tracks.json').then(res => res.json()).catch(() => [])
]).then(([features, tracks]) => {
    featureQueue = features; trackQueue = tracks;
    buildContinuousBroadcast();
    setupSearchFunctionality();
});
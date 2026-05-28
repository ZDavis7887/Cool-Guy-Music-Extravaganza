// ==========================================
// CONFIGURATION & GLOBAL STATE
// ==========================================
const LAST_FM_API_KEY = "67151f1c5943c2b35b9750ab48ac296f"; 

let featureQueue = [];
let trackQueue = [];
let continuousPlaylist = [];
let currentTrackIndex = 0;
let player; 
let isVideoHidden = false;
let fullBiographyText = ""; // Global state for the typewriter engine

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
    console.log("[ZTV Data] Features loaded:", features.length, "Tracks loaded:", tracks.length);
    
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
        trackRow.style.cursor = 'pointer'; 
        
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
// 6. RAW DATABASE SEARCH ENGINE INTERACTION
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
    let matchesFound = 0;
    const maxResults = 25; // Keeps the dropdown clean and performant

    // 1. SCAN ALL FEATURES
    featureQueue.forEach((item) => {
        if (matchesFound >= maxResults) return;
        
        const titleMatch = item.Title?.toLowerCase().includes(cleanQuery);
        const sourceMatch = item.Source?.toLowerCase().includes(cleanQuery);
        
        if (titleMatch || sourceMatch) {
            matchesFound++;
            createSearchResultRow(item, container, true);
        }
    });

    // 2. SCAN ALL SONGS (Queries the entire raw database)
    trackQueue.forEach((item) => {
        if (matchesFound >= maxResults) return;
        
        const titleMatch = item.Title?.toLowerCase().includes(cleanQuery);
        const artistMatch = item.Artist?.toLowerCase().includes(cleanQuery);
        const albumMatch = item.Album?.toLowerCase().includes(cleanQuery);
        
        if (titleMatch || artistMatch || albumMatch) {
            matchesFound++;
            createSearchResultRow(item, container, false);
        }
    });
}

// Helper function to build clickable rows and handle instant insertion playback
function createSearchResultRow(item, container, isFeature) {
    const row = document.createElement('div');
    row.className = 'search-result-item';
    row.style.padding = '6px';
    row.style.cursor = 'pointer';
    row.style.borderBottom = '1px solid #222';
    
    if (isFeature) {
        row.innerHTML = `<small style="color:#ff0055; font-weight:bold;">[Feature]</small> ${item.Title}`;
    } else {
        row.innerHTML = `<strong>${item.Artist}</strong> - ${item.Title} <small style="color:#888;">(${item.Album || 'Single'})</small>`;
    }
    
    row.onclick = () => {
        // Clear search inputs and dropdown results visually
        container.innerHTML = '';
        const dBar = document.getElementById('search-bar');
        const mBar = document.getElementById('search-bar-mobile');
        if (dBar) dBar.value = '';
        if (mBar) mBar.value = '';
        
        // Ensure the item carries its structural type tag for UI mapping elements
        const trackToPlay = {
            ...item,
            broadcastType: isFeature ? 'feature' : 'song'
        };

        console.log("[Search Intercept] Injecting requested track into live stream:", trackToPlay);

        // Dynamically splice the requested track right into our active timeline position
        continuousPlaylist.splice(currentTrackIndex, 0, trackToPlay);
        
        // Instantly trigger the player pipeline update
        changeTrack(currentTrackIndex);
    };
    
    container.appendChild(row);
}

// ==========================================
// 7. UTILITY HELPERS
// ==========================================
function extractVideoId(url) {
    if (!url) return '';
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : url;
}
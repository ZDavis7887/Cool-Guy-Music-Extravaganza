// ==========================================
// MASTER BROADCAST QUEUES & STATE
// ==========================================
let featureQueue = [];
let trackQueue = [];
let continuousPlaylist = [];
let currentTrackIndex = 0;
let player; // YouTube Iframe Player reference
let isVideoHidden = false;

// 1. The Shuffle Engine (Fisher-Yates)
function shuffleArray(array) {
    if (!Array.isArray(array)) return [];
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

// 2. Load Data Assets Simultaneously
Promise.all([
    fetch('features.json').then(res => {
        if (!res.ok) throw new Error("Could not find features.json");
        return res.json();
    }),
    fetch('tracks.json').then(res => {
        if (!res.ok) throw new Error("Could not find tracks.json");
        return res.json();
    })
])
.then(([features, tracks]) => {
    console.log("[ZTV Data] Features loaded:", features.length, "Tracks loaded:", tracks.length);
    
    featureQueue = shuffleArray(features);
    trackQueue = shuffleArray(tracks);
    
    buildContinuousBroadcast();
})
.catch(err => console.error("[ZTV Core Failure] Initialization dropped:", err));

// 3. Assemble the 1-Feature-to-7-Songs Timeline
function buildContinuousBroadcast() {
    continuousPlaylist = [];
    let fIndex = 0;
    let tIndex = 0;
    
    const hasFeatures = featureQueue.length > 0;
    const hasTracks = trackQueue.length > 0;
    const startWithFeature = hasFeatures && (Math.random() < 0.5);
    
    // Generate a massive 500+ item broadcast timeline rotation
    for (let block = 0; block < 60; block++) {
        // Feature slot
        if (hasFeatures) {
            if (block === 0 && !startWithFeature) {
                // Skip initial feature if coin-flip dictates starting with music tracks
            } else {
                continuousPlaylist.push({
                    ...featureQueue[fIndex % featureQueue.length],
                    broadcastType: 'feature'
                });
                fIndex++;
            }
        }
        
        // 7-Track Music Block Slot
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
    console.log("[✓ Timeline Ready] Structured rotation compiled. Total blocks:", continuousPlaylist.length);
}

// 4. Global Action: Tune In Button Click
function tuneIn() {
    console.log("[UI] Activating ZTV Stream...");
    
    // Hide the static overlay screen cleanly
    const overlay = document.getElementById('tv-tuner-overlay');
    if (overlay) {
        overlay.style.display = 'none';
    }
    
    // Initialize YouTube Player Frame if it doesn't exist yet
   if (!player && continuousPlaylist.length > 0) {
        loadYouTubePlayer(continuousPlaylist[currentTrackIndex]);
    }
}

// 5. YouTube Iframe API Integration
function loadYouTubePlayer(initialItem) {
    // Extract video ID from full YouTube Link
    const videoId = extractVideoId(initialItem.YouTubeLink);
    
    // Load the script element dynamically if needed
    if (typeof YT === 'undefined' || typeof YT.Player === 'undefined') {
        const tag = document.createElement('script');
        tag.src = "https://www.youtube.com/iframe_api";
        const firstScriptTag = document.getElementsByTagName('script')[0];
        firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
        
        window.onYouTubeIframeAPIReady = () => {
            initPlayerInstance(videoId, initialItem);
        };
    } else {
        initPlayerInstance(videoId, initialItem);
    }
}

function initPlayerInstance(videoId, item) {
    player = new YT.Player('player', {
        height: '100%',
        width: '100%',
        videoId: videoId,
        playerVars: {
            'autoplay': 1,
            'controls': 1,
            'modestbranding': 1,
            'rel': 0
        },
        events: {
            'onReady': (event) => {
                event.target.playVideo();
                updateUIElements(item);
            },
            'onStateChange': (event) => {
                // Automatically transition when a track ends (State 0 = Ended)
                if (event.data === YT.PlayerState.ENDED) {
                    nextSong();
                }
            }
        }
    });
}

// 6. Update the Winamp UI Elements
function updateUIElements(item) {
    if (!item) return;
    
    const nowPlayingText = document.getElementById('now-playing');
    const albumNameText = document.getElementById('album-name');
    const albumYearText = document.getElementById('album-year');
    const summaryBox = document.getElementById('artist-summary');

    // Display track vs feature context layout differences
    if (item.broadcastType === 'feature') {
        if (nowPlayingText) nowPlayingText.innerText = `[FEATURE] ${item.Title || 'Unknown Feature'}`;
        if (albumNameText) albumNameText.innerText = item.Source || "Music Documentary";
        if (albumYearText) albumYearText.innerText = "Video Essay";
        if (summaryBox) summaryBox.innerText = item.Summary || "A curated music feature preservation presentation.";
    } else {
        if (nowPlayingText) nowPlayingText.innerText = `${item.Artist || 'Unknown Artist'} - ${item.Title || 'Untitled Track'}`;
        if (albumNameText) albumNameText.innerText = item.Album || "Single Track";
        if (albumYearText) albumYearText.innerText = item.Year || "Unknown Year";
        if (summaryBox) summaryBox.innerText = "Continuous music rotation active.";
    }
    
    updateUpcomingTracksList();
}

// 7. Update Winamp Playlist Preview Panel
function updateUpcomingTracksList() {
    const upcomingContainer = document.getElementById('upcoming-tracks');
    if (!upcomingContainer) return;
    
    upcomingContainer.innerHTML = '<h3>Up Next</h3>';
    
    // Display the next 10 items in the compiled sequence queue
    for (let i = 1; i <= 10; i++) {
        const nextItem = continuousPlaylist[(currentTrackIndex + i) % continuousPlaylist.length];
        if (!nextItem) continue;
        
        const trackRow = document.createElement('div');
        trackRow.className = 'upcoming-item';
        trackRow.style.padding = '4px 0';
        trackRow.style.fontSize = '12px';
        
        if (nextItem.broadcastType === 'feature') {
            trackRow.innerHTML = `<span style="color: #ff0055;">[TV] ${nextItem.Title}</span>`;
        } else {
            trackRow.innerHTML = `<span>${nextItem.Artist} - ${nextItem.Title}</span>`;
        }
        upcomingContainer.appendChild(trackRow);
    }
}

// 8. Player Navigation Controls
function nextSong() {
    if (continuousPlaylist.length === 0) return;
    currentTrackIndex = (currentTrackIndex + 1) % continuousPlaylist.length;
    changeTrack(continuousPlaylist[currentTrackIndex]);
}

function prevSong() {
    if (continuousPlaylist.length === 0) return;
    currentTrackIndex = (currentTrackIndex - 1 + continuousPlaylist.length) % continuousPlaylist.length;
    changeTrack(continuousPlaylist[currentTrackIndex]);
}

function shuffleSong() {
    // Explicit action resets the broadcast grid entirely for a manual override mix
    console.log("[Controls] Reshuffling entire radio spectrum layout...");
    featureQueue = shuffleArray(featureQueue);
    trackQueue = shuffleArray(trackQueue);
    buildContinuousBroadcast();
    changeTrack(continuousPlaylist[currentTrackIndex]);
}

function toggleVideo() {
    const playerElement = document.getElementById('player');
    if (!playerElement) return;
    isVideoHidden = !isVideoHidden;
    playerElement.style.display = isVideoHidden ? 'none' : 'block';
}

function changeTrack(item) {
    if (!item || !player) return;
    const videoId = extractVideoId(item.YouTubeLink);
    player.loadVideoById(videoId);
    updateUIElements(item);
}

function extractVideoId(url) {
    if (!url) return '';
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : url;
}

// Fallback stub to prevent layout crashes for description toggle button
function showFullDescription() {
    const summaryBox = document.getElementById('artist-summary');
    if (summaryBox) {
        summaryBox.style.maxHeight = 'none';
    }
}
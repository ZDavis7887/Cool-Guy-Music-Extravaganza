const API_KEY = "67151f1c5943c2b35b9750ab48ac296f";
let tracklist = [];
let player;
let currentTrackIndex = -1;
let playbackQueue = [];
let typing = null;
let currentSummaryIndex = 0;

// --- 1. GLOBAL SYNC LOGIC ---
function seededRandom(seed) {
    return function() {
        seed = (seed * 1664525 + 1013904223) % 4294967296;
        return seed / 4294967296;
    };
}

function generatePlaybackQueue() {
    const array = [...tracklist];
    const today = new Date();
    // Seeded by date so everyone on Earth sees the same order today
    const seedValue = today.getFullYear() * 10000 + (today.getMonth() + 1) * 100 + today.getDate();
    const random = seededRandom(seedValue);

    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    playbackQueue = array;
}

function getLiveTrack() {
    const AVG_DURATION = 210; // Fixed 3.5m "slot" for global sync
    const totalQueueSeconds = playbackQueue.length * AVG_DURATION;
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const secondsSinceMidnight = (now - startOfDay) / 1000;
    
    const currentCycleTime = secondsSinceMidnight % totalQueueSeconds;
    const trackIndex = Math.floor(currentCycleTime / AVG_DURATION);
    const seekTo = Math.floor(currentCycleTime % AVG_DURATION);

    return { 
        track: playbackQueue[trackIndex], 
        index: trackIndex,
        startAt: seekTo 
    };
}

// --- 2. LOADING & API ---
async function loadTracks() {
    try {
        const response = await fetch('upgraded_tracks.json');
        tracklist = await response.json();
        generatePlaybackQueue();
        loadYouTubeAPI();
        setupSearchAll();
    } catch (e) {
        console.error("Critical Error: Could not load upgraded_tracks.json", e);
    }
}

function loadYouTubeAPI() {
    const tag = document.createElement('script');
    tag.src = "https://www.youtube.com/iframe_api";
    const firstScriptTag = document.getElementsByTagName('script')[0];
    firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
}

window.onYouTubeIframeAPIReady = async function() {
    const live = getLiveTrack();
    currentTrackIndex = live.index;
    await playTrack(live.track, live.index, live.startAt);
};

// --- 3. CORE PLAYBACK (UI & ARTWORK) ---
async function playTrack(track, index = null, startTime = 0) {
    if (!track.YouTubeLink || track.YouTubeLink === "Not Found") {
        window.nextSong();
        return;
    }

    if (index !== null) currentTrackIndex = index;
    const videoId = extractVideoId(track.YouTubeLink);

    if (videoId) {
        if (player) {
            player.loadVideoById({
                videoId: videoId,
                startSeconds: startTime
            });
        } else {
            player = new YT.Player('player', {
                height: '315',
                width: '560',
                videoId: videoId,
                playerVars: { 
                    'autoplay': 1, 
                    'mute': 1, 
                    'start': startTime,
                    'origin': 'https://zdavis7887.github.io'
                },
                events: { 'onStateChange': onPlayerStateChange }
            });
        }

        // UPDATE UI
        const nowPlayingEl = document.getElementById('now-playing');
        nowPlayingEl.innerText = `Now Playing: ${track.Artist} - ${track.Title}`;
        
        // Artwork Fix: Explicitly using AlbumArtLink
        const artEl = document.getElementById('album-art');
        if (artEl) {
            artEl.src = track.AlbumArtLink || 'default_album.png';
        }

        // Metadata
        const albumEl = document.getElementById('album-name');
        if (albumEl) albumEl.innerText = track.Album || 'Unknown Album';
        
        const yearEl = document.getElementById('album-year');
        if (yearEl) yearEl.innerText = track.ReleaseDate || 'Unknown Date';

        // Summary RPG Logic
        const summaryEl = document.getElementById('artist-summary');
        const summaryToggle = document.getElementById('summary-toggle');
        const fullSummary = track.Summary || 'No artist info available.';
        const shortSummary = fullSummary.length > 300 ? fullSummary.slice(0, 300) + '...' : fullSummary;

        if (summaryEl) {
            summaryEl.innerText = "";
            if (window.innerWidth > 768) {
                typeRPG(shortSummary, summaryEl);
            } else {
                summaryEl.innerText = shortSummary;
            }
        }

        if (summaryToggle) {
            summaryToggle.style.display = fullSummary.length > 300 ? 'inline' : 'none';
            summaryToggle.innerText = 'Read more';
            summaryToggle.onclick = () => {
                if (summaryToggle.innerText === 'Read more') {
                    summaryEl.innerText = fullSummary;
                    summaryToggle.innerText = 'Show less';
                } else {
                    typeRPG(shortSummary, summaryEl);
                    summaryToggle.innerText = 'Read more';
                }
            };
        }
        renderUpcomingTracks();
    }
}

// --- 4. UTILITIES ---
function extractVideoId(url) {
    const regex = /[?&]v=([^&#]*)/;
    const match = url.match(regex);
    return match ? match[1] : null;
}

function onPlayerStateChange(event) {
    if (event.data === YT.PlayerState.ENDED) {
        window.nextSong();
    }
}

function typeRPG(text, container, start = 0, speed = 12) {
    clearInterval(typing);
    container.innerText = text.slice(0, start);
    let i = start;
    typing = setInterval(() => {
        if (i < text.length) {
            container.innerText += text.charAt(i);
            i++;
        } else {
            clearInterval(typing);
        }
    }, speed);
}

function renderUpcomingTracks() {
    const container = document.getElementById('upcoming-tracks');
    if (!container) return;
    container.innerHTML = '<h3>Upcoming Broadcasts</h3>';
    
    const nextTracks = playbackQueue.slice(currentTrackIndex + 1, currentTrackIndex + 11);
    nextTracks.forEach((track, i) => {
        const div = document.createElement('div');
        div.className = 'track-item';
        const link = document.createElement('a');
        link.href = '#';
        link.className = 'upcoming-track-link';
        link.style.color = "#00ff00";
        link.innerText = `${track.Artist} - ${track.Title}`;
        link.onclick = (e) => {
            e.preventDefault();
            playTrack(track, currentTrackIndex + 1 + i, 0);
        };
        div.appendChild(link);
        container.appendChild(div);
    });
}

// --- 5. SEARCH ENGINE ---
function setupSearchAll() {
    const desktopSearch = { input: document.getElementById('search-bar'), results: document.getElementById('search-results') };
    const mobileSearch = { input: document.getElementById('search-bar-mobile'), results: document.getElementById('search-results-mobile') };

    [desktopSearch, mobileSearch].forEach(search => {
        if (!search.input || !search.results) return;

        search.input.addEventListener('input', () => {
            const query = search.input.value.toLowerCase().trim();
            search.results.innerHTML = '';
            if (!query) { search.results.style.display = 'none'; return; }

            const matches = tracklist.filter(t => 
                t.Artist.toLowerCase().includes(query) || t.Title.toLowerCase().includes(query)
            ).slice(0, 10);

            matches.forEach(track => {
                const div = document.createElement('div');
                div.className = 'search-result';
                div.style.cursor = 'pointer';
                div.innerHTML = `<strong>${track.Artist}</strong> - ${track.Title}`;
                div.onclick = () => {
                    playTrack(track, null, 0);
                    search.input.value = '';
                    search.results.style.display = 'none';
                };
                search.results.appendChild(div);
            });
            search.results.style.display = 'block';
        });
    });
}

// --- 6. EXPOSURE & CONTROLS ---
window.nextSong = async function() {
    currentTrackIndex++;
    if (currentTrackIndex >= playbackQueue.length) {
        generatePlaybackQueue();
        currentTrackIndex = 0;
    }
    await playTrack(playbackQueue[currentTrackIndex], currentTrackIndex, 0);
};

window.unmutePlayer = function() {
    if (player) {
        player.unMute();
        const overlay = document.getElementById('mute-overlay');
        if (overlay) overlay.style.display = 'none';
    }
};

window.shuffleSong = window.nextSong;
window.toggleVideo = () => {
    const p = document.getElementById('player');
    if(p) p.style.display = p.style.display === 'none' ? 'block' : 'none';
};

// Start the show
loadTracks();
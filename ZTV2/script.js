const API_KEY = "67151f1c5943c2b35b9750ab48ac296f";
let tracklist = [];
let player;
let currentTrackIndex = -1;
let playbackQueue = [];
let typing = null;
let currentSummaryIndex = 0;

function seededRandom(seed) {
    return function() {
        seed = (seed * 1664525 + 1013904223) % 4294967296;
        return seed / 4294967296;
    };
}

async function loadTracks() {
    try {
        const response = await fetch('upgraded_tracks.json');
        tracklist = await response.json();
        generatePlaybackQueue();
        loadYouTubeAPI();
    } catch (e) {
        console.error("Failed to load tracklist:", e);
    }
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

function getLiveTrack() {
    const AVG_DURATION = 210; 
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

function loadYouTubeAPI() {
    const tag = document.createElement('script');
    tag.src = "https://www.youtube.com/iframe_api";
    const firstScriptTag = document.getElementsByTagName('script')[0];
    firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
}

// THIS MUST BE ON THE WINDOW OBJECT FOR YOUTUBE TO SEE IT
window.onYouTubeIframeAPIReady = async function() {
    const live = getLiveTrack();
    currentTrackIndex = live.index;
    await playTrack(live.track, live.index, live.startAt);
}

async function playTrack(track, index = null, startTime = 0) {
    if (!track.YouTubeLink || track.YouTubeLink === "Not Found") {
        nextSong();
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
                    'mute': 1, // START MUTED TO BYPASS BROWSER BLOCKS
                    'origin': 'https://zdavis7887.github.io', // <--- Add this line
                    'start': startTime,
                    'controls': 1,
                    'modestbranding': 1
                },
                events: {
                    'onStateChange': onPlayerStateChange,
                    'onReady': (e) => { e.target.playVideo(); }
                }
            });
        }

        document.getElementById('now-playing').innerText = `Now Playing: ${track.Artist} - ${track.Title}`;
        const summaryEl = document.getElementById('artist-summary');
        typeRPG(track.Summary || 'No info.', summaryEl);
        renderUpcomingTracks();
    }
}

// BINDING TO WINDOW FOR YOUR HTML BUTTONS
window.nextSong = async function() {
    currentTrackIndex++;
    if (currentTrackIndex >= playbackQueue.length) {
        generatePlaybackQueue();
        currentTrackIndex = 0;
    }
    await playTrack(playbackQueue[currentTrackIndex], currentTrackIndex, 0);
};

window.shuffleSong = window.nextSong;

window.unmutePlayer = function() {
    if (player) {
        player.unMute();
        document.getElementById('mute-overlay').style.display = 'none';
    }
};

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
    
    // We take a slice of 10 tracks starting from the next one
    const nextTracks = playbackQueue.slice(currentTrackIndex + 1, currentTrackIndex + 11);
    
    nextTracks.forEach((track, i) => {
        const div = document.createElement('div');
        div.className = 'track-item';
        div.style.marginBottom = '8px'; // Added a little breathing room
        
        // Creating the link so you can still click ahead in the 'broadcast'
        const link = document.createElement('a');
        link.href = '#';
        link.className = 'upcoming-track-link';
        link.style.color = '#00ff00';
        link.style.textDecoration = 'none';
        link.innerText = `${track.Artist} - ${track.Title}`;
        
        link.onclick = function (e) {
            e.preventDefault();
            // Jump to this track at the start (0 seconds)
            window.playTrack(track, currentTrackIndex + 1 + i, 0);
        };
        
        div.appendChild(link);
        container.appendChild(div);
    });
}
loadTracks();
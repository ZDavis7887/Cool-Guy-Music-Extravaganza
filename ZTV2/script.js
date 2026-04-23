// 4. UTILITIES & SEARCH (Continued)
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
    
    // Shows the next 10 tracks in the synced queue
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

// 5. SEARCH LOGIC (Unified for Mobile/Desktop)
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

// 6. GLOBAL WINDOW EXPOSURE
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
    p.style.display = p.style.display === 'none' ? 'block' : 'none';
};

// INITIALIZE
loadTracks();
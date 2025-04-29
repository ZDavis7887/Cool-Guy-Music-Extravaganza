const API_KEY = "67151f1c5943c2b35b9750ab48ac296f";
let tracklist = [];
let player;
let currentTrackIndex = -1;
let playbackQueue = [];
let typing = null;
let currentSummaryIndex = 0;
let summarySegmentIndex = 0;

async function loadTracks() {
  const response = await fetch('tracks.json');
  tracklist = await response.json();
  generatePlaybackQueue();
  loadYouTubeAPI();
}

function generatePlaybackQueue() {
  // Fisher-Yates shuffle for stronger randomness
  const array = [...tracklist];
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  playbackQueue = array;
}

function loadYouTubeAPI() {
  const tag = document.createElement('script');
  tag.src = "https://www.youtube.com/iframe_api";
  const firstScriptTag = document.getElementsByTagName('script')[0];
  firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
}

function onYouTubeIframeAPIReady() {
  nextSong();
}

function typeRPG(text, container, start = 0, speed = 12) {
  clearInterval(typing);
  currentSummaryIndex = start;
  container.innerText = text.slice(0, start);
  typing = setInterval(() => {
    if (currentSummaryIndex < text.length) {
      container.innerText += text.charAt(currentSummaryIndex);
      currentSummaryIndex++;
    } else {
      clearInterval(typing);
    }
  }, speed);
}

async function playTrack(track, index = null) {
  if (!track.YouTubeLink || track.YouTubeLink === "Not Found") {
    console.error("❌ No valid YouTube link for track:", track);
    document.getElementById('player').innerHTML = "No video found!";
    return;
  }

  if (index !== null) {
    currentTrackIndex = index;
  }

  const videoId = extractVideoId(track.YouTubeLink);

  if (videoId) {
    if (player) {
      player.loadVideoById(videoId);
    } else {
      player = new YT.Player('player', {
        height: '315',
        width: '560',
        videoId: videoId,
        events: {
          'onStateChange': onPlayerStateChange
        }
      });
    }

    const nowPlayingEl = document.getElementById('now-playing');
    nowPlayingEl.innerText = `Now Playing: ${track.Artist} - ${track.Title}`;
    nowPlayingEl.classList.remove('scrolling-text');
    void nowPlayingEl.offsetWidth; // trigger reflow
    nowPlayingEl.classList.add('scrolling-text');
    document.getElementById('album-art').src = track.AlbumArtLink || 'default_album.png';
    document.getElementById('album-name').innerText = track.Album || 'Unknown Album';
    document.getElementById('album-year').innerText = track.ReleaseDate || 'Unknown Release Date';

    const summaryEl = document.getElementById('artist-summary');
    const summaryToggle = document.getElementById('summary-toggle');

    const fullSummary = track.Summary || 'No artist info available.';
    const shortSummary = fullSummary.length > 300 ? fullSummary.slice(0, 300) + '...' : fullSummary;

    summaryEl.style.minHeight = '6em';
    summaryEl.innerText = "";
    summaryEl.style.color = "#00ff00";

    typeRPG(shortSummary, summaryEl);

    summaryToggle.style.display = fullSummary.length > 300 ? 'inline' : 'none';
    summaryToggle.innerText = 'Read more';
    summaryToggle.onclick = () => {
  summaryEl.style.minHeight = '6em';
  summaryEl.style.maxHeight = '500px';
  summaryEl.style.overflowY = 'auto';

  if (summaryToggle.innerText === 'Read more') {
    summaryEl.innerText = fullSummary;
    summaryToggle.innerText = 'Show less';
  } else {
    summaryEl.innerText = '';
    currentSummaryIndex = 0;
    typeRPG(shortSummary, summaryEl);
    summaryToggle.innerText = 'Read more';
  }
};

    renderUpcomingTracks();
  } else {
    console.error("❌ Could not extract video ID from:", track);
    document.getElementById('player').innerHTML = "No video found!";
  }
}

function extractVideoId(url) {
  const regex = /[?&]v=([^&#]*)/;
  const match = url.match(regex);
  return match ? match[1] : null;
}

function renderUpcomingTracks() {
  const container = document.getElementById('upcoming-tracks');
  if (!container) return;

  container.innerHTML = '<h3>Upcoming Tracks</h3>';
  const nextTracks = playbackQueue.slice(currentTrackIndex + 1, currentTrackIndex + 11);
  nextTracks.forEach((track, i) => {
    const div = document.createElement('div');
    div.className = 'track-item';
    div.style.marginBottom = '5px';
    const link = document.createElement('a');
    link.href = '#';
    link.className = 'upcoming-track-link';
    link.innerText = `${track.Artist} - ${track.Title}`;
    link.onclick = function (e) {
      e.preventDefault();
      playTrack(playbackQueue[currentTrackIndex + 1 + i], currentTrackIndex + 1 + i);
    };
    div.appendChild(link);
    container.appendChild(div);
  });
}

async function nextSong() {
  currentTrackIndex++;
  if (currentTrackIndex >= playbackQueue.length) {
    generatePlaybackQueue();
    currentTrackIndex = 0;
  }
  await playTrack(playbackQueue[currentTrackIndex], currentTrackIndex);
}

async function shuffleSong() {
  await nextSong();
}

function prevSong() {
  shuffleSong();
}

function toggleVideo() {
  const playerDiv = document.getElementById('player');
  playerDiv.style.display = playerDiv.style.display === 'none' ? 'block' : 'none';
}

function onPlayerStateChange(event) {
  if (event.data === YT.PlayerState.ENDED) {
    nextSong();
  }
}

window.nextSong = nextSong;
window.shuffleSong = shuffleSong;
window.toggleVideo = toggleVideo;

loadTracks();

const searchInput = document.getElementById('search-bar');
const searchResults = document.getElementById('search-results');

searchInput.addEventListener('input', function () {
  const query = searchInput.value.toLowerCase();
  searchResults.innerHTML = '';

  if (!query.trim()) {
    searchResults.style.display = 'none';
    return;
  }

  const matches = tracklist.filter(track =>
    track.Artist.toLowerCase().includes(query) ||
    track.Title.toLowerCase().includes(query)
  );

  if (matches.length === 0) {
    searchResults.innerHTML = '<div style="padding:5px;">No results found.</div>';
  } else {
    matches.forEach((track) => {
      const div = document.createElement('div');
      div.className = 'search-result';
      div.style.marginBottom = '5px';
      div.style.cursor = 'pointer';
      div.innerHTML = `<strong>${track.Artist}</strong> - ${track.Title}`;
      div.onclick = () => {
        playTrack(track);
        searchResults.innerHTML = '';
        searchInput.value = '';
        searchResults.style.display = 'none';
      };
      searchResults.appendChild(div);
    });
  }

  searchResults.style.display = 'block';
});

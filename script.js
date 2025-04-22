const API_KEY = "67151f1c5943c2b35b9750ab48ac296f";
let tracklist = [];
let player;

async function loadTracks() {
  const response = await fetch('tracks.json');
  tracklist = await response.json();
  loadYouTubeAPI();
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

async function playTrack(track) {
  if (!track.YouTubeLink || track.YouTubeLink === "Not Found") {
    console.error("❌ No valid YouTube link for track:", track);
    document.getElementById('player').innerHTML = "No video found!";
    return;
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

    document.getElementById('now-playing').innerText = `Now Playing: ${track.Artist} - ${track.Title}`;
    document.getElementById('album-art').src = track.AlbumArtLink || 'default_album.png';
    document.getElementById('album-name').innerText = track.Album || 'Unknown Album';
    document.getElementById('album-year').innerText = track.ReleaseDate || 'Unknown Release Date';

    const summaryEl = document.getElementById('artist-summary');
    const summaryToggle = document.getElementById('summary-toggle');

    const fullSummary = track.Summary || 'No artist info available.';
    const shortSummary = fullSummary.length > 300 ? fullSummary.slice(0, 300) + '...' : fullSummary;

    summaryEl.innerHTML = "";
    summaryEl.style.color = "#00ff00";

    let i = 0;
    function typeSummary(text) {
      if (i < text.length) {
        summaryEl.innerHTML += text.charAt(i);
        i++;
        setTimeout(() => typeSummary(text), 10);
      }
    }

    typeSummary(shortSummary);

    summaryToggle.style.display = fullSummary.length > 300 ? 'inline' : 'none';
    summaryToggle.innerText = 'Read more';
    summaryToggle.onclick = () => {
      if (summaryToggle.innerText === 'Read more') {
        summaryEl.innerText = fullSummary;
        summaryToggle.innerText = 'Show less';
      } else {
        summaryEl.innerText = shortSummary;
        summaryToggle.innerText = 'Read more';
      }
    };
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

async function nextSong() {
  const randomIndex = Math.floor(Math.random() * tracklist.length);
  const track = tracklist[randomIndex];
  await playTrack(track);
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

const API_KEY = "AIzaSyB8iu1ZZ58qnpufkEV0j3hMcgsX91xOgzs";
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

async function searchYouTube(query) {
  const apiUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=1&q=${encodeURIComponent(query)}&key=${API_KEY}`;
  const response = await fetch(apiUrl);
  const data = await response.json();
  if (data.items && data.items.length > 0) {
    return data.items[0].id.videoId;
  } else {
    return null;
  }
}

async function playTrack(track) {
  const query = `${track.Artist} ${track.Title}`;
  const videoId = await searchYouTube(query);
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
  } else {
    document.getElementById('player').innerHTML = "No video found!";
  }
}

async function nextSong() {
  const randomIndex = Math.floor(Math.random() * tracklist.length);
  const track = tracklist[randomIndex];
  await playTrack(track);
}

async function shuffleSong() {
  await nextSong();
}

function onPlayerStateChange(event) {
  if (event.data === YT.PlayerState.ENDED) {
    nextSong();
  }
}

window.nextSong = nextSong;
window.shuffleSong = shuffleSong;

loadTracks();

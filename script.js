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

function playTrack(track) {
  const videoUrl = track.YouTubeLink;

  if (videoUrl && videoUrl !== "Not Found") {
    const urlParams = new URLSearchParams(new URL(videoUrl).search);
    const videoId = urlParams.get('v');

    if (videoId) {
      if (player) {
        player.loadVideoById(videoId);
      } else {
        player = new YT.Player('player', {
          height: '315',
          width: '560',
          videoId: videoId,
          events: {
            'onStateChange': onPlayerStateChange,
            'onError': onPlayerError
          }
        });
      }

      document.getElementById('now-playing').innerText = `Now Playing: ${track.Artist} - ${track.Title}`;
    } else {
      console.error("❌ Invalid YouTube URL format");
      nextSong();
    }
  } else {
    console.error("❌ No valid YouTube link for this track");
    nextSong();
  }
}

function nextSong() {
  if (tracklist.length === 0) return;

  const randomIndex = Math.floor(Math.random() * tracklist.length);
  const track = tracklist[randomIndex];
  playTrack(track);
}

function shuffleSong() {
  nextSong();
}

function onPlayerStateChange(event) {
  if (event.data === YT.PlayerState.ENDED) {
    nextSong();
  }
}

function onPlayerError(event) {
  console.error("❌ Player encountered an error, skipping to next song...");
  nextSong();
}

window.nextSong = nextSong;
window.shuffleSong = shuffleSong;

loadTracks();

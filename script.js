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
    let videoId = null;
    try {
      const url = new URL(videoUrl);
      if (url.hostname.includes("youtu.be")) {
        videoId = url.pathname.slice(1);
      } else if (url.hostname.includes("youtube.com")) {
        const params = new URLSearchParams(url.search);
        videoId = params.get('v');
      }
    } catch (e) {
      console.error("❌ Invalid YouTube URL:", videoUrl);
    }

    if (videoId) {
      if (player) {
        player.loadVideoById(videoId);
      } else {
        player = new YT.Player('player', {
          height: '0', // Start hidden
          width: '0',
          videoId: videoId,
          events: {
            'onStateChange': onPlayerStateChange,
            'onError': onPlayerError
          }
        });
      }

      const nowPlaying = document.getElementById('now-playing');
      nowPlaying.innerText = `${track.Artist} - ${track.Title}`;

      requestAnimationFrame(() => {
        if (nowPlaying.scrollWidth > nowPlaying.parentElement.clientWidth) {
          nowPlaying.classList.add('scrolling');
        } else {
          nowPlaying.classList.remove('scrolling');
        }
      });
    } else {
      console.error("❌ Could not extract video ID");
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

function prevSong() {
  shuffleSong();
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

function toggleVideo() {
  const playerElement = document.getElementById('player');
  if (playerElement.style.display === 'none') {
    playerElement.style.display = 'block';
    playerElement.style.width = '512px';
    playerElement.style.height = '288px';
  } else {
    playerElement.style.display = 'none';
  }
}

window.nextSong = nextSong;
window.shuffleSong = shuffleSong;
window.toggleVideo = toggleVideo;

loadTracks();

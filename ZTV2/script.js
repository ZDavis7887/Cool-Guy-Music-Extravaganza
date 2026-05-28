// Master queues for your assets
let featureQueue = [];
let trackQueue = [];
let continuousPlaylist = [];
let currentTrackIndex = 0;

// 1. The Shuffle Engine (Fisher-Yates)
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

// 2. Load both data sources simultaneously
Promise.all([
    fetch('features.json').then(res => res.json()),
    fetch('tracks.json').then(res => res.json()) // Adjust filename if your playlist is named differently
])
.then(([features, tracks]) => {
    // Shuffle both decks perfectly right out of the gate
    featureQueue = shuffleArray(features);
    trackQueue = shuffleArray(tracks);
    
    buildContinuousBroadcast();
})
.catch(err => console.error("Error loading broadcast assets:", err));

// 3. Assemble the structured infinite timeline
function buildContinuousBroadcast() {
    let fIndex = 0;
    let tIndex = 0;
    
    // Determine the absolute beginning on a 50/50 coin flip
    const startWithFeature = Math.random() < 0.5;
    
    // Build out a massive playlist buffer (e.g., 500 items deep) to loop through
    for (let block = 0; block < 60; block++) {
        
        // Block A: Handle the Feature slot
        if (block === 0 && !startWithFeature) {
            // If the coin flip said start with songs, skip this initial feature slot
        } else {
            // Pull a feature. If we hit the end of the shuffled list, wrap around
            continuousPlaylist.push({
                ...featureQueue[fIndex % featureQueue.length],
                broadcastType: 'feature'
            });
            fIndex++;
        }
        
        // Block B: Handle the 7-Track Music Slot
        for (let s = 0; s < 7; s++) {
            continuousPlaylist.push({
                ...trackQueue[tIndex % trackQueue.length],
                broadcastType: 'song'
            });
            tIndex++;
        }
    }
    
    console.log("Broadcast timeline assembled successfully:", continuousPlaylist);
    
    // Fire up your video/audio player using the first item in the continuousPlaylist
    startPlayback(continuousPlaylist[currentTrackIndex]);
}

// 4. Handle Track Transitions
function onTrackEnded() {
    currentTrackIndex++;
    
    // Safety check: if they somehow listen to all 500 pre-built tracks, rebuild the deck
    if (currentTrackIndex >= continuousPlaylist.length) {
        currentTrackIndex = 0;
        buildContinuousBroadcast(); 
        return;
    }
    
    const nextTrack = continuousPlaylist[currentTrackIndex];
    console.log(`Transitioning to next block item. Type: ${nextTrack.broadcastType}`);
    
    // Your player logic to update the YouTube iframe/audio source and play
    playTrack(nextTrack); 
}
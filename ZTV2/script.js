// Ensure these master queues are globally scoped at the absolute top of script.js
let featureQueue = [];
let trackQueue = [];
let continuousPlaylist = [];
let currentTrackIndex = 0;

function shuffleArray(array) {
    if (!Array.isArray(array)) return [];
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

// Ensure the filenames match your repository case-sensitivity exactly
Promise.all([
    fetch('features.json').then(res => {
        if (!res.ok) throw new Error("Failed to load features.json");
        return res.json();
    }),
    fetch('upgraded_tracks.json').then(res => {
        if (!res.ok) throw new Error("Failed to load tracks.json");
        return res.json();
    })
])
.then(([features, tracks]) => {
    // Diagnostic logging to catch empty or malformed structures before processing
    console.log("[Data Diagnostic] Features Loaded:", Array.isArray(features) ? features.length : "NOT AN ARRAY");
    console.log("[Data Diagnostic] Tracks Loaded:", Array.isArray(tracks) ? tracks.length : "NOT AN ARRAY");

    // Guard rails to prevent passing undefined sets down the pipeline
    featureQueue = shuffleArray(Array.isArray(features) ? features : []);
    trackQueue = shuffleArray(Array.isArray(tracks) ? tracks : []);
    
    if (featureQueue.length === 0 && trackQueue.length === 0) {
        throw new Error("Both content data sources resolved as empty arrays.");
    }
    
    buildContinuousBroadcast();
})
.catch(err => {
    console.error("Master Application Initialization Failed:", err);
});

function buildContinuousBroadcast() {
    // Reset the playlist target in case of hot-reloads
    continuousPlaylist = [];
    currentTrackIndex = 0;

    let fIndex = 0;
    let tIndex = 0;
    
    // Safety Fallbacks: If one list is completely empty, adjust behavior dynamically
    const hasFeatures = featureQueue.length > 0;
    const hasTracks = trackQueue.length > 0;
    
    const startWithFeature = hasFeatures && (Math.random() < 0.5);
    
    console.log(`[Timeline Engine] Assembling grid. Features baseline: ${hasFeatures}, Tracks baseline: ${hasTracks}`);

    // Build out a massive playlist buffer block safely
    for (let block = 0; block < 60; block++) {
        
        // Handle Feature Slot
        if (hasFeatures) {
            if (block === 0 && !startWithFeature) {
                // Skip initial feature if random coin-flip said start with music tracks
            } else {
                continuousPlaylist.push({
                    ...featureQueue[fIndex % featureQueue.length],
                    broadcastType: 'feature'
                });
                fIndex++;
            }
        }
        
        // Handle the 7-Track Music Block Slot
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
    
    console.log("[✓ Timeline Ready] Continuous broadcast list compiled:", continuousPlaylist.length, "items.");
    
    // Safety check before firing up your iframe tracking logic
    if (continuousPlaylist.length > 0 && typeof startPlayback === 'function') {
        startPlayback(continuousPlaylist[currentTrackIndex]);
    } else {
        console.warn("Timeline built, but startPlayback function is missing or array is empty.");
    }
}
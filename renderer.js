

const island = document.getElementById('island');
const COMPACT_WIDTH = 160, COMPACT_HEIGHT = 75; 
// Container is 480x200, so Window must be 520x240 to account for 20px padding on all sides
const EXPANDED_WIDTH = 520, EXPANDED_HEIGHT = 240;

let isExpanded = false;
let expansionTimeout;
let hoverDebounce;

function expandIsland() {
  clearTimeout(hoverDebounce);
  hoverDebounce = setTimeout(() => {
    clearTimeout(expansionTimeout);
    if (!isExpanded) {
      isExpanded = true;
      window.electronAPI.resizeWindow(EXPANDED_WIDTH, EXPANDED_HEIGHT);
      island.classList.add('expanded');
      window.electronAPI.getVolume();
      window.electronAPI.resumeBackground(); // Wake up the heavy native API monitor
    }
  }, 60);
}

function collapseIsland() {
  clearTimeout(hoverDebounce);
  hoverDebounce = setTimeout(() => {
    expansionTimeout = setTimeout(() => {
      if (isExpanded) {
        isExpanded = false;
        island.classList.remove('expanded');
        window.electronAPI.suspendBackground(); // Kill the heavy native API monitor instantly!
        setTimeout(() => { if (!isExpanded) window.electronAPI.resizeWindow(COMPACT_WIDTH, COMPACT_HEIGHT); }, 200);
      }
    }, 100);
  }, 60);
}

island.addEventListener('mouseenter', expandIsland);
island.addEventListener('mouseleave', collapseIsland);

// Allow drag to trigger expansion
document.addEventListener('dragenter', expandIsland);

window.electronAPI.onToggleExpansion(() => {
  if (isExpanded) collapseIsland();
  else expandIsland();
});

// 3) Global Nook vs Clips Switching
const topTabs = document.querySelectorAll('.top-tabs .tab');
const panes = {
  nookPane: document.getElementById('nookPane'),
  clipsPane: document.getElementById('clipsPane')
};

topTabs.forEach(tab => {
  tab.addEventListener('click', (e) => {
    e.stopPropagation();
    topTabs.forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    
    Object.keys(panes).forEach(k => panes[k].style.display = 'none');
    panes[tab.dataset.target].style.display = 'flex';
  });
});
const trackTitle = document.getElementById('trackTitle');
const trackArtist = document.getElementById('trackArtist');
const albumArt = document.getElementById('albumArt');
const playBtn = document.querySelector('.play-btn');
const visualizer = document.getElementById('visualizer');

let ignoreMediaUpdates = false;
let mediaUpdateTimeout;

function triggerOptimisticUI() {
  ignoreMediaUpdates = true;
  clearTimeout(mediaUpdateTimeout);
  mediaUpdateTimeout = setTimeout(() => { ignoreMediaUpdates = false; }, 2000);
}

window.electronAPI.onMediaUpdate((media) => {
  if (media) {
    trackTitle.textContent = media.title || 'Unknown Title';
    trackArtist.textContent = media.artist || 'Unknown Artist';
    if (media.thumbnail) albumArt.style.backgroundImage = `url(data:image/jpeg;base64,${media.thumbnail})`;
    else albumArt.style.backgroundImage = `linear-gradient(135deg, #1db954, #191414)`;
    
    if (!ignoreMediaUpdates) {
      if (media.status === 4) { playBtn.textContent = '\u23F8\uFE0E'; visualizer.classList.add('playing'); }
      else { playBtn.textContent = '\u23F5\uFE0E'; visualizer.classList.remove('playing'); }
    }
  } else {
    trackTitle.textContent = 'Not playing';
    trackArtist.textContent = '...';
    albumArt.style.backgroundImage = `linear-gradient(135deg, #333, #111)`;
    playBtn.textContent = '\u23F5\uFE0E';
    visualizer.classList.remove('playing');
  }
});

const btns = document.querySelectorAll('.media-controls .btn');
if (btns.length === 3) {
  btns[0].addEventListener('click', () => window.electronAPI.mediaControl('prev'));
  btns[1].addEventListener('click', () => {
    window.electronAPI.mediaControl('playpause');
    triggerOptimisticUI();
    // Optimistic UI Update for instant feedback
    if (playBtn.textContent === '\u23F8\uFE0E') {
      playBtn.textContent = '\u23F5\uFE0E';
      visualizer.classList.remove('playing');
    } else {
      playBtn.textContent = '\u23F8\uFE0E';
      visualizer.classList.add('playing');
    }
  });
  btns[2].addEventListener('click', () => window.electronAPI.mediaControl('next'));
}

// VOLUME
const volSlider = document.getElementById('volSlider');
volSlider.addEventListener('input', (e) => { window.electronAPI.setVolume(e.target.value); });
window.electronAPI.onCurrentVolume((vol) => { volSlider.value = vol; });

// CALENDAR (Static)
const daysList = document.getElementById('daysList');
const monthTitle = document.getElementById('monthTitle');

const today = new Date();
const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
monthTitle.textContent = months[today.getMonth()];

for (let i = 0; i < 4; i++) {
  const d = new Date(today);
  d.setDate(today.getDate() + i);
  
  const dayItem = document.createElement('div');
  dayItem.className = 'day-item';
  const label = document.createElement('div');
  label.className = i === 0 ? 'day-label active' : 'day-label';
  label.textContent = days[d.getDay()];
  const num = document.createElement('div');
  num.className = i === 0 ? 'day-num active' : 'day-num';
  num.textContent = String(d.getDate()).padStart(2, '0');
  
  dayItem.appendChild(label);
  dayItem.appendChild(num);
  daysList.appendChild(dayItem);
}

// BATTERY & WEATHER
const battText = document.getElementById('battText');
if (navigator.getBattery) {
  navigator.getBattery().then(b => {
    const updateB = () => battText.textContent = Math.round(b.level * 100) + '%';
    b.addEventListener('levelchange', updateB);
    updateB();
  });
}
fetch('https://api.open-meteo.com/v1/forecast?latitude=40.71&longitude=-74.00&current_weather=true')
  .then(r => r.json()).then(d => { document.getElementById('weatherText').textContent = Math.round(d.current_weather.temperature) + '°'; }).catch(() => {});

// QUICK APPS
document.querySelectorAll('.app-btn').forEach(btn => {
  btn.addEventListener('click', (e) => { e.stopPropagation(); window.electronAPI.launchApp(btn.dataset.app); });
});

// CLIPBOARD HISTORY
let clipboardHistory = [];
const clipsList = document.getElementById('clipsList');

setInterval(() => {
  const text = window.electronAPI.readClipboard();
  if (text && text.trim() !== '') {
    if (clipboardHistory[0] !== text) {
      clipboardHistory.unshift(text);
      if (clipboardHistory.length > 5) clipboardHistory.pop();
      renderClips();
    }
  }
}, 5000);

function renderClips() {
  clipsList.innerHTML = '';
  clipboardHistory.forEach(clip => {
    const el = document.createElement('div');
    el.className = 'clip-item';
    el.textContent = clip.length > 60 ? clip.substring(0, 60) + '...' : clip;
    el.title = clip;
    el.addEventListener('click', () => {
      window.electronAPI.writeClipboard(clip);
      el.style.background = 'rgba(77, 166, 255, 0.4)';
      setTimeout(() => el.style.background = '', 200);
    });
    clipsList.appendChild(el);
  });
}

// AUTO UPDATER UI
const updateBanner = document.getElementById('updateBanner');
const updateText = document.getElementById('updateText');
const updateBtn = document.getElementById('updateBtn');

window.electronAPI.onUpdateAvailable((version) => {
  updateText.textContent = `Update v${version} Available!`;
  updateBanner.style.display = 'flex';
});

window.electronAPI.onUpdateProgress((progress) => {
  if (progress === 'DEV_MOCK_SUCCESS') {
    updateBtn.textContent = 'Restarting App...';
  } else {
    updateBtn.textContent = `Downloading ${progress}%`;
    updateBtn.disabled = true;
  }
});

updateBtn.addEventListener('click', () => {
  window.electronAPI.startUpdate();
  updateBtn.textContent = 'Starting...';
  updateBtn.disabled = true;
});

// --- BATTERY HARDWARE INTERRUPT (0.00% CPU) ---
if ('getBattery' in navigator) {
  navigator.getBattery().then(battery => {
    let lastBatteryLevel = -1;
    let lastBatteryCharging = null;
    
    function updateBatteryUI() {
      // 1. DOM Thrashing Prevention (Only touch the DOM if the literal percentage or charging state actually changes)
      const levelInt = Math.round(battery.level * 100);
      if (levelInt === lastBatteryLevel && battery.charging === lastBatteryCharging) return;
      lastBatteryLevel = levelInt;
      lastBatteryCharging = battery.charging;

      const island = document.getElementById('island');
      island.classList.remove('charging-glow', 'low-battery-glow');
      
      if (battery.charging) {
        // Flash bright green for 3 seconds when plugged into power!
        island.classList.add('charging-glow');
        setTimeout(() => {
          island.classList.remove('charging-glow');
        }, 3000);
      } else if (battery.level <= 0.20) {
        // Glow angry red if unplugged and battery is critically low (20%)
        island.classList.add('low-battery-glow');
      }
    }

    // Instead of looping, we just tell the system: "Wake me up if the cable is plugged in or the percentage drops"
    battery.addEventListener('chargingchange', updateBatteryUI);
    battery.addEventListener('levelchange', updateBatteryUI);
    
    // Check once on boot to see if they are already dying
    if (battery.level <= 0.20 && !battery.charging) {
      updateBatteryUI();
    }
  });
}

// --- WEATHER WIDGET (Zero API Keys) ---
let cachedGeo = null; // 2. Memory Network Caching

async function fetchWeather() {
  if (!navigator.onLine) return; // 3. Sleep Mode / Offline Suspension

  try {
    let lat, lon, city;

    if (!cachedGeo) {
      // Use a secure HTTPS IP Geolocation service
      const geoRes = await fetch('https://get.geojs.io/v1/ip/geo.json');
      const geoData = await geoRes.json();
      cachedGeo = { lat: geoData.latitude, lon: geoData.longitude, city: geoData.city };
    }
    
    lat = cachedGeo.lat;
    lon = cachedGeo.lon;
    city = cachedGeo.city;
    
    // Fetch Free Live Weather Data using the precise coordinates
    const weatherRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`);
    const weatherData = await weatherRes.json();
    const cw = weatherData.current_weather;
    
    // Map numerical weather codes to beautiful Material Icons and colors
    const code = cw.weathercode;
    let icon = 'cloud';
    let desc = 'Unknown';
    let color = '#fff';

    if (code === 0) { icon = 'sunny'; desc = 'Clear Sky'; color = '#FFD700'; } // Yellow
    else if (code >= 1 && code <= 3) { icon = 'partly_cloudy_day'; desc = 'Cloudy'; color = '#A0C4FF'; } // Light Blue
    else if (code >= 45 && code <= 48) { icon = 'foggy'; desc = 'Fog'; color = '#B0BEC5'; } // Gray
    else if (code >= 51 && code <= 67) { icon = 'rainy'; desc = 'Rain'; color = '#64B5F6'; } // Blue
    else if (code >= 71 && code <= 77) { icon = 'weather_snowy'; desc = 'Snow'; color = '#E0F7FA'; } // Ice White
    else if (code >= 80 && code <= 82) { icon = 'rainy'; desc = 'Showers'; color = '#42A5F5'; }
    else if (code >= 95) { icon = 'thunderstorm'; desc = 'Storm'; color = '#FF5252'; } // Red

    // Update the Expanded View Widget
    document.getElementById('weatherIcon').textContent = icon;
    document.getElementById('weatherIcon').style.color = color;
    document.getElementById('weatherText').textContent = Math.round(cw.temperature) + '°';

  } catch (error) {}
}

// Fetch on boot, then every 30 minutes
fetchWeather();
setInterval(fetchWeather, 30 * 60 * 1000);

const { ipcRenderer, clipboard } = require('electron');

const island = document.getElementById('island');
const COMPACT_WIDTH = 160, COMPACT_HEIGHT = 75; 
// Container is 480x200, so Window must be 520x240 to account for 20px padding on all sides
const EXPANDED_WIDTH = 520, EXPANDED_HEIGHT = 240;

let isExpanded = false;
let expansionTimeout;

function expandIsland() {
  clearTimeout(expansionTimeout);
  if (!isExpanded) {
    isExpanded = true;
    ipcRenderer.send('resize-window', EXPANDED_WIDTH, EXPANDED_HEIGHT);
    island.classList.add('expanded');
  }
}

function collapseIsland() {
  expansionTimeout = setTimeout(() => {
    if (isExpanded) {
      isExpanded = false;
      island.classList.remove('expanded');
      setTimeout(() => { if (!isExpanded) ipcRenderer.send('resize-window', COMPACT_WIDTH, COMPACT_HEIGHT); }, 200);
    }
  }, 100);
}

island.addEventListener('mouseenter', expandIsland);
island.addEventListener('mouseleave', collapseIsland);

// Allow drag to trigger expansion
document.addEventListener('dragenter', expandIsland);

ipcRenderer.on('toggle-expansion', () => {
  if (isExpanded) collapseIsland();
  else expandIsland();
});

// TABS
const tabs = document.querySelectorAll('.tab');
const panes = {
  nookPane: document.getElementById('nookPane'),
  clipsPane: document.getElementById('clipsPane')
};

tabs.forEach(tab => {
  tab.addEventListener('click', (e) => {
    e.stopPropagation();
    tabs.forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    
    Object.keys(panes).forEach(k => {
      panes[k].style.display = 'none';
    });
    panes[tab.dataset.target].style.display = 'flex';
  });
});

// MEDIA
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

ipcRenderer.on('media-update', (event, media) => {
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
  btns[0].addEventListener('click', () => ipcRenderer.send('media-control', 'prev'));
  btns[1].addEventListener('click', () => {
    ipcRenderer.send('media-control', 'playpause');
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
  btns[2].addEventListener('click', () => ipcRenderer.send('media-control', 'next'));
}

// VOLUME
const volSlider = document.getElementById('volSlider');
volSlider.addEventListener('input', (e) => { ipcRenderer.send('set-volume', e.target.value); });
ipcRenderer.on('current-volume', (e, vol) => { volSlider.value = vol; });

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
  btn.addEventListener('click', (e) => { e.stopPropagation(); ipcRenderer.send('launch-app', btn.dataset.app); });
});

// CLIPBOARD HISTORY
let clipboardHistory = [];
const clipsList = document.getElementById('clipsList');

setInterval(() => {
  const text = clipboard.readText();
  if (text && text.trim() !== '') {
    if (clipboardHistory[0] !== text) {
      clipboardHistory.unshift(text);
      if (clipboardHistory.length > 5) clipboardHistory.pop();
      renderClips();
    }
  }
}, 1000);

function renderClips() {
  clipsList.innerHTML = '';
  clipboardHistory.forEach(clip => {
    const el = document.createElement('div');
    el.className = 'clip-item';
    el.textContent = clip.length > 60 ? clip.substring(0, 60) + '...' : clip;
    el.title = clip;
    el.addEventListener('click', () => {
      clipboard.writeText(clip);
      el.style.background = 'rgba(77, 166, 255, 0.4)';
      setTimeout(() => el.style.background = '', 200);
    });
    clipsList.appendChild(el);
  });
}

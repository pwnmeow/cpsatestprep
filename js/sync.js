// Simple username-based cloud sync via Firestore
const FireSync = (() => {
  let db = null;
  let username = null;
  let initialized = false;
  let syncTimeout = null;

  function init() {
    if (!window.FIREBASE_CONFIG || !window.FIREBASE_CONFIG.apiKey) {
      console.log('Firebase not configured');
      return;
    }
    try {
      firebase.initializeApp(window.FIREBASE_CONFIG);
      db = firebase.firestore();
      initialized = true;
      // Restore saved username
      username = localStorage.getItem('cpsa_username') || null;
      if (username) {
        pullFromCloud();
      }
      renderSyncUI();
    } catch (e) {
      console.error('Firebase init failed:', e);
    }
  }

  function isActive() {
    return initialized && username !== null;
  }

  function getUsername() {
    return username;
  }

  function login(name) {
    name = name.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
    if (!name || name.length < 2) {
      alert('Username must be at least 2 characters (letters, numbers, - and _ only)');
      return;
    }
    username = name;
    localStorage.setItem('cpsa_username', username);
    pullFromCloud();
    renderSyncUI();
  }

  function logout() {
    username = null;
    localStorage.removeItem('cpsa_username');
    renderSyncUI();
  }

  // Debounced push - waits 2s after last change before syncing
  function debouncedPush() {
    if (!isActive()) return;
    clearTimeout(syncTimeout);
    syncTimeout = setTimeout(() => pushToCloud(), 2000);
  }

  async function pushToCloud() {
    if (!isActive()) return;
    try {
      const data = {
        progress: JSON.parse(localStorage.getItem('cpsa_progress') || '{}'),
        stats: JSON.parse(localStorage.getItem('cpsa_stats') || '{"correct":0,"wrong":0,"sessions":0}'),
        wrongIds: JSON.parse(localStorage.getItem('cpsa_wrong_ids') || '[]'),
        portBest: parseInt(localStorage.getItem('cpsa_port_best') || '0'),
        lastSync: new Date().toISOString()
      };
      await db.collection('users').doc(username).set(data);
      showToast('Synced!');
    } catch (e) {
      console.error('Sync push failed:', e);
      showToast('Sync failed!');
    }
  }

  async function pullFromCloud() {
    if (!isActive()) return;
    try {
      const doc = await db.collection('users').doc(username).get();
      if (!doc.exists) {
        // First time with this username - push current local data
        await pushToCloud();
        showToast('Profile created: ' + username);
        return;
      }
      const cloud = doc.data();
      mergeProgress(cloud);
      showToast('Progress loaded!');
      // Re-render menu if we're on it
      if (typeof state !== 'undefined' && state.mode === 'menu' && typeof renderMenu === 'function') {
        renderMenu();
      }
    } catch (e) {
      console.error('Sync pull failed:', e);
      showToast('Load failed!');
    }
  }

  function mergeProgress(cloud) {
    const localProgress = JSON.parse(localStorage.getItem('cpsa_progress') || '{}');
    const cloudProgress = cloud.progress || {};
    const merged = {};

    // Merge all keys from both
    const allKeys = new Set([...Object.keys(localProgress), ...Object.keys(cloudProgress)]);
    for (const key of allKeys) {
      if (key.endsWith('_attempts')) {
        merged[key] = Math.max(localProgress[key] || 0, cloudProgress[key] || 0);
      } else {
        // Completion: true wins
        merged[key] = (localProgress[key] === true || cloudProgress[key] === true) ? true : (localProgress[key] || cloudProgress[key]);
      }
    }
    localStorage.setItem('cpsa_progress', JSON.stringify(merged));

    // Stats: take higher
    const ls = JSON.parse(localStorage.getItem('cpsa_stats') || '{"correct":0,"wrong":0,"sessions":0}');
    const cs = cloud.stats || { correct: 0, wrong: 0, sessions: 0 };
    localStorage.setItem('cpsa_stats', JSON.stringify({
      correct: Math.max(ls.correct, cs.correct),
      wrong: Math.max(ls.wrong, cs.wrong),
      sessions: Math.max(ls.sessions, cs.sessions)
    }));

    // Wrong IDs: union
    const lw = JSON.parse(localStorage.getItem('cpsa_wrong_ids') || '[]');
    const cw = cloud.wrongIds || [];
    localStorage.setItem('cpsa_wrong_ids', JSON.stringify([...new Set([...lw, ...cw])]));

    // Port best: higher wins
    const lb = parseInt(localStorage.getItem('cpsa_port_best') || '0');
    localStorage.setItem('cpsa_port_best', Math.max(lb, cloud.portBest || 0).toString());

    // Update in-memory state
    if (typeof state !== 'undefined') {
      state.progress = JSON.parse(localStorage.getItem('cpsa_progress'));
      state.stats = JSON.parse(localStorage.getItem('cpsa_stats'));
      state.portDrillBest = parseInt(localStorage.getItem('cpsa_port_best') || '0');
    }
  }

  function showToast(msg) {
    let t = document.getElementById('sync-toast');
    if (!t) {
      t = document.createElement('div');
      t.id = 'sync-toast';
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.className = 'sync-toast show';
    setTimeout(() => { t.className = 'sync-toast'; }, 2000);
  }

  function renderSyncUI() {
    let bar = document.getElementById('sync-bar');
    if (!bar) {
      bar = document.createElement('div');
      bar.id = 'sync-bar';
      document.body.prepend(bar);
    }

    if (!initialized) {
      bar.innerHTML = '<div class="sync-offline">Offline mode</div>';
      return;
    }

    if (username) {
      bar.innerHTML = `
        <div class="sync-row">
          <span class="sync-user">${username}</span>
          <button onclick="FireSync.pushToCloud()" class="sync-btn sync-btn-push">Sync Now</button>
          <button onclick="FireSync.pullFromCloud()" class="sync-btn sync-btn-pull">Load</button>
          <button onclick="FireSync.logout();location.reload()" class="sync-btn sync-btn-out">Change User</button>
        </div>`;
    } else {
      bar.innerHTML = `
        <div class="sync-row">
          <input type="text" id="sync-input" placeholder="Enter a username to sync" maxlength="20"
            onkeydown="if(event.key==='Enter'){document.getElementById('sync-go').click()}">
          <button id="sync-go" onclick="FireSync.login(document.getElementById('sync-input').value)" class="sync-btn sync-btn-in">Sync</button>
        </div>
        <div class="sync-hint">Same username on any device = same progress</div>`;
    }
  }

  return { init, login, logout, pushToCloud, pullFromCloud, debouncedPush, isActive, getUsername };
})();

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
      username = localStorage.getItem('cpsa_username') || null;
      renderSyncUI();
      // If already logged in, pull on page load
      if (username) {
        syncBothWays();
      }
    } catch (e) {
      console.error('Firebase init failed:', e);
    }
  }

  function isActive() {
    return initialized && username !== null;
  }

  async function login(name) {
    name = name.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
    if (!name || name.length < 2) {
      alert('Username must be at least 2 characters (letters, numbers, - and _ only)');
      return;
    }
    username = name;
    localStorage.setItem('cpsa_username', username);
    renderSyncUI();
    await syncBothWays();
  }

  function logout() {
    username = null;
    localStorage.removeItem('cpsa_username');
    renderSyncUI();
  }

  // The key function: pull cloud data, merge with local, push merged result back
  async function syncBothWays() {
    if (!isActive()) return;
    showToast('Syncing...');
    try {
      const doc = await db.collection('users').doc(username).get();

      if (doc.exists) {
        // Merge cloud into local (keeps the "best" of both)
        mergeProgress(doc.data());
      }

      // Now push the merged (or purely local) data back to cloud
      const data = {
        progress: JSON.parse(localStorage.getItem('cpsa_progress') || '{}'),
        stats: JSON.parse(localStorage.getItem('cpsa_stats') || '{"correct":0,"wrong":0,"sessions":0}'),
        wrongIds: JSON.parse(localStorage.getItem('cpsa_wrong_ids') || '[]'),
        portBest: parseInt(localStorage.getItem('cpsa_port_best') || '0'),
        lastSync: new Date().toISOString()
      };
      await db.collection('users').doc(username).set(data);

      // Count completed batches for feedback
      const prog = data.progress;
      const done = Object.keys(prog).filter(k => !k.includes('_attempts') && prog[k] === true).length;

      showToast('Synced! ' + done + ' batches completed');

      // Re-render
      if (typeof state !== 'undefined') {
        state.progress = JSON.parse(localStorage.getItem('cpsa_progress'));
        state.stats = JSON.parse(localStorage.getItem('cpsa_stats'));
        state.portDrillBest = parseInt(localStorage.getItem('cpsa_port_best') || '0');
        if (state.mode === 'menu' && typeof renderMenu === 'function') {
          renderMenu();
        }
      }
    } catch (e) {
      console.error('Sync failed:', e.code, e.message);
      showToast('Sync failed: ' + (e.code || e.message));
    }
  }

  // Debounced push for auto-save during quizzes
  function debouncedPush() {
    if (!isActive()) return;
    clearTimeout(syncTimeout);
    syncTimeout = setTimeout(() => pushQuiet(), 2000);
  }

  async function pushQuiet() {
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
    } catch (e) {
      console.error('Auto-sync failed:', e);
    }
  }

  function mergeProgress(cloud) {
    const localProgress = JSON.parse(localStorage.getItem('cpsa_progress') || '{}');
    const cloudProgress = cloud.progress || {};
    const merged = {};

    const allKeys = new Set([...Object.keys(localProgress), ...Object.keys(cloudProgress)]);
    for (const key of allKeys) {
      if (key.endsWith('_attempts')) {
        merged[key] = Math.max(localProgress[key] || 0, cloudProgress[key] || 0);
      } else {
        if (localProgress[key] === true || cloudProgress[key] === true) {
          merged[key] = true;
        } else {
          merged[key] = localProgress[key] || cloudProgress[key];
        }
      }
    }
    localStorage.setItem('cpsa_progress', JSON.stringify(merged));

    const ls = JSON.parse(localStorage.getItem('cpsa_stats') || '{"correct":0,"wrong":0,"sessions":0}');
    const cs = cloud.stats || { correct: 0, wrong: 0, sessions: 0 };
    localStorage.setItem('cpsa_stats', JSON.stringify({
      correct: Math.max(ls.correct || 0, cs.correct || 0),
      wrong: Math.max(ls.wrong || 0, cs.wrong || 0),
      sessions: Math.max(ls.sessions || 0, cs.sessions || 0)
    }));

    const lw = JSON.parse(localStorage.getItem('cpsa_wrong_ids') || '[]');
    const cw = cloud.wrongIds || [];
    localStorage.setItem('cpsa_wrong_ids', JSON.stringify([...new Set([...lw, ...cw])]));

    const lb = parseInt(localStorage.getItem('cpsa_port_best') || '0');
    localStorage.setItem('cpsa_port_best', Math.max(lb, cloud.portBest || 0).toString());
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
    clearTimeout(t._timeout);
    t._timeout = setTimeout(() => { t.className = 'sync-toast'; }, 3000);
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
          <button onclick="FireSync.syncBothWays()" class="sync-btn sync-btn-push">Sync Now</button>
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

  return { init, login, logout, syncBothWays, debouncedPush, isActive };
})();

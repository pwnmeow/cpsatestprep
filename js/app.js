const BATCH_SIZE = 10;
const DOMAIN_NAMES = {
  A: "Soft Skills, Law & Management",
  B: "Core Technical (TCP/IP, Nmap, Crypto, Tools)",
  C: "OSINT & Recon",
  D: "Network Equipment & Attacks",
  E: "Microsoft Windows",
  F: "Unix / Linux",
  G: "Web Technologies",
  H: "Web Testing Methodologies",
  I: "Web Testing Techniques",
  J: "Databases"
};

let state = {
  mode: 'menu',
  currentBatch: 0,
  batchQuestions: [],
  currentQ: 0,
  score: 0,
  wrongOnes: [],
  answered: false,
  selectedOption: null,
  progress: JSON.parse(localStorage.getItem('cpsa_progress') || '{}'),
  portDrillScore: 0,
  portDrillTotal: 0,
  portDrillStreak: 0,
  portDrillBest: parseInt(localStorage.getItem('cpsa_port_best') || '0'),
  stats: JSON.parse(localStorage.getItem('cpsa_stats') || '{"correct":0,"wrong":0,"sessions":0}')
};

function getBatches() {
  const batches = [];
  for (let i = 0; i < ALL_QUESTIONS.length; i += BATCH_SIZE) {
    const chunk = ALL_QUESTIONS.slice(i, i + BATCH_SIZE);
    const domains = [...new Set(chunk.map(q => q.domain))];
    const domainLabel = domains.map(d => DOMAIN_NAMES[d] || d).join(' / ');
    batches.push({
      label: `Batch ${batches.length + 1}: ${domainLabel}`,
      questions: chunk,
      startQ: i + 1,
      endQ: Math.min(i + BATCH_SIZE, ALL_QUESTIONS.length)
    });
  }
  return batches;
}

const BATCHES = getBatches();

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function isBatchUnlocked(idx) {
  if (idx === 0) return true;
  return state.progress[`batch_${idx - 1}`] === true;
}

function isBatchCompleted(idx) {
  return state.progress[`batch_${idx}`] === true;
}

function saveProgress() {
  localStorage.setItem('cpsa_progress', JSON.stringify(state.progress));
  localStorage.setItem('cpsa_stats', JSON.stringify(state.stats));
  localStorage.setItem('cpsa_port_best', state.portDrillBest.toString());
  // Sync to cloud (debounced)
  if (typeof FireSync !== 'undefined' && FireSync.isActive()) {
    FireSync.debouncedPush();
  }
}

function getCompletedCount() {
  return BATCHES.filter((_, i) => isBatchCompleted(i)).length;
}

function renderMenu() {
  const completed = getCompletedCount();
  const pct = Math.round((completed / BATCHES.length) * 100);
  const app = document.getElementById('app');

  let html = `
    <div class="header">
      <h1>CPSA EXAM PREP</h1>
      <p class="subtitle">334 Questions | ${BATCHES.length} Batches | 5-Day Blitz</p>
      <div class="progress-bar-container">
        <div class="progress-bar" style="width:${pct}%"></div>
      </div>
      <p class="progress-text">${completed}/${BATCHES.length} batches mastered (${pct}%)</p>
      <div class="stats-row">
        <span>Correct: ${state.stats.correct}</span>
        <span>Wrong: ${state.stats.wrong}</span>
        <span>Sessions: ${state.stats.sessions}</span>
        ${state.stats.correct + state.stats.wrong > 0 ? `<span>Accuracy: ${Math.round(state.stats.correct / (state.stats.correct + state.stats.wrong) * 100)}%</span>` : ''}
      </div>
    </div>

    <div class="mode-buttons">
      <button onclick="startPortDrill()" class="btn btn-port">PORT DRILL (Most Tested!)</button>
      <button onclick="startRandomMix()" class="btn btn-mix">RANDOM MIX (All 334)</button>
      <button onclick="startWeakAreas()" class="btn btn-weak">WEAK AREAS</button>
    </div>

    <h2 class="section-title">STUDY BATCHES</h2>
    <p class="hint">Get 10/10 to unlock next batch. Master all to be exam ready.</p>
    <div class="batch-grid">`;

  BATCHES.forEach((b, i) => {
    const unlocked = isBatchUnlocked(i);
    const completed = isBatchCompleted(i);
    const cls = completed ? 'batch-card completed' : (unlocked ? 'batch-card unlocked' : 'batch-card locked');
    const icon = completed ? '&#10003;' : (unlocked ? '&#9654;' : '&#128274;');
    const attempts = state.progress[`batch_${i}_attempts`] || 0;
    html += `
      <div class="${cls}" ${unlocked ? `onclick="startBatch(${i})"` : ''}>
        <div class="batch-icon">${icon}</div>
        <div class="batch-info">
          <div class="batch-label">${b.label}</div>
          <div class="batch-range">Q${b.startQ}-Q${b.endQ}</div>
          ${attempts > 0 ? `<div class="batch-attempts">${attempts} attempt${attempts > 1 ? 's' : ''}</div>` : ''}
        </div>
      </div>`;
  });

  html += `</div>
    <div class="footer">
      <button onclick="resetProgress()" class="btn btn-reset">Reset All Progress</button>
    </div>`;

  app.innerHTML = html;
}

function startBatch(idx) {
  state.mode = 'quiz';
  state.currentBatch = idx;
  state.batchQuestions = shuffle(BATCHES[idx].questions).map(q => ({
    ...q,
    shuffledOptions: shuffle(q.options)
  }));
  state.currentQ = 0;
  state.score = 0;
  state.wrongOnes = [];
  state.answered = false;
  state.selectedOption = null;
  state.stats.sessions++;
  if (!state.progress[`batch_${idx}_attempts`]) state.progress[`batch_${idx}_attempts`] = 0;
  state.progress[`batch_${idx}_attempts`]++;
  saveProgress();
  renderQuiz();
}

function startPortDrill() {
  const portQuestions = ALL_QUESTIONS.filter(q =>
    q.topic === 'Ports' || q.topic === 'Databases' ||
    q.q.toLowerCase().includes('port') || q.q.toLowerCase().includes('default port')
  );
  // Add the port table as extra questions
  const portTable = [
    {q:"What port is Echo?",a:"7 TCP/UDP",options:["7","9","13","19"]},
    {q:"What port is FTP Data?",a:"20 TCP",options:["20","21","22","23"]},
    {q:"What port is FTP Control?",a:"21 TCP",options:["21","20","22","23"]},
    {q:"What port is SSH/SCP/SFTP?",a:"22 TCP",options:["22","23","21","25"]},
    {q:"What port is Telnet?",a:"23 TCP",options:["23","22","25","21"]},
    {q:"What port is SMTP?",a:"25 TCP",options:["25","22","110","587"]},
    {q:"What port is TACACS+?",a:"49 TCP",options:["49","389","636","88"]},
    {q:"What port is DNS?",a:"53 TCP/UDP",options:["53","67","69","80"]},
    {q:"What port is DHCP Server?",a:"67 UDP",options:["67","68","53","69"]},
    {q:"What port is DHCP Client?",a:"68 UDP",options:["68","67","53","69"]},
    {q:"What port is TFTP?",a:"69 UDP",options:["69","21","67","53"]},
    {q:"What port is Finger?",a:"79 TCP",options:["79","80","81","70"]},
    {q:"What port is HTTP?",a:"80 TCP",options:["80","443","8080","81"]},
    {q:"What port is Kerberos?",a:"88 TCP/UDP",options:["88","389","464","636"]},
    {q:"What port is POP3?",a:"110 TCP",options:["110","143","25","995"]},
    {q:"What port is RPCBind/Portmapper?",a:"111 TCP/UDP",options:["111","135","139","445"]},
    {q:"What port is Ident?",a:"113 TCP",options:["113","111","119","123"]},
    {q:"What port is NNTP?",a:"119 TCP",options:["119","123","113","143"]},
    {q:"What port is NTP?",a:"123 UDP",options:["123","119","161","162"]},
    {q:"What port is MS-RPC?",a:"135 TCP",options:["135","139","445","111"]},
    {q:"What port is NetBIOS Name?",a:"137 UDP",options:["137","138","139","135"]},
    {q:"What port is NetBIOS Datagram?",a:"138 UDP",options:["138","137","139","135"]},
    {q:"What port is NetBIOS Session (SMB)?",a:"139 TCP",options:["139","137","138","445"]},
    {q:"What port is IMAP?",a:"143 TCP",options:["143","110","993","25"]},
    {q:"What port is SNMP?",a:"161 UDP",options:["161","162","111","123"]},
    {q:"What port is SNMP Trap?",a:"162 UDP",options:["162","161","111","123"]},
    {q:"What port is BGP?",a:"179 TCP",options:["179","520","1985","389"]},
    {q:"What port is LDAP?",a:"389 TCP/UDP",options:["389","636","3268","88"]},
    {q:"What port is HTTPS?",a:"443 TCP",options:["443","80","8443","8080"]},
    {q:"What port is SMB (direct)?",a:"445 TCP",options:["445","139","137","135"]},
    {q:"What port is Kerberos Password Change?",a:"464 TCP/UDP",options:["464","88","389","636"]},
    {q:"What port is IKE/ISAKMP (IPsec)?",a:"500 UDP",options:["500","4500","1723","1194"]},
    {q:"What port is rexec?",a:"512 TCP",options:["512","513","514","515"]},
    {q:"What port is rlogin?",a:"513 TCP",options:["513","512","514","22"]},
    {q:"What port is rsh/Syslog?",a:"514 TCP/UDP",options:["514","512","513","515"]},
    {q:"What port is LPD (Print)?",a:"515 TCP",options:["515","514","631","9100"]},
    {q:"What port is RIP?",a:"520 UDP",options:["520","179","1985","123"]},
    {q:"What port is SMTP Submit (auth)?",a:"587 TCP",options:["587","25","465","110"]},
    {q:"What port is LDAPS?",a:"636 TCP",options:["636","389","3269","443"]},
    {q:"What port is Rsync?",a:"873 TCP",options:["873","22","21","445"]},
    {q:"What port is IMAPS?",a:"993 TCP",options:["993","143","995","110"]},
    {q:"What port is POP3S?",a:"995 TCP",options:["995","110","993","143"]},
    {q:"What port is SOCKS proxy?",a:"1080 TCP",options:["1080","3128","8080","8443"]},
    {q:"What port is Java RMI?",a:"1099 TCP",options:["1099","1433","1521","1723"]},
    {q:"What port is MSSQL?",a:"1433 TCP",options:["1433","3306","5432","1521"]},
    {q:"What port is MSSQL Browser?",a:"1434 UDP",options:["1434","1433","3306","1521"]},
    {q:"What port is Oracle TNS?",a:"1521 TCP",options:["1521","1433","3306","5432"]},
    {q:"What port is PPTP?",a:"1723 TCP",options:["1723","500","1194","443"]},
    {q:"What port is HSRP?",a:"1985 UDP",options:["1985","520","179","1723"]},
    {q:"What port is NFS?",a:"2049 TCP/UDP",options:["2049","111","873","445"]},
    {q:"What port is Squid Proxy?",a:"3128 TCP",options:["3128","8080","1080","8443"]},
    {q:"What port is AD Global Catalog LDAP?",a:"3268 TCP",options:["3268","3269","389","636"]},
    {q:"What port is AD Global Catalog LDAPS?",a:"3269 TCP",options:["3269","3268","636","389"]},
    {q:"What port is MySQL?",a:"3306 TCP",options:["3306","1433","5432","27017"]},
    {q:"What port is RDP?",a:"3389 TCP",options:["3389","5900","22","3306"]},
    {q:"What port is Metasploit default handler?",a:"4444 TCP",options:["4444","4443","8080","31337"]},
    {q:"What port is SIP (unencrypted)?",a:"5060 TCP/UDP",options:["5060","5061","5900","5432"]},
    {q:"What port is SIP TLS?",a:"5061 TCP",options:["5061","5060","5986","443"]},
    {q:"What port is PostgreSQL?",a:"5432 TCP",options:["5432","3306","1433","5060"]},
    {q:"What port is VNC?",a:"5900 TCP",options:["5900","3389","5060","6000"]},
    {q:"What port is WinRM HTTP?",a:"5985 TCP",options:["5985","5986","3389","445"]},
    {q:"What port is WinRM HTTPS?",a:"5986 TCP",options:["5986","5985","443","8443"]},
    {q:"What port is X11?",a:"6000 TCP",options:["6000","5900","6379","3389"]},
    {q:"What port is Redis?",a:"6379 TCP",options:["6379","27017","9200","6000"]},
    {q:"What port is HTTP Alt?",a:"8080 TCP",options:["8080","80","8443","3128"]},
    {q:"What port is HTTPS Alt?",a:"8443 TCP",options:["8443","443","8080","4443"]},
    {q:"What port is Elasticsearch?",a:"9200 TCP",options:["9200","27017","6379","5432"]},
    {q:"What port is MongoDB?",a:"27017 TCP",options:["27017","6379","9200","3306"]},
  ];

  const allPort = [...portQuestions, ...portTable.map((p, i) => ({
    id: 1000 + i, domain: "PORTS", topic: "Port Drill", ...p
  }))];

  state.mode = 'portdrill';
  state.batchQuestions = shuffle(allPort).map(q => ({
    ...q,
    shuffledOptions: shuffle(q.options)
  }));
  state.currentQ = 0;
  state.portDrillScore = 0;
  state.portDrillTotal = 0;
  state.portDrillStreak = 0;
  state.answered = false;
  renderPortDrill();
}

function startRandomMix() {
  state.mode = 'quiz';
  state.currentBatch = -1;
  state.batchQuestions = shuffle(ALL_QUESTIONS).slice(0, BATCH_SIZE).map(q => ({
    ...q,
    shuffledOptions: shuffle(q.options)
  }));
  state.currentQ = 0;
  state.score = 0;
  state.wrongOnes = [];
  state.answered = false;
  state.stats.sessions++;
  saveProgress();
  renderQuiz();
}

function startWeakAreas() {
  const wrongIds = JSON.parse(localStorage.getItem('cpsa_wrong_ids') || '[]');
  if (wrongIds.length === 0) {
    alert('No weak areas yet! Start studying to identify them.');
    return;
  }
  const weakQs = ALL_QUESTIONS.filter(q => wrongIds.includes(q.id));
  if (weakQs.length === 0) {
    alert('No weak areas found!');
    return;
  }
  state.mode = 'quiz';
  state.currentBatch = -2;
  state.batchQuestions = shuffle(weakQs).slice(0, BATCH_SIZE).map(q => ({
    ...q,
    shuffledOptions: shuffle(q.options)
  }));
  state.currentQ = 0;
  state.score = 0;
  state.wrongOnes = [];
  state.answered = false;
  state.stats.sessions++;
  saveProgress();
  renderQuiz();
}

function renderQuiz() {
  const q = state.batchQuestions[state.currentQ];
  const total = state.batchQuestions.length;
  const batchLabel = state.currentBatch >= 0 ? BATCHES[state.currentBatch].label : (state.currentBatch === -2 ? 'Weak Areas' : 'Random Mix');
  const app = document.getElementById('app');

  let html = `
    <div class="quiz-header">
      <button onclick="goMenu()" class="btn btn-back">&larr; Menu</button>
      <span class="quiz-title">${batchLabel}</span>
      <span class="quiz-score">${state.score}/${state.currentQ}${state.answered ? '' : ''}</span>
    </div>
    <div class="quiz-progress">
      <div class="quiz-progress-bar" style="width:${((state.currentQ) / total) * 100}%"></div>
    </div>
    <div class="quiz-card">
      <div class="q-meta">
        <span class="q-domain">${DOMAIN_NAMES[q.domain] || q.domain}</span>
        <span class="q-topic">${q.topic}</span>
        <span class="q-num">${state.currentQ + 1}/${total}</span>
      </div>
      <h2 class="q-text">${q.q}</h2>
      <div class="options">`;

  q.shuffledOptions.forEach((opt, i) => {
    let cls = 'option';
    if (state.answered) {
      if (opt === q.options[0]) cls += ' correct';
      else if (opt === state.selectedOption && opt !== q.options[0]) cls += ' wrong';
      else cls += ' dimmed';
    }
    html += `<button class="${cls}" ${state.answered ? 'disabled' : `onclick="selectOption(${i})"`}>${opt}</button>`;
  });

  html += `</div>`;

  if (state.answered) {
    const isCorrect = state.selectedOption === q.options[0];
    html += `
      <div class="feedback ${isCorrect ? 'feedback-correct' : 'feedback-wrong'}">
        <strong>${isCorrect ? 'CORRECT!' : 'WRONG!'}</strong>
        <p>${q.a}</p>
      </div>
      <button onclick="nextQuestion()" class="btn btn-next">${state.currentQ < total - 1 ? 'Next Question &rarr;' : 'See Results'}</button>`;
  }

  html += `</div>`;
  app.innerHTML = html;
}

function selectOption(idx) {
  if (state.answered) return;
  const q = state.batchQuestions[state.currentQ];
  state.selectedOption = q.shuffledOptions[idx];
  state.answered = true;

  const isCorrect = state.selectedOption === q.options[0];
  if (isCorrect) {
    state.score++;
    state.stats.correct++;
    removeFromWrong(q.id);
  } else {
    state.stats.wrong++;
    state.wrongOnes.push(q);
    addToWrong(q.id);
  }
  saveProgress();
  renderQuiz();
}

function addToWrong(id) {
  if (id >= 1000) return; // port drill extra
  const wrong = JSON.parse(localStorage.getItem('cpsa_wrong_ids') || '[]');
  if (!wrong.includes(id)) {
    wrong.push(id);
    localStorage.setItem('cpsa_wrong_ids', JSON.stringify(wrong));
  }
}

function removeFromWrong(id) {
  const wrong = JSON.parse(localStorage.getItem('cpsa_wrong_ids') || '[]');
  const idx = wrong.indexOf(id);
  if (idx > -1) {
    wrong.splice(idx, 1);
    localStorage.setItem('cpsa_wrong_ids', JSON.stringify(wrong));
  }
}

function nextQuestion() {
  if (state.mode === 'portdrill') {
    state.currentQ++;
    if (state.currentQ >= state.batchQuestions.length) {
      state.batchQuestions = shuffle(state.batchQuestions).map(q => ({
        ...q,
        shuffledOptions: shuffle(q.options)
      }));
      state.currentQ = 0;
    }
    state.answered = false;
    state.selectedOption = null;
    renderPortDrill();
    return;
  }

  state.currentQ++;
  state.answered = false;
  state.selectedOption = null;

  if (state.currentQ >= state.batchQuestions.length) {
    renderResults();
  } else {
    renderQuiz();
  }
}

function renderResults() {
  const total = state.batchQuestions.length;
  const perfect = state.score === total;
  const app = document.getElementById('app');

  if (perfect && state.currentBatch >= 0) {
    state.progress[`batch_${state.currentBatch}`] = true;
    saveProgress();
  }

  let html = `
    <div class="results-card">
      <div class="results-score ${perfect ? 'perfect' : 'retry'}">
        <h1>${state.score}/${total}</h1>
        <p>${perfect ? 'PERFECT! BATCH MASTERED!' : 'Keep going - you need 10/10!'}</p>
      </div>`;

  if (state.wrongOnes.length > 0) {
    html += `<div class="wrong-review"><h3>Review these:</h3>`;
    state.wrongOnes.forEach(q => {
      html += `
        <div class="wrong-item">
          <div class="wrong-q">${q.q}</div>
          <div class="wrong-a">${q.a}</div>
        </div>`;
    });
    html += `</div>`;
  }

  html += `
      <div class="results-buttons">
        ${!perfect && state.currentBatch >= 0 ? `<button onclick="startBatch(${state.currentBatch})" class="btn btn-retry">Retry This Batch</button>` : ''}
        ${perfect && state.currentBatch >= 0 && state.currentBatch < BATCHES.length - 1 ? `<button onclick="startBatch(${state.currentBatch + 1})" class="btn btn-next-batch">Next Batch &rarr;</button>` : ''}
        <button onclick="goMenu()" class="btn btn-menu">Back to Menu</button>
      </div>
    </div>`;

  app.innerHTML = html;
}

function renderPortDrill() {
  const q = state.batchQuestions[state.currentQ];
  const app = document.getElementById('app');

  let html = `
    <div class="quiz-header">
      <button onclick="goMenu()" class="btn btn-back">&larr; Menu</button>
      <span class="quiz-title">PORT DRILL</span>
      <span class="quiz-score">Streak: ${state.portDrillStreak} | Best: ${state.portDrillBest}</span>
    </div>
    <div class="port-stats">
      <span>Score: ${state.portDrillScore}/${state.portDrillTotal}</span>
      <span>${state.portDrillTotal > 0 ? Math.round(state.portDrillScore / state.portDrillTotal * 100) : 0}% accuracy</span>
    </div>
    <div class="quiz-card port-card">
      <h2 class="q-text">${q.q}</h2>
      <div class="options port-options">`;

  q.shuffledOptions.forEach((opt, i) => {
    let cls = 'option port-option';
    if (state.answered) {
      if (opt === q.options[0]) cls += ' correct';
      else if (opt === state.selectedOption && opt !== q.options[0]) cls += ' wrong';
      else cls += ' dimmed';
    }
    html += `<button class="${cls}" ${state.answered ? 'disabled' : `onclick="selectPortOption(${i})"`}>${opt}</button>`;
  });

  html += `</div>`;

  if (state.answered) {
    const isCorrect = state.selectedOption === q.options[0];
    html += `
      <div class="feedback ${isCorrect ? 'feedback-correct' : 'feedback-wrong'}">
        <strong>${isCorrect ? 'CORRECT!' : `WRONG! Answer: ${q.options[0]}`}</strong>
        ${q.a ? `<p>${q.a}</p>` : ''}
      </div>
      <button onclick="nextQuestion()" class="btn btn-next">Next &rarr;</button>`;
  }

  html += `</div>`;
  app.innerHTML = html;
}

function selectPortOption(idx) {
  if (state.answered) return;
  const q = state.batchQuestions[state.currentQ];
  state.selectedOption = q.shuffledOptions[idx];
  state.answered = true;
  state.portDrillTotal++;

  if (state.selectedOption === q.options[0]) {
    state.portDrillScore++;
    state.portDrillStreak++;
    state.stats.correct++;
    if (state.portDrillStreak > state.portDrillBest) {
      state.portDrillBest = state.portDrillStreak;
    }
  } else {
    state.portDrillStreak = 0;
    state.stats.wrong++;
  }
  saveProgress();
  renderPortDrill();
}

function goMenu() {
  state.mode = 'menu';
  renderMenu();
}

function resetProgress() {
  if (confirm('Reset ALL progress? This cannot be undone!')) {
    localStorage.removeItem('cpsa_progress');
    localStorage.removeItem('cpsa_stats');
    localStorage.removeItem('cpsa_port_best');
    localStorage.removeItem('cpsa_wrong_ids');
    state.progress = {};
    state.stats = { correct: 0, wrong: 0, sessions: 0 };
    state.portDrillBest = 0;
    renderMenu();
  }
}

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
  if (state.mode === 'quiz' || state.mode === 'portdrill') {
    if (!state.answered) {
      const num = parseInt(e.key);
      if (num >= 1 && num <= 4) {
        if (state.mode === 'portdrill') selectPortOption(num - 1);
        else selectOption(num - 1);
      }
    } else {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowRight') {
        e.preventDefault();
        nextQuestion();
      }
    }
  }
});

// Init
renderMenu();

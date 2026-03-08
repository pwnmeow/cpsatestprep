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
      <h1>CPSA PREP</h1>
      <p class="subtitle">334 Questions | ${BATCHES.length} Batches</p>
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

    <h2 class="section-title">REFERENCE TABLES</h2>
    <p class="hint">All cheat sheets from the exam bible.</p>
    <div class="ref-buttons ref-buttons-4">
      <button onclick="showPortReference()" class="btn btn-ref btn-ref-ports">PORTS</button>
      <button onclick="showCryptoReference()" class="btn btn-ref btn-ref-crypto">CRYPTO</button>
      <button onclick="showNetworkReference()" class="btn btn-ref btn-ref-net">NETWORKING</button>
      <button onclick="showIISReference()" class="btn btn-ref btn-ref-iis">IIS / EXAM</button>
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
      <p class="footer-credit"><a href="https://sheerazali.com" target="_blank">sheerazali.com</a></p>
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

function showPortReference() {
  state.mode = 'portref';
  // Exact match to PDF "MASTER PORT REFERENCE TABLE"
  // gotcha = true for orange-highlighted "frequently missed" ports
  const ports = [
    {port:"7",service:"Echo",proto:"TCP/UDP",notes:"Echoes data sent to it",gotcha:false},
    {port:"20",service:"FTP Data",proto:"TCP",notes:"FTP data transfer",gotcha:false},
    {port:"21",service:"FTP Control",proto:"TCP",notes:"FTP command channel",gotcha:false},
    {port:"22",service:"SSH/SCP/SFTP",proto:"TCP",notes:"Secure shell",gotcha:false},
    {port:"23",service:"Telnet",proto:"TCP",notes:"Unencrypted remote access",gotcha:false},
    {port:"25",service:"SMTP",proto:"TCP",notes:"Sending email",gotcha:false},
    {port:"49",service:"TACACS+",proto:"TCP",notes:"AAA protocol (Cisco)",gotcha:true},
    {port:"53",service:"DNS",proto:"TCP/UDP",notes:"Name resolution",gotcha:false},
    {port:"67",service:"DHCP Server",proto:"UDP",notes:"IP assignment (server)",gotcha:false},
    {port:"68",service:"DHCP Client",proto:"UDP",notes:"IP assignment (client)",gotcha:true},
    {port:"69",service:"TFTP",proto:"UDP",notes:"Trivial FTP (no auth)",gotcha:true},
    {port:"79",service:"Finger",proto:"TCP",notes:"User info (legacy)",gotcha:true},
    {port:"80",service:"HTTP",proto:"TCP",notes:"Web traffic",gotcha:false},
    {port:"88",service:"Kerberos",proto:"TCP/UDP",notes:"Authentication (AD)",gotcha:true},
    {port:"110",service:"POP3",proto:"TCP",notes:"Retrieve email",gotcha:false},
    {port:"111",service:"RPCBind",proto:"TCP/UDP",notes:"RPC port mapping",gotcha:true},
    {port:"113",service:"Ident",proto:"TCP",notes:"User identification",gotcha:true},
    {port:"119",service:"NNTP",proto:"TCP",notes:"Usenet news",gotcha:true},
    {port:"123",service:"NTP",proto:"UDP",notes:"Time sync",gotcha:false},
    {port:"135",service:"MS-RPC",proto:"TCP",notes:"RPC endpoint mapper",gotcha:false},
    {port:"137",service:"NetBIOS Name",proto:"UDP",notes:"Name service",gotcha:false},
    {port:"138",service:"NetBIOS DGM",proto:"UDP",notes:"Datagram service",gotcha:false},
    {port:"139",service:"NetBIOS SSN",proto:"TCP",notes:"Session (SMB/NetBIOS)",gotcha:false},
    {port:"143",service:"IMAP",proto:"TCP",notes:"Email access",gotcha:false},
    {port:"161",service:"SNMP",proto:"UDP",notes:"Network management",gotcha:false},
    {port:"162",service:"SNMP Trap",proto:"UDP",notes:"SNMP alerts",gotcha:true},
    {port:"179",service:"BGP",proto:"TCP",notes:"Internet routing",gotcha:true},
    {port:"389",service:"LDAP",proto:"TCP/UDP",notes:"Directory access",gotcha:false},
    {port:"443",service:"HTTPS",proto:"TCP",notes:"Encrypted web",gotcha:false},
    {port:"445",service:"SMB",proto:"TCP",notes:"File sharing (direct)",gotcha:false},
    {port:"464",service:"Kerberos PW",proto:"TCP/UDP",notes:"Password change",gotcha:true},
    {port:"500",service:"IKE/ISAKMP",proto:"UDP",notes:"IPSec key exchange",gotcha:true},
    {port:"512",service:"rexec",proto:"TCP",notes:"Remote exec (legacy)",gotcha:true},
    {port:"513",service:"rlogin",proto:"TCP",notes:"Remote login (legacy)",gotcha:true},
    {port:"514",service:"rsh/Syslog",proto:"TCP/UDP",notes:"Shell/logging",gotcha:true},
    {port:"515",service:"LPD",proto:"TCP",notes:"Print daemon",gotcha:true},
    {port:"520",service:"RIP",proto:"UDP",notes:"Routing protocol",gotcha:true},
    {port:"587",service:"SMTP Submit",proto:"TCP",notes:"Auth email submission",gotcha:false},
    {port:"636",service:"LDAPS",proto:"TCP",notes:"Encrypted LDAP",gotcha:false},
    {port:"873",service:"Rsync",proto:"TCP",notes:"File sync",gotcha:true},
    {port:"993",service:"IMAPS",proto:"TCP",notes:"Encrypted IMAP",gotcha:false},
    {port:"995",service:"POP3S",proto:"TCP",notes:"Encrypted POP3",gotcha:false},
    {port:"1080",service:"SOCKS",proto:"TCP",notes:"Proxy protocol",gotcha:true},
    {port:"1099",service:"Java RMI",proto:"TCP",notes:"Java remote method",gotcha:true},
    {port:"1433",service:"MSSQL",proto:"TCP",notes:"SQL Server",gotcha:false},
    {port:"1434",service:"MSSQL Browser",proto:"UDP",notes:"SQL Server discovery",gotcha:true},
    {port:"1521",service:"Oracle TNS",proto:"TCP",notes:"Oracle DB",gotcha:false},
    {port:"1723",service:"PPTP",proto:"TCP",notes:"VPN tunnel",gotcha:true},
    {port:"1985",service:"HSRP",proto:"UDP",notes:"Router redundancy",gotcha:true},
    {port:"2049",service:"NFS",proto:"TCP/UDP",notes:"Network filesystem",gotcha:false},
    {port:"3128",service:"Squid Proxy",proto:"TCP",notes:"HTTP proxy",gotcha:true},
    {port:"3268",service:"GC LDAP",proto:"TCP",notes:"AD Global Catalog",gotcha:true},
    {port:"3269",service:"GC LDAPS",proto:"TCP",notes:"AD GC encrypted",gotcha:true},
    {port:"3306",service:"MySQL",proto:"TCP",notes:"MySQL DB",gotcha:false},
    {port:"3389",service:"RDP",proto:"TCP",notes:"Remote Desktop",gotcha:false},
    {port:"4444",service:"Metasploit",proto:"TCP",notes:"Default handler",gotcha:true},
    {port:"5060",service:"SIP",proto:"TCP/UDP",notes:"VoIP signaling",gotcha:false},
    {port:"5061",service:"SIP TLS",proto:"TCP",notes:"Encrypted VoIP",gotcha:true},
    {port:"5432",service:"PostgreSQL",proto:"TCP",notes:"PostgreSQL DB",gotcha:false},
    {port:"5900",service:"VNC",proto:"TCP",notes:"Remote desktop",gotcha:false},
    {port:"5985",service:"WinRM HTTP",proto:"TCP",notes:"PS remoting",gotcha:false},
    {port:"5986",service:"WinRM HTTPS",proto:"TCP",notes:"PS remoting (enc)",gotcha:false},
    {port:"6000",service:"X11",proto:"TCP",notes:"X Window System",gotcha:true},
    {port:"6379",service:"Redis",proto:"TCP",notes:"Key-value store",gotcha:true},
    {port:"8080",service:"HTTP Alt",proto:"TCP",notes:"Alt HTTP/proxy",gotcha:false},
    {port:"8443",service:"HTTPS Alt",proto:"TCP",notes:"Alt HTTPS",gotcha:false},
    {port:"9200",service:"Elasticsearch",proto:"TCP",notes:"Search engine",gotcha:true},
    {port:"27017",service:"MongoDB",proto:"TCP",notes:"NoSQL DB",gotcha:true},
  ];

  const app = document.getElementById('app');
  let html = `
    <div class="quiz-header">
      <button onclick="goMenu()" class="btn btn-back">&larr; Menu</button>
      <span class="quiz-title">MASTER PORT REFERENCE</span>
      <span class="quiz-score">${ports.length} ports</span>
    </div>
    <p class="port-ref-subtitle">Port numbers are THE most tested topic. <span class="gotcha-label">Orange</span> = gotcha ports that trip up candidates.</p>
    <div class="port-ref-search">
      <input type="text" id="port-search" placeholder="Search port, service, or notes..." oninput="filterPorts()">
    </div>
    <div class="port-ref-table">
      <div class="port-ref-header">
        <span>Port</span>
        <span>Service</span>
        <span>Proto</span>
        <span>Notes</span>
      </div>
      <div id="port-ref-body">`;

  html += buildPortRows(ports, '');

  html += `</div></div>`;
  app.innerHTML = html;

  window._portRefData = ports;
}

function buildPortRows(ports, filter) {
  const f = filter.toLowerCase();
  let html = '';
  let filtered = ports;
  if (f) {
    filtered = ports.filter(p =>
      p.port.includes(f) || p.service.toLowerCase().includes(f) ||
      p.proto.toLowerCase().includes(f) || p.notes.toLowerCase().includes(f)
    );
  }
  filtered.forEach(p => {
    html += `
      <div class="port-ref-row${p.gotcha ? ' gotcha' : ''}">
        <span class="port-ref-port">${p.port}</span>
        <span class="port-ref-service">${p.service}</span>
        <span class="port-ref-proto">${p.proto}</span>
        <span class="port-ref-notes">${p.notes}</span>
      </div>`;
  });
  if (filtered.length === 0) {
    html += `<div class="port-ref-empty">No matches found</div>`;
  }
  return html;
}

function filterPorts() {
  const val = document.getElementById('port-search').value;
  document.getElementById('port-ref-body').innerHTML = buildPortRows(window._portRefData, val);
}

function showCryptoReference() {
  state.mode = 'cryptoref';
  const app = document.getElementById('app');

  app.innerHTML = `
    <div class="quiz-header">
      <button onclick="goMenu()" class="btn btn-back">&larr; Menu</button>
      <span class="quiz-title">CRYPTOGRAPHY REFERENCE</span>
      <span></span>
    </div>

    <div class="ref-section">
      <h3 class="ref-section-title">AES Round Counts</h3>
      <div class="ref-table">
        <div class="ref-table-header ref-cols-4">
          <span>Variant</span><span>Key</span><span>Block</span><span>Rounds</span>
        </div>
        <div class="ref-table-row ref-cols-4">
          <span class="ref-highlight">AES-128</span><span>128-bit</span><span>128-bit</span><span class="ref-accent">10</span>
        </div>
        <div class="ref-table-row ref-cols-4">
          <span class="ref-highlight">AES-192</span><span>192-bit</span><span>128-bit</span><span class="ref-accent">12</span>
        </div>
        <div class="ref-table-row ref-cols-4">
          <span class="ref-highlight">AES-256</span><span>256-bit</span><span>128-bit</span><span class="ref-accent">14</span>
        </div>
      </div>
    </div>

    <div class="ref-section">
      <h3 class="ref-section-title">Hash Output Lengths</h3>
      <div class="ref-table">
        <div class="ref-table-header ref-cols-4">
          <span>Algorithm</span><span>Output</span><span>Hex</span><span>Status</span>
        </div>
        <div class="ref-table-row ref-cols-4">
          <span class="ref-highlight">MD5</span><span>128-bit</span><span>32</span><span class="ref-danger">Broken</span>
        </div>
        <div class="ref-table-row ref-cols-4">
          <span class="ref-highlight">SHA-1</span><span>160-bit</span><span>40</span><span class="ref-danger">Broken</span>
        </div>
        <div class="ref-table-row ref-cols-4">
          <span class="ref-highlight">SHA-256</span><span>256-bit</span><span>64</span><span class="ref-safe">Secure</span>
        </div>
        <div class="ref-table-row ref-cols-4">
          <span class="ref-highlight">SHA-512</span><span>512-bit</span><span>128</span><span class="ref-safe">Secure</span>
        </div>
        <div class="ref-table-row ref-cols-4">
          <span class="ref-highlight">NTLM</span><span>128-bit</span><span>32</span><span class="ref-warn">Weak (unsalted MD4)</span>
        </div>
        <div class="ref-table-row ref-cols-4">
          <span class="ref-highlight">LM</span><span>128-bit</span><span>32</span><span class="ref-danger">Very weak (7+7, DES)</span>
        </div>
      </div>
    </div>

    <div class="ref-section">
      <h3 class="ref-section-title">Block Cipher Modes</h3>
      <div class="ref-table">
        <div class="ref-table-header ref-cols-3">
          <span>Mode</span><span>Name</span><span>Key Point</span>
        </div>
        <div class="ref-table-row ref-cols-3 ref-row-danger">
          <span class="ref-highlight">ECB</span><span>Electronic Codebook</span><span class="ref-danger">INSECURE - identical blocks = identical ciphertext. NEVER use.</span>
        </div>
        <div class="ref-table-row ref-cols-3">
          <span class="ref-highlight">CBC</span><span>Cipher Block Chaining</span><span>XOR with previous block. Needs IV. Most common mode.</span>
        </div>
        <div class="ref-table-row ref-cols-3">
          <span class="ref-highlight">CFB</span><span>Cipher Feedback</span><span>Stream cipher mode. Previous ciphertext fed back.</span>
        </div>
        <div class="ref-table-row ref-cols-3">
          <span class="ref-highlight">OFB</span><span>Output Feedback</span><span>Stream cipher. No error propagation.</span>
        </div>
        <div class="ref-table-row ref-cols-3">
          <span class="ref-highlight">CTR</span><span>Counter</span><span>Encrypts incrementing counter. Parallelizable. Fast.</span>
        </div>
        <div class="ref-table-row ref-cols-3 ref-row-safe">
          <span class="ref-highlight">GCM</span><span>Galois/Counter Mode</span><span class="ref-safe">AEAD: confidentiality + integrity. Used in TLS 1.3.</span>
        </div>
      </div>
    </div>

    <div class="ref-section">
      <h3 class="ref-section-title">Wireless Encryption</h3>
      <div class="ref-table">
        <div class="ref-table-header ref-cols-5">
          <span>Standard</span><span>Encryption</span><span>Cipher</span><span>Key</span><span>Status</span>
        </div>
        <div class="ref-table-row ref-cols-5 ref-row-danger">
          <span class="ref-highlight">WEP</span><span>RC4</span><span>RC4 stream</span><span class="ref-accent">40/104-bit + 24-bit IV</span><span class="ref-danger">BROKEN</span>
        </div>
        <div class="ref-table-row ref-cols-5">
          <span class="ref-highlight">WPA</span><span>TKIP</span><span>RC4-based</span><span class="ref-accent">128-bit + 48-bit IV</span><span class="ref-warn">Deprecated</span>
        </div>
        <div class="ref-table-row ref-cols-5">
          <span class="ref-highlight">WPA2</span><span>CCMP</span><span>AES-128</span><span class="ref-accent">128-bit</span><span class="ref-safe">Current min</span>
        </div>
        <div class="ref-table-row ref-cols-5 ref-row-safe">
          <span class="ref-highlight">WPA3</span><span>SAE/GCM</span><span>AES-256</span><span class="ref-accent">192/256-bit</span><span class="ref-safe">Latest</span>
        </div>
      </div>
      <p class="ref-note">WPA3: SAE replaces PSK handshake = forward secrecy. Enterprise mode uses 192-bit.</p>
    </div>`;
}

function showIISReference() {
  state.mode = 'iisref';
  const app = document.getElementById('app');

  app.innerHTML = `
    <div class="quiz-header">
      <button onclick="goMenu()" class="btn btn-back">&larr; Menu</button>
      <span class="quiz-title">IIS &rarr; WINDOWS MAPPING</span>
      <span></span>
    </div>
    <p class="port-ref-subtitle">IIS version reveals the underlying Windows OS. This is heavily tested.</p>

    <div class="ref-section">
      <div class="ref-table">
        <div class="ref-table-header ref-cols-2">
          <span>IIS Version</span><span>Windows OS</span>
        </div>
        <div class="ref-table-row ref-cols-2">
          <span class="ref-highlight">IIS 5.0</span><span>Windows 2000</span>
        </div>
        <div class="ref-table-row ref-cols-2">
          <span class="ref-highlight">IIS 5.1</span><span>Windows XP Pro</span>
        </div>
        <div class="ref-table-row ref-cols-2">
          <span class="ref-highlight">IIS 6.0</span><span>Server 2003</span>
        </div>
        <div class="ref-table-row ref-cols-2">
          <span class="ref-highlight">IIS 7.0</span><span>Server 2008 / Vista</span>
        </div>
        <div class="ref-table-row ref-cols-2">
          <span class="ref-highlight">IIS 7.5</span><span>Server 2008 R2 / Win 7</span>
        </div>
        <div class="ref-table-row ref-cols-2">
          <span class="ref-highlight">IIS 8.0</span><span>Server 2012 / Win 8</span>
        </div>
        <div class="ref-table-row ref-cols-2">
          <span class="ref-highlight">IIS 8.5</span><span>Server 2012 R2 / Win 8.1</span>
        </div>
        <div class="ref-table-row ref-cols-2">
          <span class="ref-highlight">IIS 10.0</span><span>Server 2016/2019/2022 / Win 10/11</span>
        </div>
      </div>
    </div>

    <div class="ref-section">
      <h3 class="ref-section-title">EXAM INFO</h3>
      <div class="ref-table">
        <div class="ref-table-row ref-cols-2">
          <span class="ref-muted">Format</span><span>120 MCQs</span>
        </div>
        <div class="ref-table-row ref-cols-2">
          <span class="ref-muted">Duration</span><span>2 Hours</span>
        </div>
        <div class="ref-table-row ref-cols-2">
          <span class="ref-muted">Pass Mark</span><span class="ref-accent">60% (72/120)</span>
        </div>
        <div class="ref-table-row ref-cols-2">
          <span class="ref-muted">Negative Marking</span><span class="ref-safe">None</span>
        </div>
        <div class="ref-table-row ref-cols-2">
          <span class="ref-muted">Book</span><span>Closed Book</span>
        </div>
        <div class="ref-table-row ref-cols-2 ref-row-safe">
          <span class="ref-muted">Strategy</span><span class="ref-safe">ANSWER EVERY QUESTION - NO PENALTY</span>
        </div>
      </div>
    </div>`;
}

function showNetworkReference() {
  state.mode = 'netref';
  const app = document.getElementById('app');

  app.innerHTML = `
    <div class="quiz-header">
      <button onclick="goMenu()" class="btn btn-back">&larr; Menu</button>
      <span class="quiz-title">NETWORKING REFERENCE</span>
      <span></span>
    </div>

    <div class="ref-section">
      <h3 class="ref-section-title">IP Address Classes</h3>
      <div class="ref-table">
        <div class="ref-table-header ref-cols-5">
          <span>Class</span><span>Range</span><span>Default Mask</span><span>CIDR</span><span>Hosts</span>
        </div>
        <div class="ref-table-row ref-cols-5">
          <span class="ref-highlight">A</span><span>1.0.0.0 - 126.x.x.x</span><span>255.0.0.0</span><span class="ref-accent">/8</span><span>16.7M</span>
        </div>
        <div class="ref-table-row ref-cols-5">
          <span class="ref-highlight">B</span><span>128.0.0.0 - 191.x.x.x</span><span>255.255.0.0</span><span class="ref-accent">/16</span><span>65,534</span>
        </div>
        <div class="ref-table-row ref-cols-5">
          <span class="ref-highlight">C</span><span>192.0.0.0 - 223.x.x.x</span><span>255.255.255.0</span><span class="ref-accent">/24</span><span>254</span>
        </div>
        <div class="ref-table-row ref-cols-5">
          <span class="ref-highlight">D</span><span>224.0.0.0 - 239.x.x.x</span><span>-</span><span>-</span><span class="ref-warn">Multicast</span>
        </div>
        <div class="ref-table-row ref-cols-5">
          <span class="ref-highlight">E</span><span>240.0.0.0 - 255.x.x.x</span><span>-</span><span>-</span><span class="ref-muted">Reserved</span>
        </div>
      </div>
    </div>

    <div class="ref-section">
      <h3 class="ref-section-title">Private IP Ranges (RFC 1918)</h3>
      <div class="ref-table">
        <div class="ref-table-header ref-cols-3">
          <span>Class</span><span>Range</span><span>CIDR</span>
        </div>
        <div class="ref-table-row ref-cols-3">
          <span class="ref-highlight">A</span><span>10.0.0.0 - 10.255.255.255</span><span class="ref-accent">10.0.0.0/8</span>
        </div>
        <div class="ref-table-row ref-cols-3">
          <span class="ref-highlight">B</span><span>172.16.0.0 - 172.31.255.255</span><span class="ref-accent">172.16.0.0/12</span>
        </div>
        <div class="ref-table-row ref-cols-3">
          <span class="ref-highlight">C</span><span>192.168.0.0 - 192.168.255.255</span><span class="ref-accent">192.168.0.0/16</span>
        </div>
      </div>
    </div>

    <div class="ref-section">
      <h3 class="ref-section-title">Special Addresses</h3>
      <div class="ref-table">
        <div class="ref-table-header ref-cols-3">
          <span>Address</span><span>Name</span><span>Purpose</span>
        </div>
        <div class="ref-table-row ref-cols-3">
          <span class="ref-highlight">127.0.0.0/8</span><span>Loopback</span><span>localhost testing</span>
        </div>
        <div class="ref-table-row ref-cols-3 ref-row-danger">
          <span class="ref-highlight">169.254.0.0/16</span><span>APIPA</span><span class="ref-danger">Auto-assign when DHCP fails</span>
        </div>
        <div class="ref-table-row ref-cols-3">
          <span class="ref-highlight">0.0.0.0</span><span>Unspecified</span><span>Default route / all interfaces</span>
        </div>
        <div class="ref-table-row ref-cols-3">
          <span class="ref-highlight">255.255.255.255</span><span>Broadcast</span><span>All hosts on local network</span>
        </div>
      </div>
    </div>

    <div class="ref-section">
      <h3 class="ref-section-title">IPv4 vs IPv6</h3>
      <div class="ref-table">
        <div class="ref-table-header ref-cols-3">
          <span>Feature</span><span>IPv4</span><span>IPv6</span>
        </div>
        <div class="ref-table-row ref-cols-3">
          <span class="ref-muted">Address Size</span><span class="ref-accent">32-bit</span><span class="ref-accent">128-bit</span>
        </div>
        <div class="ref-table-row ref-cols-3">
          <span class="ref-muted">Format</span><span>Dotted decimal<br>192.168.1.1</span><span>Colon hex<br>2001:db8::1</span>
        </div>
        <div class="ref-table-row ref-cols-3">
          <span class="ref-muted">Addresses</span><span>4.3 billion</span><span>340 undecillion</span>
        </div>
        <div class="ref-table-row ref-cols-3">
          <span class="ref-muted">Header</span><span>20-60 bytes (variable)</span><span>40 bytes (fixed)</span>
        </div>
        <div class="ref-table-row ref-cols-3">
          <span class="ref-muted">IPsec</span><span>Optional</span><span class="ref-safe">Built-in</span>
        </div>
        <div class="ref-table-row ref-cols-3">
          <span class="ref-muted">Broadcast</span><span>Yes</span><span class="ref-warn">No (uses multicast)</span>
        </div>
        <div class="ref-table-row ref-cols-3">
          <span class="ref-muted">ARP</span><span>Yes</span><span class="ref-warn">No (uses NDP)</span>
        </div>
        <div class="ref-table-row ref-cols-3">
          <span class="ref-muted">NAT</span><span>Common</span><span>Not needed</span>
        </div>
      </div>
    </div>

    <div class="ref-section">
      <h3 class="ref-section-title">IPv6 Gotchas</h3>
      <div class="ref-table">
        <div class="ref-table-header ref-cols-2">
          <span>Type</span><span>Details</span>
        </div>
        <div class="ref-table-row ref-cols-2">
          <span class="ref-highlight">::1</span><span>Loopback (like 127.0.0.1)</span>
        </div>
        <div class="ref-table-row ref-cols-2">
          <span class="ref-highlight">::</span><span>Unspecified (like 0.0.0.0)</span>
        </div>
        <div class="ref-table-row ref-cols-2">
          <span class="ref-highlight">fe80::/10</span><span>Link-local (auto-configured, like APIPA)</span>
        </div>
        <div class="ref-table-row ref-cols-2">
          <span class="ref-highlight">fc00::/7</span><span>Unique local (like RFC 1918 private)</span>
        </div>
        <div class="ref-table-row ref-cols-2">
          <span class="ref-highlight">ff00::/8</span><span>Multicast (replaces broadcast)</span>
        </div>
        <div class="ref-table-row ref-cols-2">
          <span class="ref-highlight">::ffff:0:0/96</span><span>IPv4-mapped (e.g. ::ffff:192.168.1.1)</span>
        </div>
      </div>
      <p class="ref-note">IPv6 uses NDP (Neighbor Discovery Protocol) instead of ARP. Attacks: RA spoofing, NDP poisoning.</p>
    </div>

    <div class="ref-section">
      <h3 class="ref-section-title">SSID & Wireless</h3>
      <div class="ref-table">
        <div class="ref-table-header ref-cols-2">
          <span>Property</span><span>Value</span>
        </div>
        <div class="ref-table-row ref-cols-2">
          <span class="ref-muted">SSID Max Length</span><span class="ref-accent">32 bytes (characters)</span>
        </div>
        <div class="ref-table-row ref-cols-2">
          <span class="ref-muted">Hidden SSID</span><span>Not broadcast but still in probe requests - <span class="ref-warn">NOT secure</span></span>
        </div>
        <div class="ref-table-row ref-cols-2">
          <span class="ref-muted">WPA2-PSK Key</span><span class="ref-accent">8-63 characters</span>
        </div>
        <div class="ref-table-row ref-cols-2">
          <span class="ref-muted">802.11 Channels (2.4GHz)</span><span class="ref-accent">1, 6, 11</span> (non-overlapping)</span>
        </div>
        <div class="ref-table-row ref-cols-2">
          <span class="ref-muted">MAC Address</span><span class="ref-accent">48-bit</span> (6 bytes, hex pairs: AA:BB:CC:DD:EE:FF)</span>
        </div>
        <div class="ref-table-row ref-cols-2">
          <span class="ref-muted">BSSID</span><span>AP's MAC address</span>
        </div>
      </div>
    </div>

    <div class="ref-section">
      <h3 class="ref-section-title">Subnet Cheat Sheet</h3>
      <div class="ref-table">
        <div class="ref-table-header ref-cols-4">
          <span>CIDR</span><span>Mask</span><span>Hosts</span><span>Use</span>
        </div>
        <div class="ref-table-row ref-cols-4">
          <span class="ref-accent">/32</span><span>255.255.255.255</span><span>1</span><span>Single host</span>
        </div>
        <div class="ref-table-row ref-cols-4">
          <span class="ref-accent">/31</span><span>255.255.255.254</span><span>2</span><span>Point-to-point link</span>
        </div>
        <div class="ref-table-row ref-cols-4">
          <span class="ref-accent">/30</span><span>255.255.255.252</span><span>2</span><span>Smallest usable subnet</span>
        </div>
        <div class="ref-table-row ref-cols-4">
          <span class="ref-accent">/29</span><span>255.255.255.248</span><span>6</span><span>Small office</span>
        </div>
        <div class="ref-table-row ref-cols-4">
          <span class="ref-accent">/28</span><span>255.255.255.240</span><span>14</span><span>Small subnet</span>
        </div>
        <div class="ref-table-row ref-cols-4">
          <span class="ref-accent">/27</span><span>255.255.255.224</span><span>30</span><span>Medium subnet</span>
        </div>
        <div class="ref-table-row ref-cols-4">
          <span class="ref-accent">/26</span><span>255.255.255.192</span><span>62</span><span></span>
        </div>
        <div class="ref-table-row ref-cols-4">
          <span class="ref-accent">/25</span><span>255.255.255.128</span><span>126</span><span></span>
        </div>
        <div class="ref-table-row ref-cols-4">
          <span class="ref-accent">/24</span><span>255.255.255.0</span><span>254</span><span>Class C default</span>
        </div>
        <div class="ref-table-row ref-cols-4">
          <span class="ref-accent">/16</span><span>255.255.0.0</span><span>65,534</span><span>Class B default</span>
        </div>
        <div class="ref-table-row ref-cols-4">
          <span class="ref-accent">/8</span><span>255.0.0.0</span><span>16.7M</span><span>Class A default</span>
        </div>
        <div class="ref-table-row ref-cols-4">
          <span class="ref-accent">/0</span><span>0.0.0.0</span><span>All</span><span class="ref-warn">Entire internet</span>
        </div>
      </div>
      <p class="ref-note">Usable hosts = 2^(32-CIDR) - 2 (subtract network + broadcast). Exception: /31 has 2 usable (RFC 3021).</p>
    </div>

    <div class="ref-section">
      <h3 class="ref-section-title">TCP/IP Model vs OSI</h3>
      <div class="ref-table">
        <div class="ref-table-header ref-cols-4">
          <span>OSI #</span><span>OSI Layer</span><span>TCP/IP</span><span>Protocols</span>
        </div>
        <div class="ref-table-row ref-cols-4">
          <span class="ref-accent">7</span><span>Application</span><span rowspan="3" class="ref-highlight">Application</span><span>HTTP, FTP, DNS, SMTP, SSH</span>
        </div>
        <div class="ref-table-row ref-cols-4">
          <span class="ref-accent">6</span><span>Presentation</span><span class="ref-highlight">Application</span><span>SSL/TLS, JPEG, ASCII</span>
        </div>
        <div class="ref-table-row ref-cols-4">
          <span class="ref-accent">5</span><span>Session</span><span class="ref-highlight">Application</span><span>NetBIOS, RPC, SOCKS</span>
        </div>
        <div class="ref-table-row ref-cols-4">
          <span class="ref-accent">4</span><span>Transport</span><span class="ref-highlight">Transport</span><span>TCP, UDP</span>
        </div>
        <div class="ref-table-row ref-cols-4">
          <span class="ref-accent">3</span><span>Network</span><span class="ref-highlight">Internet</span><span>IP, ICMP, IPsec, ARP</span>
        </div>
        <div class="ref-table-row ref-cols-4">
          <span class="ref-accent">2</span><span>Data Link</span><span class="ref-highlight">Network Access</span><span>Ethernet, Wi-Fi, PPP</span>
        </div>
        <div class="ref-table-row ref-cols-4">
          <span class="ref-accent">1</span><span>Physical</span><span class="ref-highlight">Network Access</span><span>Cables, hubs, signals</span>
        </div>
      </div>
      <p class="ref-note">Remember: Please Do Not Throw Sausage Pizza Away (layers 1-7). TCP/IP has 4 layers: Network Access, Internet, Transport, Application.</p>
    </div>`;
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

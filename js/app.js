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
      <button onclick="showPortMastery()" class="btn btn-port">PORT MASTERY (Learn &amp; Type)</button>
      <button onclick="startPortDrill()" class="btn btn-portdrill-btn">PORT SPEED DRILL (MCQ)</button>
      <button onclick="startRandomMix()" class="btn btn-mix">RANDOM MIX (All 334)</button>
      <button onclick="startWeakAreas()" class="btn btn-weak">WEAK AREAS</button>
    </div>

    <div class="mode-buttons" style="margin-top:10px">
      <button onclick="showAllReferences()" class="btn btn-ref-all">CHEAT SHEETS (Ports, Crypto, Net, Linux, Events, IIS)</button>
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
  state.mode = 'results';
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

function getPortsData() {
  return [
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
  return ports;
}

function getPortsHTML(ports) {
  let html = `
    <div class="ref-section" id="ref-ports">
      <h2 class="ref-page-title">MASTER PORT REFERENCE</h2>
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
  html += `</div></div></div>`;
  return html;
}

function buildPortRows(ports, filter) {
  const f = filter.toLowerCase();
  let filtered = ports;
  if (f) {
    filtered = ports.filter(p =>
      p.port.includes(f) || p.service.toLowerCase().includes(f) ||
      p.proto.toLowerCase().includes(f) || p.notes.toLowerCase().includes(f)
    );
  }
  let html = '';
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

function getCryptoHTML() {
  return `
    <div id="ref-crypto">
      <h2 class="ref-page-title">CRYPTOGRAPHY</h2>

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
      <h3 class="ref-section-title">Hash Digest Lengths</h3>
      <div class="ref-table">
        <div class="ref-table-header ref-cols-4">
          <span>Algorithm</span><span>Digest</span><span>Hex Chars</span><span>Status</span>
        </div>
        <div class="ref-table-row ref-cols-4">
          <span class="ref-highlight">MD5</span><span>128-bit</span><span>32</span><span class="ref-danger">Broken</span>
        </div>
        <div class="ref-table-row ref-cols-4">
          <span class="ref-highlight">SHA-1</span><span>160-bit</span><span>40</span><span class="ref-danger">Broken</span>
        </div>
        <div class="ref-table-row ref-cols-4">
          <span class="ref-highlight">SHA-224</span><span>224-bit</span><span>56</span><span class="ref-safe">Secure</span>
        </div>
        <div class="ref-table-row ref-cols-4">
          <span class="ref-highlight">SHA-256</span><span>256-bit</span><span>64</span><span class="ref-safe">Secure</span>
        </div>
        <div class="ref-table-row ref-cols-4">
          <span class="ref-highlight">SHA-384</span><span>384-bit</span><span>96</span><span class="ref-safe">Secure</span>
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
      <h3 class="ref-section-title">Exam Distractors — Don't Mix These Up!</h3>
      <div class="ref-table">
        <div class="ref-table-header ref-cols-3">
          <span>Value</span><span>What It Actually Is</span><span>NOT</span>
        </div>
        <div class="ref-table-row ref-cols-3 ref-row-danger">
          <span class="ref-highlight">56 bits</span><span>DES key length</span><span class="ref-danger">Not a hash digest</span>
        </div>
        <div class="ref-table-row ref-cols-3 ref-row-danger">
          <span class="ref-highlight">128 bits</span><span>MD5 digest / AES smallest key</span><span class="ref-danger">Not SHA — it's MD5</span>
        </div>
        <div class="ref-table-row ref-cols-3 ref-row-danger">
          <span class="ref-highlight">192 bits</span><span>AES key size option</span><span class="ref-danger">Not a hash digest</span>
        </div>
        <div class="ref-table-row ref-cols-3 ref-row-danger">
          <span class="ref-highlight">256 bits</span><span>SHA-256 digest / AES key size</span><span class="ref-danger">Both — know which context</span>
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
    </div>
    </div>`;
}

function getIISHTML() {
  return `
    <div id="ref-iis">
      <h2 class="ref-page-title">IIS &rarr; WINDOWS MAPPING</h2>
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
    </div>
    </div>`;
}

function getNetworkHTML() {
  return `
    <div id="ref-net">
      <h2 class="ref-page-title">NETWORKING</h2>

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
    </div>
    </div>`;
}

function getLinuxHTML() {
  return `
    <div id="ref-linux">
      <h2 class="ref-page-title">LINUX PERMISSIONS</h2>
      <p class="port-ref-subtitle">File permissions, SUID/SGID, sticky bit — heavily tested on the exam.</p>

    <div class="ref-section">
      <h3 class="ref-section-title">Permission Bits (rwx)</h3>
      <div class="ref-table">
        <div class="ref-table-header ref-cols-4">
          <span>Octal</span><span>Binary</span><span>Permission</span><span>Meaning</span>
        </div>
        <div class="ref-table-row ref-cols-4">
          <span class="ref-accent">0</span><span>000</span><span>---</span><span>No access</span>
        </div>
        <div class="ref-table-row ref-cols-4">
          <span class="ref-accent">1</span><span>001</span><span>--x</span><span>Execute only</span>
        </div>
        <div class="ref-table-row ref-cols-4">
          <span class="ref-accent">2</span><span>010</span><span>-w-</span><span>Write only</span>
        </div>
        <div class="ref-table-row ref-cols-4">
          <span class="ref-accent">3</span><span>011</span><span>-wx</span><span>Write + execute</span>
        </div>
        <div class="ref-table-row ref-cols-4">
          <span class="ref-accent">4</span><span>100</span><span>r--</span><span>Read only</span>
        </div>
        <div class="ref-table-row ref-cols-4">
          <span class="ref-accent">5</span><span>101</span><span>r-x</span><span>Read + execute</span>
        </div>
        <div class="ref-table-row ref-cols-4">
          <span class="ref-accent">6</span><span>110</span><span>rw-</span><span>Read + write</span>
        </div>
        <div class="ref-table-row ref-cols-4">
          <span class="ref-accent">7</span><span>111</span><span>rwx</span><span>Full access</span>
        </div>
      </div>
      <p class="ref-note">chmod 755 = rwxr-xr-x → Owner: full, Group: read+exec, Others: read+exec</p>
    </div>

    <div class="ref-section">
      <h3 class="ref-section-title">SUID / SGID / Sticky Bit</h3>
      <div class="ref-table">
        <div class="ref-table-header ref-cols-4">
          <span>Bit</span><span>Octal</span><span>On Files</span><span>On Directories</span>
        </div>
        <div class="ref-table-row ref-cols-4 ref-row-danger">
          <span class="ref-highlight">SUID</span><span class="ref-accent">4000</span><span class="ref-danger">Runs as file OWNER (e.g. passwd runs as root)</span><span>No effect</span>
        </div>
        <div class="ref-table-row ref-cols-4 ref-row-danger">
          <span class="ref-highlight">SGID</span><span class="ref-accent">2000</span><span>Runs as file GROUP</span><span class="ref-warn">New files inherit dir's group</span>
        </div>
        <div class="ref-table-row ref-cols-4">
          <span class="ref-highlight">Sticky</span><span class="ref-accent">1000</span><span>No effect</span><span class="ref-safe">Only owner can delete files (e.g. /tmp)</span>
        </div>
      </div>
      <p class="ref-note">ls -l shows: SUID = <strong>s</strong> in owner exec (rw<strong>s</strong>), SGID = <strong>s</strong> in group exec (r-<strong>s</strong>), Sticky = <strong>t</strong> in others exec (r-<strong>t</strong>). Capital <strong>S</strong> or <strong>T</strong> = bit set but no exec underneath.</p>
    </div>

    <div class="ref-section">
      <h3 class="ref-section-title">Common Permission Examples</h3>
      <div class="ref-table">
        <div class="ref-table-header ref-cols-3">
          <span>Octal</span><span>Symbolic</span><span>Typical Use</span>
        </div>
        <div class="ref-table-row ref-cols-3">
          <span class="ref-accent">644</span><span>rw-r--r--</span><span>Regular files (owner writes, others read)</span>
        </div>
        <div class="ref-table-row ref-cols-3">
          <span class="ref-accent">755</span><span>rwxr-xr-x</span><span>Scripts, dirs, executables</span>
        </div>
        <div class="ref-table-row ref-cols-3">
          <span class="ref-accent">700</span><span>rwx------</span><span>Private dirs (SSH keys, home)</span>
        </div>
        <div class="ref-table-row ref-cols-3">
          <span class="ref-accent">600</span><span>rw-------</span><span>Private files (SSH keys, configs)</span>
        </div>
        <div class="ref-table-row ref-cols-3 ref-row-danger">
          <span class="ref-accent">4755</span><span>rwsr-xr-x</span><span class="ref-danger">SUID binary (passwd, sudo, ping)</span>
        </div>
        <div class="ref-table-row ref-cols-3 ref-row-danger">
          <span class="ref-accent">2755</span><span>rwxr-sr-x</span><span class="ref-warn">SGID binary/dir (shared group dirs)</span>
        </div>
        <div class="ref-table-row ref-cols-3">
          <span class="ref-accent">1777</span><span>rwxrwxrwt</span><span class="ref-safe">Sticky dir (/tmp — everyone writes, only owner deletes)</span>
        </div>
      </div>
    </div>

    <div class="ref-section">
      <h3 class="ref-section-title">Key Commands</h3>
      <div class="ref-table">
        <div class="ref-table-header ref-cols-3">
          <span>Command</span><span>Example</span><span>What It Does</span>
        </div>
        <div class="ref-table-row ref-cols-3">
          <span class="ref-highlight">chmod</span><span>chmod 755 file</span><span>Set permissions (octal)</span>
        </div>
        <div class="ref-table-row ref-cols-3">
          <span class="ref-highlight">chmod</span><span>chmod u+s file</span><span>Set SUID bit</span>
        </div>
        <div class="ref-table-row ref-cols-3">
          <span class="ref-highlight">chmod</span><span>chmod g+s dir</span><span>Set SGID on directory</span>
        </div>
        <div class="ref-table-row ref-cols-3">
          <span class="ref-highlight">chmod</span><span>chmod +t dir</span><span>Set sticky bit</span>
        </div>
        <div class="ref-table-row ref-cols-3">
          <span class="ref-highlight">chown</span><span>chown user:group file</span><span>Change owner & group</span>
        </div>
        <div class="ref-table-row ref-cols-3">
          <span class="ref-highlight">umask</span><span>umask 022</span><span>Default 755 dirs / 644 files</span>
        </div>
        <div class="ref-table-row ref-cols-3">
          <span class="ref-highlight">find</span><span>find / -perm -4000</span><span class="ref-danger">Find ALL SUID files (pentest recon!)</span>
        </div>
        <div class="ref-table-row ref-cols-3">
          <span class="ref-highlight">find</span><span>find / -perm -2000</span><span class="ref-warn">Find ALL SGID files</span>
        </div>
      </div>
    </div>

    <div class="ref-section">
      <h3 class="ref-section-title">Exam Gotchas — SUID/SGID</h3>
      <div class="ref-table">
        <div class="ref-table-header ref-cols-2" style="grid-template-columns:1fr 2fr">
          <span>Trap</span><span>Truth</span>
        </div>
        <div class="ref-table-row ref-cols-2 ref-row-danger" style="grid-template-columns:1fr 2fr">
          <span class="ref-danger">SUID on a script?</span><span>Most Linux kernels IGNORE SUID on scripts — only works on binaries</span>
        </div>
        <div class="ref-table-row ref-cols-2 ref-row-danger" style="grid-template-columns:1fr 2fr">
          <span class="ref-danger">SUID on a dir?</span><span>SUID on directories has NO effect on Linux</span>
        </div>
        <div class="ref-table-row ref-cols-2" style="grid-template-columns:1fr 2fr">
          <span class="ref-warn">Sticky on a file?</span><span>Sticky bit on files is ignored on modern Linux — only matters on dirs</span>
        </div>
        <div class="ref-table-row ref-cols-2" style="grid-template-columns:1fr 2fr">
          <span class="ref-highlight">umask 077?</span><span>Creates 700 dirs / 600 files — most restrictive common umask</span>
        </div>
      </div>
    </div>

    </div>`;
}

function getWindowsEventsHTML() {
  return `
    <div id="ref-events">
      <h2 class="ref-page-title">WINDOWS EVENT IDs</h2>
      <p class="port-ref-subtitle">Critical Event IDs for security monitoring, incident response &amp; forensics.</p>

    <div class="ref-section">
      <h3 class="ref-section-title">Authentication &amp; Logon</h3>
      <div class="ref-table">
        <div class="ref-table-header ref-cols-3">
          <span>Event ID</span><span>Name</span><span>Why It Matters</span>
        </div>
        <div class="ref-table-row ref-cols-3">
          <span class="ref-accent">4624</span><span>Successful Logon</span><span>Baseline for all logon activity</span>
        </div>
        <div class="ref-table-row ref-cols-3">
          <span class="ref-accent">4625</span><span>Failed Logon</span><span class="ref-warn">Brute force / password spray indicator</span>
        </div>
        <div class="ref-table-row ref-cols-3 ref-row-danger">
          <span class="ref-accent">4672</span><span>Special Privileges Assigned</span><span class="ref-danger">Admin logon &mdash; tracks privileged access</span>
        </div>
        <div class="ref-table-row ref-cols-3">
          <span class="ref-accent">4634</span><span>Logoff</span><span>Session duration analysis</span>
        </div>
        <div class="ref-table-row ref-cols-3">
          <span class="ref-accent">4648</span><span>Logon Using Explicit Creds</span><span class="ref-warn">RunAs / lateral movement indicator</span>
        </div>
        <div class="ref-table-row ref-cols-3">
          <span class="ref-accent">4768</span><span>Kerberos TGT Requested</span><span>Initial Kerberos authentication</span>
        </div>
        <div class="ref-table-row ref-cols-3">
          <span class="ref-accent">4769</span><span>Kerberos Service Ticket</span><span class="ref-warn">Kerberoasting detection</span>
        </div>
        <div class="ref-table-row ref-cols-3">
          <span class="ref-accent">4771</span><span>Kerberos Pre-Auth Failed</span><span class="ref-warn">AS-REP roasting / password guessing</span>
        </div>
      </div>
    </div>

    <div class="ref-section">
      <h3 class="ref-section-title">Logon Types (inside Event 4624/4625)</h3>
      <div class="ref-table">
        <div class="ref-table-header ref-cols-3">
          <span>Type</span><span>Name</span><span>Description</span>
        </div>
        <div class="ref-table-row ref-cols-3">
          <span class="ref-accent">2</span><span>Interactive</span><span>Console / physical logon</span>
        </div>
        <div class="ref-table-row ref-cols-3">
          <span class="ref-accent">3</span><span>Network</span><span>SMB, mapped drives, net use</span>
        </div>
        <div class="ref-table-row ref-cols-3">
          <span class="ref-accent">4</span><span>Batch</span><span>Scheduled tasks</span>
        </div>
        <div class="ref-table-row ref-cols-3">
          <span class="ref-accent">5</span><span>Service</span><span>Service startup</span>
        </div>
        <div class="ref-table-row ref-cols-3">
          <span class="ref-accent">7</span><span>Unlock</span><span>Workstation unlock</span>
        </div>
        <div class="ref-table-row ref-cols-3">
          <span class="ref-accent">9</span><span>NewCredentials</span><span>RunAs /netonly</span>
        </div>
        <div class="ref-table-row ref-cols-3 ref-row-danger">
          <span class="ref-accent">10</span><span>RemoteInteractive</span><span class="ref-danger">RDP logon</span>
        </div>
        <div class="ref-table-row ref-cols-3">
          <span class="ref-accent">11</span><span>CachedInteractive</span><span>Cached domain creds (offline)</span>
        </div>
      </div>
    </div>

    <div class="ref-section">
      <h3 class="ref-section-title">Account &amp; Group Changes</h3>
      <div class="ref-table">
        <div class="ref-table-header ref-cols-3">
          <span>Event ID</span><span>Name</span><span>Why It Matters</span>
        </div>
        <div class="ref-table-row ref-cols-3">
          <span class="ref-accent">4720</span><span>User Account Created</span><span class="ref-warn">Backdoor account detection</span>
        </div>
        <div class="ref-table-row ref-cols-3">
          <span class="ref-accent">4722</span><span>User Account Enabled</span><span>Reactivated accounts</span>
        </div>
        <div class="ref-table-row ref-cols-3">
          <span class="ref-accent">4724</span><span>Password Reset Attempt</span><span class="ref-warn">Unauthorized password resets</span>
        </div>
        <div class="ref-table-row ref-cols-3">
          <span class="ref-accent">4725</span><span>User Account Disabled</span><span>Account lifecycle tracking</span>
        </div>
        <div class="ref-table-row ref-cols-3">
          <span class="ref-accent">4726</span><span>User Account Deleted</span><span class="ref-warn">Evidence destruction</span>
        </div>
        <div class="ref-table-row ref-cols-3 ref-row-danger">
          <span class="ref-accent">4728</span><span>Member Added to Security Group</span><span class="ref-danger">Privilege escalation via group</span>
        </div>
        <div class="ref-table-row ref-cols-3 ref-row-danger">
          <span class="ref-accent">4732</span><span>Member Added to Local Group</span><span class="ref-danger">Local admin escalation</span>
        </div>
        <div class="ref-table-row ref-cols-3">
          <span class="ref-accent">4740</span><span>Account Locked Out</span><span>Brute force confirmation</span>
        </div>
        <div class="ref-table-row ref-cols-3">
          <span class="ref-accent">4767</span><span>Account Unlocked</span><span>Insider or social engineering</span>
        </div>
      </div>
    </div>

    <div class="ref-section">
      <h3 class="ref-section-title">Process, Policy &amp; System</h3>
      <div class="ref-table">
        <div class="ref-table-header ref-cols-3">
          <span>Event ID</span><span>Name</span><span>Why It Matters</span>
        </div>
        <div class="ref-table-row ref-cols-3 ref-row-danger">
          <span class="ref-accent">4688</span><span>New Process Created</span><span class="ref-danger">Malware execution / LOLBins</span>
        </div>
        <div class="ref-table-row ref-cols-3">
          <span class="ref-accent">4689</span><span>Process Exited</span><span>Process lifecycle</span>
        </div>
        <div class="ref-table-row ref-cols-3">
          <span class="ref-accent">4697</span><span>Service Installed</span><span class="ref-warn">Persistence mechanism</span>
        </div>
        <div class="ref-table-row ref-cols-3 ref-row-danger">
          <span class="ref-accent">4719</span><span>Audit Policy Changed</span><span class="ref-danger">Attacker covering tracks</span>
        </div>
        <div class="ref-table-row ref-cols-3 ref-row-danger">
          <span class="ref-accent">1102</span><span>Audit Log Cleared</span><span class="ref-danger">Anti-forensics &mdash; always investigate!</span>
        </div>
        <div class="ref-table-row ref-cols-3">
          <span class="ref-accent">4698</span><span>Scheduled Task Created</span><span class="ref-warn">Persistence / lateral movement</span>
        </div>
        <div class="ref-table-row ref-cols-3">
          <span class="ref-accent">4663</span><span>Object Access Attempted</span><span>File/folder access auditing</span>
        </div>
        <div class="ref-table-row ref-cols-3">
          <span class="ref-accent">5140</span><span>Network Share Accessed</span><span>Lateral movement via shares</span>
        </div>
        <div class="ref-table-row ref-cols-3">
          <span class="ref-accent">5156</span><span>Windows Firewall Allowed</span><span>Network connection auditing</span>
        </div>
      </div>
    </div>

    <div class="ref-section">
      <h3 class="ref-section-title">Quick Recall</h3>
      <div class="ref-table">
        <div class="ref-table-header ref-cols-2">
          <span>Scenario</span><span>Event IDs to Check</span>
        </div>
        <div class="ref-table-row ref-cols-2">
          <span class="ref-muted">Brute force attack</span><span class="ref-accent">4625 (many) &rarr; 4624 (success) &rarr; 4672 (admin?)</span>
        </div>
        <div class="ref-table-row ref-cols-2">
          <span class="ref-muted">Lateral movement</span><span class="ref-accent">4648 + 4624 Type 3/10 + 5140</span>
        </div>
        <div class="ref-table-row ref-cols-2">
          <span class="ref-muted">Privilege escalation</span><span class="ref-accent">4672 + 4728/4732</span>
        </div>
        <div class="ref-table-row ref-cols-2">
          <span class="ref-muted">Persistence</span><span class="ref-accent">4697 + 4698 + 4720</span>
        </div>
        <div class="ref-table-row ref-cols-2">
          <span class="ref-muted">Anti-forensics</span><span class="ref-accent">1102 + 4719</span>
        </div>
        <div class="ref-table-row ref-cols-2">
          <span class="ref-muted">Kerberos attacks</span><span class="ref-accent">4768 + 4769 + 4771</span>
        </div>
      </div>
      <p class="ref-note">Key exam tip: 4672 = admin logon (special privileges). 1102 = log cleared (always suspicious). 4625 = failed logon (brute force). 4688 = process created (malware hunting).</p>
    </div>
    </div>`;
}

function showAllReferences() {
  state.mode = 'allref';
  const ports = getPortsData();
  const app = document.getElementById('app');

  let html = `
    <div class="quiz-header">
      <button onclick="goMenu()" class="btn btn-back">&larr; Menu</button>
      <span class="quiz-title">CHEAT SHEETS</span>
      <span></span>
    </div>
    <div class="ref-jump-nav">
      <a href="#ref-ports" onclick="smoothJump('ref-ports')">Ports</a>
      <a href="#ref-crypto" onclick="smoothJump('ref-crypto')">Crypto</a>
      <a href="#ref-net" onclick="smoothJump('ref-net')">Networking</a>
      <a href="#ref-linux" onclick="smoothJump('ref-linux')">Linux</a>
      <a href="#ref-events" onclick="smoothJump('ref-events')">Event IDs</a>
      <a href="#ref-iis" onclick="smoothJump('ref-iis')">IIS / Exam</a>
    </div>`;

  html += getPortsHTML(ports);
  html += getCryptoHTML();
  html += getNetworkHTML();
  html += getLinuxHTML();
  html += getWindowsEventsHTML();
  html += getIISHTML();

  app.innerHTML = html;
  window._portRefData = ports;
}

function smoothJump(id) {
  event.preventDefault();
  document.getElementById(id).scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// Keep old functions working as standalone (they call showAllReferences now)
function showPortReference() { showAllReferences(); setTimeout(() => smoothJump('ref-ports'), 50); }
function showCryptoReference() { showAllReferences(); setTimeout(() => smoothJump('ref-crypto'), 50); }
function showNetworkReference() { showAllReferences(); setTimeout(() => smoothJump('ref-net'), 50); }
function showEventsReference() { showAllReferences(); setTimeout(() => smoothJump('ref-events'), 50); }
function showIISReference() { showAllReferences(); setTimeout(() => smoothJump('ref-iis'), 50); }

// === PORT MASTERY ===
const PORT_BATCH_SIZE = 8;

function getPortBatches() {
  const ports = getPortsData();
  const batches = [];
  for (let i = 0; i < ports.length; i += PORT_BATCH_SIZE) {
    batches.push(ports.slice(i, i + PORT_BATCH_SIZE));
  }
  return batches;
}

function isPortBatchDone(idx) {
  return state.progress[`portbatch_${idx}`] === true;
}

function isPortBatchUnlocked(idx) {
  if (idx === 0) return true;
  return isPortBatchDone(idx - 1);
}

function showPortMastery() {
  state.mode = 'portmastery';
  const batches = getPortBatches();
  const app = document.getElementById('app');
  const done = batches.filter((_, i) => isPortBatchDone(i)).length;
  const pct = Math.round((done / batches.length) * 100);

  let html = `
    <div class="quiz-header">
      <button onclick="goMenu()" class="btn btn-back">&larr; Menu</button>
      <span class="quiz-title">PORT MASTERY</span>
      <span class="quiz-score">${done}/${batches.length}</span>
    </div>
    <div class="progress-bar-container">
      <div class="progress-bar" style="width:${pct}%"></div>
    </div>
    <p class="hint">Learn 8 ports at a time. Study them, then type each port number from memory. Get all 8 right to unlock the next batch.</p>
    <div class="batch-grid">`;

  batches.forEach((b, i) => {
    const unlocked = isPortBatchUnlocked(i);
    const completed = isPortBatchDone(i);
    const cls = completed ? 'batch-card completed' : (unlocked ? 'batch-card unlocked' : 'batch-card locked');
    const icon = completed ? '&#10003;' : (unlocked ? '&#9654;' : '&#128274;');
    const range = `${b[0].service} - ${b[b.length-1].service}`;
    const portRange = `Ports: ${b.map(p=>p.port).join(', ')}`;
    html += `
      <div class="${cls}" ${unlocked ? `onclick="startPortLearn(${i})"` : ''}>
        <div class="batch-icon">${icon}</div>
        <div class="batch-info">
          <div class="batch-label">Batch ${i+1}: ${range}</div>
          <div class="batch-range">${portRange}</div>
        </div>
      </div>`;
  });

  html += `</div>`;
  app.innerHTML = html;
}

function startPortLearn(batchIdx) {
  const batches = getPortBatches();
  const batch = batches[batchIdx];
  state.mode = 'portlearn';
  state.portMasteryBatch = batchIdx;
  state.portMasteryPorts = batch;
  state.portLearnIdx = 0;
  renderPortLearn();
}

function renderPortLearn() {
  const ports = state.portMasteryPorts;
  const idx = state.portLearnIdx;
  const app = document.getElementById('app');

  let html = `
    <div class="quiz-header">
      <button onclick="showPortMastery()" class="btn btn-back">&larr; Back</button>
      <span class="quiz-title">LEARN - Batch ${state.portMasteryBatch + 1}</span>
      <span class="quiz-score">${idx + 1}/${ports.length}</span>
    </div>
    <div class="quiz-progress">
      <div class="quiz-progress-bar" style="width:${((idx + 1) / ports.length) * 100}%"></div>
    </div>
    <p class="hint" style="text-align:center;margin-bottom:16px">Tap the card to flip. Memorize the port number!</p>`;

  const p = ports[idx];
  html += `
    <div class="flash-card" onclick="document.querySelector('.flash-card').classList.toggle('flipped')">
      <div class="flash-inner">
        <div class="flash-front">
          <div class="flash-service">${p.service}</div>
          <div class="flash-proto">${p.proto}</div>
          <div class="flash-notes">${p.notes}</div>
          <div class="flash-tap">tap to reveal port</div>
        </div>
        <div class="flash-back">
          <div class="flash-port">${p.port}</div>
          <div class="flash-service-sm">${p.service}</div>
          <div class="flash-proto">${p.proto}</div>
        </div>
      </div>
    </div>

    <div class="port-learn-nav">
      ${idx > 0 ? `<button onclick="state.portLearnIdx--;renderPortLearn()" class="btn btn-back">&larr; Prev</button>` : '<span></span>'}
      ${idx < ports.length - 1 ?
        `<button onclick="state.portLearnIdx++;renderPortLearn()" class="btn btn-next" style="width:auto;padding:12px 24px">Next &rarr;</button>` :
        `<button onclick="startPortRecall(state.portMasteryBatch)" class="btn btn-next" style="width:auto;padding:12px 24px">Test Yourself &rarr;</button>`
      }
    </div>`;

  app.innerHTML = html;
}

function startPortRecall(batchIdx) {
  const batches = getPortBatches();
  state.mode = 'portrecall';
  state.portMasteryBatch = batchIdx;
  state.portMasteryPorts = shuffle(batches[batchIdx]);
  state.portRecallIdx = 0;
  state.portRecallScore = 0;
  state.portRecallWrong = [];
  state.portRecallAnswered = false;
  renderPortRecall();
}

function renderPortRecall() {
  const ports = state.portMasteryPorts;
  const idx = state.portRecallIdx;
  const app = document.getElementById('app');

  if (idx >= ports.length) {
    renderPortRecallResults();
    return;
  }

  const p = ports[idx];
  html = `
    <div class="quiz-header">
      <button onclick="showPortMastery()" class="btn btn-back">&larr; Back</button>
      <span class="quiz-title">RECALL - Batch ${state.portMasteryBatch + 1}</span>
      <span class="quiz-score">${state.portRecallScore}/${idx}</span>
    </div>
    <div class="quiz-progress">
      <div class="quiz-progress-bar" style="width:${(idx / ports.length) * 100}%"></div>
    </div>

    <div class="quiz-card">
      <div class="recall-q">What port is <strong>${p.service}</strong>?</div>
      <div class="recall-hint">${p.proto} | ${p.notes}</div>`;

  if (!state.portRecallAnswered) {
    html += `
      <div class="recall-input-row">
        <input type="number" id="port-answer" class="recall-input" placeholder="Type port number..." autofocus
          inputmode="numeric" pattern="[0-9]*"
          onkeydown="if(event.key==='Enter')checkPortAnswer()">
        <button onclick="checkPortAnswer()" class="btn btn-next" style="width:auto;padding:12px 20px;margin-top:0">Check</button>
      </div>`;
  } else {
    const correct = state.portRecallLastCorrect;
    html += `
      <div class="recall-result ${correct ? 'recall-correct' : 'recall-wrong'}">
        <div class="recall-result-icon">${correct ? 'CORRECT!' : 'WRONG'}</div>
        <div class="recall-result-answer">Port <strong>${p.port}</strong></div>
        ${!correct ? `<div class="recall-result-yours">You typed: ${state.portRecallLastAnswer}</div>` : ''}
      </div>
      <button onclick="nextPortRecall()" class="btn btn-next">Next &rarr;</button>`;
  }

  html += `</div>`;
  app.innerHTML = html;

  if (!state.portRecallAnswered) {
    setTimeout(() => {
      const input = document.getElementById('port-answer');
      if (input) input.focus();
    }, 100);
  }
}

function checkPortAnswer() {
  const input = document.getElementById('port-answer');
  if (!input) return;
  const answer = input.value.trim();
  if (!answer) return;

  const p = state.portMasteryPorts[state.portRecallIdx];
  const correct = answer === p.port;
  state.portRecallAnswered = true;
  state.portRecallLastCorrect = correct;
  state.portRecallLastAnswer = answer;

  if (correct) {
    state.portRecallScore++;
    state.stats.correct++;
  } else {
    state.portRecallWrong.push(p);
    state.stats.wrong++;
  }
  saveProgress();
  renderPortRecall();
}

function nextPortRecall() {
  state.portRecallIdx++;
  state.portRecallAnswered = false;
  renderPortRecall();
}

function renderPortRecallResults() {
  state.mode = 'portrecallresults';
  const total = state.portMasteryPorts.length;
  const perfect = state.portRecallScore === total;
  const app = document.getElementById('app');

  if (perfect) {
    state.progress[`portbatch_${state.portMasteryBatch}`] = true;
    saveProgress();
  }

  let html = `
    <div class="results-card">
      <div class="results-score ${perfect ? 'perfect' : 'retry'}">
        <h1>${state.portRecallScore}/${total}</h1>
        <p>${perfect ? 'BATCH MASTERED! Ports memorized!' : 'Not quite - review and try again!'}</p>
      </div>`;

  if (state.portRecallWrong.length > 0) {
    html += `<div class="wrong-review"><h3>Review these ports:</h3>`;
    state.portRecallWrong.forEach(p => {
      html += `
        <div class="wrong-item">
          <div class="wrong-q">${p.service} (${p.proto})</div>
          <div class="wrong-a">Port ${p.port} - ${p.notes}</div>
        </div>`;
    });
    html += `</div>`;
  }

  const batchIdx = state.portMasteryBatch;
  html += `
      <div class="results-buttons">
        <button onclick="startPortLearn(${batchIdx})" class="btn btn-retry">Study Again</button>
        ${!perfect ? `<button onclick="startPortRecall(${batchIdx})" class="btn btn-next" style="margin-top:8px">Retry Test</button>` : ''}
        ${perfect && batchIdx < getPortBatches().length - 1 ? `<button onclick="startPortLearn(${batchIdx + 1})" class="btn btn-next-batch">Next Batch &rarr;</button>` : ''}
        <button onclick="showPortMastery()" class="btn btn-menu">Port Mastery Menu</button>
      </div>
    </div>`;

  app.innerHTML = html;
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

// Keyboard navigation — works across ALL modes
document.addEventListener('keydown', (e) => {
  // Don't hijack keys when typing in an input
  const tag = e.target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA') {
    // In port recall input, Enter submits or advances
    if (e.key === 'Enter' && state.mode === 'portrecall') {
      e.preventDefault();
      if (state.portRecallAnswered) nextPortRecall();
      else checkPortAnswer();
    }
    return;
  }

  const key = e.key;

  // === GLOBAL: Escape goes back / to menu ===
  if (key === 'Escape') {
    e.preventDefault();
    if (state.mode === 'portlearn' || state.mode === 'portrecall' || state.mode === 'portrecallresults') {
      showPortMastery();
    } else if (state.mode !== 'menu') {
      goMenu();
    }
    return;
  }

  // === MENU MODE ===
  if (state.mode === 'menu') {
    if (key === '1') showPortMastery();
    else if (key === '2') startPortDrill();
    else if (key === '3') startRandomMix();
    else if (key === '4') startWeakAreas();
    else if (key === '5') showAllReferences();
    return;
  }

  // === QUIZ & PORT DRILL (MCQ modes) ===
  if (state.mode === 'quiz' || state.mode === 'portdrill') {
    if (!state.answered) {
      const num = parseInt(key);
      if (num >= 1 && num <= 4) {
        if (state.mode === 'portdrill') selectPortOption(num - 1);
        else selectOption(num - 1);
      }
    } else {
      if (key === 'Enter' || key === ' ' || key === 'ArrowRight') {
        e.preventDefault();
        nextQuestion();
      }
    }
    return;
  }

  // === PORT MASTERY — batch selection ===
  if (state.mode === 'portmastery') {
    const num = parseInt(key);
    const batches = getPortBatches();
    if (num >= 1 && num <= 9 && num <= batches.length && isPortBatchUnlocked(num - 1)) {
      startPortLearn(num - 1);
    }
    return;
  }

  // === PORT LEARN — flashcards ===
  if (state.mode === 'portlearn') {
    if (key === ' ' || key === 'Enter' || key === 'f') {
      e.preventDefault();
      const card = document.querySelector('.flash-card');
      if (card) card.classList.toggle('flipped');
    } else if (key === 'ArrowLeft' && state.portLearnIdx > 0) {
      e.preventDefault();
      state.portLearnIdx--;
      renderPortLearn();
    } else if (key === 'ArrowRight') {
      e.preventDefault();
      if (state.portLearnIdx < state.portMasteryPorts.length - 1) {
        state.portLearnIdx++;
        renderPortLearn();
      } else {
        startPortRecall(state.portMasteryBatch);
      }
    }
    return;
  }

  // === PORT RECALL — type-the-answer ===
  if (state.mode === 'portrecall') {
    if (state.portRecallAnswered) {
      if (key === 'Enter' || key === ' ' || key === 'ArrowRight') {
        e.preventDefault();
        nextPortRecall();
      }
    } else {
      // Focus the input if user starts typing a number
      const input = document.getElementById('port-answer');
      if (input && /^[0-9]$/.test(key)) {
        input.focus();
      }
    }
    return;
  }

  // === RESULTS SCREENS ===
  if (state.mode === 'results' || state.mode === 'portrecallresults') {
    if (key === 'Enter' || key === ' ') {
      e.preventDefault();
      // Click the first prominent button (retry / next batch / menu)
      const btn = document.querySelector('.results-buttons .btn');
      if (btn) btn.click();
    }
    return;
  }

  // === REFERENCE SHEETS ===
  if (state.mode === 'allref') {
    if (key === '1') smoothJump('ref-ports');
    else if (key === '2') smoothJump('ref-crypto');
    else if (key === '3') smoothJump('ref-net');
    else if (key === '4') smoothJump('ref-linux');
    else if (key === '5') smoothJump('ref-events');
    else if (key === '6') smoothJump('ref-iis');
    return;
  }
});

// Init
renderMenu();

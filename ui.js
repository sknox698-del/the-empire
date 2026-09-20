// ============================================================
// THE EMPIRE — UI Controller
// Screen management, navigation, and rendering
// ============================================================

class EmpireUI {
  constructor(engine) {
    this.engine = engine;
    this.currentScreen = 'dashboard';
    this.screenHistory = [];
    this.selectedNeighborhood = null;
    this.selectedLocation = null;
    this.selectedCharacter = null;
    this.selectedBusiness = null;
    this.modalStack = [];
    this.previousCash = null;
    this.guidedTutorialStep = 0;
    this.guidedTutorialOverlay = null;
    this.guidedTutorialTarget = null;
  }

  init() {
    this.showScreen('dashboard');
    this.bindNavigation();
    this.startAutoSave();
    const state = this.engine.getState();
    const isFreshStart = state.day === 1 && state.totalEarned === 0 && state.businesses.length === 0;
    if (isFreshStart && !state.tutorialCompleted.guided_tour) {
      setTimeout(() => this.startGuidedTutorial(), 650);
    }
  }

  // ── Navigation ──────────────────────────────────
  bindNavigation() {
    document.querySelectorAll('.nav-item').forEach(item => {
      item.addEventListener('click', () => {
        const screen = item.dataset.screen;
        this.showScreen(screen);
      });
    });

    document.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape') return;
      if (this.guidedTutorialOverlay) this.finishGuidedTutorial(false);
      else if (this.modalStack.length > 0) this.closeModal();
      else if (this.screenHistory.length > 0) this.goBack();
    });
  }

  showScreen(screenId, params) {
    const container = document.getElementById('screen-content');
    if (container.hasChildNodes() && this.currentScreen && this.currentScreen !== screenId) {
      this.screenHistory.push(this.currentScreen);
    }
    this.currentScreen = screenId;
    this.renderScreen(screenId, params);
    this.updateResourceBar();
    this.updateNavHighlight();
  }

  goBack() {
    if (this.screenHistory.length > 0) {
      const prev = this.screenHistory.pop();
      this.currentScreen = prev;
      this.renderScreen(prev);
      this.updateResourceBar();
      this.updateNavHighlight();
    } else {
      this.showScreen('dashboard');
    }
  }

  updateNavHighlight() {
    const navParents = {
      location: 'map', conversation: 'map', characters: 'map',
      'business-detail': 'business', employees: 'business', finances: 'business',
      properties: 'business', loans: 'business', rivals: 'business',
      mystery: 'investigation'
    };
    const activeScreen = navParents[this.currentScreen] || this.currentScreen;
    document.querySelectorAll('.nav-item').forEach(item => {
      const active = item.dataset.screen === activeScreen;
      item.classList.toggle('active', active);
      if (active) item.setAttribute('aria-current', 'page');
      else item.removeAttribute('aria-current');
    });
  }

  updateResourceBar() {
    const s = this.engine.getState();
    document.getElementById('res-cash').textContent = `€${s.cash}`;
    document.getElementById('res-energy').textContent = `${s.energy}/${s.maxEnergy}`;
    document.getElementById('res-rep').textContent = s.reputation;
    document.getElementById('res-day').textContent = `D${s.day}`;
    
    // Pulse only when cash actually changes.
    const cashEl = document.getElementById('res-cash');
    if (this.previousCash !== null && this.previousCash !== s.cash) {
      cashEl.classList.remove('cash-pop');
      void cashEl.offsetWidth;
      cashEl.classList.add('cash-pop');
    }
    this.previousCash = s.cash;
  }

  // ── Screen Rendering ────────────────────────────
  renderScreen(screenId, params) {
    const container = document.getElementById('screen-content');
    container.className = 'screen screen-enter';
    
    switch (screenId) {
      case 'dashboard': this.renderDashboard(container); break;
      case 'map': this.renderMap(container); break;
      case 'business': this.renderBusiness(container, params); break;
      case 'characters': this.renderCharacters(container); break;
      case 'investigation': this.renderInvestigation(container); break;
      case 'finances': this.renderFinances(container); break;
      case 'news': this.renderNews(container); break;
      case 'settings': this.renderSettings(container); break;
      case 'location': this.renderLocation(container, params); break;
      case 'conversation': this.renderConversation(container, params); break;
      case 'business-detail': this.renderBusinessDetail(container, params); break;
      case 'employees': this.renderEmployees(container); break;
      case 'properties': this.renderProperties(container); break;
      case 'loans': this.renderLoans(container); break;
      case 'mystery': this.renderMystery(container); break;
      case 'rivals': this.renderRivals(container); break;
      default: container.innerHTML = `<div class="empty-state"><div class="empty-state-icon">🏗️</div><div class="empty-state-text">Coming soon...</div></div>`;
    }

    container.scrollTop = 0;
  }

  // ── Dashboard ──────────────────────────────────
  renderDashboard(container) {
    const s = this.engine.getState();
    const stage = this.engine.getProgressionStage();
    const summary = this.engine.getDailySummary();
    const timeSlot = GAME_DATA.timeSlotNames[s.timeSlot];
    const tutorial = this.engine.getTutorial();
    
    const timeLabels = ['Morning', 'Midday', 'Afternoon', 'Evening'];
    const progressSteps = timeLabels.map((label, index) =>
      `<span class="day-progress-step ${index < s.timeSlot ? 'complete' : index === s.timeSlot ? 'active' : ''}" title="${label}"></span>`
    ).join('');

    let html = `<div class="dashboard-heading">
      <div>
        <div class="dashboard-eyebrow">Your city. Your decisions.</div>
        <h2 class="dashboard-title">Command center</h2>
      </div>
      <div class="dashboard-day"><strong>${s.day}</strong><span>Day</span></div>
    </div>`;
    
    // Tutorial tip
    if (tutorial) {
      html += `<div class="tutorial-tip" role="status">
        <span class="tutorial-tip-icon" aria-hidden="true">◎</span>
        <div class="tutorial-tip-content"><span>City insight</span><p class="tutorial-tip-text">${tutorial.text}</p></div>
        <button type="button" class="tutorial-tip-dismiss" onclick="ui.dismissTutorial()" aria-label="Dismiss city insight">✓</button>
      </div>`;
    }
    
    // Status hero
    html += `<section class="card empire-hero" aria-label="Empire status">
      <div class="hero-topline">
        <span class="hero-stage">Empire stage ${stage}</span>
        <span class="hero-time">${timeSlot}</span>
      </div>
      <div class="hero-title">${s.businesses.length === 0 ? 'Every empire begins with one smart move.' : 'Your influence is taking shape.'}</div>
      <div class="hero-copy">
        ${s.businesses.length === 0 ? 'Explore the Old Market, take your first job, and turn €100 into a city-wide legacy.' : `You command ${s.businesses.length} business${s.businesses.length > 1 ? 'es' : ''} and a team of ${s.employees.length}. Keep the city moving in your favor.`}
      </div>
      <div class="day-progress" role="img" aria-label="Day progress: ${timeSlot}">${progressSteps}</div>
      <div class="day-progress-labels" aria-hidden="true"><span>AM</span><span>Noon</span><span>PM</span><span>Night</span></div>
    </div>`;
    
    // Quick stats
    if (s.businesses.length > 0) {
      html += `<section class="card summary-card" aria-label="Today's financial summary">
        <div class="summary-head">
          <span class="summary-title">Today’s performance</span>
          <span class="summary-profit ${summary.profit < 0 ? 'negative' : ''}">${summary.profit >= 0 ? '+' : '−'}€${Math.abs(summary.profit)}</span>
        </div>
        <div class="summary-grid">
          <div class="summary-stat"><span class="summary-stat-label">Revenue</span><strong class="summary-stat-value text-green">€${summary.revenue}</strong></div>
          <div class="summary-stat"><span class="summary-stat-label">Expenses</span><strong class="summary-stat-value text-red">€${summary.expenses}</strong></div>
          <div class="summary-stat"><span class="summary-stat-label">Loans</span><strong class="summary-stat-value">€${summary.loanPayment || 0}</strong></div>
        </div>
      </section>`;
    }
    
    // Quick actions
    html += `<div class="section-header">Move your empire forward</div>
    <div class="quick-action-grid" data-tutorial-target="actions">
      <button type="button" class="quick-action-card quick-action-primary" onclick="ui.showScreen('map')">
        <span class="quick-action-icon" aria-hidden="true">🗺️</span>
        <span class="quick-action-title">Explore city <span class="quick-action-arrow">→</span></span>
        <span class="quick-action-subtitle">Find work, people, and opportunities</span>
      </button>
      <button type="button" class="quick-action-card" onclick="ui.showScreen('business')">
        <span class="quick-action-icon" aria-hidden="true">💼</span>
        <span class="quick-action-title">${s.businesses.length ? 'Manage' : 'Start'} business <span class="quick-action-arrow">→</span></span>
        <span class="quick-action-subtitle">${s.businesses.length ? `${s.businesses.length} operation${s.businesses.length === 1 ? '' : 's'} active` : 'Turn your cash into an operation'}</span>
      </button>
      <button type="button" class="quick-action-card" onclick="ui.showScreen('finances')">
        <span class="quick-action-icon" aria-hidden="true">📈</span>
        <span class="quick-action-title">Finances <span class="quick-action-arrow">→</span></span>
        <span class="quick-action-subtitle">Track cash flow and net worth</span>
      </button>
      <button type="button" class="quick-action-card" onclick="ui.showScreen('news')">
        <span class="quick-action-icon" aria-hidden="true">◫</span>
        <span class="quick-action-title">City pulse <span class="quick-action-arrow">→</span></span>
        <span class="quick-action-subtitle">See what your choices changed</span>
      </button>`;
    
    if (s.discoveredClues.length > 0) {
      html += `<button type="button" class="quick-action-card" onclick="ui.showScreen('mystery')">
        <span class="quick-action-icon" aria-hidden="true">🔍</span>
        <span class="quick-action-title">Investigation <span class="quick-action-arrow">→</span></span>
        <span class="quick-action-subtitle">${s.discoveredClues.length} clue${s.discoveredClues.length === 1 ? '' : 's'} on the board</span>
      </button>`;
    }
    
    // Rest option
    if (s.energy < s.maxEnergy) {
      html += `<button type="button" class="quick-action-card" onclick="ui.doRest()">
        <span class="quick-action-icon" aria-hidden="true">☕</span>
        <span class="quick-action-title">Take a break <span class="quick-action-arrow">+3</span></span>
        <span class="quick-action-subtitle">Recover energy · uses one time slot</span>
      </button>`;
    }
    
    // End day if evening
    if (s.timeSlot >= 3) {
      html += `<button type="button" class="quick-action-card" onclick="ui.endDay()">
        <span class="quick-action-icon" aria-hidden="true">☾</span>
        <span class="quick-action-title">End day <span class="quick-action-arrow">→</span></span>
        <span class="quick-action-subtitle">Review results and start day ${s.day + 1}</span>
      </button>`;
    }
    
    html += `</div>`;
    
    // Latest news
    if (s.newsFeed.length > 0) {
      html += `<div class="section-header mt-3">Latest city activity</div><section class="card news-panel" aria-label="Latest city activity">`;
      s.newsFeed.slice(0, 3).forEach(news => {
        html += `<div class="news-item">
          <span class="news-day">D${news.day}</span>
          <span class="news-text ${news.text.startsWith('MYSTERY') ? 'important' : ''}">${news.text}</span>
        </div>`;
      });
      html += `</section>`;
    }
    
    container.innerHTML = html;
  }

  // ── City Map ───────────────────────────────────
  renderMap(container) {
    const s = this.engine.getState();
    const currentHood = this.selectedNeighborhood;
    const currentHoodData = GAME_DATA.neighborhoods.find(hood => hood.id === currentHood);
    const timeName = GAME_DATA.timeSlotNames[s.timeSlot] || 'Today';
    const mapPositions = {
      rented_room: { top: '22%', left: '13%' },
      public_market: { top: '39%', left: '21%' },
      corner_cafe: { top: '33%', left: '38%' },
      convenience_shop: { top: '27%', left: '25%' },
      repair_workshop: { top: '20%', left: '43%' },
      city_hall: { top: '22%', left: '73%' },
      locked_tower: { top: '35%', left: '87%' },
      public_park: { top: '57%', left: '45%' },
      property_office: { top: '73%', left: '24%' },
      community_bank: { top: '71%', left: '45%' },
      local_newspaper: { top: '65%', left: '63%' },
      riverside_warehouse: { top: '78%', left: '80%' }
    };

    let html = `<div class="top-bar">
      <button class="top-bar-back" onclick="ui.goBack()">← </button>
      <span class="top-bar-title">City Map</span>
      <span class="map-time-badge">${timeName}</span>
    </div>
    <section class="map-overview" aria-labelledby="map-heading">
      <div>
        <span class="map-eyebrow">Live city overview</span>
        <h2 id="map-heading">Choose where to go</h2>
      </div>
      <span class="map-place-count">${GAME_DATA.locations.length} places</span>
    </section>
    <div class="map-filter-bar" aria-label="Filter city locations">
      <button type="button" class="map-filter ${!currentHood ? 'active' : ''}" aria-pressed="${!currentHood}" onclick="ui.selectNeighborhood(null)">All city</button>`;

    GAME_DATA.neighborhoods.forEach(hood => {
      const unlocked = s.reputation >= hood.unlockReputation;
      html += `<button type="button" class="map-filter ${currentHood === hood.id ? 'active' : ''}" aria-pressed="${currentHood === hood.id}" onclick="ui.selectNeighborhood('${hood.id}')">
        ${!unlocked ? '<span aria-hidden="true">◆</span> ' : ''}${hood.name}
      </button>`;
    });

    html += `</div>
    <div class="map-container">
      <div class="map-inner">
        ${this.renderCityMapArtwork()}
        <div class="map-district-label old-market" aria-hidden="true"><span>Old Market</span><small>Historic quarter</small></div>
        <div class="map-district-label central-square" aria-hidden="true"><span>Central Square</span><small>Civic district</small></div>
        <div class="map-district-label riverside" aria-hidden="true"><span>Riverside</span><small>Harbor district</small></div>
        <div class="map-compass" aria-hidden="true"><span>N</span><i></i></div>`;
    
    // Location pins
    GAME_DATA.locations.forEach(loc => {
      const unlocked = !loc.locked || this.engine.checkCondition(loc.unlockCondition);
      const available = loc.alwaysAvailable || (loc.availableTimeSlots && loc.availableTimeSlots.includes(s.timeSlot));
      const pos = mapPositions[loc.id] || { top: '50%', left: '50%' };
      const districtMuted = currentHood && currentHood !== loc.neighborhood;
      const status = !unlocked ? 'locked' : available ? 'open' : 'closed';

      html += `<button type="button" class="map-location-pin ${status} ${districtMuted ? 'district-muted' : ''}" 
        style="top:${pos.top};left:${pos.left}" 
        onclick="ui.selectLocation('${loc.id}')" 
        aria-label="${loc.name}, ${!unlocked ? 'locked' : available ? 'open now' : 'closed now'}"
        title="${loc.name}">
          <span class="map-pin-icon" aria-hidden="true">${loc.icon}</span>
          <span class="map-pin-label">${loc.name}</span>
        </button>`;
    });
    
    html += `</div></div>
    <div class="map-legend" aria-label="Map legend">
      <span><i class="legend-dot open"></i> Open</span>
      <span><i class="legend-dot closed"></i> Closed</span>
      <span><i class="legend-dot locked"></i> Locked</span>
      <span class="map-legend-tip">Tap a marker to visit</span>
    </div>
    <div class="section-header mt-2">${currentHoodData ? currentHoodData.name : 'All Locations'} <span class="badge badge-muted">${currentHood ? GAME_DATA.locations.filter(loc => loc.neighborhood === currentHood).length : GAME_DATA.locations.length}</span></div>`;
    
    // Also show as list
    const filteredLocs = currentHood 
      ? GAME_DATA.locations.filter(l => l.neighborhood === currentHood)
      : GAME_DATA.locations;
    
    html += `<div class="location-grid">`;
    filteredLocs.forEach(loc => {
      const unlocked = !loc.locked || this.engine.checkCondition(loc.unlockCondition);
      const available = loc.alwaysAvailable || (loc.availableTimeSlots && loc.availableTimeSlots.includes(s.timeSlot));
      html += `<button type="button" class="location-tile ${unlocked ? '' : 'locked'} ${available ? '' : 'closed'}" 
        onclick="ui.selectLocation('${loc.id}')">
        <div class="location-tile-icon">${loc.icon}</div>
        <div class="location-tile-name">${loc.name}</div>
        <div class="location-tile-status">${!unlocked ? '🔒' : available ? 'Open' : 'Closed'}</div>
      </button>`;
    });
    html += `</div>`;
    
    container.innerHTML = html;
  }

  renderCityMapArtwork() {
    return `<svg class="city-map-art" viewBox="0 0 720 900" preserveAspectRatio="none" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="mapLand" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#29333a"/>
          <stop offset="0.52" stop-color="#222d34"/>
          <stop offset="1" stop-color="#1a252d"/>
        </linearGradient>
        <linearGradient id="mapWater" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stop-color="#21475a"/>
          <stop offset="0.5" stop-color="#2c6579"/>
          <stop offset="1" stop-color="#183e52"/>
        </linearGradient>
        <linearGradient id="mapPark" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#355b46"/>
          <stop offset="1" stop-color="#254537"/>
        </linearGradient>
        <filter id="mapShadow" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="5" stdDeviation="4" flood-color="#061017" flood-opacity=".45"/>
        </filter>
        <pattern id="mapWindows" width="13" height="13" patternUnits="userSpaceOnUse">
          <rect width="13" height="13" fill="#65727a"/>
          <rect x="3" y="3" width="4" height="4" rx="1" fill="#d6c78d" opacity=".55"/>
        </pattern>
      </defs>

      <rect width="720" height="900" fill="url(#mapLand)"/>
      <path class="district-wash market" d="M0 0H382L362 478 0 520Z"/>
      <path class="district-wash center" d="M382 0H720V515L526 527 362 478Z"/>
      <path class="district-wash harbor" d="M0 520L362 478 526 527 720 515V900H0Z"/>

      <!-- Blocks and courtyards -->
      <g class="city-blocks">
        <path d="M22 35H150L144 126H22Z"/><path d="M174 35H305L302 128H166Z"/>
        <path d="M22 153H130L128 254H22Z"/><path d="M151 151H290L286 255H148Z"/>
        <path d="M22 282H125L122 398H22Z"/><path d="M148 281H282L276 403H142Z"/>
        <path d="M416 28H520L520 132H414Z"/><path d="M548 27H696V132H548Z"/>
        <path d="M415 157H526V262H411Z"/><path d="M554 157H697V263H554Z"/>
        <path d="M415 292H525L527 420H409Z"/><path d="M555 291H698V421H557Z"/>
        <path d="M25 634H143V742H21Z"/><path d="M169 629H291L296 740H170Z"/>
        <path d="M24 770H142V872H22Z"/><path d="M170 765H302V874H171Z"/>
        <path d="M414 628H533V741H411Z"/><path d="M560 623H696V742H559Z"/>
        <path d="M416 769H534V874H414Z"/><path d="M561 770H697V875H561Z"/>
      </g>

      <!-- Streets -->
      <g class="roads">
        <path class="road-edge" d="M338 -20C354 151 318 302 347 474S383 748 374 930"/>
        <path class="road-main" d="M338 -20C354 151 318 302 347 474S383 748 374 930"/>
        <path class="road-line" d="M338 -20C354 151 318 302 347 474S383 748 374 930"/>
        <path class="road-edge" d="M-25 443C148 424 230 447 347 474S561 451 750 477"/>
        <path class="road-main" d="M-25 443C148 424 230 447 347 474S561 451 750 477"/>
        <path class="road-line" d="M-25 443C148 424 230 447 347 474S561 451 750 477"/>
        <path class="road-secondary" d="M154 -10L134 431M305 0L286 438M530 0L529 449M0 139L326 141M0 268L320 269M397 143L720 143M397 276L720 276M397 426L720 431"/>
        <path class="road-secondary" d="M150 611L153 900M307 590L311 900M544 594L548 900M0 754L335 753M394 755L720 755M0 612L330 587M397 588L720 594"/>
      </g>

      <!-- River and bridges -->
      <path class="river-bank" d="M-30 530C116 481 226 586 350 552S548 506 750 572"/>
      <path class="river" d="M-30 530C116 481 226 586 350 552S548 506 750 572"/>
      <path class="river-glint" d="M-30 514C116 478 228 567 350 537S550 494 750 557"/>
      <g class="bridges">
        <rect x="324" y="506" width="62" height="97" rx="6" transform="rotate(-7 355 554)"/>
        <rect x="590" y="510" width="58" height="92" rx="6" transform="rotate(14 619 556)"/>
      </g>

      <!-- Old Market houses and shops -->
      <g class="houses" filter="url(#mapShadow)">
        <g transform="translate(43 62)"><rect width="70" height="50" rx="4"/><path d="M-5 12L35-10 75 12Z"/></g>
        <g transform="translate(186 62)"><rect width="88" height="50" rx="4"/><path d="M-6 12L44-12 94 12Z"/></g>
        <g transform="translate(42 174)"><rect width="58" height="58" rx="4"/><path d="M-5 13L29-10 63 13Z"/></g>
        <g transform="translate(174 175)"><rect width="91" height="58" rx="4"/><path d="M-6 13L45-11 97 13Z"/></g>
        <g transform="translate(39 304)"><rect width="66" height="68" rx="4"/><path d="M-5 14L33-11 71 14Z"/></g>
        <g transform="translate(167 307)"><rect width="84" height="64" rx="4"/><path d="M-5 14L42-11 89 14Z"/></g>
      </g>
      <g class="market-stalls">
        <rect x="105" y="333" width="22" height="16" rx="2"/><rect x="129" y="347" width="22" height="16" rx="2"/>
        <rect x="155" y="331" width="22" height="16" rx="2"/><rect x="181" y="346" width="22" height="16" rx="2"/>
        <path d="M102 333h28l-5-9h-18zM126 347h28l-5-9h-18zM152 331h28l-5-9h-18zM178 346h28l-5-9h-18z"/>
      </g>

      <!-- Central Square offices -->
      <g class="commercial-buildings" filter="url(#mapShadow)">
        <rect x="432" y="50" width="69" height="66" rx="4"/>
        <rect x="567" y="48" width="104" height="67" rx="5"/>
        <rect x="433" y="177" width="73" height="68" rx="4"/>
        <rect x="575" y="174" width="91" height="72" rx="4"/>
        <rect x="431" y="311" width="76" height="86" rx="4"/>
        <rect x="577" y="307" width="92" height="94" rx="5"/>
      </g>
      <g class="civic-plaza">
        <circle cx="528" cy="279" r="45"/>
        <circle cx="528" cy="279" r="18"/>
        <path d="M528 245v68M494 279h68"/>
      </g>
      <g class="tower" filter="url(#mapShadow)">
        <rect x="633" y="268" width="48" height="126" rx="4" fill="url(#mapWindows)"/>
        <path d="M627 275L657 246 687 275Z"/>
      </g>

      <!-- Riverside park, homes, and harbor -->
      <g class="park">
        <path d="M255 576C288 548 339 563 369 586S398 650 370 684 292 702 256 674 224 604 255 576Z" fill="url(#mapPark)"/>
        <path d="M250 642C292 622 326 637 379 594M309 565C315 608 326 651 356 685"/>
        <g class="trees"><circle cx="270" cy="602" r="9"/><circle cx="292" cy="663" r="10"/><circle cx="343" cy="590" r="11"/><circle cx="367" cy="649" r="9"/><circle cx="326" cy="623" r="8"/></g>
      </g>
      <g class="riverside-homes" filter="url(#mapShadow)">
        <g transform="translate(44 655)"><rect width="74" height="55" rx="4"/><path d="M-5 13L37-9 79 13Z"/></g>
        <g transform="translate(190 651)"><rect width="75" height="55" rx="4"/><path d="M-5 13L37-9 80 13Z"/></g>
        <g transform="translate(45 793)"><rect width="70" height="55" rx="4"/><path d="M-5 13L35-9 75 13Z"/></g>
        <g transform="translate(194 791)"><rect width="76" height="57" rx="4"/><path d="M-5 13L38-9 81 13Z"/></g>
      </g>
      <g class="harbor-buildings" filter="url(#mapShadow)">
        <rect x="435" y="650" width="73" height="67" rx="4"/>
        <rect x="580" y="643" width="92" height="75" rx="4"/>
        <rect x="437" y="790" width="73" height="64" rx="4"/>
        <path d="M577 791H673V852H577Z"/><path d="M574 791l25-22 22 22 25-22 30 22z"/>
      </g>
      <g class="docks">
        <path d="M516 595v41M548 591v45M580 590v48M612 593v49M644 599v44"/>
        <path d="M503 618h157"/>
      </g>

      <!-- Street furniture and trees -->
      <g class="street-trees">
        <circle cx="120" cy="135" r="7"/><circle cx="276" cy="136" r="7"/><circle cx="403" cy="134" r="7"/>
        <circle cx="536" cy="134" r="7"/><circle cx="118" cy="269" r="7"/><circle cx="407" cy="276" r="7"/>
        <circle cx="131" cy="750" r="7"/><circle cx="398" cy="748" r="7"/><circle cx="548" cy="748" r="7"/>
      </g>
    </svg>`;
  }

  getLocationNeighborhood(loc) {
    return loc.neighborhood;
  }

  selectNeighborhood(hoodId) {
    this.selectedNeighborhood = hoodId;
    this.renderScreen('map');
  }

  selectLocation(locId) {
    const loc = GAME_DATA.locations.find(l => l.id === locId);
    if (!loc) return;
    if (loc.locked && !this.engine.checkCondition(loc.unlockCondition)) {
      this.showToast('This location is locked.');
      return;
    }
    this.selectedLocation = locId;
    this.engine.triggerTutorial('first_visit');
    this.showScreen('location', { locationId: locId });
  }

  // ── Location Screen ─────────────────────────────
  renderLocation(container, params) {
    const locId = (params && params.locationId) || this.selectedLocation;
    const loc = GAME_DATA.locations.find(l => l.id === locId);
    const s = this.engine.getState();
    if (!loc) { container.innerHTML = 'Location not found'; return; }
    
    const hood = GAME_DATA.neighborhoods.find(n => n.id === loc.neighborhood);
    const available = loc.alwaysAvailable || (loc.availableTimeSlots && loc.availableTimeSlots.includes(s.timeSlot));
    
    let html = `<div class="top-bar">
      <button class="top-bar-back" onclick="ui.goBack()">←</button>
      <span class="top-bar-title">${loc.icon} ${loc.name}</span>
      <span class="badge ${hood ? 'badge-' + this.getHoodColor(hood.id) : 'badge-muted'}">${hood ? hood.name : ''}</span>
    </div>
    
    <div class="card">
      <div class="card-body">${loc.description}</div>
      ${!available ? '<div class="badge badge-muted mt-2" style="display:block">Closed at this time</div>' : ''}
    </div>`;
    
    // Actions available at this location
    if (available) {
      html += `<div class="section-header">Available Actions</div><div class="scroll-list">`;
      
      loc.actions.forEach(action => {
        html += this.renderLocationAction(action, loc);
      });
      
      // Characters present
      if (loc.characters && loc.characters.length > 0) {
        html += `<div class="section-header mt-3">People Here</div><div class="scroll-list">`;
        loc.characters.forEach(charId => {
          const char = GAME_DATA.characters.find(c => c.id === charId);
          if (char) {
            const rel = s.characterRelationships[charId] || 0;
            const trust = s.characterTrust[charId] || 0;
            html += `<div class="card card-tappable" onclick="ui.startConversation('${charId}')">
              <div class="card-header">
                <div class="portrait">${char.portrait}</div>
                <div>
                  <div class="card-title">${char.name}</div>
                  <div class="card-subtitle">${char.role}</div>
                  <div class="relationship-bar mt-1">
                    <span class="relationship-label">Relationship</span>
                    <span class="relationship-value ${rel >= 10 ? 'positive' : rel <= -10 ? 'negative' : 'neutral'}">${rel > 0 ? '+' : ''}${rel}</span>
                  </div>
                </div>
              </div>
            </div>`;
          }
        });
        html += `</div>`;
      }
      
      html += `</div>`;
    }
    
    container.innerHTML = html;
  }

  renderLocationAction(action, loc) {
    const s = this.engine.getState();
    
    switch (action) {
      case 'temp_job':
        const jobs = GAME_DATA.tempJobs.filter(j => 
          j.location === loc.id && j.timeSlots.includes(s.timeSlot)
        );
        return jobs.map(j => `<div class="card card-tappable" onclick="ui.doTempJob('${j.id}')">
          <div class="card-header">
            <div class="card-icon">👷</div>
            <div>
              <div class="card-title">${j.name}</div>
              <div class="card-subtitle">€${j.pay} · ${j.energyCost} energy · ${j.description}</div>
            </div>
          </div>
        </div>`).join('');
        
      case 'buy_goods':
      case 'sell_goods':
        return `<div class="card card-tappable" onclick="ui.showTradeModal('${loc.id}')">
          <div class="card-header">
            <div class="card-icon">${action === 'buy_goods' ? '📦' : '💰'}</div>
            <div>
              <div class="card-title">${action === 'buy_goods' ? 'Buy Goods' : 'Sell Goods'}</div>
              <div class="card-subtitle">Trade merchandise for profit</div>
            </div>
          </div>
        </div>`;
        
      case 'rest':
        return `<div class="card card-tappable" onclick="ui.doRest()">
          <div class="card-header">
            <div class="card-icon">😴</div>
            <div>
              <div class="card-title">Rest Here</div>
              <div class="card-subtitle">Recover +3 energy</div>
            </div>
          </div>
        </div>`;
        
      case 'investigate':
        return `<div class="card card-tappable" onclick="ui.doInvestigate('${loc.id}')">
          <div class="card-header">
            <div class="card-icon">🔍</div>
            <div>
              <div class="card-title">Investigate</div>
              <div class="card-subtitle">Look for clues (2 energy)</div>
            </div>
          </div>
        </div>`;
        
      case 'investigate_records':
      case 'check_permits':
        return `<div class="card card-tappable" onclick="ui.doInvestigateRecords()">
          <div class="card-header">
            <div class="card-icon">📋</div>
            <div>
              <div class="card-title">Check Records</div>
              <div class="card-subtitle">Search public documents (2 energy)</div>
            </div>
          </div>
        </div>`;
        
      case 'buy_property':
      case 'negotiate_lease':
        return `<div class="card card-tappable" onclick="ui.showScreen('properties')">
          <div class="card-header">
            <div class="card-icon">🏠</div>
            <div>
              <div class="card-title">View Properties</div>
              <div class="card-subtitle">Browse available real estate</div>
            </div>
          </div>
        </div>`;
        
      case 'request_loan':
      case 'repay_loan':
        return `<div class="card card-tappable" onclick="ui.showScreen('loans')">
          <div class="card-header">
            <div class="card-icon">🏦</div>
            <div>
              <div class="card-title">Banking Services</div>
              <div class="card-subtitle">Loans and repayment</div>
            </div>
          </div>
        </div>`;
        
      case 'place_ad':
        return `<div class="card card-tappable" onclick="ui.showScreen('business')">
          <div class="card-header">
            <div class="card-icon">📢</div>
            <div>
              <div class="card-title">Place Advertisement</div>
              <div class="card-subtitle">Boost your business reputation (€15)</div>
            </div>
          </div>
        </div>`;
        
      case 'gather_rumor':
        return `<div class="card card-tappable" onclick="ui.gatherRumor('${loc.id}')">
          <div class="card-header">
            <div class="card-icon">👂</div>
            <div>
              <div class="card-title">Gather Rumors</div>
              <div class="card-subtitle">Listen for useful information (1 energy)</div>
            </div>
          </div>
        </div>`;
        
      case 'hire_employee':
        return `<div class="card card-tappable" onclick="ui.showScreen('employees')">
          <div class="card-header">
            <div class="card-icon">👥</div>
            <div>
              <div class="card-title">Hire Workers</div>
              <div class="card-subtitle">Find employees for your business</div>
            </div>
          </div>
        </div>`;
        
      case 'review_finances':
        return `<div class="card card-tappable" onclick="ui.showScreen('finances')">
          <div class="card-header">
            <div class="card-icon">📊</div>
            <div>
              <div class="card-title">Review Finances</div>
              <div class="card-subtitle">Track income and expenses</div>
            </div>
          </div>
        </div>`;
        
      case 'save_game':
        return `<div class="card card-tappable" onclick="ui.showScreen('settings')">
          <div class="card-header">
            <div class="card-icon">💾</div>
            <div>
              <div class="card-title">Save Game</div>
              <div class="card-subtitle">Save your progress</div>
            </div>
          </div>
        </div>`;
        
      case 'meet_character':
        return ''; // Characters rendered separately
        
      case 'buy_coffee':
        return `<div class="card card-tappable" onclick="ui.buyCoffee()">
          <div class="card-header">
            <div class="card-icon">☕</div>
            <div>
              <div class="card-title">Buy Coffee</div>
              <div class="card-subtitle">€3 · Recover 1 energy</div>
            </div>
          </div>
        </div>`;
        
      default:
        return '';
    }
  }

  getHoodColor(hoodId) {
    const map = { old_market: 'gold', riverside: 'blue', central_square: 'purple' };
    return map[hoodId] || 'muted';
  }

  // ── Conversation ────────────────────────────────
  startConversation(charId) {
    this.selectedCharacter = charId;
    if (this.engine.getState().energy < 1) {
      this.showToast('Not enough energy to talk.');
      return;
    }
    this.engine.spendEnergy(1);
    const result = this.engine.talkToCharacter(charId);
    this.showScreen('conversation', { result });
    this.updateResourceBar();
  }

  renderConversation(container, params) {
    const result = params && params.result;
    const char = GAME_DATA.characters.find(c => c.id === this.selectedCharacter);
    if (!char || !result) { container.innerHTML = 'Error'; return; }
    
    let html = `<div class="top-bar">
      <button class="top-bar-back" onclick="ui.goBack()">←</button>
      <span class="top-bar-title">Conversation</span>
      <span></span>
    </div>
    
    <div class="card" style="text-align:center;padding:20px">
      <div class="portrait-large" style="margin:0 auto 8px">${char.portrait}</div>
      <div class="card-title">${char.name}</div>
      <div class="card-subtitle">${char.role}</div>
      <div class="relationship-bar mt-2" style="justify-content:center">
        <span class="relationship-label">Relationship</span>
        <span class="relationship-value ${result.relationship >= 10 ? 'positive' : result.relationship <= -10 ? 'negative' : 'neutral'}">${result.relationship > 0 ? '+' : ''}${result.relationship}</span>
      </div>
      <div class="relationship-bar" style="justify-content:center">
        <span class="relationship-label">Trust</span>
        <span class="relationship-value ${result.trust >= 10 ? 'positive' : result.trust <= -10 ? 'negative' : 'neutral'}">${result.trust > 0 ? '+' : ''}${result.trust}</span>
      </div>
    </div>
    
    <div class="dialogue-box">
      <div class="dialogue-speaker">${char.name}</div>
      <div class="dialogue-text">"${result.dialogue}"</div>
    </div>`;
    
    // Mystery hint
    if (result.bonusText) {
      html += `<div class="dialogue-box" style="border-color:var(--accent-gold)">
        <div class="dialogue-speaker" style="color:var(--accent-gold)">💡 Hint</div>
        <div class="dialogue-text">"${result.bonusText}"</div>
      </div>`;
    }
    
    // Discovered clues
    if (result.clues && result.clues.length > 0) {
      result.clues.forEach(clueId => {
        const clue = GAME_DATA.mysteryClues.find(c => c.id === clueId);
        if (clue) {
          html += `<div class="clue-card discovered">
            <span class="clue-type ${clue.type}">${clue.type.replace('_', ' ')}</span>
            <div class="card-title mt-1">🔍 ${clue.title}</div>
            <div class="card-body mt-1">${clue.description}</div>
          </div>`;
        }
      });
    }
    
    // Available actions
    if (result.actions && result.actions.length > 0) {
      html += `<div class="section-header mt-2">Actions</div><div class="dialogue-actions">`;
      result.actions.forEach(action => {
        html += this.renderCharacterAction(action, char);
      });
      html += `</div>`;
    }
    
    // Continue / Close
    html += `<div class="mt-3">
      <button class="btn btn-full" onclick="ui.goBack()">Continue</button>
    </div>`;
    
    container.innerHTML = html;
  }

  renderCharacterAction(action, char) {
    switch (action) {
      case 'request_loan':
        return `<button class="btn btn-full" onclick="ui.showScreen('loans')">🏦 Ask about loans</button>`;
      case 'view_properties':
        return `<button class="btn btn-full" onclick="ui.showScreen('properties')">🏠 View available properties</button>`;
      case 'investigate_together':
        return `<button class="btn btn-full btn-primary" onclick="ui.investigateWithNora()">🔍 Investigate together</button>`;
      case 'confront':
        return `<button class="btn btn-full btn-danger" onclick="ui.confrontDimitri()">⚠️ Confront about the scheme</button>`;
      default:
        return `<button class="btn btn-full">${action}</button>`;
    }
  }

  // ── Business Screen ─────────────────────────────
  renderBusiness(container, params) {
    const s = this.engine.getState();
    
    let html = `<div class="top-bar">
      <button class="top-bar-back" onclick="ui.goBack()">←</button>
      <span class="top-bar-title">Business</span>
      <span></span>
    </div>`;
    
    // Open new business
    html += `<div class="section-header">Open a Business</div>
    <div class="scroll-list">`;
    
    GAME_DATA.businesses.forEach(biz => {
      const canOpen = s.cash >= biz.startupCost && (s.devUnlockBusinesses || s.reputation >= (biz.requirements.reputation || 0));
      const alreadyOpen = s.businesses.some(b => b.businessId === biz.id);
      
      html += `<div class="card ${canOpen && !alreadyOpen ? 'card-tappable' : ''}" 
        ${canOpen && !alreadyOpen ? `onclick="ui.openBusinessModal('${biz.id}')"` : ''}>
        <div class="card-header">
          <div class="card-icon">${biz.icon}</div>
          <div>
            <div class="card-title">${biz.name} ${alreadyOpen ? '<span class="badge badge-green">Owned</span>' : ''}</div>
            <div class="card-subtitle">${biz.category} · ${biz.estimatedDailyProfit}</div>
          </div>
        </div>
        <div class="card-body">
          Startup: €${biz.startupCost} · Rent: €${biz.dailyRent}/day · Rep needed: ${biz.requirements.reputation || 0}
        </div>
        ${!canOpen && !alreadyOpen ? '<div class="badge badge-muted mt-1">Cannot open yet</div>' : ''}
      </div>`;
    });
    
    html += `</div>`;
    
    // Active businesses
    if (s.businesses.length > 0) {
      html += `<div class="section-header mt-3">Your Businesses</div>
      <div class="scroll-list">`;
      
      s.businesses.forEach(biz => {
        const data = GAME_DATA.businesses.find(b => b.id === biz.businessId);
        if (!data) return;
        const profit = biz.lastDayProfit || 0;
        
        html += `<div class="card card-tappable" onclick="ui.showScreen('business-detail', {instanceId:'${biz.instanceId}'})">
          <div class="card-header">
            <div class="card-icon">${data.icon}</div>
            <div>
              <div class="card-title">${data.name}</div>
              <div class="card-subtitle">${GAME_DATA.neighborhoods.find(n=>n.id===biz.neighborhood)?.name || biz.neighborhood} · Level ${biz.upgradeLevel + 1}</div>
            </div>
            <span class="badge ${profit >= 0 ? 'badge-green' : 'badge-red'}">€${profit}</span>
          </div>
          <div class="card-body">
            Revenue: €${biz.lastDayRevenue || 0} · Expenses: €${biz.lastDayExpenses || 0} · Days: ${biz.daysOperated || 0}
          </div>
        </div>`;
      });
      
      html += `</div>`;
    }
    
    // Player upgrades
    html += `<div class="section-header mt-3">Skill Upgrades</div>
    <div class="scroll-list">`;
    
    GAME_DATA.upgrades.filter(u => u.businessId === 'player').forEach(upg => {
      const owned = s.playerUpgrades.includes(upg.id);
      html += `<div class="card ${!owned && s.cash >= upg.cost ? 'card-tappable' : ''}" 
        ${!owned && s.cash >= upg.cost ? `onclick="ui.buyPlayerUpgrade('${upg.id}')"` : ''}>
        <div class="card-header">
          <div class="card-icon">⭐</div>
          <div>
            <div class="card-title">${upg.name} ${owned ? '<span class="badge badge-green">Owned</span>' : ''}</div>
            <div class="card-subtitle">${upg.description || ''} · €${upg.cost}</div>
          </div>
        </div>
      </div>`;
    });
    
    html += `</div>`;
    container.innerHTML = html;
  }

  renderBusinessDetail(container, params) {
    const instanceId = params && params.instanceId;
    const s = this.engine.getState();
    const biz = s.businesses.find(b => b.instanceId === instanceId);
    if (!biz) { container.innerHTML = 'Business not found'; return; }
    
    const data = GAME_DATA.businesses.find(b => b.id === biz.businessId);
    
    let html = `<div class="top-bar">
      <button class="top-bar-back" onclick="ui.goBack()">←</button>
      <span class="top-bar-title">${data.icon} ${data.name}</span>
      <span></span>
    </div>
    
    <div class="card">
      <div class="card-header">
        <div class="card-icon">${data.icon}</div>
        <div>
          <div class="card-title">${data.name}</div>
          <div class="card-subtitle">${data.category} · Level ${biz.upgradeLevel + 1}/${data.upgradeLevels}</div>
        </div>
      </div>
      <div class="card-body">
        <div class="finance-row">
          <span class="finance-row-label">Last Revenue</span>
          <span class="finance-row-value positive">€${biz.lastDayRevenue || 0}</span>
        </div>
        <div class="finance-row">
          <span class="finance-row-label">Last Expenses</span>
          <span class="finance-row-value negative">-€${biz.lastDayExpenses || 0}</span>
        </div>
        <div class="finance-row">
          <span class="finance-row-label">Last Profit</span>
          <span class="finance-row-value ${(biz.lastDayProfit||0) >= 0 ? 'positive' : 'negative'}">€${biz.lastDayProfit || 0}</span>
        </div>
        <div class="finance-row">
          <span class="finance-row-label">Total Profit</span>
          <span class="finance-row-value ${(biz.totalProfit||0) >= 0 ? 'positive' : 'negative'}">€${biz.totalProfit || 0}</span>
        </div>
        <div class="finance-row">
          <span class="finance-row-label">Days Open</span>
          <span class="finance-row-value">${biz.daysOperated || 0}</span>
        </div>
      </div>
    </div>`;
    
    // Upgrade button
    if (biz.upgradeLevel < data.upgradeLevels) {
      const nextLevel = biz.upgradeLevel + 1;
      const cost = data.upgradeCosts[nextLevel - 1];
      const upg = GAME_DATA.upgrades.find(u => u.businessId === data.id && u.level === nextLevel);
      const canUpgrade = s.cash >= cost;
      
      html += `<div class="card ${canUpgrade ? 'card-tappable' : ''}" ${canUpgrade ? `onclick="ui.upgradeBusiness('${biz.instanceId}')"` : ''}>
        <div class="card-header">
          <div class="card-icon">⬆️</div>
          <div>
            <div class="card-title">Upgrade to Level ${nextLevel}</div>
            <div class="card-subtitle">${upg ? upg.name : ''} · €${cost}</div>
          </div>
        </div>
        ${!canUpgrade ? '<div class="badge badge-muted mt-1">Not enough cash</div>' : ''}
      </div>`;
    }
    
    // Assigned employees
    const assigned = s.employees.filter(e => e.assignedBusinessId === biz.instanceId);
    html += `<div class="section-header mt-2">Staff (${assigned.length}/${data.employeeSlots})</div>`;
    
    assigned.forEach(emp => {
      html += `<div class="card">
        <div class="card-header">
          <div class="portrait">${emp.portrait}</div>
          <div>
            <div class="card-title">${emp.name}</div>
            <div class="card-subtitle">€${emp.wage}/day · Skill: ${emp.skill} · Morale: ${emp.morale.toFixed(1)}</div>
          </div>
        </div>
      </div>`;
    });
    
    // Assign button
    if (assigned.length < data.employeeSlots && s.employees.some(e => !e.assignedBusinessId)) {
      html += `<button class="btn btn-full mt-2" onclick="ui.showAssignModal('${biz.instanceId}')">Assign Employee</button>`;
    }
    
    // Close business
    html += `<div class="mt-3"><button class="btn btn-full btn-danger" onclick="ui.confirmCloseBusiness('${biz.instanceId}')">Close Business</button></div>`;
    
    container.innerHTML = html;
  }

  // ── Characters Screen ────────────────────────────
  renderCharacters(container) {
    const s = this.engine.getState();
    
    let html = `<div class="top-bar">
      <button class="top-bar-back" onclick="ui.goBack()">←</button>
      <span class="top-bar-title">People</span>
      <span></span>
    </div>
    <div class="section-header">Known Characters</div>
    <div class="scroll-list">`;
    
    GAME_DATA.characters.forEach(char => {
      const rel = s.characterRelationships[char.id] || 0;
      const trust = s.characterTrust[char.id] || 0;
      const relBadge = rel >= 20 ? 'badge-green' : rel >= 0 ? 'badge-muted' : rel >= -15 ? 'badge-gold' : 'badge-red';
      
      html += `<div class="card card-tappable" onclick="ui.showCharacterDetail('${char.id}')">
        <div class="card-header">
          <div class="portrait">${char.portrait}</div>
          <div>
            <div class="card-title">${char.name}</div>
            <div class="card-subtitle">${char.role}</div>
          </div>
          <span class="badge ${relBadge}">${rel > 0 ? '+' : ''}${rel}</span>
        </div>
        <div class="card-body">
          <div class="relationship-bar">
            <span class="relationship-label">Trust</span>
            <span class="relationship-value ${trust >= 10 ? 'positive' : trust <= -5 ? 'negative' : 'neutral'}">${trust > 0 ? '+' : ''}${trust}</span>
          </div>
        </div>
      </div>`;
    });
    
    html += `</div>`;
    container.innerHTML = html;
  }

  showCharacterDetail(charId) {
    const char = GAME_DATA.characters.find(c => c.id === charId);
    const s = this.engine.getState();
    if (!char) return;
    
    const rel = s.characterRelationships[charId] || 0;
    const trust = s.characterTrust[charId] || 0;
    const state = s.characterDialogueState[charId] || 'introduction';
    
    let modalHtml = `<div class="modal-header">
      <span class="modal-title">${char.portrait} ${char.name}</span>
      <button class="modal-close" onclick="ui.closeModal()">✕</button>
    </div>
    <div style="text-align:center;margin-bottom:12px">
      <div class="portrait-large" style="margin:0 auto 8px">${char.portrait}</div>
      <div style="font-size:13px;color:var(--text-secondary)">${char.role} · ${char.personality}</div>
    </div>
    <div class="card">
      <div class="finance-row">
        <span class="finance-row-label">Relationship</span>
        <span class="relationship-value ${rel >= 10 ? 'positive' : rel <= -10 ? 'negative' : 'neutral'}">${rel > 0 ? '+' : ''}${rel}</span>
      </div>
      <div class="finance-row">
        <span class="finance-row-label">Trust</span>
        <span class="relationship-value ${trust >= 10 ? 'positive' : trust <= -5 ? 'negative' : 'neutral'}">${trust > 0 ? '+' : ''}${trust}</span>
      </div>
      <div class="finance-row">
        <span class="finance-row-label">Influence</span>
        <span class="relationship-value">${char.influence}/10</span>
      </div>
    </div>
    <div style="margin-top:10px;font-size:13px;color:var(--text-secondary)">
      <div style="margin-bottom:6px"><strong>Occupation:</strong> ${char.occupation}</div>
      <div style="margin-bottom:6px"><strong>Goal:</strong> ${char.personalGoal}</div>
      <div><strong>Public Info:</strong> ${char.publicInfo}</div>
    </div>
    <div class="mt-3">
      <button class="btn btn-full btn-primary" onclick="ui.closeModal();ui.startConversation('${charId}')">Talk to ${char.name}</button>
    </div>`;
    
    this.showModal(modalHtml);
  }

  // ── Investigation Screen ────────────────────────
  renderInvestigation(container) {
    this.renderMystery(container);
  }

  renderMystery(container) {
    const s = this.engine.getState();
    
    let html = `<div class="top-bar">
      <button class="top-bar-back" onclick="ui.goBack()">←</button>
      <span class="top-bar-title">Investigation</span>
      <span class="badge badge-gold">${s.discoveredClues.length} clues</span>
    </div>
    
    <div class="card">
      <div class="card-header">
        <div class="card-icon">🔍</div>
        <div>
          <div class="card-title">The Riverside Mystery</div>
          <div class="card-subtitle">Businesses are failing. Property values are shifting. Someone is behind this.</div>
        </div>
      </div>
      <div class="card-body">
        ${s.mysteryResolved 
          ? `<span class="badge badge-green">RESOLVED</span> ${s.mysteryResolution}` 
          : `You've found ${s.discoveredClues.length} of ${GAME_DATA.mysteryClues.length} clues.`}
      </div>
    </div>`;
    
    // Clue board
    html += `<div class="section-header">Clue Board</div><div class="scroll-list">`;
    
    GAME_DATA.mysteryClues.forEach(clue => {
      const discovered = s.discoveredClues.includes(clue.id);
      
      html += `<div class="clue-card ${discovered ? 'discovered' : 'undiscovered'}">
        <span class="clue-type ${clue.type}">${clue.type.replace('_', ' ')}</span>
        ${discovered 
          ? `<div class="card-title mt-1">🔍 ${clue.title}</div>
             <div class="card-body mt-1">${clue.description}</div>
             <div class="clue-connections">
               ${clue.connections.map(c => `<div class="clue-connection-dot ${s.discoveredClues.includes(c) ? 'active' : ''}"></div>`).join('')}
             </div>` 
          : `<div class="card-title mt-1">❓ Undiscovered</div>`}
      </div>`;
    });
    
    html += `</div>`;
    
    // Available resolutions
    const resolutions = this.engine.checkMysteryResolutions();
    if (resolutions.length > 0 && !s.mysteryResolved) {
      html += `<div class="section-header mt-3">Possible Resolutions</div>
      <div class="scroll-list">`;
      
      resolutions.forEach(res => {
        html += `<div class="card card-tappable" onclick="ui.confirmMysteryResolution('${res.id}')">
          <div class="card-header">
            <div class="card-icon">⚖️</div>
            <div>
              <div class="card-title">${res.name}</div>
              <div class="card-subtitle">${res.description}</div>
            </div>
          </div>
        </div>`;
      });
      
      html += `</div>`;
    }
    
    container.innerHTML = html;
  }

  // ── Employees Screen ─────────────────────────────
  renderEmployees(container) {
    const s = this.engine.getState();
    
    let html = `<div class="top-bar">
      <button class="top-bar-back" onclick="ui.goBack()">←</button>
      <span class="top-bar-title">Employees</span>
      <span class="badge badge-blue">${s.employees.length}</span>
    </div>`;
    
    // Current employees
    if (s.employees.length > 0) {
      html += `<div class="section-header">Your Team</div><div class="scroll-list">`;
      
      s.employees.forEach(emp => {
        html += `<div class="card">
          <div class="card-header">
            <div class="portrait">${emp.portrait}</div>
            <div>
              <div class="card-title">${emp.name}</div>
              <div class="card-subtitle">${emp.trait} · Best: ${emp.bestRole}</div>
            </div>
          </div>
          <div class="card-body">
            <div class="flex justify-between text-sm">
              <span>Wage: €${emp.wage}/day</span>
              <span>Skill: ${emp.skill}/10</span>
            </div>
            <div class="flex justify-between text-sm mt-1">
              <span>Morale: ${emp.morale.toFixed(1)}/10</span>
              <span>Loyalty: ${emp.loyalty.toFixed(1)}/10</span>
            </div>
            <div class="progress-bar mt-1">
              <div class="progress-fill ${emp.morale >= 5 ? 'green' : 'red'}" style="width:${emp.morale * 10}%"></div>
            </div>
            <div class="text-xs text-muted mt-1">${emp.assignedBusinessId ? 'Assigned to business' : 'Unassigned'}</div>
          </div>
          <div class="card-footer">
            <button class="btn btn-small" onclick="ui.showWageModal('${emp.instanceId}')">Adjust Wage</button>
            <button class="btn btn-small btn-danger" onclick="ui.confirmDismiss('${emp.instanceId}')">Dismiss</button>
          </div>
        </div>`;
      });
      
      html += `</div>`;
    } else {
      html += `<div class="empty-state">
        <div class="empty-state-icon">👥</div>
        <div class="empty-state-text">No employees yet. Hire someone to grow your business.</div>
      </div>`;
    }
    
    // Available candidates
    html += `<div class="section-header mt-3">Available Candidates</div>
    <div class="scroll-list">`;
    
    GAME_DATA.employeeCandidates.filter(c => !s.employees.find(e => e.candidateId === c.id)).forEach(cand => {
      const canHire = s.businesses.length > 0 || true; // Can hire anytime
      html += `<div class="card ${canHire ? 'card-tappable' : ''}" ${canHire ? `onclick="ui.confirmHire('${cand.id}')"` : ''}>
        <div class="card-header">
          <div class="portrait">${cand.portrait}</div>
          <div>
            <div class="card-title">${cand.name}</div>
            <div class="card-subtitle">${cand.trait} · €${cand.wage}/day</div>
          </div>
        </div>
        <div class="card-body">
          <div class="flex justify-between text-sm">
            <span>Skill: ${cand.skill}/10</span>
            <span>Reliability: ${cand.reliability}/10</span>
            <span>Loyalty: ${cand.loyalty}/10</span>
          </div>
          <div class="text-xs text-muted mt-1">${cand.personalConcern}</div>
        </div>
      </div>`;
    });
    
    html += `</div>`;
    container.innerHTML = html;
  }

  // ── Properties Screen ───────────────────────────
  renderProperties(container) {
    const s = this.engine.getState();
    
    let html = `<div class="top-bar">
      <button class="top-bar-back" onclick="ui.goBack()">←</button>
      <span class="top-bar-title">Properties</span>
      <span></span>
    </div>`;
    
    // Owned properties
    if (s.properties.length > 0) {
      html += `<div class="section-header">Owned Properties</div><div class="scroll-list">`;
      s.properties.forEach(p => {
        const data = GAME_DATA.properties.find(x => x.id === p.propertyId);
        if (data) {
          html += `<div class="card">
            <div class="card-header">
              <div class="card-icon">🏠</div>
              <div>
                <div class="card-title">${data.name}</div>
                <div class="card-subtitle">${data.neighborhood} · Bought Day ${p.purchased}</div>
              </div>
            </div>
          </div>`;
        }
      });
      html += `</div>`;
    }
    
    // Available properties
    html += `<div class="section-header">Available</div><div class="scroll-list">`;
    
    GAME_DATA.properties.forEach(prop => {
      const available = !prop.unlockCondition || this.engine.checkCondition(prop.unlockCondition);
      const owned = s.properties.some(p => p.propertyId === prop.id);
      if (owned) return;
      
      const price = Math.max(0, prop.price - (s.propertyDiscount || 0));
      const canBuy = available && s.cash >= price;
      
      html += `<div class="card ${canBuy ? 'card-tappable' : ''}" ${canBuy ? `onclick="ui.confirmBuyProperty('${prop.id}')"` : ''}>
        <div class="card-header">
          <div class="card-icon">🏗️</div>
          <div>
            <div class="card-title">${prop.name}</div>
            <div class="card-subtitle">${prop.neighborhood} · ${prop.type}</div>
          </div>
          <span class="badge ${available ? 'badge-gold' : 'badge-muted'}">€${price}</span>
        </div>
        <div class="card-body">${prop.description}</div>
        ${!available ? '<div class="badge badge-muted mt-1">Locked</div>' : ''}
      </div>`;
    });
    
    html += `</div>`;
    container.innerHTML = html;
  }

  // ── Loans Screen ────────────────────────────────
  renderLoans(container) {
    const s = this.engine.getState();
    
    let html = `<div class="top-bar">
      <button class="top-bar-back" onclick="ui.goBack()">←</button>
      <span class="top-bar-title">Banking</span>
      <span></span>
    </div>`;
    
    // Active loans
    if (s.loans.length > 0) {
      html += `<div class="section-header">Active Loans</div>`;
      s.loans.forEach(loan => {
        const remaining = loan.remainingBalance ?? Math.ceil(loan.totalRepayment * (loan.daysRemaining / loan.termDays));
        html += `<div class="card">
          <div class="card-header">
            <div class="card-icon">🏦</div>
            <div>
              <div class="card-title">${loan.name}</div>
              <div class="card-subtitle">Daily: €${loan.dailyPayment} · ${loan.daysRemaining} days remaining</div>
            </div>
          </div>
          <div class="card-body">
            <div class="finance-row">
              <span class="finance-row-label">Borrowed</span>
              <span class="finance-row-value">€${loan.amount}</span>
            </div>
            <div class="finance-row">
              <span class="finance-row-label">Total Repayment</span>
              <span class="finance-row-value negative">€${loan.totalRepayment}</span>
            </div>
            <div class="finance-row">
              <span class="finance-row-label">Early Repayment</span>
              <span class="finance-row-value">€${remaining}</span>
            </div>
          </div>
          <div class="card-footer">
            <button class="btn btn-small btn-primary" onclick="ui.confirmRepayLoan()" ${s.cash < remaining ? 'disabled' : ''}>Repay Early</button>
          </div>
        </div>`;
      });
    }
    
    // Available loans
    html += `<div class="section-header">Loan Offers</div><div class="scroll-list">`;
    
    GAME_DATA.loanOffers.forEach(offer => {
      const canBorrow = s.reputation >= offer.minReputation && 
        (s.characterRelationships['james_chen'] || 0) >= offer.minRelationship &&
        s.loans.length === 0;
      
      html += `<div class="card ${canBorrow ? 'card-tappable' : ''}" ${canBorrow ? `onclick="ui.confirmLoan('${offer.id}')"` : ''}>
        <div class="card-header">
          <div class="card-icon">💰</div>
          <div>
            <div class="card-title">${offer.name}</div>
            <div class="card-subtitle">${(offer.interestRate * 100).toFixed(0)}% interest · ${offer.termDays} days</div>
          </div>
          <span class="badge badge-gold">€${offer.amount}</span>
        </div>
        <div class="card-body">
          Total repayment: €${Math.ceil(offer.amount * (1 + offer.interestRate))}
          · Min rep: ${offer.minReputation} · Min relationship: ${offer.minRelationship}
        </div>
        ${!canBorrow ? '<div class="badge badge-muted mt-1">Cannot apply</div>' : ''}
      </div>`;
    });
    
    html += `</div>`;
    container.innerHTML = html;
  }

  // ── Finances Screen ─────────────────────────────
  renderFinances(container) {
    const s = this.engine.getState();
    const summary = this.engine.getDailySummary();
    
    let html = `<div class="top-bar">
      <button class="top-bar-back" onclick="ui.goBack()">←</button>
      <span class="top-bar-title">Finances</span>
      <span></span>
    </div>
    
    <div class="card">
      <div class="card-header">
        <div class="card-icon">💶</div>
        <div>
          <div class="card-title">Cash: €${s.cash}</div>
          <div class="card-subtitle">Day ${s.day}</div>
        </div>
      </div>
      <div class="card-body">
        <div class="finance-row">
          <span class="finance-row-label">Total Earned</span>
          <span class="finance-row-value positive">€${s.totalEarned}</span>
        </div>
        <div class="finance-row">
          <span class="finance-row-label">Total Spent</span>
          <span class="finance-row-value negative">€${s.totalSpent}</span>
        </div>
        <div class="finance-row">
          <span class="finance-row-label">Net Position</span>
          <span class="finance-row-value ${(s.totalEarned - s.totalSpent) >= 0 ? 'positive' : 'negative'}">€${s.totalEarned - s.totalSpent}</span>
        </div>
      </div>
    </div>
    
    <div class="card">
      <div class="section-header">Daily Breakdown</div>
      <div class="finance-row">
        <span class="finance-row-label">Business Revenue</span>
        <span class="finance-row-value ${summary.revenue > 0 ? 'positive' : ''}">€${summary.revenue}</span>
      </div>
      <div class="finance-row">
        <span class="finance-row-label">Business Expenses</span>
        <span class="finance-row-value negative">-€${summary.expenses}</span>
      </div>
      <div class="finance-row">
        <span class="finance-row-label">Employee Wages</span>
        <span class="finance-row-value negative">-€${summary.wages}</span>
      </div>
      ${s.loans.length > 0 ? `<div class="finance-row">
        <span class="finance-row-label">Loan Payment</span>
        <span class="finance-row-value negative">-€${summary.loanPayment}</span>
      </div>` : ''}
    </div>
    
    <div class="card">
      <div class="section-header">Stats</div>
      <div class="finance-row">
        <span class="finance-row-label">Days Worked</span>
        <span class="finance-row-value">${s.totalDaysWorked}</span>
      </div>
      <div class="finance-row">
        <span class="finance-row-label">Businesses Opened</span>
        <span class="finance-row-value">${s.businessesOpened}</span>
      </div>
      <div class="finance-row">
        <span class="finance-row-label">Employees Hired</span>
        <span class="finance-row-value">${s.employeesHired}</span>
      </div>
      <div class="finance-row">
        <span class="finance-row-label">Properties Bought</span>
        <span class="finance-row-value">${s.propertiesBought}</span>
      </div>
    </div>`;
    
    // Inventory
    if (s.inventory.length > 0) {
      html += `<div class="section-header mt-3">Inventory</div><div class="scroll-list">`;
      s.inventory.forEach(inv => {
        const good = GAME_DATA.goods.find(g => g.id === inv.goodId);
        if (good) {
          html += `<div class="card">
            <div class="card-header">
              <div class="card-icon">📦</div>
              <div>
                <div class="card-title">${good.name}</div>
                <div class="card-subtitle">Quantity: ${inv.quantity} · Bought at €${inv.buyPrice}</div>
              </div>
              <span class="badge badge-green">€${good.sellPrice}</span>
            </div>
          </div>`;
        }
      });
      html += `</div>`;
    }
    
    container.innerHTML = html;
  }

  // ── News Screen ─────────────────────────────────
  renderNews(container) {
    const s = this.engine.getState();
    
    let html = `<div class="top-bar">
      <button class="top-bar-back" onclick="ui.goBack()">←</button>
      <span class="top-bar-title">News</span>
      <span></span>
    </div>
    <div class="section-header">Recent Events</div>`;
    
    s.newsFeed.forEach(news => {
      html += `<div class="news-item">
        <span class="news-day">D${news.day} ${news.time}</span>
        <span class="news-text ${news.text.startsWith('MYSTERY') ? 'important' : ''}">${news.text}</span>
      </div>`;
    });
    
    // City Memory
    html += `<div class="section-header mt-3">City Memory</div>
    <div class="card">
      <div class="card-body">
        <div class="text-sm text-muted">The city remembers your choices:</div>`;
    
    s.cityMemory.slice(-10).forEach(mem => {
      html += `<div class="text-sm mt-1">• Day ${mem.day}: ${mem.text}</div>`;
    });
    
    html += `</div></div>`;
    
    container.innerHTML = html;
  }

  // ── Rivals Screen ───────────────────────────────
  renderRivals(container) {
    const s = this.engine.getState();
    
    let html = `<div class="top-bar">
      <button class="top-bar-back" onclick="ui.goBack()">←</button>
      <span class="top-bar-title">Rivals</span>
      <span></span>
    </div>
    <div class="scroll-list">`;
    
    GAME_DATA.rivalOrganizations.forEach(rival => {
      const attitude = this.engine.getRivalAttitude(rival.id);
      const rel = s.rivalRelationships[rival.id] || 0;
      const leader = GAME_DATA.characters.find(c => c.id === rival.leaderId);
      
      html += `<div class="card">
        <div class="card-header">
          <div class="card-icon">${rival.icon}</div>
          <div>
            <div class="card-title">${rival.name}</div>
            <div class="card-subtitle">${rival.type} · Led by ${leader ? leader.name : 'Unknown'}</div>
          </div>
          <span class="rival-attitude ${attitude}">${attitude}</span>
        </div>
        <div class="card-body">
          ${rival.description}
          <div class="mt-1 text-sm">
            <span class="text-muted">Relationship:</span> 
            <span class="relationship-value ${rel >= 10 ? 'positive' : rel <= -10 ? 'negative' : 'neutral'}">${rel > 0 ? '+' : ''}${rel}</span>
          </div>
        </div>
      </div>`;
    });
    
    html += `</div>`;
    container.innerHTML = html;
  }

  // ── Settings Screen ─────────────────────────────
  renderSettings(container) {
    const s = this.engine.getState();
    
    let html = `<div class="top-bar">
      <button class="top-bar-back" onclick="ui.goBack()">←</button>
      <span class="top-bar-title">Settings</span>
      <span></span>
    </div>
    
    <div class="section-header">Save / Load</div>
    <div class="scroll-list">
      <div class="card card-tappable" onclick="ui.saveGame(0)">
        <div class="card-header">
          <div class="card-icon">💾</div>
          <div><div class="card-title">Save Slot 1</div>
          <div class="card-subtitle">${this.getSaveInfo(0)}</div></div>
        </div>
      </div>
      <div class="card card-tappable" onclick="ui.saveGame(1)">
        <div class="card-header">
          <div class="card-icon">💾</div>
          <div><div class="card-title">Save Slot 2</div>
          <div class="card-subtitle">${this.getSaveInfo(1)}</div></div>
        </div>
      </div>
      <div class="card card-tappable" onclick="ui.saveGame(2)">
        <div class="card-header">
          <div class="card-icon">💾</div>
          <div><div class="card-title">Save Slot 3</div>
          <div class="card-subtitle">${this.getSaveInfo(2)}</div></div>
        </div>
      </div>
    </div>
    
    <div class="section-header mt-3">Options</div>
    <div class="scroll-list">
      <button type="button" class="card card-tappable settings-action-card" onclick="ui.startGuidedTutorial(true)">
        <div class="card-header">
          <div class="card-icon">◎</div>
          <div><div class="card-title">How to Play</div>
          <div class="card-subtitle">Replay the guided city tour</div></div>
          <span class="settings-action-arrow" aria-hidden="true">→</span>
        </div>
      </button>
      <div class="card card-tappable" onclick="ui.confirmNewGame()">
        <div class="card-header">
          <div class="card-icon">🔄</div>
          <div><div class="card-title">New Game</div>
          <div class="card-subtitle">Start over from scratch</div></div>
        </div>
      </div>
      <div class="card card-tappable" onclick="ui.toggleDevMode()">
        <div class="card-header">
          <div class="card-icon">🛠️</div>
          <div><div class="card-title">Developer Mode</div>
          <div class="card-subtitle">${s.devMode ? 'ON' : 'OFF'}</div></div>
        </div>
      </div>
    </div>`;
    
    // Dev panel
    if (s.devMode) {
      html += `<div class="dev-panel">
        <div class="dev-panel-title">🛠 Developer Tools</div>
        <div class="flex gap-1" style="flex-wrap:wrap">
          <button class="dev-btn" onclick="ui.devAddCash(500)">+€500</button>
          <button class="dev-btn" onclick="ui.devAddCash(1000)">+€1000</button>
          <button class="dev-btn" onclick="ui.devMaxEnergy()">Max Energy</button>
          <button class="dev-btn" onclick="ui.devAddRep(20)">+20 Rep</button>
          <button class="dev-btn" onclick="ui.devSkipDay()">Skip Day</button>
          <button class="dev-btn" onclick="ui.devDiscoverAllClues()">All Clues</button>
          <button class="dev-btn" onclick="ui.devUnlockBusinesses()">Unlock Biz</button>
        </div>
      </div>`;
    }
    
    container.innerHTML = html;
  }

  // ── Action Handlers ──────────────────────────────
  doTempJob(jobId) {
    const result = this.engine.doTempJob(jobId);
    if (result.success) {
      this.showToast(result.message);
      this.updateResourceBar();
      this.renderScreen('dashboard');
      this.engine.triggerTutorial('first_earning');
    } else {
      this.showToast(result.message);
    }
  }

  doRest() {
    const result = this.engine.rest();
    this.showToast(result.message);
    this.updateResourceBar();
    this.renderScreen('dashboard');
  }

  endDay() {
    this.engine.endDay();
    this.updateResourceBar();
    this.renderScreen('dashboard');
    
    // Check for pending event
    const evt = this.engine.getPendingEvent();
    if (evt) {
      this.showEventModal(evt);
    }
  }

  doInvestigate(locId) {
    const result = this.engine.investigateAtLocation(locId);
    this.showToast(result.message);
    this.updateResourceBar();
    this.renderScreen('dashboard');
  }

  doInvestigateRecords() {
    const result = this.engine.investigateRecords();
    this.showToast(result.message);
    this.updateResourceBar();
    this.renderScreen('dashboard');
  }

  gatherRumor(locId) {
    const s = this.engine.getState();
    if (s.energy < 1) { this.showToast('Not enough energy.'); return; }
    this.engine.spendEnergy(1);
    
    // Random chance to discover a clue or get a tip
    const availableClues = GAME_DATA.mysteryClues.filter(c => {
      if (s.discoveredClues.includes(c.id)) return false;
      if (c.discoveryMethod === 'gather_rumor') return true;
      return false;
    });
    
    if (availableClues.length > 0 && this.engine.seededRandom() < 0.4) {
      const clue = availableClues[Math.floor(this.engine.seededRandom() * availableClues.length)];
      s.discoveredClues.push(clue.id);
      this.showToast(`Rumor reveals: "${clue.title}"`);
    } else {
      // Random flavor text
      const rumors = [
        "Svetlana's expanding again. Aggressive.",
        "Riverside rents are going up. Something's off.",
        "Dimitri donated to another charity. Generous or strategic?",
        "Elena's been spending a lot of time at the property office.",
        "The café on 3rd street is closing. Shame — best coffee in Riverside.",
        "Someone's buying up properties through weird company names.",
        "James at the bank looks more nervous than usual."
      ];
      this.showToast(rumors[Math.floor(this.engine.seededRandom() * rumors.length)]);
    }
    
    this.engine.advanceTime();
    this.updateResourceBar();
    this.renderScreen('dashboard');
  }

  buyCoffee() {
    const s = this.engine.getState();
    if (s.cash < 3) { this.showToast('Not enough cash.'); return; }
    s.cash -= 3;
    s.energy = Math.min(s.maxEnergy, s.energy + 1);
    this.showToast('Bought coffee. +1 energy.');
    this.updateResourceBar();
  }

  investigateWithNora() {
    const result = this.engine.investigateAtLocation('local_newspaper');
    this.showToast(result.message);
    this.updateResourceBar();
    this.renderScreen('dashboard');
  }

  confrontDimitri() {
    this.selectedCharacter = 'dimitri_sokol';
    const result = this.engine.talkToCharacter('dimitri_sokol');
    this.showScreen('conversation', { result });
    this.updateResourceBar();
  }

  // ── Business Actions ────────────────────────────
  openBusinessModal(bizId) {
    const s = this.engine.getState();
    const data = GAME_DATA.businesses.find(b => b.id === bizId);
    if (!data) return;
    
    // Neighborhood selection
    const availableHoods = GAME_DATA.neighborhoods.filter(n => s.reputation >= n.unlockReputation);
    
    let modalHtml = `<div class="modal-header">
      <span class="modal-title">${data.icon} Open ${data.name}</span>
      <button class="modal-close" onclick="ui.closeModal()">✕</button>
    </div>
    <div class="card">
      <div class="card-body">
        <div class="finance-row"><span class="finance-row-label">Startup Cost</span><span class="finance-row-value">€${data.startupCost}</span></div>
        <div class="finance-row"><span class="finance-row-label">Daily Rent</span><span class="finance-row-value">€${data.dailyRent}</span></div>
        <div class="finance-row"><span class="finance-row-label">Supply Cost</span><span class="finance-row-value">€${data.supplyCostPerDay}/day</span></div>
        <div class="finance-row"><span class="finance-row-label">Est. Daily Profit</span><span class="finance-row-value">${data.estimatedDailyProfit}</span></div>
      </div>
    </div>
    <div class="section-header mt-2">Choose Location</div>`;
    
    availableHoods.forEach(hood => {
      const fit = data.neighborhoodFit[hood.id] || 1;
      const fitLabel = fit >= 1.2 ? 'Great' : fit >= 1.0 ? 'Good' : fit >= 0.8 ? 'Fair' : 'Poor';
      const fitBadge = fit >= 1.2 ? 'badge-green' : fit >= 1.0 ? 'badge-muted' : fit >= 0.8 ? 'badge-gold' : 'badge-red';
      
      modalHtml += `<div class="card card-tappable" onclick="ui.openBusiness('${bizId}','${hood.id}')">
        <div class="card-header">
          <div>
            <div class="card-title">${hood.name}</div>
            <div class="card-subtitle">${hood.atmosphere} · Rent modifier: ${hood.baseRent}</div>
          </div>
          <span class="badge ${fitBadge}">${fitLabel} fit</span>
        </div>
      </div>`;
    });
    
    this.showModal(modalHtml);
  }

  openBusiness(bizId, hoodId) {
    const result = this.engine.openBusiness(bizId, hoodId);
    this.closeModal();
    this.showToast(result.message);
    this.updateResourceBar();
    this.renderScreen('business');
    
    // Check for pending event
    const evt = this.engine.getPendingEvent();
    if (evt) this.showEventModal(evt);
  }

  upgradeBusiness(instanceId) {
    const result = this.engine.upgradeBusiness(instanceId);
    this.showToast(result.message);
    this.updateResourceBar();
    this.renderScreen('business-detail', { instanceId });
  }

  confirmCloseBusiness(instanceId) {
    let modalHtml = `<div class="modal-header">
      <span class="modal-title">Close Business?</span>
      <button class="modal-close" onclick="ui.closeModal()">✕</button>
    </div>
    <div class="confirm-dialog">
      <div class="confirm-message">Are you sure? You'll receive a partial refund from asset sale, but your reputation will drop.</div>
      <div class="confirm-buttons">
        <button class="btn btn-full" onclick="ui.closeModal()">Cancel</button>
        <button class="btn btn-full btn-danger" onclick="ui.closeBusinessAction('${instanceId}')">Close Business</button>
      </div>
    </div>`;
    this.showModal(modalHtml);
  }

  closeBusinessAction(instanceId) {
    const result = this.engine.closeBusiness(instanceId);
    this.closeModal();
    this.showToast(result.message);
    this.updateResourceBar();
    this.showScreen('business');
  }

  buyPlayerUpgrade(upgradeId) {
    const result = this.engine.buyPlayerUpgrade(upgradeId);
    this.showToast(result.message);
    this.updateResourceBar();
    this.renderScreen('business');
  }

  // ── Employee Actions ────────────────────────────
  confirmHire(candidateId) {
    const cand = GAME_DATA.employeeCandidates.find(c => c.id === candidateId);
    if (!cand) return;
    
    let modalHtml = `<div class="modal-header">
      <span class="modal-title">Hire ${cand.name}?</span>
      <button class="modal-close" onclick="ui.closeModal()">✕</button>
    </div>
    <div class="confirm-dialog">
      <div class="confirm-message">Hire ${cand.name} for €${cand.wage}/day?\nTrait: ${cand.trait}\n${cand.personalConcern}</div>
      <div class="confirm-buttons">
        <button class="btn btn-full" onclick="ui.closeModal()">Cancel</button>
        <button class="btn btn-full btn-success" onclick="ui.hireEmployee('${candidateId}')">Hire</button>
      </div>
    </div>`;
    this.showModal(modalHtml);
  }

  hireEmployee(candidateId) {
    const result = this.engine.hireEmployee(candidateId);
    this.closeModal();
    this.showToast(result.message);
    this.updateResourceBar();
    this.renderScreen('employees');
  }

  showWageModal(empInstanceId) {
    const emp = this.engine.getState().employees.find(e => e.instanceId === empInstanceId);
    if (!emp) return;
    
    let modalHtml = `<div class="modal-header">
      <span class="modal-title">Adjust ${emp.name}'s Wage</span>
      <button class="modal-close" onclick="ui.closeModal()">✕</button>
    </div>
    <div class="card">
      <div class="card-body text-center">
        <div>Current wage: €${emp.wage}/day</div>
        <div class="mt-2">
          <button class="btn btn-small" onclick="ui.setWage('${empInstanceId}', ${emp.wage - 2})" ${emp.wage - 2 < 5 ? 'disabled' : ''}>-€2</button>
          <button class="btn btn-small btn-primary" onclick="ui.setWage('${empInstanceId}', ${emp.wage + 2})">+€2</button>
        </div>
      </div>
    </div>`;
    this.showModal(modalHtml);
  }

  setWage(empInstanceId, newWage) {
    const result = this.engine.adjustEmployeeWage(empInstanceId, newWage);
    this.closeModal();
    this.showToast(result.message);
    this.updateResourceBar();
    this.renderScreen('employees');
  }

  confirmDismiss(empInstanceId) {
    const emp = this.engine.getState().employees.find(e => e.instanceId === empInstanceId);
    if (!emp) return;
    
    let modalHtml = `<div class="modal-header">
      <span class="modal-title">Dismiss ${emp.name}?</span>
      <button class="modal-close" onclick="ui.closeModal()">✕</button>
    </div>
    <div class="confirm-dialog">
      <div class="confirm-message">This will hurt your reputation and damage your relationship with ${emp.name}.</div>
      <div class="confirm-buttons">
        <button class="btn btn-full" onclick="ui.closeModal()">Cancel</button>
        <button class="btn btn-full btn-danger" onclick="ui.dismissEmployee('${empInstanceId}')">Dismiss</button>
      </div>
    </div>`;
    this.showModal(modalHtml);
  }

  dismissEmployee(empInstanceId) {
    const result = this.engine.dismissEmployee(empInstanceId);
    this.closeModal();
    this.showToast(result.message);
    this.updateResourceBar();
    this.renderScreen('employees');
  }

  showAssignModal(businessInstanceId) {
    const s = this.engine.getState();
    const unassigned = s.employees.filter(e => !e.assignedBusinessId);
    
    if (unassigned.length === 0) { this.showToast('No unassigned employees.'); return; }
    
    let modalHtml = `<div class="modal-header">
      <span class="modal-title">Assign Employee</span>
      <button class="modal-close" onclick="ui.closeModal()">✕</button>
    </div>`;
    
    unassigned.forEach(emp => {
      modalHtml += `<div class="card card-tappable" onclick="ui.assignEmployee('${emp.instanceId}','${businessInstanceId}')">
        <div class="card-header">
          <div class="portrait">${emp.portrait}</div>
          <div>
            <div class="card-title">${emp.name}</div>
            <div class="card-subtitle">Skill: ${emp.skill} · ${emp.trait}</div>
          </div>
        </div>
      </div>`;
    });
    
    this.showModal(modalHtml);
  }

  assignEmployee(empInstanceId, bizInstanceId) {
    const result = this.engine.assignEmployee(empInstanceId, bizInstanceId);
    this.closeModal();

    if (result.success) {
      const container = document.getElementById('screen-content');
      const previousScrollPosition = container.scrollTop;
      this.renderBusinessDetail(container, { instanceId: bizInstanceId });
      container.scrollTop = previousScrollPosition;
    }

    this.showToast(result.message);
    this.updateResourceBar();
  }

  // ── Property Actions ────────────────────────────
  confirmBuyProperty(propId) {
    const prop = GAME_DATA.properties.find(p => p.id === propId);
    if (!prop) return;
    const price = Math.max(0, prop.price - (this.engine.getState().propertyDiscount || 0));
    
    let modalHtml = `<div class="modal-header">
      <span class="modal-title">Buy ${prop.name}?</span>
      <button class="modal-close" onclick="ui.closeModal()">✕</button>
    </div>
    <div class="confirm-dialog">
      <div class="confirm-message">Purchase ${prop.name} for €${price}?\n${prop.description}</div>
      <div class="confirm-buttons">
        <button class="btn btn-full" onclick="ui.closeModal()">Cancel</button>
        <button class="btn btn-full btn-primary" onclick="ui.buyProperty('${propId}')">Buy</button>
      </div>
    </div>`;
    this.showModal(modalHtml);
  }

  buyProperty(propId) {
    const result = this.engine.buyProperty(propId);
    this.closeModal();
    this.showToast(result.message);
    this.updateResourceBar();
    this.renderScreen('properties');
  }

  // ── Loan Actions ────────────────────────────────
  confirmLoan(loanId) {
    const offer = GAME_DATA.loanOffers.find(l => l.id === loanId);
    if (!offer) return;
    const totalRepay = Math.ceil(offer.amount * (1 + offer.interestRate));
    
    let modalHtml = `<div class="modal-header">
      <span class="modal-title">Request ${offer.name}?</span>
      <button class="modal-close" onclick="ui.closeModal()">✕</button>
    </div>
    <div class="confirm-dialog">
      <div class="confirm-message">Borrow €${offer.amount} at ${(offer.interestRate*100).toFixed(0)}% interest?\nTotal repayment: €${totalRepay} over ${offer.termDays} days.</div>
      <div class="confirm-buttons">
        <button class="btn btn-full" onclick="ui.closeModal()">Cancel</button>
        <button class="btn btn-full btn-primary" onclick="ui.requestLoan('${loanId}')">Accept</button>
      </div>
    </div>`;
    this.showModal(modalHtml);
  }

  requestLoan(loanId) {
    const result = this.engine.requestLoan(loanId);
    this.closeModal();
    this.showToast(result.message);
    this.updateResourceBar();
    this.renderScreen('loans');
  }

  confirmRepayLoan() {
    let modalHtml = `<div class="modal-header">
      <span class="modal-title">Repay Loan Early?</span>
      <button class="modal-close" onclick="ui.closeModal()">✕</button>
    </div>
    <div class="confirm-dialog">
      <div class="confirm-message">Repay your loan early? This will save on interest but costs a lump sum.</div>
      <div class="confirm-buttons">
        <button class="btn btn-full" onclick="ui.closeModal()">Cancel</button>
        <button class="btn btn-full btn-success" onclick="ui.repayLoan()">Repay Early</button>
      </div>
    </div>`;
    this.showModal(modalHtml);
  }

  repayLoan() {
    const result = this.engine.repayLoanEarly();
    this.closeModal();
    this.showToast(result.message);
    this.updateResourceBar();
    this.renderScreen('loans');
  }

  // ── Mystery Actions ──────────────────────────────
  confirmMysteryResolution(resId) {
    const res = GAME_DATA.mysteryResolutions.find(r => r.id === resId);
    if (!res) return;
    
    let modalHtml = `<div class="modal-header">
      <span class="modal-title">⚠️ ${res.name}</span>
      <button class="modal-close" onclick="ui.closeModal()">✕</button>
    </div>
    <div class="card">
      <div class="card-body">${res.description}</div>
    </div>
    <div class="card">
      <div class="section-header">Consequences</div>
      <div class="card-body">${res.consequences.narrativeSummary}</div>
    </div>
    <div class="mt-2">
      <button class="btn btn-full btn-danger" onclick="ui.resolveMystery('${resId}')">Proceed with this Resolution</button>
      <button class="btn btn-full mt-1" onclick="ui.closeModal()">Cancel</button>
    </div>`;
    this.showModal(modalHtml);
  }

  resolveMystery(resId) {
    const result = this.engine.resolveMystery(resId);
    this.closeModal();
    this.showToast(result.message);
    this.updateResourceBar();
    this.renderScreen('mystery');
  }

  // ── Trade Modal ─────────────────────────────────
  showTradeModal(locId) {
    const s = this.engine.getState();
    
    let modalHtml = `<div class="modal-header">
      <span class="modal-title">Trade Goods</span>
      <button class="modal-close" onclick="ui.closeModal()">✕</button>
    </div>
    
    <div class="section-header">Buy</div>
    <div class="scroll-list">`;
    
    GAME_DATA.goods.forEach(good => {
      const canBuy = s.cash >= good.buyPrice && s.energy >= 1;
      modalHtml += `<div class="card ${canBuy ? 'card-tappable' : ''}" ${canBuy ? `onclick="ui.buyGoods('${good.id}')"` : ''}>
        <div class="card-header">
          <div class="card-icon">📦</div>
          <div>
            <div class="card-title">${good.name}</div>
            <div class="card-subtitle">Buy: €${good.buyPrice} · Sell: €${good.sellPrice}</div>
          </div>
        </div>
      </div>`;
    });
    
    modalHtml += `</div>`;
    
    // Sell inventory
    if (s.inventory.length > 0) {
      modalHtml += `<div class="section-header mt-2">Sell</div><div class="scroll-list">`;
      s.inventory.forEach(inv => {
        const good = GAME_DATA.goods.find(g => g.id === inv.goodId);
        if (good) {
          modalHtml += `<div class="card card-tappable" onclick="ui.sellGoods('${inv.goodId}')">
            <div class="card-header">
              <div class="card-icon">💰</div>
              <div>
                <div class="card-title">${good.name} x${inv.quantity}</div>
                <div class="card-subtitle">Sell for €${good.sellPrice} each</div>
              </div>
            </div>
          </div>`;
        }
      });
      modalHtml += `</div>`;
    }
    
    this.showModal(modalHtml);
  }

  buyGoods(goodId) {
    const result = this.engine.buyGoods(goodId, 1);
    this.showToast(result.message);
    this.updateResourceBar();
    this.showTradeModal(this.selectedLocation);
  }

  sellGoods(goodId) {
    const result = this.engine.sellGoods(goodId, 1);
    this.showToast(result.message);
    this.updateResourceBar();
    this.closeModal();
    this.renderScreen('dashboard');
  }

  // ── Event Modal ──────────────────────────────────
  showEventModal(evt) {
    let modalHtml = `<div class="modal-header">
      <span class="modal-title">⚡ ${evt.title}</span>
      <button class="modal-close" onclick="ui.dismissEvent()">✕</button>
    </div>
    <div class="card">
      <div class="card-body">${evt.description}</div>
    </div>
    <div class="section-header mt-2">Choose Your Response</div>`;
    
    evt.choices.forEach((choice, i) => {
      const s = this.engine.getState();
      const meetsCondition = !choice.condition || this.engine.checkCondition(choice.condition);
      const energyNeeded = choice.effects?.energyCost || 0;
      const hasEnergy = s.energy >= energyNeeded;
      const canChoose = meetsCondition && hasEnergy;
      const hint = !meetsCondition
        ? `Requires: ${choice.condition.replace(/_/g, ' ')}`
        : !hasEnergy ? `Requires ${energyNeeded} energy` : '';
      
      modalHtml += `<button class="event-choice-btn" onclick="ui.resolveEvent(${i})" ${!canChoose ? 'disabled' : ''}>
        ${choice.text}
        ${hint ? `<span class="event-choice-hint">${hint}</span>` : ''}
      </button>`;
    });
    
    this.showModal(modalHtml);
  }

  resolveEvent(choiceIndex) {
    const evt = this.engine.getPendingEvent();
    if (!evt) { this.closeModal(); return; }
    
    const result = this.engine.resolveEvent(evt, choiceIndex);
    if (!result?.success) {
      this.showToast(result?.message || 'That choice is not available.');
      return;
    }
    this.closeModal();
    this.updateResourceBar();
    this.renderScreen('dashboard');
  }

  dismissEvent() {
    this.engine.state.pendingEvent = null;
    this.closeModal();
  }

  // ── Save / Load ─────────────────────────────────
  saveGame(slot, silent = false) {
    const s = this.engine.getState();
    s.saveTime = Date.now();
    s.playTime = (s.playTime || 0) + 1;
    try {
      localStorage.setItem(`empire_save_${slot}`, JSON.stringify(s));
      if (!silent) this.showToast(`Game saved to Slot ${slot + 1}.`);
    } catch (e) {
      if (!silent) this.showToast('Save failed. Storage may be full.');
    }
    if (!silent && this.currentScreen === 'settings') this.renderScreen('settings');
  }

  loadGame(slot) {
    try {
      const data = localStorage.getItem(`empire_save_${slot}`);
      if (data) {
        const state = JSON.parse(data);
        this.engine.loadState(state);
        this.updateResourceBar();
        this.showScreen('dashboard');
        this.showToast('Game loaded.');
      } else {
        this.showToast('No save data in this slot.');
      }
    } catch (e) {
      this.showToast('Load failed. Save data may be corrupted.');
    }
  }

  getSaveInfo(slot) {
    try {
      const data = localStorage.getItem(`empire_save_${slot}`);
      if (data) {
        const s = JSON.parse(data);
        const date = s.saveTime ? new Date(s.saveTime).toLocaleDateString() : 'Unknown';
        return `Day ${s.day} · €${s.cash} · ${date}`;
      }
    } catch(e) {}
    return 'Empty';
  }

  checkSavedGame() {
    try {
      const data = localStorage.getItem('empire_save_0');
      if (data) {
        const s = JSON.parse(data);
        // Show load prompt on dashboard
        setTimeout(() => {
          if (confirm('Saved game found (Day ' + s.day + '). Load it?')) {
            this.loadGame(0);
          }
        }, 500);
      }
    } catch(e) {}
  }

  confirmNewGame() {
    if (confirm('Start a new game? Current progress will be lost unless saved.')) {
      this.engine.newGame();
      this.updateResourceBar();
      this.showScreen('dashboard');
      this.showToast('New game started.');
      setTimeout(() => this.startGuidedTutorial(true), 300);
    }
  }

  startAutoSave() {
    setInterval(() => {
      if (this.engine.getState()) {
        this.saveGame(0, true); // Auto-save quietly to Slot 1.
      }
    }, 60000); // Every 60 seconds
  }

  // ── Developer Tools ──────────────────────────────
  toggleDevMode() {
    this.engine.getState().devMode = !this.engine.getState().devMode;
    this.renderScreen('settings');
  }

  devAddCash(amount) {
    this.engine.devAddCash(amount);
    this.showToast(`[DEV] +€${amount}`);
    this.updateResourceBar();
  }

  devMaxEnergy() {
    this.engine.getState().energy = this.engine.getState().maxEnergy;
    this.showToast('[DEV] Energy maxed.');
    this.updateResourceBar();
  }

  devAddRep(amount) {
    this.engine.changeReputation(amount);
    this.showToast(`[DEV] +${amount} reputation`);
    this.updateResourceBar();
  }

  devSkipDay() {
    this.engine.endDay();
    this.updateResourceBar();
    this.showToast('[DEV] Skipped a day.');
    this.renderScreen('dashboard');
  }

  devDiscoverAllClues() {
    GAME_DATA.mysteryClues.forEach(c => {
      if (!this.engine.getState().discoveredClues.includes(c.id)) {
        this.engine.getState().discoveredClues.push(c.id);
      }
    });
    this.showToast('[DEV] All clues discovered.');
    this.renderScreen('mystery');
  }

  devUnlockBusinesses() {
    this.engine.devUnlockAllBusinesses();
    this.showToast('[DEV] All businesses unlocked.');
  }

  // ── Guided Tutorial ─────────────────────────────
  getGuidedTutorialSteps() {
    return [
      {
        eyebrow: 'Welcome to the city',
        title: 'Every empire starts with one smart move.',
        text: 'You begin with €100, a full day of energy, and no reputation. The goal is to earn, build, meet the right people, and uncover the deal reshaping the city.',
        placement: 'center',
        visual: `<div class="tour-skyline" aria-hidden="true"><i></i><i></i><i></i><i></i><span>THE EMPIRE</span></div>`
      },
      {
        eyebrow: 'Your vital signs',
        title: 'Watch four numbers.',
        text: 'Cash funds opportunities. Energy limits what you can do today. Reputation unlocks districts and deals. Day tracks the city as it changes around you.',
        placement: 'bottom',
        target: '[data-tutorial-target="resources"]',
        visual: `<div class="tour-resource-grid" aria-label="Cash, energy, reputation, and day"><span><i>◆</i><b>Cash</b><small>Spend & earn</small></span><span><i>ϟ</i><b>Energy</b><small>Actions today</small></span><span><i>✦</i><b>Reputation</b><small>Unlock access</small></span><span><i>◷</i><b>Day</b><small>City timeline</small></span></div>`
      },
      {
        eyebrow: 'The core loop',
        title: 'Explore. Earn. Invest.',
        text: 'Start in the Old Market. Take temporary work to grow your cash, then turn that money into your first business. Each action spends energy and moves time forward.',
        placement: 'top',
        target: '[data-tutorial-target="actions"]',
        visual: `<div class="tour-loop" aria-label="Explore, earn, and invest"><span><b>01</b>Explore</span><i>→</i><span><b>02</b>Earn</span><i>→</i><span><b>03</b>Invest</span></div>`
      },
      {
        eyebrow: 'Move around quickly',
        title: 'Your city is always one tap away.',
        text: 'Use the bottom bar for Home, the City map, Businesses, Clues, and Menu. The highlighted tab always shows where you are.',
        placement: 'top',
        target: '[data-tutorial-target="navigation"]',
        visual: `<div class="tour-nav-preview" aria-hidden="true"><span>⌂<small>Home</small></span><span>◇<small>City</small></span><span>▣<small>Business</small></span><span>⌕<small>Clues</small></span><span>⚙<small>Menu</small></span></div>`
      },
      {
        eyebrow: 'Choices have memory',
        title: 'People, profit, and clues connect.',
        text: 'Relationships can unlock loans, properties, employees, and evidence. Read choices carefully: a fast profit can change trust, neighborhoods, or rival attention later.',
        placement: 'center',
        visual: `<div class="tour-consequence" aria-hidden="true"><span>Relationship</span><i>+</i><span>Opportunity</span><i>+</i><span>Clue</span></div>`
      },
      {
        eyebrow: 'You are ready',
        title: 'Make your first move in the Old Market.',
        text: 'Your progress autosaves every minute. You can replay this tour from Menu → How to Play whenever you want a refresher.',
        placement: 'center',
        visual: `<div class="tour-ready" aria-hidden="true"><span>01</span><div><b>First objective</b><small>Explore the city and find paid work.</small></div><i>→</i></div>`
      }
    ];
  }

  startGuidedTutorial(force = false) {
    const state = this.engine.getState();
    if (!state) return;
    if (force) delete state.tutorialCompleted.guided_tour;
    this.engine.clearTutorial();
    this.guidedTutorialStep = 0;
    if (this.currentScreen !== 'dashboard') {
      this.screenHistory = [];
      this.currentScreen = 'dashboard';
      this.renderScreen('dashboard');
      this.updateResourceBar();
      this.updateNavHighlight();
    }
    this.renderGuidedTutorial();
  }

  renderGuidedTutorial() {
    const steps = this.getGuidedTutorialSteps();
    const step = steps[this.guidedTutorialStep];
    if (!step) return;

    if (this.guidedTutorialTarget) {
      this.guidedTutorialTarget.classList.remove('tutorial-spotlight');
      this.guidedTutorialTarget = null;
    }
    if (step.target) {
      this.guidedTutorialTarget = document.querySelector(step.target);
      if (this.guidedTutorialTarget) this.guidedTutorialTarget.classList.add('tutorial-spotlight');
    }

    if (!this.guidedTutorialOverlay) {
      this.guidedTutorialOverlay = document.createElement('div');
      document.getElementById('app').appendChild(this.guidedTutorialOverlay);
    }

    const isFirst = this.guidedTutorialStep === 0;
    const isLast = this.guidedTutorialStep === steps.length - 1;
    const progress = steps.map((_, index) => `<i class="${index <= this.guidedTutorialStep ? 'complete' : ''}"></i>`).join('');
    this.guidedTutorialOverlay.className = `guided-tour guided-tour-${step.placement}`;
    this.guidedTutorialOverlay.innerHTML = `<div class="guided-tour-scrim"></div>
      <section class="guided-tour-card" role="dialog" aria-modal="true" aria-labelledby="guided-tour-title">
        <div class="guided-tour-progress" aria-label="Tutorial step ${this.guidedTutorialStep + 1} of ${steps.length}">${progress}</div>
        <div class="guided-tour-count">${String(this.guidedTutorialStep + 1).padStart(2, '0')} <span>/ ${String(steps.length).padStart(2, '0')}</span></div>
        <div class="guided-tour-visual">${step.visual}</div>
        <div class="guided-tour-eyebrow">${step.eyebrow}</div>
        <h2 id="guided-tour-title">${step.title}</h2>
        <p>${step.text}</p>
        <div class="guided-tour-actions">
          <button type="button" class="guided-tour-skip" onclick="ui.finishGuidedTutorial(false)">Skip tour</button>
          <div>
            ${!isFirst ? `<button type="button" class="guided-tour-back" onclick="ui.previousGuidedTutorial()">Back</button>` : ''}
            <button type="button" class="guided-tour-next" onclick="ui.${isLast ? 'finishGuidedTutorial(true)' : 'nextGuidedTutorial()'}">${isLast ? 'Explore the city' : 'Continue'} <span aria-hidden="true">→</span></button>
          </div>
        </div>
      </section>`;

    requestAnimationFrame(() => this.guidedTutorialOverlay?.querySelector('.guided-tour-next')?.focus());
  }

  nextGuidedTutorial() {
    const steps = this.getGuidedTutorialSteps();
    this.guidedTutorialStep = Math.min(this.guidedTutorialStep + 1, steps.length - 1);
    this.renderGuidedTutorial();
  }

  previousGuidedTutorial() {
    this.guidedTutorialStep = Math.max(0, this.guidedTutorialStep - 1);
    this.renderGuidedTutorial();
  }

  finishGuidedTutorial(exploreCity = false) {
    const state = this.engine.getState();
    if (state) state.tutorialCompleted.guided_tour = true;
    if (this.guidedTutorialTarget) {
      this.guidedTutorialTarget.classList.remove('tutorial-spotlight');
      this.guidedTutorialTarget = null;
    }
    if (this.guidedTutorialOverlay) {
      this.guidedTutorialOverlay.remove();
      this.guidedTutorialOverlay = null;
    }
    this.saveGame(0, true);
    if (exploreCity) this.showScreen('map');
    else {
      document.getElementById('screen-content')?.focus();
      this.showToast('Tutorial closed. Replay it anytime from Menu.');
    }
  }

  // ── Contextual Tutorial Tips ─────────────────────
  dismissTutorial() {
    this.engine.clearTutorial();
    this.renderScreen('dashboard');
  }

  // ── Modal System ────────────────────────────────
  showModal(content) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `<div class="modal-content" role="dialog" aria-modal="true">${content}</div>`;
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) this.closeModal();
    });
    document.getElementById('app').appendChild(overlay);
    this.modalStack.push(overlay);
    const firstControl = overlay.querySelector('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
    if (firstControl) firstControl.focus();
  }

  closeModal() {
    if (this.modalStack.length > 0) {
      const overlay = this.modalStack.pop();
      overlay.remove();
    }
  }

  // ── Toast Notification ──────────────────────────
  showToast(message) {
    const existing = document.getElementById('toast');
    if (existing) existing.remove();
    
    const toast = document.createElement('div');
    toast.id = 'toast';
    toast.style.cssText = `
      position: fixed;
      top: 12px;
      left: 50%;
      transform: translateX(-50%);
      background: var(--bg-card);
      color: var(--text-primary);
      padding: 10px 20px;
      border-radius: 8px;
      border: 1px solid var(--accent-gold);
      font-size: 13px;
      font-weight: 600;
      z-index: 200;
      max-width: 90%;
      text-align: center;
      animation: fadeIn 0.2s ease;
      box-shadow: 0 4px 20px rgba(0,0,0,0.5);
    `;
    toast.textContent = message;
    document.getElementById('app').appendChild(toast);
    
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.3s';
      setTimeout(() => toast.remove(), 300);
    }, 2500);
  }
}

'use strict';

// ── Game controller ──────────────────────────────────────────────────────────
const Game = {

  // ── State ─────────────────────────────────────────────────────────────────
  s: {
    energy: INITIAL_ENERGY,
    nuclei: [],          // all Nucleus instances
    forge: [],           // nuclei inside reactor (max 2, or 3 during triple-alpha)
    electrons: 0,        // backgroundElectrons
    paused: false,       // time pause flag
    tripleAlpha: false,  // 3rd forge slot unlocked
    fissionMode: false,  // waiting for user to click a nucleus to fission
    over: false,
    won: false,
    dragging: null,
  },

  e: {},  // cached DOM elements

  // ── Bootstrap ─────────────────────────────────────────────────────────────
  init() {
    this.s.nuclei = [];
    this.s.bgElectrons = []; // Keep track of background electrons

    // Spawn 10 background electrons
    for (let i = 0; i < 10; i++) {
      const e = this._spawn('e-', 
        Math.random() * (window.innerWidth - 100) + 50,
        Math.random() * (window.innerHeight - 100) + 50
      );
      if (e) {
        e.el.style.pointerEvents = 'none'; // Not draggable
        e.el.style.zIndex = 10;
        this.s.bgElectrons.push(e);
      }
    }
    this._cache();
    this._plasma();
    this._bindControls();
    this._bindReactor();

    document.getElementById('start-btn').onclick = () => {
      AudioManager.init();
      document.getElementById('tutorial-screen').classList.add('hidden');
      this._startGame();
    };
    document.getElementById('restart-btn-v').onclick = () => { AudioManager.stopDangerAlarm(); this._restart(); };
    document.getElementById('restart-btn-d').onclick = () => { AudioManager.stopDangerAlarm(); this._restart(); };
  },

  _cache() {
    const $ = (id) => document.getElementById(id);
    this.e = {
      board      : $('game-board'),
      reactor    : $('reactor'),
      inventory  : $('inventory'),
      slider     : $('temp-slider'),
      sliderDisp : $('temp-display'),
      coulomb    : $('coulomb-display'),
      rxnDesc    : $('rxn-description'),
      rxnQ       : $('rxn-q'),
      fuseBtn    : $('fuse-btn'),
      fissBtn    : $('fiss-btn'),
      ffwdBtn    : $('ffwd-btn'),
      electrons  : $('electrons-display'),
      timeStatus : $('time-status'),
      barFill    : $('energy-fill'),
      barPct     : $('energy-pct'),
      historyList: $('history-list'),
      s1         : $('si-1'),
      s2         : $('si-2'),
      s3         : $('si-3'),
      rxnLabel   : $('reactor-label'),
      victoryScr : $('victory-screen'),
      defeatScr  : $('defeat-screen'),
      timeBanner : $('time-banner'),
    };
  },

  // ── Game lifecycle ─────────────────────────────────────────────────────────
  _startGame() {
    const s = this.s;
    s.nuclei.forEach(n => n.remove());
    Object.assign(s, {
      energy:0, nuclei:[], forge:[], electrons:0, bgElectrons:[],
      tripleAlpha:false, fissionMode:false, over:false, won:false, locked:false, lastMsg:null,
      missions: {
        pp: { step: 0, max: 3, done: false },
        ta: { step: 0, max: 2, done: false },
        cno: { step: 0, max: 6, done: false },
        dt: { step: 0, max: 3, done: false },
        ladder: { step: 0, max: 4, done: false },
        titans: { step: 0, max: 2, done: false, c_done: false, o_done: false },
        sisi: { step: 0, max: 2, done: false },
        iron: { step: 0, max: 2, done: false }
      }
    });
    
    // Reset mission UI
    ['pp', 'ta', 'cno', 'dt', 'ladder', 'titans', 'sisi', 'iron'].forEach(m => {
      const el = document.getElementById(`mission-${m}`);
      if (el) {
        el.classList.remove('completed');
        const prog = el.querySelector('.mission-progress');
        if (prog) prog.style.width = '0%';
        const rew = el.querySelector('.mission-reward');
        if (rew) rew.textContent = '0%';
      }
    });
    s.energy = INITIAL_ENERGY;
    this.e.inventory.innerHTML = '';
    this.e.historyList.innerHTML = '';

    // Respawn bg electrons if needed, or they will stay on screen because they are Nucleus?
    // Actually, s.nuclei.forEach(n => n.remove()) removed them!
    for (let i = 0; i < 10; i++) {
      const p = this._randPos(i, 10);
      const e = this._spawn('e-', p.x, p.y);
      if (e) {
        e.el.style.pointerEvents = 'none';
        e.el.style.zIndex = 10;
        s.bgElectrons.push(e);
      }
    }

    INITIAL_INVENTORY.forEach(key => {
      const iso = ISOTOPES[key];
      if (iso) s.electrons += iso.Z;
    });

    INITIAL_INVENTORY.forEach((key, i) => {
      const pos = this._randPos(i, INITIAL_INVENTORY.length);
      s.nuclei.push(new Nucleus(key, pos.x, pos.y));
    });

    this._ui();
    this._checkMissions([], 'Init');
    this._msg('Simulação Iniciada', 'Arraste 2 isótopos para o reator e clique em Fundir.', 'info');
  },

  _restart() {
    this.s.nuclei.forEach(n => n.remove());
    this.e.victoryScr.classList.add('hidden');
    this.e.defeatScr.classList.add('hidden');
    this.e.timeBanner.classList.remove('visible');
    this.e.fissBtn.classList.remove('active');
    this.e.reactor.classList.remove('ta-mode');
    this._startGame();
  },

  // ── Plasma canvas animation ────────────────────────────────────────────────
  _plasma() {
    const canvas = document.getElementById('plasma-canvas');
    const rect   = document.getElementById('reactor').getBoundingClientRect();
    const sz     = Math.round(Math.max(rect.width, 220));
    canvas.width = canvas.height = sz;
    const ctx = canvas.getContext('2d');
    let t = 0;

    // clip to circle once
    ctx.save();
    ctx.beginPath();
    ctx.arc(sz/2, sz/2, sz/2, 0, Math.PI*2);
    ctx.clip();

    const blobs = [
      [0.70,0.50,0.40,30,10,0.65],
      [0.55,0.70,0.38,18, 5,0.50],
      [0.45,0.35,0.32,50,35,0.60],
      [0.50,0.50,0.22,60,50,0.80],
    ];

    const tick = () => {
      if (!canvas.isConnected) return;
      ctx.clearRect(0,0,sz,sz);
      ctx.fillStyle='#030508';
      ctx.fillRect(0,0,sz,sz);

      ctx.save();
      ctx.globalCompositeOperation='screen';
      blobs.forEach(([bx,by,br,h1,h2,a],i) => {
        const cx = sz*(bx + 0.38*Math.cos(t*0.7+i*1.3));
        const cy = sz*(by + 0.38*Math.sin(t*0.5+i*1.1));
        const gr = ctx.createRadialGradient(cx,cy,0,sz/2,sz/2,br*sz);
        gr.addColorStop(0,  `hsla(${h1},100%,68%,${a})`);
        gr.addColorStop(0.4,`hsla(${h2},100%,48%,${a*0.55})`);
        gr.addColorStop(1,  'hsla(0,0%,0%,0)');
        ctx.fillStyle = gr;
        ctx.fillRect(0,0,sz,sz);
      });
      ctx.restore();

      // bright core
      const cg = ctx.createRadialGradient(sz/2,sz/2,0,sz/2,sz/2,sz*0.18);
      cg.addColorStop(0,'rgba(255,255,200,.55)');
      cg.addColorStop(1,'transparent');
      ctx.fillStyle=cg; ctx.fillRect(0,0,sz,sz);

      t += 0.016;
      requestAnimationFrame(tick);
    };
    tick();
  },

  // ── Random inventory position ──────────────────────────────────────────────
  _randPos(i, total) {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const cx = w / 2;
    const cy = h / 2;
    const R_reactor = w < 600 ? 75 : w < 900 ? 90 : 115;
    const minR = R_reactor + 60; 
    
    // We want to avoid spawning:
    // - On top of the reactor (dist < minR)
    // - Behind left/right panels (x < 280 or x > w - 280)
    // - Behind bottom energy bar / HUD (y < 80 or y > h - 140)
    
    let x, y;
    let valid = false;
    let attempts = 0;
    while (!valid && attempts < 100) {
      x = 280 + Math.random() * (w - 560);
      y = 80 + Math.random() * (h - 220);
      
      const dist = Math.hypot((x + 30) - cx, (y + 30) - cy);
      if (dist >= minR) valid = true;
      attempts++;
    }
    
    if (!valid) {
      // Fallback if screen is too small
      x = cx + Math.cos((Math.PI*2*i)/total) * minR;
      y = cy + Math.sin((Math.PI*2*i)/total) * minR;
    }
    
    return { x, y };
  },

  // ── Drag & drop ───────────────────────────────────────────────────────────
  _bindReactor() {
    // Pointer drag and drop events are handled in onDrop and onDragMove
  },

  onDragStart(nuc) {
    this.s.dragging = nuc;
    if (nuc && typeof nuc._hideTip === 'function') {
      nuc._hideTip();
    }
  },

  onDragMove(nuc, e) {
    const rRect = this.e.reactor.getBoundingClientRect();
    const rCenterX = rRect.left + rRect.width/2;
    const rCenterY = rRect.top + rRect.height/2;
    const radius = rRect.width/2;
    
    const nRect = nuc.el.getBoundingClientRect();
    const cx = nRect.left + nRect.width/2;
    const cy = nRect.top + nRect.height/2;
    
    const dist = Math.hypot(cx - rCenterX, cy - rCenterY);
    
    if (dist < radius + 40) {
      this.e.reactor.classList.add('drag-over');
    } else {
      this.e.reactor.classList.remove('drag-over');
    }
  },

  onDrop(nuc, e) {
    this.s.dragging = null;
    this.e.reactor.classList.remove('drag-over');
    
    const rRect = this.e.reactor.getBoundingClientRect();
    const rCenterX = rRect.left + rRect.width/2;
    const rCenterY = rRect.top + rRect.height/2;
    const radius = rRect.width/2;
    
    // Fallback to true DOM element bounding box
    const nRect = nuc.el.getBoundingClientRect();
    const atomCenterX = nRect.left + nRect.width/2;
    const atomCenterY = nRect.top + nRect.height/2;
    
    const dist = Math.hypot(atomCenterX - rCenterX, atomCenterY - rCenterY);
    
    if (dist < radius + 40) {
      if (!nuc.inReactor) {
        this._addToForge(nuc);
      } else {
        // Snap back to slot
        const idx = this.s.forge.indexOf(nuc);
        let off = {dx:0, dy:0};
        if (!this.s.tripleAlpha) {
          if (idx === 0) off = { dx: -35, dy: 0 };
          if (idx === 1) off = { dx: 35,  dy: 0 };
        } else {
          if (idx === 0) off = { dx: 0,   dy: -30 };
          if (idx === 1) off = { dx: -35, dy: 30 };
          if (idx === 2) off = { dx: 35,  dy: 30 };
        }
        nuc.setPosition(115 + off.dx - nuc.halfSize(), 115 + off.dy - nuc.halfSize());
      }
    } else {
      if (nuc.inReactor) {
        this._removeFromForge(nuc);
      }
      let x = Math.max(0, Math.min(nuc.x, window.innerWidth - (nuc.el ? nuc.el.offsetWidth : 40)));
      let y = Math.max(0, Math.min(nuc.y, window.innerHeight - (nuc.el ? nuc.el.offsetHeight : 40)));
      nuc.x = x; nuc.y = y;
      
      // Annihilation check for positrons dropped outside
      if (nuc.isAntiparticle) {
        if (this._attractAndAnnihilate(nuc)) return;
      }
      
      AudioManager.playDropOutside();
      nuc.setPosition(x, y);
    }
  },

  _addToForge(nuc) {
    const s = this.s;
    if (s.over || s.won || s.locked) return;

    // Positrons stay in the reactor until manually dragged out
    // if (nuc.isAntiparticle) { this._annihilate(nuc); return; }

    // If already in forge → remove it
    if (nuc.inReactor) { this._removeFromForge(nuc); return; }

    // Capacity logic handles normally up to 2.
    // However, if elements are created BY FUSION, they are pushed regardless.
    // We only block manually adding MORE if already full.
    const maxSlots = 2;
    if (s.forge.length >= maxSlots && !nuc.isProduct) {
      this._msg('Ação Negada', 'O reator já está cheio!', 'warning'); return;
    }

    if (!nuc.isProduct) AudioManager.playDrop();

    s.forge.push(nuc);
    nuc.inReactor = true;
    this.e.reactor.appendChild(nuc.el);
    nuc.el.classList.add('in-reactor');
    if (nuc.syncDecayBarAfterReparent) nuc.syncDecayBarAfterReparent();

    this._repositionForge();

    if (s.forge.length >= 2) this.e.rxnLabel.style.opacity='0';
    this._updateForgeUI();
    this._updateCoulomb();
    this._updateRxnInfo();
    this._updateFuseBtn();
  },

  _repositionForge() {
    const s = this.s;
    const len = s.forge.length;
    if (len === 0) return;
    
    const rW = this.e.reactor.offsetWidth;
    const rC = rW > 0 ? rW / 2 : 115; // Center of reactor

    if (len === 1) {
      const nuc = s.forge[0];
      nuc.setPosition(rC - nuc.halfSize(), rC - nuc.halfSize());
      return;
    }
    
    const R = 45; // radius of arrangement
    s.forge.forEach((nuc, i) => {
      let angle;
      if (len === 2) {
        angle = Math.PI + (i * Math.PI); // Left and Right
      } else {
        angle = -Math.PI / 2 + (Math.PI * 2 * i / len);
      }
      const dx = Math.cos(angle) * R;
      const dy = Math.sin(angle) * R;
      nuc.setPosition(rC + dx - nuc.halfSize(), rC + dy - nuc.halfSize());
    });
  },

  _removeFromForge(nuc) {
    const s = this.s;
    const i = s.forge.indexOf(nuc);
    if (i === -1) return;
    s.forge.splice(i, 1);
    nuc.inReactor = false;
    nuc.el.classList.remove('in-reactor');
    this.e.inventory.appendChild(nuc.el);
    if (nuc.syncDecayBarAfterReparent) nuc.syncDecayBarAfterReparent();
    
    const rRect = this.e.reactor.getBoundingClientRect();
    nuc.setPosition(
      rRect.left + 3 + nuc.x,
      rRect.top + 3 + nuc.y
    );
    
    this._repositionForge();
    
    if (s.forge.length < 2) this.e.rxnLabel.style.opacity='1';
    this._updateForgeUI();
    this._updateCoulomb();
    this._updateRxnInfo();
    this._updateFuseBtn();
  },

  _clearForge() {
    [...this.s.forge].forEach(n => {
      n.inReactor = false;
      this._removeNucleus(n);
    });
    this.s.forge = [];
    this.e.rxnLabel.style.opacity='1';
    this._updateForgeUI();
    this._updateFuseBtn();
  },

  _ejectForge() {
    [...this.s.forge].forEach(n => {
      this._removeFromForge(n);
      if (n.key === 'e+') this._attractAndAnnihilate(n);
    });
  },

    // ── Controls ──────────────────────────────────────────────────────────────
  _bindControls() {
    this.e.slider.addEventListener('input', () => {
      this.e.sliderDisp.textContent = this.e.slider.value;
      this._updateCoulomb();
      if (typeof AudioManager !== 'undefined') {
        AudioManager.updateMotorSound(parseFloat(this.e.slider.value), parseFloat(this.e.slider.max));
      }
    });
    this.e.slider.addEventListener('change', () => {
      if (typeof AudioManager !== 'undefined') {
        AudioManager.stopMotorSound();
      }
    });
    // Trata caso o usuário solte o mouse fora do slider
    this.e.slider.addEventListener('pointerup', () => {
      if (typeof AudioManager !== 'undefined') {
        AudioManager.stopMotorSound();
      }
    });
    this.e.fuseBtn.addEventListener('click',  () => this._fuse());
    this.e.fissBtn.addEventListener('click',  () => this._toggleFissionMode());
    this.e.ffwdBtn.addEventListener('click',  () => this._fastForwardDecay());
    
    // Mission Tooltips
    const missionMap = {
      'mission-pp': 'svg/pp.svg',
      'mission-ta': 'svg/triplo alfa.svg',
      'mission-cno': 'svg/cno.svg',
      'mission-dt': 'svg/dt.svg',
      'mission-ladder': 'svg/escalda alfa.svg',
      'mission-titans': 'svg/titas.svg',
      'mission-sisi': 'svg/ultimo suspiro.svg',
      'mission-iron': 'svg/maldição do ferro.svg'
    };
    
    const tooltip = document.getElementById('mission-tooltip');
    const tooltipImg = document.getElementById('mission-tooltip-img');
    
    if (tooltip && tooltipImg) {
      document.querySelectorAll('.mission-item').forEach(item => {
        item.addEventListener('mouseenter', (e) => {
          const svgSrc = missionMap[item.id];
          if (svgSrc) {
            tooltipImg.src = encodeURI(svgSrc);
            tooltip.classList.add('visible');
            
            const rect = item.getBoundingClientRect();
            // Posiciona à direita do item da missão
            tooltip.style.left = (rect.right + 10) + 'px';
            tooltip.style.top = rect.top + 'px';
          }
        });
        item.addEventListener('mouseleave', () => {
          tooltip.classList.remove('visible');
          tooltip.classList.remove('enlarged');
        });
        item.addEventListener('click', () => {
          tooltip.classList.toggle('enlarged');
        });
      });
    }
  },

  _updateFuseBtn() {
    const s = this.s;
    this.e.fuseBtn.disabled = s.forge.length !== 2 || s.over || s.won || s.locked;
  },

  _updateCoulomb() {
    const s = this.s;
    if (s.forge.length !== 2) {
      this.e.coulomb.textContent = '–';
      this.e.coulomb.className   = 'coulomb-val';
      return;
    }
    const barrier  = Physics.coulombBarrier(s.forge[0].Z, s.forge[1].Z);
    const invested = +this.e.slider.value;
    this.e.coulomb.textContent = `${barrier.toFixed(0)} (${invested} invest.)`;
    this.e.coulomb.className   = `coulomb-val ${invested>=barrier?'ok':'bad'}`;
  },

  _updateRxnInfo() {
    const s = this.s;
    if (s.tripleAlpha) return; // leave the countdown visible
    if (s.forge.length !== 2) {
      this.e.rxnDesc.textContent = s.forge.length > 2 ? 'Reator lotado. Remova excedentes.' : 'Arraste 2 isótopos para o reator';
      this.e.rxnQ.textContent    = '';
      this.e.rxnQ.className      = 'rxn-q';
      return;
    }
    const k1  = s.forge[0].key, k2 = s.forge[1].key;
    const rxn = Physics.getReaction(k1, k2);
    if (rxn) {
      this.e.rxnDesc.textContent = rxn.description || `${k1} + ${k2}`;
      const q = rxn.Q_MeV || 0;
      this.e.rxnQ.textContent = q ? `Q = ${q>0?'+':''}${q.toFixed(3)} MeV (${Physics.fmt(q*MEV_TO_ENERGY)})` : '';
      this.e.rxnQ.className   = `rxn-q ${q>=0?'pos':'neg'}`;
    } else {
      this.e.rxnDesc.textContent = `${k1} + ${k2} → ?`;
      this.e.rxnQ.textContent    = '';
    }
  },

  _updateForgeUI() {
    const s = this.s;
    this.e.s1.classList.toggle('filled', s.forge.length>=1);
    this.e.s2.classList.toggle('filled', s.forge.length>=2);
  },

  // ── Fusion ────────────────────────────────────────────────────────────────
  _fuse() {
    const s = this.s;
    if (s.forge.length < 2 || s.over || s.won) return;

    const [n1, n2] = s.forge;
    const invested = +this.e.slider.value;
    const barrier  = Physics.coulombBarrier(n1.Z, n2.Z);

    this._energy(-invested);
    AudioManager.playMachineStart();

    if (invested < barrier) {
      AudioManager.playFuseFail();
      this._msg('Fusão Falhou', `Barreira não vencida (${invested} < ${barrier.toFixed(0)}). Energia perdida.`, 'danger');
      this._float(window.innerWidth/2, window.innerHeight/2, `-${invested} ⚡`,'#ff1744');
      this._ejectForge();
      this._checkOver();
      return;
    }

    // ── Special: triple-alpha second step ──
    if (s.tripleAlpha) {
      const be8 = s.forge.find(n=>n.key==='Be-8');
      const he4 = s.forge.find(n=>n.key==='He-4');
      if (be8 && he4) { this._completeTripleAlpha(be8, he4); return; }
    }

    const rxn = Physics.getReaction(n1.key, n2.key);

    if (!rxn) { this._genericFuse(n1, n2); return; }

    const resolvedRxn = Physics.resolveReaction(rxn);

    if (rxn.probabilistic && !rxn.channels) {
      if (Math.random() >= rxn.success_chance) {
        AudioManager.playFuseFail();
        this._energy(invested);
        
        // Let it form He-2 naturally
        this._applyFusion(['He-2'], n1, n2, 0, 'Dipróton formado! Instável, energia devolvida.');
        return;
      }
    }

    // Triple-alpha trigger
    if (resolvedRxn.special === 'TRIPLE_ALPHA_TRIGGER') {
      this._applyFusion(resolvedRxn.products, n1, n2, resolvedRxn.Q_MeV, resolvedRxn.description);
      this._activateTripleAlpha();
      return;
    }

    if (resolvedRxn.special === 'SUPERNOVA_TRIGGER') {
      this.s.won = true; // Previne que o jogo acabe em derrota ('Colapso') devido à queda de energia
      this._applyFusion(resolvedRxn.products, n1, n2, resolvedRxn.Q_MeV, resolvedRxn.description);
      setTimeout(() => this._triggerSupernova(), 600);
      return;
    }

    if (resolvedRxn.special === 'TRIPLE_ALPHA_COMPLETE') {
      clearInterval(this.s.taTimerInterval);
      clearTimeout(this.s.taTimer);
      if (typeof AudioManager !== 'undefined') AudioManager.stopTripleAlphaAlarm();
      this.e.rxnDesc.style.color = '';
      this.s.paused = false;
      this._resumeAllPausedNuclei();
      this.s.tripleAlpha = false;
      this.e.reactor.classList.remove('ta-mode');
      AudioManager.playFuseSuccess();
      this._applyFusion(resolvedRxn.products, n1, n2, resolvedRxn.Q_MeV, resolvedRxn.description);
      return;
    }

    AudioManager.playFuseSuccess();
    this._applyFusion(resolvedRxn.products, n1, n2, resolvedRxn.Q_MeV, resolvedRxn.description);
  },

  _genericFuse(n1, n2) {
    const newZ = n1.Z + n2.Z, newA = n1.A + n2.A;
    const key  = Physics.findIsotope(newZ, newA);
    if (!key) {
      AudioManager.playFuseFail();
      this._msg('Fusão Falhou', `Produto desconhecido (Z=${newZ}, A=${newA}).`, 'danger');
      this._ejectForge(); return;
    }
    const Q = Physics.qValue([n1.key, n2.key], [key]);
    if (newA > 56) {
      const extra = Math.abs(Q) * MEV_TO_ENERGY * 2;
      this._energy(-extra);
      this._msg('Fusão Endotérmica', `Além do pico de ferro! Perdidos ${extra.toFixed(0)} ⚡`, 'danger');
      this._applyFusion([key], n1, n2, Q);
      return;
    }
    this._applyFusion([key], n1, n2, Q);
  },

  _applyFusion(productKeys, n1, n2, Q_MeV, specificDescription) {
    const cx = window.innerWidth/2, cy = window.innerHeight/2;
    this._flash('rgba(255,200,50,.2)');

    const gain = (Q_MeV || 0) * MEV_TO_ENERGY;
    
    this.s.locked = true;
    this.e.fuseBtn.disabled = true;
    
    // Add fusion animation
    if (n1 && n1.el) {
      n1.el.classList.add('fusing');
      if (typeof n1.pauseDecay === 'function') n1.pauseDecay();
    }
    if (n2 && n2.el) {
      n2.el.classList.add('fusing');
      if (typeof n2.pauseDecay === 'function') n2.pauseDecay();
    }

    setTimeout(() => {
      if (gain) {
        this._energy(gain);
        this._float(cx, cy-50, Physics.fmt(gain), gain>=0?'#00e676':'#ff1744');
      }

      const rHtml = [n1?.key, n2?.key].filter(Boolean).map(k => this._isoHtml(k)).join(' + ');
      const pHtml = productKeys.map(k => this._isoHtml(k)).join(' + ');
      const eqHtml = `${rHtml} &rarr; ${pHtml}`;

      this._clearForge();
      this.s.locked = false; // UNLOCK BEFORE adding products

      productKeys.forEach((key, i) => {
        if (!ISOTOPES[key]) return;
        // Spawn products slightly offset or in center. _addToForge will re-distribute them
        // Wait, some products (like free neutrons) shouldn't be added to the forge!
        const nuc = this._spawn(key, window.innerWidth/2 + (i*10), window.innerHeight/2 + (i*10));
        if (!nuc) return;
        
        nuc.isProduct = true; // allow bypass capacity
        
        this._addToForge(nuc);
        if (this.s.paused) {
          nuc.pauseDecay();
        }
        
        nuc.isProduct = false;
        if (nuc.isGoal) {
          setTimeout(() => this._triggerSupernova(), 600);
        }
      });

      const qStr = Q_MeV !== undefined ? ` (${Q_MeV > 0 ? '+' : ''}${Q_MeV.toFixed(3)} MeV)` : '';
      const fullEqHtml = `${eqHtml}${qStr}`;
      
      if (specificDescription) {
         this._msg(fullEqHtml, specificDescription, 'success');
      } else {
         this._msg(fullEqHtml, '', 'success');
      }
      
      this._checkMissions(productKeys, specificDescription || '');
      this._ui();
      this._checkOver();
    }, 1500); // Slow motion delay
  },

  // ── Triple-alpha ──────────────────────────────────────────────────────────
  _activateTripleAlpha() {
    const s = this.s;
    s.tripleAlpha = true;
    this.s.paused = true; // PAUSE THE GAME
    this.e.reactor.classList.add('ta-mode');
    
    setTimeout(() => {
      if (typeof AudioManager !== 'undefined' && this.s.tripleAlpha) AudioManager.startTripleAlphaAlarm();
    }, 1500);

    this._msg('Ressonância de Hoyle', 'Be-8 formado! O tempo foi pausado por 10s. Arraste a 3ª partícula alfa (He-4)!', 'special');

    // Be-8 is now in inventory – mark it
    const be8 = s.nuclei.find(n=>n.key==='Be-8'&&!n.inReactor);
    if (be8) be8.el && be8.el.classList.add('be8-alert');

    // Resume time after 10s if still paused and in tripleAlpha mode
    let timeLeft = 10;
    this.e.rxnDesc.innerHTML = `O Berílio-8 decai quase instantaneamente, então o tempo está pausado em: ${timeLeft} s... - SEJA RÁPIDO!`;
    this.e.rxnDesc.style.color = '#ff9800';
    this.e.rxnQ.textContent = '';
    
    s.taTimerInterval = setInterval(() => {
      timeLeft--;
      if (timeLeft > 0 && s.tripleAlpha) {
        this.e.rxnDesc.innerHTML = `O Berílio-8 decai quase instantaneamente, então o tempo está pausado em: ${timeLeft} s... - SEJA RÁPIDO!`;
      }
    }, 1000);

    s.taTimer = setTimeout(() => {
      clearInterval(s.taTimerInterval);
      if (typeof AudioManager !== 'undefined') AudioManager.stopTripleAlphaAlarm();
      this.e.rxnDesc.style.color = '';
      if (this.s.paused && this.s.tripleAlpha) {
        this.s.paused = false;
        this._resumeAllPausedNuclei();
        this.s.tripleAlpha = false;
        this.e.reactor.classList.remove('ta-mode');
        this._msg('Tempo Esgotado', 'O tempo voltou ao normal! O Be-8 vai decair rapidamente!', 'warning');
        this._updateRxnInfo();
      }
    }, 10000);
  },

  _checkTripleAlphaState() {
    const s = this.s;
    if (!s.tripleAlpha) return;
    const hasBe8 = s.nuclei.some(n => n.key === 'Be-8');
    if (!hasBe8) {
      clearInterval(s.taTimerInterval);
      clearTimeout(s.taTimer);
      if (typeof AudioManager !== 'undefined') AudioManager.stopTripleAlphaAlarm();
      this.e.rxnDesc.style.color = '';
      s.tripleAlpha = false;
      this.e.reactor.classList.remove('ta-mode');
      // O Be-8 sumiu por um caminho que não é nem a conclusão
      // nem o timeout do Triplo-Alfa (ex: fissão, drag para fora, etc).
      // Sem isto, s.paused ficaria travado em true para sempre, e todo
      // produto de fusão futuro nasceria com o decaimento congelado.
      if (s.paused) {
        s.paused = false;
        this._resumeAllPausedNuclei();
      }
      this._updateRxnInfo();
    }
  },

  // Reativa o decaimento de qualquer núcleo que ficou congelado
  // enquanto s.paused estava true (ex: janela do Triplo-Alfa).
  _resumeAllPausedNuclei() {
    this.s.nuclei.forEach(n => {
      if (n._remainingDecay !== null && n._remainingDecay !== undefined) {
        n.resumeDecay();
      }
    });
  },

  _completeTripleAlpha(be8, he4) {
    this._flash('rgba(200,80,255,.35)');
    this._msg('PROCESSO TRIPLO-ALFA', 'Be-8 + He-4 fundiram em C-12!', 'victory');
    const rxn = REACTIONS['Be-8+He-4'];

    // Reset triple-alpha state
    clearInterval(this.s.taTimerInterval);
    clearTimeout(this.s.taTimer);
    if (typeof AudioManager !== 'undefined') AudioManager.stopTripleAlphaAlarm();
    this.e.rxnDesc.style.color = '';
    
    this.s.tripleAlpha = false;
    this.e.reactor.classList.remove('ta-mode');

    if (this.s.paused) {
      this.s.paused = false;
      this._resumeAllPausedNuclei();
    }

    this._updateMissionProgress('ta', 2); // 2/2 (C-12 formed)
    this._completeMission('ta', 'Processo Triplo-Alfa', 100);
    this._applyFusion(rxn.products, be8, he4, rxn.Q_MeV);
  },



  // ── Fission ───────────────────────────────────────────────────────────────
  _toggleFissionMode() {
    const s = this.s;
    if (s.forge.length) {
      this._msg('Ação Negada', 'Ejete os isótopos do reator antes da fissão.', 'warning'); return;
    }
    s.fissionMode = !s.fissionMode;
    this.e.fissBtn.classList.toggle('active', s.fissionMode);
    if (s.fissionMode) {
      this._msg('Modo Fissão', 'Clique num isótopo (A≥8) para quebrá-lo.', 'danger');
      s.nuclei.filter(n=>n.A>=8&&!n.inReactor).forEach(n=>n.highlightFission(true));
    } else {
      s.nuclei.forEach(n=>n.highlightFission(false));
    }
  },

  onNucleusClick(nuc) {
    const s = this.s;
    if (s.fissionMode && nuc.A>=8 && !nuc.inReactor) {
      const result = Physics.fission(nuc);
      if (!result) { this._msg('Fissão Inválida', 'Isótopo muito leve para fissar.', 'warning'); return; }

      this._flash('rgba(255,100,0,.3)');
      this._float(nuc.x, nuc.y,'💥 FISSÃO!','#ff6d00');
      const ox=nuc.x, oy=nuc.y;
      this._removeNucleus(nuc);

      result.products.forEach((key,i)=>{
        const p={x:ox+(i?50:-50),y:oy+(Math.random()-.5)*40};
        this._spawn(key,p.x,p.y);
      });
      for (let i=0;i<result.neutrons;i++) {
        const p=this._randPos(i,result.neutrons);
        this._spawn('n',p.x,p.y);
      }
      this._energy(result.energyGain);
      const rHtml = this._isoHtml(nuc.key);
      const nStr = result.neutrons > 0 ? ` + ${result.neutrons}<sup>1</sup>n` : '';
      const pHtml = result.products.map(k => this._isoHtml(k)).join(' + ') + nStr;
      const eqHtml = `${rHtml} &rarr; ${pHtml} (+${result.energyGain.toFixed(0)} ⚡)`;
      this._msg(eqHtml, `Fissão`, 'warning');

      s.fissionMode = false;
      this.e.fissBtn.classList.remove('active');
      s.nuclei.forEach(n=>n.highlightFission(false));
      this._ui();
    }
  },

  // ── Decay ─────────────────────────────────────────────────────────────────
  onNucleusDecay(nucleus) {
    const s = this.s;
    if (!s.nuclei.includes(nucleus)) return;

    AudioManager.playDecay();

    const dp  = Physics.decayProducts(nucleus);
    const ox  = nucleus.x, oy = nucleus.y;
    const wasInForge = nucleus.inReactor;

    this._float(ox, oy, `☢ ${nucleus.decayMode||'decay'}`, '#ff6d00');
    this._removeNucleus(nucleus);

    dp.products.forEach((key,i)=>{
      const px = ox+(i?25:-25)+(Math.random()-.5)*30;
      const py = oy+(Math.random()-.5)*30;
      const nuc2 = this._spawn(key, px, py);
      if (wasInForge && nuc2) {
        nuc2.isProduct = true;
        this._addToForge(nuc2);
        nuc2.isProduct = false;
      }
      if (nuc2?.isGoal) {
        setTimeout(() => this._triggerSupernova(), 500);
      }
    });

    if (dp.particleEmitted==='e+') {
      const ex=ox+(Math.random()-.5)*70, ey=oy+(Math.random()-.5)*70;
      const pos2=this._spawn('e+',ex,ey);
      if (wasInForge && pos2) {
        pos2.isProduct = true;
        this._addToForge(pos2);
        pos2.isProduct = false;
      } else if(pos2) {
        this._attractAndAnnihilate(pos2);
      }
    } else if (dp.particleEmitted==='He-4') {
      const p=this._randPos(0,1);
      const he4 = this._spawn('He-4',p.x,p.y);
      if (wasInForge && he4) {
        he4.isProduct = true;
        this._addToForge(he4);
        he4.isProduct = false;
      }
    } else if (nucleus.decayMode === 'EC') {
      if (s.bgElectrons && s.bgElectrons.length > 0) {
        const elc = s.bgElectrons.pop();
        if (elc) {
          this._removeNucleus(elc);
          this._float(ox, oy - 25, '-1 e⁻ (Captura)', '#00ffff');
        }
      }
    }

    let rHtml = this._isoHtml(nucleus.key);
    if (nucleus.decayMode === 'EC') {
      rHtml += ' + ' + this._isoHtml('e-');
    }

    let pHtml = dp.products.map(k => this._isoHtml(k)).join(' + ');
    if (dp.particleEmitted) {
      if (pHtml.length > 0) pHtml += ' + ';
      pHtml += this._isoHtml(dp.particleEmitted);
    }
    
    const eqHtml = `${rHtml} &rarr; ${pHtml}`;
    this._msg(eqHtml, `Decaimento ${nucleus.decayMode}`, 'warning');
    
    this._checkMissions(dp.products, `Decaimento de ${nucleus.name}`);
    this._ui();
    this._checkOver();
  },

  _fastForwardDecay() {
    let nextNuc = null;
    let minTime = Infinity;
    this.s.nuclei.forEach(n => {
      // Find the next unstable nucleus. Fallback to Date.now if _decayStartTime is somehow missing.
      if (!n.isStable) {
        const t = (n._decayStartTime || Date.now()) + n.halfLife_ms;
        if (t < minTime) { minTime = t; nextNuc = n; }
      }
    });
    if (nextNuc) {
      AudioManager.playFastForward();
      nextNuc.stopDecay();
      this.onNucleusDecay(nextNuc);
    } else {
      this._msg('Acelerar o Tempo', 'Nenhum isótopo instável presente no momento.', 'warning');
    }
  },

  _attractAndAnnihilate(nuc) {
    if (!nuc || !nuc.isAntiparticle) return false;
    let nearestElec = null;
    let minDist = Infinity;
    this.s.bgElectrons.forEach(elc => {
      if (!elc.el) return;
      const ex = elc.x + elc.el.offsetWidth/2;
      const ey = elc.y + elc.el.offsetHeight/2;
      const d = Math.hypot(nuc.x + nuc.el.offsetWidth/2 - ex, nuc.y + nuc.el.offsetHeight/2 - ey);
      if (d < minDist) { minDist = d; nearestElec = elc; }
    });
    
    if (nearestElec) {
      this.s.locked = true;
      if (nuc.pauseDecay) nuc.pauseDecay();
      nuc.setPosition(nuc.x, nuc.y);
      nearestElec.el.style.transition = 'left 0.5s ease-in, top 0.5s ease-in';
      nearestElec.setPosition(nuc.x, nuc.y);
      setTimeout(() => {
        this._annihilate(nuc);
        this._removeNucleus(nearestElec);
        this.s.bgElectrons = this.s.bgElectrons.filter(e => e !== nearestElec);
        this.s.locked = false;
      }, 500);
      return true;
    } else {
      setTimeout(() => this._annihilate(nuc), 50);
      return false;
    }
  },

  // ── Positron annihilation ──────────────────────────────────────────────────
  _annihilate(pos) {
    const s = this.s;
    if (s.electrons > 0) {
      AudioManager.playAnnihilation();
      s.electrons--;
      const bonus = 1.022 * MEV_TO_ENERGY;
      this._energy(bonus);
      this._flash('rgba(255,255,80,.45)');
      const x = pos.el ? parseInt(pos.el.style.left) : window.innerWidth/2;
      const y = pos.el ? parseInt(pos.el.style.top)  : window.innerHeight/2;
      this._float(x, y, '+1.022 MeV 💫','#ffd600');
      this._msg('e<sup>+</sup> + e<sup>-</sup> &rarr; 2&gamma; (+1.022 MeV)', '', 'success');
      this._removeNucleus(pos);
    } else {
      this._msg('Alerta', 'Pósitron aniquilado sem elétron disponível no vácuo!', 'warning');
    }
    this._ui();
  },

  // ── Nucleus helpers ────────────────────────────────────────────────────────
  _spawn(key, x, y) {
    if (!ISOTOPES[key]) return null;
    x = Math.max(10, Math.min(x, window.innerWidth-100));
    y = Math.max(10, Math.min(y, window.innerHeight-100));
    const nuc = new Nucleus(key, x, y);
    this.s.nuclei.push(nuc);
    return nuc;
  },

  _removeNucleus(nuc) {
    const s = this.s;
    const i  = s.nuclei.indexOf(nuc);
    if (i !== -1) s.nuclei.splice(i, 1);
    const fi = s.forge.indexOf(nuc);
    if (fi !== -1) s.forge.splice(fi, 1);
    nuc.remove();
    this._updateForgeUI();
    this._updateFuseBtn();
  },

  // ── Energy ────────────────────────────────────────────────────────────────
  _energy(delta) {
    this.s.energy = Math.max(0, Math.min(INITIAL_ENERGY, this.s.energy + delta));
    this._renderBar();
  },

  _renderBar() {
    const pct = (this.s.energy / INITIAL_ENERGY) * 100;
    this.e.barFill.style.width    = pct + '%';
    this.e.barPct.textContent     = Math.round(pct) + '%';
    this.e.barFill.classList.remove('critical','low');
    
    if (pct > 0 && pct <= 15) {
      this.e.barFill.classList.add('critical');
      AudioManager.startDangerAlarm();
    } else {
      AudioManager.stopDangerAlarm();
    }
    if (pct > 15 && pct <= 35) this.e.barFill.classList.add('low');
  },

  // ── Missions ───────────────────────────────────────────────────────────────
  _updateMissionProgress(id, step) {
    const s = this.s;
    if (!s.missions || !s.missions[id] || s.missions[id].done) return;
    
    // Only go forward
    if (step <= s.missions[id].step) return;
    s.missions[id].step = step;
    
    const pct = Math.floor((step / s.missions[id].max) * 100);
    const el = document.getElementById(`mission-${id}`);
    if (el) {
      const prog = el.querySelector('.mission-progress');
      if (prog) prog.style.width = `${pct}%`;
      const rew = el.querySelector('.mission-reward');
      if (rew) rew.textContent = `${pct}%`;
    }
  },

  _checkMissions(products, description) {
    const s = this.s;
    if (!s.missions) return;

    // 1. Cadeia p-p
    if (!s.missions.pp.done) {
      if (products.includes('He-2')) this._updateMissionProgress('pp', 1);
      if (products.includes('He-3')) this._updateMissionProgress('pp', 2);
      if (products.includes('He-4') && description.match(/pp/i)) {
        this._updateMissionProgress('pp', 3);
        this._completeMission('pp', 'Cadeia PP', 50);
      }
    }

    // 2. Triplo-Alfa
    if (!s.missions.ta.done) {
      if (products.includes('Be-8')) this._updateMissionProgress('ta', 1);
      if (products.includes('C-12') && description.match(/Triplo/i)) {
        this._updateMissionProgress('ta', 2);
        this._completeMission('ta', 'Triplo-Alfa', 100);
      }
    }

    // 3. Ciclo CNO
    if (!s.missions.cno.done) {
      if (products.includes('N-13')) this._updateMissionProgress('cno', 1);
      if (products.includes('C-13')) this._updateMissionProgress('cno', 2);
      if (products.includes('N-14')) this._updateMissionProgress('cno', 3);
      if (products.includes('O-15')) this._updateMissionProgress('cno', 4);
      if (products.includes('N-15')) this._updateMissionProgress('cno', 5);
      if (products.includes('C-12') && products.includes('He-4') && description.match(/cno/i)) {
        this._updateMissionProgress('cno', 6);
        this._completeMission('cno', 'Ciclo CNO', 150);
      }
    }

    // 4. Fusão D-T
    if (!s.missions.dt.done) {
      // Step 1: Formar Deutério (H-2) ou começar a fusão D-D
      if (products.includes('H-2') || description.match(/Fusão D-D/i)) this._updateMissionProgress('dt', 1);
      // Step 2: Formar Trítio (H-3)
      if (products.includes('H-3')) this._updateMissionProgress('dt', 2);
      // Step 3: Concluir Fusão D-T
      if (products.includes('He-4') && products.includes('n') && description.match(/D-T/i)) {
        this._updateMissionProgress('dt', 3);
        this._completeMission('dt', 'Fusão D-T', 200);
      }
    }

    // 5. Escada Alfa
    if (!s.missions.ladder.done && description && description.match(/Captura alfa/i)) {
      if (products.includes('O-16') && s.missions.ladder.step === 0) this._updateMissionProgress('ladder', 1);
      if (products.includes('Ne-20') && s.missions.ladder.step === 1) this._updateMissionProgress('ladder', 2);
      if (products.includes('Mg-24') && s.missions.ladder.step === 2) this._updateMissionProgress('ladder', 3);
      if (products.includes('Si-28') && s.missions.ladder.step === 3) {
        this._updateMissionProgress('ladder', 4);
        this._completeMission('ladder', 'Escada Alfa', 300);
      }
    }

    // 6. Choque de Titãs
    if (!s.missions.titans.done && description) {
      if (description.match(/Queima de carbono/i)) {
        s.missions.titans.c_done = true;
      }
      if (description.match(/Queima de oxig.nio/i)) {
        s.missions.titans.o_done = true;
      }
      
      let completed_parts = 0;
      if (s.missions.titans.c_done) completed_parts++;
      if (s.missions.titans.o_done) completed_parts++;

      if (completed_parts > s.missions.titans.step) {
        this._updateMissionProgress('titans', completed_parts);
      }

      if (s.missions.titans.c_done && s.missions.titans.o_done) {
        this._completeMission('titans', 'Choque de Titãs', 500);
      }
    }

    // 7. Queima Si+Si
    if (!s.missions.sisi.done) {
      // Step 1: Formar Silício
      if (products.includes('Si-28')) this._updateMissionProgress('sisi', 1);
      
      if (products.includes('Ni-56') || products.includes('Fe-56')) {
        this._updateMissionProgress('sisi', 2);
        this._completeMission('sisi', 'O Último Suspiro', 1000);
      }
    }
    
    // 8. Maldição do Ferro
    if (!s.missions.iron.done) {
      if (products.includes('Fe-56')) this._updateMissionProgress('iron', 1);
      // step 2 is triggered inside supernova
    }
  },

  _completeMission(id, name, reward) {
    this.s.missions[id].done = true;
    const el = document.getElementById(`mission-${id}`);
    if (el) {
      el.classList.add('completed');
      const rew = el.querySelector('.mission-reward');
      if (rew) rew.textContent = `⚡${reward}`;
    }
    
    AudioManager.playMissionComplete();
    
    if (reward > 0) this._energy(reward);
    this._msg('🏆 Missão Concluída!', `${name} finalizada! Bônus de ${reward}⚡ recebido.`, 'victory');
    this._flash('rgba(0, 230, 118, 0.35)');
  },

  // ── Game Over / Victory ────────────────────────────────────────────────────
  _triggerSupernova() {
    this._updateMissionProgress('iron', 2);
    this._completeMission('iron', 'Maldição do Ferro', 0);
    
    // Visual Effects
    const targetShake = document.getElementById('game-board') || document.body;
    targetShake.classList.add('supernova-shake');
    const flash = document.createElement('div');
    flash.className = 'supernova-flash';
    document.body.appendChild(flash);
    
    this._msg('FIM DOS TEMPOS', 'A estrela colapsou em uma SUPERNOVA!', 'special');
    
    setTimeout(() => {
      targetShake.classList.remove('supernova-shake');
      this._victory();
    }, 4000);
  },

  _checkOver() {
    if (this.s.energy <= 0 && !this.s.won && !this.s.over) {
      this.s.over = true;
      
      const targetShake = document.getElementById('game-board') || document.body;
      targetShake.classList.add('supernova-shake'); // Efeito visual de colapso
      this._msg('COLAPSO', 'O reator apagou por falta de energia!', 'danger');
      
      setTimeout(()=> {
        targetShake.classList.remove('supernova-shake');
        this.e.defeatScr.classList.remove('hidden');
      }, 1500);
    }
  },

  _victory() {
    if (this.s.won) return;
    this.s.won = true;
    this._flash('rgba(255,215,0,.5)');
    setTimeout(()=>this.e.victoryScr.classList.remove('hidden'), 900);
  },

  // ── Global UI refresh ─────────────────────────────────────────────────────
  _ui() {
    this._checkTripleAlphaState();
    this._renderBar();
    this.e.electrons.textContent = this.s.electrons;
    this._updateCoulomb();
    this._updateRxnInfo();
  },

  // ── Visual effects ────────────────────────────────────────────────────────
  _isoHtml(k) {
    if (!k) return '';
    if (k === 'gamma' || k === 'γ') return '&gamma;';
    if (k === 'e+') return 'e<sup>+</sup>';
    if (k === 'e-') return 'e<sup>&minus;</sup>';
    if (k === 'n') return '<sup>1</sup>n';
    const iso = ISOTOPES[k];
    if (iso) return `<sup>${iso.A}</sup>${iso.symbol}`;
    return k;
  },

  _float(x, y, text, color) {
    const d = document.createElement('div');
    d.className = 'floating-text';
    d.style.cssText = `left:${x}px;top:${y}px;color:${color||'#fff'};`;
    d.textContent   = text;
    this.e.board.appendChild(d);
    setTimeout(()=>d.remove(), 1600);
  },

  _flash(color) {
    const f = document.createElement('div');
    f.className       = 'screen-flash';
    f.style.background = color || 'rgba(255,255,255,.25)';
    document.body.appendChild(f);
    setTimeout(()=>f.remove(), 600);
  },

  _msg(action, result='', type='info') {
    const s = this.s;
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');

    if (!s.recentMsgs) s.recentMsgs = [];

    let foundMsg = null;
    for (let i = 0; i < s.recentMsgs.length; i++) {
      if (s.recentMsgs[i].action === action && s.recentMsgs[i].result === result) {
        foundMsg = s.recentMsgs[i];
        break;
      }
    }

    if (foundMsg) {
      foundMsg.count++;
      const badge = foundMsg.el.querySelector('.hist-badge');
      if (badge) {
        badge.textContent = foundMsg.count + 'x';
        badge.style.display = 'inline-block';
      } else {
        const b = document.createElement('span');
        b.className = 'hist-badge';
        b.textContent = foundMsg.count + 'x';
        foundMsg.el.querySelector('.hist-head').appendChild(b);
      }
      
      foundMsg.el.style.animation = 'none';
      foundMsg.el.offsetHeight; 
      foundMsg.el.style.animation = null;
      
      foundMsg.el.querySelector('.history-time').textContent = `${hh}:${mm}`;
      
      if (this.e.historyList.firstChild !== foundMsg.el) {
        this.e.historyList.prepend(foundMsg.el);
        s.recentMsgs = s.recentMsgs.filter(m => m !== foundMsg);
        s.recentMsgs.unshift(foundMsg);
      }
      return;
    }

    const m = document.createElement('div');
    m.className   = `history-item ${type==='info'?'':type}`;
    
    let html = `
      <div class="hist-head">
        <span class="history-time">${hh}:${mm}</span>
        <span class="hist-action">${action}</span>
      </div>
    `;
    if (result) {
      html += `<div class="hist-result">${result}</div>`;
    }
    
    m.innerHTML = html;
    
    this.e.historyList.prepend(m);
    
    const newMsgObj = { action, result, count: 1, el: m };
    s.recentMsgs.unshift(newMsgObj);
    if (s.recentMsgs.length > 5) s.recentMsgs.pop();
    
    while (this.e.historyList.children.length > 50) {
      this.e.historyList.lastChild.remove();
    }
  },
};

window.Game = Game;
document.addEventListener('DOMContentLoaded', () => Game.init());

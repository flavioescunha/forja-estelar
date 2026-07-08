'use strict';

// ── Nucleus ──────────────────────────────────────────────────────────────────
// Represents one isotope on-screen. Manages its own DOM element, drag events,
// decay timers, and tooltip.
class Nucleus {
  constructor(key, x, y) {
    const data = ISOTOPES[key];
    if (!data) throw new Error(`Unknown isotope: ${key}`);

    this.id            = `n_${Date.now()}_${Math.random().toString(36).slice(2,7)}`;
    this.key           = key;
    this.isotope       = data;
    this.Z             = data.Z;
    this.N             = data.N;
    this.A             = data.A;
    this.symbol        = data.symbol;
    this.name          = data.name;
    this.mass_u        = data.mass_u;
    this.isStable      = data.isStable;
    this.halfLife_ms   = Physics.getGameHalfLifeMs(data.realHalfLife_s) || data.halfLife_ms || 0;
    this.decayMode     = data.decayMode    || null;
    this.isAntiparticle= data.isAntiparticle || false;
    this.isGoal        = data.isGoal       || false;
    this.specialRole   = data.specialRole  || null;

    this.x   = x;
    this.y   = y;
    this.inReactor = false;

    this._decayTimer      = null;
    this._blinkTimer      = null;
    this._decayStartTime  = null;
    this._remainingDecay  = null;

    this.el         = null;
    this._tooltipEl = null;

    this._buildDOM();
    this._bindEvents();

    if (!this.isStable && this.halfLife_ms > 0) {
      this._startDecay();
    }
  }

  // ── DOM construction ──────────────────────────────────────────────────────
  _buildDOM() {
    const div = document.createElement('div');
    div.className  = 'atom';
    div.id         = this.id;
    div.style.left = this.x + 'px';
    div.style.top  = this.y + 'px';

    if (this.isotope.isElementary) {
      this._buildElementary(div);
    } else if (this.A < 6) {
      this._buildCluster(div);
    } else {
      this._buildSphere(div);
    }

    if (!this.isStable) {
      div.classList.add('unstable');
      
      const barContainer = document.createElement('div');
      barContainer.className = 'decay-bar-container';
      
      const barFill = document.createElement('div');
      barFill.className = 'decay-bar-fill';
      barContainer.appendChild(barFill);
      
      div.appendChild(barContainer);
      this._decayFill = barFill;
    }
    
    if (this.specialRole === 'TRIPLE_ALPHA') div.classList.add('be8-alert');
    if (this.isGoal) div.classList.add('goal-achieved');

    this.el = div;
    document.getElementById('inventory').appendChild(div);
  }

  _buildElementary(div) {
    div.classList.add('atom-elementary');
    const size = 18;
    div.style.width = size + 'px';
    div.style.height = size + 'px';
    div.style.borderRadius = '50%';
    
    const p = document.createElement('div');
    p.className = `particle ${this.isotope.type}`;
    p.style.width = size + 'px';
    p.style.height = size + 'px';
    p.style.left = '0px';
    p.style.top = '0px';
    
    const sym = document.createElement('span');
    sym.className = 'element-symbol';
    sym.textContent = this.symbol;
    sym.style.fontSize = '9px';
    sym.style.position = 'absolute';
    sym.style.top = '50%';
    sym.style.left = '50%';
    sym.style.transform = 'translate(-50%, -50%)';
    sym.style.color = '#000';
    sym.style.fontWeight = 'bold';
    
    p.appendChild(sym);
    div.appendChild(p);
  }

  _buildCluster(div) {
    div.classList.add('atom-cluster');
    const rParticle = 8;
    const dParticle = rParticle * 2;
    const total = Math.max(this.Z + this.N, 1);
    
    // Fib spiral calculation
    const phi = Math.PI * (3 - Math.sqrt(5));
    const R_max = Math.sqrt(total) * (rParticle * 1.1);
    const R_padded = Math.max(R_max + rParticle + 4, 18); // Ensure minimum size
    
    div.style.width  = (R_padded * 2) + 'px';
    div.style.height = (R_padded * 2) + 'px';

    const particles = [
      ...Array(this.Z).fill('proton'),
      ...Array(this.N).fill('neutron'),
    ];

    particles.forEach((type, i) => {
      const p = document.createElement('div');
      p.className = `particle ${type}`;
      p.style.width  = dParticle + 'px';
      p.style.height = dParticle + 'px';
      
      const radius = Math.sqrt(i + 0.5) * (rParticle * 1.1); 
      const angle = i * phi;
      
      const ox = (Math.random() - 0.5) * rParticle * 0.8;
      const oy = (Math.random() - 0.5) * rParticle * 0.8;
      
      const px = R_padded - rParticle + radius * Math.cos(angle) + ox;
      const py = R_padded - rParticle + radius * Math.sin(angle) + oy;
      
      p.style.left = px + 'px';
      p.style.top  = py + 'px';
      div.appendChild(p);
    });
  }

  _buildSphere(div) {
    div.classList.add('atom-sphere');
    const size = Math.round(Math.max(40, 26 + Math.pow(this.A, 0.5) * 4.2));
    const c    = this._elementColors();
    div.style.width = size + 'px';
    div.style.height = size + 'px';
    div.style.background = `radial-gradient(circle at 35% 30%,${c.light},${c.mid} 55%,${c.dark})`;
    div.style.boxShadow = `0 4px 14px rgba(0,0,0,.55),inset 0 2px 5px rgba(255,255,255,.18),0 0 10px ${c.glow}`;

    const sym = document.createElement('span');
    sym.className   = 'element-symbol';
    sym.textContent = this.symbol;
    sym.style.fontSize = Math.max(10, size * 0.33) + 'px';

    const mass = document.createElement('span');
    mass.className   = 'mass-number';
    mass.textContent = this.A;
    mass.style.fontSize = Math.max(7, size * 0.21) + 'px';

    div.appendChild(sym);
    div.appendChild(mass);
  }

  _elementColors() {
    const map = {
      6 :{ light:'#90a4ae', mid:'#546e7a', dark:'#263238', glow:'rgba(84,110,122,.4)' },
      7 :{ light:'#80cbc4', mid:'#00897b', dark:'#004d40', glow:'rgba(0,137,123,.4)'  },
      8 :{ light:'#81d4fa', mid:'#0288d1', dark:'#01579b', glow:'rgba(2,136,209,.4)'  },
      9 :{ light:'#f48fb1', mid:'#ad1457', dark:'#880e4f', glow:'rgba(173,20,87,.4)'  },
      10:{ light:'#ce93d8', mid:'#8e24aa', dark:'#4a148c', glow:'rgba(142,36,170,.4)' },
      11:{ light:'#ffcc80', mid:'#ef6c00', dark:'#bf360c', glow:'rgba(239,108,0,.4)'  },
      12:{ light:'#b0bec5', mid:'#78909c', dark:'#37474f', glow:'rgba(120,144,156,.4)'},
      13:{ light:'#ffe082', mid:'#ffa000', dark:'#ff6f00', glow:'rgba(255,160,0,.4)'  },
      14:{ light:'#d4a574', mid:'#a0785a', dark:'#6d4c41', glow:'rgba(160,120,90,.4)' },
      15:{ light:'#ff8a65', mid:'#e64a19', dark:'#bf360c', glow:'rgba(230,74,25,.4)'  },
      16:{ light:'#fff176', mid:'#fdd835', dark:'#f9a825', glow:'rgba(253,216,53,.4)' },
      17:{ light:'#a5d6a7', mid:'#43a047', dark:'#1b5e20', glow:'rgba(67,160,71,.4)'  },
      18:{ light:'#80cbc4', mid:'#26a69a', dark:'#004d40', glow:'rgba(38,166,154,.4)' },
      19:{ light:'#f48fb1', mid:'#e91e63', dark:'#880e4f', glow:'rgba(233,30,99,.4)'  },
      20:{ light:'#e8eaf6', mid:'#9fa8da', dark:'#5c6bc0', glow:'rgba(159,168,218,.4)'},
      21:{ light:'#d7ccc8', mid:'#a1887f', dark:'#6d4c41', glow:'rgba(161,136,127,.4)'},
      22:{ light:'#b2dfdb', mid:'#4db6ac', dark:'#00796b', glow:'rgba(77,182,172,.4)' },
      23:{ light:'#c5cae9', mid:'#5c6bc0', dark:'#283593', glow:'rgba(92,107,192,.4)' },
      24:{ light:'#cfd8dc', mid:'#90a4ae', dark:'#455a64', glow:'rgba(144,164,174,.4)'},
      25:{ light:'#ffb74d', mid:'#f57c00', dark:'#e65100', glow:'rgba(245,124,0,.4)'  },
      26:{ light:'#ff8a65', mid:'#d84315', dark:'#bf360c', glow:'rgba(216,67,21,.7)'  }, // Fe – special
      27:{ light:'#e1f5fe', mid:'#fb8c00', dark:'#ff6d00', glow:'rgba(255,235,59,.6)'  }, // Co
      28:{ light:'#dcedc8', mid:'#8bc34a', dark:'#33691e', glow:'rgba(139,195,74,.7)'  }, // Ni – green
    };
    return map[this.Z] || { light:'#eceff1', mid:'#b0bec5', dark:'#78909c', glow:'rgba(176,190,197,.4)' };
  }

  // ── Events ────────────────────────────────────────────────────────────────
  _bindEvents() {
    this.el.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this._hideTip();
      
      if (typeof AudioManager !== 'undefined') AudioManager.playPick();
      
      const offsetX = e.clientX - this.x;
      const offsetY = e.clientY - this.y;
      let moved = false;

      this.el.classList.add('dragging');
      this.el.setPointerCapture(e.pointerId);

      if (window.Game) window.Game.onDragStart(this);

      const onMove = (ev) => {
        if (Math.hypot(ev.clientX - e.clientX, ev.clientY - e.clientY) > 4) moved = true;
        this.setPosition(ev.clientX - offsetX, ev.clientY - offsetY);
        if (window.Game) window.Game.onDragMove(this, ev);
      };

      const onUp = (ev) => {
        this.el.classList.remove('dragging');
        this.el.removeEventListener('pointermove', onMove);
        this.el.removeEventListener('pointerup', onUp);
        this.el.releasePointerCapture(e.pointerId);

        if (!moved) {
          if (window.Game) window.Game.onNucleusClick(this);
        } else {
          if (window.Game) window.Game.onDrop(this, ev);
        }
      };

      this.el.addEventListener('pointermove', onMove);
      this.el.addEventListener('pointerup', onUp);
    });

    this.el.addEventListener('mouseenter', (e) => this._showTip(e));
    this.el.addEventListener('mouseleave', ()  => this._hideTip());
    this.el.addEventListener('mousemove',  (e) => this._moveTip(e));
  }

  // ── Tooltip ───────────────────────────────────────────────────────────────
  _formatTime(s) {
    if (!s) return '0s';
    if (s < 0.01) return s.toExponential(1).replace('+', '') + 's';
    if (s < 60) return s.toFixed(1) + 's';
    if (s < 3600) return (s / 60).toFixed(1) + 'm';
    if (s < 86400) return (s / 3600).toFixed(1) + 'h';
    if (s < 31536000) return (s / 86400).toFixed(1) + 'd';
    if (s > 31536000 * 1000) return (s / 31536000).toExponential(1).replace('+', '') + 'a';
    return (s / 31536000).toFixed(1) + 'a';
  }

  _showTip(e) {
    this._hideTip();
    const t   = document.createElement('div');
    t.className = 'atom-tooltip';
    
    let timeInfo = '';
    if (this.isStable) {
      timeInfo = '<span style="color:#00e676">Estável ✓</span>';
    } else {
      const realHl = this.isotope.realHalfLife_s !== undefined ? this.isotope.realHalfLife_s : (this.halfLife_ms / 1000);
      let hlStr = this._formatTime(realHl);
      let remStr = '';
      if (this._decayStartTime && this.halfLife_ms > 0) {
        const pct = Math.max(0, this.halfLife_ms - (Date.now() - this._decayStartTime)) / this.halfLife_ms;
        remStr = ' ' + this._formatTime(realHl * pct) + ' rest.';
      }
      timeInfo = `<span style="color:#ff6d00">Instável ⚠ T½=${hlStr}${remStr}</span>`;
    }

    t.innerHTML = `
      <div class="tt-name">${this.name} <sup>${this.A}</sup>${this.symbol}</div>
      <div class="tt-stats">Z=${this.Z} &nbsp; N=${this.N} &nbsp; A=${this.A}<br>
        ${this.mass_u.toFixed(6)} u<br>
        ${timeInfo}
      </div>`;
    document.body.appendChild(t);
    this._tooltipEl = t;
    this._moveTip(e);
  }
  _moveTip(e) {
    if (!this._tooltipEl) return;
    this._tooltipEl.style.left = Math.min(e.clientX+14, window.innerWidth-200)  + 'px';
    this._tooltipEl.style.top  = Math.min(e.clientY+14, window.innerHeight-120) + 'px';
  }
  _hideTip() {
    if (this._tooltipEl) { this._tooltipEl.remove(); this._tooltipEl = null; }
  }

  // ── Decay timers ──────────────────────────────────────────────────────────
  _startDecay(overrideMs) {
    const ms = overrideMs !== undefined ? overrideMs : this.halfLife_ms;
    this._decayStartTime = Date.now() - (this.halfLife_ms - ms);
    const blinkAfter = ms - this.halfLife_ms * 0.1;
    if (blinkAfter > 0) {
      this._blinkTimer = setTimeout(() => this.el && this.el.classList.add('blinking'), blinkAfter);
    } else {
      this.el && this.el.classList.add('blinking');
    }
    
    if (this._decayFill) {
      // Small timeout to allow browser to apply the 100% width before starting transition
      requestAnimationFrame(() => {
        if (!this._decayFill) return;
        this._decayFill.style.transition = `width ${ms}ms linear, background-color ${ms}ms linear`;
        this._decayFill.style.width = '0%';
        this._decayFill.style.backgroundColor = '#ff1744';
      });
    }

    const startBeeping = () => {
      if (typeof AudioManager !== 'undefined') AudioManager.playDecayBeep();
      this._beepInterval = setInterval(() => {
        if (typeof AudioManager !== 'undefined') AudioManager.playDecayBeep();
      }, 1000);
    };

    if (ms > 5000) {
      this._beepStartTimer = setTimeout(startBeeping, ms - 5000);
    } else {
      startBeeping();
    }

    this._decayTimer = setTimeout(() => {
      try {
        if (window.Game) {
          window.Game.onNucleusDecay(this);
        } else {
          alert("Erro: Game object não encontrado no window!");
        }
      } catch (e) {
        alert("Erro no decaimento de " + this.name + ": " + e.message);
        console.error('Decay failed', e);
      }
    }, ms);
  }

  stopDecay() {
    clearTimeout(this._decayTimer);
    clearTimeout(this._blinkTimer);
    clearTimeout(this._beepStartTimer);
    clearInterval(this._beepInterval);
    this._decayTimer = this._blinkTimer = this._beepStartTimer = this._beepInterval = null;
    if (this._decayFill) {
      const computedWidth = window.getComputedStyle(this._decayFill).width;
      const computedBgColor = window.getComputedStyle(this._decayFill).backgroundColor;
      this._decayFill.style.transition = 'none';
      this._decayFill.style.width = computedWidth;
      this._decayFill.style.backgroundColor = computedBgColor;
    }
  }

  // Reparentar o elemento (tirar/colocar na forja) interrompe a transição
  // CSS em andamento e faz a barra "pular" para o estado final (vazia).
  // O relógio real (_decayStartTime) não é afetado, só a barra visual.
  // Chamar isto logo após qualquer appendChild deste elemento para
  // recalcular a % correta e reiniciar a transição a partir dela.
  syncDecayBarAfterReparent() {
    if (!this._decayFill || this.isStable || !this._decayStartTime) return;
    const elapsed   = Date.now() - this._decayStartTime;
    const remaining = Math.max(0, this.halfLife_ms - elapsed);
    const pct       = this.halfLife_ms > 0 ? (remaining / this.halfLife_ms) * 100 : 0;

    this._decayFill.style.transition = 'none';
    this._decayFill.style.width = pct + '%';
    // Força o navegador a aplicar a largura acima antes de religar a
    // transição, senão as duas mudanças de estilo seriam agrupadas.
    void this._decayFill.offsetWidth;
    this._decayFill.style.transition = `width ${remaining}ms linear, background-color ${remaining}ms linear`;
    this._decayFill.style.width = '0%';
    this._decayFill.style.backgroundColor = '#ff1744';
  }

  pauseDecay() {
    if (!this._decayTimer) return;
    this._remainingDecay = Math.max(0, this.halfLife_ms - (Date.now() - this._decayStartTime));
    this.stopDecay();
  }

  resumeDecay() {
    if (this._remainingDecay === null) return;
    this._startDecay(this._remainingDecay);
    this._remainingDecay = null;
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  setPosition(x, y) {
    this.x = x; this.y = y;
    if (this.el) { this.el.style.left = x+'px'; this.el.style.top = y+'px'; }
  }

  halfSize() {
    if (!this.el) return 20;
    return Math.max(this.el.offsetWidth, this.el.offsetHeight) / 2;
  }

  highlightFission(on) {
    if (!this.el) return;
    this.el.style.outline    = on ? '2px solid rgba(255,23,68,.9)' : '';
    this.el.style.boxShadow  = on ? '0 0 16px rgba(255,23,68,.5)' : '';
  }

  remove() {
    this.stopDecay();
    this._hideTip();
    if (this.el) { this.el.remove(); this.el = null; }
  }
}

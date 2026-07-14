// Diagrama H-R Lógica
const hrDiagram = {
  panel: null,
  starMarker: null,
  massInput: null,

  // Valores base do Sol
  baseMu: 0.61, // Peso molecular médio aproximado do Sol (X=0.73, Y=0.25, Z=0.02)
  baseTemp: 5800, // K
  
  init: function() {
    this.panel = document.getElementById('hr-panel');
    this.starMarker = document.getElementById('hr-star-marker');
    this.massInput = document.getElementById('star-mass-input');

    if (!this.panel || !this.starMarker || !this.massInput) return;

    // Zoom event
    this.panel.addEventListener('click', (e) => {
      if (e.target === this.massInput || e.target.tagName.toLowerCase() === 'label') return; 
      const isZoomed = this.panel.classList.toggle('hr-zoomed');
      
      // Mover para o body para evitar bug de position: fixed dentro de transform
      if (isZoomed) {
        document.body.appendChild(this.panel);
      } else {
        document.getElementById('controls-panel').appendChild(this.panel);
      }
    });

    this.massInput.addEventListener('input', () => {
      this.updatePosition();
    });

    // Iniciar
    setTimeout(() => this.updatePosition(), 500); // small delay to let game load
    
    // Atualizar periodicamente para refletir a criação/destruição de átomos
    setInterval(() => this.updatePosition(), 1000);
  },

  updatePosition: function() {
    let m = parseFloat(this.massInput.value);
    if (isNaN(m) || m <= 0) m = 1;

    // 1. Identificar a estrela escolhida
    let starId = "sol";
    let starSelect = document.getElementById('star-select');
    if (starSelect) starId = starSelect.value;

    // Valores reais base para cada estrela (Luminosidade em L_sol, Temp em K, Massa em M_sol)
    let baseL = 1;
    let baseT = 5800;
    let baseM = 1.0;
    switch(starId) {
      case 'proxima':    baseL = 0.0017;  baseT = 3042;  baseM = 0.12; break;
      case 'deneb':      baseL = 196000;  baseT = 8525;  baseM = 19.0; break;
      case 'aldebaran':  baseL = 425;     baseT = 3910;  baseM = 1.16; break;
      case 'betelgeuse': baseL = 126000;  baseT = 3600;  baseM = 16.5; break;
      case 'procyon_b':  baseL = 0.00049; baseT = 7740;  baseM = 0.6;  break;
      case 'eridani_b':  baseL = 0.013;   baseT = 16500; baseM = 0.5;  break;
      case 'sol':
      default:           baseL = 1;       baseT = 5800;  baseM = 1.0;  break;
    }

    // 2. Composição Inicial de Referência (A partir do INITIAL_INVENTORY)
    // Isso garante que no início do jogo, os multiplicadores sejam exatamente 1.0
    let ref_H = 0; let ref_He = 0; let ref_Z = 0; let ref_Total = 0;
    if (typeof INITIAL_INVENTORY !== 'undefined') {
      INITIAL_INVENTORY.forEach(key => {
        // Encontrar massa aproximada pelo nome (ex: "He-4" -> 4)
        let parts = key.split('-');
        let mass = parseInt(parts[1]) || 1;
        ref_Total += mass;
        if (key.startsWith('H-')) ref_H += mass;
        else if (key.startsWith('He-')) ref_He += mass;
        else ref_Z += mass;
      });
    }
    // Fallback caso falhe
    if (ref_Total === 0) { ref_H = 73; ref_He = 25; ref_Z = 2; ref_Total = 100; }

    let X0 = ref_H / ref_Total;
    let Y0 = ref_He / ref_Total;
    let Z0 = ref_Z / ref_Total;

    // 3. Composição Atual (A partir dos átomos vivos no jogo)
    let totalMass = 0;
    let H_mass = 0;
    let He_mass = 0;
    let Z_mass = 0;

    if (typeof Game !== 'undefined' && Game.s && Game.s.nuclei) {
      Game.s.nuclei.forEach(nuc => {
        // Ignora partículas que não são elementos químicos pesando na estrela
        if (!nuc.key || nuc.key === 'e-' || nuc.key === 'e+' || nuc.key === 'v' || nuc.key === 'gamma') return;
        
        let mass = nuc.A || 1;
        totalMass += mass;
        if (nuc.key.startsWith('H-')) H_mass += mass;
        else if (nuc.key.startsWith('He-')) He_mass += mass;
        else Z_mass += mass;
      });
    }

    if (totalMass === 0) {
      totalMass = ref_Total; H_mass = ref_H; He_mass = ref_He; Z_mass = ref_Z;
    }

    let X = H_mass / totalMass;
    let Y = He_mass / totalMass;
    let Z = Z_mass / totalMass;

    // 4. Multiplicadores de Evolução (Desvio da composição atual em relação à inicial)
    let mu = 1 / ((2 * X) + (0.75 * Y) + (0.5 * Z));
    let base_mu = 1 / ((2 * X0) + (0.75 * Y0) + (0.5 * Z0));

    let L_mult = Math.pow(mu / base_mu, 7.5);
    
    let current_expansion = 1 + (40 * Math.pow(Y, 3)) + (200 * Math.pow(Z, 2));
    let base_expansion = 1 + (40 * Math.pow(Y0, 3)) + (200 * Math.pow(Z0, 2));
    let R_mult = current_expansion / base_expansion;

    let T_mult = Math.pow(L_mult / Math.pow(R_mult, 2), 0.25);

    // 5. Aplicação Final: Posição Base * Efeito da Massa (Input) * Evolução do Jogador
    let mass_ratio = m / baseM;
    let final_L = baseL * Math.pow(mass_ratio, 3.5) * L_mult;
    let final_T = baseT * Math.pow(mass_ratio, 0.475) * T_mult;

    // DEBUG VISUAL PARA O USUÁRIO
    let debug = document.getElementById('hr-debug');
    if (!debug) {
      debug = document.createElement('div');
      debug.id = 'hr-debug';
      debug.style = 'position:absolute; bottom:0; left:0; font-size:10px; color:white; background:rgba(0,0,0,0.8); z-index:999; padding:2px;';
      this.panel.appendChild(debug);
    }
    debug.innerHTML = `L:${final_L.toFixed(2)} T:${final_T.toFixed(0)} X:${X.toFixed(2)} Y:${Y.toFixed(2)} Z:${Z.toFixed(2)} m:${m} id:${starId}`;

    this.drawStar(final_L, final_T);
  },

  drawStar: function(L_rel, T_k) {
    if (!this.starMarker) return;

    // Mapear Luminosidade para Y (Escala logarítmica: de 10^-4 a 10^6)
    let logL = Math.log10(L_rel);
    // Removemos o clamp estrito para permitir extrapolação
    // if (logL < -4) logL = -4;
    // if (logL > 6) logL = 6;
    
    // rawYPercent vai de 0 (topo logL=6) a 100 (base logL=-4)
    let rawYPercent = 100 - ((logL + 4) / 10) * 100;

    // Mapear Temperatura para X (Escala invertida: 30000K a 2000K)
    let logT = Math.log10(T_k);
    let logT_max = Math.log10(30000);
    let logT_min = Math.log10(2000);
    
    // rawXPercent vai de 0 (esquerda) a 100 (direita) dentro do grid logarítmico
    let rawXPercent = ((logT_max - logT) / (logT_max - logT_min)) * 100;

    // Ajuste fino para a imagem fornecida (calibração baseada nas bordas da UFRGS)
    let yPercent = 16.5 + (rawYPercent * 0.58); 
    let xPercent = 22.0 + (rawXPercent * 0.60); 

    let outOfScale = false;

    // Extrapolar a bolinha e segurar nas bordas da imagem para não sumir completamente (mantendo visível)
    if (yPercent < 2) { yPercent = 2; outOfScale = true; }
    if (yPercent > 98) { yPercent = 98; outOfScale = true; }
    if (xPercent < 2) { xPercent = 2; outOfScale = true; }
    if (xPercent > 98) { xPercent = 98; outOfScale = true; }

    // Ajustar visual da bolinha
    this.starMarker.style.top = `calc(${yPercent}% - 8px)`;
    this.starMarker.style.left = `calc(${xPercent}% - 8px)`;
    
    // Gerenciar o aviso "Fora de Escala"
    let warning = document.getElementById('hr-out-of-scale');
    if (!warning) {
      warning = document.createElement('div');
      warning.id = 'hr-out-of-scale';
      warning.style.position = 'absolute';
      warning.style.color = '#ff3333';
      warning.style.fontWeight = 'bold';
      warning.style.fontSize = '14px';
      warning.style.textShadow = '1px 1px 2px black, -1px -1px 2px black';
      warning.style.pointerEvents = 'none';
      warning.style.whiteSpace = 'nowrap';
      // Append inside hr-diagram-bg to position relative to the marker easily
      document.getElementById('hr-diagram-bg').appendChild(warning);
    }

    if (outOfScale) {
      warning.textContent = 'FORA DE ESCALA';
      warning.style.display = 'block';
      // Place it right next to the star marker
      warning.style.top = `calc(${yPercent}% - 25px)`;
      warning.style.left = `calc(${xPercent}% + 15px)`;
    } else {
      warning.style.display = 'none';
    }

    // Cor da estrela baseada na temperatura
    let color = "#fff";
    if (T_k > 10000) color = "#aaccff"; // Azulada
    else if (T_k > 7000) color = "#ffffff"; // Branca
    else if (T_k > 5000) color = "#ffff00"; // Amarela
    else if (T_k > 3500) color = "#ff9900"; // Laranja
    else color = "#ff3300"; // Vermelha
    
    this.starMarker.style.backgroundColor = color;
    this.starMarker.style.boxShadow = `0 0 10px 2px ${color}`;
  }
};

// Inicializar quando a página carregar
document.addEventListener('DOMContentLoaded', () => {
  hrDiagram.init();
});

// Hook global para atualizar o diagrama sempre que houver update
// Vamos sobrescrever ou adicionar ao updateUI existente se possível.
// Se game_v2 já tem updateUI, vamos interceptar:
const _oldUpdateUI = window.updateUI;
window.updateUI = function() {
    if (_oldUpdateUI) _oldUpdateUI.apply(this, arguments);
    if (hrDiagram) hrDiagram.updatePosition();
};

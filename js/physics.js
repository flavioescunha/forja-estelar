'use strict';

// ── Physics engine (pure static helpers) ────────────────────────────────────
const Physics = {
  U_TO_MEV: 931.494,

  /** Coulomb barrier in game-energy units (floor: MIN_COULOMB). */
  coulombBarrier(Z1, Z2) {
    return Math.max(MIN_COULOMB, Z1 * Z2 * COULOMB_SCALE);
  },

  /** Return the REACTIONS entry for two isotope keys (sorted join) or fallback to procedural. */
  getReaction(k1, k2) {
    const rxn = REACTIONS[[k1, k2].sort().join('+')];
    if (rxn) return rxn;
    
    return this.proceduralFusion(k1, k2);
  },

  /** Calculate procedural fusion with probabilistic channels based on Q-values */
  proceduralFusion(k1, k2) {
    const i1 = ISOTOPES[k1];
    const i2 = ISOTOPES[k2];
    if (!i1 || !i2 || i1.isElementary || i2.isElementary) return null;

    const Zf = i1.Z + i2.Z;
    const Af = i1.A + i2.A;
    if (Zf > 30) return null; // Limit to Zinc

    const directProduct = this.findIsotope(Zf, Af);
    if (!directProduct) return null;

    const mass_reag = i1.mass_u + i2.mass_u;
    const channels = [];

    // Channel 1: Direct Fusion
    const qDirect = (mass_reag - ISOTOPES[directProduct].mass_u) * this.U_TO_MEV;
    if (qDirect > 0) channels.push({ products: [directProduct], Q_MeV: qDirect, chance: 0 });

    // Channel 2: Neutron emission
    const prodNeutron = this.findIsotope(Zf, Af - 1);
    if (prodNeutron) {
      const qN = (mass_reag - (ISOTOPES[prodNeutron].mass_u + ISOTOPES['n'].mass_u)) * this.U_TO_MEV;
      if (qN > 0) channels.push({ products: [prodNeutron, 'n'], Q_MeV: qN, chance: 0 });
    }

    // Channel 3: Proton emission
    const prodProton = this.findIsotope(Zf - 1, Af - 1);
    if (prodProton) {
      const qP = (mass_reag - (ISOTOPES[prodProton].mass_u + ISOTOPES['H-1'].mass_u)) * this.U_TO_MEV;
      if (qP > 0) channels.push({ products: [prodProton, 'H-1'], Q_MeV: qP, chance: 0 });
    }

    // Channel 4: Alpha emission
    const prodAlpha = this.findIsotope(Zf - 2, Af - 4);
    if (prodAlpha) {
      const qA = (mass_reag - (ISOTOPES[prodAlpha].mass_u + ISOTOPES['He-4'].mass_u)) * this.U_TO_MEV;
      if (qA > 0) channels.push({ products: [prodAlpha, 'He-4'], Q_MeV: qA, chance: 0 });
    }

    // If no exothermic channels, return the endothermic direct fusion
    if (channels.length === 0) {
      return { products: [directProduct], Q_MeV: qDirect, description: `Fusão Endotérmica: ${i1.symbol}-${i1.A} + ${i2.symbol}-${i2.A} → ${ISOTOPES[directProduct].symbol}-${ISOTOPES[directProduct].A}` };
    }

    // Assign probabilities proportional to Q-value
    let totalQ = 0;
    channels.forEach(ch => totalQ += ch.Q_MeV);
    channels.forEach(ch => ch.chance = ch.Q_MeV / totalQ);

    return {
      probabilistic: true,
      description: `Fusão Exotérmica Procedural: ${i1.symbol}-${i1.A} + ${i2.symbol}-${i2.A}`,
      channels: channels
    };
  },


  /** Resolve probabilistic channels if present */
  resolveReaction(rxn) {
    if (!rxn) return null;
    if (rxn.channels) {
      let r = Math.random();
      let acc = 0;
      for (let ch of rxn.channels) {
        acc += ch.chance;
        if (r <= acc) return { products: ch.products, Q_MeV: ch.Q_MeV, description: ch.description, special: rxn.special };
      }
      return { products: rxn.channels[0].products, Q_MeV: rxn.channels[0].Q_MeV, description: rxn.channels[0].description, special: rxn.special };
    }
    return { products: rxn.products || rxn.products_success, Q_MeV: rxn.Q_MeV, description: rxn.description, special: rxn.special };
  },

  /** Q-value in MeV from atomic masses. */
  qValue(reactantKeys, productKeys) {
    const sum = (keys) => keys.reduce((s, k) => {
      const d = ISOTOPES[k]; return d ? s + d.mass_u : s;
    }, 0);
    return (sum(reactantKeys) - sum(productKeys)) * this.U_TO_MEV;
  },

  /**
   * Find an isotope key for (Z, A).
   * Returns exact match or nearest A for the same Z, or null.
   */
  findIsotope(Z, A) {
    let exact = null, best = null, bestDelta = Infinity;
    for (const [k, d] of Object.entries(ISOTOPES)) {
      if (d.Z !== Z) continue;
      if (d.A === A) { exact = k; break; }
      const delta = Math.abs(d.A - A);
      if (delta < bestDelta) { bestDelta = delta; best = k; }
    }
    return exact || best;
  },

  /** Compute fission products for a nucleus (A ≥ 8). */
  fission(nucleus) {
    const { Z, A } = nucleus;
    if (A < 8) return null;

    const Z1 = Math.max(1, Math.min(Z-1, Math.round(Z * (0.35 + Math.random()*0.30))));
    const Z2  = Z - Z1;
    const nn  = 2 + Math.floor(Math.random()*2);
    const A1  = Math.max(1, Math.round(A * Z1/Z) - Math.floor(nn/2));
    const A2  = A - A1 - nn;

    if (A2 < 1 || Z2 < 1) {
      const k1 = this.findIsotope(Math.floor(Z/2), Math.floor(A/2)-1);
      const k2 = this.findIsotope(Z - Math.floor(Z/2), A - Math.floor(A/2)-1 - 2);
      return { products:[k1,k2].filter(Boolean), neutrons:2, energyGain: A*0.6 };
    }

    return {
      products: [this.findIsotope(Z1,A1), this.findIsotope(Z2,A2)].filter(Boolean),
      neutrons: nn,
      energyGain: A * 0.6,
    };
  },

  /** Return decay products for a nucleus (uses DECAY_PRODUCTS table first). */
  decayProducts(nucleus) {
    const dp = DECAY_PRODUCTS[nucleus.key];
    if (dp) return dp;

    const { Z, N, A, decayMode } = nucleus;
    switch (decayMode) {
      case 'BETA_MINUS': return { products:[this.findIsotope(Z+1,A)].filter(Boolean), particleEmitted:'e-' };
      case 'BETA_PLUS':  return { products:[this.findIsotope(Z-1,A)].filter(Boolean), particleEmitted:'e+' };
      case 'EC':         return { products:[this.findIsotope(Z-1,A)].filter(Boolean), particleEmitted: null };
      case 'ALPHA':      return { products:[this.findIsotope(Z-2,A-4)].filter(Boolean), particleEmitted:'He-4' };
      case 'PROTON_EMISSION': return { products:[this.findIsotope(Z-1,A-1)].filter(Boolean), particleEmitted:'H-1' };
      case 'NEUTRON_EMISSION': return { products:[this.findIsotope(Z,A-1)].filter(Boolean), particleEmitted:'n' };
      default:           return { products:[], particleEmitted: null };
    }
  },

  /** Logarithmic scale conversion from real seconds to playable ms */
  getGameHalfLifeMs(realSeconds) {
    if (!realSeconds) return Infinity;
    // Base scale: ms = 1810.4 * log10(seconds) + 29466
    let ms = 1810.4 * Math.log10(realSeconds) + 29466;
    return Math.max(600, ms); // Cap minimum to 600ms so resonances are still visible
  },

  /** Formatted energy delta string. */
  fmt(delta) {
    return `${delta>=0?'+':''}${delta.toFixed(0)} ⚡`;
  },
};

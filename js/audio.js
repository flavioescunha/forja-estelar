'use strict';

const AudioManager = {
  ctx: null,
  masterGain: null,
  alarmOsc: null,
  alarmInterval: null,
  initialized: false,
  muteSFX: false,

  init() {
    if (this.initialized) return;
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (AudioContext) {
      this.ctx = new AudioContext();
      this.masterGain = this.ctx.createGain();
      this.masterGain.connect(this.ctx.destination);
      this.initialized = true;
    }
  },

  setMuteSFX(mute) {
    this.muteSFX = mute;
    if (this.masterGain) {
      this.masterGain.gain.value = mute ? 0 : 1;
    }
  },

  playMachineStart() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    
    // Synth base sound
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(50, t);
    osc.frequency.exponentialRampToValueAtTime(300, t + 0.5); // rev up
    osc.frequency.exponentialRampToValueAtTime(10, t + 1.0); // power down/fuse

    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.3, t + 0.2);
    gain.gain.linearRampToValueAtTime(0, t + 1.0);

    osc.connect(gain);
    gain.connect(this.masterGain);
    
    osc.start(t);
    osc.stop(t + 1.0);
  },

  playFuseSuccess() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(440, t);
    osc.frequency.exponentialRampToValueAtTime(880, t + 0.1);

    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.3, t + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.3);

    osc.connect(gain);
    gain.connect(this.masterGain);
    
    osc.start(t);
    osc.stop(t + 0.3);
  },

  playFuseFail() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'square';
    osc.frequency.setValueAtTime(150, t);
    osc.frequency.exponentialRampToValueAtTime(50, t + 0.3);

    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.3, t + 0.05);
    gain.gain.linearRampToValueAtTime(0, t + 0.3);

    osc.connect(gain);
    gain.connect(this.masterGain);
    
    osc.start(t);
    osc.stop(t + 0.3);
  },

  startDangerAlarm() {
    if (!this.ctx || this.alarmOsc) return;

    const createBeep = () => {
      if (!this.ctx) return;
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      
      osc.type = 'square';
      osc.frequency.setValueAtTime(600, t);
      osc.frequency.setValueAtTime(800, t + 0.1);

      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.15, t + 0.02);
      gain.gain.linearRampToValueAtTime(0, t + 0.2);

      osc.connect(gain);
      gain.connect(this.masterGain);
      
      osc.start(t);
      osc.stop(t + 0.2);
    };

    createBeep();
    this.alarmInterval = setInterval(createBeep, 500);
    this.alarmOsc = true; // flag
  },

  stopDangerAlarm() {
    if (this.alarmInterval) {
      clearInterval(this.alarmInterval);
      this.alarmInterval = null;
    }
    this.alarmOsc = null;
  },

  playFastForward() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(200, t);
    osc.frequency.exponentialRampToValueAtTime(800, t + 0.15);

    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.2, t + 0.05);
    gain.gain.linearRampToValueAtTime(0, t + 0.15);

    osc.connect(gain);
    gain.connect(this.masterGain);
    
    osc.start(t);
    osc.stop(t + 0.15);
  },

  playDecay() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    // softer pitch drop
    osc.frequency.setValueAtTime(300, t);
    osc.frequency.exponentialRampToValueAtTime(100, t + 0.4);

    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.1, t + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.4);

    osc.connect(gain);
    gain.connect(this.masterGain);
    
    osc.start(t);
    osc.stop(t + 0.4);
  },

  playDrop() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, t);
    osc.frequency.exponentialRampToValueAtTime(100, t + 0.1);

    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.3, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.1);

    osc.connect(gain);
    gain.connect(this.masterGain);
    
    osc.start(t);
    osc.stop(t + 0.1);
  },

  playDropOutside() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    // Similar to playDrop, but deeper (lower frequency)
    osc.frequency.setValueAtTime(400, t); // lower start
    osc.frequency.exponentialRampToValueAtTime(50, t + 0.15); // lower end

    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.3, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.15);

    osc.connect(gain);
    gain.connect(this.masterGain);
    
    osc.start(t);
    osc.stop(t + 0.15);
  },

  playPick() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    
    // Short metallic click/ting
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    // Start high, very short
    osc.frequency.setValueAtTime(1200, t);
    osc.frequency.exponentialRampToValueAtTime(300, t + 0.05);

    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.3, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.05);

    osc.connect(gain);
    gain.connect(this.masterGain);
    
    osc.start(t);
    osc.stop(t + 0.05);
  },

  playAnnihilation() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    
    // A quick burst of noise/square wave for a "plaft" (small firecracker)
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'square';
    osc.frequency.setValueAtTime(100, t);
    osc.frequency.exponentialRampToValueAtTime(10, t + 0.15); // sharp drop for impact

    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.4, t + 0.02); // sharp attack
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.15); // quick decay

    // Optional: add a bit of noise or high frequency pop
    const osc2 = this.ctx.createOscillator();
    const gain2 = this.ctx.createGain();
    osc2.type = 'sawtooth';
    osc2.frequency.setValueAtTime(800, t);
    osc2.frequency.exponentialRampToValueAtTime(200, t + 0.1);
    gain2.gain.setValueAtTime(0, t);
    gain2.gain.linearRampToValueAtTime(0.2, t + 0.01);
    gain2.gain.exponentialRampToValueAtTime(0.01, t + 0.1);

    osc.connect(gain);
    osc2.connect(gain2);
    gain.connect(this.masterGain);
    gain2.connect(this.masterGain);
    
    osc.start(t);
    osc2.start(t);
    osc.stop(t + 0.15);
    osc2.stop(t + 0.15);
  },

  playMissionComplete() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    
    // Notes: C5, E5, G5, C6
    const freqs = [523.25, 659.25, 783.99, 1046.50];
    const delay = 0.12;
    
    freqs.forEach((freq, index) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      
      osc.type = 'sine';
      osc.frequency.value = freq;
      
      const startTime = t + (index * delay);
      const endTime = startTime + 0.3;
      
      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(0.2, startTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.01, endTime);
      
      osc.connect(gain);
      gain.connect(this.masterGain);
      
      osc.start(startTime);
      osc.stop(endTime);
    });
  },

  updateMotorSound(val, maxVal) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    
    if (!this.motorOsc) {
      this.motorOsc = this.ctx.createOscillator();
      this.motorGain = this.ctx.createGain();
      this.motorOsc.type = 'sawtooth';
      
      this.motorOsc.frequency.setValueAtTime(50, t);
      this.motorGain.gain.setValueAtTime(0, t);
      this.motorGain.gain.linearRampToValueAtTime(0.15, t + 0.1);
      
      this.motorOsc.connect(this.motorGain);
      this.motorGain.connect(this.masterGain);
      this.motorOsc.start(t);
    }
    
    // Pitch depends on the slider value (e.g. 50Hz to 300Hz)
    const ratio = val / maxVal;
    const freq = 50 + (250 * ratio);
    this.motorOsc.frequency.linearRampToValueAtTime(freq, t + 0.1);
  },

  stopMotorSound() {
    if (!this.ctx || !this.motorOsc) return;
    const t = this.ctx.currentTime;
    this.motorGain.gain.linearRampToValueAtTime(0, t + 0.3);
    this.motorOsc.stop(t + 0.35);
    
    // Clean up references immediately so it can be restarted
    this.motorOsc = null;
    this.motorGain = null;
  },

  playDecayBeep() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(200, t);
    osc.frequency.exponentialRampToValueAtTime(100, t + 0.1);

    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.3, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.1);

    osc.connect(gain);
    gain.connect(this.masterGain);
    
    osc.start(t);
    osc.stop(t + 0.1);
  },

  startTripleAlphaAlarm() {
    if (!this.ctx || this.taAlarmInterval) return;

    const playBeee = () => {
      if (!this.ctx) return;
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(200, t); // "béee" tone starts lower
      osc.frequency.linearRampToValueAtTime(240, t + 0.3); // ends higher

      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.3, t + 0.05);
      gain.gain.linearRampToValueAtTime(0.3, t + 0.25);
      gain.gain.linearRampToValueAtTime(0, t + 0.3);

      osc.connect(gain);
      gain.connect(this.masterGain);
      
      osc.start(t);
      osc.stop(t + 0.3);
    };

    playBeee();
    // Repeating "béee béee béee"
    this.taAlarmInterval = setInterval(playBeee, 600);
  },

  stopTripleAlphaAlarm() {
    if (this.taAlarmInterval) {
      clearInterval(this.taAlarmInterval);
      this.taAlarmInterval = null;
    }
  }
};

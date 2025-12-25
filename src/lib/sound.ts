// Sound effects for CTF Autopilot
// Using Web Audio API for lightweight, no-dependency sounds

type SoundType = 'flag_found' | 'analysis_complete' | 'error' | 'step_complete';

class SoundManager {
  private audioContext: AudioContext | null = null;
  private enabled: boolean = true;

  private getContext(): AudioContext {
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    }
    return this.audioContext;
  }

  setEnabled(enabled: boolean) {
    this.enabled = enabled;
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  // Victory fanfare when flag is found
  playFlagFound() {
    if (!this.enabled) return;
    
    const ctx = this.getContext();
    const now = ctx.currentTime;
    
    // Create a victory melody (C5, E5, G5, C6)
    const frequencies = [523.25, 659.25, 783.99, 1046.50];
    const durations = [0.15, 0.15, 0.15, 0.4];
    
    let time = now;
    frequencies.forEach((freq, i) => {
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();
      
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(freq, time);
      
      gainNode.gain.setValueAtTime(0, time);
      gainNode.gain.linearRampToValueAtTime(0.3, time + 0.02);
      gainNode.gain.exponentialRampToValueAtTime(0.01, time + durations[i]);
      
      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);
      
      oscillator.start(time);
      oscillator.stop(time + durations[i]);
      
      time += durations[i] * 0.7; // Overlap slightly
    });
  }

  // Grand finale for analysis complete with all flags
  playGrandFinale() {
    if (!this.enabled) return;
    
    const ctx = this.getContext();
    const now = ctx.currentTime;
    
    // Extended victory fanfare (C5, E5, G5, C6, E6, G6, C7)
    const frequencies = [523.25, 659.25, 783.99, 1046.50, 1318.51, 1567.98, 2093.00];
    const durations = [0.1, 0.1, 0.1, 0.15, 0.15, 0.15, 0.5];
    
    let time = now;
    frequencies.forEach((freq, i) => {
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();
      
      oscillator.type = 'triangle';
      oscillator.frequency.setValueAtTime(freq, time);
      
      gainNode.gain.setValueAtTime(0, time);
      gainNode.gain.linearRampToValueAtTime(0.25, time + 0.02);
      gainNode.gain.exponentialRampToValueAtTime(0.01, time + durations[i]);
      
      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);
      
      oscillator.start(time);
      oscillator.stop(time + durations[i]);
      
      time += durations[i] * 0.6;
    });
  }

  // Success ping for step completion
  playStepComplete() {
    if (!this.enabled) return;
    
    const ctx = this.getContext();
    const now = ctx.currentTime;
    
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();
    
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(880, now); // A5
    oscillator.frequency.setValueAtTime(1108.73, now + 0.08); // C#6
    
    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(0.15, now + 0.02);
    gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
    
    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);
    
    oscillator.start(now);
    oscillator.stop(now + 0.15);
  }

  // Error buzz
  playError() {
    if (!this.enabled) return;
    
    const ctx = this.getContext();
    const now = ctx.currentTime;
    
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();
    
    oscillator.type = 'square';
    oscillator.frequency.setValueAtTime(200, now);
    oscillator.frequency.setValueAtTime(150, now + 0.1);
    
    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(0.15, now + 0.02);
    gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
    
    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);
    
    oscillator.start(now);
    oscillator.stop(now + 0.2);
  }

  // Generic play method
  play(type: SoundType) {
    switch (type) {
      case 'flag_found':
        this.playFlagFound();
        break;
      case 'analysis_complete':
        this.playGrandFinale();
        break;
      case 'step_complete':
        this.playStepComplete();
        break;
      case 'error':
        this.playError();
        break;
    }
  }
}

// Export singleton instance
export const soundManager = new SoundManager();

// Convenience functions
export const playFlagFound = () => soundManager.playFlagFound();
export const playGrandFinale = () => soundManager.playGrandFinale();
export const playStepComplete = () => soundManager.playStepComplete();
export const playError = () => soundManager.playError();

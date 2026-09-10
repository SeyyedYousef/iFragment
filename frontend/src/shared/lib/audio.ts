/**
 * Web Audio API synthesized sound effects
 * Lightweight, zero-asset feedback effects that respect profileSettings().soundEnabled
 */
import { profileSettings } from '@/entities/user/index.js';

class AudioManager {
	private ctx: AudioContext | null = null;

	private getContext(): AudioContext | null {
		if (typeof window === 'undefined') return null;
		if (!this.ctx) {
			const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
			if (AudioCtx) {
				this.ctx = new AudioCtx();
			}
		}
		if (this.ctx && this.ctx.state === 'suspended') {
			this.ctx.resume().catch(() => {});
		}
		return this.ctx;
	}

	playClick() {
		try {
			if (!profileSettings().soundEnabled) return;
			const ctx = this.getContext();
			if (!ctx) return;

			const osc = ctx.createOscillator();
			const gain = ctx.createGain();

			osc.type = 'sine';
			osc.frequency.setValueAtTime(800, ctx.currentTime);
			osc.frequency.exponentialRampToValueAtTime(400, ctx.currentTime + 0.03);

			gain.gain.setValueAtTime(0.12, ctx.currentTime);
			gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.03);

			osc.connect(gain);
			gain.connect(ctx.destination);

			osc.start();
			osc.stop(ctx.currentTime + 0.03);
		} catch {}
	}

	playToggle(checked: boolean) {
		try {
			if (!profileSettings().soundEnabled) return;
			const ctx = this.getContext();
			if (!ctx) return;

			const osc = ctx.createOscillator();
			const gain = ctx.createGain();

			osc.type = 'sine';
			const startFreq = checked ? 500 : 750;
			const endFreq = checked ? 750 : 500;

			osc.frequency.setValueAtTime(startFreq, ctx.currentTime);
			osc.frequency.exponentialRampToValueAtTime(endFreq, ctx.currentTime + 0.05);

			gain.gain.setValueAtTime(0.15, ctx.currentTime);
			gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);

			osc.connect(gain);
			gain.connect(ctx.destination);

			osc.start();
			osc.stop(ctx.currentTime + 0.05);
		} catch {}
	}

	playSuccess() {
		try {
			if (!profileSettings().soundEnabled) return;
			const ctx = this.getContext();
			if (!ctx) return;

			[523.25, 659.25].forEach((freq, i) => {
				const osc = ctx.createOscillator();
				const gain = ctx.createGain();

				osc.type = 'sine';
				osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.05);

				gain.gain.setValueAtTime(0.1, ctx.currentTime + i * 0.05);
				gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.05 + 0.1);

				osc.connect(gain);
				gain.connect(ctx.destination);

				osc.start(ctx.currentTime + i * 0.05);
				osc.stop(ctx.currentTime + i * 0.05 + 0.1);
			});
		} catch {}
	}

	playError() {
		try {
			if (!profileSettings().soundEnabled) return;
			const ctx = this.getContext();
			if (!ctx) return;

			const osc = ctx.createOscillator();
			const gain = ctx.createGain();

			osc.type = 'sawtooth';
			osc.frequency.setValueAtTime(220, ctx.currentTime);
			osc.frequency.setValueAtTime(180, ctx.currentTime + 0.05);

			gain.gain.setValueAtTime(0.08, ctx.currentTime);
			gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);

			osc.connect(gain);
			gain.connect(ctx.destination);

			osc.start();
			osc.stop(ctx.currentTime + 0.1);
		} catch {}
	}
}

export const audio = new AudioManager();

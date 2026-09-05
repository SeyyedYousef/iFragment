import { createSignal, onCleanup, onMount, Show } from 'solid-js';
import { haptic } from '@/shared/lib/haptic.js';

export interface RewardCelebrationConfig {
	reward: number;
	title?: string;
	subtitle?: string;
	category?: 'bot' | 'streak' | 'task' | 'combo' | 'quiz';
	previousBalance: number;
	newBalance?: number;
	onClose?: () => void;
}

interface ActiveCelebration extends RewardCelebrationConfig {
	id: string;
	targetBalance: number;
}

const [celebrationState, setCelebrationState] = createSignal<ActiveCelebration | null>(null);

/**
 * Triggers a game-like celebratory modal with rotating sunburst, canvas coin burst,
 * and an animated before-and-after rolling balance odometer.
 */
export const triggerRewardCelebration = (config: RewardCelebrationConfig) => {
	if (config.reward <= 0) {
		if (config.onClose) config.onClose();
		return;
	}

	const targetBalance =
		typeof config.newBalance === 'number'
			? config.newBalance
			: config.previousBalance + config.reward;

	const id = Math.random().toString(36).substring(2, 9);

	setCelebrationState({
		...config,
		id,
		targetBalance,
	});

	try {
		haptic.notify('success');
	} catch {}
};

// Backwards-compatible helper
export const triggerCoinCelebration = (options: {
	amount: number;
	startX?: number;
	startY?: number;
	targetSelector?: string;
	onFinish?: () => void;
}) => {
	triggerRewardCelebration({
		reward: options.amount,
		previousBalance: 0,
		newBalance: options.amount,
		onClose: options.onFinish,
	});
};

interface Particle {
	x: number;
	y: number;
	vx: number;
	vy: number;
	size: number;
	alpha: number;
	rotation: number;
	rotSpeed: number;
	color: string;
	type: 'coin' | 'spark' | 'star';
	gravity: number;
}

export const RewardCelebrationModal = () => {
	let canvasRef: HTMLCanvasElement | undefined;
	let animId: number | undefined;

	const [displayBalance, setDisplayBalance] = createSignal(0);
	const [isRolling, setIsRolling] = createSignal(false);
	const [isCompleted, setIsCompleted] = createSignal(false);

	const close = () => {
		const curr = celebrationState();
		setCelebrationState(null);
		setIsRolling(false);
		setIsCompleted(false);
		if (curr?.onClose) {
			curr.onClose();
		}
	};

	onCleanup(() => {
		if (animId) cancelAnimationFrame(animId);
	});

	// When a celebration becomes active, trigger the canvas particle loop & rolling odometer
	const startAnimation = (config: ActiveCelebration) => {
		setDisplayBalance(config.previousBalance);
		setIsRolling(true);
		setIsCompleted(false);

		const startVal = config.previousBalance;
		const endVal = config.targetBalance;
		const diff = endVal - startVal;
		const duration = 1400; // 1.4s smooth roll
		let startTime: number | null = null;
		let lastHapticTick = 0;

		const easeOutCubic = (t: number): number => 1 - Math.pow(1 - t, 3);

		const stepRoll = (timestamp: number) => {
			if (!celebrationState()) return;
			if (!startTime) startTime = timestamp;
			const elapsed = timestamp - startTime;
			const progress = Math.min(1, elapsed / duration);
			const eased = easeOutCubic(progress);

			const currentVal = Math.round(startVal + diff * eased);
			setDisplayBalance(currentVal);

			// Periodic haptic tick as numbers roll
			if (timestamp - lastHapticTick > 140 && progress < 0.95) {
				lastHapticTick = timestamp;
				try {
					haptic.impact('light');
				} catch {}
			}

			if (progress < 1) {
				requestAnimationFrame(stepRoll);
			} else {
				setDisplayBalance(endVal);
				setIsRolling(false);
				setIsCompleted(true);
				try {
					haptic.notify('success');
				} catch {}
			}
		};

		// 250ms anticipation delay before rolling
		setTimeout(() => {
			requestAnimationFrame(stepRoll);
		}, 250);

		// Initialize Canvas Particles
		if (!canvasRef) return;
		const canvas = canvasRef;
		const ctx = canvas.getContext('2d');
		if (!ctx) return;

		const dpr = window.devicePixelRatio || 1;
		const w = window.innerWidth;
		const h = window.innerHeight;
		canvas.width = w * dpr;
		canvas.height = h * dpr;
		ctx.scale(dpr, dpr);

		const particles: Particle[] = [];
		const count = 45;
		const originX = w / 2;
		const originY = h / 2 - 40;

		const colors = ['#FFD700', '#FFA500', '#FFE57F', '#FFF275', '#E69500'];

		for (let i = 0; i < count; i++) {
			const angle = Math.random() * Math.PI * 2;
			const speed = 4 + Math.random() * 9;
			const type: 'coin' | 'spark' | 'star' =
				i % 3 === 0 ? 'coin' : i % 3 === 1 ? 'star' : 'spark';

			particles.push({
				x: originX,
				y: originY,
				vx: Math.cos(angle) * speed,
				vy: Math.sin(angle) * speed - 3,
				size: type === 'coin' ? 14 + Math.random() * 8 : 6 + Math.random() * 6,
				alpha: 1,
				rotation: Math.random() * Math.PI * 2,
				rotSpeed: (Math.random() - 0.5) * 0.25,
				color: colors[Math.floor(Math.random() * colors.length)],
				type,
				gravity: 0.22,
			});
		}

		let pAnimId: number;
		const updateParticles = () => {
			if (!celebrationState()) {
				ctx.clearRect(0, 0, w, h);
				return;
			}
			ctx.clearRect(0, 0, w, h);

			let alive = 0;
			for (let i = 0; i < particles.length; i++) {
				const p = particles[i];
				if (p.alpha <= 0.02) continue;
				alive++;

				p.x += p.vx;
				p.y += p.vy;
				p.vy += p.gravity;
				p.rotation += p.rotSpeed;
				p.alpha *= 0.985;

				ctx.save();
				ctx.globalAlpha = Math.max(0, p.alpha);
				ctx.translate(p.x, p.y);
				ctx.rotate(p.rotation);

				if (p.type === 'coin') {
					// 3D spinning coin disc
					const flipScale = Math.cos(p.rotation * 2);
					ctx.scale(1, Math.max(0.15, Math.abs(flipScale)));

					ctx.beginPath();
					ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
					ctx.fillStyle = p.color;
					ctx.fill();
					ctx.lineWidth = 1.5;
					ctx.strokeStyle = '#FFFFFF';
					ctx.stroke();

					// Inner rim
					ctx.beginPath();
					ctx.arc(0, 0, p.size / 2 - 2, 0, Math.PI * 2);
					ctx.strokeStyle = 'rgba(0,0,0,0.2)';
					ctx.stroke();
				} else if (p.type === 'star') {
					// Golden star
					ctx.fillStyle = p.color;
					ctx.beginPath();
					for (let s = 0; s < 4; s++) {
						ctx.rotate(Math.PI / 2);
						ctx.lineTo(p.size, 0);
						ctx.lineTo(p.size / 3, p.size / 3);
					}
					ctx.fill();
				} else {
					// Sparkle dot
					ctx.beginPath();
					ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
					ctx.fillStyle = p.color;
					ctx.shadowColor = p.color;
					ctx.shadowBlur = 6;
					ctx.fill();
				}

				ctx.restore();
			}

			if (alive > 0) {
				pAnimId = requestAnimationFrame(updateParticles);
			}
		};

		pAnimId = requestAnimationFrame(updateParticles);
		onCleanup(() => cancelAnimationFrame(pAnimId));
	};

	return (
		<Show when={celebrationState()}>
			{(cel) => {
				onMount(() => {
					startAnimation(cel());
				});

				const getHeroIcon = () => {
					switch (cel().category) {
						case 'bot':
							return { icon: '🤖', glow: 'from-amber-500/30 to-orange-500/20' };
						case 'streak':
							return { icon: '🔥', glow: 'from-orange-500/30 to-red-500/20' };
						case 'combo':
							return { icon: '🧩', glow: 'from-yellow-400/30 to-amber-500/20' };
						case 'quiz':
							return { icon: '💡', glow: 'from-cyan-400/30 to-blue-500/20' };
						default:
							return { icon: '🏆', glow: 'from-amber-400/30 to-yellow-500/20' };
					}
				};

				const hero = getHeroIcon();

				return (
					<div
						class="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/85 backdrop-blur-2xl animate-fade-in select-none"
						role="dialog"
						aria-modal="true"
					>
						<style>{`
							@keyframes sunburstRotate {
								from { transform: translate(-50%, -50%) rotate(0deg); }
								to { transform: translate(-50%, -50%) rotate(360deg); }
							}
							@keyframes heroFloat {
								0%, 100% { transform: translateY(0px) scale(1); }
								50% { transform: translateY(-8px) scale(1.04); }
							}
							@keyframes balanceGlowPulse {
								0%, 100% { box-shadow: 0 0 15px rgba(245,158,11,0.2), inset 0 0 15px rgba(245,158,11,0.05); }
								50% { box-shadow: 0 0 35px rgba(245,158,11,0.5), inset 0 0 25px rgba(245,158,11,0.2); }
							}
							@keyframes scaleBounce {
								0% { transform: scale(0.6); opacity: 0; }
								60% { transform: scale(1.08); opacity: 1; }
								100% { transform: scale(1); opacity: 1; }
							}
						`}</style>

						{/* Physics Particle Canvas */}
						<canvas
							ref={canvasRef}
							class="absolute inset-0 w-full h-full pointer-events-none z-10"
						/>

						{/* Rotating Sunburst Light Beams */}
						<div
							class="absolute top-1/2 left-1/2 w-[700px] h-[700px] pointer-events-none z-0 opacity-40"
							style={{
								animation: 'sunburstRotate 28s linear infinite',
								background:
									'repeating-conic-gradient(from 0deg, rgba(251,191,36,0.15) 0deg 15deg, transparent 15deg 30deg)',
								'mask-image': 'radial-gradient(circle at center, black 25%, transparent 70%)',
								'-webkit-mask-image':
									'radial-gradient(circle at center, black 25%, transparent 70%)',
							}}
						/>

						{/* Main Celebration Card */}
						<div
							class="relative z-20 w-full max-w-sm bg-gradient-to-b from-[#181B26]/95 via-[#10121A]/98 to-[#090A0E] rounded-[36px] p-6 sm:p-7 flex flex-col items-center border border-amber-500/30 shadow-[0_25px_70px_rgba(0,0,0,0.9)] overflow-hidden"
							style={{ animation: 'scaleBounce 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards' }}
						>
							{/* Radial Top Glow */}
							<div class="absolute -top-16 left-1/2 -translate-x-1/2 w-64 h-64 bg-amber-500/20 rounded-full blur-3xl pointer-events-none" />

							{/* Hero Floating 3D Badge */}
							<div class="relative mb-4 mt-2">
								{/* Aura Halo */}
								<div class="absolute -inset-4 bg-gradient-to-r from-amber-500/40 via-yellow-400/30 to-orange-500/40 rounded-full blur-xl animate-pulse" />

								<div
									class={`w-24 h-24 rounded-[30px] bg-gradient-to-br ${hero.glow} border-[2px] border-amber-400/60 flex items-center justify-center relative shadow-[inset_0_2px_12px_rgba(255,255,255,0.25),0_12px_35px_rgba(245,158,11,0.4)]`}
									style={{ animation: 'heroFloat 3.5s ease-in-out infinite' }}
								>
									<span class="text-[52px] select-none drop-shadow-[0_8px_16px_rgba(0,0,0,0.5)]">
										{hero.icon}
									</span>
									<span class="absolute -top-2 -right-2 text-[22px] animate-bounce">✨</span>
									<span class="absolute -bottom-1 -left-2 text-[18px] animate-pulse">✨</span>
								</div>
							</div>

							{/* Title & Subtitle */}
							<h3 class="text-[22px] sm:text-[24px] font-black text-white text-center tracking-tight mb-1 drop-shadow-md">
								{cel().title || 'REWARD CLAIMED!'}
							</h3>
							<p class="text-white/60 text-[12px] sm:text-[13px] text-center font-medium mb-5 max-w-[270px] leading-snug">
								{cel().subtitle || 'Coins successfully transferred to your balance'}
							</p>

							{/* Gigantic Reward Callout */}
							<div class="flex items-center justify-center gap-2.5 px-6 py-2.5 rounded-full bg-gradient-to-r from-amber-500/15 via-yellow-400/20 to-amber-500/15 border border-amber-400/40 mb-6 shadow-[0_0_20px_rgba(245,158,11,0.25)]">
								<span class="text-[26px] drop-shadow-[0_0_8px_rgba(251,191,36,0.8)]">🪙</span>
								<span class="text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-yellow-100 to-amber-400 font-mono text-[28px] sm:text-[32px] font-black tracking-tight drop-shadow">
									+{cel().reward.toLocaleString('en-US')}
								</span>
							</div>

							{/* ═══════ THE BEFORE & AFTER BALANCE ODOMETER ═══════ */}
							<div
								class={`w-full bg-[#08090D]/90 rounded-[26px] p-4 flex flex-col gap-3 mb-6 border relative overflow-hidden transition-all duration-500 ${
									isRolling()
										? 'border-amber-400/60 shadow-[0_0_30px_rgba(245,158,11,0.35)]'
										: 'border-white/10 shadow-inner'
								}`}
								style={isRolling() ? { animation: 'balanceGlowPulse 1.2s infinite' } : {}}
							>
								{/* Header */}
								<div class="flex items-center justify-between px-1 text-[11px] font-bold uppercase tracking-widest text-white/50">
									<span>Airdrop Balance</span>
									<span class="flex items-center gap-1 text-amber-400 font-mono">
										<span>🪙</span>
										<span>FRG COINS</span>
									</span>
								</div>

								{/* Main Animated Balance Display */}
								<div class="flex items-center justify-center gap-3 py-1 bg-white/[0.02] rounded-[18px] border border-white/5 relative">
									<span class="text-amber-400 text-[24px]">🪙</span>
									<span
										class={`font-mono font-black text-[32px] sm:text-[36px] tracking-tight tabular-nums transition-colors duration-300 ${
											isRolling()
												? 'text-yellow-300 drop-shadow-[0_0_12px_rgba(253,224,71,0.7)]'
												: isCompleted()
													? 'text-emerald-400 drop-shadow-[0_0_12px_rgba(52,211,153,0.5)]'
													: 'text-white'
										}`}
									>
										{displayBalance().toLocaleString('en-US')}
									</span>
									<Show when={isCompleted()}>
										<span class="material-symbols-outlined text-emerald-400 text-[22px] animate-fade-in">
											check_circle
										</span>
									</Show>
								</div>

								{/* Before & After Comparison Pills */}
								<div class="grid grid-cols-2 gap-2 pt-1">
									<div class="bg-white/[0.03] rounded-[14px] p-2 flex flex-col items-center border border-white/5">
										<span class="text-[10px] font-bold text-white/40 uppercase tracking-wider mb-0.5">
											Previous
										</span>
										<span class="text-white/70 font-mono font-bold text-[13px] tabular-nums">
											{cel().previousBalance.toLocaleString('en-US')}
										</span>
									</div>
									<div class="bg-emerald-500/10 rounded-[14px] p-2 flex flex-col items-center border border-emerald-500/20">
										<span class="text-[10px] font-bold text-emerald-400/80 uppercase tracking-wider mb-0.5">
											New Balance
										</span>
										<span class="text-emerald-400 font-mono font-black text-[13px] tabular-nums">
											{cel().targetBalance.toLocaleString('en-US')}
										</span>
									</div>
								</div>
							</div>

							{/* Collect / Awesome Action Button */}
							<button
								type="button"
								onClick={close}
								class="w-full h-14 rounded-[20px] bg-gradient-to-r from-amber-400 via-amber-300 to-amber-500 hover:from-amber-300 hover:to-amber-400 active:scale-95 text-black font-black text-[14px] sm:text-[15px] uppercase tracking-widest shadow-[0_8px_30px_rgba(245,158,11,0.4)] transition-all flex items-center justify-center gap-2 border border-white/20 cursor-pointer"
							>
								<span>{isRolling() ? 'COLLECTING...' : 'AWESOME! CONTINUE'}</span>
								<span class="material-symbols-outlined text-[20px] font-bold">arrow_forward</span>
							</button>
						</div>
					</div>
				);
			}}
		</Show>
	);
};

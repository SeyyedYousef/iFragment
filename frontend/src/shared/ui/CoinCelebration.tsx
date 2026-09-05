import { createSignal, onCleanup, Show } from 'solid-js';
import { balance, setBalance } from '@/entities/airdrop/index.js';
import { haptic } from '@/shared/lib/haptic.js';

export interface FlyCoinsOptions {
	amount: number;
	startX?: number;
	startY?: number;
	targetSelector?: string;
	onFinish?: () => void;
}

interface FlyingCoin {
	startX: number;
	startY: number;
	burstX: number;
	burstY: number;
	targetX: number;
	targetY: number;
	ctrlX: number;
	ctrlY: number;
	startTime: number;
	duration: number;
	size: number;
	rotation: number;
	rotSpeed: number;
	hasHit: boolean;
}

interface FloatingBadge {
	id: string;
	x: number;
	y: number;
	amount: number;
}

const [activeBadges, setActiveBadges] = createSignal<FloatingBadge[]>([]);

let globalCanvas: HTMLCanvasElement | null = null;
let globalAnimId: number | null = null;
const activeCoins: FlyingCoin[] = [];

/**
 * Game-like Flying Coins Animation:
 * Coins erupt from click origin (startX, startY), arc across the screen
 * directly into the player's balance counter, pulse the counter on impact,
 * and roll the current balance up in real time!
 */
export const flyCoinsToBalance = (options: FlyCoinsOptions) => {
	const { amount, startX, startY, targetSelector, onFinish } = options;
	if (amount <= 0) {
		if (onFinish) onFinish();
		return;
	}

	// 1. Identify starting point (default: center of viewport)
	const sx = startX ?? window.innerWidth / 2;
	const sy = startY ?? window.innerHeight / 2;

	// 2. Identify destination balance element
	const selector = targetSelector || '#airdrop-balance-counter, #airdrop-tasks-balance';
	const targetEl =
		(document.querySelector(selector) as HTMLElement | null) ||
		(document.querySelector('#airdrop-balance-counter') as HTMLElement | null) ||
		(document.querySelector('#airdrop-tasks-balance') as HTMLElement | null);

	let tx = window.innerWidth / 2;
	let ty = 90;

	if (targetEl) {
		const rect = targetEl.getBoundingClientRect();
		tx = rect.left + rect.width / 2;
		ty = rect.top + rect.height / 2;
	}

	// 3. Balance Rolling Animation: starts when coins begin landing
	const initialBalance = balance();
	const finalBalance = initialBalance + amount;
	let lastBalanceUpdate = 0;
	let hitCount = 0;

	const coinCount = Math.min(18, Math.max(10, Math.floor(amount / 500) + 8));
	const now = performance.now();

	for (let i = 0; i < coinCount; i++) {
		const angle = Math.random() * Math.PI * 2;
		const burstDistance = 30 + Math.random() * 55;
		const burstX = sx + Math.cos(angle) * burstDistance;
		const burstY = sy + Math.sin(angle) * burstDistance;

		// High arc curve towards target
		const midX = (burstX + tx) / 2;
		const midY = Math.min(burstY, ty) - (50 + Math.random() * 80);
		const ctrlX = midX + (Math.random() - 0.5) * 80;
		const ctrlY = Math.max(30, midY);

		const delay = i * 40; // Staggered stream
		const duration = 650 + Math.random() * 150; // 650-800ms flight

		activeCoins.push({
			startX: sx,
			startY: sy,
			burstX,
			burstY,
			targetX: tx,
			targetY: ty,
			ctrlX,
			ctrlY,
			startTime: now + delay,
			duration,
			size: 26 + Math.random() * 6,
			rotation: Math.random() * Math.PI * 2,
			rotSpeed: 0.15 + Math.random() * 0.2,
			hasHit: false,
		});
	}

	// Pulse the target counter element
	const pulseTarget = () => {
		if (targetEl) {
			try {
				targetEl.animate(
					[
						{ transform: 'scale(1)', filter: 'drop-shadow(0 0 0px transparent)' },
						{
							transform: 'scale(1.10)',
							filter: 'drop-shadow(0 0 14px rgba(251,191,36,0.9))',
						},
						{ transform: 'scale(1)', filter: 'drop-shadow(0 0 0px transparent)' },
					],
					{ duration: 180, easing: 'ease-out' },
				);
			} catch (_) {}
		}
	};

	// Start or ensure canvas loop is running
	if (!globalAnimId && globalCanvas) {
		const canvas = globalCanvas;
		const ctx = canvas.getContext('2d');

		const renderLoop = (timestamp: number) => {
			if (!ctx) return;
			const dpr = window.devicePixelRatio || 1;
			const w = window.innerWidth;
			const h = window.innerHeight;

			// Ensure canvas dimensions match viewport
			if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
				canvas.width = w * dpr;
				canvas.height = h * dpr;
				ctx.scale(dpr, dpr);
			} else {
				ctx.clearRect(0, 0, w, h);
			}

			let activeRemaining = 0;

			for (let i = activeCoins.length - 1; i >= 0; i--) {
				const c = activeCoins[i];
				if (timestamp < c.startTime) {
					activeRemaining++;
					continue; // Waiting for stagger delay
				}

				const elapsed = timestamp - c.startTime;
				const progress = Math.min(1, elapsed / c.duration);

				if (progress >= 1) {
					if (!c.hasHit) {
						c.hasHit = true;
						hitCount++;

						// Pulse target balance and haptic tick
						pulseTarget();
						if (timestamp - lastBalanceUpdate > 80) {
							lastBalanceUpdate = timestamp;
							try {
								haptic.impact('light');
							} catch {}
						}

						// Incrementally update live balance
						const partialProgress = hitCount / coinCount;
						setBalance(Math.round(initialBalance + amount * partialProgress));
					}
					// Remove finished coin
					activeCoins.splice(i, 1);
					continue;
				}

				activeRemaining++;

				// Quadratic Bezier interpolation with burst anticipation
				const easeProgress = Math.pow(progress, 1.8); // Accelerates into target
				const t = easeProgress;
				const invT = 1 - t;

				const currentX =
					invT * invT * c.burstX + 2 * invT * t * c.ctrlX + t * t * c.targetX;
				const currentY =
					invT * invT * c.burstY + 2 * invT * t * c.ctrlY + t * t * c.targetY;

				c.rotation += c.rotSpeed;

				// Draw 3D Gleaming Gold Coin
				ctx.save();
				ctx.translate(currentX, currentY);

				// 3D Flip Scale
				const flipScale = Math.cos(c.rotation * 2);
				ctx.scale(1, Math.max(0.2, Math.abs(flipScale)));

				// Golden Coin Outer Rim
				ctx.beginPath();
				ctx.arc(0, 0, c.size / 2, 0, Math.PI * 2);
				const grad = ctx.createLinearGradient(
					-c.size / 2,
					-c.size / 2,
					c.size / 2,
					c.size / 2,
				);
				grad.addColorStop(0, '#FFF59D');
				grad.addColorStop(0.3, '#FFD700');
				grad.addColorStop(0.7, '#FFA000');
				grad.addColorStop(1, '#FF8F00');
				ctx.fillStyle = grad;
				ctx.shadowColor = 'rgba(251, 191, 36, 0.6)';
				ctx.shadowBlur = 8;
				ctx.fill();

				// Specular Border
				ctx.lineWidth = 1.5;
				ctx.strokeStyle = '#FFFFFF';
				ctx.stroke();

				// Inner Edge
				ctx.beginPath();
				ctx.arc(0, 0, c.size / 2 - 2.5, 0, Math.PI * 2);
				ctx.strokeStyle = 'rgba(92, 56, 0, 0.35)';
				ctx.lineWidth = 1;
				ctx.stroke();

				// Center ¢ symbol
				ctx.font = `900 ${Math.round(c.size * 0.48)}px sans-serif`;
				ctx.fillStyle = '#4E2C00';
				ctx.textAlign = 'center';
				ctx.textBaseline = 'middle';
				ctx.fillText('¢', 0, 0.5);

				ctx.restore();
			}

			if (activeRemaining > 0) {
				globalAnimId = requestAnimationFrame(renderLoop);
			} else {
				ctx.clearRect(0, 0, w, h);
				globalAnimId = null;

				// Guarantee final balance precision
				setBalance(finalBalance);

				// Show floating +AMOUNT 🪙 badge above target
				const badgeId = Math.random().toString(36).substring(2, 9);
				setActiveBadges((prev) => [
					...prev,
					{
						id: badgeId,
						x: tx,
						y: ty - 25,
						amount,
					},
				]);

				try {
					haptic.notify('success');
				} catch {}

				setTimeout(() => {
					setActiveBadges((prev) => prev.filter((b) => b.id !== badgeId));
					if (onFinish) onFinish();
				}, 1300);
			}
		};

		globalAnimId = requestAnimationFrame(renderLoop);
	}
};

// Aliases for unified calling
export const triggerCoinCelebration = (options: {
	amount: number;
	startX?: number;
	startY?: number;
	targetSelector?: string;
	onFinish?: () => void;
}) => {
	flyCoinsToBalance(options);
};

export const triggerRewardCelebration = (config: {
	reward: number;
	startX?: number;
	startY?: number;
	targetSelector?: string;
	onClose?: () => void;
}) => {
	flyCoinsToBalance({
		amount: config.reward,
		startX: config.startX,
		startY: config.startY,
		targetSelector: config.targetSelector,
		onFinish: config.onClose,
	});
};

/**
 * Mounted once globally in AppLayout.
 * Renders the high-performance transparent canvas for coin flight,
 * plus floating +AMOUNT badges.
 */
export const CoinCelebrationOverlay = () => {
	onCleanup(() => {
		if (globalAnimId) {
			cancelAnimationFrame(globalAnimId);
			globalAnimId = null;
		}
	});

	return (
		<div class="fixed inset-0 pointer-events-none z-[999999] overflow-hidden select-none">
			<style>{`
				@keyframes floatBadgeUp {
					0% {
						opacity: 0;
						transform: translate(-50%, 0) scale(0.6);
					}
					25% {
						opacity: 1;
						transform: translate(-50%, -15px) scale(1.15);
					}
					75% {
						opacity: 1;
						transform: translate(-50%, -35px) scale(1);
					}
					100% {
						opacity: 0;
						transform: translate(-50%, -55px) scale(0.85);
					}
				}
			`}</style>

			{/* Fullscreen Canvas for 60fps coin physics */}
			<canvas
				ref={(el) => {
					globalCanvas = el;
					const dpr = window.devicePixelRatio || 1;
					el.width = window.innerWidth * dpr;
					el.height = window.innerHeight * dpr;
					const ctx = el.getContext('2d');
					if (ctx) ctx.scale(dpr, dpr);
				}}
				class="w-full h-full block pointer-events-none"
			/>

			{/* Floating +AMOUNT Badges */}
			<For each={activeBadges()}>
				{(b) => (
					<div
						class="absolute font-mono font-black tabular-nums pointer-events-none"
						style={{
							left: `${b.x}px`,
							top: `${b.y}px`,
							animation: 'floatBadgeUp 1200ms cubic-bezier(0.16, 1, 0.3, 1) forwards',
						}}
					>
						<div class="px-3.5 py-1.5 rounded-full bg-[#12141C]/95 border border-amber-400/60 shadow-[0_6px_20px_rgba(245,158,11,0.5)] flex items-center gap-1.5 backdrop-blur-md">
							<span class="text-amber-400 text-[16px] drop-shadow-sm">🪙</span>
							<span class="text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-yellow-200 to-amber-400 text-[18px] font-black">
								+{b.amount.toLocaleString('en-US')}
							</span>
						</div>
					</div>
				)}
			</For>
		</div>
	);
};

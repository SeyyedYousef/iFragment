import { createSignal, For, onCleanup, onMount, Show } from 'solid-js';
import { haptic } from '@/shared/lib/haptic.js';

export interface CoinCelebrationOptions {
	amount: number;
	startX?: number;
	startY?: number;
	targetSelector?: string;
	onFinish?: () => void;
}

interface ActiveCelebration {
	id: string;
	amount: number;
	coins: Array<{
		id: number;
		x: number;
		y: number;
		tx: number;
		ty: number;
		delay: number;
		size: number;
	}>;
	badgeX: number;
	badgeY: number;
}

const [currentCelebration, setCurrentCelebration] = createSignal<ActiveCelebration | null>(null);

/**
 * Triggers a game-like coin burst animation towards the top balance counter.
 */
export const triggerCoinCelebration = (options: CoinCelebrationOptions) => {
	const { amount, startX, startY, targetSelector, onFinish } = options;
	if (amount <= 0) {
		if (onFinish) onFinish();
		return;
	}

	// Determine starting point (default: center of screen)
	const sx = startX ?? window.innerWidth / 2;
	const sy = startY ?? window.innerHeight / 2;

	// Determine target destination (default: top balance counter)
	let tx = window.innerWidth / 2;
	let ty = 120; // Fallback top area

	const targetEl = document.querySelector(targetSelector || '#airdrop-balance-counter');
	if (targetEl) {
		const rect = targetEl.getBoundingClientRect();
		tx = rect.left + rect.width / 2;
		ty = rect.top + rect.height / 2;
	}

	const coinCount = Math.min(22, Math.max(12, Math.floor(amount / 500) + 10));
	const coins = [];

	for (let i = 0; i < coinCount; i++) {
		// Spread explosion angle
		const angle = (Math.PI * 2 * i) / coinCount + (Math.random() - 0.5) * 0.5;
		const distance = 40 + Math.random() * 60;
		const burstX = sx + Math.cos(angle) * distance;
		const burstY = sy + Math.sin(angle) * distance;

		coins.push({
			id: i,
			x: burstX,
			y: burstY,
			tx,
			ty,
			delay: i * 35, // Staggered stream
			size: 24 + Math.random() * 8,
		});
	}

	const celebrationId = Math.random().toString(36).substring(2, 9);
	setCurrentCelebration({
		id: celebrationId,
		amount,
		coins,
		badgeX: sx,
		badgeY: sy - 40,
	});

	// Trigger haptic burst
	try {
		haptic.notify('success');
	} catch {}

	// Sequence impacts as coins arrive
	const impactTimer = setTimeout(() => {
		for (let i = 0; i < 4; i++) {
			setTimeout(() => {
				try {
					haptic.impact('light');
				} catch {}
			}, i * 90);
		}
	}, 350);

	// Clean up celebration after animation finishes (~1600ms)
	setTimeout(() => {
		if (currentCelebration()?.id === celebrationId) {
			setCurrentCelebration(null);
			if (onFinish) onFinish();
		}
	}, 1700);

	onCleanup(() => clearTimeout(impactTimer));
};

export const CoinCelebrationOverlay = () => {
	return (
		<Show when={currentCelebration()}>
			{(cel) => (
				<div class="fixed inset-0 pointer-events-none z-[99999] overflow-hidden select-none">
					<style>{`
						@keyframes coinFlyTarget {
							0% {
								opacity: 1;
								transform: translate3d(var(--sx), var(--sy), 0) scale(1) rotate(0deg);
							}
							15% {
								opacity: 1;
								transform: translate3d(var(--bx), var(--by), 0) scale(1.25) rotate(45deg);
							}
							85% {
								opacity: 0.95;
								transform: translate3d(var(--tx), var(--ty), 0) scale(0.95) rotate(540deg);
							}
							100% {
								opacity: 0;
								transform: translate3d(var(--tx), var(--ty), 0) scale(0.4) rotate(720deg);
							}
						}

						@keyframes rewardBadgeFloat {
							0% {
								opacity: 0;
								transform: translate(-50%, 10px) scale(0.7);
							}
							20% {
								opacity: 1;
								transform: translate(-50%, -15px) scale(1.1);
							}
							70% {
								opacity: 1;
								transform: translate(-50%, -40px) scale(1);
							}
							100% {
								opacity: 0;
								transform: translate(-50%, -65px) scale(0.85);
							}
						}
					`}</style>

					{/* Flying Golden Coins Flurry */}
					<For each={cel().coins}>
						{(c) => (
							<div
								class="absolute top-0 left-0 will-change-transform drop-shadow-[0_4px_12px_rgba(251,191,36,0.6)]"
								style={{
									width: `${c.size}px`,
									height: `${c.size}px`,
									'--sx': `${c.x - c.size / 2}px`,
									'--sy': `${c.y - c.size / 2}px`,
									'--bx': `${c.x + (Math.random() - 0.5) * 50}px`,
									'--by': `${c.y + (Math.random() - 0.5) * 50}px`,
									'--tx': `${c.tx - c.size / 2}px`,
									'--ty': `${c.ty - c.size / 2}px`,
									animation: `coinFlyTarget 950ms cubic-bezier(0.2, 0.9, 0.3, 1) forwards`,
									'animation-delay': `${c.delay}ms`,
								}}
							>
								{/* 3D Gleaming Coin Sprite */}
								<div class="w-full h-full rounded-full bg-gradient-to-b from-[#FFF099] via-[#FFD700] to-[#E69500] border-[1.5px] border-[#FFE57F] flex items-center justify-center shadow-[inset_0_2px_4px_rgba(255,255,255,0.8),0_2px_8px_rgba(0,0,0,0.4)]">
									<span class="text-[#5C3800] font-black text-[12px] leading-none select-none">
										¢
									</span>
								</div>
							</div>
						)}
					</For>

					{/* Floating Neon Badge: +AMOUNT 🪙 */}
					<div
						class="absolute font-black tracking-tight"
						style={{
							left: `${cel().badgeX}px`,
							top: `${cel().badgeY}px`,
							animation: 'rewardBadgeFloat 1400ms cubic-bezier(0.16, 1, 0.3, 1) forwards',
						}}
					>
						<div class="px-4 py-2 rounded-2xl bg-[#12141C]/95 border border-amber-400/50 backdrop-blur-xl shadow-[0_10px_35px_rgba(245,158,11,0.5)] flex items-center gap-2">
							<span class="text-[20px] drop-shadow-[0_0_8px_rgba(251,191,36,0.8)]">🪙</span>
							<span class="text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-yellow-200 to-amber-400 font-mono text-[22px] font-black tabular-nums tracking-tight">
								+{cel().amount.toLocaleString('en-US')}
							</span>
						</div>
					</div>
				</div>
			)}
		</Show>
	);
};

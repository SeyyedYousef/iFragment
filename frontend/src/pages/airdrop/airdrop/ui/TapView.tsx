import { Component, createSignal, onCleanup, onMount, Show } from 'solid-js';
import { haptic } from '@/shared/lib/haptic.js';
import { ShopView } from './ShopView.js';
import {
	balance,
	currentLeague,
	energy,
	maxEnergy,
	recordTaps,
	tapPower,
	isTurboActive,
	isRocketSpawned,
	activateTurbo,
	userClan,
	globalRank,
} from '@/shared/store/airdrop.js';
import { API_CONFIG } from '@/shared/api/config.js';

interface CanvasParticle {
	x: number;
	y: number;
	value: number;
	alpha: number;
	scale: number;
	velocity: number;
}

export const TapView: Component<{
	onLeagueClick?: () => void;
	onClanClick?: () => void;
	onShopClick?: () => void;
	onActionClick?: (tabId: string) => void;
}> = (props) => {
	const [showShopCoachmark, setShowShopCoachmark] = createSignal(
		!localStorage.getItem('airdrop-shop-coachmark-seen'),
	);
	const [showShopModal, setShowShopModal] = createSignal(false);
	const [isShaking, setIsShaking] = createSignal(false);

	const [comboCount, setComboCount] = createSignal(0);
	const [showCombo, setShowCombo] = createSignal(false);
	let comboTimerId: ReturnType<typeof setTimeout> | undefined;

	let canvasRef!: HTMLCanvasElement;
	let animationFrameId: number;
	let shakeTimerId: ReturnType<typeof setTimeout> | undefined;
	let pressTimerId: ReturnType<typeof setTimeout> | undefined;
	const particles: CanvasParticle[] = [];
	let isAnimating = false;
	let lastHapticAt = 0;
	let updateAndDrawFn: (() => void) | null = null;
	const activePointers = new Set<number>();

	onMount(() => {
		const container = canvasRef.parentElement;
		if (container) {
			const ro = new ResizeObserver(() => {
				const rect = container.getBoundingClientRect();
				if (canvasRef.width !== rect.width || canvasRef.height !== rect.height) {
					canvasRef.width = rect.width;
					canvasRef.height = rect.height;
				}
			});
			ro.observe(container);
			onCleanup(() => ro.disconnect());
		}

		const ctx = canvasRef.getContext('2d');
		if (!ctx) return;

		const updateAndDraw = () => {
			ctx.clearRect(0, 0, canvasRef.width, canvasRef.height);
			let activeParticles = 0;

			for (let i = 0; i < particles.length; i++) {
				const p = particles[i];
				if (p.alpha <= 0) continue;

				p.y -= p.velocity;
				p.alpha -= 0.02;
				p.scale += 0.005;

				if (p.alpha > 0) {
					activeParticles++;
					ctx.save();
					ctx.globalAlpha = Math.max(0, p.alpha);
					ctx.font = `900 ${Math.round(36 * p.scale)}px Vazirmatn, sans-serif`;
					ctx.fillStyle = '#ffffff';
					ctx.shadowColor = 'rgba(255, 255, 255, 0.8)';
					ctx.shadowBlur = 4;
					ctx.textAlign = 'center';
					ctx.fillText(`+${p.value}`, p.x, p.y);
					ctx.restore();
				}
			}

			for (let i = particles.length - 1; i >= 0; i--) {
				if (particles[i].alpha <= 0) {
					const last = particles.pop();
					if (last && i < particles.length) {
						particles[i] = last;
					}
				}
			}

			if (activeParticles > 0) {
				animationFrameId = requestAnimationFrame(updateAndDraw);
			} else {
				isAnimating = false;
			}
		};

		updateAndDrawFn = updateAndDraw;
	});

	onCleanup(() => {
		if (animationFrameId) cancelAnimationFrame(animationFrameId);
		if (shakeTimerId) clearTimeout(shakeTimerId);
		if (pressTimerId) clearTimeout(pressTimerId);
		if (comboTimerId) clearTimeout(comboTimerId);
	});

	const handleTap = (e: PointerEvent | MouseEvent) => {
		if (e.cancelable) e.preventDefault();
		const pointerId = (e as PointerEvent).pointerId ?? 1;
		if (activePointers.has(pointerId)) return;
		activePointers.add(pointerId);

		const isTurbo = isTurboActive();
		if (energy() <= 0 && !isTurbo) {
			activePointers.delete(pointerId);
			haptic.notify('error');
			setIsShaking(true);
			if (shakeTimerId) clearTimeout(shakeTimerId);
			shakeTimerId = setTimeout(() => {
				setIsShaking(false);
				shakeTimerId = undefined;
			}, 300);
			return;
		}

		const nowTime = performance.now();
		if (nowTime - lastHapticAt > 50) {
			haptic.impact('medium');
			lastHapticAt = nowTime;
		}

		let power = isTurbo ? tapPower() * 5 : tapPower();
		if (!isTurbo && energy() > 0 && energy() < tapPower()) {
			power = energy();
		}
		recordTaps(1);

		const rect = canvasRef.getBoundingClientRect();
		const x = (e as PointerEvent).clientX - rect.left;
		const y = (e as PointerEvent).clientY - rect.top;

		particles.push({
			x,
			y,
			value: power,
			alpha: 1.0,
			scale: 1.0,
			velocity: 3.0 + Math.random() * 2.0,
		});

		if (!isAnimating && updateAndDrawFn) {
			isAnimating = true;
			animationFrameId = requestAnimationFrame(updateAndDrawFn);
		}

		setComboCount((c) => c + 1);
		setShowCombo(true);
		if (comboTimerId) clearTimeout(comboTimerId);
		comboTimerId = setTimeout(() => {
			setShowCombo(false);
			setTimeout(() => setComboCount(0), 300);
		}, 1000);
	};

	const handlePointerUp = (e: PointerEvent | MouseEvent) => {
		activePointers.delete((e as PointerEvent).pointerId ?? 1);
	};

	return (
		<div class="theme-play flex-1 flex flex-col items-center relative overflow-hidden bg-[#08090D] text-white select-none">
			{/* Background Aura */}
			<div
				class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[140vw] h-[140vw] pointer-events-none z-0"
				style={{
					background: isTurboActive()
						? 'radial-gradient(circle at 50% 50%, rgba(239,68,68,0.5) 0%, rgba(255,255,255,0.15) 40%, transparent 70%)'
						: 'radial-gradient(circle at 50% 50%, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.02) 45%, transparent 70%)',
					filter: 'blur(50px)',
				}}
			/>

			<Show when={isRocketSpawned()}>
				<button
					onClick={() => activateTurbo()}
					class="absolute z-[70] text-[56px] drop-shadow-[0_0_20px_rgba(255,255,255,0.8)]"
					style={{ top: '35%', right: '8%', animation: 'float-up 4s ease-in-out infinite' }}
				>
					🚀
				</button>
			</Show>

			<canvas ref={canvasRef} class="absolute inset-0 w-full h-full pointer-events-none z-50" />

			{/* 1. Clan Bar */}
			<div class="w-full px-4 mt-4 relative z-20" dir="rtl">
				<button
					onClick={() => props.onClanClick?.()}
					class="w-full bg-[#151822]/80 backdrop-blur-md border border-white/10 rounded-[20px] flex items-center justify-between p-3.5 active:scale-95 transition-all shadow-lg"
				>
					<Show
						when={userClan()}
						fallback={
							<div class="flex items-center gap-3 w-full justify-between">
								<div class="flex items-center gap-3">
									<div class="w-10 h-10 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center text-white">
										🛡️
									</div>
									<span class="font-bold text-xs text-white">عضویت در کلن</span>
								</div>
								<span class="material-symbols-outlined text-white/40 text-[18px]">chevron_left</span>
							</div>
						}
					>
						{(clan) => (
							<div class="flex items-center justify-between w-full">
								<div class="flex items-center gap-3">
									<div class="w-10 h-10 rounded-xl bg-black border border-white/10 flex items-center justify-center overflow-hidden">
										<Show when={clan().channel_photo} fallback={<span class="text-xs font-bold text-white">🛡️</span>}>
											<img src={`${API_CONFIG.BASE_URL}/profile/clan/photo?username=${clan().channel_username}`} alt="" class="w-full h-full object-cover" />
										</Show>
									</div>
									<div class="flex flex-col text-start">
										<span class="font-black text-xs text-white truncate max-w-[140px]">{clan().chat_title}</span>
										<span class="text-[10px] font-mono text-white/70">{(clan().total_score || 0).toLocaleString()} امتیاز</span>
									</div>
								</div>
								<span class="text-[11px] font-mono text-white/50">#{globalRank() || '-'}</span>
							</div>
						)}
					</Show>
				</button>
			</div>

			{/* 2. Total Balance Header */}
			<button
				onClick={() => {
					if (showShopCoachmark()) {
						setShowShopCoachmark(false);
						localStorage.setItem('airdrop-shop-coachmark-seen', 'true');
					}
					setShowShopModal(true);
				}}
				class="flex items-center justify-center gap-3 active:scale-95 transition-transform relative z-20 mt-6 mb-1"
				dir="ltr"
			>
				<div class="w-10 h-10 rounded-full bg-white/10 border border-white/20 shadow-lg flex items-center justify-center shrink-0">
					<span class="text-white text-xl font-black">¢</span>
				</div>
				<span class="text-white font-black text-5xl tracking-tight font-mono drop-shadow-[0_0_15px_rgba(255,255,255,0.3)]">
					{balance().toLocaleString('en-US')}
				</span>
			</button>

			{/* 3. League Badge */}
			<button
				onClick={() => props.onLeagueClick?.()}
				class="flex items-center gap-2 mt-1 relative z-20 active:scale-95 transition-transform text-xs text-white/60 font-bold"
			>
				<span>🏆</span>
				<span>لیگ: {currentLeague().name}</span>
				<span class="material-symbols-outlined text-[14px]">chevron_left</span>
			</button>

			{/* 4. Giant Black & White Glowing Tap Coin */}
			<div class="flex-1 flex flex-col items-center justify-center w-full relative z-10 py-4">
				<div class={`relative flex items-center justify-center w-[80vw] max-w-[320px] aspect-square ${isShaking() ? 'animate-shake' : ''}`}>
					<button
						onPointerDown={handleTap}
						onPointerUp={handlePointerUp}
						onPointerLeave={handlePointerUp}
						onPointerCancel={handlePointerUp}
						class="relative w-[280px] h-[280px] rounded-full z-20 flex items-center justify-center touch-none select-none bg-black border border-white/10 active:scale-95 transition-transform"
						style={{
							'box-shadow': `
								0 0 0 2px rgba(255,255,255,0.08),
								inset 0 0 40px rgba(255,255,255,0.12),
								0 20px 50px rgba(0,0,0,0.9)
							`,
						}}
					>
						<Show when={showCombo()}>
							<div class="absolute top-6 right-6 text-white font-black text-2xl font-mono animate-bounce drop-shadow-[0_0_10px_rgba(255,255,255,0.8)]">
								x{comboCount()}
							</div>
						</Show>

						<svg
							viewBox="0 0 100 100"
							class="w-[50%] h-[50%] relative z-10"
							style={{
								filter: isTurboActive()
									? 'drop-shadow(0px 0px 15px rgba(255,80,80,1))'
									: 'drop-shadow(0px 0px 12px rgba(255,255,255,0.6))',
							}}
						>
							<path d="M 11 14 L 89 14 L 50 36 Z" fill="#ffffff" stroke="#ffffff" stroke-width="1.5" stroke-linejoin="round" />
							<path d="M 7 19 L 47 42 L 47 88 Z" fill="#ffffff" stroke="#ffffff" stroke-width="1.5" stroke-linejoin="round" />
							<path d="M 93 19 L 53 42 L 53 88 Z" fill="#ffffff" stroke="#ffffff" stroke-width="1.5" stroke-linejoin="round" />
						</svg>
					</button>
				</div>
			</div>

			{/* 5. Bottom Energy Bar & Action Pills */}
			<div class="w-full flex items-center justify-between px-6 mb-24 relative z-30" dir="rtl">
				<div class="flex flex-col">
					<div class="flex items-center gap-1 text-white">
						<span class="material-symbols-outlined text-[18px] text-amber-400">bolt</span>
						<span class="text-sm font-black font-mono text-white">{energy()}</span>
						<span class="text-xs font-mono text-white/40">/ {maxEnergy()}</span>
					</div>
					<Show when={energy() <= 0}>
						<span class="text-[10px] text-amber-400 font-bold animate-pulse">انرژی تمام شد - در حال شارژ...</span>
					</Show>
				</div>

				<div class="flex items-center bg-[#151822]/90 border border-white/10 rounded-2xl p-1 gap-1" dir="rtl">
					<button
						onClick={() => props.onActionClick?.('boost')}
						class="px-3 py-1.5 rounded-xl text-xs font-bold text-white/80 hover:text-white flex items-center gap-1 hover:bg-white/5 transition-all"
					>
						<span class="material-symbols-outlined text-amber-400 text-[18px]">rocket_launch</span>
						بوستر
					</button>
					<button
						onClick={() => props.onActionClick?.('earn')}
						class="px-3 py-1.5 rounded-xl text-xs font-bold text-white/80 hover:text-white flex items-center gap-1 hover:bg-white/5 transition-all"
					>
						<span class="material-symbols-outlined text-[#10b981] text-[18px]">task_alt</span>
						تسک‌ها
					</button>
					<button
						onClick={() => props.onActionClick?.('frens')}
						class="px-3 py-1.5 rounded-xl text-xs font-bold text-white/80 hover:text-white flex items-center gap-1 hover:bg-white/5 transition-all"
					>
						<span class="material-symbols-outlined text-[#3390ec] text-[18px]">group</span>
						دوستان
					</button>
				</div>
			</div>

			{/* Shop Modal */}
			<Show when={showShopModal()}>
				<div class="fixed inset-0 z-[100] flex flex-col justify-end">
					<div class="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setShowShopModal(false)} />
					<div class="relative w-full h-[85vh] bg-[#0F1117] rounded-t-[28px] border-t border-white/10 flex flex-col animate-slide-up shadow-2xl overflow-hidden">
						<div class="w-full flex justify-center py-3 shrink-0" onClick={() => setShowShopModal(false)}>
							<div class="w-12 h-1.5 rounded-full bg-white/20" />
						</div>
						<div class="flex-1 overflow-hidden relative">
							<ShopView />
						</div>
					</div>
				</div>
			</Show>
		</div>
	);
};

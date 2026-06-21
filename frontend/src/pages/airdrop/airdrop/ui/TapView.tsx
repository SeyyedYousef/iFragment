import { Component, createSignal, onCleanup, onMount, Show } from 'solid-js';
import { haptic } from '@/shared/lib/haptic.js';
import { ShopView } from './ShopView.js';
import { Coin3D } from './Coin3D.js';
import { createQuery } from '@tanstack/solid-query';
import { getProfileStats } from '@/shared/api/profile.js';
import { t } from '@/shared/i18n/index.js';
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
} from '@/shared/store/airdrop.js';

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
	const [isPressed, setIsPressed] = createSignal(false);
	const [showShopCoachmark, setShowShopCoachmark] = createSignal(
		!localStorage.getItem('airdrop-shop-coachmark-seen'),
	);
	const [showShopModal, setShowShopModal] = createSignal(false);
	const [isShaking, setIsShaking] = createSignal(false);
	const statsQuery = createQuery(() => ({
		queryKey: ['profile-stats-tap'],
		queryFn: getProfileStats,
		staleTime: 60_000,
	}));

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
				p.alpha -= 0.015; // smooth fade out
				p.scale += 0.005; // slight enlargement

				if (p.alpha > 0) {
					activeParticles++;
					ctx.save();
					ctx.globalAlpha = p.alpha;
					ctx.font = `900 ${Math.round(28 * p.scale)}px Inter, sans-serif`;
					ctx.fillStyle = '#ffffff';
					ctx.shadowColor = currentLeague().color;
					ctx.shadowBlur = 15;
					ctx.textAlign = 'center';
					ctx.fillText(`+${p.value}`, p.x, p.y);
					ctx.restore();
				}
			}

			// Cleanup dead particles (swap & pop to avoid splice array shift cost)
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
	});

	const handleTap = (e: PointerEvent | MouseEvent) => {
		// Prevent default browser behavior
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

		// Throttle haptic triggers to avoid overlapping (50ms)
		const nowTime = performance.now();
		if (nowTime - lastHapticAt > 50) {
			haptic.impact('heavy');
			lastHapticAt = nowTime;
		}

		const power = isTurbo ? tapPower() * 5 : tapPower();
		recordTaps(1);

		const rect = canvasRef.getBoundingClientRect();
		const x = (e as PointerEvent).clientX - rect.left;
		const y = (e as PointerEvent).clientY - rect.top;

		// Push new particle into zero-allocation thread safe Canvas rendering pipeline
		particles.push({
			x,
			y,
			value: power,
			alpha: 1.0,
			scale: 1.0,
			velocity: 2.0 + Math.random() * 1.5,
		});

		if (!isAnimating && updateAndDrawFn) {
			isAnimating = true;
			animationFrameId = requestAnimationFrame(updateAndDrawFn);
		}

		// Coin press animation
		setIsPressed(true);
		if (pressTimerId) clearTimeout(pressTimerId);
		pressTimerId = setTimeout(() => {
			setIsPressed(false);
			pressTimerId = undefined;
		}, 80);
	};

	const handlePointerUp = (e: PointerEvent | MouseEvent) => {
		activePointers.delete((e as PointerEvent).pointerId ?? 1);
	};

	
	const shareToStory = () => {
		if (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.shareToStory) {
			window.Telegram.WebApp.shareToStory('https://t.me/iFragment_bot', {
				text: `I just earned ${energy()} energy on iFragment! Join my squad.`,
			});
		} else {
			alert("Telegram Stories API is only available inside Telegram Mobile App.");
		}
	};

	return (
		<div
			class="flex-1 flex flex-col items-center relative overflow-hidden px-4 pt-2 pb-6 bg-[#000000]"
		>
			{/* Flying Rocket for Turbo */}
			<Show when={isRocketSpawned()}>
				<button
					onClick={() => activateTurbo()}
					class="absolute z-[70] text-[56px] drop-shadow-[0_0_20px_rgba(239,68,68,0.8)] animate-rocket-fly"
					style={{ top: '10%', left: '10%' }}
				>
					🚀
				</button>
			</Show>

			{/* Floating GPU-accelerated canvas particles layer */}
			<canvas ref={canvasRef} class="absolute inset-0 w-full h-full pointer-events-none z-50" />

			{/* Clan Bar */}
			<div class="w-full px-4 mt-0 mb-3 z-10 flex justify-center">
				<button
					onClick={() => props.onClanClick?.()}
					class="w-full bg-[#1a1a1c]/90 border border-white/5 backdrop-blur-md rounded-2xl flex items-center justify-between p-3 shadow-lg active:scale-95 transition-transform"
				>
					<Show when={userClan()} fallback={
						<div class="flex items-center justify-between w-full">
							<div class="flex items-center gap-3">
								<div class="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
									<span class="text-white/50 text-[18px]">🛡️</span>
								</div>
								<span class="text-white font-bold text-[14px]">{t('airdropFinal.tap.joinClan')}</span>
							</div>
							<span class="material-symbols-outlined text-white/40">chevron_right</span>
						</div>
					}>
						{(clan) => (
							<>
								<div class="flex items-center gap-3">
									<div class="w-10 h-10 rounded-xl bg-black/50 border border-white/10 flex items-center justify-center overflow-hidden shrink-0">
										<Show when={clan().channel_photo} fallback={<span class="text-white/50 text-[10px] font-bold">logo</span>}>
											<img src={clan().channel_photo} alt={clan().chat_title} class="w-full h-full object-cover" />
										</Show>
									</div>
									<div class="flex flex-col items-start min-w-0">
										<span class="text-white font-bold text-[14px] truncate w-full text-left">{clan().chat_title}</span>
										<div class="flex items-center gap-1 mt-0.5">
											<span class="material-symbols-outlined text-[#FFC107] text-[12px]" style={{ 'font-variation-settings': '"FILL" 1' }}>monetization_on</span>
											<span class="text-white/60 text-[12px] tabular-nums font-medium">
												{(clan().total_score || clan().members_count * 1500).toLocaleString('en-US')}
											</span>
										</div>
									</div>
								</div>
								<div class="flex items-center gap-1.5 opacity-80 shrink-0 ml-2">
									<span class="material-symbols-outlined text-[#C0C0C0] text-[18px]" style={{ color: currentLeague().color, 'font-variation-settings': '"FILL" 1' }}>emoji_events</span>
									<span class="text-white font-bold text-[13px]" style={{ color: currentLeague().color }}>{currentLeague().name}</span>
								</div>
							</>
						)}
					</Show>
				</button>
			</div>

			{/* Action Buttons (Tasks, Frens, Boost) */}
			<div class="w-full px-4 mb-6 z-10 flex items-center justify-center gap-2 mx-auto">
				<button
					onClick={() => props.onActionClick?.('earn')}
					class="flex items-center justify-center gap-1.5 flex-1 bg-[#1c1c1e] border border-white/5 rounded-[16px] h-[52px] active:scale-95 transition-transform"
				>
					<span class="material-symbols-outlined text-[20px] text-white" style={{ 'font-variation-settings': '"FILL" 1' }}>assignment</span>
					<span class="text-[13px] font-bold text-white tracking-tight">{t('airdropTabs.earn' as any) || 'تسک‌ها'}</span>
				</button>

				<button
					onClick={() => props.onActionClick?.('frens')}
					class="flex items-center justify-center gap-1.5 flex-1 bg-[#1c1c1e] border border-white/5 rounded-[16px] h-[52px] active:scale-95 transition-transform"
				>
					<span class="material-symbols-outlined text-[20px] text-white" style={{ 'font-variation-settings': '"FILL" 1' }}>group</span>
					<span class="text-[13px] font-bold text-white tracking-tight">Frens</span>
				</button>

				<button
					onClick={() => props.onActionClick?.('boost')}
					class="flex items-center justify-center gap-1.5 flex-1 bg-[#1c1c1e] border border-white/5 rounded-[16px] h-[52px] active:scale-95 transition-transform"
				>
					<span class="material-symbols-outlined text-[20px] text-white">rocket_launch</span>
					<span class="text-[13px] font-bold text-white tracking-tight">{t('airdropTabs.boost' as any) || 'ارتقا'}</span>
				</button>
			</div>

			{/* Top Mining Info */}
			<div class="text-center z-10 w-full flex flex-col items-center mb-2 mt-2" dir="ltr">
				<button 
					onClick={() => {
						if (showShopCoachmark()) {
							setShowShopCoachmark(false);
							localStorage.setItem('airdrop-shop-coachmark-seen', 'true');
						}
						setShowShopModal(true);
					}}
					class="flex items-center justify-center gap-2 active:scale-95 transition-transform relative"
				>
					{showShopCoachmark() && (
						<div class="absolute -top-12 left-1/2 -translate-x-1/2 bg-[#3390ec] text-white text-[12px] font-bold px-3 py-1.5 rounded-lg shadow-lg whitespace-nowrap animate-bounce z-50 after:content-[''] after:absolute after:-bottom-1.5 after:left-1/2 after:-translate-x-1/2 after:border-4 after:border-transparent after:border-t-[#3390ec]">
							{t('shopInfo.coachmark' as any)}
						</div>
					)}
					<div class="w-12 h-12 rounded-full flex items-center justify-center drop-shadow-[0_0_15px_rgba(251,191,36,0.6)]">
						<span
							class="material-symbols-outlined text-[#FFC107] text-[48px]"
							style={{ 'font-variation-settings': '"FILL" 1' }}
						>
							monetization_on
						</span>
					</div>
					<span class="text-white text-[56px] font-bold tabular-nums leading-none tracking-tighter">
						{balance().toLocaleString('en-US')}
					</span>
				</button>
				<button
					onClick={() => props.onLeagueClick?.()}
					class="flex items-center justify-center gap-2 mt-1 cursor-pointer active:scale-95 transition-transform"
				>
					<Show 
						when={statsQuery.data?.globalRank}
						fallback={
							<>
								<div class="flex items-center gap-0.5">
									<span class="text-white/30 text-[20px] font-thin leading-none">{'{'}</span>
									<span class="text-[#FFD700] text-[14px] font-black tracking-[0.15em] drop-shadow-[0_0_15px_rgba(255,215,0,0.8)] uppercase px-1">125TH</span>
									<span class="text-white/30 text-[20px] font-thin leading-none">{'}'}</span>
								</div>
								<span class="text-white/20 text-[10px] mx-1.5">•</span>
							</>
						}
					>
						{(() => {
							const rank = statsQuery.data?.globalRank || 0;
							const j = rank % 10;
							const k = rank % 100;
							let suffix = 'TH';
							if (j === 1 && k !== 11) suffix = 'ST';
							else if (j === 2 && k !== 12) suffix = 'ND';
							else if (j === 3 && k !== 13) suffix = 'RD';
							
	const shareToStory = () => {
		if (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.shareToStory) {
			window.Telegram.WebApp.shareToStory('https://t.me/iFragment_bot', {
				text: `I just earned ${energy()} energy on iFragment! Join my squad.`,
			});
		} else {
			alert("Telegram Stories API is only available inside Telegram Mobile App.");
		}
	};

	return (
								<>
									<div class="flex items-center gap-0.5">
										<span class="text-white/30 text-[20px] font-thin leading-none">{'{'}</span>
										<span class="text-[#FFD700] text-[14px] font-black tracking-[0.15em] drop-shadow-[0_0_15px_rgba(255,215,0,0.8)] uppercase px-1">{rank.toLocaleString('en-US')}{suffix}</span>
										<span class="text-white/30 text-[20px] font-thin leading-none">{'}'}</span>
									</div>
									<span class="text-white/20 text-[10px] mx-1.5">•</span>
								</>
							);
						})()}
					</Show>
					<span
						class="material-symbols-outlined text-[18px]"
						style={{ color: currentLeague().color, 'font-variation-settings': '"FILL" 1' }}
					>
						{currentLeague().icon}
					</span>
					<span class="text-[15px] font-bold" style={{ color: currentLeague().color }}>{currentLeague().name}</span>
					<span class="material-symbols-outlined text-[16px] text-white/40">chevron_right</span>
				</button>
			</div>

			{/* Main Coin Section */}
			<div class="flex flex-col items-center justify-center w-full mt-8 mb-auto relative z-10">
				<div class="relative flex items-center justify-center w-full max-w-[420px] aspect-square">
					
					{/* ═══════════ LAYER 4: Outer Bloom (پخش گسترده) ═══════════ */}
					<div
						class="absolute inset-0 rounded-full pointer-events-none transition-colors duration-500 will-change-transform"
						style={{
							background: isTurboActive()
								? 'radial-gradient(circle, rgba(239,68,68,0.35) 0%, rgba(239,68,68,0.18) 25%, rgba(239,68,68,0.06) 50%, transparent 70%)'
								: 'radial-gradient(circle, rgba(255,255,255,0.30) 0%, rgba(255,255,255,0.15) 25%, rgba(255,255,255,0.05) 50%, transparent 70%)',
							filter: 'blur(40px)',
							transform: 'scale(1.4)',
							animation: 'aura-breathe 4s ease-in-out infinite',
						}}
					/>

					{/* ═══════════ LAYER 3: Mid Aura (هاله متوسط) ═══════════ */}
					<div
						class="absolute inset-0 rounded-full pointer-events-none transition-colors duration-500 will-change-transform"
						style={{
							background: isTurboActive()
								? 'radial-gradient(circle, rgba(255,180,180,0.55) 0%, rgba(239,68,68,0.35) 30%, rgba(239,68,68,0.1) 55%, transparent 75%)'
								: 'radial-gradient(circle, rgba(255,255,255,0.55) 0%, rgba(220,225,235,0.30) 30%, rgba(180,185,200,0.08) 55%, transparent 75%)',
							filter: 'blur(22px)',
							transform: 'scale(1.18)',
						}}
					/>

					{/* ═══════════ THE COIN BUTTON (سکه واقعی 3D) ═══════════ */}
					<div class="relative w-[78%] h-[78%] rounded-full z-20">
						<Coin3D 
							onTap={handleTap} 
							isPressed={isPressed()} 
							isTurboActive={isTurboActive()} 
						/>
						{/* Glow/Shadow under the 3D coin for Eclipse effect */}
						<div class="absolute inset-0 rounded-full pointer-events-none" style={{
							'box-shadow': isTurboActive()
								? `
									0 0 0 1.5px rgba(255,255,255,0.95),
									0 0 4px 2px rgba(255,220,220,0.9),
									0 0 12px 4px rgba(255,150,150,0.7),
									0 0 30px 8px rgba(239,68,68,0.5),
									inset 0 0 0 1px rgba(255,255,255,0.1)
								`
								: `
									0 0 0 1.5px rgba(255,255,255,0.95),
									0 0 4px 2px rgba(255,255,255,0.85),
									0 0 12px 4px rgba(255,255,255,0.6),
									0 0 30px 8px rgba(230,235,245,0.4),
									inset 0 0 0 1px rgba(255,255,255,0.08)
								`
						}}></div>
						<div class="absolute inset-0 rounded-full flex flex-col items-center justify-center overflow-hidden pointer-events-none">
							{/* Triangle Logo with subtle glow */}
							<svg
								viewBox="0 0 100 100"
								class="w-[45%] h-[45%] -mt-6"
								style={{ 
									filter: isTurboActive()
										? 'drop-shadow(0px 0px 12px rgba(255,200,200,0.9)) drop-shadow(0px 0px 4px rgba(255,255,255,1))'
										: 'drop-shadow(0px 0px 10px rgba(255,255,255,0.7)) drop-shadow(0px 0px 3px rgba(255,255,255,1))'
								}}
							>
								<path 
									d="M 50 15 L 15 80 L 85 80 Z" 
									fill="none" 
									stroke="white" 
									stroke-width="12" 
									stroke-linejoin="round" 
									stroke-linecap="round"
								/>
								<path 
									d="M 50 15 L 50 80" 
									fill="none" 
									stroke="white" 
									stroke-width="12" 
									stroke-linecap="round"
								/>
							</svg>

							{/* Energy Counter Inside Coin */}
							<div class="absolute bottom-[14%] left-1/2 -translate-x-1/2 flex items-center gap-1.5 bg-[#1c1c1e]/80 backdrop-blur-md px-4 py-1.5 rounded-full border border-white/5 shadow-lg pointer-events-none">
								<span class="text-white/50 font-bold text-[14px] tabular-nums">{energy()} /</span>
								<span class="text-white font-bold text-[16px] tabular-nums">{maxEnergy()}</span>
								<span class="material-symbols-outlined text-[#FFC107] text-[18px]" style={{ 'font-variation-settings': '"FILL" 1' }}>bolt</span>
							</div>
						</div>
					</div>
				</div>
			</div>

						{/* Shop Modal / Bottom Sheet */}
			<Show when={showAutoTapModal()}>
				<div class="fixed inset-0 z-[120] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-fade-in px-4">
					<div class="bg-[#1c1c1e] border border-[#ffb000]/30 rounded-3xl p-6 w-full max-w-[340px] flex flex-col items-center shadow-[0_0_50px_rgba(255,176,0,0.2)] animate-scale-up">
						<div class="w-20 h-20 mb-4 bg-gradient-to-br from-[#ffb000] to-[#ff8000] rounded-full flex items-center justify-center shadow-lg">
							<span class="material-symbols-outlined text-4xl text-white">smart_toy</span>
						</div>
						<h2 class="text-2xl font-bold text-white mb-2 text-center">Auto-Tap Bot</h2>
						<p class="text-white/60 text-center text-sm mb-6">
							The bot was mining while you were sleeping! Here is what it collected in the last 12 hours.
						</p>
						<div class="flex items-center gap-2 mb-8">
							<span class="material-symbols-outlined text-[#FFC107] text-[28px]" style={{ 'font-variation-settings': '"FILL" 1' }}>toll</span>
							<span class="text-4xl font-extrabold text-[#FFC107] tabular-nums">+{offlineEarnings().toLocaleString()}</span>
						</div>
						<button 
							onClick={() => setShowAutoTapModal(false)}
							class="w-full bg-[#ffb000] hover:bg-[#ff9000] text-black font-bold py-4 rounded-xl text-lg transition-colors shadow-[0_0_20px_rgba(255,176,0,0.4)]"
						>
							Claim Coins
						</button>
					</div>
				</div>
			</Show>
			<Show when={showShopModal()}>
				<div class="fixed inset-0 z-[100] flex flex-col justify-end">
					{/* Backdrop */}
					<div
						class="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in"
						onClick={() => setShowShopModal(false)}
					/>

					{/* Sheet Content */}
					<div class="relative w-full h-[85vh] bg-[#0f0f13] rounded-t-3xl border-t border-white/10 flex flex-col animate-slide-up shadow-[0_-10px_40px_rgba(0,0,0,0.5)] overflow-hidden">
						{/* Drag handle */}
						<div class="w-full flex justify-center py-3 shrink-0" onClick={() => setShowShopModal(false)}>
							<div class="w-12 h-1.5 rounded-full bg-white/20" />
						</div>

						{/* Close button */}
						<button
							onClick={() => setShowShopModal(false)}
							class="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-white/10 text-white/50 hover:bg-white/20 hover:text-white transition-colors"
						>
							<span class="material-symbols-outlined text-[20px]">close</span>
						</button>

						<div class="flex-1 overflow-hidden relative">
							<ShopView />
						</div>
					</div>
				</div>
			</Show>
		</div>
	);
};

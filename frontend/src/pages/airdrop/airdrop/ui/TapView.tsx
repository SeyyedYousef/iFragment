import { type Component, createSignal, For, onCleanup, onMount, Show } from 'solid-js';
import {
	activateTurbo,
	balance,
	checkedInToday,
	claimDailyReward,
	currentLeague,
	DAILY_REWARDS,
	dailyFatigueLimitRemaining,
	dailyFatigueMultiplier,
	energy,
	globalRank,
	isRocketSpawned,
	isTurboActive,
	maxEnergy,
	recordTaps,
	streakDay,
	tapPower,
	turboExpiresAt,
	userClan,
} from '@/entities/airdrop/index.js';
import { API_CONFIG } from '@/shared/api/config.js';
import { formatNumber, t } from '@/shared/i18n/index.js';
import { haptic } from '@/shared/lib/haptic.js';
import { flyCoinsToBalance } from '@/shared/ui/index.js';
import { ShopView } from './ShopView.js';

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
	const [showStreakModal, setShowStreakModal] = createSignal(false);
	const [showRateInfoModal, setShowRateInfoModal] = createSignal(false);
	const [isClaimingStreak, setIsClaimingStreak] = createSignal(false);
	const [isShaking, setIsShaking] = createSignal(false);

	// Micro-interactions
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
					ctx.font = `900 ${Math.round(36 * p.scale)}px Inter, sans-serif`;
					ctx.fillStyle = '#ffffff';
					ctx.shadowColor = 'rgba(0,0,0,0.5)';
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

	const spawnFragment = (x: number, y: number) => {
		for (let i = 0; i < 2; i++) {
			const frag = document.createElement('div');
			frag.className = 'absolute pointer-events-none z-50';
			const angle = Math.random() * 360;
			const dist = 60 + Math.random() * 60;
			frag.style.cssText = `
				left:${x}px; top:${y}px;
				width:0; height:0;
				border-left:5px solid transparent;
				border-right:5px solid transparent;
				border-bottom:12px solid rgba(255,255,255,0.85);
				transform: rotate(${angle}deg);
				animation: fragmentFly 800ms cubic-bezier(.2,.7,.2,1) forwards;
				--dx: ${Math.cos((angle * Math.PI) / 180) * dist}px;
				--dy: ${Math.sin((angle * Math.PI) / 180) * dist}px;
			`;
			document.body.appendChild(frag);
			setTimeout(() => frag.remove(), 800);
		}
	};

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

		spawnFragment((e as PointerEvent).clientX, (e as PointerEvent).clientY);

		if (!isAnimating && updateAndDrawFn) {
			isAnimating = true;
			animationFrameId = requestAnimationFrame(updateAndDrawFn);
		}

		// Combo system
		setComboCount((c) => c + 1);
		setShowCombo(true);
		if (comboTimerId) clearTimeout(comboTimerId);
		comboTimerId = setTimeout(() => {
			setShowCombo(false);
			setTimeout(() => setComboCount(0), 300);
		}, 1000);

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

	return (
		<div class="flex-1 w-full max-w-full min-h-full flex flex-col items-center relative select-none bg-[#000000] text-white pb-4 overflow-x-hidden">
			<style>{`
				@keyframes fragmentFly {
					to {
						transform: translate(var(--dx), var(--dy)) rotate(720deg);
						opacity: 0;
					}
				}
				@keyframes spinSlow {
					from { transform: rotate(0deg); }
					to { transform: rotate(360deg); }
				}
				@keyframes idleBreathing {
					0%, 100% { transform: scale(1); }
					50% { transform: scale(1.02); }
				}
				.tab-num {
					font-feature-settings: "tnum";
					font-variant-numeric: tabular-nums;
				}
				@keyframes rocketFloat {
					0%, 100% { transform: translate(0, 0) rotate(0deg); }
					33% { transform: translate(-20px, 30px) rotate(-10deg) scale(1.1); }
					66% { transform: translate(15px, -20px) rotate(15deg) scale(0.9); }
				}
				@keyframes coinShake {
					0%, 100% { transform: translateX(0); }
					25% { transform: translateX(-6px) rotate(-1deg); }
					75% { transform: translateX(6px) rotate(1deg); }
				}
				.animate-shake {
					animation: coinShake 0.15s ease-in-out 2;
				}
				.coin-wrapper {
					animation: idleBreathing 4s ease-in-out infinite;
				}
			`}</style>

			{/* Background Aura (Z-0) - Contained in overflow-hidden wrapper */}
			<div class="absolute inset-0 overflow-hidden pointer-events-none z-0">
				<div
					class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[160vw] h-[160vw] pointer-events-none"
					style={{
						background: isTurboActive()
							? 'radial-gradient(circle at 50% 50%, rgba(255,60,60,0.8) 0%, rgba(255,40,40,0.3) 30%, transparent 60%)'
							: 'radial-gradient(circle at 50% 50%, rgba(255,255,255,0.7) 0%, rgba(255,255,255,0.15) 35%, transparent 65%)',
						filter: 'blur(40px)',
					}}
				/>
			</div>

			{/* Flying Rocket for Turbo */}
			<Show when={isRocketSpawned()}>
				<button
					type="button"
					onClick={() => activateTurbo()}
					class="absolute z-[70] text-[56px] drop-shadow-[0_0_20px_rgba(239,68,68,0.8)]"
					style={{ top: '35%', right: '8%', animation: 'rocketFloat 4s ease-in-out infinite' }}
				>
					🚀
				</button>
			</Show>

			<canvas ref={canvasRef} class="absolute inset-0 w-full h-full pointer-events-none z-50" />

			{/* 1. Clan Bar & Leaderboard (Top - Z-20) */}
			<div class="w-full px-4 mt-5 relative z-20 flex items-center gap-2.5" dir="rtl">
				<button
					type="button"
					onClick={() => props.onClanClick?.()}
					class="flex-1 bg-[#12141C]/80 backdrop-blur-xl border border-white/10 hover:border-white/20 rounded-[22px] p-3 active:scale-[0.98] transition-all duration-300 shadow-[0_8px_32px_rgba(0,0,0,0.5)] relative overflow-hidden group"
				>
					<div class="absolute -right-10 -top-10 w-32 h-32 bg-[#3390ec]/20 rounded-full blur-2xl pointer-events-none group-hover:bg-[#3390ec]/30 transition-all" />
					<div class="absolute -left-10 -bottom-10 w-32 h-32 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />

					<Show
						when={userClan()}
						fallback={
							<div class="flex items-center justify-between w-full relative z-10">
								<div class="flex items-center gap-3">
									<div class="w-10 h-10 rounded-[14px] bg-gradient-to-br from-white/10 to-white/5 border border-white/5 flex items-center justify-center shrink-0 shadow-inner">
										<span class="text-lg">🛡️</span>
									</div>
									<div class="flex flex-col items-start text-right">
										<span class="font-black text-xs text-white">
											{t('airdrop.clan.joinClanBtn')}
										</span>
										<span class="text-[10px] text-white/50 font-medium">
											{t('airdrop.clan.joinClanSubtitle')}
										</span>
									</div>
								</div>
								<div class="w-7 h-7 rounded-full bg-white/5 flex items-center justify-center text-white/40 group-hover:text-white group-hover:bg-white/10 transition-all">
									<span class="material-symbols-outlined text-[16px] rtl:-scale-x-100">
										chevron_left
									</span>
								</div>
							</div>
						}
					>
						{(clan) => {
							const rank = globalRank();
							const currentRank = rank > 0 ? `#${rank.toLocaleString('en-US')}` : '#-';
							const score = clan().total_score || clan().members_count * 1500;

							return (
								<div class="flex items-center justify-between w-full relative z-10 gap-3">
									<div class="flex items-center gap-3 min-w-0 flex-1">
										<div class="w-11 h-11 rounded-[14px] p-[1.5px] bg-gradient-to-br from-white/20 via-white/5 to-transparent shadow-lg shrink-0 overflow-hidden">
											<div class="w-full h-full bg-[#08090D] rounded-[12.5px] overflow-hidden flex items-center justify-center relative">
												<Show
													when={clan().channel_photo}
													fallback={
														<div class="w-full h-full bg-gradient-to-br from-[#1c2230] to-[#0f1117] flex items-center justify-center p-2.5">
															<svg
																viewBox="0 0 100 100"
																class="w-full h-full text-white fill-current drop-shadow"
																aria-hidden="true"
															>
																<path d="M 11 14 L 89 14 L 50 36 Z" />
																<path d="M 7 19 L 47 42 L 47 88 Z" />
																<path d="M 93 19 L 53 42 L 53 88 Z" />
															</svg>
														</div>
													}
												>
													<img
														loading="lazy"
														src={`${API_CONFIG.BASE_URL}/profile/clan/photo?username=${clan().channel_username}`}
														alt={clan().chat_title}
														class="w-full h-full object-cover"
													/>
												</Show>
											</div>
										</div>
										<div class="flex flex-col items-start min-w-0 text-right">
											<span class="font-black text-[13px] text-white truncate max-w-[170px] tracking-tight leading-snug">
												{clan().chat_title}
											</span>
											<div class="flex items-center gap-1.5 mt-[2px]">
												<span class="text-[11px] font-mono font-bold text-white/80 tabular-nums">
													{formatNumber(score)}
												</span>
												<span class="text-[10px] font-bold text-white/40">
													{t('airdrop.clan.scoreLabelText')}
												</span>
											</div>
										</div>
									</div>
									<div class="flex flex-col items-end shrink-0">
										<div class="px-2.5 py-1 rounded-xl bg-white/5 border border-white/10 backdrop-blur-md flex items-center gap-1 shadow-sm">
											<span class="text-xs font-black font-mono text-amber-300 drop-shadow-[0_0_8px_rgba(252,211,77,0.4)]">
												{currentRank}
											</span>
										</div>
									</div>
								</div>
							);
						}}
					</Show>
				</button>
				<button
					type="button"
					onClick={() => props.onLeagueClick?.()}
					aria-label={t('gamification.leaderboard' as any) || 'Leaderboard'}
					class="w-[54px] h-[54px] bg-[#12141C]/80 hover:bg-[#12141C] backdrop-blur-xl border border-white/10 hover:border-amber-400/40 rounded-[20px] flex items-center justify-center shrink-0 active:scale-95 transition-all shadow-[0_8px_20px_rgba(0,0,0,0.4)] group"
				>
					<span class="text-[24px] group-hover:scale-110 transition-transform drop-shadow-[0_0_10px_rgba(252,211,77,0.6)]">
						🏆
					</span>
				</button>
			</div>

			{/* 2. Total Coins (Balance - Z-20) - Perfected spacing and alignment */}
			<button
				id="airdrop-balance-counter"
				type="button"
				onClick={() => {
					if (showShopCoachmark()) {
						setShowShopCoachmark(false);
						localStorage.setItem('airdrop-shop-coachmark-seen', 'true');
					}
					setShowShopModal(true);
				}}
				class="flex items-center justify-center gap-2.5 active:scale-95 transition-transform relative z-20 mt-7 mb-2"
				dir="ltr"
			>
				{showShopCoachmark() && (
					<div class="absolute -top-12 left-1/2 -translate-x-1/2 bg-[#3390ec] text-white text-[12px] font-bold px-3 py-1.5 rounded-lg shadow-lg whitespace-nowrap animate-pulse z-50 after:content-[''] after:absolute after:-bottom-1.5 after:left-1/2 after:-translate-x-1/2 after:border-4 after:border-transparent after:border-t-[#3390ec]">
						{t('shopInfo.coachmark' as any)}
					</div>
				)}
				{/* Premium Coin Icon */}
				<div class="w-10 h-10 rounded-full bg-gradient-to-b from-[#FFD700] via-[#F7B733] to-[#FC4A1A] shadow-[inset_0_-3px_8px_rgba(0,0,0,0.3),0_4px_12px_rgba(247,183,51,0.4)] flex items-center justify-center shrink-0 border-[2px] border-[#FFE885] relative overflow-hidden">
					<div class="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/40 to-white/0 opacity-50 transform -rotate-45" />
					<span class="text-[#4A2500] text-[22px] font-black leading-none mt-0.5 relative z-10 drop-shadow-sm">
						¢
					</span>
				</div>
				{/* Massive Balance Text */}
				<span class="text-white font-black text-[48px] sm:text-[54px] leading-[1.1] tracking-tighter tab-num drop-shadow-[0_4px_12px_rgba(0,0,0,0.6)]">
					{balance().toLocaleString('en-US')}
				</span>
			</button>

			{/* 3. Rank & League (Z-20) */}
			<button
				type="button"
				onClick={() => props.onLeagueClick?.()}
				class="flex items-center gap-2 mb-4 relative z-20 active:scale-95 transition-transform"
				dir="ltr"
			>
				<Show
					when={globalRank() > 0}
					fallback={
						<div class="flex items-center gap-1">
							<span class="text-white/40 text-[15px] font-light">{'{'}</span>
							<span class="text-white/80 text-[13px] font-bold tracking-wide">
								{t('airdropTabs.unranked' as any) || 'Unranked'}
							</span>
							<span class="text-white/40 text-[15px] font-light">{'}'}</span>
						</div>
					}
				>
					{(() => {
						const rank = globalRank();
						let suffix = 'th';
						const j = rank % 10;
						const k = rank % 100;
						if (j === 1 && k !== 11) suffix = 'st';
						else if (j === 2 && k !== 12) suffix = 'nd';
						else if (j === 3 && k !== 13) suffix = 'rd';

						return (
							<div class="flex items-center gap-1">
								<span class="text-white/40 text-[15px] font-light">{'{'}</span>
								<span class="text-white/90 text-[14px] font-black tracking-wide drop-shadow-md">
									{rank.toLocaleString('en-US')}
									<span class="text-[11px] ml-[1px] font-bold opacity-70">{suffix}</span>
								</span>
								<span class="text-white/40 text-[15px] font-light">{'}'}</span>
							</div>
						);
					})()}
				</Show>
				<span class="text-white/20 text-[12px] mx-1">•</span>
				<div class="flex items-center gap-1">
					<span class="text-[15px] drop-shadow-[0_0_8px_rgba(255,215,0,0.5)]">🏆</span>
					<span class="text-[13px] font-bold text-white/90">{currentLeague().name}</span>
					<span class="material-symbols-outlined text-[14px] text-white/40 mt-[1px]">
						chevron_right
					</span>
				</div>
			</button>

			{/* 3.5. Honest Fatigue, Turbo & Daily Streak HUD Pills */}
			<div class="flex items-center gap-2 mb-2 relative z-20" dir="ltr">
				<button
					type="button"
					onClick={() => setShowStreakModal(true)}
					class="bg-gradient-to-r from-amber-500/20 to-orange-500/20 hover:bg-amber-500/30 border border-amber-500/30 px-3 py-1 rounded-full flex items-center gap-1.5 shadow-sm active:scale-95 transition-all"
				>
					<span class="text-[13px]">🔥</span>
					<span class="text-amber-400 font-mono font-black text-[11px]">DAY {streakDay()}</span>
					<Show when={!checkedInToday()}>
						<span class="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
					</Show>
				</button>

				<Show when={isTurboActive()}>
					<div class="bg-gradient-to-r from-red-500/20 to-orange-500/20 border border-red-500/40 px-3 py-1 rounded-full flex items-center gap-1.5 shadow-[0_0_15px_rgba(239,68,68,0.3)] animate-pulse">
						<span class="text-[14px]">🔥</span>
						<span class="text-red-400 font-mono font-black text-[12px]">
							TURBO 5X ({Math.max(0, Math.ceil((turboExpiresAt() - Date.now()) / 1000))}s)
						</span>
					</div>
				</Show>
				<Show when={!isTurboActive()}>
					<button
						type="button"
						onClick={() => {
							try {
								haptic.impact('light');
							} catch {}
							setShowRateInfoModal(true);
						}}
						class="bg-[#12141C]/80 hover:bg-[#12141C] border border-white/10 px-3 py-1 rounded-full flex items-center gap-1.5 shadow-sm active:scale-95 transition-all cursor-pointer"
					>
						<span
							class="w-2 h-2 rounded-full"
							style={{
								'background-color':
									dailyFatigueMultiplier() >= 1.0
										? '#10b981'
										: dailyFatigueMultiplier() >= 0.5
											? '#f59e0b'
											: '#ef4444',
							}}
						/>
						<span class="text-white/80 font-mono font-bold text-[11px]">
							Rate: {dailyFatigueMultiplier()}x
						</span>
						<Show when={dailyFatigueLimitRemaining() > 0}>
							<span class="text-white/40 text-[10px]">
								({formatNumber(dailyFatigueLimitRemaining())} left)
							</span>
						</Show>
					</button>
				</Show>
			</div>

			{/* 4. The Hero Glowing Tap Coin (Perfectly Centered via flex-1) */}
			<div class="flex-1 flex flex-col items-center justify-center w-full relative z-10 w-full">
				<div
					class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[260px] h-[260px] sm:w-[290px] sm:h-[290px] rounded-full pointer-events-none"
					style={{
						background: isTurboActive()
							? 'conic-gradient(from 0deg, #ff404080, transparent, #ff404080, transparent, #ff404080)'
							: 'conic-gradient(from 0deg, #ffffff60, transparent, #ffffff60, transparent, #ffffff60)',
						filter: 'blur(4px)',
						animation: 'spinSlow 6s linear infinite',
						transform: isPressed() ? 'scale(0.96)' : 'scale(1)',
						transition: 'transform 0.08s ease-out',
					}}
				/>

				<div
					class={`relative flex items-center justify-center w-[70vw] max-w-[280px] aspect-square ${isPressed() ? '' : 'coin-wrapper'} ${isShaking() ? 'animate-shake' : ''}`}
				>
					<button
						type="button"
						onPointerDown={handleTap}
						onPointerUp={handlePointerUp}
						onPointerLeave={handlePointerUp}
						onPointerCancel={handlePointerUp}
						class="relative w-[250px] h-[250px] sm:w-[280px] sm:h-[280px] rounded-full z-20 flex items-center justify-center touch-none select-none bg-[#030303]"
						style={{
							transform: isPressed() ? 'scale(0.95)' : 'scale(1)',
							transition: 'transform 0.08s cubic-bezier(.2,.8,.2,1)',
							'box-shadow': `
								0 0 0 1px rgba(255,255,255,0.08),
								inset 0 0 40px rgba(255,255,255,0.1),
								0 25px 60px rgba(0,0,0,0.95)
							`,
						}}
					>
						<div
							class={`absolute top-6 right-6 pointer-events-none transition-all duration-300 ${showCombo() ? 'opacity-100 scale-100' : 'opacity-0 scale-50'}`}
						>
							<span class="text-white font-black text-[24px] drop-shadow-[0_0_12px_rgba(255,255,255,0.9)] italic">
								x{comboCount()}
							</span>
						</div>

						<svg
							viewBox="0 0 100 100"
							class="w-[48%] h-[48%] relative z-10"
							style={{
								filter: isTurboActive()
									? 'drop-shadow(0px 0px 18px rgba(255,80,80,1))'
									: 'drop-shadow(0px 0px 14px rgba(255,255,255,0.5))',
							}}
							aria-hidden="true"
						>
							<path
								d="M 11 14 L 89 14 L 50 36 Z"
								fill="#ffffff"
								stroke="#ffffff"
								stroke-width="1.5"
								stroke-linejoin="round"
							/>
							<path
								d="M 7 19 L 47 42 L 47 88 Z"
								fill="#ffffff"
								stroke="#ffffff"
								stroke-width="1.5"
								stroke-linejoin="round"
							/>
							<path
								d="M 93 19 L 53 42 L 53 88 Z"
								fill="#ffffff"
								stroke="#ffffff"
								stroke-width="1.5"
								stroke-linejoin="round"
							/>
						</svg>
					</button>
				</div>
			</div>

			{/* 5. Golden Ratio Bottom Area (Z-30) - Swapped & Spaced Properly */}
			<div class="w-full px-4 mt-auto mb-2 relative z-30 flex flex-col gap-4 pointer-events-none">
				{/* Row A: Energy Counter & Sleek Full Bar (Now Top) */}
				<div
					class="w-full flex items-center justify-between px-1 pointer-events-auto select-none"
					dir="ltr"
				>
					<div class="flex items-center gap-2">
						<span class="text-[22px] leading-none text-[#FFC107] drop-shadow-[0_0_12px_rgba(255,193,7,0.9)] animate-pulse">
							⚡
						</span>
						<div class="flex items-baseline gap-1 font-mono whitespace-nowrap mt-1">
							<span class="text-white text-[17px] sm:text-[19px] font-black tracking-tight tabular-nums drop-shadow-md">
								{energy().toLocaleString('en-US')}
							</span>
							<span class="text-white/40 text-[13px] font-bold tabular-nums">
								/ {maxEnergy().toLocaleString('en-US')}
							</span>
						</div>
					</div>

					{/* Energy Bar (Premium Glass Design) */}
					<div class="w-40 sm:w-48 h-[10px] bg-black/80 backdrop-blur-md rounded-full overflow-hidden border border-white/10 p-[1px] shadow-[inset_0_2px_4px_rgba(0,0,0,0.5)]">
						<div
							class="h-full bg-gradient-to-r from-[#F59E0B] via-[#FBBF24] to-[#FDE047] rounded-full transition-all duration-300 relative overflow-hidden"
							style={{
								width: `${Math.max(0, Math.min(100, (energy() / maxEnergy()) * 100))}%`,
								'box-shadow': '0 0 10px rgba(245,158,11,0.8)',
							}}
						>
							<div
								class="absolute inset-0 bg-white/20 w-full h-full animate-[spinSlow_2s_linear_infinite]"
								style={{ transform: 'skewX(-45deg)' }}
							/>
						</div>
					</div>
				</div>

				{/* Row B: 3-Column Glassmorphic Action Cards (Now Bottom) */}
				<div class="grid grid-cols-3 gap-2.5 w-full pointer-events-auto" dir="rtl">
					{/* Boost / Upgrade */}
					<button
						type="button"
						onClick={() => props.onActionClick?.('boost')}
						class="h-14 rounded-2xl bg-[#12141C]/80 backdrop-blur-xl border border-white/10 hover:border-[#f59e0b]/50 hover:bg-[#12141C]/90 flex items-center justify-center gap-2 active:scale-95 transition-all duration-200 group shadow-[0_4px_16px_rgba(0,0,0,0.3)] relative overflow-hidden"
					>
						<div class="absolute inset-0 bg-gradient-to-t from-[#f59e0b]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
						<span
							class="material-symbols-outlined text-[22px] text-[#f59e0b] group-hover:scale-110 transition-transform drop-shadow-[0_0_10px_rgba(245,158,11,0.7)] relative z-10"
							style={{ 'font-variation-settings': '"FILL" 1' }}
						>
							rocket_launch
						</span>
						<span class="text-white text-[13px] font-black tracking-wide relative z-10">
							{t('airdropTabs.boost')}
						</span>
					</button>

					{/* Tasks */}
					<button
						type="button"
						onClick={() => props.onActionClick?.('earn')}
						class="h-14 rounded-2xl bg-[#12141C]/80 backdrop-blur-xl border border-white/10 hover:border-[#10b981]/50 hover:bg-[#12141C]/90 flex items-center justify-center gap-2 active:scale-95 transition-all duration-200 group shadow-[0_4px_16px_rgba(0,0,0,0.3)] relative overflow-hidden"
					>
						<div class="absolute inset-0 bg-gradient-to-t from-[#10b981]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
						<span
							class="material-symbols-outlined text-[22px] text-[#10b981] group-hover:scale-110 transition-transform drop-shadow-[0_0_10px_rgba(16,185,129,0.7)] relative z-10"
							style={{ 'font-variation-settings': '"FILL" 1' }}
						>
							task_alt
						</span>
						<span class="text-white text-[13px] font-black tracking-wide relative z-10">
							{t('airdropTabs.earn')}
						</span>
					</button>

					{/* Friends */}
					<button
						type="button"
						onClick={() => props.onActionClick?.('frens')}
						class="h-14 rounded-2xl bg-[#12141C]/80 backdrop-blur-xl border border-white/10 hover:border-[#3b82f6]/50 hover:bg-[#12141C]/90 flex items-center justify-center gap-2 active:scale-95 transition-all duration-200 group shadow-[0_4px_16px_rgba(0,0,0,0.3)] relative overflow-hidden"
					>
						<div class="absolute inset-0 bg-gradient-to-t from-[#3b82f6]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
						<span
							class="material-symbols-outlined text-[22px] text-[#3b82f6] group-hover:scale-110 transition-transform drop-shadow-[0_0_10px_rgba(59,130,246,0.7)] relative z-10"
							style={{ 'font-variation-settings': '"FILL" 1' }}
						>
							group
						</span>
						<span class="text-white text-[13px] font-black tracking-wide relative z-10">
							{t('airdropTabs.frens')}
						</span>
					</button>
				</div>
			</div>

			{/* Shop Modal / Bottom Sheet */}
			<Show when={showShopModal()}>
				<div class="fixed inset-0 z-[100] flex flex-col justify-end">
					<div
						class="absolute inset-0 bg-black/80 backdrop-blur-sm animate-fade-in"
						role="button"
						tabIndex={0}
						onKeyDown={(e) => {
							if (e.key === 'Enter') (e.currentTarget as HTMLElement).click();
							else if (e.key === 'Escape') setShowShopModal(false);
						}}
						onClick={() => setShowShopModal(false)}
					/>
					<div class="relative w-full h-[85vh] sm:h-[80vh] bg-[#07080c] rounded-t-[32px] border-t border-amber-500/20 flex flex-col animate-slide-up shadow-[0_-10px_60px_rgba(0,0,0,0.9)] overflow-hidden z-10">
						{/* Header handle and Close button */}
						<div class="w-full flex items-center justify-between px-5 py-3.5 shrink-0 border-b border-white/5 bg-[#10121a]/80 backdrop-blur-md relative z-20">
							<div class="w-8" />
							<button
								type="button"
								aria-label="Close"
								class="w-12 h-1.5 rounded-full bg-white/20 hover:bg-white/40 transition-colors cursor-pointer"
								onClick={() => setShowShopModal(false)}
							/>
							<button
								type="button"
								onClick={() => setShowShopModal(false)}
								class="w-8 h-8 flex items-center justify-center rounded-full bg-white/5 text-white/60 hover:bg-white/10 hover:text-white transition-colors"
							>
								<span class="material-symbols-outlined text-[20px]">close</span>
							</button>
						</div>
						<div class="flex-1 min-h-0 relative w-full flex flex-col overflow-hidden">
							<ShopView />
						</div>
					</div>
				</div>
			</Show>
			{/* ═══════ 7-DAY STREAK CALENDAR MODAL ═══════ */}
			<Show when={showStreakModal()}>
				<div class="fixed inset-0 z-[110] flex items-center justify-center p-4">
					<div
						class="absolute inset-0 bg-black/85 backdrop-blur-md transition-opacity animate-fade-in"
						role="button"
						tabIndex={0}
						aria-label="Close"
						onKeyDown={(e) => {
							if (e.key === 'Enter') setShowStreakModal(false);
						}}
						onClick={() => setShowStreakModal(false)}
					/>
					<div class="relative w-full max-w-sm bg-[#12141C] rounded-[32px] p-6 space-y-5 shadow-[0_20px_60px_rgba(0,0,0,0.8)] border border-amber-500/20 animate-slide-up text-center">
						<div class="w-14 h-14 rounded-[20px] bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 mx-auto shadow-[0_0_20px_rgba(245,158,11,0.25)]">
							<span class="text-[30px]">🔥</span>
						</div>

						<div class="flex flex-col gap-1">
							<h3 class="text-[20px] font-black text-white">{t('tap.miningStreak7Days')}</h3>
							<p class="text-[12px] text-white/60">{t('tap.miningStreakDesc')}</p>
						</div>

						{/* 7-Day Grid */}
						<div class="grid grid-cols-4 gap-2 text-center" dir="ltr">
							<For each={DAILY_REWARDS}>
								{(rewardAmount, index) => {
									const dayNumber = () => index() + 1;
									const isCurrent = () => streakDay() === dayNumber();
									const isPast = () =>
										checkedInToday() ? streakDay() >= dayNumber() : streakDay() > dayNumber();
									return (
										<div
											class={`p-2.5 rounded-[16px] border flex flex-col items-center justify-center gap-1 transition-all ${
												isCurrent()
													? 'bg-amber-500/20 border-amber-500/50 shadow-[0_0_12px_rgba(245,158,11,0.3)]'
													: isPast()
														? 'bg-emerald-500/10 border-emerald-500/30 opacity-70'
														: 'bg-[#08090D] border-white/5 opacity-40'
											}`}
										>
											<span class="text-[10px] font-mono font-bold text-white/60">
												DAY {dayNumber()}
											</span>
											<span class="text-[18px]">{dayNumber() === 7 ? '💎' : '🪙'}</span>
											<span class="text-[11px] font-mono font-black text-amber-400">
												+{formatNumber(rewardAmount)}
											</span>
										</div>
									);
								}}
							</For>
						</div>

						<div class="flex flex-col gap-2 pt-2">
							<button
								type="button"
								onClick={async (e) => {
									if (checkedInToday() || isClaimingStreak()) return;
									const sx = e.clientX || window.innerWidth / 2;
									const sy = e.clientY || window.innerHeight / 2;
									setIsClaimingStreak(true);
									try {
										const reward = await claimDailyReward();
										const rewardVal =
											Number(reward) ||
											DAILY_REWARDS[
												Math.min(DAILY_REWARDS.length - 1, Math.max(0, streakDay() - 1))
											];
										setShowStreakModal(false);
										flyCoinsToBalance({
											amount: rewardVal,
											startX: sx,
											startY: sy,
											targetSelector: '#airdrop-balance-counter',
										});
									} catch (_) {
										haptic.notify('error');
									} finally {
										setIsClaimingStreak(false);
									}
								}}
								disabled={checkedInToday() || isClaimingStreak()}
								class="w-full h-14 bg-gradient-to-r from-amber-500 to-yellow-500 rounded-[18px] text-[14px] font-black text-black shadow-[0_8px_24px_rgba(245,158,11,0.35)] active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:grayscale"
							>
								<span>
									{checkedInToday()
										? t('tap.streakClaimed')
										: t('tap.streakClaimDay', { day: streakDay() })}
								</span>
							</button>
							<button
								type="button"
								onClick={() => setShowStreakModal(false)}
								class="w-full h-10 bg-transparent text-white/50 text-[12px] font-bold"
							>
								{t('common.close')}
							</button>
						</div>
					</div>
				</div>
			</Show>

			{/* ═══════ RATE / ANTI-FATIGUE INFO MODAL ═══════ */}
			<Show when={showRateInfoModal()}>
				<div
					class="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in"
					dir={t('dir' as any) === 'rtl' ? 'rtl' : 'ltr'}
				>
					<div
						class="absolute inset-0"
						role="button"
						tabIndex={0}
						aria-label="Close"
						onKeyDown={(e) => {
							if (e.key === 'Enter' || e.key === 'Escape') setShowRateInfoModal(false);
						}}
						onClick={() => setShowRateInfoModal(false)}
					/>
					<div class="relative w-full max-w-sm bg-[#12141C] rounded-[32px] p-6 space-y-4 shadow-[0_20px_60px_rgba(0,0,0,0.85)] border border-white/10 animate-slide-up text-start z-10">
						{/* Header Icon */}
						<div class="flex items-center gap-3 border-b border-white/10 pb-4">
							<div class="w-12 h-12 rounded-[16px] bg-[#3390ec]/15 border border-[#3390ec]/30 flex items-center justify-center text-[#3390ec] shadow-[0_0_15px_rgba(51,144,236,0.2)] shrink-0">
								<span class="material-symbols-outlined text-[26px]">speed</span>
							</div>
							<div class="flex flex-col">
								<h3 class="text-[17px] font-black text-white">{t('tap.rateTitle')}</h3>
								<span class="text-[11px] text-white/50 font-medium">{t('tap.rateSubtitle')}</span>
							</div>
						</div>

						{/* Current Status Pill Box */}
						<div
							class="bg-white/5 border border-white/10 rounded-[18px] p-3.5 flex items-center justify-between"
							dir="ltr"
						>
							<div class="flex items-center gap-2">
								<span
									class="w-3 h-3 rounded-full animate-pulse"
									style={{
										'background-color':
											dailyFatigueMultiplier() >= 1.0
												? '#10b981'
												: dailyFatigueMultiplier() >= 0.5
													? '#f59e0b'
													: '#ef4444',
									}}
								/>
								<span class="text-white font-mono font-bold text-[13px]">
									{t('tap.rateCurrent')} {dailyFatigueMultiplier()}x
								</span>
							</div>
							<span class="text-white/70 font-mono text-[11px] bg-white/5 px-2.5 py-1 rounded-lg border border-white/5">
								{dailyFatigueLimitRemaining() > 0
									? `(${formatNumber(dailyFatigueLimitRemaining())} left)`
									: t('tap.rateMinRate')}
							</span>
						</div>

						{/* Tier Breakdown */}
						<div class="space-y-2 text-[12px]">
							<div class="flex items-center justify-between p-2 rounded-xl bg-[#10b981]/10 border border-[#10b981]/20 text-white">
								<div class="flex items-center gap-2">
									<span class="w-2 h-2 rounded-full bg-[#10b981]" />
									<span class="font-bold">{t('tap.rateTier1')}</span>
								</div>
								<span class="font-mono font-black text-[#10b981]">1.0x (100%)</span>
							</div>

							<div class="flex items-center justify-between p-2 rounded-xl bg-[#f59e0b]/10 border border-[#f59e0b]/20 text-white">
								<div class="flex items-center gap-2">
									<span class="w-2 h-2 rounded-full bg-[#f59e0b]" />
									<span class="font-bold">{t('tap.rateTier2')}</span>
								</div>
								<span class="font-mono font-black text-[#f59e0b]">0.50x (50%)</span>
							</div>

							<div class="flex items-center justify-between p-2 rounded-xl bg-orange-500/10 border border-orange-500/20 text-white">
								<div class="flex items-center gap-2">
									<span class="w-2 h-2 rounded-full bg-orange-500" />
									<span class="font-bold">{t('tap.rateTier3')}</span>
								</div>
								<span class="font-mono font-black text-orange-400">0.25x (25%)</span>
							</div>

							<div class="flex items-center justify-between p-2 rounded-xl bg-red-500/10 border border-red-500/20 text-white">
								<div class="flex items-center gap-2">
									<span class="w-2 h-2 rounded-full bg-red-500" />
									<span class="font-bold">{t('tap.rateTier4')}</span>
								</div>
								<span class="font-mono font-black text-red-400">0.10x (10%)</span>
							</div>
						</div>

						{/* Pro-Tips & Reset Info */}
						<div class="bg-[#3390ec]/10 border border-[#3390ec]/20 rounded-[18px] p-3 text-[11px] text-white/80 space-y-1.5 leading-relaxed">
							<div class="flex items-center gap-1.5 font-bold text-[#3390ec]">
								<span>🚀</span>
								<span>{t('tap.rateTurboTipTitle')}</span>
							</div>
							<p>{t('tap.rateTurboTipDesc')}</p>
							<div class="text-[10px] text-white/50 pt-1 border-t border-white/5 font-mono">
								🔄 {t('tap.rateResetInfo')}
							</div>
						</div>

						<button
							type="button"
							onClick={() => setShowRateInfoModal(false)}
							class="w-full h-12 bg-white/10 hover:bg-white/15 text-white font-bold rounded-[16px] text-[13px] active:scale-95 transition-all"
						>
							متوجه شدم
						</button>
					</div>
				</div>
			</Show>
		</div>
	);
};

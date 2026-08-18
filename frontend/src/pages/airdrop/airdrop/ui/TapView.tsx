import { Component, createSignal, onCleanup, onMount, Show } from 'solid-js';
import { API_CONFIG } from '@/shared/api/config.js';
import { formatNumber, t } from '@/shared/i18n/index.js';
import { haptic } from '@/shared/lib/haptic.js';
import {
	activateTurbo,
	balance,
	creditExpiresInDays,
	currentLeague,
	energy,
	globalRank,
	isRocketSpawned,
	isTurboActive,
	maxEnergy,
	recordTaps,
	tapPower,
	userClan,
} from '@/shared/store/airdrop.js';
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
		<div class="flex-1 flex flex-col items-center relative overflow-hidden bg-[#000000] text-white">
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

			{/* Background Aura (Z-0) */}
			<div
				class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[160vw] h-[160vw] pointer-events-none z-0"
				style={{
					background: isTurboActive()
						? 'radial-gradient(circle at 50% 50%, rgba(255,60,60,0.8) 0%, rgba(255,40,40,0.3) 30%, transparent 60%)'
						: 'radial-gradient(circle at 50% 50%, rgba(255,255,255,0.7) 0%, rgba(255,255,255,0.15) 35%, transparent 65%)',
					filter: 'blur(40px)',
				}}
			/>

			{/* Flying Rocket for Turbo */}
			<Show when={isRocketSpawned()}>
				<button
					onClick={() => activateTurbo()}
					class="absolute z-[70] text-[56px] drop-shadow-[0_0_20px_rgba(239,68,68,0.8)]"
					style={{ top: '35%', right: '8%', animation: 'rocketFloat 4s ease-in-out infinite' }}
				>
					🚀
				</button>
			</Show>

			<canvas ref={canvasRef} class="absolute inset-0 w-full h-full pointer-events-none z-50" />

			{/* 1. Clan Bar (Top - Z-20) - Added margin-top for breathing room */}
			<div class="w-full px-4 mt-5 relative z-20" dir="rtl">
				<button
					onClick={() => props.onClanClick?.()}
					class="w-full bg-[#12141C]/80 backdrop-blur-xl border border-white/10 hover:border-white/20 rounded-[22px] p-3 active:scale-[0.98] transition-all duration-300 shadow-[0_8px_32px_rgba(0,0,0,0.5)] relative overflow-hidden group"
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
															>
																<path d="M 11 14 L 89 14 L 50 36 Z" />
																<path d="M 7 19 L 47 42 L 47 88 Z" />
																<path d="M 93 19 L 53 42 L 53 88 Z" />
															</svg>
														</div>
													}
												>
													<img loading="lazy" 														src={`${API_CONFIG.BASE_URL}/profile/clan/photo?username=${clan().channel_username}`}
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
			</div>

			{/* 2. Total Coins (Balance - Z-20) - Perfected spacing and alignment */}
			<button
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

			{/* Discount Voucher Badge / Shop Trigger */}
			<button
				type="button"
				onClick={() => props.onShopClick?.()}
				class="flex items-center gap-2 mb-2 px-3 py-1.5 rounded-[14px] bg-gradient-to-r from-amber-500/15 via-amber-500/10 to-amber-500/15 border border-amber-500/25 active:scale-95 transition-all shadow-[0_4px_16px_rgba(245,158,11,0.15)] relative z-20"
			>
				<span class="text-[14px]">🎟️</span>
				<span class="text-amber-300 font-black text-[11.5px] tracking-tight">
					تا ۷۵٪ تخفیف در فروشگاه خدمات
				</span>
				<span class="text-white/40 text-[10px] font-mono border-s border-white/10 ps-2">
					اعتبار: {creditExpiresInDays()} روز
				</span>
				<span class="material-symbols-outlined text-amber-400/70 text-[14px]">chevron_left</span>
			</button>

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
			<div class="w-full px-4 mt-auto mb-[96px] relative z-30 flex flex-col gap-4 pointer-events-none">
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
							{t('airdropTabs.boost' as any) || 'ارتقا'}
						</span>
					</button>

					{/* Tasks */}
					<button
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
							{t('airdropTabs.earn' as any) || 'تسک‌ها'}
						</span>
					</button>

					{/* Friends */}
					<button
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
							{t('airdropTabs.frens' as any) || 'دوستان'}
						</span>
					</button>
				</div>
			</div>

			{/* Shop Modal / Bottom Sheet */}
			<Show when={showShopModal()}>
				<div class="fixed inset-0 z-[100] flex flex-col justify-end">
					<div
						class="absolute inset-0 bg-black/80 backdrop-blur-sm animate-fade-in"
						onClick={() => setShowShopModal(false)}
					/>
					<div class="relative w-full h-[85vh] sm:h-[80vh] bg-[#07080c] rounded-t-[32px] border-t border-amber-500/20 flex flex-col animate-slide-up shadow-[0_-10px_60px_rgba(0,0,0,0.9)] overflow-hidden z-10">
						{/* Header handle and Close button */}
						<div class="w-full flex items-center justify-between px-5 py-3.5 shrink-0 border-b border-white/5 bg-[#10121a]/80 backdrop-blur-md relative z-20">
							<div class="w-8" />
							<div
								class="w-12 h-1.5 rounded-full bg-white/20 hover:bg-white/40 transition-colors cursor-pointer"
								onClick={() => setShowShopModal(false)}
							/>
							<button
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
		</div>
	);
};

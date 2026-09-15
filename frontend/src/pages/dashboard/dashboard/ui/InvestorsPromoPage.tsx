import { Motion } from '@motionone/solid';
import { openTelegramLink } from '@tma.js/sdk-solid';
import type { Component } from 'solid-js';
import { isRtl, t } from '@/shared/i18n/index.js';
import { haptic } from '@/shared/lib/haptic.js';
import { BottomNav } from '@/widgets/bottom-nav/index.js';

const GROUP_URL = 'https://t.me/FragmentInvestors';

export const InvestorsPromoPage: Component = () => {
	const handleOpenGroup = () => {
		haptic.impact('heavy');
		try {
			openTelegramLink(GROUP_URL);
		} catch {
			window.open(GROUP_URL, '_blank', 'noopener,noreferrer');
		}
	};

	return (
		<div
			class="investors-hero-canvas min-h-[100dvh] overflow-x-hidden text-white flex flex-col font-sans selection:bg-amber-400/20 antialiased"
			dir={isRtl() ? 'rtl' : 'ltr'}
		>
			<style>{`
				.investors-hero-canvas {
					background:
						radial-gradient(ellipse 80% 50% at 50% -12%, oklch(36% 0.16 250 / 0.5), transparent 72%),
						radial-gradient(circle 380px at 90% 22%, oklch(44% 0.18 165 / 0.22), transparent 70%),
						radial-gradient(circle 340px at 10% 50%, oklch(34% 0.15 280 / 0.2), transparent 70%),
						linear-gradient(180deg, oklch(13% 0.022 260) 0%, oklch(8.5% 0.014 260) 100%);
				}

				/* 3D Space & Gyroscope */
				.scene-3d-vault {
					perspective: 1100px;
					transform-style: preserve-3d;
				}

				.gyro-ring-1 {
					transform-style: preserve-3d;
					animation: gyro-spin-primary 16s linear infinite;
				}

				.gyro-ring-2 {
					transform-style: preserve-3d;
					animation: gyro-spin-secondary 22s linear infinite reverse;
				}

				.holo-core-float {
					transform-style: preserve-3d;
					animation: holo-float 6s cubic-bezier(0.45, 0.05, 0.55, 0.95) infinite alternate;
				}

				.glow-pulse {
					animation: pulse-aura 4s ease-in-out infinite alternate;
				}

				/* Shimmer CTA Ray */
				.btn-shimmer-ray {
					animation: shimmer-sweep 3.6s cubic-bezier(0.4, 0, 0.2, 1) infinite;
				}

				@keyframes gyro-spin-primary {
					from {
						transform: translate(-50%, -50%) rotateX(68deg) rotateZ(0deg);
					}
					to {
						transform: translate(-50%, -50%) rotateX(68deg) rotateZ(360deg);
					}
				}

				@keyframes gyro-spin-secondary {
					from {
						transform: translate(-50%, -50%) rotateX(42deg) rotateY(45deg) rotateZ(0deg);
					}
					to {
						transform: translate(-50%, -50%) rotateX(42deg) rotateY(45deg) rotateZ(360deg);
					}
				}

				@keyframes holo-float {
					0% {
						transform: translate(-50%, -50%) rotateX(-8deg) rotateY(-14deg) translateY(8px);
					}
					100% {
						transform: translate(-50%, -50%) rotateX(10deg) rotateY(16deg) translateY(-12px);
					}
				}

				@keyframes pulse-aura {
					0% {
						opacity: 0.35;
						transform: translate(-50%, -50%) scale(0.92);
					}
					100% {
						opacity: 0.7;
						transform: translate(-50%, -50%) scale(1.1);
					}
				}

				@keyframes shimmer-sweep {
					0% {
						transform: translateX(-160%) skewX(-22deg);
					}
					40%, 100% {
						transform: translateX(260%) skewX(-22deg);
					}
				}

				@media (prefers-reduced-motion: reduce) {
					.gyro-ring-1,
					.gyro-ring-2,
					.holo-core-float,
					.glow-pulse,
					.btn-shimmer-ray {
						animation: none !important;
					}
				}
			`}</style>

			{/* Top Atmospheric Mesh Overlay */}
			<div class="pointer-events-none fixed inset-0 z-0 opacity-40 mix-blend-overlay">
				<div class="h-full w-full bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:24px_24px]" />
			</div>

			<main class="relative z-10 mx-auto flex w-full max-w-[460px] flex-col px-4 pb-36 pt-3">
				{/* Top Badges Bar */}
				<header class="flex items-center justify-between px-1">
					<div class="inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3.5 py-1.5 text-[11px] font-black tracking-wide text-emerald-300 backdrop-blur-xl shadow-[0_0_15px_rgba(52,211,153,0.15)]">
						<span class="relative flex h-2 w-2">
							<span class="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-80" />
							<span class="relative inline-flex h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]" />
						</span>
						<span>{t('fragmentInvestors.live')}</span>
					</div>

					<div class="inline-flex items-center gap-1.5 rounded-full border border-amber-400/35 bg-gradient-to-r from-amber-400/15 via-amber-400/10 to-amber-400/5 px-3.5 py-1.5 text-[10px] font-black uppercase tracking-wider text-amber-300 backdrop-blur-xl shadow-[0_0_15px_rgba(251,191,36,0.15)]">
						<span class="text-[12px] drop-shadow-[0_0_6px_rgba(251,191,36,0.8)]">⭐</span>
						<span>{t('fragmentInvestors.kicker')}</span>
					</div>
				</header>

				{/* Hero Typography */}
				<section class="px-2 pt-5 text-center">
					<Motion.div
						initial={{ opacity: 0, y: 6 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ duration: 0.35 }}
						class="inline-flex items-center gap-1.5 rounded-full border border-sky-400/30 bg-sky-500/10 px-3 py-1 mb-2.5 backdrop-blur-md shadow-inner"
					>
						<span class="h-1.5 w-1.5 rounded-full bg-sky-400 shadow-[0_0_6px_#38bdf8]" />
						<span
							class="font-mono text-[10.5px] font-black uppercase tracking-[0.22em] text-sky-300"
							dir="ltr"
						>
							@FragmentInvestors
						</span>
					</Motion.div>

					<Motion.h1
						initial={{ opacity: 0, y: 12 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ duration: 0.45, delay: 0.05 }}
						class="text-[clamp(2.35rem,11.5vw,3.5rem)] font-black tracking-tight leading-[1.0] text-transparent bg-clip-text bg-gradient-to-b from-white via-white to-white/70 drop-shadow-sm"
					>
						{t('fragmentInvestors.title')}
					</Motion.h1>

					<p class="mx-auto mt-3 max-w-[34ch] text-[14px] leading-relaxed text-white/75 font-normal">
						{t('fragmentInvestors.lead')}
					</p>
				</section>

				{/* 3D Holographic Vault Centerpiece */}
				<section
					class="scene-3d-vault relative mx-auto my-1 h-[270px] w-full select-none"
					aria-hidden="true"
				>
					{/* Radiant Atmospheric Aura */}
					<div class="glow-pulse absolute left-1/2 top-1/2 h-52 w-52 -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-tr from-[#3390ec]/30 via-sky-400/20 to-emerald-400/15 blur-[65px] pointer-events-none" />

					{/* Secondary Inner Gyro Ring (Emerald Satellite) */}
					<div class="gyro-ring-2 absolute left-1/2 top-1/2 h-[225px] w-[225px] rounded-full border border-emerald-400/35 pointer-events-none shadow-[0_0_20px_rgba(52,211,153,0.15)]">
						<span class="absolute -top-1.5 left-1/2 h-3.5 w-3.5 -translate-x-1/2 rounded-full bg-emerald-300 shadow-[0_0_14px_#34d399,0_0_24px_#10b981]" />
					</div>

					{/* Primary Gyro Orbit Ring (Cyan Satellite) */}
					<div class="gyro-ring-1 absolute left-1/2 top-1/2 h-[200px] w-[200px] rounded-full border border-sky-400/40 pointer-events-none shadow-[0_0_20px_rgba(56,189,248,0.2)]">
						<span class="absolute -top-2 left-1/2 h-4 w-4 -translate-x-1/2 rounded-full bg-sky-300 shadow-[0_0_16px_#38bdf8,0_0_30px_#0284c7]" />
					</div>

					{/* Floating Holographic Gem Core */}
					<div class="holo-core-float absolute left-1/2 top-1/2 h-36 w-36">
						{/* Outer Glass Shell */}
						<div class="flex h-full w-full items-center justify-center rounded-[38%] border border-white/30 bg-gradient-to-br from-[#3390ec]/90 via-[#2563eb]/80 to-[#1e3a8a]/90 backdrop-blur-md shadow-[0_16px_50px_rgba(37,99,235,0.4),inset_0_2px_14px_rgba(255,255,255,0.4)]">
							{/* Inner Gem Facet */}
							<div class="flex h-[74%] w-[74%] items-center justify-center rounded-[32%] border border-white/40 bg-gradient-to-tr from-black/60 via-black/30 to-white/15 shadow-[inset_0_4px_16px_rgba(0,0,0,0.6)] backdrop-blur-sm">
								<span
									class="material-symbols-outlined text-[62px] text-white drop-shadow-[0_0_16px_rgba(255,255,255,0.7)] select-none"
									style={{ 'font-variation-settings': '"FILL" 1' }}
								>
									diamond
								</span>
							</div>
						</div>
					</div>
				</section>

				{/* Primary Action Card: Boost & Join */}
				<section class="relative z-20 px-0.5">
					<div class="overflow-hidden rounded-[26px] border border-white/10 border-t-white/25 bg-gradient-to-b from-white/[0.08] to-white/[0.02] backdrop-blur-2xl shadow-[0_12px_40px_rgba(0,0,0,0.5)]">
						<div class="p-5">
							<div class="flex items-start gap-4">
								<div class="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#3390ec] via-[#2563eb] to-[#1d4ed8] text-white shadow-[0_6px_20px_rgba(37,99,235,0.35)] border border-white/20">
									<span class="material-symbols-outlined text-[26px] drop-shadow-sm">
										rocket_launch
									</span>
								</div>

								<div class="min-w-0 flex-1">
									<h2 class="text-[18.5px] font-black tracking-tight text-white flex items-center gap-2">
										<span>{t('fragmentInvestors.boost')}</span>
										<span class="text-[10px] font-black tracking-wider uppercase px-2 py-0.5 rounded-full bg-emerald-400/15 border border-emerald-400/30 text-emerald-300">
											+5,000 FRG
										</span>
									</h2>
									<p class="mt-1 text-[13px] leading-relaxed text-white/70 font-normal">
										{t('fragmentInvestors.boostHint')}
									</p>
								</div>
							</div>

							{/* High-Impact Shimmer Button */}
							<button
								type="button"
								onClick={handleOpenGroup}
								class="group relative mt-5 flex min-h-[54px] w-full items-center justify-center gap-2.5 overflow-hidden rounded-[18px] bg-gradient-to-r from-[#3390ec] via-[#2b7fe0] to-[#1d4ed8] px-6 text-[14.5px] font-black text-white shadow-[0_6px_25px_rgba(51,144,236,0.45)] border border-white/25 transition-all duration-200 active:scale-[0.98] hover:shadow-[0_8px_30px_rgba(51,144,236,0.6)]"
							>
								{/* Continuous Specular Shimmer Sweep */}
								<span class="btn-shimmer-ray pointer-events-none absolute inset-0 w-1/2 bg-gradient-to-r from-transparent via-white/30 to-transparent" />

								<span class="material-symbols-outlined text-[21px] transition-transform duration-200 group-hover:scale-110">
									open_in_new
								</span>
								<span class="tracking-wide">{t('fragmentInvestors.openGroup')}</span>
							</button>
						</div>

						{/* Split Details Footer */}
						<div class="grid grid-cols-2 border-t border-white/10 bg-black/25">
							<div class="p-4 flex flex-col justify-center">
								<div class="flex items-center gap-1.5">
									<span class="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_#34d399]" />
									<p class="text-[10.5px] font-black uppercase tracking-wider text-emerald-400">
										{t('fragmentInvestors.dailyReward')}
									</p>
								</div>
								<p class="mt-1 text-[11px] leading-4 text-white/60 font-normal">
									{t('fragmentInvestors.dailyRewardDesc')}
								</p>
							</div>

							<div class="border-s border-white/10 p-4 flex flex-col justify-center">
								<div class="flex items-center gap-1.5">
									<span class="h-1.5 w-1.5 rounded-full bg-amber-400 shadow-[0_0_6px_#fbbf24]" />
									<p class="text-[10.5px] font-black uppercase tracking-wider text-amber-400">
										24H COOLDOWN
									</p>
								</div>
								<p class="mt-1 text-[11px] leading-4 text-white/60 font-normal">
									{t('fragmentInvestors.telegramPremiumOnly')}
								</p>
							</div>
						</div>
					</div>
				</section>

				{/* Feature Highlights Grid */}
				<section class="mt-4 space-y-3 px-0.5">
					{/* Daily Draw Banner */}
					<div class="relative overflow-hidden rounded-[22px] border border-amber-400/25 border-t-amber-300/40 bg-gradient-to-b from-amber-400/[0.08] to-amber-400/[0.02] p-4 backdrop-blur-xl shadow-[0_8px_30px_rgba(251,191,36,0.08)]">
						<div class="flex items-start gap-3.5">
							<div class="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400/25 to-amber-500/10 text-amber-300 border border-amber-400/30 shadow-[0_0_15px_rgba(251,191,36,0.2)]">
								<span
									class="material-symbols-outlined text-[24px]"
									style={{ 'font-variation-settings': '"FILL" 1' }}
								>
									featured_seasonal_and_gifts
								</span>
							</div>

							<div class="min-w-0 flex-1">
								<div class="flex items-center gap-2">
									<h3 class="text-[15.5px] font-black tracking-tight text-white">
										{t('fragmentInvestors.dailyDraw')}
									</h3>
									<span class="rounded-full bg-amber-400/20 px-2 py-0.5 text-[9px] font-black uppercase text-amber-300 border border-amber-400/40">
										25%-50%
									</span>
								</div>
								<p class="mt-1 text-[12.5px] leading-relaxed text-white/70 font-normal">
									{t('fragmentInvestors.dailyDrawDesc')}
								</p>
							</div>
						</div>
					</div>

					{/* 2-Column Trade & Discuss Cards */}
					<div class="grid grid-cols-2 gap-3">
						<div class="rounded-[22px] border border-white/10 border-t-white/20 bg-gradient-to-b from-white/[0.06] to-white/[0.01] p-4 backdrop-blur-xl shadow-lg transition-transform active:scale-[0.98]">
							<div class="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-400/15 text-sky-300 border border-sky-400/30 shadow-[0_0_12px_rgba(56,189,248,0.2)]">
								<span class="material-symbols-outlined text-[22px]">currency_exchange</span>
							</div>
							<h4 class="mt-3 text-[15px] font-black text-white">{t('fragmentInvestors.trade')}</h4>
							<p class="mt-1 text-[12px] leading-relaxed text-white/65 font-normal">
								{t('fragmentInvestors.tradeDesc')}
							</p>
						</div>

						<div class="rounded-[22px] border border-white/10 border-t-white/20 bg-gradient-to-b from-white/[0.06] to-white/[0.01] p-4 backdrop-blur-xl shadow-lg transition-transform active:scale-[0.98]">
							<div class="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-400/15 text-emerald-300 border border-emerald-400/30 shadow-[0_0_12px_rgba(52,211,153,0.2)]">
								<span class="material-symbols-outlined text-[22px]">forum</span>
							</div>
							<h4 class="mt-3 text-[15px] font-black text-white">
								{t('fragmentInvestors.discuss')}
							</h4>
							<p class="mt-1 text-[12px] leading-relaxed text-white/65 font-normal">
								{t('fragmentInvestors.discussDesc')}
							</p>
						</div>
					</div>
				</section>
			</main>

			<BottomNav />
		</div>
	);
};

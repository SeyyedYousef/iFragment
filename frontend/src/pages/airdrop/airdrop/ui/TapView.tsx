import { Component, createSignal, onCleanup, onMount } from 'solid-js';
import { haptic } from '@/shared/lib/haptic.js';
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
	userClan,
} from '@/shared/store/airdrop.js';
import { Show } from 'solid-js';

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
}> = (props) => {
	const [isPressed, setIsPressed] = createSignal(false);
	const [isShaking, setIsShaking] = createSignal(false);
	const statsQuery = createQuery(() => ({
		queryKey: ['profile-stats-tap'],
		queryFn: getProfileStats,
		staleTime: 60_000,
	}));

	let canvasRef!: HTMLCanvasElement;
	let buttonRef!: HTMLButtonElement;
	let containerRef!: HTMLDivElement;
	let animationFrameId: number;
	let shakeTimerId: ReturnType<typeof setTimeout> | undefined;
	let pressTimerId: ReturnType<typeof setTimeout> | undefined;
	const particles: CanvasParticle[] = [];
	let isAnimating = false;
	let lastHapticAt = 0;
	let updateAndDrawFn: (() => void) | null = null;

	onMount(() => {
		if (containerRef) {
			const ro = new ResizeObserver(() => {
				const rect = containerRef.getBoundingClientRect();
				if (canvasRef.width !== rect.width || canvasRef.height !== rect.height) {
					canvasRef.width = rect.width;
					canvasRef.height = rect.height;
				}
			});
			ro.observe(containerRef);
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

	const handleTap = (e: PointerEvent) => {
		e.preventDefault();
		if (energy() <= 0) {
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

		const power = tapPower();
		recordTaps(1);

		const rect = canvasRef.getBoundingClientRect();
		const x = e.clientX - rect.left;
		const y = e.clientY - rect.top;

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

	return (
		<div
			ref={containerRef}
			class="flex-1 flex flex-col items-center relative overflow-hidden px-4 pt-6 pb-28"
			style={{ background: 'linear-gradient(180deg, #000000 0%, #1a1a1a 40%, rgba(251,191,36,0.3) 100%)' }}
		>
			{/* Floating GPU-accelerated canvas particles layer */}
			<canvas ref={canvasRef} class="absolute inset-0 w-full h-full pointer-events-none z-50" />

			{/* Ambient glow */}
			<div
				class="absolute bottom-[-10%] left-1/2 -translate-x-1/2 w-[800px] h-[800px] rounded-full pointer-events-none"
				style={{
					background: `radial-gradient(circle, ${currentLeague().color}40 0%, transparent 60%)`,
					filter: 'blur(60px)',
				}}
			></div>

			{/* Top Mining Info */}
			<div class="text-center z-10 w-full flex flex-col items-center mt-2 mb-8" dir="ltr">
				<div class="flex items-center justify-center gap-3">
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
				</div>
				<button
					onClick={() => props.onLeagueClick?.()}
					class="flex items-center justify-center gap-1.5 mt-2.5 cursor-pointer active:scale-95 transition-transform"
				>
					<Show when={statsQuery.data?.globalRank}>
						<span class="text-white/80 text-[13px] font-medium tracking-tight">#{statsQuery.data?.globalRank.toLocaleString('en-US')}</span>
						<span class="text-white/30 text-[10px] mx-1">•</span>
					</Show>
					<span
						class="material-symbols-outlined text-[16px]"
						style={{ color: currentLeague().color, 'font-variation-settings': '"FILL" 1' }}
					>
						{currentLeague().icon}
					</span>
					<span class="text-[13px] font-semibold" style={{ color: currentLeague().color }}>{currentLeague().name}</span>
					<span class="material-symbols-outlined text-[16px] text-white/40">chevron_right</span>
				</button>
			</div>

			{/* Main Coin Container */}
			<div class="relative z-10 mt-auto mb-auto flex items-center justify-center w-full max-w-[360px] aspect-square">
				{/* Main Coin Button */}
				<button
					ref={buttonRef}
					onPointerDown={handleTap}
					class={`relative w-full h-full rounded-full transition-all duration-75 select-none active:scale-[0.92] group ${
						isPressed() ? 'scale-95' : ''
					} ${isShaking() ? 'animate-[shake_0.3s_ease-in-out]' : ''}`}
					style={{
						'box-shadow': `0 20px 50px rgba(0,0,0,0.5), 0 0 100px ${currentLeague().color}40`,
					}}
				>
					{/* Dark Metallic Fragment Coin */}
					<div class="absolute inset-0 rounded-full flex items-center justify-center overflow-hidden pointer-events-none bg-black/40 backdrop-blur-sm border-[4px] border-white/5" style={{ 'box-shadow': 'inset 0 10px 40px rgba(255,255,255,0.1)' }}>
						<svg
							viewBox="0 0 200 200"
							class="w-[65%] h-[65%] drop-shadow-[0_15px_30px_rgba(0,0,0,0.8)]"
						>
							<defs>
								<linearGradient id="fragGlow" x1="0%" y1="0%" x2="100%" y2="100%">
									<stop offset="0%" stop-color="#FFFFFF" />
									<stop offset="100%" stop-color="#808080" />
								</linearGradient>
								<filter id="neonShadow" x="-20%" y="-20%" width="140%" height="140%">
									<feDropShadow dx="0" dy="0" stdDeviation="8" flood-color="#ffffff" flood-opacity="0.3" />
								</filter>
							</defs>

							{/* Clean Fragment Diamond Logo */}
							<g filter="url(#neonShadow)" transform="translate(15, 10)">
								{/* Top Left */}
								<path d="M85 20 L85 85 L20 85 Z" fill="#FFFFFF" />
								{/* Top Right */}
								<path d="M85 20 L150 85 L85 85 Z" fill="#E0E0E0" />
								{/* Bottom Left */}
								<path d="M20 85 L85 85 L85 170 Z" fill="#A0A0A0" />
								{/* Bottom Right */}
								<path d="M150 85 L85 85 L85 170 Z" fill="#606060" />
							</g>
						</svg>
					</div>

					{/* Glass Shine */}
					<div class="absolute inset-0 rounded-full overflow-hidden pointer-events-none opacity-20">
						<div
							class="w-full h-full"
							style={{
								background:
									'linear-gradient(135deg, rgba(255,255,255,0.6) 0%, transparent 40%, transparent 60%, rgba(255,255,255,0.2) 100%)',
							}}
						></div>
					</div>
				</button>
			</div>

			{/* Energy Section - Minimalist Notcoin Style */}
			<div class="w-full z-10 mt-auto mb-2 px-2" dir="ltr">
				<div class="flex items-center gap-3">
					<div class="flex items-center gap-1">
						<span
							class="material-symbols-outlined text-white text-[24px]"
							style={{ 'font-variation-settings': '"FILL" 1' }}
						>
							bolt
						</span>
						<span class="text-white font-bold text-xl leading-none tabular-nums">
							{energy()}
						</span>
					</div>
					<div class="flex-1 h-3.5 bg-white/20 rounded-full overflow-hidden">
						<div
							class="h-full rounded-full transition-all duration-300"
							style={{
								width: `${(energy() / maxEnergy()) * 100}%`,
								background: 'linear-gradient(90deg, #ffc107, #ff9800)',
							}}
						></div>
					</div>
				</div>
			</div>
		</div>
	);
};

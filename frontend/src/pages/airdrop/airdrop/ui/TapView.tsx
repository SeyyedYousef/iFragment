import { Component, createSignal, onCleanup, onMount } from 'solid-js';
import { t } from '@/shared/i18n/index.js';
import { haptic } from '@/shared/lib/haptic.js';
import {
	balance,
	currentLeague,
	energy,
	maxEnergy,
	recordTaps,
	tapPower,
} from '@/shared/store/airdrop.js';

interface CanvasParticle {
	x: number;
	y: number;
	value: number;
	alpha: number;
	scale: number;
	velocity: number;
}

export const TapView: Component = () => {
	const [isPressed, setIsPressed] = createSignal(false);
	const [isShaking, setIsShaking] = createSignal(false);
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
			class="flex-1 flex flex-col items-center relative overflow-hidden px-4 pt-2 pb-6"
		>
			{/* Floating GPU-accelerated canvas particles layer */}
			<canvas ref={canvasRef} class="absolute inset-0 w-full h-full pointer-events-none z-50" />

			{/* Ambient glow */}
			<div
				class="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] rounded-full pointer-events-none"
				style={{
					background: `radial-gradient(circle, ${currentLeague().color}15 0%, transparent 70%)`,
				}}
			></div>

			{/* Mining Info - Better Spacing */}
			<div class="text-center mb-6 z-10">
				<div class="text-[#8e8e93] text-[10px] font-black uppercase tracking-[0.2em] mb-2">
					{t('airdrop.tap.mining')}
				</div>
				<div class="flex items-center justify-center gap-3">
					<div class="w-10 h-10 rounded-full bg-amber-400/10 flex items-center justify-center border border-amber-400/20">
						<span
							class="material-symbols-outlined text-amber-400 text-2xl"
							style={{ 'font-variation-settings': '"FILL" 1' }}
						>
							monetization_on
						</span>
					</div>
					<span class="text-white text-5xl font-black tabular-nums leading-none tracking-tighter">
						{balance().toLocaleString('en-US')}
					</span>
				</div>
				<div class="text-amber-400/60 text-[10px] font-black mt-3 uppercase tracking-[0.15em]">
					{t('airdrop.tap.tapToMine')}
				</div>
			</div>

			{/* Main Coin Container */}
			<div class="relative z-10 my-auto flex items-center justify-center w-full max-w-[340px] aspect-square">
				<div class="absolute inset-0 rounded-full border border-white/5 scale-[1.2]"></div>

				{/* Main Coin Button */}
				<button
					ref={buttonRef}
					onPointerDown={handleTap}
					class={`relative w-full h-full rounded-full transition-all duration-75 select-none active:scale-[0.92] group ${
						isPressed() ? 'scale-95' : ''
					} ${isShaking() ? 'animate-[shake_0.3s_ease-in-out]' : ''}`}
					style={{
						background: `radial-gradient(circle at 35% 35%, ${currentLeague().color}40 0%, #000 100%)`,
						'box-shadow': `0 30px 60px rgba(0,0,0,0.8), 0 0 100px ${currentLeague().color}10, inset 0 2px 4px rgba(255,255,255,0.1)`,
					}}
				>
					{/* Multi-layered SVG Premium Coin */}
					<div class="absolute inset-1 rounded-full flex items-center justify-center overflow-hidden pointer-events-none">
						<svg
							viewBox="0 0 200 200"
							class="w-full h-full drop-shadow-[0_10px_20px_rgba(0,0,0,0.5)]"
						>
							<defs>
								<linearGradient id="goldBase" x1="0%" y1="0%" x2="100%" y2="100%">
									<stop offset="0%" stop-color="#FFE58F" />
									<stop offset="30%" stop-color="#FFB922" />
									<stop offset="50%" stop-color="#E69500" />
									<stop offset="70%" stop-color="#FFC436" />
									<stop offset="100%" stop-color="#995C00" />
								</linearGradient>
								<linearGradient id="goldEdge" x1="0%" y1="100%" x2="100%" y2="0%">
									<stop offset="0%" stop-color="#6B4000" />
									<stop offset="40%" stop-color="#FFD659" />
									<stop offset="50%" stop-color="#FFF4CC" />
									<stop offset="60%" stop-color="#FFD659" />
									<stop offset="100%" stop-color="#804D00" />
								</linearGradient>
								<linearGradient id="innerGlow" x1="0%" y1="0%" x2="100%" y2="100%">
									<stop offset="0%" stop-color="rgba(255, 255, 255, 0.8)" />
									<stop offset="50%" stop-color="rgba(255, 255, 255, 0)" />
									<stop offset="100%" stop-color="rgba(255, 255, 255, 0.3)" />
								</linearGradient>
								<radialGradient id="coinShadow" cx="50%" cy="50%" r="50%" fx="30%" fy="30%">
									<stop offset="60%" stop-color="transparent" />
									<stop offset="100%" stop-color="rgba(0, 0, 0, 0.5)" />
								</radialGradient>
								<filter id="logoGlow" x="-20%" y="-20%" width="140%" height="140%">
									<feGaussianBlur stdDeviation="3" result="blur" />
									<feComposite in="SourceGraphic" in2="blur" operator="over" />
								</filter>
								<filter id="insetBevel" x="-10%" y="-10%" width="120%" height="120%">
									<feOffset dx="-2" dy="-2" />
									<feGaussianBlur stdDeviation="3" result="offset-blur" />
									<feComposite
										operator="out"
										in="SourceGraphic"
										in2="offset-blur"
										result="inverse"
									/>
									<feFlood flood-color="black" flood-opacity="0.6" result="color" />
									<feComposite operator="in" in="color" in2="inverse" result="shadow" />
									<feComposite operator="over" in="shadow" in2="SourceGraphic" />
								</filter>
							</defs>

							{/* Coin Outer Edge (Thickness) */}
							<circle cx="100" cy="100" r="98" fill="url(#goldEdge)" />

							{/* Coin Inner Face (Beveled) */}
							<circle cx="100" cy="100" r="90" fill="url(#goldBase)" filter="url(#insetBevel)" />

							{/* Inner depth shadow */}
							<circle cx="100" cy="100" r="90" fill="url(#coinShadow)" />

							{/* Tech/Glowing Rings */}
							<circle
								cx="100"
								cy="100"
								r="78"
								fill="none"
								stroke="url(#innerGlow)"
								stroke-width="1.5"
								opacity="0.7"
							/>
							<circle
								cx="100"
								cy="100"
								r="72"
								fill="none"
								stroke="rgba(255, 255, 255, 0.4)"
								stroke-width="0.5"
								stroke-dasharray="6 4"
							/>
							<circle
								cx="100"
								cy="100"
								r="62"
								fill="none"
								stroke="rgba(255, 215, 0, 0.3)"
								stroke-width="1"
							/>

							{/* Radial Accents */}
							<path
								d="M 100 10 L 100 22 M 100 178 L 100 190 M 10 100 L 22 100 M 178 100 L 190 100"
								stroke="rgba(255,255,255,0.4)"
								stroke-width="1.5"
								stroke-linecap="round"
							/>
							<path
								d="M 100 22 L 100 28 M 100 172 L 100 178 M 22 100 L 28 100 M 172 100 L 178 100"
								stroke="rgba(255,255,255,0.6)"
								stroke-width="2"
								stroke-linecap="round"
							/>

							{/* Premium iF Logo */}
							<g filter="url(#logoGlow)">
								<text
									x="100"
									y="108"
									font-family="Inter, sans-serif"
									font-weight="900"
									font-size="68"
									font-style="italic"
									fill="#ffffff"
									text-anchor="middle"
									dominant-baseline="middle"
									letter-spacing="-3"
								>
									iF
								</text>
							</g>

							{/* Diamond Sparkles */}
							<path
								d="M 60 45 Q 60 55 50 55 Q 60 55 60 65 Q 60 55 70 55 Q 60 55 60 45 Z"
								fill="#ffffff"
								filter="url(#logoGlow)"
								opacity="0.9"
							/>
							<path
								d="M 145 135 Q 145 142 138 142 Q 145 142 145 149 Q 145 142 152 142 Q 145 142 145 135 Z"
								fill="#ffffff"
								opacity="0.7"
							/>
							<circle cx="140" cy="60" r="1.5" fill="#ffffff" opacity="0.6" />
							<circle cx="55" cy="140" r="2" fill="#ffffff" opacity="0.4" />
						</svg>
					</div>

					{/* Premium Glass Shine */}
					<div class="absolute inset-0 rounded-full overflow-hidden pointer-events-none opacity-20">
						<div
							class="w-full h-full animate-shimmer"
							style={{
								background:
									'linear-gradient(135deg, transparent 40%, rgba(255,255,255,0.4) 50%, transparent 60%)',
							}}
						></div>
					</div>
				</button>
			</div>

			{/* Energy bar Section - Integrated into bottom */}
			<div class="w-full z-10 mt-auto mb-4">
				<div class="flex justify-between items-end mb-2 px-1">
					<div class="flex items-center gap-2">
						<div class="w-8 h-8 rounded-lg bg-amber-400/10 flex items-center justify-center border border-amber-400/20">
							<span
								class="material-symbols-outlined text-amber-400 text-xl"
								style={{ 'font-variation-settings': '"FILL" 1' }}
							>
								bolt
							</span>
						</div>
						<div class="flex flex-col">
							<span class="text-white font-black text-lg leading-none tabular-nums">
								{energy()}
							</span>
							<span class="text-[#8e8e93] text-[10px] font-bold uppercase tracking-wider">
								{t('airdrop.tap.energy')}
							</span>
						</div>
					</div>
					<div class="text-right">
						<span class="text-[#8e8e93] text-[10px] font-black uppercase tracking-widest">
							{maxEnergy()} MAX
						</span>
					</div>
				</div>
				<div class="w-full h-3 bg-white/5 rounded-full overflow-hidden border border-white/10 p-0.5">
					<div
						class="h-full rounded-full transition-all duration-300 relative shadow-[0_0_15px_rgba(245,158,11,0.3)]"
						style={{
							width: `${(energy() / maxEnergy()) * 100}%`,
							background:
								energy() > maxEnergy() * 0.3
									? 'linear-gradient(90deg, #f59e0b, #fbbf24)'
									: 'linear-gradient(90deg, #ef4444, #f59e0b)',
						}}
					>
						<div class="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent"></div>
					</div>
				</div>
			</div>
		</div>
	);
};

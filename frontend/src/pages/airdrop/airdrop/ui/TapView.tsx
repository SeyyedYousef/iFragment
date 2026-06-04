import { Component, createSignal, onCleanup, onMount } from 'solid-js';
import { t } from '@/shared/i18n/index.js';
import { hapticFeedback } from '@tma.js/sdk-solid';
import { balance, energy, maxEnergy, tapPower, currentLeague, recordTaps } from '@/shared/store/airdrop.js';

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
  let animationFrameId: number;
  const activeTimers = new Set<ReturnType<typeof setTimeout>>();
  const particles: CanvasParticle[] = [];
  let lastHapticAt = 0;

  onMount(() => {
    if (buttonRef) {
      const ro = new ResizeObserver(() => {
        const rect = buttonRef.getBoundingClientRect();
        if (canvasRef.width !== rect.width || canvasRef.height !== rect.height) {
          canvasRef.width = rect.width;
          canvasRef.height = rect.height;
        }
      });
      ro.observe(buttonRef);
      onCleanup(() => ro.disconnect());
    }

    const ctx = canvasRef.getContext('2d');
    if (!ctx) return;

    const updateAndDraw = () => {
      ctx.clearRect(0, 0, canvasRef.width, canvasRef.height);
      
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.y -= p.velocity;
        p.alpha -= 0.015; // smooth fade out
        p.scale += 0.005; // slight enlargement
        
        if (p.alpha <= 0) {
          particles.splice(i, 1);
          continue;
        }
        
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
      
      animationFrameId = requestAnimationFrame(updateAndDraw);
    };
    
    updateAndDraw();
  });

  onCleanup(() => {
    cancelAnimationFrame(animationFrameId);
    for (const timer of activeTimers) {
      clearTimeout(timer);
    }
    activeTimers.clear();
  });

  const handleTap = (e: PointerEvent) => {
    e.preventDefault();
    if (energy() <= 0) {
      try { hapticFeedback.notificationOccurred('error'); } catch (_) {}
      setIsShaking(true);
      const shakeTimer = setTimeout(() => {
        setIsShaking(false);
        activeTimers.delete(shakeTimer);
      }, 300);
      activeTimers.add(shakeTimer);
      return;
    }

    // Throttle haptic triggers to 60fps (16ms)
    const nowTime = performance.now();
    if (nowTime - lastHapticAt > 16) {
      try { hapticFeedback.impactOccurred('medium'); } catch (_) {}
      lastHapticAt = nowTime;
    }

    const power = tapPower();
    recordTaps(1);

    const rect = buttonRef.getBoundingClientRect();
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

    // Coin press animation
    setIsPressed(true);
    const pressTimer = setTimeout(() => {
      setIsPressed(false);
      activeTimers.delete(pressTimer);
    }, 80);
    activeTimers.add(pressTimer);
  };

  return (
    <div class="flex-1 flex flex-col items-center relative overflow-hidden px-4 pt-2 pb-6">
      {/* Ambient glow */}
      <div class="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] rounded-full pointer-events-none" style={{ background: `radial-gradient(circle, ${currentLeague().color}15 0%, transparent 70%)` }}></div>

      {/* Mining Info - Better Spacing */}
      <div class="text-center mb-6 z-10">
        <div class="text-[#8e8e93] text-[10px] font-black uppercase tracking-[0.2em] mb-2">{t('airdrop.tap.mining')}</div>
        <div class="flex items-center justify-center gap-3">
          <div class="w-10 h-10 rounded-full bg-amber-400/10 flex items-center justify-center border border-amber-400/20">
            <span class="material-symbols-outlined text-amber-400 text-2xl" style={{ 'font-variation-settings': '"FILL" 1' }}>monetization_on</span>
          </div>
          <span class="text-white text-5xl font-black tabular-nums leading-none tracking-tighter">{balance().toLocaleString('en-US')}</span>
        </div>
        <div class="text-amber-400/60 text-[10px] font-black mt-3 uppercase tracking-[0.15em]">{t('airdrop.tap.tapToMine')}</div>
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
            'box-shadow': `0 30px 60px rgba(0,0,0,0.8), 0 0 100px ${currentLeague().color}10, inset 0 2px 4px rgba(255,255,255,0.1)`
          }}
        >
          {/* Inner ring / Logo area */}
          <div class="absolute inset-3 rounded-full border border-white/5 flex items-center justify-center overflow-hidden bg-gradient-to-br from-white/5 to-transparent backdrop-blur-[2px]">
             {/* Large "iF" Brand Logo */}
             <div class="flex flex-col items-center">
                <span class="text-8xl font-black text-white italic tracking-tighter drop-shadow-[0_0_30px_rgba(255,255,255,0.3)] leading-none select-none">iF</span>
                <div class="w-12 h-1 bg-gradient-to-r from-transparent via-white/30 to-transparent rounded-full mt-3"></div>
             </div>
          </div>
          
          {/* Premium Glass Shine */}
          <div class="absolute inset-0 rounded-full overflow-hidden pointer-events-none opacity-20">
            <div class="w-full h-full animate-shimmer" style={{ background: 'linear-gradient(135deg, transparent 40%, rgba(255,255,255,0.4) 50%, transparent 60%)' }}></div>
          </div>
        </button>

        {/* Floating GPU-accelerated canvas particles layer */}
        <canvas
          ref={canvasRef}
          class="absolute inset-0 pointer-events-none z-50"
        />
      </div>

      {/* Energy bar Section - Integrated into bottom */}
      <div class="w-full z-10 mt-auto mb-4">
        <div class="flex justify-between items-end mb-2 px-1">
          <div class="flex items-center gap-2">
            <div class="w-8 h-8 rounded-lg bg-amber-400/10 flex items-center justify-center border border-amber-400/20">
              <span class="material-symbols-outlined text-amber-400 text-xl" style={{ 'font-variation-settings': '"FILL" 1' }}>bolt</span>
            </div>
            <div class="flex flex-col">
              <span class="text-white font-black text-lg leading-none tabular-nums">{energy()}</span>
              <span class="text-[#8e8e93] text-[10px] font-bold uppercase tracking-wider">{t('airdrop.tap.energy')}</span>
            </div>
          </div>
          <div class="text-right">
            <span class="text-[#8e8e93] text-[10px] font-black uppercase tracking-widest">{maxEnergy()} MAX</span>
          </div>
        </div>
        <div class="w-full h-3 bg-white/5 rounded-full overflow-hidden border border-white/10 p-0.5">
          <div
            class="h-full rounded-full transition-all duration-300 relative shadow-[0_0_15px_rgba(245,158,11,0.3)]"
            style={{
              width: `${(energy() / maxEnergy()) * 100}%`,
              background: energy() > maxEnergy() * 0.3
                ? 'linear-gradient(90deg, #f59e0b, #fbbf24)'
                : 'linear-gradient(90deg, #ef4444, #f59e0b)'
            }}
          >
            <div class="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent"></div>
          </div>
        </div>
      </div>
    </div>
  );
};

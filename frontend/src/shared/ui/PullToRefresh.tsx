import { Component, createSignal, JSX } from 'solid-js';
import { haptic } from '@/shared/lib/haptic.js';

interface PullToRefreshProps {
  onRefresh: () => Promise<void>;
  children: JSX.Element;
  disabled?: boolean;
}

export const PullToRefresh: Component<PullToRefreshProps> = (props) => {
  const THRESHOLD = 60;
  let wrapperRef!: HTMLDivElement;

  const [pullDistance, setPullDistance] = createSignal(0);
  const [isRefreshing, setIsRefreshing] = createSignal(false);
  
  let startY = 0;
  let isDragging = false;
  let didHaptic = false;

  const handleTouchStart = (e: TouchEvent) => {
    if (props.disabled || isRefreshing() || wrapperRef.scrollTop > 0) return;
    startY = e.touches[0].clientY;
    isDragging = true;
    didHaptic = false;
  };

  const handleTouchMove = (e: TouchEvent) => {
    if (!isDragging) return;
    const currentY = e.touches[0].clientY;
    const diff = currentY - startY;

    if (diff > 0) {
      if (wrapperRef.scrollTop <= 0) {
        if (e.cancelable) e.preventDefault();
        const dist = Math.min(diff * 0.5, THRESHOLD + 20);
        setPullDistance(dist);

        if (dist >= THRESHOLD && !didHaptic) {
          didHaptic = true;
          haptic.impact('medium');
        } else if (dist < THRESHOLD && didHaptic) {
          didHaptic = false;
        }
      }
    }
  };

  const handleTouchEnd = async () => {
    if (!isDragging) return;
    isDragging = false;
    
    if (pullDistance() >= THRESHOLD) {
      setIsRefreshing(true);
      setPullDistance(THRESHOLD);
      try {
        await props.onRefresh();
      } finally {
        setIsRefreshing(false);
        setPullDistance(0);
      }
    } else {
      setPullDistance(0);
    }
  };

  return (
    <div 
      class="relative w-full h-full overflow-y-auto no-scrollbar"
      ref={wrapperRef}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <div 
        class="absolute left-0 right-0 flex justify-center items-end pointer-events-none z-50"
        style={{
          height: `${THRESHOLD}px`,
          top: `-${THRESHOLD}px`,
          transform: `translateY(${isRefreshing() ? THRESHOLD : pullDistance()}px)`,
          transition: isDragging ? 'none' : 'transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1)',
        }}
      >
        <div 
          class="w-8 h-8 rounded-full bg-[#12141C] border border-white/10 shadow-lg flex items-center justify-center mb-2"
          style={{
            transform: `rotate(${pullDistance() * 3}deg)`,
            opacity: Math.min(1, pullDistance() / THRESHOLD)
          }}
        >
          <span class={`material-symbols-outlined text-[18px] text-white/70 ${isRefreshing() ? 'animate-spin' : ''}`}>
            refresh
          </span>
        </div>
      </div>
      
      <div 
        style={{ 
          transform: isRefreshing() || pullDistance() > 0 ? `translateY(${isRefreshing() ? THRESHOLD : pullDistance()}px)` : undefined,
          transition: isDragging ? 'none' : 'transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1)',
        }}
        class="min-h-full motion-reduce:transition-none motion-reduce:transform-none"
      >
        {props.children}
      </div>
    </div>
  );
};

import { createSignal } from 'solid-js';
import { hapticFeedback } from '@tma.js/sdk-solid';

export function useSecretTrigger() {
  const [tapCount, setTapCount] = createSignal(0);
  const [logoPressed, setLogoPressed] = createSignal(false);
  const [showGate, setShowGate] = createSignal(false);
  let tapTimeout: any;
  let pressTimeout: any;

  const onVersionTap = () => {
    try { hapticFeedback.impactOccurred('light'); } catch {}
    setTapCount(c => c + 1);

    if (tapTimeout) clearTimeout(tapTimeout);
    tapTimeout = setTimeout(() => {
      setTapCount(0);
    }, 2500); // Reset tap count after 2.5s of inactivity

    if (tapCount() === 3) {
      try { hapticFeedback.notificationOccurred('warning'); } catch {}
      console.log('🔒 Secret entry Phase 1 triggered: Tapped version 3 times. Now long press the logo for 2s.');
    }
  };

  const onLogoPressStart = () => {
    if (tapCount() < 3) return; // Must tap version first

    setLogoPressed(true);
    pressTimeout = setTimeout(() => {
      if (logoPressed()) {
        try { hapticFeedback.notificationOccurred('success'); } catch {}
        setShowGate(true);
        setTapCount(0); // Reset state
        setLogoPressed(false);
        console.log('🔓 Secret entry unlocked: Opening TOTP Gate.');
      }
    }, 2000); // 2s long press requirement
  };

  const onLogoPressEnd = () => {
    setLogoPressed(false);
    if (pressTimeout) clearTimeout(pressTimeout);
  };

  return {
    onVersionTap,
    onLogoPressStart,
    onLogoPressEnd,
    showGate,
    setShowGate,
  };
}

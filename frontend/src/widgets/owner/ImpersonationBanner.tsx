import { Component, createSignal, onMount, Show } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import { hapticFeedback } from '@tma.js/sdk-solid';
import { t } from '@/shared/i18n/index.js';

export const ImpersonationBanner: Component = () => {
  const navigate = useNavigate();
  const [impersonatedUser, setImpersonatedUser] = createSignal<string | null>(null);

  onMount(() => {
    // Check if impersonation session is active
    const activeSessionUser = sessionStorage.getItem('impersonated_username');
    if (activeSessionUser) {
      setImpersonatedUser(activeSessionUser);
    }
  });

  const handleExitSimulation = () => {
    try { hapticFeedback.notificationOccurred('warning'); } catch {}
    
    // 1. Remove impersonation variables
    sessionStorage.removeItem('owner_impersonation_token');
    sessionStorage.removeItem('impersonated_user_id');
    sessionStorage.removeItem('impersonated_username');

    // 2. Clear state
    setImpersonatedUser(null);

    // 3. Redirect back to users manager page
    navigate('/owner/users');

    // 4. Hard refresh to reset all queries and auth interceptor states securely
    window.location.reload();
  };

  return (
    <Show when={impersonatedUser()}>
      <div class="fixed top-0 inset-x-0 z-[10000] h-11 bg-red-600/90 backdrop-blur-md border-b border-red-500/20 px-4 flex items-center justify-between text-xs text-white font-bold shadow-lg animate-slide-down select-none">
        <div class="flex items-center gap-2">
          <span class="inline-block w-2.5 h-2.5 rounded-full bg-white animate-ping" />
          <span>{t('profile.impersonationBanner').replace('{username}', impersonatedUser() || '')}</span>
        </div>
        <button 
          onClick={handleExitSimulation}
          class="h-7 px-3 bg-white text-red-600 active:scale-95 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all shadow shadow-black/20"
        >
          {t('profile.exitSimulation')}
        </button>
      </div>
    </Show>
  );
};

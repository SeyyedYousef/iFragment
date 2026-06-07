import { Component, Show, createSignal, createEffect } from 'solid-js';
import { A, useLocation } from '@solidjs/router';
import { initData } from '@tma.js/sdk-solid';
import { t } from '@/shared/i18n/index.js';
import { profilePhotoUrl } from '@/shared/store/profile.js';
import { API_CONFIG } from '@/shared/api/config.js';

export const BottomNav: Component = () => {
  const location = useLocation();
  const user = () => initData.user() as any;
  
  const avatarUrl = () => {
    const statsPhoto = profilePhotoUrl();
    if (statsPhoto) {
      if (statsPhoto.startsWith('http')) return statsPhoto;
      const base = API_CONFIG.BASE_URL.replace(/\/api\/v1\/?$/, '');
      const cleanPath = statsPhoto.startsWith('/') ? statsPhoto : `/${statsPhoto}`;
      return `${base}${cleanPath}`;
    }
    const u = user();
    if (u?.photoUrl || u?.photo_url) return u.photoUrl || u.photo_url;
    return undefined;
  };

  const [imgError, setImgError] = createSignal(false);

  createEffect(() => {
    avatarUrl();
    setImgError(false);
  });
  
  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname === path || location.pathname.startsWith(`${path}/`);
  };

  return (
    <div class="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md z-50 flex items-center justify-between gap-3 px-margin-main pb-[max(1.5rem,env(safe-area-inset-bottom))]" dir="ltr">
      <div class="flex-1 backdrop-blur-md rounded-full shadow-[0_8px_32px_rgba(0,0,0,0.3)] flex items-center justify-between px-2 py-2 border h-18 transition-colors bg-[#1c1c1c]/90 border-[#2a2a2a]" dir="ltr">
        <A 
          href="/"
          class={`h-full aspect-square rounded-full flex flex-col items-center justify-center cursor-pointer shadow-sm transition-all ${
            isActive('/') ? 'bg-white/10 scale-110' : 'hover:bg-white/5 hover:scale-105'
          }`}
        >
          <span class={`material-symbols-outlined text-2xl ${
            isActive('/') ? 'text-white' : 'text-[#8e8e93]'
          }`} style={{ 'font-variation-settings': isActive('/') ? '"FILL" 1' : '"FILL" 0' }}>home</span>
          <span class={`text-[10px] font-black mt-0.5 ${
            isActive('/') ? 'text-white' : 'text-[#8e8e93]'
          }`}>{t('bottomNav.home')}</span>
        </A>
        
        <A 
          href="/dashboard"
          class={`flex flex-col items-center gap-1 cursor-pointer group px-2 transition-all ${isActive('/dashboard') ? 'scale-110' : 'hover:scale-105'}`}
        >
          <span class={`material-symbols-outlined transition-colors text-2xl ${
            isActive('/dashboard') ? 'text-white' : 'text-[#8e8e93] group-hover:text-white'
          }`} style={isActive('/dashboard') ? { 'font-variation-settings': '"FILL" 1' } : {}}>dashboard</span>
          <span class={`text-[10px] font-bold transition-colors ${
            isActive('/dashboard') ? 'text-white' : 'text-[#8e8e93] group-hover:text-white'
          }`}>{t('bottomNav.dashboard')}</span>
        </A>
        
        <A 
          href="/airdrop"
          class={`flex flex-col items-center gap-1 cursor-pointer group px-4 transition-all ${isActive('/airdrop') ? 'scale-110' : 'hover:scale-105'}`}
        >
          <span class={`material-symbols-outlined transition-colors text-2xl ${
            isActive('/airdrop') ? 'text-white' : 'text-[#8e8e93] group-hover:text-white'
          }`} style={isActive('/airdrop') ? { 'font-variation-settings': '"FILL" 1' } : {}}>card_giftcard</span>
          <span class={`text-[10px] font-bold transition-colors ${
            isActive('/airdrop') ? 'text-white' : 'text-[#8e8e93] group-hover:text-white'
          }`}>{t('bottomNav.airdrop')}</span>
        </A>
      </div>

      <A 
        href="/profile"
        class={`flex flex-col items-center cursor-pointer transition-all ${isActive('/profile') ? 'scale-110' : 'hover:scale-105'}`}
      >
        <div class={`w-18 h-18 rounded-full backdrop-blur-md shadow-[0_8px_32px_rgba(0,0,0,0.3)] border-[3px] flex items-center justify-center overflow-hidden transition-all bg-[#1c1c1c]/90 ${isActive('/profile') ? 'border-[#3390ec]' : 'border-[#2a2a2a]'} `}>
          <Show when={avatarUrl() && !imgError()} fallback={
            <div class="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#3390ec] to-[#34c759] text-white font-black text-xl">
              {user()?.first_name ? user()?.first_name?.[0]?.toUpperCase() : 'U'}
            </div>
          }>
            <img 
              alt="" 
              class="w-full h-full object-cover" 
              src={avatarUrl()!} 
              loading="lazy"
              referrerPolicy="no-referrer"
              onError={() => setImgError(true)}
            />
          </Show>
        </div>
      </A>
    </div>
  );
};

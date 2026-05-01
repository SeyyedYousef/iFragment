import { Component } from 'solid-js';
import { A, useLocation } from '@solidjs/router';
import { initData } from '@tma.js/sdk-solid';
import { t } from '@/shared/i18n/index.js';

export const BottomNav: Component = () => {
  const location = useLocation();
  
  const isActive = (path: string) => {
    if (path === '/' && location.pathname === '/') return true;
    if (path !== '/' && location.pathname.startsWith(path)) return true;
    return false;
  };

  return (
    <div class="fixed bottom-8 left-1/2 -translate-x-1/2 w-[95%] max-w-md z-50 flex items-center justify-between gap-3 px-2">
      <A 
        href="/profile"
        class={`flex flex-col items-center cursor-pointer transition-all ${isActive('/profile') ? 'scale-110' : 'hover:scale-105'}`}
      >
        <div class={`w-18 h-18 rounded-full backdrop-blur-md shadow-[0_8px_32px_rgba(0,0,0,0.3)] border-[3px] flex items-center justify-center overflow-hidden transition-all bg-[#1c1c1c]/90 ${isActive('/profile') ? 'border-[#3390ec]' : 'border-[#2a2a2a]'} `}>
          {initData.user()?.photo_url ? (
            <img 
              alt="Profile" 
              class="w-full h-full object-cover" 
              src={initData.user()!.photo_url} 
              loading="lazy"
            />
          ) : (
            <div class="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#3390ec] to-[#34c759] text-white font-black text-xl">
              {initData.user()?.first_name ? initData.user()!.first_name[0].toUpperCase() : 'U'}
            </div>
          )}
        </div>
      </A>
      <div class="flex-1 backdrop-blur-md rounded-full shadow-[0_8px_32px_rgba(0,0,0,0.3)] flex items-center justify-between px-2 py-2 border h-18 transition-colors bg-[#1c1c1c]/90 border-[#2a2a2a]">
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
      </div>
    </div>
  );
};

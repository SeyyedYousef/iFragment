import { Component, Show, createSignal } from 'solid-js';
import { initData, hapticFeedback } from '@tma.js/sdk-solid';
import { Motion } from '@motionone/solid';
import { t, locale, setLocale, formatNumber } from '@/shared/i18n/index.js';
import { copyToClipboard } from '@/shared/lib/telegram-native.js';
import type { ProfileStats } from '@/shared/store/profile.js';
import { getLevelInfo, profilePhotoUrl } from '@/shared/store/profile.js';
import { getBorderClass, getSkinClass } from '@/shared/lib/cosmetics.js';
import { API_CONFIG } from '@/shared/api/config.js';

interface Props { stats: ProfileStats | null }

export const IdentityHero: Component<Props> = (props) => {
  const avatarUrl = () => {
    const statsPhoto = profilePhotoUrl();
    if (statsPhoto) {
      if (statsPhoto.startsWith('http')) return statsPhoto;
      const base = API_CONFIG.BASE_URL.replace(/\/api\/v1\/?$/, '');
      const cleanPath = statsPhoto.startsWith('/') ? statsPhoto : `/${statsPhoto}`;
      return `${base}${cleanPath}`;
    }
    const user = initData.user();
    if (user?.photo_url) return user.photo_url;
    return undefined;
  };
  const user = initData.user();
  const [copied, setCopied] = createSignal<string | null>(null);
  const [langOpen, setLangOpen] = createSignal(false);

  const levelInfo = () => props.stats ? getLevelInfo(props.stats.xp) : null;

  const handleCopy = async (text: string, label: string) => {
    await copyToClipboard(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 1500);
  };

  const memberSince = () => {
    if (!props.stats?.memberSince) return '';
    const d = new Date(props.stats.memberSince);
    return d.toLocaleDateString(locale() === 'fa' ? 'fa-IR' : 'en-US', { month: 'short', year: 'numeric' });
  };

  const borderClass = () => getBorderClass(props.stats?.equippedBorder);
  const skinClass = () => getSkinClass(props.stats?.equippedSkin);

  return (
    <div class={`pt-10 pb-20 px-6 relative overflow-hidden border-b border-[#2a2a2a] ${skinClass() || 'bg-[#1c1c1c]'}`} style={{ 'border-bottom-left-radius': '40px', 'border-bottom-right-radius': '40px' }}>
      {/* Language Switcher Dropdown */}
      <div class="absolute top-4 end-4 z-20">
        <button
          onClick={() => {
            try { hapticFeedback.impactOccurred('light'); } catch {}
            setLangOpen(!langOpen());
          }}
          class="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#0f1014]/60 border border-[#2a2a2a] backdrop-blur-md text-xs font-black text-white hover:bg-white/10 active:scale-95 transition-all"
        >
          <span class="material-symbols-outlined text-[14px]">translate</span>
          <span>
            {locale() === 'en' && '🇺🇸 EN'}
            {locale() === 'fa' && '🇮🇷 FA'}
            {locale() === 'ru' && '🇷🇺 RU'}
            {locale() === 'zh' && '🇨🇳 ZH'}
          </span>
          <span class="material-symbols-outlined text-[12px] transition-transform duration-200" style={{ transform: langOpen() ? 'rotate(180deg)' : 'rotate(0)' }}>expand_more</span>
        </button>

        <Show when={langOpen()}>
          <div class="absolute mt-2 w-32 rounded-2xl bg-[#1c1c1c] border border-[#2a2a2a] p-1.5 flex flex-col gap-1 shadow-2xl backdrop-blur-xl z-30 end-0">
            <button
              onClick={() => {
                setLocale('en');
                setLangOpen(false);
                try { hapticFeedback.notificationOccurred('success'); } catch {}
              }}
              class={`w-full text-left px-3 py-2 rounded-xl text-[10px] font-black transition-all flex items-center gap-2 ${locale() === 'en' ? 'bg-[#3390ec]/20 text-[#3390ec]' : 'text-white/80 hover:bg-white/5'}`}
            >
              <span>🇺🇸</span> English
            </button>
            <button
              onClick={() => {
                setLocale('fa');
                setLangOpen(false);
                try { hapticFeedback.notificationOccurred('success'); } catch {}
              }}
              class={`w-full text-left px-3 py-2 rounded-xl text-[10px] font-black transition-all flex items-center gap-2 ${locale() === 'fa' ? 'bg-[#3390ec]/20 text-[#3390ec]' : 'text-white/80 hover:bg-white/5'}`}
            >
              <span>🇮🇷</span> فارسی
            </button>
            <button
              onClick={() => {
                setLocale('ru');
                setLangOpen(false);
                try { hapticFeedback.notificationOccurred('success'); } catch {}
              }}
              class={`w-full text-left px-3 py-2 rounded-xl text-[10px] font-black transition-all flex items-center gap-2 ${locale() === 'ru' ? 'bg-[#3390ec]/20 text-[#3390ec]' : 'text-white/80 hover:bg-white/5'}`}
            >
              <span>🇷🇺</span> Русский
            </button>
            <button
              onClick={() => {
                setLocale('zh');
                setLangOpen(false);
                try { hapticFeedback.notificationOccurred('success'); } catch {}
              }}
              class={`w-full text-left px-3 py-2 rounded-xl text-[10px] font-black transition-all flex items-center gap-2 ${locale() === 'zh' ? 'bg-[#3390ec]/20 text-[#3390ec]' : 'text-white/80 hover:bg-white/5'}`}
            >
              <span>🇨🇳</span> 中文
            </button>
          </div>
        </Show>
      </div>

      {/* Background glow */}
      <div class="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-64 rounded-full opacity-10 blur-3xl" style={{ background: (props.stats?.isPremium || user?.is_premium) ? 'radial-gradient(circle, #ffd700, transparent)' : 'radial-gradient(circle, #3390ec, transparent)' }} />

      <Motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} class="flex flex-col items-center text-center relative z-10">
        {/* Avatar with animated ring */}
        <div class="relative mb-4">
          <div class={`w-28 h-28 rounded-full p-[3px] relative ${borderClass()}`} style={!borderClass() ? {
            background: (props.stats?.isPremium || user?.is_premium)
              ? 'linear-gradient(135deg, #ffd700, #ff8c00, #ffd700)'
              : 'linear-gradient(135deg, #3390ec, #34c759, #3390ec)',
            animation: 'spin 4s linear infinite',
          } : undefined}>
            <div class="w-full h-full rounded-full bg-[#0f1014] p-[3px]">
              <Show when={avatarUrl()} fallback={
                <div class="w-full h-full rounded-full flex items-center justify-center bg-gradient-to-br from-[#3390ec] to-[#34c759] text-white font-black text-3xl">
                  {user?.first_name ? user.first_name[0].toUpperCase() : 'U'}
                </div>
              }>
                <img 
                  src={avatarUrl()!} 
                  alt="Profile" 
                  class="w-full h-full rounded-full object-cover" 
                  loading="lazy"
                  referrerPolicy="no-referrer"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                    if (e.currentTarget.nextElementSibling) {
                      (e.currentTarget.nextElementSibling as HTMLElement).style.display = 'flex';
                    }
                  }}
                />
                <div class="w-full h-full rounded-full hidden items-center justify-center bg-gradient-to-br from-[#3390ec] to-[#34c759] text-white font-black text-3xl">
                  {user?.first_name ? user.first_name[0].toUpperCase() : 'U'}
                </div>
              </Show>
            </div>
          </div>
          <Show when={props.stats?.isPremium || user?.is_premium}>
            <div class="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-[#1c1c1c] flex items-center justify-center border-2 border-[#ffd700]">
              <span class="material-symbols-outlined text-[16px] text-amber-300" style={{ 'font-variation-settings': '"FILL" 1' }}>star</span>
            </div>
          </Show>
        </div>

        {/* Name */}
        <h1 class="text-white text-2xl font-black tracking-tight flex items-center gap-2 justify-center">
          {user?.first_name} {user?.last_name}
          <Show when={props.stats?.emojiStatus}>
            <span class="text-xl animate-bounce">{props.stats?.emojiStatus}</span>
          </Show>
          <Show when={props.stats?.isPremium || user?.is_premium}>
            <span class="material-symbols-outlined text-[18px] text-amber-300" style={{ 'font-variation-settings': '"FILL" 1' }}>verified</span>
          </Show>
        </h1>

        {/* Username — tap to copy */}
        <button onClick={() => handleCopy(`@${user?.username || 'guest'}`, 'username')} class="flex items-center gap-1 mt-1 px-3 py-1 rounded-full hover:bg-white/5 transition-colors">
          <span class="text-[#a0a4ad] font-medium text-sm">@{user?.username || 'Guest'}</span>
          <span class="material-symbols-outlined text-[14px] text-[#a0a4ad]">{copied() === 'username' ? 'check' : 'content_copy'}</span>
        </button>

        {/* Level badge */}
        <Show when={levelInfo()}>
          {(info) => (
            <Motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.15 }} class="mt-3 flex flex-col items-center gap-1.5">
              <div class="flex items-center gap-2 bg-[#0f1014] px-4 py-1.5 rounded-full border border-[#2a2a2a]">
                <span class="text-[#3390ec] font-black text-xs">Lv.{formatNumber(info().current.level)}</span>
                <span class="text-white font-bold text-xs">{info().current.title}</span>
              </div>
              <div class="w-40 h-1.5 bg-[#2a2a2a] rounded-full overflow-hidden">
                <Motion.div initial={{ width: '0%' }} animate={{ width: `${info().progress}%` }} transition={{ duration: 1, easing: 'ease-out' }}
                  class="h-full rounded-full" style={{ background: 'linear-gradient(90deg, #3390ec, #34c759)' }} />
              </div>
              <span class="text-[10px] text-[#a0a4ad]">{formatNumber(props.stats?.xp ?? 0)} / {formatNumber(info().next.xpRequired)} XP</span>
            </Motion.div>
          )}
        </Show>

        {/* Info chips */}
        <div class="mt-4 flex gap-2 flex-wrap justify-center">
          <button onClick={() => handleCopy(String(user?.id || ''), 'id')} class="bg-[#0f1014] px-3 py-1.5 rounded-2xl border border-[#2a2a2a] flex items-center gap-1.5 hover:border-[#3a3a3a] transition-colors">
            <span class="text-[10px] text-[#a0a4ad] uppercase font-bold tracking-widest">{t('profile.id')}</span>
            <span class="text-white font-mono font-bold text-xs">{user?.id ? formatNumber(user.id) : '---'}</span>
            <span class="material-symbols-outlined text-[12px] text-[#a0a4ad]">{copied() === 'id' ? 'check' : 'content_copy'}</span>
          </button>
          <Show when={memberSince()}>
            <div class="bg-[#0f1014] px-3 py-1.5 rounded-2xl border border-[#2a2a2a] flex items-center gap-1.5">
              <span class="material-symbols-outlined text-[14px] text-[#34c759]">calendar_month</span>
              <span class="text-white font-bold text-xs">{memberSince()}</span>
            </div>
          </Show>
          <Show when={props.stats?.globalRank}>
            <div class="bg-[#0f1014] px-3 py-1.5 rounded-2xl border border-[#2a2a2a] flex items-center gap-1.5">
              <span class="material-symbols-outlined text-[14px] text-[#ffd700]" style={{ 'font-variation-settings': '"FILL" 1' }}>emoji_events</span>
              <span class="text-white font-bold text-xs">#{formatNumber(props.stats!.globalRank)}</span>
            </div>
          </Show>
        </div>
      </Motion.div>
    </div>
  );
};

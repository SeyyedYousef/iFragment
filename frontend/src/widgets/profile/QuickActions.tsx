import { Component } from 'solid-js';
import { Motion } from '@motionone/solid';
import { t } from '@/shared/i18n/index.js';
import { haptic, addToHomeScreen, setEmojiStatus, openTelegramLink } from '@/shared/lib/telegram-native.js';

export const QuickActions: Component = () => {
  const actions = [
    {
      id: 'home_screen',
      icon: 'add_to_home_screen',
      color: '#3390ec',
      label: t('profile.addToHome') || 'Add to Home',
      onClick: () => {
        haptic.impact('light');
        addToHomeScreen();
      }
    },
    {
      id: 'emoji_status',
      icon: 'sentiment_satisfied',
      color: '#ff9500',
      label: t('profile.emojiStatus') || 'Emoji Status',
      onClick: () => {
        haptic.impact('light');
        // Assuming a custom emoji ID for iFragment, or we just call it and TG handles it
        setEmojiStatus('1234567890'); // Placeholder emoji ID
      }
    },
    {
      id: 'support',
      icon: 'support_agent',
      color: '#00c7e2',
      label: t('profile.support') || 'Support',
      onClick: () => {
        haptic.impact('light');
        openTelegramLink('https://t.me/iFragmentSupport');
      }
    }
  ];

  return (
    <Motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
      class="mx-6 mt-4 grid grid-cols-3 gap-3">
      {actions.map(action => (
        <button
          onClick={action.onClick}
          class="bg-[#1c1c1c] rounded-2xl p-3 border border-[#2a2a2a] flex flex-col items-center gap-1.5 hover:bg-[#2a2a2a] transition-colors"
        >
          <span class="material-symbols-outlined text-[20px]" style={{ color: action.color, 'font-variation-settings': '"FILL" 1' }}>{action.icon}</span>
          <span class="text-[#a0a4ad] text-[10px] font-bold text-center leading-tight">{action.label}</span>
        </button>
      ))}
    </Motion.div>
  );
};

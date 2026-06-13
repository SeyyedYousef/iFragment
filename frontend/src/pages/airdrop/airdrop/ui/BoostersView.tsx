import { Component, For, createSignal } from 'solid-js';
import { t } from '@/shared/i18n/index.js';
import { hapticFeedback } from '@tma.js/sdk-solid';
import { boosters, upgradeBooster, getBoosterCost, balance } from '@/shared/store/airdrop.js';
import { SectionHeader } from '@/shared/ui/section-header.js';

const BOOSTER_META: Record<string, { nameKey: string; descKey: string; icon: string; color: string }> = {
  tapPower: { nameKey: 'airdrop.boosters.tapPower', descKey: 'airdrop.boosters.tapPowerDesc', icon: 'touch_app', color: '#fbbf24' },
  energyCap: { nameKey: 'airdrop.boosters.energyCap', descKey: 'airdrop.boosters.energyCapDesc', icon: 'bolt', color: '#3390ec' },
  recovery: { nameKey: 'airdrop.boosters.recovery', descKey: 'airdrop.boosters.recoveryDesc', icon: 'speed', color: '#34c759' },
};

export const BoostersView: Component = () => {
  const [animatingId, setAnimatingId] = createSignal<string | null>(null);

  const handleUpgrade = async (id: string) => {
    const success = await upgradeBooster(id);
    if (success) {
      try { hapticFeedback.notificationOccurred('success'); } catch (_) {}
      setAnimatingId(id);
      setTimeout(() => setAnimatingId(null), 600);
    } else {
      try { hapticFeedback.notificationOccurred('error'); } catch (_) {}
    }
  };

  return (
    <div class="flex-1 overflow-y-auto px-4 pt-4 pb-8 animate-fade-in no-scrollbar">
      <SectionHeader icon="rocket_launch" title={t('airdrop.boosters.title')} subtitle={t('airdrop.boosters.subtitle')} gradient="#f59e0b, #ef4444" shadowColor="rgba(245,158,11,0.3)" />

      <div class="space-y-3">
        <For each={Object.keys(boosters())}>
          {(id) => {
            const booster = () => boosters()[id];
            const meta = BOOSTER_META[id];
            const cost = () => getBoosterCost(booster());
            const isMaxed = () => booster().level >= booster().maxLevel;
            const canAfford = () => balance() >= cost();

            return (
              <div class={`bg-[#1c1c1e]/80 backdrop-blur-lg rounded-2xl p-4 border transition-all ${animatingId() === id ? 'scale-[1.02]' : 'border-white/[0.04]'}`}
                   style={animatingId() === id ? { 'border-color': meta.color, 'box-shadow': `0 0 15px ${meta.color}30` } : {}}>
                <div class="flex items-center gap-3">
                  <div class="w-12 h-12 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${meta.color}20` }}>
                    <span class="material-symbols-outlined text-2xl" style={{ color: meta.color, 'font-variation-settings': '"FILL" 1' }}>{meta.icon}</span>
                  </div>
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-2 mb-0.5">
                      <span class="text-white font-bold text-sm">{t(meta.nameKey as import('@/shared/i18n/index.js').DictPaths)}</span>
                      <span class="text-[10px] font-bold px-1.5 py-0.5 rounded-md" style={{ background: `${meta.color}20`, color: meta.color }}>
                        {isMaxed() ? t('airdrop.boosters.maxed') : `${t('airdrop.boosters.level')}${booster().level}`}
                      </span>
                    </div>
                    <p class="text-[11px] text-[#8e8e93] font-medium">{t(meta.descKey as import('@/shared/i18n/index.js').DictPaths)}</p>
                    <div class="w-full h-1 bg-[#2c2c2e] rounded-full mt-2 overflow-hidden">
                      <div class="h-full rounded-full transition-all duration-500" style={{ width: `${(booster().level / booster().maxLevel) * 100}%`, background: meta.color }}></div>
                    </div>
                  </div>
                  <button
                    onClick={() => handleUpgrade(id)}
                    disabled={isMaxed() || !canAfford()}
                    class={`px-3 py-2.5 rounded-xl text-xs font-bold shrink-0 transition-all ${
                      isMaxed() ? 'bg-[#2c2c2e] text-[#8e8e93]' :
                      canAfford() ? 'bg-[#3390ec] text-white active:scale-95 shadow-[0_2px_10px_rgba(51,144,236,0.3)]' :
                      'bg-[#2c2c2e] text-[#555]'
                    }`}
                  >
                    {isMaxed() ? t('airdrop.boosters.maxed') : (
                      <div class="flex flex-col items-center gap-0.5">
                        <span>{t('airdrop.boosters.upgradeBtn')}</span>
                        <span class="flex items-center gap-0.5 text-[10px] opacity-80 font-black text-amber-400">
                          {cost().toLocaleString('en-US')} {t('airdrop.boosters.currency')}
                        </span>
                      </div>
                    )}
                  </button>
                </div>
              </div>
            );
          }}
        </For>
      </div>
    </div>
  );
};

import { hapticFeedback } from '@tma.js/sdk-solid';
import { Component, createSignal, For } from 'solid-js';
import { balance, boosters, getBoosterCost, upgradeBooster } from '@/shared/store/airdrop.js';
import { t } from '@/shared/i18n/index.js';

export const BoostersView: Component = () => {
	const [animatingId, setAnimatingId] = createSignal<string | null>(null);

	const triggerHaptic = (type: 'impact' | 'success' | 'error') => {
		try {
			const tgHaptic =
				typeof window !== 'undefined' && (window as any).Telegram?.WebApp?.HapticFeedback;
			if (type === 'impact') {
				tgHaptic ? tgHaptic.impactOccurred('medium') : hapticFeedback.impactOccurred('medium');
			} else {
				tgHaptic ? tgHaptic.notificationOccurred(type) : hapticFeedback.notificationOccurred(type);
			}
		} catch (_) {}
	};

	const handleUpgrade = async (id: string) => {
		triggerHaptic('impact');
		const success = await upgradeBooster(id);
		if (success) {
			triggerHaptic('success');
			setAnimatingId(id);
			setTimeout(() => setAnimatingId(null), 600);
		} else {
			triggerHaptic('error');
		}
	};

	return (
		<div 
			class="flex-1 overflow-y-auto px-4 pt-6 pb-36 animate-fade-in no-scrollbar h-full" 
			style={{ background: '#000' }}
			dir={t('dir') === 'rtl' ? 'rtl' : 'ltr'}
		>
			
			{/* Free daily boosters */}
			<div class="mb-6">
				<h2 class="text-[22px] font-bold text-white mb-4 tracking-tight text-start">{t('boosters.freeDaily')}</h2>
				<div class="grid grid-cols-2 gap-3">
					<button class="bg-[#1c1c1e] rounded-3xl p-4 flex flex-col gap-1.5 items-start active:scale-95 transition-all text-start">
						<div class="flex flex-col gap-1 items-start mb-1 w-full relative">
							<span class="text-white font-medium text-[15px] max-w-[70%] leading-tight">{t('boosters.turbo')}</span>
							<span class="text-[#8e8e93] text-[13px]">{t('boosters.available', { count: '2/3' })}</span>
							<span class="text-2xl absolute end-0 top-0">🚀</span>
						</div>
					</button>
					<button class="bg-[#1c1c1e] rounded-3xl p-4 flex flex-col gap-1.5 items-start active:scale-95 transition-all text-start">
						<div class="flex flex-col gap-1 items-start mb-1 w-full relative">
							<span class="text-white font-medium text-[15px] max-w-[70%] leading-tight">{t('boosters.fullEnergy')}</span>
							<span class="text-[#8e8e93] text-[13px]">{t('boosters.available', { count: '3/3' })}</span>
							<span class="text-2xl absolute end-0 top-0">⚡</span>
						</div>
					</button>
				</div>
			</div>

			{/* Boosters */}
			<div>
				<h2 class="text-[22px] font-bold text-white mb-4 tracking-tight flex items-center gap-1">
					{t('boosters.boostersTitle')}
					<span class="text-[14px]">✨</span>
				</h2>
				<div class="bg-[#1c1c1e] rounded-[32px] overflow-hidden flex flex-col pt-1">
					<For each={Object.keys(boosters())}>
						{(id, index) => {
							const booster = () => boosters()[id];
							const defaultMeta = { name: id, desc: '', emoji: '✨' };
							const cost = () => getBoosterCost(booster());
							const isMaxed = () => booster().level >= booster().maxLevel;
							const canAfford = () => balance() >= cost();

							// Try to get translation directly from boosters.meta
							// If not, fallback to hardcoded meta
							const emojiMap: Record<string, string> = {
								tapPower: '☝️',
								energyCap: '🔋',
								tapBot: '🤖',
							};
							
							const metaName = t(`boosters.meta.${id}.name`);
							const metaDesc = t(`boosters.meta.${id}.desc`);

							return (
								<button
									onClick={() => handleUpgrade(id)}
									disabled={isMaxed() || !canAfford()}
									class={`flex items-center p-4 transition-all active:bg-white/5 ${index() !== 0 ? 'border-t border-white/5' : ''} ${animatingId() === id ? 'bg-white/10' : ''}`}
								>
									{/* Icon */}
									<div class="w-14 h-14 bg-white/5 rounded-2xl flex items-center justify-center shrink-0 me-4">
										<span class="text-3xl">{emojiMap[id] || '✨'}</span>
									</div>

									{/* Info */}
									<div class="flex-1 flex flex-col items-start text-start min-w-0 justify-center">
										<div class="flex items-center gap-2">
											<span class="text-white font-medium text-[17px] tracking-tight">{metaName !== `boosters.meta.${id}.name` ? metaName : defaultMeta.name}</span>
											{id === 'tapBot' && (
												<span class="text-white text-[13px] bg-white/10 px-2 py-0.5 rounded-full flex items-center gap-1">
													on <div class="w-1.5 h-1.5 rounded-full bg-[#34c759]"></div>
												</span>
											)}
										</div>
										
										{id === 'tapBot' ? (
											<span class="text-[#8e8e93] text-[15px] mt-0.5">{metaDesc !== `boosters.meta.${id}.desc` ? metaDesc : defaultMeta.desc}</span>
										) : isMaxed() ? (
											<span class="text-[#8e8e93] text-[15px] mt-0.5">{t('boosters.maxLevelReached')}</span>
										) : (
											<div class="flex items-center gap-1.5 mt-1">
												<span class="material-symbols-outlined text-amber-400 text-[16px]" style={{ 'font-variation-settings': '"FILL" 1' }}>monetization_on</span>
												<span class="text-white font-bold text-[15px] tracking-tight">{cost().toLocaleString('en-US')}</span>
												<span class="text-[#8e8e93] text-[15px] px-1">•</span>
												<span class="text-[#8e8e93] text-[15px]">{booster().level} {t('boosters.lvl')}</span>
											</div>
										)}
									</div>

									{/* Right Accessory */}
									<div class="shrink-0 ms-2">
										{isMaxed() && id !== 'tapBot' ? (
											<span class="material-symbols-outlined text-white/40 text-[24px]">check</span>
										) : (
											<span class="material-symbols-outlined text-white/40 text-[24px] rtl:rotate-180">chevron_right</span>
										)}
									</div>
								</button>
							);
						}}
					</For>

					{/* Hardcoded Recharging Speed (for demo matching screenshot) */}
					<button class="flex items-center p-4 transition-all active:bg-white/5 border-t border-white/5 opacity-60">
						<div class="w-14 h-14 bg-white/5 rounded-2xl flex items-center justify-center shrink-0 me-4">
							<span class="text-3xl text-amber-400">⚡</span>
						</div>
						<div class="flex-1 flex flex-col items-start text-start min-w-0 justify-center">
							<span class="text-white font-medium text-[17px] tracking-tight">{t('boosters.rechargingSpeed')}</span>
							<span class="text-[#8e8e93] text-[15px] mt-0.5">{t('boosters.maxLevelReached')}</span>
						</div>
						<div class="shrink-0 ms-2">
							<span class="material-symbols-outlined text-white/40 text-[24px]">check</span>
						</div>
					</button>
				</div>
			</div>
		</div>
	);
};

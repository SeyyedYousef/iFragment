import { hapticFeedback } from '@tma.js/sdk-solid';
import { Component, createSignal, For } from 'solid-js';
import { balance, boosters, getBoosterCost, upgradeBooster, turboCount, fullEnergyCount, spawnRocket, activateFullEnergy, currentLeague } from '@/shared/store/airdrop.js';
import { showToast } from '@/shared/ui/toast.js';
import { t } from '@/shared/i18n/index.js';

export const BoostersView: Component<{ onTurboClick?: () => void }> = (props) => {
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
			showToast(t('airdropFinal.boosters.upgradeSuccess') as string, 'success');
			setAnimatingId(id);
			setTimeout(() => setAnimatingId(null), 600);
		} else {
			triggerHaptic('error');
		}
	};

	return (
		<div 
			class="flex-1 overflow-y-auto overflow-x-hidden px-4 pt-16 pb-36 animate-fade-in no-scrollbar h-full relative" 
			style={{ background: '#000' }}
			dir={t('dir' as any) === 'rtl' ? 'rtl' : 'ltr'}
		>
			{/* Ambient Mild Glow */}
			<div
				class="absolute top-0 right-0 w-[500px] h-[500px] rounded-full pointer-events-none transition-colors duration-500"
				style={{
					background: `radial-gradient(circle, ${currentLeague().color}10 0%, transparent 60%)`,
					filter: 'blur(50px)',
					transform: 'translate(30%, -30%)'
				}}
			></div>

			{/* Free daily boosters */}
			<div class="mb-6 relative z-10">
				<h2 class="text-[22px] font-bold text-white mb-4 tracking-tight text-start">{t('airdropFinal.boosters.freeDaily')}</h2>
				<div class="grid grid-cols-2 gap-3">
					<button 
						onClick={() => {
							spawnRocket();
							props.onTurboClick?.();
						}} 
						disabled={turboCount() === 0}
						class={`bg-[#1c1c1e] rounded-3xl p-4 flex flex-col gap-1.5 items-start transition-all text-start ${turboCount() > 0 ? 'active:scale-95' : 'opacity-50'}`}
					>
						<div class="flex flex-col gap-1 items-start mb-1 w-full relative">
							<span class="text-white font-medium text-[15px] max-w-[70%] leading-tight">{t('airdropFinal.boosters.turbo')}</span>
							<span class="text-[#8e8e93] text-[13px]">{t('airdropFinal.boosters.available' as any).replace('{count}', `${turboCount()}/2`)}</span>
							<span class="text-2xl absolute end-0 top-0">🚀</span>
						</div>
					</button>
					<button 
						onClick={() => {
							activateFullEnergy();
							props.onTurboClick?.();
						}} 
						disabled={fullEnergyCount() === 0}
						class={`bg-[#1c1c1e] rounded-3xl p-4 flex flex-col gap-1.5 items-start transition-all text-start ${fullEnergyCount() > 0 ? 'active:scale-95' : 'opacity-50'}`}
					>
						<div class="flex flex-col gap-1 items-start mb-1 w-full relative">
							<span class="text-white font-medium text-[15px] max-w-[70%] leading-tight">{t('airdropFinal.boosters.fullEnergy')}</span>
							<span class="text-[#8e8e93] text-[13px]">{t('airdropFinal.boosters.available' as any).replace('{count}', `${fullEnergyCount()}/3`)}</span>
							<span class="text-2xl absolute end-0 top-0">⚡</span>
						</div>
					</button>
				</div>
			</div>

			{/* Boosters */}
			<div class="relative z-10">
				<h2 class="text-[22px] font-bold text-white mb-4 tracking-tight flex items-center gap-1">
					{t('airdropFinal.boosters.boostersTitle')}
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
							
							const metaName = t(`airdropFinal.boosters.meta.${id}.name` as any);
							const metaDesc = t(`airdropFinal.boosters.meta.${id}.desc` as any);

							return (
								<button
									onClick={() => handleUpgrade(id)}
									disabled={isMaxed() || !canAfford()}
									class={`flex items-center p-4 transition-all ${isMaxed() || !canAfford() ? 'opacity-40 cursor-not-allowed grayscale-[0.5]' : 'active:bg-white/5'} ${index() !== 0 ? 'border-t border-white/5' : ''} ${animatingId() === id ? 'bg-white/10' : ''}`}
								>
									{/* Icon */}
									<div class="w-14 h-14 bg-white/5 rounded-2xl flex items-center justify-center shrink-0 me-4">
										<span class="text-3xl">{emojiMap[id] || '✨'}</span>
									</div>

									{/* Info */}
									<div class="flex-1 flex flex-col items-start text-start min-w-0 justify-center">
										<div class="flex items-center gap-2">
											<span class="text-white font-medium text-[17px] tracking-tight">{metaName !== `airdropFinal.boosters.meta.${id}.name` ? metaName : defaultMeta.name}</span>
											{id === 'tapBot' && (
												<span class="text-white text-[13px] bg-white/10 px-2 py-0.5 rounded-full flex items-center gap-1">
													on <div class="w-1.5 h-1.5 rounded-full bg-[#34c759]"></div>
												</span>
											)}
										</div>
										
										{id === 'tapBot' ? (
											<span class="text-[#8e8e93] text-[15px] mt-0.5">{metaDesc !== `airdropFinal.boosters.meta.${id}.desc` ? metaDesc : defaultMeta.desc}</span>
										) : isMaxed() ? (
											<span class="text-[#8e8e93] text-[15px] mt-0.5">{t('airdropFinal.boosters.maxLevelReached')}</span>
										) : (
											<div class="flex items-center gap-1.5 mt-1">
												<span class="material-symbols-outlined text-amber-400 text-[16px]" style={{ 'font-variation-settings': '"FILL" 1' }}>monetization_on</span>
												<span class="text-white font-bold text-[15px] tracking-tight">{cost().toLocaleString('en-US')}</span>
												<span class="text-[#8e8e93] text-[15px] px-1">•</span>
												<span class="text-[#8e8e93] text-[15px]">{booster().level} {t('airdropFinal.boosters.lvl')}</span>
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


				</div>
			</div>
		</div>
	);
};

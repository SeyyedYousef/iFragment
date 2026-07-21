import { hapticFeedback } from '@tma.js/sdk-solid';
import { Component, createSignal, For } from 'solid-js';
import { t } from '@/shared/i18n/index.js';
import {
	activateFullEnergy,
	balance,
	boosters,
	fullEnergyCount,
	getBoosterCost,
	spawnRocket,
	turboCount,
	upgradeBooster,
} from '@/shared/store/airdrop.js';
import { showToast } from '@/shared/ui/toast.js';

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
			class="flex-1 overflow-y-auto overflow-x-hidden px-4 pt-8 pb-36 animate-fade-in no-scrollbar h-full relative bg-[#07080a] text-white"
			dir={t('dir' as any) === 'rtl' ? 'rtl' : 'ltr'}
		>
			{/* Ambient Radial Mesh Glow */}
			<div
				class="absolute top-0 left-1/2 -translate-x-1/2 w-[350px] h-[300px] rounded-full pointer-events-none z-0"
				style={{
					background: 'radial-gradient(circle, rgba(245,158,11,0.08) 0%, transparent 70%)',
					filter: 'blur(60px)',
				}}
			/>

			{/* Header */}
			<div class="flex flex-col items-center mb-6 text-center relative z-10">
				<div class="w-16 h-16 rounded-2xl bg-gradient-to-b from-[#161922] to-[#0e1017] border border-amber-400/30 flex items-center justify-center mb-3 shadow-[0_0_30px_rgba(245,158,11,0.15)]">
					<span class="material-symbols-outlined text-[32px] text-amber-400">rocket_launch</span>
				</div>
				<h1 class="text-2xl font-black tracking-tight text-white mb-1.5">
					{t('airdropFinal.boosters.boostersTitle')}
				</h1>
				<p class="text-white/50 text-[13px] font-medium max-w-xs leading-relaxed">
					{t('airdropFinal.boosters.subtitle')}
				</p>
			</div>

			{/* Free daily boosters */}
			<div class="mb-6 relative z-10">
				<h2 class="text-[10px] font-black uppercase tracking-[2px] text-white/40 mb-3 text-start">
					{t('airdropFinal.boosters.freeDaily')}
				</h2>
				<div class="grid grid-cols-2 gap-3">
					<button
						onClick={() => {
							spawnRocket();
							props.onTurboClick?.();
						}}
						disabled={turboCount() === 0}
						class={`bg-gradient-to-b from-white/[0.04] to-white/[0.01] border border-amber-400/30 rounded-2xl p-4 flex flex-col gap-1.5 items-start transition-all text-start relative overflow-hidden shadow-lg ${turboCount() > 0 ? 'active:scale-95 hover:border-amber-400/60' : 'opacity-40 grayscale-[0.5]'}`}
					>
						<div class="flex items-center justify-between w-full mb-1">
							<span class="text-white font-black text-sm tracking-tight">
								{t('airdropFinal.boosters.turbo')}
							</span>
							<span class="text-xl">🚀</span>
						</div>
						<span class="text-amber-400 font-mono font-bold text-xs">
							{t('airdropFinal.boosters.available' as any).replace('{count}', `${turboCount()}/2`)}
						</span>
					</button>

					<button
						onClick={() => {
							activateFullEnergy();
							props.onTurboClick?.();
						}}
						disabled={fullEnergyCount() === 0}
						class={`bg-gradient-to-b from-white/[0.04] to-white/[0.01] border border-cyan-400/30 rounded-2xl p-4 flex flex-col gap-1.5 items-start transition-all text-start relative overflow-hidden shadow-lg ${fullEnergyCount() > 0 ? 'active:scale-95 hover:border-cyan-400/60' : 'opacity-40 grayscale-[0.5]'}`}
					>
						<div class="flex items-center justify-between w-full mb-1">
							<span class="text-white font-black text-sm tracking-tight">
								{t('airdropFinal.boosters.fullEnergy')}
							</span>
							<span class="text-xl">⚡</span>
						</div>
						<span class="text-cyan-400 font-mono font-bold text-xs">
							{t('airdropFinal.boosters.available' as any).replace(
								'{count}',
								`${fullEnergyCount()}/3`,
							)}
						</span>
					</button>
				</div>
			</div>

			{/* Boosters List */}
			<div class="relative z-10">
				<h2 class="text-[10px] font-black uppercase tracking-[2px] text-white/40 mb-3 text-start">
					Mining Upgrades
				</h2>
				<div class="bg-[#11131a]/80 backdrop-blur-md rounded-2xl overflow-hidden flex flex-col border border-white/10 shadow-2xl">
					<For each={Object.keys(boosters())}>
						{(id, index) => {
							const booster = () => boosters()[id];
							const defaultMeta = { name: id, desc: '', emoji: '✨' };
							const cost = () => getBoosterCost(booster());
							const isMaxed = () => booster().level >= booster().maxLevel;
							const canAfford = () => balance() >= cost();

							const iconMap: Record<string, string> = {
								tapPower: 'touch_app',
								energyCap: 'battery_charging_full',
								tapBot: 'smart_toy',
							};

							const metaName = t(`airdropFinal.boosters.meta.${id}.name` as any);
							const metaDesc = t(`airdropFinal.boosters.meta.${id}.desc` as any);

							return (
								<button
									onClick={() => handleUpgrade(id)}
									disabled={isMaxed() || !canAfford()}
									class={`flex items-center p-4 transition-all text-start ${isMaxed() || !canAfford() ? 'opacity-40 cursor-not-allowed grayscale-[0.5]' : 'hover:bg-white/[0.04] active:bg-white/[0.06]'} ${index() !== 0 ? 'border-t border-white/[0.06]' : ''} ${animatingId() === id ? 'bg-white/10' : ''}`}
								>
									{/* Icon */}
									<div class="w-12 h-12 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-center shrink-0 me-3.5 shadow-inner">
										<span class="material-symbols-outlined text-white text-[24px]">
											{iconMap[id] || 'bolt'}
										</span>
									</div>

									{/* Info */}
									<div class="flex-1 flex flex-col items-start min-w-0 justify-center">
										<div class="flex items-center gap-2">
											<span class="text-white font-black text-[15px] tracking-tight">
												{metaName !== `airdropFinal.boosters.meta.${id}.name`
													? metaName
													: defaultMeta.name}
											</span>
											{id === 'tapBot' && booster().level >= 1 && (
												<span class="text-emerald-400 text-[9px] bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full flex items-center gap-1 font-black uppercase tracking-wider">
													ACTIVE{' '}
													<div class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
												</span>
											)}
										</div>

										{id === 'tapBot' ? (
											booster().level >= 1 ? (
												<span class="text-white/40 text-xs mt-0.5 font-medium">
													{metaDesc !== `airdropFinal.boosters.meta.${id}.desc`
														? metaDesc
														: defaultMeta.desc}
												</span>
											) : (
												<div class="flex items-center gap-1.5 mt-0.5">
													<span class="text-xs">🪙</span>
													<span class="text-white font-mono font-bold text-xs">
														{cost().toLocaleString('en-US')}
													</span>
													<span class="text-white/30 text-xs ms-1 font-medium">
														{metaDesc !== `airdropFinal.boosters.meta.${id}.desc`
															? metaDesc
															: defaultMeta.desc}
													</span>
												</div>
											)
										) : isMaxed() ? (
											<span class="text-white/40 text-xs mt-0.5 font-medium">
												{t('airdropFinal.boosters.maxLevelReached')}
											</span>
										) : (
											<div class="flex items-center gap-1.5 mt-0.5">
												<span class="text-xs">🪙</span>
												<span class="text-white font-mono font-bold text-xs">
													{cost().toLocaleString('en-US')}
												</span>
												<span class="text-white/30 text-xs font-mono">• Lvl {booster().level}</span>
											</div>
										)}
									</div>

									{/* Right Accessory */}
									<div class="shrink-0 ms-2">
										{isMaxed() && id !== 'tapBot' ? (
											<span class="material-symbols-outlined text-white/30 text-[20px]">check</span>
										) : id === 'tapBot' && booster().level >= 1 ? (
											<span class="material-symbols-outlined text-emerald-400 text-[20px]">
												check_circle
											</span>
										) : (
											<span class="material-symbols-outlined text-white/30 text-[20px] rtl:rotate-180">
												chevron_right
											</span>
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

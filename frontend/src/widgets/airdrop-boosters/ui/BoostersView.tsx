import { type Component, createSignal, For, Show } from 'solid-js';
import {
	activateFullEnergy,
	balance,
	boosters,
	fullEnergyCount,
	getBoosterCost,
	spawnRocket,
	turboCount,
	upgradeBooster,
} from '@/entities/airdrop/index.js';
import { t } from '@/shared/i18n/index.js';
import { haptic } from '@/shared/lib/haptic.js';
import { showToast } from '@/shared/ui/toast.js';

export const BoostersView: Component<{ onTurboClick?: () => void }> = (props) => {
	const [animatingId, setAnimatingId] = createSignal<string | null>(null);

	const triggerHaptic = (type: 'impact' | 'success' | 'error') => {
		try {
			if (type === 'impact') haptic.impact('medium');
			else haptic.notify(type);
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
			class="flex-1 w-full max-w-full overflow-y-auto overflow-x-hidden px-4 pt-8 pb-36 animate-fade-in no-scrollbar h-full relative bg-[#030303] text-white"
			dir={t('dir' as any) === 'rtl' ? 'rtl' : 'ltr'}
		>
			{/* Premium Ambient Radial Glow - Contained in overflow-hidden wrapper */}
			<div class="absolute inset-0 overflow-hidden pointer-events-none z-0">
				<div class="absolute top-0 left-0 right-0 h-[350px] bg-gradient-to-b from-amber-500/15 via-amber-500/5 to-transparent blur-[80px]" />
			</div>

			{/* ═══════ HEADER ═══════ */}
			<div class="flex flex-col items-center mb-7 text-center relative z-10 pt-2">
				<div class="w-20 h-20 rounded-[24px] bg-gradient-to-br from-[#1c1608] to-[#08090D] border-[1.5px] border-amber-500/30 flex items-center justify-center mb-4 shadow-[inset_0_2px_12px_rgba(255,255,255,0.05),0_10px_30px_rgba(245,158,11,0.15)] relative overflow-hidden">
					<div class="absolute top-0 left-1/2 -translate-x-1/2 w-10 h-10 bg-amber-400/20 blur-xl rounded-full" />
					<span class="material-symbols-outlined text-[42px] text-amber-400 drop-shadow-[0_0_12px_rgba(245,158,11,0.6)]">
						rocket_launch
					</span>
				</div>
				<h1 class="text-[24px] font-black tracking-tight text-white mb-1.5 drop-shadow-md">
					{t('airdropFinal.boosters.boostersTitle')}
				</h1>
				<p class="text-white/60 text-[13px] font-medium max-w-[260px] leading-relaxed">
					{t('airdropFinal.boosters.subtitle')}
				</p>
			</div>

			{/* ═══════ FREE DAILY BOOSTERS ═══════ */}
			<div class="mb-7 relative z-10">
				<div class="flex items-center gap-2 px-2 mb-3">
					<span class="material-symbols-outlined text-white/40 text-[18px]">redeem</span>
					<h2 class="text-[12px] font-mono font-black uppercase tracking-widest text-white/60">
						{t('airdropFinal.boosters.freeDaily')}
					</h2>
				</div>

				<div class="grid grid-cols-2 gap-3">
					{/* Turbo Button */}
					<button
						type="button"
						onClick={() => {
							spawnRocket();
							props.onTurboClick?.();
						}}
						disabled={turboCount() === 0}
						class={`rounded-[20px] p-4 flex flex-col gap-1.5 items-start text-start relative overflow-hidden shadow-lg transition-all duration-300 border 
							${
								turboCount() > 0
									? 'bg-gradient-to-br from-[#12141C] to-[#1c1608] border-amber-400/30 hover:border-amber-400/60 active:scale-95 shadow-[0_8px_20px_rgba(245,158,11,0.1)]'
									: 'bg-[#12141C]/60 border-white/5 opacity-50 grayscale-[0.5]'
							}`}
					>
						<Show when={turboCount() > 0}>
							<div class="absolute -top-10 -right-10 w-24 h-24 bg-amber-400/10 blur-xl rounded-full pointer-events-none" />
						</Show>
						<div class="flex items-center justify-between w-full mb-1 z-10">
							<span class="text-white font-black text-[14px] tracking-tight">
								{t('airdropFinal.boosters.turbo')}
							</span>
							<span class="text-[22px] drop-shadow-md">🚀</span>
						</div>
						<span class="text-amber-400 font-mono font-bold text-[12px] bg-amber-400/10 px-2 py-0.5 rounded-[6px] border border-amber-400/20 z-10">
							{t('airdropFinal.boosters.available' as any).replace('{count}', `${turboCount()}/2`)}
						</span>
					</button>

					{/* Full Energy Button */}
					<button
						type="button"
						onClick={() => {
							activateFullEnergy();
							props.onTurboClick?.();
						}}
						disabled={fullEnergyCount() === 0}
						class={`rounded-[20px] p-4 flex flex-col gap-1.5 items-start text-start relative overflow-hidden shadow-lg transition-all duration-300 border 
							${
								fullEnergyCount() > 0
									? 'bg-gradient-to-br from-[#12141C] to-[#081b24] border-cyan-400/30 hover:border-cyan-400/60 active:scale-95 shadow-[0_8px_20px_rgba(34,211,238,0.1)]'
									: 'bg-[#12141C]/60 border-white/5 opacity-50 grayscale-[0.5]'
							}`}
					>
						<Show when={fullEnergyCount() > 0}>
							<div class="absolute -top-10 -right-10 w-24 h-24 bg-cyan-400/10 blur-xl rounded-full pointer-events-none" />
						</Show>
						<div class="flex items-center justify-between w-full mb-1 z-10">
							<span class="text-white font-black text-[14px] tracking-tight">
								{t('airdropFinal.boosters.fullEnergy')}
							</span>
							<span class="text-[22px] drop-shadow-md">⚡</span>
						</div>
						<span class="text-cyan-400 font-mono font-bold text-[12px] bg-cyan-400/10 px-2 py-0.5 rounded-[6px] border border-cyan-400/20 z-10">
							{t('airdropFinal.boosters.available' as any).replace(
								'{count}',
								`${fullEnergyCount()}/3`,
							)}
						</span>
					</button>
				</div>
			</div>

			{/* ═══════ UPGRADES LIST ═══════ */}
			<div class="relative z-10">
				<div class="flex items-center gap-2 px-2 mb-3">
					<span class="material-symbols-outlined text-white/40 text-[18px]">upgrade</span>
					<h2 class="text-[12px] font-mono font-black uppercase tracking-widest text-white/60">
						{t('boosters.miningUpgrades')}
					</h2>
				</div>

				<div class="bg-[#12141C]/80 backdrop-blur-xl rounded-[28px] p-2 flex flex-col border border-white/5 shadow-[0_10px_40px_rgba(0,0,0,0.3)]">
					<For each={Object.keys(boosters())}>
						{(id) => {
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
							const isBotActive = id === 'tapBot' && booster().level >= 1;

							return (
								<button
									type="button"
									onClick={() => handleUpgrade(id)}
									disabled={isMaxed() || !canAfford()}
									class={`flex items-center p-3.5 my-0.5 transition-all duration-300 text-start rounded-[20px] border 
										${
											isMaxed() || !canAfford()
												? 'border-transparent opacity-50 cursor-not-allowed grayscale-[0.4]'
												: 'bg-[#161b28]/40 border-white/5 hover:border-white/15 hover:bg-[#1a2133] active:bg-white/10'
										} 
										${animatingId() === id ? 'bg-amber-400/20 border-amber-400/40 scale-[0.98]' : ''}`}
								>
									{/* Icon */}
									<div
										class={`w-12 h-12 rounded-[16px] flex items-center justify-center shrink-0 border shadow-inner transition-colors
										${
											isBotActive
												? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.2)]'
												: 'bg-[#08090D] border-white/10 text-white/80'
										}`}
									>
										<span class="material-symbols-outlined text-[24px]">
											{iconMap[id] || 'bolt'}
										</span>
									</div>

									{/* Info */}
									<div class="flex-1 flex flex-col items-start min-w-0 justify-center px-3.5">
										<div class="flex items-center gap-2.5 mb-1 flex-wrap">
											<span class="text-white font-black text-[15px] tracking-tight">
												{metaName !== `airdropFinal.boosters.meta.${id}.name`
													? metaName
													: defaultMeta.name}
											</span>
											{isBotActive && (
												<span class="text-emerald-400 text-[9px] bg-emerald-500/10 border border-emerald-500/30 px-1.5 py-0.5 rounded-[6px] flex items-center gap-1 font-black uppercase tracking-widest shadow-sm">
													ACTIVE{' '}
													<div class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_5px_#34d399]" />
												</span>
											)}
										</div>

										{isBotActive ? (
											<span class="text-white/50 text-[11px] font-medium leading-tight">
												{metaDesc !== `airdropFinal.boosters.meta.${id}.desc`
													? metaDesc
													: defaultMeta.desc}
											</span>
										) : isMaxed() ? (
											<span class="text-white/40 text-[12px] font-bold uppercase tracking-wider bg-white/5 px-2 py-0.5 rounded-[6px]">
												{t('airdropFinal.boosters.maxLevelReached')}
											</span>
										) : (
											<div class="flex items-center gap-1.5 opacity-90">
												<span class="text-[13px]">🪙</span>
												<span class="text-white font-mono font-black text-[13px]">
													{cost().toLocaleString('en-US')}
												</span>
												<span class="text-white/30 text-[10px] mx-1">•</span>
												<span class="text-white/50 text-[11px] font-mono font-bold uppercase tracking-wider bg-white/5 px-2 py-[2px] rounded-[6px] border border-white/5">
													Lvl {booster().level}
												</span>
											</div>
										)}
									</div>

									{/* Action Icon */}
									<div class="shrink-0 pl-2">
										{isMaxed() && id !== 'tapBot' ? (
											<span class="material-symbols-outlined text-white/30 text-[24px]">check</span>
										) : isBotActive ? (
											<span class="material-symbols-outlined text-emerald-400 text-[24px] drop-shadow-sm">
												check_circle
											</span>
										) : (
											<span class="material-symbols-outlined text-white/30 text-[24px] rtl:rotate-180 group-hover:text-white/60 transition-colors">
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

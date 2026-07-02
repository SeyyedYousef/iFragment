import { createMemo, Component } from 'solid-js';
import { getLevelInfo, type ProfileStats } from '@/shared/store/profile.js';
import { t } from '@/shared/i18n/index.js';

interface Props {
	stats: ProfileStats | null;
}

export const ExperienceCard: Component<Props> = (props) => {
	const info = createMemo(() => getLevelInfo(props.stats?.xp || 0));

	return (
		<div class="w-full bg-gradient-to-br from-[#1c1c1c] to-[#15161d] rounded-2xl p-4 border border-[#2a2a2a]/60 shadow-lg relative overflow-hidden flex flex-col justify-center">
			{/* Glowing orb in background */}
			<div class="absolute -right-6 -bottom-6 w-24 h-24 bg-[#d4af37]/10 rounded-full blur-xl pointer-events-none" />
						<div class="flex items-end justify-between">
					<div class="flex flex-col gap-1">
						<h3 class="text-[13px] text-white/90 font-bold uppercase tracking-wider">{t('profile.experience') || 'Experience'}</h3>
						<div class="flex items-baseline gap-1">
							<span class="text-[28px] font-black text-white leading-none">{(props.stats?.xp || 0).toLocaleString()}</span>
							<span class="text-[11px] font-bold text-[#ff9500]">{t('profile.xp') || 'XP'}</span>
						</div>
					</div>
					
					<div class="flex flex-col gap-1 text-right">
						<h3 class="text-[11px] text-white/50 font-bold uppercase tracking-widest">{t('profile.nextLevel') || 'Next Level'}</h3>
						<div class="flex items-baseline justify-end gap-1">
							<span class="text-[18px] font-bold text-white/90 leading-none">{info().next.xpRequired.toLocaleString()}</span>
							<span class="text-[10px] font-bold text-white/50">{t('profile.xp') || 'XP'}</span>
						</div>
					</div>
				</div>

			<div class="w-full h-3 bg-[#0f1014] rounded-full overflow-hidden border border-[#2a2a2a]/60 relative shadow-inner">
				<div 
					class="h-full rounded-full bg-gradient-to-r from-[#8a7322] to-[#d4af37] relative transition-all duration-1000 ease-out"
					style={{ width: `${info().progress}%` }}
					dir="ltr"
				>
					<div class="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent w-full h-full opacity-50" />
				</div>
			</div>
		</div>
	);
};

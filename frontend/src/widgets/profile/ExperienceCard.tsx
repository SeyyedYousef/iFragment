import { type Component, createMemo } from 'solid-js';
import { getLevelInfo, type ProfileStats } from '@/entities/user/index.js';
import { formatNumber, t } from '@/shared/i18n/index.js';

interface Props {
	stats: ProfileStats | null;
}

export const ExperienceCard: Component<Props> = (props) => {
	const info = createMemo(() => getLevelInfo(props.stats?.xp || 0));

	return (
		<div class="w-full relative group">
			{/* Animated Glow Backdrop */}
			<div class="absolute -inset-[1px] bg-gradient-to-r from-[#00f5ff]/30 via-[#9d4edd]/30 to-[#00f5ff]/30 rounded-3xl blur-sm opacity-50 group-hover:opacity-100 transition-opacity duration-500" />

			{/* Card Body */}
			<div class="w-full bg-[#0a0a0f]/90 backdrop-blur-xl rounded-3xl p-5 border border-white/10 shadow-2xl relative overflow-hidden flex flex-col justify-center">
				{/* Inner Glow/Noise */}
				<div class="absolute -right-10 -top-10 w-32 h-32 bg-[#9d4edd]/20 rounded-full blur-[30px] pointer-events-none" />
				<div class="absolute -left-10 -bottom-10 w-32 h-32 bg-[#00f5ff]/10 rounded-full blur-[30px] pointer-events-none" />

				<div class="flex items-end justify-between relative z-10 mb-4">
					<div class="flex flex-col gap-1.5">
						<div class="flex items-center gap-1.5">
							<span
								class="material-symbols-outlined text-[14px] text-[#00f5ff]"
								style="font-variation-settings: 'FILL' 1;"
							>
								psychology
							</span>
							<h3 class="text-[12px] text-white/60 font-black uppercase tracking-widest">
								{t('profile.experience') || 'Experience'}
							</h3>
						</div>
						<div class="flex items-baseline gap-1">
							<span class="text-[32px] font-black text-white leading-none tracking-tight font-mono tabular-nums">
								{formatNumber(props.stats?.xp || 0)}
							</span>
							<span class="text-[12px] font-black text-[#00f5ff]">{t('profile.xp') || 'XP'}</span>
						</div>
					</div>

					<div class="flex flex-col gap-1.5 text-right">
						<h3 class="text-[10px] text-white/40 font-bold uppercase tracking-widest">
							{t('profile.nextLevel') || 'Next Level'}
						</h3>
						<div class="flex items-baseline justify-end gap-1">
							<span class="text-[18px] font-bold text-white/90 leading-none font-mono tabular-nums">
								{formatNumber(info().next.xpRequired)}
							</span>
							<span class="text-[10px] font-bold text-white/40">{t('profile.xp') || 'XP'}</span>
						</div>
					</div>
				</div>

				{/* Progress Bar Container */}
				<div class="w-full h-2.5 bg-[#050508] rounded-full overflow-hidden border border-white/5 relative shadow-inner">
					{/* Animated Progress Track */}
					<div
						class="h-full rounded-full relative transition-all duration-1000 ease-out"
						style={{ width: `${Math.max(20, info().progress)}%` }}
						dir="ltr"
					>
						{/* Progress Gradient */}
						<div class="absolute inset-0 bg-gradient-to-r from-[#9d4edd] to-[#00f5ff]" />
						{/* Inner Highlight for 3D effect */}
						<div class="absolute inset-0 bg-gradient-to-b from-white/30 to-transparent rounded-full" />
						{/* Glowing tip */}
						<div class="absolute right-0 top-0 bottom-0 w-10 bg-gradient-to-l from-white/50 to-transparent blur-sm" />
					</div>
				</div>
			</div>
		</div>
	);
};

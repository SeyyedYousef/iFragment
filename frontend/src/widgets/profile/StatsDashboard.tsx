import { Motion } from '@motionone/solid';
import { Component, For } from 'solid-js';
import { t } from '@/shared/i18n/index.js';
import type { ProfileStats } from '@/entities/user/index.js';

interface Props {
	stats: ProfileStats | null;
}

interface StatItemTemplate {
	key: keyof ProfileStats;
	icon: string;
	color: string;
	labelKey: string;
	defaultLabel: string;
}

const STAT_TEMPLATES: StatItemTemplate[] = [
	{
		key: 'usernamesAnalyzed',
		icon: 'search',
		color: '#00f5ff',
		labelKey: 'profile.statsAnalyzed',
		defaultLabel: 'Analyzed',
	},
	{
		key: 'groupsManaged',
		icon: 'group',
		color: '#9d4edd',
		labelKey: 'profile.statsGroups',
		defaultLabel: 'Groups',
	},
	{
		key: 'channelsManaged',
		icon: 'campaign',
		color: '#00f5ff',
		labelKey: 'profile.statsChannels',
		defaultLabel: 'Channels',
	},
	{
		key: 'currentStreak',
		icon: 'local_fire_department',
		color: '#ff3366', // Fire!
		labelKey: 'profile.statsStreak',
		defaultLabel: 'Streak',
	},
	{
		key: 'daysActive',
		icon: 'event_available',
		color: '#9d4edd',
		labelKey: 'profile.statsDaysActive',
		defaultLabel: 'Days Active',
	},
];

export const StatsDashboard: Component<Props> = (props) => {
	const formatVal = (v: number | undefined | null) => {
		const num = Number(v);
		const validNum = Number.isNaN(num) ? 0 : num;
		const absNum = Math.abs(validNum);

		if (absNum >= 1_000_000) {
			const val = (validNum / 1_000_000).toFixed(1).replace(/\.0$/, '');
			return `${val}M`;
		}
		if (absNum >= 1_000) {
			const val = (validNum / 1_000).toFixed(1).replace(/\.0$/, '');
			return `${val}K`;
		}
		return validNum.toLocaleString('en-US');
	};

	return (
		<Motion.div
			initial={{ opacity: 0, y: 10 }}
			animate={{ opacity: 1, y: 0 }}
			transition={{ delay: 0.1 }}
			class="w-full relative"
		>
			<div class="grid grid-cols-6 gap-3">
				<For each={STAT_TEMPLATES}>
					{(item, i) => {
						const rawVal = () => (props.stats ? (props.stats[item.key] as number) : 0);
						const label = () => t(item.labelKey as any) || item.defaultLabel;
						const colClass = i() < 3 ? 'col-span-2' : 'col-span-3';
						return (
							<Motion.div
								initial={{ opacity: 0, scale: 0.95 }}
								animate={{ opacity: 1, scale: 1 }}
								transition={{ delay: 0.15 + i() * 0.05 }}
								class={`group relative ${colClass}`}
							>
								{/* Hover Glow */}
								<div class="absolute -inset-[1px] bg-gradient-to-r from-white/0 via-white/20 to-white/0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 blur-[2px]" />

								<div class="relative bg-[#0a0a0f]/60 backdrop-blur-md rounded-2xl py-3 px-2 border border-white/5 flex flex-col justify-center items-center gap-1.5 shadow-[0_4px_12px_rgba(0,0,0,0.2)] h-full overflow-hidden transition-all group-hover:border-white/10 group-hover:bg-[#0a0a0f]/80">
									{/* Subtle background icon */}
									<span
										class="material-symbols-outlined absolute -right-2 -bottom-2 text-[40px] opacity-[0.03] rotate-[-15deg] pointer-events-none transition-transform group-hover:scale-110"
										style={{ color: item.color }}
									>
										{item.icon}
									</span>

									<div class="flex flex-col items-center gap-1 z-10 w-full">
										<div class="flex items-center gap-1.5">
											<span
												class="material-symbols-outlined text-[16px] drop-shadow-[0_0_8px_currentColor]"
												style={{ color: item.color, 'font-variation-settings': '"FILL" 1' }}
											>
												{item.icon}
											</span>
											<span class="text-white font-black text-[15px] tracking-tight text-shadow-sm font-mono tabular-nums">
												{formatVal(rawVal())}
											</span>
										</div>
										<span class="text-white/40 text-[9px] font-black uppercase tracking-widest text-center line-clamp-1 w-full truncate">
											{label()}
										</span>
									</div>
								</div>
							</Motion.div>
						);
					}}
				</For>
			</div>
		</Motion.div>
	);
};

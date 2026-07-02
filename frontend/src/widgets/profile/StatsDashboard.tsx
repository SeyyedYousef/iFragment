import { Motion } from '@motionone/solid';
import { Component, For } from 'solid-js';
import { locale, t } from '@/shared/i18n/index.js';
import type { ProfileStats } from '@/shared/store/profile.js';

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
		color: '#d4af37',
		labelKey: 'profile.statsAnalyzed',
		defaultLabel: 'Analyzed',
	},
	{
		key: 'groupsManaged',
		icon: 'group',
		color: '#a0a4ad',
		labelKey: 'profile.statsGroups',
		defaultLabel: 'Groups',
	},
	{
		key: 'channelsManaged',
		icon: 'campaign',
		color: '#d4af37',
		labelKey: 'profile.statsChannels',
		defaultLabel: 'Channels',
	},
	{
		key: 'currentStreak',
		icon: 'local_fire_department',
		color: '#a0a4ad',
		labelKey: 'profile.statsStreak',
		defaultLabel: 'Streak',
	},
	{
		key: 'daysActive',
		icon: 'event_available',
		color: '#d4af37',
		labelKey: 'profile.statsDaysActive',
		defaultLabel: 'Days Active',
	},
];

export const StatsDashboard: Component<Props> = (props) => {
	const formatVal = (v: number | undefined | null) => {
		const num = Number(v);
		const validNum = Number.isNaN(num) ? 0 : num;
		const absNum = Math.abs(validNum);
		const isFa = locale() === 'fa';

		if (absNum >= 1_000_000) {
			const val = (validNum / 1_000_000).toFixed(1).replace(/\.0$/, '');
			return (isFa ? parseFloat(val).toLocaleString('fa-IR') : val) + (isFa ? ' میلیون' : 'M');
		}
		if (absNum >= 1_000) {
			const val = (validNum / 1_000).toFixed(1).replace(/\.0$/, '');
			return (isFa ? parseFloat(val).toLocaleString('fa-IR') : val) + (isFa ? ' هزار' : 'K');
		}
		return validNum.toLocaleString(isFa ? 'fa-IR' : 'en-US');
	};

	return (
		<Motion.div
			initial={{ opacity: 0, y: 10 }}
			animate={{ opacity: 1, y: 0 }}
			transition={{ delay: 0.1 }}
			class="w-full"
		>
			<div class="grid grid-cols-6 gap-2.5">
				<For each={STAT_TEMPLATES}>
					{(item, i) => {
						const rawVal = () => (props.stats ? (props.stats[item.key] as number) : 0);
						const label = () => t(item.labelKey as any) || item.defaultLabel;
						const colClass = i() < 3 ? "col-span-2" : "col-span-3";
						return (
							<Motion.div
								initial={{ opacity: 0, scale: 0.9 }}
								animate={{ opacity: 1, scale: 1 }}
								transition={{ delay: 0.15 + i() * 0.05 }}
								class={`bg-[#1c1c1c] rounded-[16px] py-2.5 px-1 border border-[#2a2a2a] flex flex-col justify-center items-center gap-1 shadow-sm ${colClass}`}
							>
								<div class="flex items-center gap-1 mb-0.5">
									<span
										class="material-symbols-outlined text-[15px]"
										style={{ color: item.color, 'font-variation-settings': '"FILL" 1' }}
									>
										{item.icon}
									</span>
									<span class="text-white font-black text-[13px]">
										{formatVal(rawVal())}
									</span>
								</div>
								<span class="text-[#a0a4ad] text-[9px] font-bold uppercase tracking-wider text-center line-clamp-1 break-all">
									{label()}
								</span>
							</Motion.div>
						);
					}}
				</For>
			</div>
		</Motion.div>
	);
};

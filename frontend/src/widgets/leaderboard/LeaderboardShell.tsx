import { Component, For, JSX, Show } from 'solid-js';
import { FragmentPulse } from '@/shared/ui/FragmentPulse.js';

export interface LeaderboardEntry {
	rank: number;
	id: string | number;
	name: string;
	avatarUrl?: string;
	score: number;
	scoreUnit?: string;
	badgeLabel?: string;
	isCurrentUser?: boolean;
}

interface LeaderboardShellProps {
	title: string;
	subtitle?: string;
	scopeTabs?: { id: string; label: string }[];
	activeScope?: string;
	onScopeChange?: (scopeId: string) => void;
	periodFilter?: { id: string; label: string }[];
	activePeriod?: string;
	onPeriodChange?: (periodId: string) => void;
	entries: LeaderboardEntry[];
	currentUserEntry?: LeaderboardEntry;
	loading?: boolean;
	children?: JSX.Element;
}

export const LeaderboardShell: Component<LeaderboardShellProps> = (props) => {
	const topThree = () => props.entries.slice(0, 3);
	const restList = () => props.entries.slice(3);

	const formatScore = (num: number) => {
		if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
		if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
		return num.toLocaleString('en-US');
	};

	return (
		<div class="space-y-6 pb-24 select-none">
			{/* Header */}
			<div class="bg-gradient-to-b from-[#151822] to-[#0F1117] border border-white/10 rounded-[24px] p-5 space-y-4">
				<div class="flex items-center justify-between">
					<div>
						<div class="flex items-center gap-2">
							<FragmentPulse state="reward" />
							<h1 class="text-lg font-black text-white">{props.title}</h1>
						</div>
						<Show when={props.subtitle}>
							<p class="text-xs text-white/50 font-bold mt-1">{props.subtitle}</p>
						</Show>
					</div>

					{/* Period Filter (Daily/Weekly/All) */}
					<Show when={props.periodFilter && props.periodFilter.length > 0}>
						<div class="flex items-center bg-black/40 border border-white/10 p-1 rounded-xl">
							<For each={props.periodFilter}>
								{(period) => (
									<button
										onClick={() => props.onPeriodChange?.(period.id)}
										class={`px-3 py-1 text-[11px] font-bold rounded-lg transition-all ${
											props.activePeriod === period.id
												? 'bg-[#3390ec] text-white shadow-sm'
												: 'text-white/50 hover:text-white'
										}`}
									>
										{period.label}
									</button>
								)}
							</For>
						</div>
					</Show>
				</div>

				{/* Scope Tabs (Global / Clans / Miners) */}
				<Show when={props.scopeTabs && props.scopeTabs.length > 0}>
					<div class="flex gap-2 border-b border-white/5 pb-2 overflow-x-auto no-scrollbar">
						<For each={props.scopeTabs}>
							{(tab) => (
								<button
									onClick={() => props.onScopeChange?.(tab.id)}
									class={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
										props.activeScope === tab.id
											? 'bg-white/10 text-white border border-white/20'
											: 'text-white/50 hover:bg-white/5 hover:text-white'
									}`}
								>
									{tab.label}
								</button>
							)}
						</For>
					</div>
				</Show>
			</div>

			<Show when={props.loading}>
				<div class="flex flex-col items-center justify-center py-16 gap-3">
					<div class="w-8 h-8 border-3 border-[#3390ec] border-t-transparent rounded-full animate-spin" />
					<span class="text-xs text-white/50 font-bold">در حال دریافت برترین‌ها...</span>
				</div>
			</Show>

			<Show when={!props.loading && props.entries.length > 0}>
				{/* Top 3 Podium */}
				<Show when={topThree().length >= 3}>
					<div class="grid grid-cols-3 gap-3 items-end pt-4 pb-2">
						{/* 2nd Place */}
						<div class="bg-gradient-to-b from-[#151822] to-[#0F1117] border border-white/10 rounded-[20px] p-3 text-center space-y-2 flex flex-col items-center">
							<span class="px-2 py-0.5 rounded-full bg-slate-400/20 border border-slate-400/40 text-slate-300 text-[10px] font-black">
								رتبه ۲
							</span>
							<div class="w-12 h-12 rounded-full bg-slate-700/50 border-2 border-slate-400 flex items-center justify-center text-base font-black text-white overflow-hidden">
								<Show when={topThree()[1]?.avatarUrl} fallback={topThree()[1]?.name?.[0] || '2'}>
									<img loading="lazy" src={topThree()[1].avatarUrl} alt="" class="w-full h-full object-cover" />
								</Show>
							</div>
							<div class="w-full truncate text-xs font-bold text-white">{topThree()[1]?.name}</div>
							<div class="text-[11px] font-mono font-black text-slate-300">
								{formatScore(topThree()[1]?.score || 0)} {topThree()[1]?.scoreUnit || ''}
							</div>
						</div>

						{/* 1st Place */}
						<div class="bg-gradient-to-b from-[#1e2433] to-[#0F1117] border border-amber-500/40 rounded-[24px] p-4 text-center space-y-2 flex flex-col items-center shadow-lg shadow-amber-500/10 -translate-y-2">
							<span class="px-2.5 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/50 text-amber-400 text-[10px] font-black">
								👑 رتبه ۱
							</span>
							<div class="w-14 h-14 rounded-full bg-amber-500/20 border-2 border-amber-400 flex items-center justify-center text-lg font-black text-white overflow-hidden">
								<Show when={topThree()[0]?.avatarUrl} fallback={topThree()[0]?.name?.[0] || '1'}>
									<img loading="lazy" src={topThree()[0].avatarUrl} alt="" class="w-full h-full object-cover" />
								</Show>
							</div>
							<div class="w-full truncate text-xs font-black text-white">{topThree()[0]?.name}</div>
							<div class="text-xs font-mono font-black text-amber-400">
								{formatScore(topThree()[0]?.score || 0)} {topThree()[0]?.scoreUnit || ''}
							</div>
						</div>

						{/* 3rd Place */}
						<div class="bg-gradient-to-b from-[#151822] to-[#0F1117] border border-amber-700/30 rounded-[20px] p-3 text-center space-y-2 flex flex-col items-center">
							<span class="px-2 py-0.5 rounded-full bg-amber-700/20 border border-amber-700/40 text-amber-500 text-[10px] font-black">
								رتبه ۳
							</span>
							<div class="w-12 h-12 rounded-full bg-amber-900/30 border-2 border-amber-700 flex items-center justify-center text-base font-black text-white overflow-hidden">
								<Show when={topThree()[2]?.avatarUrl} fallback={topThree()[2]?.name?.[0] || '3'}>
									<img loading="lazy" src={topThree()[2].avatarUrl} alt="" class="w-full h-full object-cover" />
								</Show>
							</div>
							<div class="w-full truncate text-xs font-bold text-white">{topThree()[2]?.name}</div>
							<div class="text-[11px] font-mono font-black text-amber-500">
								{formatScore(topThree()[2]?.score || 0)} {topThree()[2]?.scoreUnit || ''}
							</div>
						</div>
					</div>
				</Show>

				{/* Rankings List */}
				<div class="space-y-2">
					<For each={restList()}>
						{(entry) => (
							<div
								class={`flex items-center justify-between p-3.5 rounded-[16px] border transition-all ${
									entry.isCurrentUser
										? 'bg-[#3390ec]/15 border-[#3390ec]/40'
										: 'bg-[#151822] border-white/5 hover:border-white/10'
								}`}
							>
								<div class="flex items-center gap-3 min-w-0">
									<span class="w-6 text-center font-mono text-xs font-bold text-white/50">
										#{entry.rank}
									</span>
									<div class="w-9 h-9 rounded-full bg-white/5 border border-white/10 overflow-hidden flex items-center justify-center shrink-0">
										<Show
											when={entry.avatarUrl}
											fallback={<span class="text-xs font-bold text-white">{entry.name[0]}</span>}
										>
											<img loading="lazy" src={entry.avatarUrl} alt="" class="w-full h-full object-cover" />
										</Show>
									</div>
									<div class="truncate text-xs font-bold text-white">
										<bdi>{entry.name}</bdi>
									</div>
								</div>

								<div class="text-end shrink-0">
									<div class="font-mono text-xs font-black text-white">
										{formatScore(entry.score)}{' '}
										<span class="text-[10px] text-white/40">{entry.scoreUnit || ''}</span>
									</div>
								</div>
							</div>
						)}
					</For>
				</div>
			</Show>

			{/* Sticky Current User Floating Row */}
			<Show when={props.currentUserEntry}>
				<div class="fixed bottom-20 left-1/2 -translate-x-1/2 w-full max-w-md px-4 z-40">
					<div class="bg-gradient-to-r from-[#181926] via-[#1e2433] to-[#181926] border border-[#3390ec]/40 rounded-[20px] p-3.5 shadow-2xl flex items-center justify-between backdrop-blur-xl">
						<div class="flex items-center gap-3">
							<span class="px-2 py-0.5 rounded-lg bg-[#3390ec]/20 text-[#3390ec] font-mono text-xs font-black">
								#{props.currentUserEntry!.rank}
							</span>
							<div class="text-xs font-black text-white">
								شما (<bdi>{props.currentUserEntry!.name}</bdi>)
							</div>
						</div>
						<div class="font-mono text-xs font-black text-[#3390ec]">
							{formatScore(props.currentUserEntry!.score)} {props.currentUserEntry!.scoreUnit || ''}
						</div>
					</div>
				</div>
			</Show>
		</div>
	);
};

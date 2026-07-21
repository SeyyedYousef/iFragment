import { useNavigate } from '@solidjs/router';
import { hapticFeedback } from '@tma.js/sdk-solid';
import { Component } from 'solid-js';
import { t } from '@/shared/i18n/index.js';

const handleNavigate = (navigate: ReturnType<typeof useNavigate>, path: string) => {
	try {
		hapticFeedback.impactOccurred('light');
	} catch {}
	navigate(path);
};

export const QuestCard: Component = () => {
	const navigate = useNavigate();
	return (
		<button
			onClick={() => handleNavigate(navigate, '/profile/tasks')}
			class="bg-[#1c1c1c] border border-[#2a2a2a] rounded-3xl p-5 flex flex-col items-start text-left group hover:bg-[#202020] active:scale-[0.98] transition-all relative overflow-hidden"
		>
			<div class="absolute top-0 right-0 w-24 h-24 bg-[#3390ec]/5 rounded-full blur-2xl -z-10" />
			<div class="w-10 h-10 mb-4 rounded-xl bg-[#0f1014] border border-[#3390ec]/20 flex items-center justify-center text-[#3390ec]">
				<span class="material-symbols-outlined text-[20px] font-light">assignment_turned_in</span>
			</div>
			<span class="text-white font-black text-sm mb-1">
				{t('gamification.questHub') || 'Quests'}
			</span>
			<span class="text-[10px] text-[#a0a4ad] font-medium leading-tight">
				{t('gamification.earnFrgXp') || 'Earn Coins & XP'}
			</span>
		</button>
	);
};

export const BoostsCard: Component = () => {
	const navigate = useNavigate();
	return (
		<button
			onClick={() => handleNavigate(navigate, '/profile/boosts')}
			class="bg-[#1c1c1c] border border-[#2a2a2a] rounded-3xl p-5 flex flex-col items-start text-left group hover:bg-[#202020] active:scale-[0.98] transition-all relative overflow-hidden"
		>
			<div class="absolute top-0 right-0 w-24 h-24 bg-[#d4af37]/5 rounded-full blur-2xl -z-10" />
			<div class="w-10 h-10 mb-4 rounded-xl bg-[#0f1014] border border-[#d4af37]/20 flex items-center justify-center text-[#d4af37]">
				<span class="material-symbols-outlined text-[20px] font-light">rocket_launch</span>
			</div>
			<span class="text-white font-black text-sm mb-1">{t('gamification.boosts') || 'Boosts'}</span>
			<span class="text-[10px] text-[#a0a4ad] font-medium leading-tight">
				{t('gamification.multipliersBots') || 'Multipliers & Bots'}
			</span>
		</button>
	);
};

export const LeaderboardCard: Component = () => {
	const navigate = useNavigate();
	return (
		<button
			onClick={() => handleNavigate(navigate, '/profile/leaderboard')}
			class="col-span-2 bg-gradient-to-r from-[#1c1c1c] to-[#15161d] border border-[#2a2a2a] rounded-3xl p-4 flex items-center justify-between group hover:bg-[#202020] active:scale-[0.98] transition-all"
		>
			<div class="flex items-center gap-4">
				<div class="w-12 h-12 rounded-xl bg-[#0f1014] border border-[#2a2a2a] flex items-center justify-center text-[#d4af37]">
					<span class="material-symbols-outlined text-[24px] font-light">emoji_events</span>
				</div>
				<div class="flex flex-col items-start text-left">
					<span class="text-white font-black text-sm">
						{t('gamification.leaderboard') || 'Global Leaderboard'}
					</span>
					<span class="text-[10px] text-[#a0a4ad] font-medium">
						{t('gamification.top100Elite') || 'View the Top 100 Elite Players'}
					</span>
				</div>
			</div>
			<div class="w-8 h-8 rounded-full bg-[#0f1014] border border-[#2a2a2a] flex items-center justify-center group-hover:bg-[#2a2a2a] transition-colors">
				<span class="material-symbols-outlined text-[16px] text-white">chevron_right</span>
			</div>
		</button>
	);
};

import { Component, createMemo, createSignal, For } from 'solid-js';
import { locale, t } from '@/shared/i18n/index.js';

const isRtl = () => locale() === 'fa';

import { hapticFeedback } from '@tma.js/sdk-solid';
import {
	checkedInToday,
	claimDailyReward,
	DAILY_REWARDS,
	streakDay,
} from '@/shared/store/airdrop.js';
import { SectionHeader } from '@/shared/ui/section-header.js';

export const DailyRewardView: Component = () => {
	const [claimLoading, setClaimLoading] = createSignal(false);
	const [claimError, setClaimError] = createSignal('');

	const safeReward = createMemo(() => {
		const day = streakDay();
		const index = day % DAILY_REWARDS.length;
		return DAILY_REWARDS[index];
	});

	const handleClaim = async () => {
		if (claimLoading()) return;
		setClaimError('');
		setClaimLoading(true);
		try {
			const reward = await claimDailyReward();
			if (reward) {
				try {
					hapticFeedback.notificationOccurred('success');
				} catch (_) {}
			} else {
				setClaimError(t('gamification.claimFailed') || 'خطا در دریافت جایزه روزانه');
				try {
					hapticFeedback.notificationOccurred('error');
				} catch (_) {}
			}
		} catch (e: any) {
			setClaimError(e.message || t('common.errors.generic') || 'عملیات ناموفق بود');
			try {
				hapticFeedback.notificationOccurred('error');
			} catch (_) {}
		} finally {
			setClaimLoading(false);
		}
	};

	return (
		<div class="flex-1 overflow-y-auto px-4 pt-4 pb-8 animate-fade-in no-scrollbar">
			<SectionHeader
				icon="calendar_month"
				title={t('airdrop.daily.title')}
				subtitle={t('airdrop.daily.subtitle')}
				gradient="#f59e0b, #f97316"
				shadowColor="rgba(245,158,11,0.3)"
			>
				<div class="mt-3 flex items-center justify-center gap-2">
					<span
						class="material-symbols-outlined text-amber-400 text-sm"
						style={{ 'font-variation-settings': '"FILL" 1' }}
					>
						local_fire_department
					</span>
					<span class="text-amber-400 font-black text-sm">
						{streakDay()} {t('airdrop.daily.streak')}
					</span>
				</div>
			</SectionHeader>

			{/* Calendar Grid */}
			<div class="grid grid-cols-4 gap-2.5 mb-6">
				<For each={DAILY_REWARDS}>
					{(reward, i) => {
						const isPast = () => i() < streakDay();
						const isCurrent = () => i() === streakDay();
						const isLocked = () => i() > streakDay();
						const isClaimable = () => isCurrent() && !checkedInToday();

						return (
							<div
								class={`relative rounded-2xl p-3 flex flex-col items-center justify-center text-center border transition-all ${
									isPast()
										? 'bg-[#34c759]/10 border-[#34c759]/20'
										: isClaimable()
											? 'bg-[#3390ec]/15 border-[#3390ec]/30 animate-pulse shadow-[0_0_20px_rgba(51,144,236,0.15)]'
											: isCurrent() && checkedInToday()
												? 'bg-[#34c759]/10 border-[#34c759]/20'
												: 'bg-[#1c1c1e]/80 border-white/[0.04]'
								}`}
							>
								<span
									class={`text-[10px] font-bold uppercase tracking-wider mb-1 ${
										isPast() || (isCurrent() && checkedInToday())
											? 'text-[#34c759]'
											: isClaimable()
												? 'text-[#3390ec]'
												: 'text-[#8e8e93]'
									}`}
								>
									{t('airdrop.daily.day')} {i() + 1}
								</span>

								{isPast() || (isCurrent() && checkedInToday()) ? (
									<span
										class="material-symbols-outlined text-[#34c759] text-xl"
										style={{ 'font-variation-settings': '"FILL" 1' }}
									>
										check_circle
									</span>
								) : (
									<span
										class="material-symbols-outlined text-amber-400 text-xl"
										style={{ 'font-variation-settings': '"FILL" 1' }}
									>
										monetization_on
									</span>
								)}

								<span
									class={`text-xs font-black mt-1 ${
										isPast() || (isCurrent() && checkedInToday())
											? 'text-[#34c759]'
											: isClaimable()
												? 'text-white'
												: 'text-[#8e8e93]'
									}`}
								>
									{isPast() || (isCurrent() && checkedInToday())
										? t('airdrop.daily.claimed')
										: `+${reward.toLocaleString('en-US')}`}
								</span>

								{isLocked() && (
									<span
										class={`material-symbols-outlined text-[#8e8e93]/30 text-base absolute top-2 ${isRtl() ? 'left-2' : 'right-2'}`}
									>
										lock
									</span>
								)}
							</div>
						);
					}}
				</For>
			</div>

			{/* Claim Button */}
			{!checkedInToday() ? (
				<button
					onClick={handleClaim}
					disabled={claimLoading()}
					class={`w-full text-white font-bold py-4 rounded-2xl active:scale-[0.97] transition-all text-sm ${
						claimLoading()
							? 'bg-[#2c2c2e] text-[#555]'
							: 'bg-[#3390ec] shadow-[0_4px_20px_rgba(51,144,236,0.4)]'
					}`}
				>
					{claimLoading() ? (
						<span class="animate-spin inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full" />
					) : (
						<span class="flex items-center justify-center gap-2">
							<span
								class="material-symbols-outlined text-lg"
								style={{ 'font-variation-settings': '"FILL" 1' }}
							>
								card_giftcard
							</span>
							{t('airdrop.daily.claimBtn')}
							<span class="text-amber-300 font-black">+{safeReward().toLocaleString('en-US')}</span>
						</span>
					)}
				</button>
			) : (
				<div class="w-full bg-[#1c1c1e] text-[#8e8e93] font-bold py-4 rounded-2xl text-sm text-center border border-white/[0.04]">
					<span class="flex items-center justify-center gap-2">
						<span class="material-symbols-outlined text-lg">schedule</span>
						{t('airdrop.daily.comeBack')}
					</span>
				</div>
			)}
			{claimError() && (
				<div class="text-red-500 text-xs text-center mt-3 font-bold">{claimError()}</div>
			)}
		</div>
	);
};

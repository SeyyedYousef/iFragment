import { Motion } from '@motionone/solid';
import { Component, createSignal, For, onCleanup, onMount, Show } from 'solid-js';
import { claimEmojiStatusReward, setEmojiStatus as setServerEmojiStatus } from '@/entities/user/index.js';
import { t } from '@/shared/i18n/index.js';
import { haptic } from '@/shared/lib/haptic.js';
import { triggerConfetti } from '@/shared/lib/confetti.js';

interface Props {
	currentStatus?: string;
	isPro?: boolean;
	onClose: () => void;
	onSuccess?: (emoji: string) => void;
}

interface EmojiOption {
	id: string;
	customEmojiId?: string; // Telegram Bot API custom emoji ID
	symbol: string;
	title: string;
	requiresPro: boolean;
}

const PRESET_EMOJIS: EmojiOption[] = [
	{ id: 'pro_star', customEmojiId: '5368324170671202286', symbol: '⭐️', title: 'iFragment Star', requiresPro: false },
	{ id: 'verified_shield', customEmojiId: '5409146200234057850', symbol: '🛡️', title: 'Guardian Pro', requiresPro: true },
	{ id: 'fire_streak', customEmojiId: '5411234567890123456', symbol: '🔥', title: 'Streak Flame', requiresPro: false },
	{ id: 'whale_crown', customEmojiId: '5422345678901234567', symbol: '👑', title: 'Whale Master', requiresPro: true },
	{ id: 'rocket_boost', customEmojiId: '5433456789012345678', symbol: '🚀', title: 'Turbo Rocket', requiresPro: false },
	{ id: 'diamond_tier', customEmojiId: '5444567890123456789', symbol: '💎', title: 'Diamond Elite', requiresPro: true },
];

const DURATIONS = [
	{ hours: 1, label: '1h' },
	{ hours: 8, label: '8h' },
	{ hours: 24, label: '24h' },
	{ hours: 168, label: '7d' },
	{ hours: 0, label: 'Forever' },
];

export const EmojiStatusModal: Component<Props> = (props) => {
	const [selectedEmoji, setSelectedEmoji] = createSignal<EmojiOption>(PRESET_EMOJIS[0]);
	const [selectedDuration, setSelectedDuration] = createSignal<number>(24);
	const [isSetting, setIsSetting] = createSignal<boolean>(false);
	const [statusError, setStatusError] = createSignal<string | null>(null);
	const [rewardClaimed, setRewardClaimed] = createSignal<boolean>(false);

	// Telegram Bot API 9.3 Event Listeners
	onMount(() => {
		const handleEmojiStatusSet = async () => {
			setIsSetting(false);
			try {
				haptic.notify('success');
				triggerConfetti({ particleCount: 80, spread: 60, origin: { y: 0.6 } });
			} catch {}

			// Claim one-time replay-proof 500 coin reward on server
			try {
				const claimResp = await claimEmojiStatusReward();
				if (claimResp.rewarded) {
					setRewardClaimed(true);
				}
			} catch (e) {
				console.warn('Emoji status reward claim failed or already claimed:', e);
			}

			if (props.onSuccess) {
				props.onSuccess(selectedEmoji().symbol);
			}
		};

		const handleEmojiStatusFailed = (err?: any) => {
			setIsSetting(false);
			try {
				haptic.notify('error');
			} catch {}
			setStatusError(
				typeof err?.error === 'string'
					? err.error
					: (t('emoji.failedToSet' as any) || 'Failed to update emoji status in Telegram.')
			);
		};

		const tg = (window as any).Telegram?.WebApp;
		if (tg?.onEvent) {
			tg.onEvent('emojiStatusSet', handleEmojiStatusSet);
			tg.onEvent('emojiStatusFailed', handleEmojiStatusFailed);
		}

		onCleanup(() => {
			if (tg?.offEvent) {
				tg.offEvent('emojiStatusSet', handleEmojiStatusSet);
				tg.offEvent('emojiStatusFailed', handleEmojiStatusFailed);
			}
		});
	});

	const handleApplyStatus = async () => {
		setStatusError(null);
		setIsSetting(true);
		try {
			haptic.impact('medium');
		} catch {}

		const tg = (window as any).Telegram?.WebApp;
		const emoji = selectedEmoji();
		const durationSeconds = selectedDuration() > 0 ? selectedDuration() * 3600 : undefined;

		// 1. Check if Telegram Bot API 9.3 requestEmojiStatusAccess & setEmojiStatus are available
		if (tg && typeof tg.requestEmojiStatusAccess === 'function' && typeof tg.setEmojiStatus === 'function') {
			tg.requestEmojiStatusAccess((granted: boolean) => {
				if (!granted) {
					setIsSetting(false);
					setStatusError(t('emoji.accessDenied' as any) || 'Permission to set emoji status was declined.');
					return;
				}
				tg.setEmojiStatus(emoji.customEmojiId || '', durationSeconds ? { duration: durationSeconds } : undefined);
			});
		} else {
			// Fallback: save status in iFragment server profile
			try {
				await setServerEmojiStatus(emoji.symbol);
				const claimResp = await claimEmojiStatusReward();
				if (claimResp.rewarded) {
					setRewardClaimed(true);
				}
				try {
					haptic.notify('success');
				} catch {}
				if (props.onSuccess) {
					props.onSuccess(emoji.symbol);
				}
				setIsSetting(false);
			} catch (err: any) {
				setIsSetting(false);
				setStatusError(err?.message || (t('emoji.failedToSet' as any) || 'Failed to set status.'));
			}
		}
	};

	return (
		<div
			class="fixed inset-0 z-[125] flex flex-col justify-end px-2 pb-2"
			onClick={props.onClose}
		>
			<div class="absolute inset-0 bg-[#030303]/90 backdrop-blur-2xl transition-opacity" />

			<Motion.div
				initial={{ y: '100%', opacity: 0 }}
				animate={{ y: 0, opacity: 1 }}
				transition={{ duration: 0.3, easing: [0.32, 0.72, 0, 1] }}
				class="relative bg-[#0D1017] border border-white/10 rounded-[32px] p-6 pb-8 w-full max-w-md mx-auto flex flex-col gap-4 shadow-[0_20px_60px_rgba(0,0,0,0.9)]"
				onClick={(e: Event) => e.stopPropagation()}
			>
				{/* Handle */}
				<div class="w-12 h-1.5 bg-white/10 rounded-full mx-auto shrink-0" />

				{/* Header */}
				<div class="flex items-center justify-between">
					<div class="flex items-center gap-2.5">
						<div class="w-10 h-10 rounded-[14px] bg-amber-400/15 border border-amber-400/30 flex items-center justify-center text-amber-400 shadow-inner">
							<span class="material-symbols-outlined text-[22px]" style={{ 'font-variation-settings': '"FILL" 1' }}>
								star
							</span>
						</div>
						<div class="flex flex-col">
							<h3 class="text-white text-[17px] font-black tracking-tight">
								{t('emoji.title' as any) || 'Telegram Emoji Status'}
							</h3>
							<span class="text-[10px] text-amber-400 font-bold uppercase tracking-wider flex items-center gap-1">
								<span>{t('emoji.proBonus' as any) || 'Bot API 9.3 · +500🪙 Reward'}</span>
							</span>
						</div>
					</div>

					<button
						onClick={props.onClose}
						class="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/60 active:scale-95 transition-all"
					>
						<span class="material-symbols-outlined text-[18px]">close</span>
					</button>
				</div>

				{/* Reward Banner */}
				<div class="p-3.5 bg-gradient-to-r from-amber-500/10 via-[#0098EA]/10 to-transparent border border-amber-500/20 rounded-[20px] flex items-center justify-between gap-3">
					<div class="flex items-center gap-2.5">
						<span class="text-[24px]">🪙</span>
						<div class="flex flex-col">
							<span class="text-[12px] font-black text-amber-300">
								{t('emoji.rewardTitle' as any) || 'One-Time 500 Coin Bonus'}
							</span>
							<span class="text-[10px] text-white/50 font-bold">
								{t('emoji.rewardDesc' as any) || 'Set your status to claim verified coins'}
							</span>
						</div>
					</div>
					<Show when={rewardClaimed()}>
						<span class="text-[10px] px-2.5 py-1 rounded-[10px] bg-emerald-500/20 text-emerald-400 font-black border border-emerald-500/30">
							Claimed ✓
						</span>
					</Show>
				</div>

				{/* Emoji Selection Grid */}
				<div class="grid grid-cols-3 gap-2.5">
					<For each={PRESET_EMOJIS}>
						{(emoji) => {
							const isSelected = () => selectedEmoji().id === emoji.id;
							return (
								<button
									onClick={() => {
										try {
											haptic.selection();
										} catch {}
										setSelectedEmoji(emoji);
									}}
									class={`p-3 rounded-[20px] flex flex-col items-center gap-1.5 border transition-all active:scale-95 relative ${
										isSelected()
											? 'bg-[#0098EA]/20 border-[#0098EA] shadow-[0_0_15px_rgba(0,152,234,0.3)]'
											: 'bg-[#07090E] border-white/5 hover:border-white/15'
									}`}
								>
									<span class="text-[28px]">{emoji.symbol}</span>
									<span class="text-[10px] font-black text-white/80 tracking-tight text-center">
										{emoji.title}
									</span>
									<Show when={emoji.requiresPro}>
										<span class="absolute top-1.5 right-1.5 text-[8px] px-1.5 py-0.5 rounded-[6px] bg-cyan-500/20 text-cyan-300 font-black border border-cyan-500/30">
											PRO
										</span>
									</Show>
								</button>
							);
						}}
					</For>
				</div>

				{/* Duration Selector */}
				<div class="flex flex-col gap-1.5 pt-1">
					<span class="text-[11px] font-bold text-white/40 uppercase tracking-wider">
						{t('emoji.duration' as any) || 'Duration'}
					</span>
					<div class="grid grid-cols-5 gap-1.5">
						<For each={DURATIONS}>
							{(dur) => (
								<button
									onClick={() => {
										try {
											haptic.selection();
										} catch {}
										setSelectedDuration(dur.hours);
									}}
									class={`py-2 rounded-[12px] text-[11px] font-black border transition-all active:scale-95 ${
										selectedDuration() === dur.hours
											? 'bg-[#0098EA] text-black border-[#0098EA]'
											: 'bg-[#07090E] text-white/60 border-white/5 hover:text-white'
									}`}
								>
									{dur.label}
								</button>
							)}
						</For>
					</div>
				</div>

				{/* Error Notice */}
				<Show when={statusError()}>
					<div class="p-3 rounded-[16px] bg-rose-500/15 border border-rose-500/30 text-rose-400 text-[11px] font-bold flex items-center gap-2">
						<span class="material-symbols-outlined text-[16px]">error</span>
						<span>{statusError()}</span>
					</div>
				</Show>

				{/* Action CTA */}
				<button
					disabled={isSetting()}
					onClick={handleApplyStatus}
					class="w-full py-3.5 rounded-[18px] bg-gradient-to-r from-[#0098EA] to-[#00b4d8] hover:opacity-95 active:scale-[0.98] disabled:opacity-50 text-black font-black text-[14px] tracking-wide transition-all shadow-[0_4px_20px_rgba(0,152,234,0.4)] flex items-center justify-center gap-2"
				>
					<Show
						when={!isSetting()}
						fallback={
							<div class="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin" />
						}
					>
						<span class="material-symbols-outlined text-[18px]">verified</span>
						<span>{t('emoji.setNow' as any) || 'Set Emoji Status & Claim 500🪙'}</span>
					</Show>
				</button>
			</Motion.div>
		</div>
	);
};

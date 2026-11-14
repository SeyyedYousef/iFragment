import { Motion } from '@motionone/solid';
import { type Component, createSignal, For, onCleanup, onMount, Show } from 'solid-js';
import {
	claimEmojiStatusReward,
	setEmojiStatus as setServerEmojiStatus,
} from '@/entities/user/index.js';
import { t } from '@/shared/i18n/index.js';
import { triggerConfetti } from '@/shared/lib/confetti.js';
import { haptic } from '@/shared/lib/haptic.js';

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
	{
		id: 'pro_star',
		customEmojiId: '5368324170671202286',
		symbol: '⭐️',
		title: 'iFragment Star',
		requiresPro: false,
	},
	{
		id: 'verified_shield',
		customEmojiId: '5409146200234057850',
		symbol: '🛡️',
		title: 'Guardian Pro',
		requiresPro: true,
	},
	{
		id: 'fire_streak',
		customEmojiId: '5411234567890123456',
		symbol: '🔥',
		title: 'Streak Flame',
		requiresPro: false,
	},
	{
		id: 'whale_crown',
		customEmojiId: '5422345678901234567',
		symbol: '👑',
		title: 'Whale Master',
		requiresPro: true,
	},
	{
		id: 'rocket_boost',
		customEmojiId: '5433456789012345678',
		symbol: '🚀',
		title: 'Turbo Rocket',
		requiresPro: false,
	},
	{
		id: 'diamond_tier',
		customEmojiId: '5444567890123456789',
		symbol: '💎',
		title: 'Diamond Elite',
		requiresPro: true,
	},
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
					: t('emoji.failedToSet' as any) || 'Failed to update emoji status in Telegram.',
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
		if (
			tg &&
			typeof tg.requestEmojiStatusAccess === 'function' &&
			typeof tg.setEmojiStatus === 'function'
		) {
			tg.requestEmojiStatusAccess((granted: boolean) => {
				if (!granted) {
					setIsSetting(false);
					setStatusError(
						t('emoji.accessDenied' as any) || 'Permission to set emoji status was declined.',
					);
					return;
				}
				tg.setEmojiStatus(
					emoji.customEmojiId || '',
					durationSeconds ? { duration: durationSeconds } : undefined,
				);
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
				setStatusError(err?.message || t('emoji.failedToSet' as any) || 'Failed to set status.');
			}
		}
	};

	return (
		<div
			class="fixed inset-0 z-[125] flex flex-col justify-end px-2 pb-2"
			role="button"
			tabIndex={0}
			onKeyDown={(e) => {
				if (e.key === 'Enter') (e.currentTarget as HTMLElement).click();
				else if (e.key === 'Escape') props.onClose();
			}}
			onClick={props.onClose}
		>
			<div class="absolute inset-0 bg-black/75 backdrop-blur-md transition-opacity" />

			<Motion.div
				initial={{ y: '100%', opacity: 0 }}
				animate={{ y: 0, opacity: 1 }}
				transition={{ duration: 0.28, easing: [0.32, 0.72, 0, 1] }}
				class="relative frag-sheet rounded-t-[24px] p-5 pb-7 w-full max-w-md mx-auto flex flex-col gap-3.5"
				onClick={(e: Event) => e.stopPropagation()}
			>
				{/* Handle */}
				<div class="w-9 h-1 bg-white/20 rounded-full mx-auto shrink-0" />

				{/* Header */}
				<div class="flex items-center justify-between gap-3">
					<div class="flex items-center gap-2.5 min-w-0">
						<div class="w-10 h-10 rounded-[11px] bg-[#ffb340]/12 border border-[#ffb340]/25 flex items-center justify-center text-[#ffb340] shrink-0">
							<span
								class="material-symbols-outlined text-[20px]"
								style={{ 'font-variation-settings': '"FILL" 1' }}
							>
								star
							</span>
						</div>
						<div class="flex flex-col min-w-0">
							<h3 class="text-white text-[16px] font-semibold tracking-[-0.015em] truncate">
								{t('emoji.title' as any) || 'Telegram Emoji Status'}
							</h3>
							<span class="text-[11px] text-[#ffb340] font-medium truncate">
								{t('emoji.proBonus' as any) || 'Bot API 9.3 · +500 Reward'}
							</span>
						</div>
					</div>

					<button
						type="button"
						onClick={props.onClose}
						class="w-8 h-8 rounded-[10px] frag-btn-secondary flex items-center justify-center text-[#8c9ba5] hover:text-white shrink-0"
					>
						<span class="material-symbols-outlined text-[18px]">close</span>
					</button>
				</div>

				{/* Reward Banner */}
				<div class="p-3 frag-inset rounded-[12px] border-[#ffb340]/25 flex items-center justify-between gap-3">
					<div class="flex items-center gap-2.5 min-w-0">
						<div class="w-9 h-9 rounded-[9px] bg-[#ffb340]/12 border border-[#ffb340]/25 flex items-center justify-center text-[#ffb340] shrink-0">
							<span class="material-symbols-outlined text-[19px]">monetization_on</span>
						</div>
						<div class="flex flex-col min-w-0">
							<span class="text-[12.5px] font-semibold text-white truncate">
								{t('emoji.rewardTitle' as any) || 'One-Time 500 Coin Bonus'}
							</span>
							<span class="text-[11px] text-[#8c9ba5] leading-snug">
								{t('emoji.rewardDesc' as any) || 'Set your status to claim verified coins'}
							</span>
						</div>
					</div>
					<Show when={rewardClaimed()}>
						<span class="text-[11px] px-2 py-0.5 rounded-[6px] bg-[#4cd964]/12 text-[#4cd964] font-semibold border border-[#4cd964]/30 shrink-0">
							{t('emojiStatus.claimed')}
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
									type="button"
									onClick={() => {
										try {
											haptic.selection();
										} catch {}
										setSelectedEmoji(emoji);
									}}
									class={`p-2.5 rounded-[12px] flex flex-col items-center gap-1 border transition-all active:scale-95 relative ${
										isSelected()
											? 'bg-[#2990ff]/14 border-[#2990ff] shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]'
											: 'bg-[#141a22] border-white/[0.07] hover:border-white/[0.14]'
									}`}
								>
									<span class="text-[26px]">{emoji.symbol}</span>
									<span class="text-[11px] font-medium text-[#d7e0e8] text-center leading-tight">
										{emoji.title}
									</span>
									<Show when={emoji.requiresPro}>
										<span class="absolute top-1.5 right-1.5 text-[9px] px-1.5 py-0.5 rounded-[5px] bg-[#2990ff]/15 text-[#2990ff] font-semibold border border-[#2990ff]/30">
											{t('common.proBadge')}
										</span>
									</Show>
								</button>
							);
						}}
					</For>
				</div>

				{/* Duration Selector */}
				<div class="flex flex-col gap-1.5 pt-0.5">
					<span class="text-[12px] font-medium text-[#8c9ba5]">
						{t('emoji.duration' as any) || 'Duration'}
					</span>
					<div class="grid grid-cols-5 gap-1.5">
						<For each={DURATIONS}>
							{(dur) => (
								<button
									type="button"
									onClick={() => {
										try {
											haptic.selection();
										} catch {}
										setSelectedDuration(dur.hours);
									}}
									class={`py-2 rounded-[9px] font-mono text-[11.5px] font-semibold border transition-all active:scale-95 tabular-nums ${
										selectedDuration() === dur.hours
											? 'bg-[#2990ff] text-white border-[#2990ff]'
											: 'bg-[#141a22] text-[#8c9ba5] border-white/[0.07] hover:text-white'
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
					<div class="p-3 rounded-[10px] bg-[#ff5c6c]/12 border border-[#ff5c6c]/30 text-[#ff8591] text-[12px] font-medium flex items-center gap-2">
						<span class="material-symbols-outlined text-[16px] text-[#ff5c6c]">error</span>
						<span>{statusError()}</span>
					</div>
				</Show>

				{/* Action CTA */}
				<button
					type="button"
					disabled={isSetting()}
					onClick={handleApplyStatus}
					class="w-full h-12 rounded-[12px] frag-btn-primary disabled:opacity-50 font-semibold text-[13.5px] flex items-center justify-center gap-2"
				>
					<Show
						when={!isSetting()}
						fallback={
							<div class="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
						}
					>
						<span class="material-symbols-outlined text-[18px]">verified</span>
						<span>{t('emoji.setNow' as any) || 'Set Emoji Status'}</span>
					</Show>
				</button>
			</Motion.div>
		</div>
	);
};

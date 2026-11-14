import { initData } from '@tma.js/sdk-solid';
import { createEffect, createMemo, createSignal, Show } from 'solid-js';
import { getLevelInfo, type ProfileStats } from '@/entities/user/index.js';
import { EmojiStatusModal } from '@/features/emoji-status/EmojiStatusModal.js';
import { getActiveImpersonationToken } from '@/shared/api/axios.js';
import { buildAvatarUrl } from '@/shared/api/config.js';
import { formatNumber, t } from '@/shared/i18n/index.js';
import { haptic } from '@/shared/lib/haptic.js';

interface Props {
	stats: ProfileStats | null;
	onStatusUpdated?: () => void;
}

export const IdentityHero = (props: Props) => {
	const user = () => initData.user();
	const [imgError, setImgError] = createSignal(false);
	const [fallbackAttempted, setFallbackAttempted] = createSignal(false);
	const [showEmojiModal, setShowEmojiModal] = createSignal(false);

	const isImpersonating = createMemo(() => !!getActiveImpersonationToken());

	const displayName = createMemo(() => {
		if (props.stats?.firstName || props.stats?.lastName) {
			const full = `${props.stats?.firstName || ''} ${props.stats?.lastName || ''}`.trim();
			if (full) return full;
		}
		if (isImpersonating()) {
			const sf = sessionStorage.getItem('impersonated_first_name');
			const sl = sessionStorage.getItem('impersonated_last_name');
			const su = sessionStorage.getItem('impersonated_username');
			const full = `${sf || ''} ${sl || ''}`.trim();
			if (full) return full;
			if (su && !su.startsWith('impersonated_user_') && !su.startsWith('owner_')) return `@${su}`;
		}
		const u = user() as any;
		const fName = u?.firstName || u?.first_name;
		const lName = u?.lastName || u?.last_name;
		if (fName) {
			return `${fName} ${lName || ''}`.trim();
		}
		return t('common.user' as any) || t('profile.user' as any) || 'User';
	});

	const usernameTag = createMemo(() => {
		if (
			props.stats?.username &&
			!props.stats.username.startsWith('owner_') &&
			!props.stats.username.startsWith('impersonated_user_')
		)
			return `@${props.stats.username}`;
		if (isImpersonating()) {
			const su = sessionStorage.getItem('impersonated_username');
			if (su && !su.startsWith('impersonated_user_') && !su.startsWith('owner_')) return `@${su}`;
		}
		if (user()?.username) return `@${user()?.username}`;
		return '';
	});

	const directTgPhoto = createMemo(() => {
		if (isImpersonating()) return '';
		return (user() as any)?.photo_url || (user() as any)?.photoUrl || '';
	});

	const primaryAvatarUrl = createMemo(() => {
		const u = user();
		const userId = u?.id || props.stats?.telegramId;
		if (userId && !isImpersonating()) {
			return buildAvatarUrl(`/api/v1/profile/avatar/${userId}`);
		}
		if (props.stats?.photoUrl) return buildAvatarUrl(props.stats.photoUrl);
		const direct = directTgPhoto();
		if (direct) return direct;
		return '';
	});

	const avatarUrl = createMemo(() => {
		if (imgError() && !fallbackAttempted()) {
			const fallback = directTgPhoto();
			if (fallback) return fallback;
		}
		if (imgError() && fallbackAttempted()) {
			return '';
		}
		return primaryAvatarUrl();
	});

	createEffect(() => {
		props.stats?.photoUrl;
		user();
		setImgError(false);
		setFallbackAttempted(false);
	});

	const info = createMemo(() => getLevelInfo(props.stats?.xp || 0));

	const initialLetter = createMemo(() => {
		const name = displayName();
		return name && name.length > 0 ? name[0].toUpperCase() : 'U';
	});

	const handleOpenEmojiModal = () => {
		try {
			haptic.impact('light');
		} catch {}
		setShowEmojiModal(true);
	};

	return (
		<>
			<div class="relative w-full flex flex-col items-center px-4 z-20 select-none">
				{/* Fragment Elevated Glass Card Cover */}
				<div class="frag-card-elevated absolute inset-0 rounded-2xl overflow-hidden -z-10" />

				{/* Avatar Container */}
				<div class="relative mt-5 mb-3">
					<div class="relative w-[92px] h-[92px] rounded-full p-[2px] bg-gradient-to-br from-[#2990ff]/50 via-white/15 to-transparent shadow-[0_12px_32px_rgba(0,0,0,0.45)]">
						<div class="w-full h-full rounded-full bg-[#141a22] overflow-hidden flex items-center justify-center relative">
							<Show
								when={avatarUrl()}
								fallback={
									<div class="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#1b232d] to-[#11161d]">
										<span class="text-3xl font-bold text-[#5aaeff]">{initialLetter()}</span>
									</div>
								}
							>
								<img
									src={avatarUrl()}
									alt={displayName()}
									class="w-full h-full object-cover transition-opacity duration-300"
									loading="eager"
									referrerPolicy="no-referrer"
									onError={() => {
										if (!imgError()) {
											setImgError(true);
										} else {
											setFallbackAttempted(true);
										}
									}}
								/>
							</Show>
						</div>
					</div>

					{/* Emoji Status Indicator (Clickable Action) */}
					<button
						type="button"
						onClick={handleOpenEmojiModal}
						class="absolute -bottom-1 -right-1 w-7 h-7 bg-[#1b232d] hover:bg-[#232d3a] active:scale-90 border border-white/15 rounded-full flex items-center justify-center text-[14px] shadow-lg transition-all"
						title={t('emoji.setStatus' as any) || 'Set Telegram Emoji Status'}
						aria-label={t('emoji.setStatus' as any) || 'Set Telegram Emoji Status'}
					>
						<Show
							when={props.stats?.emojiStatus}
							fallback={
								<span class="material-symbols-outlined text-[14px] text-[#8ca0b5]">
									add_reaction
								</span>
							}
						>
							<span>{props.stats?.emojiStatus}</span>
						</Show>
					</button>
				</div>

				{/* User Info & Badges */}
				<div class="flex flex-col items-center w-full text-center z-10 px-4 pb-5 space-y-2">
					<div class="flex items-center justify-center gap-1.5 flex-wrap">
						<h1 class="text-[20px] font-bold leading-tight text-white tracking-tight">
							<bdi>{displayName()}</bdi>
						</h1>
						<Show when={props.stats?.isPremium || props.stats?.subscription?.isActive}>
							<span class="px-2 py-0.5 rounded-md bg-[#2990ff]/15 border border-[#2990ff]/35 text-[#5aaeff] text-[10px] font-bold tracking-wide">
								{t('common.proBadge')}
							</span>
						</Show>
					</div>

					<Show when={usernameTag()}>
						<p class="text-[#5aaeff] text-xs font-semibold dir-ltr font-mono" dir="ltr">
							{usernameTag()}
						</p>
					</Show>

					<div class="flex items-center justify-center flex-wrap gap-2 pt-1">
						{/* Level Badge */}
						<div class="flex items-center gap-1.5 bg-[#2990ff]/12 border border-[#2990ff]/28 px-3 py-1 rounded-xl">
							<span
								class="material-symbols-outlined text-[15px] text-[#5aaeff]"
								style={{ 'font-variation-settings': '"FILL" 1' }}
							>
								star
							</span>
							<span class="text-white text-xs font-semibold">
								{t('profile.levelBadge', {
									level: formatNumber(info().current.level),
									title: info().current.title,
								})}
							</span>
						</div>

						{/* Rank Badge */}
						<Show when={props.stats?.globalRank}>
							<div class="flex items-center gap-1.5 bg-[#141a22] border border-white/[0.08] px-3 py-1 rounded-xl">
								<span class="material-symbols-outlined text-[15px] text-[#8ca0b5]">public</span>
								<span class="text-[#c2cfde] text-xs font-semibold tabular-nums">
									{t('profile.rankBadge', { rank: formatNumber(props.stats?.globalRank || 0) })}
								</span>
							</div>
						</Show>

						{/* Set Emoji Status Action Pill */}
						<button
							type="button"
							onClick={handleOpenEmojiModal}
							class="flex items-center gap-1 bg-[#ffb340]/12 hover:bg-[#ffb340]/20 border border-[#ffb340]/28 px-2.5 py-1 rounded-xl text-[#ffb340] text-[11px] font-semibold active:scale-95 transition-all"
						>
							<Show
								when={props.stats?.emojiStatus}
								fallback={
									<span
										class="material-symbols-outlined text-[13px] text-[#ffb340]"
										style={{ 'font-variation-settings': '"FILL" 1' }}
									>
										star
									</span>
								}
							>
								<span>{props.stats?.emojiStatus}</span>
							</Show>
							<span>{t('emoji.status' as any) || 'Status'}</span>
						</button>
					</div>
				</div>
			</div>

			<Show when={showEmojiModal()}>
				<EmojiStatusModal
					currentStatus={props.stats?.emojiStatus}
					isPro={props.stats?.isPremium || props.stats?.subscription?.isActive}
					onClose={() => setShowEmojiModal(false)}
					onSuccess={() => {
						setShowEmojiModal(false);
						if (props.onStatusUpdated) props.onStatusUpdated();
					}}
				/>
			</Show>
		</>
	);
};

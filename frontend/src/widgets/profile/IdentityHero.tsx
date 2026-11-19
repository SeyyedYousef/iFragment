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
		if (fName) return `${fName} ${lName || ''}`.trim();
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
		if (imgError() && fallbackAttempted()) return '';
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
			<div class="frag-card p-4 flex items-center justify-between gap-3 select-none">
				<div class="flex items-center gap-3.5 min-w-0">
					{/* Clean Avatar */}
					<div class="relative w-14 h-14 rounded-full bg-[#242e38] overflow-hidden flex items-center justify-center shrink-0">
						<Show
							when={avatarUrl()}
							fallback={<span class="text-[20px] font-bold text-[#4db2ff]">{initialLetter()}</span>}
						>
							<img
								src={avatarUrl()}
								alt={displayName()}
								class="w-full h-full object-cover"
								loading="eager"
								referrerPolicy="no-referrer"
								onError={() => {
									if (!imgError()) setImgError(true);
									else setFallbackAttempted(true);
								}}
							/>
						</Show>
					</div>

					<div class="flex flex-col min-w-0">
						<div class="flex items-center gap-1.5 flex-wrap">
							<h1 class="text-[17px] font-bold leading-tight text-white truncate">
								<bdi>{displayName()}</bdi>
							</h1>
							<Show when={props.stats?.isPremium || props.stats?.subscription?.isActive}>
								<span class="px-1.5 py-0.5 rounded-[4px] bg-[#4db2ff]/10 text-[#4db2ff] text-[10px] font-semibold">
									{t('common.proBadge')}
								</span>
							</Show>
						</div>

						<Show when={usernameTag()}>
							<p class="text-[#4db2ff] text-[12.5px] font-mono truncate mt-0.5" dir="ltr">
								{usernameTag()}
							</p>
						</Show>

						<div class="flex items-center gap-2 flex-wrap mt-1.5">
							<span class="px-2 py-0.5 rounded-[4px] bg-[#242e38] text-[11px] font-semibold text-white">
								{t('profile.levelBadge', {
									level: formatNumber(info().current.level),
									title: info().current.title,
								})}
							</span>
							<Show when={props.stats?.globalRank}>
								<span class="px-2 py-0.5 rounded-[4px] bg-[#242e38] text-[11px] font-semibold text-[#8c9aa9] tabular-nums">
									{t('profile.rankBadge', { rank: formatNumber(props.stats?.globalRank || 0) })}
								</span>
							</Show>
						</div>
					</div>
				</div>

				{/* Emoji Status Action Button */}
				<button
					type="button"
					onClick={handleOpenEmojiModal}
					class="h-8 px-2.5 rounded-[6px] bg-[#242e38] hover:bg-[#293440] text-[#ff9953] text-[12px] font-semibold flex items-center gap-1 shrink-0 transition-colors cursor-pointer"
					title={t('emoji.setStatus' as any) || 'Set Telegram Emoji Status'}
					aria-label={t('emoji.setStatus' as any) || 'Set Telegram Emoji Status'}
				>
					<Show
						when={props.stats?.emojiStatus}
						fallback={
							<span
								class="material-symbols-outlined text-[14px]"
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

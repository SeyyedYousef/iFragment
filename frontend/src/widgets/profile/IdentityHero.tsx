import { initData } from '@tma.js/sdk-solid';
import { createEffect, createMemo, createSignal, Show } from 'solid-js';
import { buildAvatarUrl } from '@/shared/api/config.js';
import { getActiveImpersonationToken } from '@/shared/api/axios.js';
import { formatNumber, t } from '@/shared/i18n/index.js';
import { getLevelInfo, type ProfileStats } from '@/entities/user/index.js';
import { haptic } from '@/shared/lib/haptic.js';
import { EmojiStatusModal } from '@/features/emoji-status/EmojiStatusModal.js';

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
		if (user()?.first_name) {
			return `${user()?.first_name} ${user()?.last_name || ''}`.trim();
		}
		return t('common.user' as any) || t('profile.user' as any) || 'User';
	});

	const usernameTag = createMemo(() => {
		if (props.stats?.username && !props.stats.username.startsWith('owner_') && !props.stats.username.startsWith('impersonated_user_')) return `@${props.stats.username}`;
		if (isImpersonating()) {
			const su = sessionStorage.getItem('impersonated_username');
			if (su && !su.startsWith('impersonated_user_') && !su.startsWith('owner_')) return `@${su}`;
		}
		if (user()?.username) return `@${user()?.username}`;
		return '';
	});

	const directTgPhoto = createMemo(() => {
		if (isImpersonating()) return '';
		return ((user() as any)?.photo_url || (user() as any)?.photoUrl) || '';
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
				{/* Restrained Hero Glass Cover */}
				<div class="absolute top-0 inset-x-0 bottom-0 bg-[#0D1017]/90 backdrop-blur-2xl rounded-[28px] overflow-hidden border border-white/10 shadow-[0_12px_40px_rgba(0,0,0,0.5)] -z-10">
					<div class="absolute -right-8 -top-8 w-40 h-40 bg-[#0098EA]/15 rounded-full blur-[50px] pointer-events-none" />
					<div class="absolute -left-8 -bottom-8 w-40 h-40 bg-[#06b6d4]/10 rounded-full blur-[50px] pointer-events-none" />
				</div>

				{/* Avatar Container */}
				<div class="relative mt-5 mb-3">
					<div class="relative w-[92px] h-[92px] rounded-full p-[2px] bg-gradient-to-br from-[#0098EA]/40 via-white/10 to-transparent shadow-2xl">
						<div class="w-full h-full rounded-full bg-[#08090D] overflow-hidden flex items-center justify-center relative">
							<Show
								when={avatarUrl()}
								fallback={
									<div class="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#151822] to-[#08090D]">
										<span class="text-3xl font-black text-[#0098EA]">
											{initialLetter()}
										</span>
									</div>
								}
							>
								<img
									src={avatarUrl()}
									alt={displayName()}
									class="w-full h-full object-cover transition-opacity duration-300"
									loading="lazy"
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
						onClick={handleOpenEmojiModal}
						class="absolute -bottom-1 -right-1 w-7 h-7 bg-[#12141C] hover:bg-[#1A1D27] active:scale-90 border border-white/20 rounded-full flex items-center justify-center text-[14px] shadow-lg transition-all"
						title={t('emoji.setStatus' as any) || 'Set Telegram Emoji Status'}
					>
						<span>{props.stats?.emojiStatus || '⭐️'}</span>
					</button>
				</div>

				{/* User Info & Badges */}
				<div class="flex flex-col items-center w-full text-center z-10 px-4 pb-5 space-y-2">
					<div class="flex items-center justify-center gap-1.5 flex-wrap">
						<h1 class="text-[20px] font-black leading-tight text-white tracking-tight">
							<bdi>{displayName()}</bdi>
						</h1>
						<Show when={props.stats?.isPremium || props.stats?.subscription?.isActive}>
							<span class="px-2 py-0.5 rounded-[8px] bg-cyan-500/20 border border-cyan-500/30 text-cyan-300 text-[10px] font-black tracking-wide uppercase">
								PRO
							</span>
						</Show>
					</div>

					<Show when={usernameTag()}>
						<p class="text-[#0098EA] text-xs font-bold dir-ltr opacity-90 font-mono">
							{usernameTag()}
						</p>
					</Show>

					<div class="flex items-center justify-center flex-wrap gap-2 pt-1">
						{/* Level Badge */}
						<div class="flex items-center gap-1.5 bg-[#0098EA]/15 border border-[#0098EA]/30 px-3 py-1 rounded-[12px] backdrop-blur-md">
							<span
								class="material-symbols-outlined text-[15px] text-[#0098EA]"
								style={{ 'font-variation-settings': '"FILL" 1' }}
							>
								star
							</span>
							<span class="text-white text-xs font-black">
								{t('profile.levelBadge', {
									level: formatNumber(info().current.level),
									title: info().current.title,
								})}
							</span>
						</div>

						{/* Rank Badge */}
						<Show when={props.stats?.globalRank}>
							<div class="flex items-center gap-1.5 bg-white/5 border border-white/10 px-3 py-1 rounded-[12px] backdrop-blur-md">
								<span class="material-symbols-outlined text-[15px] text-white/50">public</span>
								<span class="text-white/60 text-xs font-bold">
									{t('profile.rankBadge', { rank: formatNumber(props.stats?.globalRank || 0) })}
								</span>
							</div>
						</Show>

						{/* Set Emoji Status Action Pill */}
						<button
							onClick={handleOpenEmojiModal}
							class="flex items-center gap-1 bg-amber-400/15 hover:bg-amber-400/25 border border-amber-400/30 px-2.5 py-1 rounded-[12px] text-amber-300 text-[11px] font-black active:scale-95 transition-all"
						>
							<span>{props.stats?.emojiStatus || '⭐️'}</span>
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

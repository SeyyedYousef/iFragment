import { initData } from '@tma.js/sdk-solid';
import { createEffect, createMemo, createSignal, Show } from 'solid-js';
import { buildAvatarUrl } from '@/shared/api/config.js';
import { getActiveImpersonationToken } from '@/shared/api/axios.js';
import { formatNumber, t } from '@/shared/i18n/index.js';
import { getLevelInfo, type ProfileStats } from '@/shared/store/profile.js';

interface Props {
	stats: ProfileStats | null;
}

export const IdentityHero = (props: Props) => {
	const user = () => initData.user();
	const [imgError, setImgError] = createSignal(false);

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

	const avatarUrl = createMemo(() => {
		const directTgPhoto = !isImpersonating() && ((user() as any)?.photo_url || (user() as any)?.photoUrl);

		if (imgError()) {
			// If proxy/primary URL failed to load, fall back to direct Telegram CDN photo or empty
			return directTgPhoto || '';
		}

		if (directTgPhoto) return directTgPhoto;
		if (props.stats?.photoUrl) return buildAvatarUrl(props.stats.photoUrl);
		return '';
	});

	createEffect(() => {
		props.stats?.photoUrl;
		user();
		setImgError(false);
	});

	const info = createMemo(() => getLevelInfo(props.stats?.xp || 0));

	const initialLetter = createMemo(() => {
		const name = displayName();
		return name && name.length > 0 ? name[0].toUpperCase() : 'U';
	});

	return (
		<div class="relative w-full flex flex-col items-center px-4 z-20 mt-4 select-none">
			{/* Restrained Hero Glass Cover */}
			<div class="absolute top-0 inset-x-4 bottom-0 bg-[#0F1117]/85 backdrop-blur-xl rounded-[28px] overflow-hidden border border-white/10 shadow-xl -z-10">
				<div class="absolute -right-8 -top-8 w-40 h-40 bg-[#3390ec]/15 rounded-full blur-[50px] pointer-events-none" />
				<div class="absolute -left-8 -bottom-8 w-40 h-40 bg-[#0088cc]/10 rounded-full blur-[50px] pointer-events-none" />
			</div>

			{/* Avatar Container */}
			<div class="relative mt-6 mb-4">
				<div class="relative w-[96px] h-[96px] rounded-full p-[2px] bg-gradient-to-br from-[#3390ec]/40 to-white/10 shadow-2xl">
					<div class="w-full h-full rounded-full bg-[#08090D] overflow-hidden flex items-center justify-center relative">
						<Show
							when={avatarUrl() && !imgError()}
							fallback={
								<div class="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#151822] to-[#08090D]">
									<span class="text-3xl font-black text-[#3390ec]">
										{initialLetter()}
									</span>
								</div>
							}
						>
							<img
								src={avatarUrl()}
								alt={`تصویر ${displayName()}`}
								class="w-full h-full object-cover transition-opacity duration-300"
								loading="lazy"
								referrerPolicy="no-referrer"
								onError={() => setImgError(true)}
							/>
						</Show>
					</div>
				</div>

				<div class="absolute bottom-1 right-1 w-4 h-4 bg-[#10b981] rounded-full border-[2.5px] border-[#08090D]" />
			</div>

			{/* User Info & Badges */}
			<div class="flex flex-col items-center w-full text-center z-10 px-4 pb-5 space-y-2">
				<h1 class="text-2xl font-black leading-tight text-white">
					<bdi>{displayName()}</bdi>
				</h1>

				<Show when={usernameTag()}>
					<p class="text-[#3390ec] text-xs font-bold dir-ltr opacity-90">
						{usernameTag()}
					</p>
				</Show>

				<div class="flex items-center justify-center flex-wrap gap-2 pt-1">
					{/* Level Badge */}
					<div class="flex items-center gap-1.5 bg-[#3390ec]/15 border border-[#3390ec]/30 px-3 py-1.5 rounded-xl backdrop-blur-md">
						<span
							class="material-symbols-outlined text-[15px] text-[#3390ec]"
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
						<div class="flex items-center gap-1.5 bg-white/5 border border-white/10 px-3 py-1.5 rounded-xl backdrop-blur-md">
							<span class="material-symbols-outlined text-[15px] text-white/50">public</span>
							<span class="text-white/60 text-xs font-bold">
								{t('profile.rankBadge', { rank: formatNumber(props.stats?.globalRank || 0) })}
							</span>
						</div>
					</Show>
				</div>
			</div>
		</div>
	);
};

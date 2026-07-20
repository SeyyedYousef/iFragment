import { initData } from '@tma.js/sdk-solid';
import { createMemo, createSignal, createEffect, Show } from 'solid-js';
import { getLevelInfo, type ProfileStats } from '@/shared/store/profile.js';
import { API_CONFIG } from '@/shared/api/config.js';

interface Props {
	stats: ProfileStats | null;
}

const buildAvatarUrl = (rawUrl: string): string => {
	if (!rawUrl) return '';
	if (rawUrl.startsWith('http://') || rawUrl.startsWith('https://')) return rawUrl;
	try {
		const base = new URL(API_CONFIG.BASE_URL);
		return `${base.origin}${rawUrl}`;
	} catch {
		return rawUrl;
	}
};

export const IdentityHero = (props: Props) => {
	const user = () => initData.user();
	const [imgError, setImgError] = createSignal(false);

	const avatarUrl = createMemo(() => {
		if (props.stats?.photoUrl) return buildAvatarUrl(props.stats.photoUrl);
		if ((user() as any)?.photo_url) return (user() as any).photo_url;
		return '';
	});

	createEffect(() => {
		avatarUrl();
		setImgError(false);
	});

	const info = createMemo(() => getLevelInfo(props.stats?.xp || 0));

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
										{user()?.first_name ? user()?.first_name[0].toUpperCase() : 'U'}
									</span>
								</div>
							}
						>
							<img
								src={avatarUrl()}
								alt={user()?.first_name ? `تصویر ${user()?.first_name}` : 'تصویر پروفایل کاربر'}
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

			{/* User Info & Narrative Level Bar */}
			<div class="flex flex-col items-center w-full text-center z-10 px-4 pb-5 space-y-3">
				<h1 class="text-2xl font-black leading-tight text-white">
					<bdi>{user()?.first_name} {user()?.last_name || ''}</bdi>
				</h1>

				{/* Level Narrative Badge & Progress Bar */}
				<div class="w-full max-w-xs space-y-1.5">
					<div class="flex items-center justify-between text-xs font-bold">
						<span class="text-[#3390ec]">سطح {info().current.level}: {info().current.title}</span>
						<span class="text-white/40 font-mono text-[11px]">{props.stats?.xp || 0} XP</span>
					</div>

					<div class="w-full h-2 bg-black/40 rounded-full border border-white/10 overflow-hidden">
						<div
							class="h-full bg-gradient-to-r from-[#3390ec] to-[#0088cc] rounded-full transition-all duration-500"
							style={{ width: `${Math.min(100, info().progress)}%` }}
						/>
					</div>
				</div>
			</div>
		</div>
	);
};

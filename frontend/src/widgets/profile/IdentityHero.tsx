import { initData } from '@tma.js/sdk-solid';
import { createMemo, Show } from 'solid-js';
import { getLevelInfo, type ProfileStats } from '@/shared/store/profile.js';
import { t } from '@/shared/i18n/index.js';

interface Props {
	stats: ProfileStats | null;
}

export const IdentityHero = (props: Props) => {
	const user = () => initData.user();
	
	const avatarUrl = createMemo(() => {
		if ((user() as any)?.photo_url) return (user() as any).photo_url;
		if (props.stats?.photoUrl) return props.stats.photoUrl;
		return '';
	});

	const info = createMemo(() => getLevelInfo(props.stats?.xp || 0));

	return (
		<div class="relative w-full flex flex-col items-center px-4 z-20 mt-2">
			
			{/* Premium Cover Banner */}
			<div class="absolute top-0 inset-x-4 h-24 bg-[#15161d] rounded-2xl overflow-hidden border border-[#2a2a2a]/60 shadow-lg -z-10">
				{/* Abstract geometric shapes or gradients for the cover */}
				<div class="absolute -right-10 -top-10 w-40 h-40 bg-[#d4af37]/20 rounded-full blur-2xl" />
				<div class="absolute -left-10 -bottom-10 w-32 h-32 bg-[#3390ec]/20 rounded-full blur-2xl" />
				<div class="absolute inset-0 bg-gradient-to-t from-[#0f1014] to-transparent opacity-60" />
			</div>

			{/* Simple Avatar (Overlapping banner) */}
			<div class="relative mt-8 mb-4">
				<div class="w-24 h-24 rounded-full border-[1.5px] border-[#2a2a2a] bg-[#0f1014] p-1 z-10 overflow-hidden flex items-center justify-center mx-auto shadow-[0_0_20px_rgba(0,0,0,0.5)]">
					<Show
						when={avatarUrl()}
						fallback={
							<div class="w-full h-full rounded-full flex items-center justify-center bg-[#1c1c1c] text-white/50 font-light text-3xl">
								{user()?.first_name ? user()?.first_name[0].toUpperCase() : 'U'}
							</div>
						}
					>
						<img
							src={avatarUrl()}
							alt="Avatar"
							class="w-full h-full rounded-full object-cover"
							loading="lazy"
						/>
					</Show>
				</div>
			</div>

			{/* User Info */}
			<div class="flex flex-col items-center w-full text-center z-10 px-2">
				<h1 class="text-white text-[22px] font-black leading-tight w-full break-words mb-2">
					{user()?.first_name} {user()?.last_name}
				</h1>
				
				<div class="flex items-center justify-center flex-wrap gap-2 mb-6">
					<span class="text-[#d4af37] text-[10px] font-black uppercase tracking-[0.15em] bg-[#d4af37]/10 px-2.5 py-1 rounded-lg">
						{t('profile.level') || 'Lv.'} {info().current.level} • {info().current.title}
					</span>
					<Show when={props.stats?.globalRank}>
						<span class="text-[#a0a4ad] text-[10px] font-bold tracking-widest bg-[#1c1c1c] px-2.5 py-1 rounded-lg border border-[#2a2a2a]">
							{t('profile.rank') || 'RANK'} #{props.stats?.globalRank?.toLocaleString()}
						</span>
					</Show>
				</div>
			</div>

		</div>
	);
};

import { initData } from '@tma.js/sdk-solid';
import { createMemo, createSignal, Show } from 'solid-js';
import { getLevelInfo, type ProfileStats } from '@/shared/store/profile.js';
import { t } from '@/shared/i18n/index.js';

interface Props {
	stats: ProfileStats | null;
}

export const IdentityHero = (props: Props) => {
	const user = () => initData.user();
	const [imgError, setImgError] = createSignal(false);
	
	const avatarUrl = createMemo(() => {
		if (imgError()) return '';
		if ((user() as any)?.photo_url) return (user() as any).photo_url;
		if (props.stats?.photoUrl) return props.stats.photoUrl;
		return '';
	});

	const info = createMemo(() => getLevelInfo(props.stats?.xp || 0));

	return (
		<div class="relative w-full flex flex-col items-center px-4 z-20 mt-4">
			
			{/* Cyber-Glass Cover Banner */}
			<div class="absolute top-0 inset-x-4 h-28 bg-[#0a0a0f]/80 backdrop-blur-xl rounded-[32px] overflow-hidden border border-white/5 shadow-[0_8px_32px_rgba(0,0,0,0.5)] -z-10">
				{/* Dynamic Glowing Orbs */}
				<div class="absolute -right-12 -top-12 w-48 h-48 bg-[#9d4edd]/30 rounded-full blur-[40px] mix-blend-screen animate-pulse" style="animation-duration: 4s;" />
				<div class="absolute -left-12 -bottom-12 w-48 h-48 bg-[#00f5ff]/20 rounded-full blur-[40px] mix-blend-screen animate-pulse" style="animation-duration: 5s;" />
				<div class="absolute inset-0 bg-gradient-to-b from-transparent via-[#050508]/40 to-[#050508]" />
			</div>

			{/* Premium Avatar Container */}
			<div class="relative mt-6 mb-5">
				{/* Glowing outer ring */}
				<div class="absolute -inset-1 bg-gradient-to-r from-[#00f5ff] to-[#9d4edd] rounded-full blur opacity-40" />
				
				<div class="relative w-[104px] h-[104px] rounded-full p-[2px] bg-gradient-to-br from-white/20 to-white/5 shadow-2xl">
					<div class="w-full h-full rounded-full bg-[#050508] overflow-hidden flex items-center justify-center relative">
						<Show
							when={avatarUrl()}
							fallback={
								<div class="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#1a1a24] to-[#0a0a0f]">
									<span class="text-4xl font-black bg-clip-text text-transparent bg-gradient-to-br from-[#00f5ff] to-[#9d4edd]">
										{user()?.first_name ? user()?.first_name[0].toUpperCase() : 'U'}
									</span>
								</div>
							}
						>
							<img
								src={avatarUrl()}
								alt="Avatar"
								class="w-full h-full object-cover transition-opacity duration-300"
								loading="lazy"
								onError={() => setImgError(true)}
							/>
						</Show>
					</div>
				</div>
				
				{/* Status indicator (optional pulse) */}
				<div class="absolute bottom-1 right-1 w-5 h-5 bg-[#00f5ff] rounded-full border-[3px] border-[#050508] shadow-[0_0_10px_rgba(0,245,255,0.5)]" />
			</div>

			{/* User Info & Badges */}
			<div class="flex flex-col items-center w-full text-center z-10 px-2">
				<h1 class="text-[26px] font-black leading-tight w-full break-words mb-3 text-transparent bg-clip-text bg-gradient-to-r from-white via-white/90 to-white/70 drop-shadow-sm">
					{user()?.first_name} {user()?.last_name}
				</h1>
				
				<div class="flex items-center justify-center flex-wrap gap-2.5 mb-6">
					{/* Level Badge */}
					<div class="relative group">
						<div class="absolute inset-0 bg-gradient-to-r from-[#9d4edd] to-[#00f5ff] rounded-xl blur opacity-30 group-hover:opacity-60 transition-opacity" />
						<div class="relative flex items-center gap-1.5 bg-[#0a0a0f]/90 border border-white/10 px-3 py-1.5 rounded-xl backdrop-blur-md">
							<span class="material-symbols-outlined text-[14px] text-[#00f5ff]" style="font-variation-settings: 'FILL' 1;">star</span>
							<span class="text-white text-[11px] font-black uppercase tracking-[0.1em]">
								{t('profile.level') || 'Lv.'} {info().current.level} <span class="text-white/40 mx-0.5">•</span> {info().current.title}
							</span>
						</div>
					</div>

					{/* Rank Badge */}
					<Show when={props.stats?.globalRank}>
						<div class="flex items-center gap-1.5 bg-white/5 border border-white/10 px-3 py-1.5 rounded-xl backdrop-blur-md">
							<span class="material-symbols-outlined text-[14px] text-[#a0a4ad]">public</span>
							<span class="text-[#a0a4ad] text-[11px] font-bold tracking-widest">
								{t('profile.rank') || 'RANK'} <span class="text-white">#{props.stats?.globalRank?.toLocaleString()}</span>
							</span>
						</div>
					</Show>
				</div>
			</div>

		</div>
	);
};

import { initData } from '@tma.js/sdk-solid';
import { createMemo, Show } from 'solid-js';
import { getLevelInfo, type ProfileStats } from '@/shared/store/profile.js';

interface Props {
	stats: ProfileStats | null;
}

export const IdentityHero = (props: Props) => {
	const user = () => initData.user();
	
	const avatarUrl = createMemo(() => {
		if (props.stats?.photoUrl) return props.stats.photoUrl;
		return '';
	});

	const info = createMemo(() => getLevelInfo(props.stats?.xp || 0));

	return (
		<div class="bg-gradient-to-br from-[#1c1c1c] to-[#15161d] border border-[#2a2a2a] rounded-[32px] p-6 flex items-center gap-5 shadow-[0_8px_24px_rgba(0,0,0,0.4)] relative overflow-hidden group w-full">
			{/* Subtle Background Glow */}
			<div 
				class="absolute top-0 right-0 w-32 h-32 bg-[#d4af37]/5 rounded-full blur-3xl -z-10"
			/>

			{/* Left: Avatar */}
			<div class="relative w-20 h-20 rounded-full flex-shrink-0 border-2 border-[#2a2a2a] p-1 bg-[#0f1014]">
				<Show
					when={avatarUrl()}
					fallback={
						<div class="w-full h-full rounded-full flex items-center justify-center bg-[#15161d] text-white/50 font-light text-2xl">
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

			{/* Right: Info */}
			<div class="flex flex-col flex-grow min-w-0">
				{/* Name & Title */}
				<div class="flex items-center justify-between gap-3 w-full">
					<div class="flex items-center gap-1.5 truncate min-w-0">
						<h1 class="text-white text-xl font-black tracking-tight truncate">
							{user()?.first_name} {user()?.last_name}
						</h1>
						<Show when={props.stats?.emojiStatus}>
							<span class="text-base opacity-80 flex-shrink-0">{props.stats?.emojiStatus}</span>
						</Show>
					</div>
					
					{/* Small Rank Icon/Text if needed */}
					<Show when={props.stats?.globalRank}>
						<div class="flex items-center gap-1.5 bg-[#d4af37]/10 px-3 py-1 rounded-xl border border-[#d4af37]/20 flex-shrink-0">
							<span
								class="material-symbols-outlined text-[14px] text-[#d4af37]"
								style={{ 'font-variation-settings': '"FILL" 1' }}
							>
								emoji_events
							</span>
							<span class="text-[#d4af37] text-[11px] font-bold">
								#{props.stats?.globalRank?.toLocaleString()}
							</span>
						</div>
					</Show>
				</div>

				<span class="text-xs text-[#a0a4ad] font-bold uppercase tracking-wider mb-3 mt-1">
					{info().current.title}
				</span>

				{/* Level & Progress */}
				<div class="flex items-center gap-3 w-full">
					<span class="text-white font-black text-sm min-w-[36px]">
						Lv.{info().current.level}
					</span>
					<div class="flex-grow h-1.5 bg-[#0f1014] rounded-full overflow-hidden border border-[#2a2a2a]/50 relative">
						<div
							class="h-full rounded-full transition-all duration-1000 ease-out"
							style={{ 
								width: `${info().progress}%`,
								background: 'linear-gradient(90deg, #4a4a4a, #d4af37)'
							}}
						/>
					</div>
					<span class="text-[10px] text-[#a0a4ad] font-medium min-w-[24px] text-right">
						{info().progress}%
					</span>
				</div>
			</div>
		</div>
	);
};

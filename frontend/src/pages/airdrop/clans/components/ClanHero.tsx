import { Component, Show } from 'solid-js';
import { useUserClan } from '@/shared/store/clans.js';

export const ClanHero: Component = () => {
	const userClan = useUserClan();

	return (
		<div class="relative w-full pt-12 pb-8 flex flex-col items-center justify-center overflow-hidden">
			{/* Fragment Cyan Glowing Orb Background */}
			<div class="absolute inset-0 flex justify-center items-center pointer-events-none opacity-50">
				<div class="w-[300px] h-[300px] bg-[#0088cc] rounded-full filter blur-[100px] mix-blend-screen opacity-40 animate-pulse"></div>
			</div>

			<div class="relative z-10 text-center px-6">
				<h1 class="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-b from-white to-[#a0a4ad] tracking-tighter leading-tight drop-shadow-2xl">
					CLAN WARS
				</h1>
				
				<Show 
					when={userClan.data?.is_member && userClan.data.clan}
					fallback={
						<p class="mt-4 text-[#8e8e93] text-sm font-medium tracking-wide max-w-xs mx-auto">
							Join a clan to compete for massive rewards.
						</p>
					}
				>
					{(clan) => (
						<div class="mt-6 inline-flex flex-col items-center p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xl shadow-2xl">
							<div class="text-xs font-bold text-[#0088cc] uppercase tracking-widest mb-1">Your Clan</div>
							<div class="text-2xl font-bold text-white">{clan().chat_title}</div>
							<div class="text-[#8e8e93] text-sm mt-1">{clan().channel_username}</div>
						</div>
					)}
				</Show>
			</div>
		</div>
	);
};

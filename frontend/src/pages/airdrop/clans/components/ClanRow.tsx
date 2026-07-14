import { Component } from 'solid-js';
import type { Clan } from '@/shared/api/profile.js';
import { openClanModal, useUserClan } from '@/shared/store/clans.js';

interface ClanRowProps {
	clan: Clan;
	rank: number;
}

export const ClanRow: Component<ClanRowProps> = (props) => {
	const userClan = useUserClan();

	const isMyClan = () => userClan.data?.is_member && userClan.data.clan?.id === props.clan.id;

	const formatScore = (score: number = 0) => {
		if (score >= 1000000) return (score / 1000000).toFixed(1) + 'M';
		if (score >= 1000) return (score / 1000).toFixed(1) + 'K';
		return score.toString();
	};

	return (
		<div class={`relative group flex items-center p-4 rounded-2xl mb-2 backdrop-blur-md border transition-all duration-300 hover:scale-[1.02] ${
			isMyClan() 
				? 'bg-[#0088cc]/10 border-[#0088cc]/50 shadow-[0_0_15px_rgba(0,136,204,0.15)]' 
				: 'bg-white/5 border-white/5 hover:bg-white/10'
		}`}>
			{/* Rank */}
			<div class="w-10 flex-shrink-0 text-center">
				<span class={`text-lg font-black ${
					props.rank === 1 ? 'text-yellow-400 drop-shadow-[0_0_10px_rgba(250,204,21,0.8)]' :
					props.rank === 2 ? 'text-gray-300' :
					props.rank === 3 ? 'text-amber-600' :
					'text-[#8e8e93]'
				}`}>
					#{props.rank}
				</span>
			</div>

			{/* Avatar */}
			<div class="w-12 h-12 rounded-full overflow-hidden bg-[#2a2a2a] mx-3 border border-white/10 flex-shrink-0">
				{props.clan.channel_photo ? (
					<img src={props.clan.channel_photo} alt={props.clan.chat_title} class="w-full h-full object-cover" />
				) : (
					<div class="w-full h-full flex items-center justify-center text-xl font-bold text-white bg-gradient-to-br from-[#0088cc] to-[#1b0a3a]">
						{props.clan.chat_title.charAt(0).toUpperCase()}
					</div>
				)}
			</div>

			{/* Details */}
			<div class="flex-grow min-w-0">
				<h3 class="text-white font-bold truncate text-base">{props.clan.chat_title}</h3>
				<div class="flex items-center text-xs text-[#a0a4ad] mt-0.5">
					<span class="material-symbols-outlined text-[14px] mr-1">group</span>
					{props.clan.members_count.toLocaleString()} members
				</div>
			</div>

			{/* Score & Action */}
			<div class="flex flex-col items-end flex-shrink-0 ml-3">
				<div class="text-[#0088cc] font-black tabular-nums">
					{formatScore(props.clan.total_score)}
				</div>
				<button 
					onClick={() => openClanModal(props.clan.channel_username, props.clan.chat_title)}
					class={`mt-1 px-3 py-1 text-xs font-bold rounded-full transition-all active:scale-95 ${
						isMyClan() 
							? 'bg-red-500/20 text-red-400 hover:bg-red-500/30' 
							: 'bg-white/10 text-white hover:bg-white/20'
					}`}
				>
					{isMyClan() ? 'Leave' : 'Join'}
				</button>
			</div>
		</div>
	);
};

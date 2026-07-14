import { Component, onMount } from 'solid-js';
import { ClanHero } from './components/ClanHero.js';
import { ClanLeaderboard } from './components/ClanLeaderboard.js';
import { ClanActionModal } from './components/ClanActionModal.js';
import { useUserClan, useGlobalClans } from '@/shared/store/clans.js';

const ClansPage: Component = () => {
	const userClan = useUserClan();
	const globalClans = useGlobalClans();

	onMount(() => {
		// Prefetch or refresh if needed
		userClan.refetch();
		globalClans.refetch();
	});

	return (
		<div class="min-h-screen bg-cosmic-void text-white font-app selection:bg-[#0088cc] selection:text-white pb-safe overflow-x-hidden relative">
			{/* Top Navbar / Back Button */}
			<div class="fixed top-0 left-0 w-full p-4 z-40 flex items-center bg-gradient-to-b from-black/80 to-transparent">
				<button 
					onClick={() => history.back()}
					class="w-10 h-10 flex items-center justify-center rounded-full bg-white/10 backdrop-blur-md border border-white/10 text-white hover:bg-white/20 transition-all active:scale-90"
				>
					<span class="material-symbols-outlined">arrow_back</span>
				</button>
			</div>

			<ClanHero />
			<ClanLeaderboard />
			<ClanActionModal />
		</div>
	);
};

export default ClansPage;

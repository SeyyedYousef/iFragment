import { Component, Show } from 'solid-js';
import { 
	isClanModalOpen, 
	selectedClanForAction, 
	closeClanModal, 
	useJoinClanMutation, 
	useLeaveClanMutation,
	useUserClan
} from '@/shared/store/clans.js';

export const ClanActionModal: Component = () => {
	const userClan = useUserClan();
	const joinMutation = useJoinClanMutation();
	const leaveMutation = useLeaveClanMutation();

	const handleAction = async () => {
		const target = selectedClanForAction();
		if (!target) return;

		// If user is already in a clan and this is the leave action
		if (userClan.data?.is_member && userClan.data.clan?.channel_username === target.username) {
			await leaveMutation.mutateAsync(undefined);
		} else {
			await joinMutation.mutateAsync(target.username);
		}
		closeClanModal();
	};

	return (
		<Show when={isClanModalOpen() && selectedClanForAction()}>
			{(target) => {
				const isCurrentClan = userClan.data?.is_member && userClan.data.clan?.channel_username === target().username;
				const isPending = joinMutation.isPending || leaveMutation.isPending;

				return (
					<div class="fixed inset-0 z-50 flex items-center justify-center px-4 animate-fade-in">
						<div class="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={closeClanModal}></div>
						
						<div class="relative w-full max-w-sm bg-[#1c1c1c]/90 backdrop-blur-xl border border-white/10 rounded-3xl p-6 shadow-2xl animate-slide-up transform transition-all">
							<div class="text-center mb-6">
								<h3 class="text-xl font-bold text-white mb-2">
									{isCurrentClan ? 'Leave Clan?' : 'Join Clan'}
								</h3>
								<p class="text-sm text-[#a0a4ad]">
									{isCurrentClan 
										? `Are you sure you want to leave ${target().name}? You might lose some clan benefits.`
										: `You are about to join ${target().name}.`}
								</p>
							</div>

							<div class="flex flex-col gap-3">
								<button
									disabled={isPending}
									onClick={handleAction}
									class={`w-full py-4 rounded-xl font-bold text-white transition-all active:scale-95 ${
										isCurrentClan 
											? 'bg-red-500/20 text-red-500 hover:bg-red-500/30' 
											: 'bg-[#0088cc] hover:bg-[#0088cc]/90 shadow-[0_0_15px_rgba(0,136,204,0.4)]'
									} ${isPending ? 'opacity-50 cursor-not-allowed' : ''}`}
								>
									{isPending ? 'Processing...' : (isCurrentClan ? 'Leave' : 'Confirm Join')}
								</button>
								<button
									onClick={closeClanModal}
									class="w-full py-4 rounded-xl font-bold text-white bg-white/5 hover:bg-white/10 transition-all active:scale-95"
								>
									Cancel
								</button>
							</div>
						</div>
					</div>
				);
			}}
		</Show>
	);
};

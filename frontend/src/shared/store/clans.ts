import { createSignal } from 'solid-js';
import { createQuery, createMutation, useQueryClient } from '@tanstack/solid-query';
import { getTopClans, joinClan, leaveClan, getClan } from '@/shared/api/profile.js';

// Global state for Clan Modal
export const [isClanModalOpen, setIsClanModalOpen] = createSignal(false);
export const [selectedClanForAction, setSelectedClanForAction] = createSignal<{ username: string; name: string } | null>(null);

export const openClanModal = (username: string, name: string) => {
	setSelectedClanForAction({ username, name });
	setIsClanModalOpen(true);
};

export const closeClanModal = () => {
	setIsClanModalOpen(false);
	setSelectedClanForAction(null);
};

// TanStack Queries
export const useGlobalClans = () => {
	return createQuery(() => ({
		queryKey: ['clans', 'global'],
		queryFn: getTopClans,
		staleTime: 60 * 1000, // 1 minute
	}));
};

export const useUserClan = () => {
	return createQuery(() => ({
		queryKey: ['clans', 'user'],
		queryFn: getClan,
		staleTime: 60 * 1000,
	}));
};

// Mutations
export const useJoinClanMutation = () => {
	const queryClient = useQueryClient();
	return createMutation(() => ({
		mutationFn: (username: string) => joinClan(username),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['clans', 'user'] });
			queryClient.invalidateQueries({ queryKey: ['profile', 'stats'] }); 
		},
	}));
};

export const useLeaveClanMutation = () => {
	const queryClient = useQueryClient();
	return createMutation(() => ({
		mutationFn: leaveClan,
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['clans', 'user'] });
		},
	}));
};

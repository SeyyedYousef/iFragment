import { createQuery, createMutation, useQueryClient } from '@tanstack/solid-query';
import { channelApi } from './channel-management.js';

// Query Key Hierarchy for optimal caching and automatic invalidations
export const channelKeys = {
  all: ['channels'] as const,
  lists: () => [...channelKeys.all, 'list'] as const,
  list: (botId: string) => [...channelKeys.lists(), { botId }] as const,
  details: () => [...channelKeys.all, 'detail'] as const,
  detail: (id: string) => [...channelKeys.details(), id] as const,
  settings: (id: string) => [...channelKeys.detail(id), 'settings'] as const,
  analytics: (id: string, days: number) => [...channelKeys.detail(id), 'analytics', { days }] as const,
  admins: (id: string) => [...channelKeys.detail(id), 'admins'] as const,
  buttons: (id: string) => [...channelKeys.detail(id), 'buttons'] as const,
};

// Hook for fetching a channel settings resource
export function useChannelSettings(channelId: () => string) {
  return createQuery(() => ({
    queryKey: channelKeys.settings(channelId()),
    queryFn: () => channelApi.getSettings(channelId()),
    staleTime: 5 * 60 * 1000, // Keep data fresh on client for 5 minutes
    retry: 2,
    refetchOnWindowFocus: false,
  }));
}

// Mutation for updating settings with precise cache key invalidation
export function useUpdateChannelSettings(channelId: () => string) {
  const queryClient = useQueryClient();

  return createMutation(() => ({
    mutationFn: (variables: { category: string; data: any; version: number }) =>
      channelApi.updateSettings(channelId(), variables.category, variables.data, variables.version),
    onSuccess: () => {
      // Invalidate target settings category query key to trigger background sync
      queryClient.invalidateQueries({ queryKey: channelKeys.settings(channelId()) });
    },
  }));
}

// Hook for fetching inline buttons
export function useChannelButtons(channelId: () => string) {
  return createQuery(() => ({
    queryKey: channelKeys.buttons(channelId()),
    queryFn: () => channelApi.getButtons(channelId()),
    staleTime: 10 * 60 * 1000,
    retry: 2,
  }));
}

// Mutation for updating buttons
export function useSaveChannelButtons(channelId: () => string) {
  const queryClient = useQueryClient();

  return createMutation(() => ({
    mutationFn: (buttons: any[]) => channelApi.saveButtons(channelId(), buttons),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: channelKeys.buttons(channelId()) });
    },
  }));
}

import { Component, createResource, Show } from 'solid-js';
import { channelApi, type ManagedChannel } from '@/shared/api/channel-management.js';

interface ChannelContextBarProps {
	channelId: string;
	compact?: boolean;
}

const formatCount = (value?: number) => {
	const count = value || 0;
	if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
	if (count >= 1_000) return `${(count / 1_000).toFixed(1)}k`;
	return count.toLocaleString();
};

const channelLabel = (channel?: ManagedChannel) => {
	if (!channel) return '';
	return channel.chat_title || `Channel ${channel.chat_id}`;
};

export const ChannelContextBar: Component<ChannelContextBarProps> = (props) => {
	const [channel] = createResource(
		() => props.channelId,
		(id) => channelApi.getChannel(id),
	);

	return (
		<div
			class={`rounded-2xl border border-[#2a2a2a] bg-[#16171b] flex items-center gap-3 ${
				props.compact ? 'px-3 py-2' : 'px-4 py-3'
			}`}
		>
			<div class="w-10 h-10 rounded-xl bg-[#23252c] border border-[#30323a] flex items-center justify-center shrink-0 text-[#32ade6] font-black">
				<Show when={!channel.loading} fallback={<span class="w-5 h-5 border-2 border-[#32ade6]/25 border-t-[#32ade6] rounded-full animate-spin" />}>
					{channelLabel(channel())?.charAt(0)?.toUpperCase() || 'C'}
				</Show>
			</div>
			<div class="flex flex-col min-w-0 flex-1">
				<span class="text-[12px] font-bold uppercase tracking-wide text-[#8e8e93]">
					Current channel
				</span>
				<span class="text-[14px] font-black text-white truncate">
					{channel.loading ? 'Loading channel...' : channelLabel(channel())}
				</span>
				<Show when={!channel.loading && channel()}>
					<span class="text-[11px] text-[#8e8e93] truncate" dir="ltr">
						ID {channel()?.chat_id} · {formatCount(channel()?.subscribers_count)} subscribers
					</span>
				</Show>
			</div>
			<Show when={!channel.loading && channel()?.subscription_status}>
				<span
					class={`text-[10px] font-black uppercase px-2 py-1 rounded-lg border shrink-0 ${
						channel()?.subscription_status === 'paid'
							? 'bg-[#34c759]/10 border-[#34c759]/25 text-[#34c759]'
							: 'bg-[#ff9f0a]/10 border-[#ff9f0a]/25 text-[#ff9f0a]'
					}`}
				>
					{channel()?.subscription_status}
				</span>
			</Show>
		</div>
	);
};

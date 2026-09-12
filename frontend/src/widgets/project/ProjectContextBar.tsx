import { type Component, createResource, Show } from 'solid-js';
import { channelApi } from '@/entities/channel/index.js';
import { t } from '@/shared/i18n/index.js';

interface ProjectContextBarProps {
	projectId: string;
	compact?: boolean;
}

export const ProjectContextBar: Component<ProjectContextBarProps> = (props) => {
	const [project] = createResource(
		() => props.projectId,
		(id) => channelApi.getProject(id),
	);

	const isPaid = () => project()?.stars_subscription_active;
	const isTrial = () => !isPaid() && project()?.status === 'active' && project()?.trial_ends_at;

	const isSingleChannel = () => {
		const p = project();
		if (!p) return false;
		const cfg = p.pipeline_config as any;
		if (cfg?.single_channel_mode) return true;
		const hasSource = !!(p.source_title || p.source_username || p.source_chat_id);
		const hasTarget = !!(p.target_title || p.target_username || p.target_chat_id);
		return (hasSource && !hasTarget) || (!hasSource && hasTarget);
	};

	const singleChannelName = () => {
		const p = project();
		if (!p) return '';
		return (
			p.source_title ||
			p.source_username ||
			p.target_title ||
			p.target_username ||
			(p.pipeline_config as any)?.source_channel_identifier ||
			(p.pipeline_config as any)?.target_channel_identifier ||
			''
		);
	};

	return (
		<div
			class={`rounded-[22px] border border-white/10 bg-gradient-to-r from-[#141722]/95 to-[#0e1017]/95 backdrop-blur-xl flex items-center justify-between gap-3 shadow-md ${
				props.compact ? 'px-3.5 py-2.5' : 'px-4 py-3.5'
			}`}
		>
			<div class="flex items-center gap-3 min-w-0 flex-1">
				<div class="w-10 h-10 rounded-[14px] bg-[#3390ec]/15 border border-[#3390ec]/30 flex items-center justify-center text-[#3390ec] font-black shrink-0">
					<Show
						when={!project.loading}
						fallback={<span class="w-4 h-4 border-2 border-[#3390ec]/25 border-t-[#3390ec] rounded-full animate-spin" />}
					>
						<span class="material-symbols-outlined text-[20px]">hub</span>
					</Show>
				</div>
				<div class="flex flex-col min-w-0">
					<span class="text-[14px] font-black text-white truncate">
						{project.loading
							? t('channelProjects.context.loading')
							: project()?.name || t('channelProjects.context.defaultName')}
					</span>
					<Show when={!project.loading && project()}>
						<Show
							when={!isSingleChannel()}
							fallback={
								<div class="flex items-center gap-1.5 text-[10px] text-white/50 font-mono truncate" dir="ltr">
									<span class="px-1.5 py-0.2 rounded-[6px] bg-[#3390ec]/15 text-[#3390ec] font-bold text-[9px]">
										{t('channelProjects.context.singleChannel')}
									</span>
									<span class="text-white/80 font-bold truncate">
										{singleChannelName()}
									</span>
								</div>
							}
						>
							<div class="flex items-center gap-1.5 text-[10px] text-white/50 font-mono truncate" dir="ltr">
								<span class="text-[#3390ec] font-bold truncate">
									{project()?.source_title || project()?.source_username || project()?.source_chat_id || 'Source'}
								</span>
								<span>➔</span>
								<span class="text-emerald-400 font-bold truncate">
									{project()?.target_title || project()?.target_username || project()?.target_chat_id || 'Target'}
								</span>
							</div>
						</Show>
					</Show>
				</div>
			</div>

			<Show when={!project.loading && project()}>
				<div class="flex items-center gap-1.5 shrink-0">
					<span
						class={`text-[10px] font-black px-2.5 py-0.5 rounded-full border ${
							isPaid()
								? 'text-emerald-400 border-emerald-500/30 bg-emerald-500/15'
								: isTrial()
									? 'text-amber-400 border-amber-400/30 bg-amber-400/15'
									: 'text-rose-400 border-rose-500/30 bg-rose-500/15'
						}`}
					>
						{isPaid()
							? t('channelProjects.context.premium')
							: isTrial()
								? t('channelProjects.context.trial')
								: t('channelProjects.context.expired')}
					</span>
				</div>
			</Show>
		</div>
	);
};

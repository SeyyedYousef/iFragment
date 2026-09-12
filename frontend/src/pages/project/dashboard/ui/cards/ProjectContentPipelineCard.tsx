import { Motion } from '@motionone/solid';
import { type Component } from 'solid-js';
import { t } from '@/shared/i18n/index.js';
import { haptic } from '@/shared/lib/haptic.js';

interface ProjectContentPipelineCardProps {
	projectId: string;
	isAutoPublish: boolean;
	sourceName?: string;
	targetName?: string;
	onToggleAutoPublish: (auto: boolean) => void;
	onNavigate: () => void;
}

export const ProjectContentPipelineCard: Component<ProjectContentPipelineCardProps> = (props) => {
	return (
		<div class="bg-[#12141C]/85 backdrop-blur-xl border border-white/10 hover:border-[#3390ec]/40 rounded-[26px] p-5 flex flex-col gap-4 shadow-lg relative overflow-hidden transition-all duration-300 group">
			{/* Ambient Glow */}
			<div class="absolute -right-10 -top-10 w-36 h-36 bg-[#3390ec]/15 blur-3xl rounded-full pointer-events-none" />

			{/* Header & Controls */}
			<div class="flex items-start justify-between gap-3 relative z-10">
				<div class="flex items-center gap-3 min-w-0">
					<div
						class={`w-11 h-11 rounded-[14px] flex items-center justify-center shrink-0 border transition-all ${
							props.isAutoPublish
								? 'bg-[#3390ec]/20 border-[#3390ec]/40 text-[#3390ec] shadow-[0_0_15px_rgba(51,144,236,0.3)]'
								: 'bg-white/5 border-white/10 text-white/50'
						}`}
					>
						<span class="material-symbols-outlined text-[24px]">tune</span>
					</div>
					<div class="flex flex-col min-w-0">
						<div class="flex items-center gap-2 flex-wrap">
							<h3 class="text-[15px] font-black text-white group-hover:text-[#3390ec] transition-colors">
								{t('channelProjects.dashboard.featurePipeline')}
							</h3>
							<span
								class={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${
									props.isAutoPublish
										? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
										: 'bg-amber-500/15 text-amber-400 border-amber-500/30'
								}`}
							>
								{props.isAutoPublish
									? t('channelProjects.dashboard.pipelineAutoOn')
									: t('channelProjects.dashboard.pipelineAutoOff')}
							</span>
						</div>
						<p class="text-[11px] text-white/50 leading-relaxed font-medium mt-0.5 line-clamp-1">
							{t('channelProjects.dashboard.featurePipelineDesc')}
						</p>
					</div>
				</div>

				{/* Auto Publish Switch */}
				<button
					type="button"
					role="switch"
					aria-checked={props.isAutoPublish}
					onClick={(e) => {
						e.stopPropagation();
						haptic.impact('medium');
						props.onToggleAutoPublish(!props.isAutoPublish);
					}}
					class={`w-12 h-7 rounded-full p-0.5 transition-colors duration-300 flex items-center border ${
						props.isAutoPublish
							? 'bg-[#3390ec]/30 border-[#3390ec]/60 justify-end'
							: 'bg-white/10 border-white/15 justify-start'
					}`}
				>
					<span
						class={`w-5 h-5 rounded-full transition-transform duration-300 shadow-md ${
							props.isAutoPublish
								? 'bg-[#3390ec] shadow-[0_0_10px_rgba(51,144,236,0.6)]'
								: 'bg-white/40'
						}`}
					/>
				</button>
			</div>

			{/* ═══════ ANIMATED PIPELINE FLOW VISUALIZER ═══════ */}
			<div class="bg-[#080A10] rounded-[20px] border border-white/5 p-3.5 flex flex-col gap-2.5 shadow-inner relative overflow-hidden">
				<div class="flex items-center justify-between text-[10px] font-mono">
					<div class="flex items-center gap-1.5 text-[#3390ec] font-bold">
						<span class="w-2 h-2 rounded-full bg-[#3390ec] animate-pulse" />
						<span>{t('channelProjects.dashboard.liveDemo')}</span>
					</div>
					<span class="text-white/40">{t('channelProjects.dashboard.pipelineFlowFilters')}</span>
				</div>

				{/* Flow Diagram */}
				<div class="bg-white/5 border border-white/10 rounded-[14px] p-3 flex items-center justify-between gap-2 relative">
					{/* Source Node */}
					<div class="flex flex-col items-center gap-1 min-w-[70px]">
						<div class="w-8 h-8 rounded-full bg-[#3390ec]/20 border border-[#3390ec]/40 flex items-center justify-center text-[#3390ec]">
							<span class="material-symbols-outlined text-[16px]">arrow_downward</span>
						</div>
						<span class="text-[9px] font-bold text-white/70 truncate max-w-[80px]">
							{props.sourceName || t('channelProjects.dashboard.pipelineFlowInput')}
						</span>
					</div>

					{/* Connecting Line with Flowing Particle */}
					<div class="flex-1 h-0.5 bg-gradient-to-r from-[#3390ec]/40 via-cyan-400/60 to-emerald-400/40 relative mx-2 rounded-full overflow-hidden">
						<Motion.div
							initial={{ x: '-100%' }}
							animate={{ x: '100%' }}
							transition={{ repeat: Infinity, duration: 1.6, easing: 'linear' }}
							class="w-8 h-full bg-gradient-to-r from-transparent via-cyan-300 to-transparent"
						/>
					</div>

					{/* Middle Filter Shield */}
					<div class="w-7 h-7 rounded-full bg-white/10 border border-white/15 flex items-center justify-center text-white/70 shrink-0 shadow-sm" title={t('channelProjects.dashboard.pipelineFlowFilters')}>
						<span class="material-symbols-outlined text-[14px] text-cyan-400">clean_hands</span>
					</div>

					{/* Connecting Line 2 */}
					<div class="flex-1 h-0.5 bg-gradient-to-r from-cyan-400/60 via-emerald-400/60 to-emerald-400/40 relative mx-2 rounded-full overflow-hidden">
						<Motion.div
							initial={{ x: '-100%' }}
							animate={{ x: '100%' }}
							transition={{ repeat: Infinity, duration: 1.6, delay: 0.8, easing: 'linear' }}
							class="w-8 h-full bg-gradient-to-r from-transparent via-emerald-300 to-transparent"
						/>
					</div>

					{/* Target Node */}
					<div class="flex flex-col items-center gap-1 min-w-[70px]">
						<div class="w-8 h-8 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
							<span class="material-symbols-outlined text-[16px]">arrow_upward</span>
						</div>
						<span class="text-[9px] font-bold text-white/70 truncate max-w-[80px]">
							{props.targetName || t('channelProjects.dashboard.pipelineFlowTarget')}
						</span>
					</div>
				</div>
			</div>

			{/* Studio Action Button */}
			<button
				type="button"
				onClick={props.onNavigate}
				class="w-full h-11 bg-[#3390ec]/10 hover:bg-[#3390ec]/20 border border-[#3390ec]/30 text-[#3390ec] rounded-[16px] text-[12px] font-black uppercase tracking-wider flex items-center justify-center gap-2 active:scale-95 transition-all shadow-sm"
			>
				<span>{t('channelProjects.dashboard.openSettings')}</span>
				<span class="material-symbols-outlined text-[18px] rtl:-scale-x-100">arrow_forward</span>
			</button>
		</div>
	);
};

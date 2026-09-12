import { Motion } from '@motionone/solid';
import { type Component, createSignal, Show } from 'solid-js';
import { t } from '@/shared/i18n/index.js';
import { haptic } from '@/shared/lib/haptic.js';

interface ProjectSmartPostingCardProps {
	projectId: string;
	isActive: boolean;
	aiModel?: string;
	onToggleActive: (active: boolean) => void;
	onNavigate: () => void;
}

export const ProjectSmartPostingCard: Component<ProjectSmartPostingCardProps> = (props) => {
	const [activeTab, setActiveTab] = createSignal<'raw' | 'ai'>('ai');

	return (
		<div class="bg-[#12141C]/85 backdrop-blur-xl border border-white/10 hover:border-emerald-500/40 rounded-[26px] p-5 flex flex-col gap-4 shadow-lg relative overflow-hidden transition-all duration-300 group">
			{/* Ambient Glow */}
			<div class="absolute -left-10 -bottom-10 w-36 h-36 bg-emerald-500/15 blur-3xl rounded-full pointer-events-none" />

			{/* Header & Controls */}
			<div class="flex items-start justify-between gap-3 relative z-10">
				<div class="flex items-center gap-3 min-w-0">
					<div
						class={`w-11 h-11 rounded-[14px] flex items-center justify-center shrink-0 border transition-all ${
							props.isActive
								? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300 shadow-[0_0_15px_rgba(16,185,129,0.3)]'
								: 'bg-white/5 border-white/10 text-white/50'
						}`}
					>
						<span class="material-symbols-outlined text-[24px]">psychology</span>
					</div>
					<div class="flex flex-col min-w-0">
						<div class="flex items-center gap-2 flex-wrap">
							<h3 class="text-[15px] font-black text-white group-hover:text-emerald-300 transition-colors">
								{t('channelProjects.dashboard.featureAi')}
							</h3>
							<span class="text-[9px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
								{props.aiModel || 'Gemini 3.8 Flash'}
							</span>
						</div>
						<p class="text-[11px] text-white/50 leading-relaxed font-medium mt-0.5 line-clamp-1">
							{t('channelProjects.dashboard.featureAiDesc')}
						</p>
					</div>
				</div>

				{/* Power Toggle */}
				<button
					type="button"
					role="switch"
					aria-checked={props.isActive}
					onClick={(e) => {
						e.stopPropagation();
						haptic.impact('medium');
						props.onToggleActive(!props.isActive);
					}}
					class={`w-12 h-7 rounded-full p-0.5 transition-colors duration-300 flex items-center border ${
						props.isActive
							? 'bg-emerald-500/30 border-emerald-400/60 justify-end'
							: 'bg-white/10 border-white/15 justify-start'
					}`}
				>
					<span
						class={`w-5 h-5 rounded-full transition-transform duration-300 shadow-md ${
							props.isActive
								? 'bg-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.6)]'
								: 'bg-white/40'
						}`}
					/>
				</button>
			</div>

			{/* ═══════ BEFORE / AFTER AI REWRITE SHOWCASE ═══════ */}
			<div class="bg-[#080A10] rounded-[20px] border border-white/5 p-3.5 flex flex-col gap-2.5 shadow-inner relative overflow-hidden">
				<div class="flex items-center justify-between text-[10px] font-mono">
					<div class="flex items-center gap-1.5 text-emerald-400 font-bold">
						<span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
						<span>{t('channelProjects.dashboard.liveDemo')}</span>
					</div>

					{/* Before / After Selector */}
					<div class="flex items-center bg-white/5 p-0.5 rounded-[10px] border border-white/10">
						<button
							type="button"
							onClick={() => {
								haptic.impact('light');
								setActiveTab('raw');
							}}
							class={`px-2 py-0.5 rounded-[8px] text-[9px] font-black transition-all ${
								activeTab() === 'raw'
									? 'bg-white/20 text-white shadow-sm'
									: 'text-white/40 hover:text-white/70'
							}`}
						>
							{t('channelProjects.dashboard.aiRawLabel')}
						</button>
						<button
							type="button"
							onClick={() => {
								haptic.impact('light');
								setActiveTab('ai');
							}}
							class={`px-2 py-0.5 rounded-[8px] text-[9px] font-black transition-all flex items-center gap-1 ${
								activeTab() === 'ai'
									? 'bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 shadow-sm'
									: 'text-white/40 hover:text-white/70'
							}`}
						>
							<span class="material-symbols-outlined text-[11px]">auto_awesome</span>
							<span>{t('channelProjects.dashboard.aiPolishedLabel')}</span>
						</button>
					</div>
				</div>

				<Show
					when={activeTab() === 'ai'}
					fallback={
						<div class="bg-white/5 border border-white/10 rounded-[14px] p-3 text-[11px] text-white/60 font-mono leading-relaxed">
							{t('channelProjects.dashboard.aiRawSample')}
						</div>
					}
				>
					<Motion.div
						initial={{ opacity: 0, y: 4 }}
						animate={{ opacity: 1, y: 0 }}
						class="bg-emerald-500/10 border border-emerald-500/25 rounded-[14px] p-3 text-[11px] text-emerald-100 whitespace-pre-line leading-relaxed font-sans shadow-sm"
					>
						{t('channelProjects.dashboard.aiPolishedSample')}
					</Motion.div>
				</Show>
			</div>

			{/* Studio Action Button */}
			<button
				type="button"
				onClick={props.onNavigate}
				class="w-full h-11 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 rounded-[16px] text-[12px] font-black uppercase tracking-wider flex items-center justify-center gap-2 active:scale-95 transition-all shadow-sm"
			>
				<span>{t('channelProjects.dashboard.openStudio')}</span>
				<span class="material-symbols-outlined text-[18px] rtl:-scale-x-100">arrow_forward</span>
			</button>
		</div>
	);
};

import { Motion } from '@motionone/solid';
import { type Component, createSignal, Show } from 'solid-js';
import { t } from '@/shared/i18n/index.js';
import { haptic } from '@/shared/lib/haptic.js';

interface ProjectInlineButtonsCardProps {
	projectId: string;
	isActive: boolean;
	target: 'input' | 'output' | 'both';
	buttonCount: number;
	isSingleChannel?: boolean;
	onToggleActive: (active: boolean) => void;
	onCycleTarget: (nextTarget: 'input' | 'output' | 'both') => void;
	onNavigate: () => void;
}

export const ProjectInlineButtonsCard: Component<ProjectInlineButtonsCardProps> = (props) => {
	const [activeBtn, setActiveBtn] = createSignal<number | null>(null);
	const [copied, setCopied] = createSignal(false);

	const handleBtnClick = (idx: number) => {
		haptic.impact('medium');
		setActiveBtn(idx);
		if (idx === 2) {
			setCopied(true);
			setTimeout(() => setCopied(false), 1500);
		}
		setTimeout(() => setActiveBtn(null), 400);
	};

	const targetLabel = () => {
		if (props.target === 'input') return t('channelProjects.dashboard.targetInput');
		if (props.target === 'both') return t('channelProjects.dashboard.targetBoth');
		return t('channelProjects.dashboard.targetOutput');
	};

	const targetIcon = () => {
		if (props.target === 'input') return 'arrow_downward';
		if (props.target === 'both') return 'sync';
		return 'arrow_upward';
	};

	return (
		<div class="bg-[#12141C]/85 backdrop-blur-xl border border-white/10 hover:border-amber-500/40 rounded-[26px] p-5 flex flex-col gap-4 shadow-lg relative overflow-hidden transition-all duration-300 group">
			{/* Ambient Top Glow */}
			<div class="absolute -right-10 -bottom-10 w-36 h-36 bg-amber-500/15 blur-3xl rounded-full pointer-events-none" />

			{/* Header & In-Place Controls */}
			<div class="flex items-start justify-between gap-3 relative z-10">
				<div class="flex items-center gap-3 min-w-0">
					<div
						class={`w-11 h-11 rounded-[14px] flex items-center justify-center shrink-0 border transition-all ${
							props.isActive
								? 'bg-amber-500/20 border-amber-500/40 text-amber-300 shadow-[0_0_15px_rgba(245,158,11,0.3)]'
								: 'bg-white/5 border-white/10 text-white/50'
						}`}
					>
						<span class="material-symbols-outlined text-[24px]">smart_button</span>
					</div>
					<div class="flex flex-col min-w-0">
						<div class="flex items-center gap-2 flex-wrap">
							<h3 class="text-[15px] font-black text-white group-hover:text-amber-300 transition-colors">
								{t('channelProjects.dashboard.featureButtons')}
							</h3>
							<Show when={props.buttonCount > 0}>
								<span class="text-[9px] font-mono font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/20">
									{props.buttonCount} {t('channelProjects.tabs.buttons')}
								</span>
							</Show>
						</div>
						<p class="text-[11px] text-white/50 leading-relaxed font-medium mt-0.5 line-clamp-1">
							{t('channelProjects.dashboard.featureButtonsDesc')}
						</p>
					</div>
				</div>

				{/* Controls */}
				<div class="flex items-center gap-2 shrink-0">
					<Show when={!props.isSingleChannel}>
						<button
							type="button"
							onClick={(e) => {
								e.stopPropagation();
								haptic.impact('medium');
								const next = props.target === 'input' ? 'output' : props.target === 'output' ? 'both' : 'input';
								props.onCycleTarget(next);
							}}
							class="h-8 px-2.5 rounded-full bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 flex items-center gap-1 text-[10px] font-black transition-all active:scale-95"
							title={t('channelProjects.targetSelector.subtitle')}
						>
							<span class="material-symbols-outlined text-[13px]">{targetIcon()}</span>
							<span>{targetLabel()}</span>
						</button>
					</Show>

					{/* Switch Toggle */}
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
								? 'bg-amber-500/30 border-amber-400/60 justify-end'
								: 'bg-white/10 border-white/15 justify-start'
						}`}
					>
						<span
							class={`w-5 h-5 rounded-full transition-transform duration-300 shadow-md ${
								props.isActive
									? 'bg-amber-400 shadow-[0_0_10px_rgba(245,158,11,0.6)]'
									: 'bg-white/40'
							}`}
						/>
					</button>
				</div>
			</div>

			{/* ═══════ LIVE POST & GLASS BUTTONS PREVIEW ═══════ */}
			<div class="bg-[#080A10] rounded-[20px] border border-white/5 p-3.5 flex flex-col gap-2.5 shadow-inner relative overflow-hidden">
				<div class="flex items-center justify-between text-[10px] font-mono">
					<div class="flex items-center gap-1.5 text-amber-400 font-bold">
						<span class="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
						<span>{t('channelProjects.dashboard.liveDemo')}</span>
					</div>
					<span class="text-white/40">{t('channelProjects.dashboard.buttonsSimPost')}</span>
				</div>

				<div class="bg-white/5 border border-white/10 rounded-[14px] p-2.5 flex flex-col gap-2">
					<p class="text-[11px] text-white/80 font-medium line-clamp-1">
						{t('channelProjects.dashboard.buttonsSimPost')}
					</p>

					{/* 3 Interactive Glass Buttons */}
					<div class="grid grid-cols-2 gap-1.5">
						<button
							type="button"
							onClick={() => handleBtnClick(0)}
							class={`h-8 rounded-[10px] flex items-center justify-center gap-1 text-[10px] font-black border transition-all active:scale-95 ${
								activeBtn() === 0
									? 'bg-amber-500/30 border-amber-400 text-amber-200 shadow-[0_0_12px_rgba(245,158,11,0.5)]'
									: 'bg-white/5 border-white/10 text-white/75 hover:bg-white/10'
							}`}
						>
							<span class="material-symbols-outlined text-[13px] text-amber-400">link</span>
							<span>{t('channelProjects.dashboard.buttonsSimLink')}</span>
						</button>

						<button
							type="button"
							onClick={() => handleBtnClick(1)}
							class={`h-8 rounded-[10px] flex items-center justify-center gap-1 text-[10px] font-black border transition-all active:scale-95 ${
								activeBtn() === 1
									? 'bg-amber-500/30 border-amber-400 text-amber-200 shadow-[0_0_12px_rgba(245,158,11,0.5)]'
									: 'bg-white/5 border-white/10 text-white/75 hover:bg-white/10'
							}`}
						>
							<span class="material-symbols-outlined text-[13px] text-amber-400">bolt</span>
							<span>{t('channelProjects.dashboard.buttonsSimMiniApp')}</span>
						</button>
					</div>

					<button
						type="button"
						onClick={() => handleBtnClick(2)}
						class={`w-full h-8 rounded-[10px] flex items-center justify-center gap-1 text-[10px] font-black border transition-all active:scale-95 ${
							copied() || activeBtn() === 2
								? 'bg-emerald-500/25 border-emerald-400 text-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.5)]'
								: 'bg-white/5 border-white/10 text-white/75 hover:bg-white/10'
						}`}
					>
						<span class="material-symbols-outlined text-[13px]">
							{copied() ? 'check' : 'content_copy'}
						</span>
						<span>{copied() ? t('channelProjects.dashboard.buttonsSimCopied') : t('channelProjects.dashboard.buttonsSimCopy')}</span>
					</button>
				</div>
			</div>

			{/* Studio Action Button */}
			<button
				type="button"
				onClick={props.onNavigate}
				class="w-full h-11 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 rounded-[16px] text-[12px] font-black uppercase tracking-wider flex items-center justify-center gap-2 active:scale-95 transition-all shadow-sm"
			>
				<span>{t('channelProjects.dashboard.openStudio')}</span>
				<span class="material-symbols-outlined text-[18px] rtl:-scale-x-100">arrow_forward</span>
			</button>
		</div>
	);
};

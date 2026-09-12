import { Motion } from '@motionone/solid';
import { type Component, createSignal, onCleanup, onMount, Show } from 'solid-js';
import { t } from '@/shared/i18n/index.js';
import { haptic } from '@/shared/lib/haptic.js';

interface ProjectJoinRequestsCardProps {
	projectId: string;
	isActive: boolean;
	target: 'input' | 'output' | 'both';
	isSingleChannel?: boolean;
	onToggleActive: (active: boolean) => void;
	onCycleTarget: (nextTarget: 'input' | 'output' | 'both') => void;
	onNavigate: () => void;
}

export const ProjectJoinRequestsCard: Component<ProjectJoinRequestsCardProps> = (props) => {
	const [verifiedCount, setVerifiedCount] = createSignal(54);
	const [blockedCount, setBlockedCount] = createSignal(12);

	onMount(() => {
		const timer = setInterval(() => {
			if (Math.random() > 0.4) {
				setVerifiedCount((v) => v + 1);
			} else {
				setBlockedCount((b) => b + 1);
			}
		}, 3200);
		onCleanup(() => clearInterval(timer));
	});

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
		<div class="bg-[#12141C]/85 backdrop-blur-xl border border-white/10 hover:border-cyan-500/40 rounded-[26px] p-5 flex flex-col gap-4 shadow-lg relative overflow-hidden transition-all duration-300 group">
			{/* Ambient Glow */}
			<div class="absolute -right-10 -bottom-10 w-36 h-36 bg-cyan-500/15 blur-3xl rounded-full pointer-events-none" />

			{/* Header & Controls */}
			<div class="flex items-start justify-between gap-3 relative z-10">
				<div class="flex items-center gap-3 min-w-0">
					<div
						class={`w-11 h-11 rounded-[14px] flex items-center justify-center shrink-0 border transition-all ${
							props.isActive
								? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-300 shadow-[0_0_15px_rgba(6,182,212,0.3)]'
								: 'bg-white/5 border-white/10 text-white/50'
						}`}
					>
						<span class="material-symbols-outlined text-[24px]">shield</span>
					</div>
					<div class="flex flex-col min-w-0">
						<div class="flex items-center gap-2 flex-wrap">
							<h3 class="text-[15px] font-black text-white group-hover:text-cyan-300 transition-colors">
								{t('channelProjects.dashboard.featureJoin')}
							</h3>
						</div>
						<p class="text-[11px] text-white/50 leading-relaxed font-medium mt-0.5 line-clamp-1">
							{t('channelProjects.dashboard.featureJoinDesc')}
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
							class="h-8 px-2.5 rounded-full bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/30 text-cyan-300 flex items-center gap-1 text-[10px] font-black transition-all active:scale-95"
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
								? 'bg-cyan-500/30 border-cyan-400/60 justify-end'
								: 'bg-white/10 border-white/15 justify-start'
						}`}
					>
						<span
							class={`w-5 h-5 rounded-full transition-transform duration-300 shadow-md ${
								props.isActive
									? 'bg-cyan-400 shadow-[0_0_10px_rgba(6,182,212,0.6)]'
									: 'bg-white/40'
							}`}
						/>
					</button>
				</div>
			</div>

			{/* ═══════ RADAR SECURITY SIMULATION ═══════ */}
			<div class="bg-[#080A10] rounded-[20px] border border-white/5 p-3.5 flex flex-col gap-2.5 shadow-inner relative overflow-hidden">
				<div class="flex items-center justify-between text-[10px] font-mono">
					<div class="flex items-center gap-1.5 text-cyan-400 font-bold">
						<span class="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
						<span>{t('channelProjects.dashboard.liveDemo')}</span>
					</div>
					<span class="text-white/40">{t('channelProjects.dashboard.gatekeeperActiveShield')}</span>
				</div>

				{/* Radar & Metrics Row */}
				<div class="bg-white/5 border border-white/10 rounded-[14px] p-3 flex items-center justify-between gap-3">
					<div class="flex items-center gap-2.5">
						<div class="relative w-10 h-10 flex items-center justify-center">
							<Motion.div
								animate={{ scale: [1, 1.4, 1], opacity: [0.6, 0.1, 0.6] }}
								transition={{ repeat: Infinity, duration: 2 }}
								class="absolute inset-0 rounded-full border border-cyan-400"
							/>
							<span class="material-symbols-outlined text-[22px] text-cyan-400">verified_user</span>
						</div>
						<div class="flex flex-col">
							<span class="text-[12px] font-black text-white">
								{verifiedCount()} {t('channelProjects.dashboard.gatekeeperVerified')}
							</span>
							<span class="text-[10px] text-rose-400/80 font-bold">
								{blockedCount()} {t('channelProjects.dashboard.gatekeeperBlocked')}
							</span>
						</div>
					</div>

					<div class="flex flex-col items-end gap-1">
						<span class="text-[9px] font-black px-2 py-0.5 rounded-full bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
							Telegram Premium
						</span>
						<span class="text-[9px] font-black px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
							Anti-Spam
						</span>
					</div>
				</div>
			</div>

			{/* Studio Action Button */}
			<button
				type="button"
				onClick={props.onNavigate}
				class="w-full h-11 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 text-cyan-300 rounded-[16px] text-[12px] font-black uppercase tracking-wider flex items-center justify-center gap-2 active:scale-95 transition-all shadow-sm"
			>
				<span>{t('channelProjects.dashboard.openStudio')}</span>
				<span class="material-symbols-outlined text-[18px] rtl:-scale-x-100">arrow_forward</span>
			</button>
		</div>
	);
};

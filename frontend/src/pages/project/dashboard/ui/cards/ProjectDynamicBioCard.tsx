import { Motion } from '@motionone/solid';
import { type Component, createSignal, For, onCleanup, onMount, Show } from 'solid-js';
import { t } from '@/shared/i18n/index.js';
import { haptic } from '@/shared/lib/haptic.js';
import { showToast } from '@/shared/ui/index.js';

interface ProjectDynamicBioCardProps {
	projectId: string;
	isActive: boolean;
	target: 'input' | 'output' | 'both';
	isSingleChannel?: boolean;
	onToggleActive: (active: boolean) => void;
	onCycleTarget: (nextTarget: 'input' | 'output' | 'both') => void;
	onNavigate: () => void;
}

export const ProjectDynamicBioCard: Component<ProjectDynamicBioCardProps> = (props) => {
	const [membersCount, setMembersCount] = createSignal(14820);
	const [currentTime, setCurrentTime] = createSignal(
		new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
	);
	const [activeTokenIdx, setActiveTokenIdx] = createSignal(0);

	const tokens = [
		{ tag: '$members', label: 'تعداد اعضا', value: '14,820', icon: 'groups', color: 'text-cyan-400' },
		{ tag: '$ton', label: 'قیمت تون', value: '$5.68', icon: 'diamond', color: 'text-sky-400' },
		{ tag: '$btc', label: 'بیت‌کوین', value: '$66,420', icon: 'currency_bitcoin', color: 'text-amber-400' },
		{ tag: '$countdown', label: 'شمارش معکوس', value: '04d 12h', icon: 'hourglass_top', color: 'text-emerald-400' },
		{ tag: '$time', label: 'ساعت زنده', value: '17:45', icon: 'schedule', color: 'text-cyan-300' },
	];

	onMount(() => {
		const clockTimer = setInterval(() => {
			setCurrentTime(
				new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
			);
		}, 1000);

		const memberTimer = setInterval(() => {
			setMembersCount((m) => m + Math.floor(Math.random() * 3) + 1);
		}, 2200);

		const tokenTicker = setInterval(() => {
			setActiveTokenIdx((i) => (i + 1) % tokens.length);
		}, 3000);

		onCleanup(() => {
			clearInterval(clockTimer);
			clearInterval(memberTimer);
			clearInterval(tokenTicker);
		});
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
			<div class="absolute -left-10 -top-10 w-40 h-40 bg-gradient-to-br from-cyan-500/20 via-sky-500/10 to-transparent blur-3xl rounded-full pointer-events-none" />

			{/* Header & In-Place Controls */}
			<div class="flex items-start justify-between gap-3 relative z-10">
				<div class="flex items-center gap-3 min-w-0">
					<div
						class={`w-11 h-11 rounded-[14px] flex items-center justify-center shrink-0 border transition-all ${
							props.isActive
								? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-300 shadow-[0_0_15px_rgba(6,182,212,0.3)]'
								: 'bg-white/5 border-white/10 text-white/50'
						}`}
					>
						<span class="material-symbols-outlined text-[24px]">badge</span>
					</div>
					<div class="flex flex-col min-w-0">
						<div class="flex items-center gap-2 flex-wrap">
							<h3 class="text-[15px] font-black text-white group-hover:text-cyan-300 transition-colors">
								{t('channelProjects.dashboard.featureBio')}
							</h3>
							<span class="text-[9px] font-black px-2 py-0.5 rounded-full bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 flex items-center gap-1">
								<span class="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
								<span>تیکر متغیرهای زنده</span>
							</span>
						</div>
						<p class="text-[11px] text-white/50 leading-relaxed font-medium mt-0.5 line-clamp-1">
							{t('channelProjects.dashboard.featureBioDesc')}
						</p>
					</div>
				</div>

				{/* Quick Controls */}
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

			{/* ═══════ TOKEN CHIPS BAR ═══════ */}
			<div class="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
				<For each={tokens}>
					{(tok, idx) => (
						<button
							type="button"
							onClick={() => {
								haptic.impact('light');
								setActiveTokenIdx(idx());
								showToast(`${tok.label}: ${tok.value}`, 'info');
							}}
							class={`px-2.5 py-1 rounded-[10px] text-[10px] font-mono font-bold whitespace-nowrap transition-all flex items-center gap-1 border ${
								activeTokenIdx() === idx()
									? 'bg-cyan-500/25 text-cyan-200 border-cyan-400/50 shadow-sm'
									: 'bg-white/5 text-white/60 border-white/5 hover:text-white hover:bg-white/10'
							}`}
						>
							<span class={`material-symbols-outlined text-[13px] ${tok.color}`}>{tok.icon}</span>
							<span>{tok.tag}</span>
						</button>
					)}
				</For>
			</div>

			{/* ═══════ REAL TELEGRAM CHANNEL PROFILE SIMULATOR ═══════ */}
			<div class="bg-gradient-to-br from-[#0c1926] via-[#081018] to-[#04080c] rounded-[22px] border border-[#1b3147] p-4 flex flex-col gap-3 shadow-inner relative overflow-hidden">
				{/* Top Status */}
				<div class="flex items-center justify-between text-[10px] font-mono">
					<div class="flex items-center gap-1.5 text-cyan-400 font-bold">
						<span class="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
						<span>{t('channelProjects.dashboard.liveDemo')}</span>
					</div>
					<span class="text-white/40 font-mono">Telegram Channel Profile</span>
				</div>

				{/* Telegram Channel Header Mockup */}
				<div class="bg-white/5 border border-white/10 rounded-[18px] p-3.5 flex flex-col gap-3">
					{/* Avatar & Channel Title */}
					<div class="flex items-center gap-3">
						<div class="w-12 h-12 rounded-full bg-gradient-to-tr from-cyan-600 via-sky-500 to-[#3390ec] flex items-center justify-center text-white font-black text-[18px] shadow-lg border-2 border-white/20 shrink-0 relative">
							<span>iF</span>
							<span class="absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full bg-emerald-400 border-2 border-[#0c1926]" />
						</div>

						<div class="flex flex-col min-w-0 flex-1">
							<div class="flex items-center gap-1.5">
								<span class="text-[14px] font-black text-white truncate">iFragment News</span>
								<span class="material-symbols-outlined text-cyan-400 text-[16px]">verified</span>
								<span class="text-[9px] font-mono text-cyan-300 bg-cyan-500/20 px-1.5 py-0.2 rounded-[6px] border border-cyan-500/30">
									{currentTime()}
								</span>
							</div>
							<span class="text-[11px] text-white/50 font-mono">@iFragmentChannel • {membersCount().toLocaleString('en-US')} مشترک</span>
						</div>
					</div>

					{/* Dynamic Bio Description Box */}
					<div class="bg-black/40 border border-white/10 rounded-[12px] p-2.5 flex flex-col gap-1.5">
						<div class="flex items-center justify-between text-[10px] text-white/50 font-mono">
							<span>توضیحات زنده کانال (Bio):</span>
							<span class="text-cyan-400 font-bold">بروزرسانی هر ۱۰ دقیقه</span>
						</div>

						<p class="text-[12px] font-bold text-white/90 leading-relaxed">
							⚡ مرجع رسمی مارکت‌پلیس فرگمنت و گیفت‌های تلگرام | 👥 اعضا: <span class="text-cyan-300 font-mono">{membersCount().toLocaleString('en-US')}</span> | 💎 تون:{' '}
							<span class="text-sky-300 font-mono">$5.68</span> | 🕒 ساعت:{' '}
							<span class="text-cyan-200 font-mono">{currentTime()}</span>
						</p>
					</div>
				</div>
			</div>

			{/* Studio Action Button */}
			<button
				type="button"
				onClick={props.onNavigate}
				class="w-full h-11 bg-gradient-to-r from-cyan-500/15 to-[#3390ec]/15 hover:from-cyan-500/25 hover:to-[#3390ec]/25 border border-cyan-500/30 text-cyan-300 rounded-[16px] text-[12px] font-black uppercase tracking-wider flex items-center justify-center gap-2 active:scale-95 transition-all shadow-sm"
			>
				<span>{t('channelProjects.dashboard.openStudio')}</span>
				<span class="material-symbols-outlined text-[18px] rtl:-scale-x-100">arrow_forward</span>
			</button>
		</div>
	);
};

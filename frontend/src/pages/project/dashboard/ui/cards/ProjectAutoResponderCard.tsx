import { Motion } from '@motionone/solid';
import { type Component, createSignal, For, Show } from 'solid-js';
import { t } from '@/shared/i18n/index.js';
import { haptic } from '@/shared/lib/haptic.js';

interface ProjectAutoResponderCardProps {
	projectId: string;
	isActive: boolean;
	target: 'input' | 'output' | 'both';
	isSingleChannel?: boolean;
	onToggleActive: (active: boolean) => void;
	onCycleTarget: (nextTarget: 'input' | 'output' | 'both') => void;
	onNavigate: () => void;
}

export const ProjectAutoResponderCard: Component<ProjectAutoResponderCardProps> = (props) => {
	const triggerSamples = [
		{ q: 'قیمت چنده؟', a: 'سلام! قیمت اشتراک ویژه ماهانه ۲۵۰ استارز یا ۴.۵ تون‌کوین می‌باشد. برای خرید مستقیم دکمه زیر را لمس کنید.', icon: 'payments' },
		{ q: 'چطور بخرم؟', a: 'درود! می‌توانید از طریق بات @iFragmentBot یا ربات رسمی ما با پرداخت کریپتو فوراً فعال‌سازی نمایید.', icon: 'shopping_cart' },
		{ q: 'پشتیبانی', a: 'سلام دوست گرامی! ادمین‌های تیم ۲۴ ساعته در آیدی @iFragmentSupport آماده پاسخگویی هستند.', icon: 'support_agent' },
	];

	const [activeQuestion, setActiveQuestion] = createSignal(triggerSamples[0].q);
	const [activeAnswer, setActiveAnswer] = createSignal(triggerSamples[0].a);
	const [isTyping, setIsTyping] = createSignal(false);

	const handleSelectTrigger = (sample: { q: string; a: string }) => {
		haptic.impact('light');
		setActiveQuestion(sample.q);
		setIsTyping(true);
		setTimeout(() => {
			setIsTyping(false);
			setActiveAnswer(sample.a);
			haptic.notify('success');
		}, 600);
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
		<div class="bg-[#12141C]/85 backdrop-blur-xl border border-white/10 hover:border-sky-500/40 rounded-[26px] p-5 flex flex-col gap-4 shadow-lg relative overflow-hidden transition-all duration-300 group">
			{/* Ambient Glow */}
			<div class="absolute -left-10 -top-10 w-40 h-40 bg-sky-500/15 blur-3xl rounded-full pointer-events-none" />

			{/* Header & In-Place Controls */}
			<div class="flex items-start justify-between gap-3 relative z-10">
				<div class="flex items-center gap-3 min-w-0">
					<div
						class={`w-11 h-11 rounded-[14px] flex items-center justify-center shrink-0 border transition-all ${
							props.isActive
								? 'bg-sky-500/20 border-sky-500/40 text-sky-300 shadow-[0_0_15px_rgba(14,165,233,0.3)]'
								: 'bg-white/5 border-white/10 text-white/50'
						}`}
					>
						<span class="material-symbols-outlined text-[24px]">quickreply</span>
					</div>
					<div class="flex flex-col min-w-0">
						<div class="flex items-center gap-2 flex-wrap">
							<h3 class="text-[15px] font-black text-white group-hover:text-sky-300 transition-colors">
								{t('channelProjects.dashboard.featureResponder')}
							</h3>
							<span class="text-[9px] font-black px-2 py-0.5 rounded-full bg-sky-500/15 text-sky-300 border border-sky-500/30 flex items-center gap-1">
								<span class="w-1.5 h-1.5 rounded-full bg-sky-400 animate-ping" />
								<span>پاسخ هوشمند و کامنت اول</span>
							</span>
						</div>
						<p class="text-[11px] text-white/50 leading-relaxed font-medium mt-0.5 line-clamp-1">
							{t('channelProjects.dashboard.featureResponderDesc')}
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
							class="h-8 px-2.5 rounded-full bg-sky-500/15 hover:bg-sky-500/25 border border-sky-500/30 text-sky-300 flex items-center gap-1 text-[10px] font-black transition-all active:scale-95"
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
								? 'bg-sky-500/30 border-sky-400/60 justify-end'
								: 'bg-white/10 border-white/15 justify-start'
						}`}
					>
						<span
							class={`w-5 h-5 rounded-full transition-transform duration-300 shadow-md ${
								props.isActive
									? 'bg-sky-400 shadow-[0_0_10px_rgba(14,165,233,0.6)]'
									: 'bg-white/40'
							}`}
						/>
					</button>
				</div>
			</div>

			{/* ═══════ TRIGGER SAMPLES CHIPS ═══════ */}
			<div class="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
				<For each={triggerSamples}>
					{(sample) => (
						<button
							type="button"
							onClick={() => handleSelectTrigger(sample)}
							class={`px-2.5 py-1 rounded-[10px] text-[10px] font-bold whitespace-nowrap transition-all flex items-center gap-1 border ${
								activeQuestion() === sample.q
									? 'bg-sky-500/25 text-sky-200 border-sky-400/50 shadow-sm'
									: 'bg-white/5 text-white/60 border-white/5 hover:text-white hover:bg-white/10'
							}`}
						>
							<span class="material-symbols-outlined text-[13px] text-sky-400">{sample.icon}</span>
							<span>«{sample.q}»</span>
						</button>
					)}
				</For>
			</div>

			{/* ═══════ LIVE TELEGRAM CHAT SIMULATION BOX ═══════ */}
			<div class="bg-gradient-to-br from-[#0c1824] via-[#09121a] to-[#050a0e] rounded-[22px] border border-[#1b3147] p-3.5 flex flex-col gap-2.5 shadow-inner relative overflow-hidden min-h-[140px] justify-between">
				<div class="flex items-center justify-between text-[10px] font-mono">
					<div class="flex items-center gap-1.5 text-sky-400 font-bold">
						<span class="w-2 h-2 rounded-full bg-sky-400 animate-pulse" />
						<span>{t('channelProjects.dashboard.liveDemo')}</span>
					</div>
					<span class="text-white/40 flex items-center gap-1">
						<span class="material-symbols-outlined text-[12px] text-sky-400">bolt</span>
						<span>پاسخگویی آنی (&lt; 0.2s)</span>
					</span>
				</div>

				<div class="flex flex-col gap-2 relative">
					{/* User Comment Bubble */}
					<div class="self-start bg-white/10 border border-white/10 text-white/95 rounded-[14px] rounded-bl-[4px] px-3 py-2 text-[11px] font-bold max-w-[85%] flex items-center gap-2 shadow-sm">
						<span class="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-[11px]">👤</span>
						<span>{activeQuestion()}</span>
					</div>

					{/* Bot Reply Bubble */}
					<Show
						when={!isTyping()}
						fallback={
							<div class="self-end flex items-center gap-1.5 text-[11px] text-sky-300/80 px-3 py-1.5 bg-sky-500/10 rounded-[12px] border border-sky-500/20">
								<span class="w-2 h-2 rounded-full bg-sky-400 animate-ping" />
								<span class="font-mono">در حال نگارش پاسخ با AI...</span>
							</div>
						}
					>
						<Motion.div
							initial={{ opacity: 0, y: 6, scale: 0.96 }}
							animate={{ opacity: 1, y: 0, scale: 1 }}
							transition={{ duration: 0.3 }}
							class="self-end bg-sky-500/20 border border-sky-500/40 text-sky-100 rounded-[16px] rounded-br-[4px] p-3 text-[11px] font-medium max-w-[92%] flex flex-col gap-1.5 shadow-[0_4px_16px_rgba(14,165,233,0.25)]"
						>
							<div class="flex items-center justify-between gap-2 border-b border-sky-500/20 pb-1">
								<span class="flex items-center gap-1 text-[10px] font-black text-sky-300">
									<span class="material-symbols-outlined text-[14px]">smart_toy</span>
									<span>iFragment Assistant</span>
								</span>
								<span class="text-[9px] font-mono text-sky-400/70">تطبیق هوشمند</span>
							</div>
							<p class="leading-relaxed text-white/95">{activeAnswer()}</p>
						</Motion.div>
					</Show>
				</div>
			</div>

			{/* Studio Action Button */}
			<button
				type="button"
				onClick={props.onNavigate}
				class="w-full h-11 bg-gradient-to-r from-sky-500/15 to-[#3390ec]/15 hover:from-sky-500/25 hover:to-[#3390ec]/25 border border-sky-500/30 text-sky-300 rounded-[16px] text-[12px] font-black uppercase tracking-wider flex items-center justify-center gap-2 active:scale-95 transition-all shadow-sm"
			>
				<span>{t('channelProjects.dashboard.openStudio')}</span>
				<span class="material-symbols-outlined text-[18px] rtl:-scale-x-100">arrow_forward</span>
			</button>
		</div>
	);
};

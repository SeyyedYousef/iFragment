import { Motion } from '@motionone/solid';
import { type Component, createSignal, onCleanup, onMount } from 'solid-js';
import { t } from '@/shared/i18n/index.js';

export const ForwardingLessonCard: Component<{ onNavigate: () => void; isDone?: boolean }> = (
	props,
) => {
	const [activeChannel, setActiveChannel] = createSignal(0);

	onMount(() => {
		const timer = setInterval(() => setActiveChannel((c) => (c + 1) % 2), 2200);
		onCleanup(() => clearInterval(timer));
	});

	return (
		<div class="bg-[#12141C]/80 backdrop-blur-xl border border-white/5 hover:border-white/15 rounded-[28px] p-5 flex flex-col gap-4 shadow-sm relative overflow-hidden transition-all">
			<div class="absolute -left-10 -bottom-10 w-32 h-32 bg-amber-500/10 blur-3xl rounded-full pointer-events-none" />

			<div class="flex items-center justify-between relative z-10">
				<div class="flex items-center gap-2.5">
					<div class="w-9 h-9 rounded-[12px] bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
						<span class="material-symbols-outlined text-[20px]">call_split</span>
					</div>
					<h3 class="text-[14px] font-black text-white">{t('lessons.forwarding.title')}</h3>
				</div>
				{props.isDone && (
					<span class="text-[10px] font-black text-[#10b981] bg-[#10b981]/10 border border-[#10b981]/25 px-2 py-0.5 rounded-[6px] flex items-center gap-1 uppercase tracking-wider">
						<span class="material-symbols-outlined text-[12px]">check_circle</span>
						{t('lessons.statusActive')}
					</span>
				)}
			</div>

			<p class="text-[12px] text-white/60 leading-relaxed font-medium relative z-10">
				{t('lessons.forwarding.desc')}
			</p>

			{/* Cross-posting / Forwarding Visual Diagram */}
			<div class="h-28 bg-[#08090D] rounded-[20px] border border-white/5 p-3 flex items-center justify-between shadow-inner relative overflow-hidden">
				<div class="flex flex-col items-center gap-1 z-10">
					<div class="w-10 h-10 rounded-[12px] bg-white/5 border border-white/10 flex items-center justify-center text-white/80">
						<span class="material-symbols-outlined text-[20px]">rss_feed</span>
					</div>
					<span class="text-[9px] font-black text-white/50 uppercase tracking-widest">
						{t('lessons.forwarding.source')}
					</span>
				</div>

				<div class="flex-1 flex flex-col items-center justify-center relative">
					<span class="material-symbols-outlined text-amber-400 text-[24px] rtl:rotate-180 animate-pulse">
						fast_forward
					</span>
					<span class="text-[8px] font-mono text-amber-400/80 bg-amber-400/10 px-2 py-0.5 rounded-[4px] border border-amber-400/20 mt-1">
						{t('lessons.forwarding.autoFilter')}
					</span>
				</div>

				<div class="flex flex-col items-center gap-1 z-10">
					<Motion.div
						animate={{ scale: activeChannel() === 1 ? [1, 1.15, 1] : 1 }}
						transition={{ duration: 0.4 }}
						class="w-10 h-10 rounded-[12px] bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.3)]"
					>
						<span class="material-symbols-outlined text-[20px]">campaign</span>
					</Motion.div>
					<span class="text-[9px] font-black text-white/50 uppercase tracking-widest">
						{t('lessons.forwarding.destination')}
					</span>
				</div>
			</div>

			<button
				type="button"
				onClick={props.onNavigate}
				class="w-full h-12 bg-white/5 border border-amber-500/30 text-amber-400 hover:bg-amber-500/10 rounded-[16px] text-[12px] font-black uppercase tracking-widest flex items-center justify-center gap-2 active:scale-95 transition-all"
			>
				{t('lessons.forwarding.cta')}
				<span class="material-symbols-outlined text-[18px] rtl:-scale-x-100">arrow_forward</span>
			</button>
		</div>
	);
};

import { Motion } from '@motionone/solid';
import { type Component, createSignal, onCleanup, onMount } from 'solid-js';
import { t } from '@/shared/i18n/index.js';

export const InlineButtonsLessonCard: Component<{ onNavigate: () => void; isDone?: boolean }> = (
	props,
) => {
	const [activeBtn, setActiveBtn] = createSignal(0);

	onMount(() => {
		const timer = setInterval(() => setActiveBtn((b) => (b + 1) % 2), 1600);
		onCleanup(() => clearInterval(timer));
	});

	return (
		<div class="bg-[#12141C]/80 backdrop-blur-xl border border-white/5 hover:border-white/15 rounded-[28px] p-5 flex flex-col gap-4 shadow-sm relative overflow-hidden transition-all">
			<div class="absolute -left-10 -top-10 w-32 h-32 bg-emerald-500/10 blur-3xl rounded-full pointer-events-none" />

			<div class="flex items-center justify-between relative z-10">
				<div class="flex items-center gap-2.5">
					<div class="w-9 h-9 rounded-[12px] bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
						<span class="material-symbols-outlined text-[20px]">smart_button</span>
					</div>
					<h3 class="text-[14px] font-black text-white">{t('lessons.inlineButtons.title')}</h3>
				</div>
				{props.isDone && (
					<span class="text-[10px] font-black text-[#10b981] bg-[#10b981]/10 border border-[#10b981]/25 px-2 py-0.5 rounded-[6px] flex items-center gap-1 uppercase tracking-wider">
						<span class="material-symbols-outlined text-[12px]">check_circle</span>
						{t('lessons.statusActive')}
					</span>
				)}
			</div>

			<p class="text-[12px] text-white/60 leading-relaxed font-medium relative z-10">
				{t('lessons.inlineButtons.desc')}
			</p>

			{/* Interactive Button Preview Demo */}
			<div class="h-28 bg-[#08090D] rounded-[20px] border border-white/5 p-3 flex flex-col justify-between shadow-inner">
				<div class="bg-white/5 rounded-[10px] p-2 text-[10px] text-white/70 font-bold truncate">
					{t('lessons.inlineButtons.samplePost')}
				</div>
				<div class="grid grid-cols-2 gap-2">
					<Motion.div
						animate={{ scale: activeBtn() === 0 ? 1.05 : 1 }}
						class={`h-8 rounded-[10px] flex items-center justify-center gap-1 text-[10px] font-bold border transition-colors ${
							activeBtn() === 0
								? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.3)]'
								: 'bg-white/5 border-white/10 text-white/60'
						}`}
					>
						<span class="material-symbols-outlined text-[14px]">link</span>
						<span>{t('lessons.inlineButtons.linkBtn')}</span>
					</Motion.div>

					<Motion.div
						animate={{ scale: activeBtn() === 1 ? 1.05 : 1 }}
						class={`h-8 rounded-[10px] flex items-center justify-center gap-1 text-[10px] font-bold border transition-colors ${
							activeBtn() === 1
								? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.3)]'
								: 'bg-white/5 border-white/10 text-white/60'
						}`}
					>
						<span class="material-symbols-outlined text-[14px]">touch_app</span>
						<span>{t('lessons.inlineButtons.actionBtn')}</span>
					</Motion.div>
				</div>
			</div>

			<button
				type="button"
				onClick={props.onNavigate}
				class="w-full h-12 bg-white/5 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10 rounded-[16px] text-[12px] font-black uppercase tracking-widest flex items-center justify-center gap-2 active:scale-95 transition-all"
			>
				{t('lessons.inlineButtons.cta')}
				<span class="material-symbols-outlined text-[18px] rtl:-scale-x-100">arrow_forward</span>
			</button>
		</div>
	);
};

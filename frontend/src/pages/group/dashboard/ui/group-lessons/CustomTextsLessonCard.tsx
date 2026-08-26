import { Motion } from '@motionone/solid';
import { type Component, createSignal, onCleanup, onMount } from 'solid-js';
import { t } from '@/shared/i18n/index.js';

export const CustomTextsLessonCard: Component<{ onNavigate: () => void; isDone?: boolean }> = (
	props,
) => {
	const [activeTemplate, setActiveTemplate] = createSignal(0);

	onMount(() => {
		const timer = setInterval(() => setActiveTemplate((t) => (t + 1) % 2), 2000);
		onCleanup(() => clearInterval(timer));
	});

	return (
		<div class="bg-[#12141C]/80 backdrop-blur-xl border border-white/5 hover:border-white/15 rounded-[28px] p-5 flex flex-col gap-4 shadow-sm relative overflow-hidden transition-all">
			<div class="absolute -right-10 -bottom-10 w-32 h-32 bg-indigo-500/10 blur-3xl rounded-full pointer-events-none" />

			<div class="flex items-center justify-between relative z-10">
				<div class="flex items-center gap-2.5">
					<div class="w-9 h-9 rounded-[12px] bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
						<span class="material-symbols-outlined text-[20px]">edit_note</span>
					</div>
					<h3 class="text-[14px] font-black text-white">{t('groupLessons.customTexts.title')}</h3>
				</div>
				{props.isDone && (
					<span class="text-[10px] font-black text-[#10b981] bg-[#10b981]/10 border border-[#10b981]/25 px-2 py-0.5 rounded-[6px] flex items-center gap-1 uppercase tracking-wider">
						<span class="material-symbols-outlined text-[12px]">check_circle</span>
						{t('groupLessons.statusActive')}
					</span>
				)}
			</div>

			<p class="text-[12px] text-white/60 leading-relaxed font-medium relative z-10">
				{t('groupLessons.customTexts.desc')}
			</p>

			{/* Custom Texts Preview Demo */}
			<div class="h-28 bg-[#08090D] rounded-[20px] border border-white/5 p-3.5 flex flex-col justify-between shadow-inner">
				<div class="flex items-center justify-between border-b border-white/5 pb-2">
					<span class="text-[10px] font-black text-indigo-400 uppercase tracking-wider flex items-center gap-1">
						<span class="material-symbols-outlined text-[14px]">tune</span>
						{t('groupLessons.customTexts.templateLabel')}
					</span>
					<span class="text-[9px] font-mono text-white/40">
						{activeTemplate() === 0 ? '$name' : '$rules'}
					</span>
				</div>

				<Motion.div
					animate={{ opacity: [0.6, 1] }}
					class="bg-white/5 border border-white/10 rounded-[12px] p-2.5 text-[11px] font-bold text-white/80 truncate"
				>
					{activeTemplate() === 0
						? t('groupLessons.customTexts.sampleWelcome')
						: t('groupLessons.customTexts.sampleWarning')}
				</Motion.div>
			</div>

			<button
				type="button"
				onClick={props.onNavigate}
				class="w-full h-12 bg-white/5 border border-indigo-500/30 text-indigo-400 hover:bg-indigo-500/10 rounded-[16px] text-[12px] font-black uppercase tracking-widest flex items-center justify-center gap-2 active:scale-95 transition-all"
			>
				{t('groupLessons.customTexts.cta')}
				<span class="material-symbols-outlined text-[18px] rtl:-scale-x-100">arrow_forward</span>
			</button>
		</div>
	);
};

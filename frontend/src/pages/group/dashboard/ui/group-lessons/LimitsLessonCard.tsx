import { Motion } from '@motionone/solid';
import { Component, createSignal, onCleanup, onMount } from 'solid-js';
import { t } from '@/shared/i18n/index.js';

export const LimitsLessonCard: Component<{ onNavigate: () => void; isDone?: boolean }> = (props) => {
	const [slowModeSeconds, setSlowModeSeconds] = createSignal(10);

	onMount(() => {
		const timer = setInterval(() => {
			setSlowModeSeconds((s) => (s > 0 ? s - 1 : 10));
		}, 1000);
		onCleanup(() => clearInterval(timer));
	});

	return (
		<div class="bg-[#12141C]/80 backdrop-blur-xl border border-white/5 hover:border-white/15 rounded-[28px] p-5 flex flex-col gap-4 shadow-sm relative overflow-hidden transition-all">
			<div class="absolute -right-10 -bottom-10 w-32 h-32 bg-emerald-500/10 blur-3xl rounded-full pointer-events-none" />

			<div class="flex items-center justify-between relative z-10">
				<div class="flex items-center gap-2.5">
					<div class="w-9 h-9 rounded-[12px] bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
						<span class="material-symbols-outlined text-[20px]">speed</span>
					</div>
					<h3 class="text-[14px] font-black text-white">{t('groupLessons.limits.title')}</h3>
				</div>
				{props.isDone && (
					<span class="text-[10px] font-black text-[#10b981] bg-[#10b981]/10 border border-[#10b981]/25 px-2 py-0.5 rounded-[6px] flex items-center gap-1 uppercase tracking-wider">
						<span class="material-symbols-outlined text-[12px]">check_circle</span>
						{t('groupLessons.statusActive')}
					</span>
				)}
			</div>

			<p class="text-[12px] text-white/60 leading-relaxed font-medium relative z-10">
				{t('groupLessons.limits.desc')}
			</p>

			{/* Slow Mode & Frequency Limit Demo */}
			<div class="h-28 bg-[#08090D] rounded-[20px] border border-white/5 p-3.5 flex items-center justify-between shadow-inner">
				<div class="flex items-center gap-3">
					<div class="w-12 h-12 rounded-[14px] bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-mono font-black text-[18px]">
						{slowModeSeconds()}s
					</div>
					<div class="flex flex-col">
						<span class="text-[12px] font-black text-white">{t('groupLessons.limits.slowModeLabel')}</span>
						<span class="text-[10px] font-bold text-white/40">{t('groupLessons.limits.waitNotice')}</span>
					</div>
				</div>

				<Motion.div
					animate={{ scale: slowModeSeconds() === 0 ? [1, 1.2, 1] : 1 }}
					class={`w-8 h-8 rounded-[10px] flex items-center justify-center border ${
						slowModeSeconds() === 0
							? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400'
							: 'bg-white/5 border-white/10 text-white/30'
					}`}
				>
					<span class="material-symbols-outlined text-[18px]">send</span>
				</Motion.div>
			</div>

			<button
				onClick={props.onNavigate}
				class="w-full h-12 bg-white/5 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10 rounded-[16px] text-[12px] font-black uppercase tracking-widest flex items-center justify-center gap-2 active:scale-95 transition-all"
			>
				{t('groupLessons.limits.cta')}
				<span class="material-symbols-outlined text-[18px] rtl:-scale-x-100">arrow_forward</span>
			</button>
		</div>
	);
};

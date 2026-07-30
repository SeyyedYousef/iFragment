import { Motion } from '@motionone/solid';
import { Component, createSignal, onCleanup, onMount } from 'solid-js';
import { t } from '@/shared/i18n/index.js';

export const QuietHoursLessonCard: Component<{ onNavigate: () => void; isDone?: boolean }> = (props) => {
	const [isNight, setIsNight] = createSignal(false);

	onMount(() => {
		const timer = setInterval(() => setIsNight((n) => !n), 2000);
		onCleanup(() => clearInterval(timer));
	});

	return (
		<div class="bg-[#12141C]/80 backdrop-blur-xl border border-white/5 hover:border-white/15 rounded-[28px] p-5 flex flex-col gap-4 shadow-sm relative overflow-hidden transition-all">
			<div class="absolute -right-10 -top-10 w-32 h-32 bg-amber-500/10 blur-3xl rounded-full pointer-events-none" />

			<div class="flex items-center justify-between relative z-10">
				<div class="flex items-center gap-2.5">
					<div class="w-9 h-9 rounded-[12px] bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
						<span class="material-symbols-outlined text-[20px]">bedtime</span>
					</div>
					<h3 class="text-[14px] font-black text-white">{t('groupLessons.quietHours.title')}</h3>
				</div>
				{props.isDone && (
					<span class="text-[10px] font-black text-[#10b981] bg-[#10b981]/10 border border-[#10b981]/25 px-2 py-0.5 rounded-[6px] flex items-center gap-1 uppercase tracking-wider">
						<span class="material-symbols-outlined text-[12px]">check_circle</span>
						{t('groupLessons.statusActive')}
					</span>
				)}
			</div>

			<p class="text-[12px] text-white/60 leading-relaxed font-medium relative z-10">
				{t('groupLessons.quietHours.desc')}
			</p>

			{/* Day / Night Scheduled Lock Demo */}
			<div class="h-28 bg-[#08090D] rounded-[20px] border border-white/5 p-3.5 flex items-center justify-between shadow-inner relative overflow-hidden">
				<div class="flex items-center gap-3">
					<Motion.div
						animate={{ scale: isNight() ? 1.1 : 1, rotate: isNight() ? 360 : 0 }}
						transition={{ duration: 0.8 }}
						class={`w-12 h-12 rounded-[14px] flex items-center justify-center border transition-all ${
							isNight()
								? 'bg-indigo-500/20 border-indigo-500/40 text-indigo-400 shadow-[0_0_15px_rgba(99,102,241,0.3)]'
								: 'bg-amber-500/20 border-amber-500/40 text-amber-400'
						}`}
					>
						<span class="material-symbols-outlined text-[24px]">
							{isNight() ? 'dark_mode' : 'wb_sunny'}
						</span>
					</Motion.div>
					<div class="flex flex-col">
						<span class="text-[12px] font-black text-white">
							{isNight() ? t('groupLessons.quietHours.nightMode') : t('groupLessons.quietHours.dayMode')}
						</span>
						<span class="text-[10px] font-mono font-bold text-white/40">
							{isNight() ? '23:00 - 07:00' : '07:00 - 23:00'}
						</span>
					</div>
				</div>

				<span
					class={`text-[10px] font-black uppercase px-2.5 py-1 rounded-[8px] border transition-all ${
						isNight()
							? 'bg-[#ff4a4a]/10 border-[#ff4a4a]/30 text-[#ff4a4a]'
							: 'bg-[#10b981]/10 border-[#10b981]/30 text-[#10b981]'
					}`}
				>
					{isNight() ? t('groupLessons.quietHours.locked') : t('groupLessons.quietHours.open')}
				</span>
			</div>

			<button
				onClick={props.onNavigate}
				class="w-full h-12 bg-white/5 border border-amber-500/30 text-amber-400 hover:bg-amber-500/10 rounded-[16px] text-[12px] font-black uppercase tracking-widest flex items-center justify-center gap-2 active:scale-95 transition-all"
			>
				{t('groupLessons.quietHours.cta')}
				<span class="material-symbols-outlined text-[18px] rtl:-scale-x-100">arrow_forward</span>
			</button>
		</div>
	);
};

import { Motion } from '@motionone/solid';
import { Component, createSignal, onCleanup, onMount } from 'solid-js';
import { t } from '@/shared/i18n/index.js';

export const MandatoryLessonCard: Component<{ onNavigate: () => void; isDone?: boolean }> = (props) => {
	const [isJoined, setIsJoined] = createSignal(false);

	onMount(() => {
		const timer = setInterval(() => setIsJoined((j) => !j), 2200);
		onCleanup(() => clearInterval(timer));
	});

	return (
		<div class="bg-[#12141C]/80 backdrop-blur-xl border border-white/5 hover:border-white/15 rounded-[28px] p-5 flex flex-col gap-4 shadow-sm relative overflow-hidden transition-all">
			<div class="absolute -left-10 -top-10 w-32 h-32 bg-cyan-500/10 blur-3xl rounded-full pointer-events-none" />

			<div class="flex items-center justify-between relative z-10">
				<div class="flex items-center gap-2.5">
					<div class="w-9 h-9 rounded-[12px] bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
						<span class="material-symbols-outlined text-[20px]">how_to_reg</span>
					</div>
					<h3 class="text-[14px] font-black text-white">{t('groupLessons.mandatory.title')}</h3>
				</div>
				{props.isDone && (
					<span class="text-[10px] font-black text-[#10b981] bg-[#10b981]/10 border border-[#10b981]/25 px-2 py-0.5 rounded-[6px] flex items-center gap-1 uppercase tracking-wider">
						<span class="material-symbols-outlined text-[12px]">check_circle</span>
						{t('groupLessons.statusActive')}
					</span>
				)}
			</div>

			<p class="text-[12px] text-white/60 leading-relaxed font-medium relative z-10">
				{t('groupLessons.mandatory.desc')}
			</p>

			{/* Mandatory Channel Verification Demo */}
			<div class="h-28 bg-[#08090D] rounded-[20px] border border-white/5 p-3.5 flex items-center justify-between shadow-inner">
				<div class="flex items-center gap-3">
					<div class="w-10 h-10 rounded-[12px] bg-white/5 border border-white/10 flex items-center justify-center text-cyan-400">
						<span class="material-symbols-outlined text-[22px]">campaign</span>
					</div>
					<div class="flex flex-col">
						<span class="text-[12px] font-black text-white">{t('groupLessons.mandatory.channelRequired')}</span>
						<span class="text-[10px] font-bold text-white/40">{t('groupLessons.mandatory.joinStatus')}</span>
					</div>
				</div>

				<Motion.div
					animate={{ scale: isJoined() ? 1.08 : 1 }}
					class={`px-3 py-1.5 rounded-[10px] text-[10px] font-black uppercase border transition-all flex items-center gap-1 ${
						isJoined()
							? 'bg-[#10b981]/20 border-[#10b981]/40 text-[#10b981]'
							: 'bg-amber-400/15 border-amber-400/30 text-amber-400'
					}`}
				>
					<span class="material-symbols-outlined text-[14px]">
						{isJoined() ? 'check_circle' : 'lock'}
					</span>
					<span>{isJoined() ? t('groupLessons.mandatory.verified') : t('groupLessons.mandatory.joinToChat')}</span>
				</Motion.div>
			</div>

			<button
				onClick={props.onNavigate}
				class="w-full h-12 bg-white/5 border border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/10 rounded-[16px] text-[12px] font-black uppercase tracking-widest flex items-center justify-center gap-2 active:scale-95 transition-all"
			>
				{t('groupLessons.mandatory.cta')}
				<span class="material-symbols-outlined text-[18px] rtl:-scale-x-100">arrow_forward</span>
			</button>
		</div>
	);
};

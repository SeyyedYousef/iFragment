import { Motion } from '@motionone/solid';
import { Component, createSignal, onCleanup, onMount } from 'solid-js';
import { t } from '@/shared/i18n/index.js';

export const DynamicBioLessonCard: Component<{ onNavigate: () => void; isDone?: boolean }> = (props) => {
	const [membersCount, setMembersCount] = createSignal(12450);

	onMount(() => {
		const timer = setInterval(() => setMembersCount((m) => m + Math.floor(Math.random() * 5) + 1), 1500);
		onCleanup(() => clearInterval(timer));
	});

	return (
		<div class="bg-[#12141C]/80 backdrop-blur-xl border border-white/5 hover:border-white/15 rounded-[28px] p-5 flex flex-col gap-4 shadow-sm relative overflow-hidden transition-all">
			<div class="absolute -right-10 -top-10 w-32 h-32 bg-purple-500/10 blur-3xl rounded-full pointer-events-none" />

			<div class="flex items-center justify-between relative z-10">
				<div class="flex items-center gap-2.5">
					<div class="w-9 h-9 rounded-[12px] bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
						<span class="material-symbols-outlined text-[20px]">history_edu</span>
					</div>
					<h3 class="text-[14px] font-black text-white">{t('lessons.dynamicBio.title')}</h3>
				</div>
				{props.isDone && (
					<span class="text-[10px] font-black text-[#10b981] bg-[#10b981]/10 border border-[#10b981]/25 px-2 py-0.5 rounded-[6px] flex items-center gap-1 uppercase tracking-wider">
						<span class="material-symbols-outlined text-[12px]">check_circle</span>
						{t('lessons.statusActive')}
					</span>
				)}
			</div>

			<p class="text-[12px] text-white/60 leading-relaxed font-medium relative z-10">
				{t('lessons.dynamicBio.desc')}
			</p>

			{/* Dynamic Live Bio Simulation Demo */}
			<div class="h-28 bg-[#08090D] rounded-[20px] border border-white/5 p-3.5 flex flex-col justify-center gap-1.5 shadow-inner relative overflow-hidden">
				<span class="text-[9px] font-black text-purple-400 uppercase tracking-widest flex items-center gap-1">
					<span class="material-symbols-outlined text-[12px]">sync</span>
					{t('lessons.dynamicBio.autoUpdateLabel')}
				</span>
				<div class="bg-white/5 border border-white/10 rounded-[12px] p-2.5 flex items-center justify-between text-[11px] font-mono font-bold text-white/90">
					<span class="truncate">{t('lessons.dynamicBio.bioTemplate')}</span>
					<Motion.span
						initial={{ scale: 1.2, color: '#c084fc' }}
						animate={{ scale: 1, color: '#ffffff' }}
						class="text-purple-300 shrink-0 ml-2 font-black"
					>
						{membersCount().toLocaleString('en-US')}
					</Motion.span>
				</div>
			</div>

			<button
				onClick={props.onNavigate}
				class="w-full h-12 bg-white/5 border border-purple-500/30 text-purple-400 hover:bg-purple-500/10 rounded-[16px] text-[12px] font-black uppercase tracking-widest flex items-center justify-center gap-2 active:scale-95 transition-all"
			>
				{t('lessons.dynamicBio.cta')}
				<span class="material-symbols-outlined text-[18px] rtl:-scale-x-100">arrow_forward</span>
			</button>
		</div>
	);
};

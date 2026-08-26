import { Motion } from '@motionone/solid';
import { type Component, createSignal, onCleanup, onMount } from 'solid-js';
import { t } from '@/shared/i18n/index.js';

export const GroupDynamicBioLessonCard: Component<{ onNavigate: () => void; isDone?: boolean }> = (
	props,
) => {
	const [membersCount, setMembersCount] = createSignal(4320);

	onMount(() => {
		const timer = setInterval(
			() => setMembersCount((m) => m + Math.floor(Math.random() * 3) + 1),
			1600,
		);
		onCleanup(() => clearInterval(timer));
	});

	return (
		<div class="bg-[#12141C]/80 backdrop-blur-xl border border-white/5 hover:border-white/15 rounded-[28px] p-5 flex flex-col gap-4 shadow-sm relative overflow-hidden transition-all">
			<div class="absolute -left-10 -top-10 w-32 h-32 bg-cyan-500/10 blur-3xl rounded-full pointer-events-none" />

			<div class="flex items-center justify-between relative z-10">
				<div class="flex items-center gap-2.5">
					<div class="w-9 h-9 rounded-[12px] bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
						<span class="material-symbols-outlined text-[20px]">badge</span>
					</div>
					<h3 class="text-[14px] font-black text-white">{t('groupLessons.dynamicBio.title')}</h3>
				</div>
				{props.isDone && (
					<span class="text-[10px] font-black text-[#10b981] bg-[#10b981]/10 border border-[#10b981]/25 px-2 py-0.5 rounded-[6px] flex items-center gap-1 uppercase tracking-wider">
						<span class="material-symbols-outlined text-[12px]">check_circle</span>
						{t('groupLessons.statusActive')}
					</span>
				)}
			</div>

			<p class="text-[12px] text-white/60 leading-relaxed font-medium relative z-10">
				{t('groupLessons.dynamicBio.desc')}
			</p>

			{/* Group Dynamic Bio Demo */}
			<div class="h-28 bg-[#08090D] rounded-[20px] border border-white/5 p-3.5 flex flex-col justify-center gap-1.5 shadow-inner">
				<span class="text-[9px] font-black text-cyan-400 uppercase tracking-widest flex items-center gap-1">
					<span class="material-symbols-outlined text-[12px]">sync</span>
					{t('groupLessons.dynamicBio.autoUpdateLabel')}
				</span>
				<div class="bg-white/5 border border-white/10 rounded-[12px] p-2.5 flex items-center justify-between text-[11px] font-mono font-bold text-white/90">
					<span class="truncate">{t('groupLessons.dynamicBio.bioTemplate')}</span>
					<Motion.span
						initial={{ scale: 1.15, color: '#22d3ee' }}
						animate={{ scale: 1, color: '#ffffff' }}
						class="text-cyan-300 shrink-0 ml-2 font-black"
					>
						{membersCount().toLocaleString('en-US')}
					</Motion.span>
				</div>
			</div>

			<button
				type="button"
				onClick={props.onNavigate}
				class="w-full h-12 bg-white/5 border border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/10 rounded-[16px] text-[12px] font-black uppercase tracking-widest flex items-center justify-center gap-2 active:scale-95 transition-all"
			>
				{t('groupLessons.dynamicBio.cta')}
				<span class="material-symbols-outlined text-[18px] rtl:-scale-x-100">arrow_forward</span>
			</button>
		</div>
	);
};

import { Motion } from '@motionone/solid';
import { type Component, createSignal, onCleanup, onMount, Show } from 'solid-js';
import { t } from '@/shared/i18n/index.js';

export const AntiSpamLessonCard: Component<{ onNavigate: () => void; isDone?: boolean }> = (
	props,
) => {
	const [spamBlocked, setSpamBlocked] = createSignal(false);

	onMount(() => {
		const timer = setInterval(() => setSpamBlocked((b) => !b), 2200);
		onCleanup(() => clearInterval(timer));
	});

	return (
		<div class="bg-[#12141C]/80 backdrop-blur-xl border border-white/5 hover:border-white/15 rounded-[28px] p-5 flex flex-col gap-4 shadow-sm relative overflow-hidden transition-all">
			<div class="absolute -left-10 -bottom-10 w-32 h-32 bg-[#ff4a4a]/10 blur-3xl rounded-full pointer-events-none" />

			<div class="flex items-center justify-between relative z-10">
				<div class="flex items-center gap-2.5">
					<div class="w-9 h-9 rounded-[12px] bg-[#ff4a4a]/10 border border-[#ff4a4a]/20 flex items-center justify-center text-[#ff4a4a]">
						<span class="material-symbols-outlined text-[20px]">security</span>
					</div>
					<h3 class="text-[14px] font-black text-white">{t('groupLessons.antiSpam.title')}</h3>
				</div>
				{props.isDone && (
					<span class="text-[10px] font-black text-[#10b981] bg-[#10b981]/10 border border-[#10b981]/25 px-2 py-0.5 rounded-[6px] flex items-center gap-1 uppercase tracking-wider">
						<span class="material-symbols-outlined text-[12px]">check_circle</span>
						{t('groupLessons.statusActive')}
					</span>
				)}
			</div>

			<p class="text-[12px] text-white/60 leading-relaxed font-medium relative z-10">
				{t('groupLessons.antiSpam.desc')}
			</p>

			{/* Spam Interception Demo */}
			<div class="h-28 bg-[#08090D] rounded-[20px] border border-white/5 p-3 flex flex-col justify-center gap-2 shadow-inner overflow-hidden">
				<Show
					when={!spamBlocked()}
					fallback={
						<Motion.div
							initial={{ opacity: 0, scale: 0.9 }}
							animate={{ opacity: 1, scale: 1 }}
							class="p-2.5 bg-[#ff4a4a]/15 border border-[#ff4a4a]/30 rounded-[12px] flex items-center justify-between text-[11px] font-bold text-[#ff4a4a]"
						>
							<span class="flex items-center gap-1.5">
								<span class="material-symbols-outlined text-[16px]">block</span>
								{t('groupLessons.antiSpam.spamIntercepted')}
							</span>
							<span class="text-[9px] font-mono uppercase bg-[#ff4a4a]/20 border border-[#ff4a4a]/40 px-1.5 py-0.5 rounded-[4px]">
								{t('groupLessons.antiSpam.deleted')}
							</span>
						</Motion.div>
					}
				>
					<Motion.div
						initial={{ opacity: 0, y: 5 }}
						animate={{ opacity: 1, y: 0 }}
						class="p-2.5 bg-white/5 border border-white/10 rounded-[12px] flex items-center justify-between text-[11px] font-bold text-white/70"
					>
						<span class="truncate">{t('groupLessons.antiSpam.spamMsgSample')}</span>
						<span class="material-symbols-outlined text-[16px] text-amber-400">warning</span>
					</Motion.div>
				</Show>
			</div>

			<button
				type="button"
				onClick={props.onNavigate}
				class="w-full h-12 bg-white/5 border border-[#ff4a4a]/30 text-[#ff4a4a] hover:bg-[#ff4a4a]/10 rounded-[16px] text-[12px] font-black uppercase tracking-widest flex items-center justify-center gap-2 active:scale-95 transition-all"
			>
				{t('groupLessons.antiSpam.cta')}
				<span class="material-symbols-outlined text-[18px] rtl:-scale-x-100">arrow_forward</span>
			</button>
		</div>
	);
};

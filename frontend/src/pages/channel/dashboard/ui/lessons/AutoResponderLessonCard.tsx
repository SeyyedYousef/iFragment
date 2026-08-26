import { Motion } from '@motionone/solid';
import { type Component, createSignal, onCleanup, onMount, Show } from 'solid-js';
import { t } from '@/shared/i18n/index.js';

export const AutoResponderLessonCard: Component<{ onNavigate: () => void; isDone?: boolean }> = (
	props,
) => {
	const [replyStep, setReplyStep] = createSignal(0);

	onMount(() => {
		const timer = setInterval(() => setReplyStep((s) => (s + 1) % 2), 2400);
		onCleanup(() => clearInterval(timer));
	});

	return (
		<div class="bg-[#12141C]/80 backdrop-blur-xl border border-white/5 hover:border-white/15 rounded-[28px] p-5 flex flex-col gap-4 shadow-sm relative overflow-hidden transition-all">
			<div class="absolute -left-10 -top-10 w-32 h-32 bg-[#3390ec]/10 blur-3xl rounded-full pointer-events-none" />

			<div class="flex items-center justify-between relative z-10">
				<div class="flex items-center gap-2.5">
					<div class="w-9 h-9 rounded-[12px] bg-[#3390ec]/10 border border-[#3390ec]/20 flex items-center justify-center text-[#3390ec]">
						<span class="material-symbols-outlined text-[20px]">quickreply</span>
					</div>
					<h3 class="text-[14px] font-black text-white">{t('lessons.autoResponder.title')}</h3>
				</div>
				{props.isDone && (
					<span class="text-[10px] font-black text-[#10b981] bg-[#10b981]/10 border border-[#10b981]/25 px-2 py-0.5 rounded-[6px] flex items-center gap-1 uppercase tracking-wider">
						<span class="material-symbols-outlined text-[12px]">check_circle</span>
						{t('lessons.statusActive')}
					</span>
				)}
			</div>

			<p class="text-[12px] text-white/60 leading-relaxed font-medium relative z-10">
				{t('lessons.autoResponder.desc')}
			</p>

			{/* Chat Simulation Demo */}
			<div class="h-28 bg-[#08090D] rounded-[20px] border border-white/5 p-3 flex flex-col justify-end gap-2 shadow-inner overflow-hidden relative">
				<div class="self-start bg-white/10 border border-white/10 text-white/80 rounded-[14px] rounded-bl-[4px] px-3 py-1.5 text-[11px] font-bold max-w-[80%] flex items-center gap-1.5">
					<span class="material-symbols-outlined text-[14px] text-white/40">account_circle</span>
					<span>{t('lessons.autoResponder.userQuestion')}</span>
				</div>

				<Show when={replyStep() === 1}>
					<Motion.div
						initial={{ opacity: 0, y: 8, scale: 0.95 }}
						animate={{ opacity: 1, y: 0, scale: 1 }}
						transition={{ duration: 0.4 }}
						class="self-end bg-[#3390ec]/20 border border-[#3390ec]/40 text-white rounded-[14px] rounded-br-[4px] px-3 py-1.5 text-[11px] font-bold max-w-[85%] flex items-center gap-1.5 shadow-[0_4px_12px_rgba(51,144,236,0.2)]"
					>
						<span class="material-symbols-outlined text-[14px] text-[#3390ec]">smart_toy</span>
						<span>{t('lessons.autoResponder.botResponse')}</span>
					</Motion.div>
				</Show>
			</div>

			<button
				type="button"
				onClick={props.onNavigate}
				class="w-full h-12 bg-white/5 border border-[#3390ec]/30 text-[#3390ec] hover:bg-[#3390ec]/10 rounded-[16px] text-[12px] font-black uppercase tracking-widest flex items-center justify-center gap-2 active:scale-95 transition-all"
			>
				{t('lessons.autoResponder.cta')}
				<span class="material-symbols-outlined text-[18px] rtl:-scale-x-100">arrow_forward</span>
			</button>
		</div>
	);
};

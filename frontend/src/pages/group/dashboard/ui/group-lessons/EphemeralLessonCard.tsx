import { Motion } from '@motionone/solid';
import { type Component, createSignal, onCleanup, onMount, Show } from 'solid-js';
import { t } from '@/shared/i18n/index.js';

export const EphemeralLessonCard: Component<{ onNavigate: () => void; isDone?: boolean }> = (
	props,
) => {
	const [visible, setVisible] = createSignal(true);
	const [countdown, setCountdown] = createSignal(3);

	onMount(() => {
		const loop = setInterval(() => {
			setVisible((v) => !v);
			setCountdown(3);
		}, 3500);
		const tick = setInterval(() => setCountdown((c) => (c > 0 ? c - 1 : 0)), 1000);
		onCleanup(() => {
			clearInterval(loop);
			clearInterval(tick);
		});
	});

	return (
		<div class="bg-[#12141C]/80 backdrop-blur-xl border border-white/5 hover:border-white/15 rounded-[28px] p-5 flex flex-col gap-4 shadow-sm relative overflow-hidden transition-all">
			<div class="absolute -left-10 -top-10 w-32 h-32 bg-sky-500/10 blur-3xl rounded-full pointer-events-none" />

			<div class="flex items-center justify-between relative z-10">
				<div class="flex items-center gap-2.5">
					<div class="w-9 h-9 rounded-[12px] bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400">
						<span class="material-symbols-outlined text-[20px]">visibility_off</span>
					</div>
					<h3 class="text-[14px] font-black text-white">{t('groupLessons.ephemeral.title')}</h3>
				</div>
				{props.isDone && (
					<span class="text-[10px] font-black text-[#10b981] bg-[#10b981]/10 border border-[#10b981]/25 px-2 py-0.5 rounded-[6px] flex items-center gap-1 uppercase tracking-wider">
						<span class="material-symbols-outlined text-[12px]">check_circle</span>
						{t('groupLessons.statusActive')}
					</span>
				)}
			</div>

			<p class="text-[12px] text-white/60 leading-relaxed font-medium relative z-10">
				{t('groupLessons.ephemeral.desc')}
			</p>

			{/* Ephemeral Message Disappearing Demo */}
			<div class="h-28 bg-[#08090D] rounded-[20px] border border-white/5 p-3.5 flex flex-col justify-end gap-2 shadow-inner overflow-hidden">
				<div class="self-end bg-[#3390ec]/20 border border-[#3390ec]/30 rounded-[12px] rounded-br-[4px] px-3 py-1.5 text-[11px] font-bold text-white/80">
					{t('groupLessons.ephemeral.demoUserJoined')}
				</div>

				<Show when={visible()}>
					<Motion.div
						initial={{ opacity: 0, y: 8, scale: 0.95 }}
						animate={{ opacity: 1, y: 0, scale: 1 }}
						transition={{ duration: 0.4 }}
						class="self-start bg-white/5 border border-white/10 rounded-[12px] rounded-bl-[4px] px-3 py-1.5 flex items-center gap-2"
					>
						<span class="text-[11px] font-bold text-white/70">
							{t('groupLessons.ephemeral.demoWelcome')}
						</span>
						<span class="text-[9px] font-mono font-black text-sky-400 bg-sky-400/10 border border-sky-400/20 rounded-[5px] px-1.5 py-0.5">
							{countdown()}s
						</span>
					</Motion.div>
				</Show>
			</div>

			<button
				type="button"
				onClick={props.onNavigate}
				class="w-full h-12 bg-white/5 border border-sky-400/30 text-sky-400 hover:bg-sky-400/10 rounded-[16px] text-[12px] font-black uppercase tracking-widest flex items-center justify-center gap-2 active:scale-95 transition-all"
			>
				{t('groupLessons.ephemeral.cta')}
				<span class="material-symbols-outlined text-[18px] rtl:-scale-x-100">arrow_forward</span>
			</button>
		</div>
	);
};

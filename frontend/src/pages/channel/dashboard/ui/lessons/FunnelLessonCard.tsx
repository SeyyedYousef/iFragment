import { Motion } from '@motionone/solid';
import { type Component, createSignal, onCleanup, onMount } from 'solid-js';
import { isRtl, t } from '@/shared/i18n/index.js';

export const FunnelLessonCard: Component<{ onNavigate: () => void; isDone?: boolean }> = (
	props,
) => {
	const [stage, setStage] = createSignal(0);

	onMount(() => {
		const timer = setInterval(() => setStage((s) => (s + 1) % 3), 1800);
		onCleanup(() => clearInterval(timer));
	});

	const msgPosition = () => {
		const pos = ['0%', '38%', '76%'];
		return isRtl() ? pos[2 - stage()] : pos[stage()];
	};

	return (
		<div class="bg-[#12141C]/80 backdrop-blur-xl border border-white/5 hover:border-white/15 rounded-[28px] p-5 flex flex-col gap-4 shadow-sm relative overflow-hidden transition-all group">
			<div class="absolute -right-10 -top-10 w-32 h-32 bg-[#06b6d4]/10 blur-3xl rounded-full pointer-events-none" />

			{/* Title & Badge */}
			<div class="flex items-center justify-between relative z-10">
				<div class="flex items-center gap-2.5">
					<div class="w-9 h-9 rounded-[12px] bg-[#06b6d4]/10 border border-[#06b6d4]/20 flex items-center justify-center text-[#06b6d4]">
						<span class="material-symbols-outlined text-[20px]">account_tree</span>
					</div>
					<h3 class="text-[14px] font-black text-white">{t('lessons.funnel.title')}</h3>
				</div>
				{props.isDone && (
					<span class="text-[10px] font-black text-[#10b981] bg-[#10b981]/10 border border-[#10b981]/25 px-2 py-0.5 rounded-[6px] flex items-center gap-1 uppercase tracking-wider">
						<span class="material-symbols-outlined text-[12px]">check_circle</span>
						{t('lessons.statusActive')}
					</span>
				)}
			</div>

			<p class="text-[12px] text-white/60 leading-relaxed font-medium relative z-10">
				{t('lessons.funnel.desc')}
			</p>

			{/* Interactive Animated Demo */}
			<div
				class="relative h-24 bg-[#08090D] rounded-[20px] border border-white/5 p-3 shadow-inner overflow-hidden"
				dir="ltr"
			>
				<div class="absolute inset-3 flex items-center justify-between">
					{[
						{
							icon: 'edit_note',
							label: t('lessons.funnel.stageDraft'),
							active: stage() === 0,
							color: '#ffffff',
						},
						{
							icon: 'bolt',
							label: t('lessons.funnel.stageProcess'),
							active: stage() === 1,
							color: '#06b6d4',
						},
						{
							icon: 'campaign',
							label: t('lessons.funnel.stagePublic'),
							active: stage() === 2,
							color: '#10b981',
						},
					].map((s) => (
						<div class="flex flex-col items-center gap-1.5 w-16">
							<div
								class="w-10 h-10 rounded-[12px] flex items-center justify-center border transition-all duration-500"
								style={{
									'border-color': s.active ? s.color : 'rgba(255,255,255,0.1)',
									background: s.active ? `${s.color}20` : 'rgba(255,255,255,0.03)',
									'box-shadow': s.active ? `0 0 20px ${s.color}40` : 'none',
									transform: s.active ? 'scale(1.08)' : 'scale(1)',
								}}
							>
								<span
									class="material-symbols-outlined text-[20px]"
									style={{ color: s.active ? s.color : 'rgba(255,255,255,0.3)' }}
								>
									{s.icon}
								</span>
							</div>
							<span class="text-[8px] font-black uppercase tracking-widest text-white/40 truncate w-full text-center">
								{s.label}
							</span>
						</div>
					))}
				</div>

				<Motion.div
					animate={{ left: msgPosition(), opacity: [0.5, 1] }}
					transition={{ duration: 0.7, easing: [0.22, 1, 0.36, 1] }}
					class="absolute top-1 w-8 h-6 bg-[#3390ec] rounded-[8px] flex items-center justify-center shadow-[0_4px_12px_rgba(51,144,236,0.5)] z-20"
				>
					<span class="material-symbols-outlined text-white text-[14px]">chat</span>
				</Motion.div>
			</div>

			{/* CTA */}
			<button
				type="button"
				onClick={props.onNavigate}
				class="w-full h-12 bg-gradient-to-r from-[#06b6d4] to-[#0284c7] hover:from-[#0284c7] hover:to-[#06b6d4] text-white rounded-[16px] text-[12px] font-black uppercase tracking-widest flex items-center justify-center gap-2 active:scale-95 transition-all shadow-[0_4px_20px_rgba(6,182,212,0.25)] border border-white/10"
			>
				{t('lessons.funnel.cta')}
				<span class="material-symbols-outlined text-[18px] rtl:-scale-x-100">arrow_forward</span>
			</button>
		</div>
	);
};

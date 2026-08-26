import { type Component, createSignal, onCleanup, onMount } from 'solid-js';
import { t } from '@/shared/i18n/index.js';

export const PostingLessonCard: Component<{ onNavigate: () => void; isDone?: boolean }> = (
	props,
) => {
	const [activeTab, setActiveTab] = createSignal(0);

	onMount(() => {
		const timer = setInterval(() => setActiveTab((t) => (t + 1) % 3), 2000);
		onCleanup(() => clearInterval(timer));
	});

	return (
		<div class="bg-[#12141C]/80 backdrop-blur-xl border border-white/5 hover:border-white/15 rounded-[28px] p-5 flex flex-col gap-4 shadow-sm relative overflow-hidden transition-all">
			<div class="absolute -right-10 -bottom-10 w-32 h-32 bg-[#10b981]/10 blur-3xl rounded-full pointer-events-none" />

			<div class="flex items-center justify-between relative z-10">
				<div class="flex items-center gap-2.5">
					<div class="w-9 h-9 rounded-[12px] bg-[#10b981]/10 border border-[#10b981]/20 flex items-center justify-center text-[#10b981]">
						<span class="material-symbols-outlined text-[20px]">smart_toy</span>
					</div>
					<h3 class="text-[14px] font-black text-white">{t('lessons.posting.title')}</h3>
				</div>
				{props.isDone && (
					<span class="text-[10px] font-black text-[#10b981] bg-[#10b981]/10 border border-[#10b981]/25 px-2 py-0.5 rounded-[6px] flex items-center gap-1 uppercase tracking-wider">
						<span class="material-symbols-outlined text-[12px]">check_circle</span>
						{t('lessons.statusActive')}
					</span>
				)}
			</div>

			<p class="text-[12px] text-white/60 leading-relaxed font-medium relative z-10">
				{t('lessons.posting.desc')}
			</p>

			{/* Interactive Features Carousel Demo */}
			<div class="h-28 bg-[#08090D] rounded-[20px] border border-white/5 p-3 flex flex-col justify-between shadow-inner">
				<div class="flex items-center justify-around border-b border-white/5 pb-2">
					{[
						{ icon: 'bolt', label: t('lessons.posting.instant') },
						{ icon: 'branding_watermark', label: t('lessons.posting.watermark') },
						{ icon: 'auto_awesome', label: t('lessons.posting.formatting') },
					].map((item, idx) => (
						<div
							class={`flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-[8px] transition-all ${
								activeTab() === idx
									? 'bg-[#10b981]/20 border border-[#10b981]/40 text-[#10b981]'
									: 'text-white/40'
							}`}
						>
							<span class="material-symbols-outlined text-[14px]">{item.icon}</span>
							<span>{item.label}</span>
						</div>
					))}
				</div>

				<div class="flex items-center justify-between px-2 text-[11px] font-bold text-white/70">
					<span class="flex items-center gap-1.5">
						<span class="w-2 h-2 rounded-full bg-[#10b981] animate-ping" />
						{activeTab() === 0 && t('lessons.posting.demoInstantText')}
						{activeTab() === 1 && t('lessons.posting.demoWatermarkText')}
						{activeTab() === 2 && t('lessons.posting.demoFormattingText')}
					</span>
					<span class="material-symbols-outlined text-[18px] text-[#10b981]">check</span>
				</div>
			</div>

			<button
				type="button"
				onClick={props.onNavigate}
				class="w-full h-12 bg-white/5 border border-[#10b981]/30 text-[#10b981] hover:bg-[#10b981]/10 rounded-[16px] text-[12px] font-black uppercase tracking-widest flex items-center justify-center gap-2 active:scale-95 transition-all"
			>
				{t('lessons.posting.cta')}
				<span class="material-symbols-outlined text-[18px] rtl:-scale-x-100">arrow_forward</span>
			</button>
		</div>
	);
};

import { Motion } from '@motionone/solid';
import { useNavigate } from '@solidjs/router';
import { Component, createEffect, createSignal, Show } from 'solid-js';
import { isRtl, t } from '@/shared/i18n/index.js';
import { haptic } from '@/shared/lib/haptic.js';
import { lastDemoAction, useDemoMode } from '@/shared/lib/demo-mode.js';
import { resetDemoState } from '@/shared/api/demo-fixtures.js';

export const DemoBanner: Component = () => {
	const demo = useDemoMode();
	const navigate = useNavigate();
	const [expanded, setExpanded] = createSignal(true);
	const [flash, setFlash] = createSignal<string | null>(null);

	// پیام لحظه‌ای هنگام تغییر تنظیمات در دمو
	createEffect(() => {
		const action = lastDemoAction();
		if (!action || !demo().active) return;
		setFlash(action.kind === 'locked' ? t('demo.lockedAction') : t('demo.savedLocally'));
		const id = setTimeout(() => setFlash(null), 2600);
		return () => clearTimeout(id);
	});

	const exitDemo = () => {
		haptic.impact('light');
		resetDemoState();
		navigate(demo().kind === 'channel' ? '/managed-channels' : '/managed-bots');
	};

	return (
		<Show when={demo().active}>
			<Motion.div
				initial={{ opacity: 0, y: 30 }}
				animate={{ opacity: 1, y: 0 }}
				transition={{ duration: 0.35, easing: [0.32, 0.72, 0, 1] }}
				dir={isRtl() ? 'rtl' : 'ltr'}
				class="fixed bottom-4 inset-x-0 z-[60] px-4 pointer-events-none"
				style={{ 'padding-bottom': 'env(safe-area-inset-bottom)' }}
			>
				<div class="max-w-md mx-auto pointer-events-auto rounded-[22px] border border-amber-400/30 bg-[#12141C]/95 backdrop-blur-2xl shadow-[0_18px_50px_rgba(0,0,0,0.7)] overflow-hidden">
					<div class="flex items-center gap-3 px-4 py-3">
						<div class="w-9 h-9 rounded-[12px] bg-amber-400/15 border border-amber-400/30 flex items-center justify-center shrink-0">
							<span class="material-symbols-outlined text-amber-400 text-[20px]">science</span>
						</div>
						<div class="flex-1 min-w-0">
							<p class="text-[12px] font-black text-amber-300 truncate">
								{demo().kind === 'channel' ? t('demo.channelTitle') : t('demo.groupTitle')}
							</p>
							<p class="text-[11px] text-white/50 font-medium truncate">
								{flash() ?? t('demo.subtitle')}
							</p>
						</div>
						<button
							onClick={() => { haptic.impact('light'); setExpanded(!expanded()); }}
							class="w-8 h-8 rounded-[10px] flex items-center justify-center text-white/40 hover:text-white hover:bg-white/5 transition-colors shrink-0"
							aria-label={t('common.more' as any)}
						>
							<span class={`material-symbols-outlined text-[20px] transition-transform ${expanded() ? 'rotate-180' : ''}`}>
								expand_less
							</span>
						</button>
					</div>

					<Show when={expanded()}>
						<div class="px-4 pb-4 pt-1 border-t border-white/5 flex flex-col gap-3">
							<p class="text-[11.5px] leading-relaxed text-white/60 font-medium">
								{t('demo.explainer')}
							</p>
							<div class="flex gap-2">
								<button
									onClick={() => {
										haptic.impact('medium');
										navigate(demo().kind === 'channel' ? '/channel/connect' : '/managed-bots');
									}}
									class="flex-1 h-11 rounded-[14px] bg-gradient-to-r from-[#3390ec] to-[#2b7bc9] text-white text-[12px] font-black uppercase tracking-wider active:scale-95 transition-all flex items-center justify-center gap-1.5 border border-white/10"
								>
									<span class="material-symbols-outlined text-[18px]">rocket_launch</span>
									{demo().kind === 'channel' ? t('demo.ctaChannel') : t('demo.ctaGroup')}
								</button>
								<button
									onClick={exitDemo}
									class="h-11 px-4 rounded-[14px] bg-white/5 hover:bg-white/10 text-white/60 text-[12px] font-bold active:scale-95 transition-all border border-white/5"
								>
									{t('demo.exit')}
								</button>
							</div>
						</div>
					</Show>
				</div>
			</Motion.div>
		</Show>
	);
};

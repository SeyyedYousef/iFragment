import { Motion } from '@motionone/solid';
import { type Component, createSignal, For, Show } from 'solid-js';
import { t } from '@/shared/i18n/index.js';
import { haptic } from '@/shared/lib/haptic.js';
import { showToast } from '@/shared/ui/index.js';

export interface CardInlineBtn {
	id: string;
	title: string;
	value: string;
	type: 'url' | 'counter' | 'share' | 'webapp' | 'payment';
	style: 'default' | 'primary' | 'success' | 'danger' | 'amber' | 'cyan';
	emoji: string;
	count?: number;
}

interface ProjectInlineButtonsCardProps {
	projectId: string;
	isActive: boolean;
	target: 'input' | 'output' | 'both';
	buttonCount: number;
	configuredButtons?: CardInlineBtn[];
	isSingleChannel?: boolean;
	onToggleActive: (active: boolean) => void;
	onCycleTarget: (nextTarget: 'input' | 'output' | 'both') => void;
	onNavigate: () => void;
}

export const ProjectInlineButtonsCard: Component<ProjectInlineButtonsCardProps> = (props) => {
	// Presets definitions
	const presets: Record<string, CardInlineBtn[]> = {
		multi: [
			{ id: '1', title: 'عضویت ویژه', value: 'https://t.me/iFragmentBot', type: 'url', style: 'primary', emoji: '💎' },
			{ id: '2', title: 'خرید اشتراک', value: 'buy_sub', type: 'payment', style: 'amber', emoji: '🛒' },
			{ id: '3', title: 'تایید و پسندیدم', value: 'like', type: 'counter', style: 'success', emoji: '👍', count: 142 },
			{ id: '4', title: 'گزارش تخلف', value: 'report', type: 'share', style: 'danger', emoji: '⚠️' },
		],
		reactions: [
			{ id: 'r1', title: 'عالی بود', value: 'like', type: 'counter', style: 'success', emoji: '🔥', count: 328 },
			{ id: 'r2', title: 'مفید بود', value: 'helpful', type: 'counter', style: 'cyan', emoji: '💡', count: 95 },
			{ id: 'r3', title: 'اشتراک‌گذاری', value: 'share', type: 'share', style: 'primary', emoji: '📢' },
			{ id: 'r4', title: 'نپسندیدم', value: 'dislike', type: 'counter', style: 'danger', emoji: '👎', count: 4 },
		],
		store: [
			{ id: 's1', title: 'خرید مستقیم با تون', value: 'https://fragment.com', type: 'payment', style: 'amber', emoji: '⚡' },
			{ id: 's2', title: 'ورود به مینی‌اپ', value: 'https://t.me/iFragmentBot', type: 'webapp', style: 'cyan', emoji: '📱' },
			{ id: 's3', title: 'پشتیبانی فروش', value: 'https://t.me/support', type: 'url', style: 'primary', emoji: '💬' },
		],
	};

	const [activePresetKey, setActivePresetKey] = createSignal<'multi' | 'reactions' | 'store'>('multi');
	const [activeBtnId, setActiveBtnId] = createSignal<string | null>(null);
	const [buttonsState, setButtonsState] = createSignal<CardInlineBtn[]>(presets.multi);

	// Display buttons: either real configured buttons from project or active preset
	const currentButtons = () => {
		if (props.configuredButtons && props.configuredButtons.length > 0) {
			const colorPalette: CardInlineBtn['style'][] = ['primary', 'success', 'amber', 'cyan', 'danger', 'default'];
			return props.configuredButtons.map((b, idx) => ({
				id: b.id || `btn_${idx}`,
				title: b.title,
				value: b.value,
				type: b.type || 'url',
				style: (b.style && b.style !== 'default') ? b.style : colorPalette[idx % (colorPalette.length - 1)],
				emoji: b.emoji || '',
				count: b.count !== undefined ? b.count : (b.type === 'counter' ? 24 : undefined),
			}));
		}
		return buttonsState();
	};

	const switchPreset = (key: 'multi' | 'reactions' | 'store') => {
		haptic.impact('light');
		setActivePresetKey(key);
		setButtonsState(presets[key]);
	};

	const handleBtnClick = (btn: CardInlineBtn) => {
		haptic.impact('medium');
		setActiveBtnId(btn.id);

		if (btn.type === 'counter') {
			setButtonsState((prev) =>
				prev.map((b) => (b.id === btn.id ? { ...b, count: (b.count || 0) + 1 } : b)),
			);
			showToast(`${btn.emoji || '👍'} +1 (${(btn.count || 0) + 1})`, 'info');
		} else if (btn.type === 'share') {
			showToast(t('channelInlineButtons.shareBtn') || 'Share link triggered', 'info');
		} else if (btn.type === 'payment') {
			showToast(t('channelInlineButtons.typePay') || 'Opening payment checkout...', 'success');
		} else {
			showToast(`${btn.emoji || '🔗'} ${btn.title}`, 'info');
		}

		setTimeout(() => setActiveBtnId(null), 300);
	};

	const getStyleClasses = (style: string, isClicked: boolean) => {
		switch (style) {
			case 'primary':
				return isClicked
					? 'bg-[#3390ec] text-white border-[#3390ec] shadow-[0_0_20px_rgba(51,144,236,0.6)] scale-[0.97]'
					: 'bg-[#3390ec]/25 hover:bg-[#3390ec]/35 text-sky-200 border-[#3390ec]/45 shadow-[0_2px_10px_rgba(51,144,236,0.25)]';
			case 'success':
				return isClicked
					? 'bg-emerald-500 text-white border-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.6)] scale-[0.97]'
					: 'bg-emerald-500/25 hover:bg-emerald-500/35 text-emerald-200 border-emerald-500/45 shadow-[0_2px_10px_rgba(16,185,129,0.25)]';
			case 'danger':
				return isClicked
					? 'bg-rose-500 text-white border-rose-400 shadow-[0_0_20px_rgba(244,63,94,0.6)] scale-[0.97]'
					: 'bg-rose-500/25 hover:bg-rose-500/35 text-rose-200 border-rose-500/45 shadow-[0_2px_10px_rgba(244,63,94,0.25)]';
			case 'amber':
				return isClicked
					? 'bg-amber-500 text-black border-amber-400 shadow-[0_0_20px_rgba(245,158,11,0.6)] scale-[0.97]'
					: 'bg-amber-500/25 hover:bg-amber-500/35 text-amber-200 border-amber-500/45 shadow-[0_2px_10px_rgba(245,158,11,0.25)]';
			case 'cyan':
				return isClicked
					? 'bg-cyan-500 text-black border-cyan-400 shadow-[0_0_20px_rgba(6,182,212,0.6)] scale-[0.97]'
					: 'bg-cyan-500/25 hover:bg-cyan-500/35 text-cyan-200 border-cyan-500/45 shadow-[0_2px_10px_rgba(6,182,212,0.25)]';
			case 'default':
			default:
				return isClicked
					? 'bg-white/30 text-white border-white/40 scale-[0.97]'
					: 'bg-white/10 hover:bg-white/15 text-white/90 border-white/15 shadow-sm';
		}
	};

	const targetLabel = () => {
		if (props.target === 'input') return t('channelProjects.dashboard.targetInput');
		if (props.target === 'both') return t('channelProjects.dashboard.targetBoth');
		return t('channelProjects.dashboard.targetOutput');
	};

	const targetIcon = () => {
		if (props.target === 'input') return 'arrow_downward';
		if (props.target === 'both') return 'sync';
		return 'arrow_upward';
	};

	return (
		<div class="bg-[#12141C]/85 backdrop-blur-xl border border-white/10 hover:border-[#3390ec]/40 rounded-[26px] p-5 flex flex-col gap-4 shadow-lg relative overflow-hidden transition-all duration-300 group">
			{/* Ambient Ambient Glow */}
			<div class="absolute -right-12 -top-12 w-40 h-40 bg-gradient-to-br from-[#3390ec]/20 via-cyan-500/15 to-transparent blur-3xl rounded-full pointer-events-none" />

			{/* Header & Controls */}
			<div class="flex items-start justify-between gap-3 relative z-10">
				<div class="flex items-center gap-3 min-w-0">
					<div
						class={`w-11 h-11 rounded-[14px] flex items-center justify-center shrink-0 border transition-all ${
							props.isActive
								? 'bg-[#3390ec]/20 border-[#3390ec]/40 text-[#3390ec] shadow-[0_0_15px_rgba(51,144,236,0.3)]'
								: 'bg-white/5 border-white/10 text-white/50'
						}`}
					>
						<span class="material-symbols-outlined text-[24px]">smart_button</span>
					</div>
					<div class="flex flex-col min-w-0">
						<div class="flex items-center gap-2 flex-wrap">
							<h3 class="text-[15px] font-black text-white group-hover:text-[#3390ec] transition-colors">
								{t('channelProjects.dashboard.featureButtons')}
							</h3>
							<span class="text-[9px] font-black px-2 py-0.5 rounded-full bg-[#3390ec]/15 text-[#3390ec] border border-[#3390ec]/30 flex items-center gap-1">
								<span class="w-1.5 h-1.5 rounded-full bg-[#3390ec] animate-ping" />
								<span>چندرنگ و استایل شیشه‌ای</span>
							</span>
						</div>
						<p class="text-[11px] text-white/50 leading-relaxed font-medium mt-0.5 line-clamp-1">
							{t('channelProjects.dashboard.featureButtonsDesc')}
						</p>
					</div>
				</div>

				{/* Quick Controls: Target Switcher & Power Switch */}
				<div class="flex items-center gap-2 shrink-0">
					<Show when={!props.isSingleChannel}>
						<button
							type="button"
							onClick={(e) => {
								e.stopPropagation();
								haptic.impact('medium');
								const next = props.target === 'input' ? 'output' : props.target === 'output' ? 'both' : 'input';
								props.onCycleTarget(next);
							}}
							class="h-8 px-2.5 rounded-full bg-[#3390ec]/15 hover:bg-[#3390ec]/25 border border-[#3390ec]/30 text-[#3390ec] flex items-center gap-1 text-[10px] font-black transition-all active:scale-95"
							title={t('channelProjects.targetSelector.subtitle')}
						>
							<span class="material-symbols-outlined text-[13px]">{targetIcon()}</span>
							<span>{targetLabel()}</span>
						</button>
					</Show>

					{/* Switch Toggle */}
					<button
						type="button"
						role="switch"
						aria-checked={props.isActive}
						onClick={(e) => {
							e.stopPropagation();
							haptic.impact('medium');
							props.onToggleActive(!props.isActive);
						}}
						class={`w-12 h-7 rounded-full p-0.5 transition-colors duration-300 flex items-center border ${
							props.isActive
								? 'bg-[#3390ec]/30 border-[#3390ec]/60 justify-end'
								: 'bg-white/10 border-white/15 justify-start'
						}`}
					>
						<span
							class={`w-5 h-5 rounded-full transition-transform duration-300 shadow-md ${
								props.isActive
									? 'bg-[#3390ec] shadow-[0_0_10px_rgba(51,144,236,0.6)]'
									: 'bg-white/40'
							}`}
						/>
					</button>
				</div>
			</div>

			{/* ═══════ PRESET SELECTOR CHIPS ═══════ */}
			<div class="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
				{[
					{ key: 'multi', label: '🎨 چندرنگ ترکیبی', icon: 'palette' },
					{ key: 'reactions', label: '🔥 تعاملی و ری‌اکشن', icon: 'thumb_up' },
					{ key: 'store', label: '🛒 فروشگاه و پرداخت', icon: 'shopping_bag' },
				].map((preset) => (
					<button
						type="button"
						onClick={() => switchPreset(preset.key as any)}
						class={`px-2.5 py-1 rounded-[10px] text-[10px] font-black whitespace-nowrap transition-all flex items-center gap-1 border ${
							activePresetKey() === preset.key
								? 'bg-white/20 text-white border-white/30 shadow-sm'
								: 'bg-white/5 text-white/50 border-white/5 hover:text-white hover:bg-white/10'
						}`}
					>
						<span>{preset.label}</span>
					</button>
				))}
			</div>

			{/* ═══════ REAL TELEGRAM POST SIMULATOR WITH MULTI-COLOR GLASS BUTTONS ═══════ */}
			<div class="bg-gradient-to-br from-[#121c26] via-[#0d141b] to-[#070b0e] rounded-[22px] border border-[#233547] p-3.5 flex flex-col gap-2.5 shadow-inner relative overflow-hidden">
				{/* Top Telegram Info Header */}
				<div class="flex items-center justify-between text-[10px] font-mono">
					<div class="flex items-center gap-1.5 text-cyan-400 font-bold">
						<span class="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
						<span>{t('channelProjects.dashboard.liveDemo')}</span>
					</div>
					<span class="text-white/40 font-mono">Telegram Post Preview</span>
				</div>

				{/* Realistic Telegram Message Bubble */}
				<div class="bg-[#24374a]/90 backdrop-blur-md border border-white/10 rounded-[18px] rounded-br-[4px] p-3.5 flex flex-col gap-2 shadow-md text-white/95">
					<div class="flex items-center justify-between text-[11px] text-cyan-300 font-bold">
						<span class="flex items-center gap-1.5">
							<span class="material-symbols-outlined text-[15px] text-cyan-400">verified</span>
							<span>iFragment News Official</span>
						</span>
						<span class="text-[9px] font-mono text-white/40">#1084</span>
					</div>

					<p class="text-[12px] text-white/90 leading-relaxed font-sans">
						{t('channelInlineButtons.mockPostText') ||
							'🚀 رونمایی از قابلیت‌های جدید و دکمه‌های چندرنگ هوشمند iFragment! دکمه‌های شیشه‌ای با استایل‌های مختلف را تست کنید:'}
					</p>

					<div class="flex items-center justify-end gap-1 text-[10px] font-mono text-white/50">
						<span>{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
						<span class="material-symbols-outlined text-[14px] text-cyan-400">done_all</span>
					</div>
				</div>

				{/* 🌟 Dynamic Multi-Color Glass Buttons Grid 🌟 */}
				<div class="grid grid-cols-2 gap-1.5 w-full pt-1">
					<For each={currentButtons()}>
						{(btn) => {
							const isClicked = () => activeBtnId() === btn.id;
							return (
								<button
									type="button"
									onClick={() => handleBtnClick(btn)}
									class={`h-10 px-2.5 rounded-[12px] text-[11px] font-black flex items-center justify-center gap-1.5 border backdrop-blur-md transition-all duration-200 active:scale-95 select-none ${getStyleClasses(
										btn.style,
										isClicked(),
									)}`}
								>
									<Show when={btn.emoji}>
										<span class="text-[14px] shrink-0">{btn.emoji}</span>
									</Show>
									<span class="truncate">{btn.title}</span>
									<Show when={btn.type === 'counter' && btn.count !== undefined}>
										<span class="text-[9px] font-mono px-1.5 py-0.2 rounded-full bg-black/30 border border-white/10 shrink-0">
											{btn.count}
										</span>
									</Show>
								</button>
							);
						}}
					</For>
				</div>
			</div>

			{/* Studio Action Button */}
			<button
				type="button"
				onClick={props.onNavigate}
				class="w-full h-11 bg-gradient-to-r from-[#3390ec]/15 to-[#06b6d4]/15 hover:from-[#3390ec]/25 hover:to-[#06b6d4]/25 border border-[#3390ec]/30 text-[#3390ec] rounded-[16px] text-[12px] font-black uppercase tracking-wider flex items-center justify-center gap-2 active:scale-95 transition-all shadow-sm"
			>
				<span>{t('channelProjects.dashboard.openStudio')}</span>
				<span class="material-symbols-outlined text-[18px] rtl:-scale-x-100">arrow_forward</span>
			</button>
		</div>
	);
};

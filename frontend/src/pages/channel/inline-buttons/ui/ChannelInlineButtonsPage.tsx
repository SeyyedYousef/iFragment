import { Motion } from '@motionone/solid';
import { useNavigate, useParams } from '@solidjs/router';
import { backButton } from '@tma.js/sdk-solid';
import {
	Component,
	createEffect,
	createResource,
	createSignal,
	For,
	onCleanup,
	onMount,
	Show,
} from 'solid-js';
import { ChannelContextBar, ChannelHamburgerMenu, channelApi } from '@/entities/channel/index.js';
import { t } from '@/shared/i18n/index.js';
import { showConfirm } from '@/shared/lib/telegram-native.js';
import { SelectField, SettingsSection } from '@/shared/ui/settings-controls.js';
import { showToast } from '@/shared/ui/index.js';
import { haptic } from '@/shared/lib/haptic.js';

interface InlineBtn {
	id: string;
	title: string;
	value: string;
	type: string;
	style: string;
	emoji: string;
	click_count?: number;
	is_active?: boolean;
}

export const ChannelInlineButtonsPage: Component = () => {
	const params = useParams();
	const navigate = useNavigate();

	const [isMenuOpen, setIsMenuOpen] = createSignal(false);
	const [isButtonsEnabled, setIsButtonsEnabled] = createSignal(true);
	const [activePreset, setActivePreset] = createSignal<'like' | 'link_share' | 'buy' | 'custom'>(
		'custom',
	);

	const [buttons, setButtons] = createSignal<InlineBtn[]>([]);

	const [btnTitle, setBtnTitle] = createSignal('');
	const [btnValue, setBtnValue] = createSignal('');
	const [btnType, setBtnType] = createSignal('url');
	const [btnStyle, setBtnStyle] = createSignal('default');
	const [btnEmoji, setBtnEmoji] = createSignal('');
	const [editingId, setEditingId] = createSignal<string | null>(null);

	const [isDirty, setIsDirty] = createSignal(false);
	const [isSaving, setIsSaving] = createSignal(false);

	const [settings] = createResource(
		() => params.id,
		(id) => channelApi.getSettings(id),
	);

	const [buttonsData] = createResource(
		() => params.id,
		(id) => channelApi.getButtons(id),
	);

	createEffect(() => {
		const list = buttonsData();
		if (list) {
			setButtons(
				list.map((b: any) => ({
					id: b.id || '',
					title: b.title,
					value: b.value,
					type: b.type,
					style: b.style,
					emoji: b.emoji || '',
					click_count: b.click_count || 0,
					is_active: b.is_active !== undefined ? b.is_active : true,
				})),
			);
		}
	});

	createEffect(() => {
		const data = settings();
		if (data) {
			try {
				let inlineButtonsVal = data.inline_buttons;
				if (typeof inlineButtonsVal === 'string') {
					inlineButtonsVal = JSON.parse(inlineButtonsVal);
				}
				if (inlineButtonsVal && typeof inlineButtonsVal === 'object') {
					if ('enabled' in inlineButtonsVal) {
						setIsButtonsEnabled(!!(inlineButtonsVal as any).enabled);
					}
					if ('preset' in inlineButtonsVal) {
						setActivePreset(inlineButtonsVal.preset as any);
					}
				}
			} catch (e) {
				console.error('Failed to parse inline_buttons:', e);
			}
		}
	});

	onMount(() => {
		backButton.show();
		const off = backButton.onClick(() => {
			haptic.impact('light');
			navigate(`/channel/${params.id}`);
		});
		onCleanup(() => off());
	});

	const handleAddButton = () => {
		if (!btnTitle().trim() || !btnValue().trim()) return;
		haptic.impact('light');

		const newBtn = {
			id: editingId() ? editingId()! : `local_${Date.now()}`,
			title: btnTitle().trim(),
			value: btnValue().trim(),
			type: btnType(),
			style: btnStyle(),
			emoji: btnEmoji().trim(),
			click_count: 0,
			is_active: true,
		};

		if (editingId()) {
			setButtons(buttons().map((b) => (b.id === editingId() ? newBtn : b)));
		} else {
			setButtons([...buttons(), newBtn]);
		}

		setBtnTitle('');
		setBtnValue('');
		setBtnEmoji('');
		setEditingId(null);
		setIsDirty(true);
		setActivePreset('custom');
	};

	const handleEditButton = (id: string) => {
		haptic.impact('light');
		const btn = buttons().find((b) => b.id === id);
		if (btn) {
			setBtnTitle(btn.title);
			setBtnValue(btn.value);
			setBtnType(btn.type);
			setBtnStyle(btn.style);
			setBtnEmoji(btn.emoji || '');
			setEditingId(id);
		}
	};

	const handleCancelEdit = () => {
		haptic.impact('light');
		setBtnTitle('');
		setBtnValue('');
		setBtnType('url');
		setBtnStyle('default');
		setBtnEmoji('');
		setEditingId(null);
	};

	const handleRemoveButton = (id: string) => {
		haptic.impact('light');
		setButtons(buttons().filter((b) => b.id !== id));
		setIsDirty(true);
		setActivePreset('custom');
	};

	const applyPreset = async (preset: string) => {
		if (buttons().length > 0) {
			const confirmed = await showConfirm(t('channelInlineButtons.presetWarning'));
			if (!confirmed) return;
		}
		haptic.impact('medium');
		setIsDirty(true);
		setActivePreset(preset as any);

		if (preset === 'like') {
			setButtons([
				{
					id: 'p1',
					title: t('channelInlineButtons.likeBtn') || 'پسندیدم',
					value: 'like',
					type: 'counter',
					style: 'success',
					emoji: '👍',
					click_count: 0,
					is_active: true,
				},
				{
					id: 'p2',
					title: t('channelInlineButtons.dislikeBtn') || 'نپسندیدم',
					value: 'dislike',
					type: 'counter',
					style: 'danger',
					emoji: '👎',
					click_count: 0,
					is_active: true,
				},
			]);
		} else if (preset === 'link_share') {
			setButtons([
				{
					id: 'p1',
					title: t('channelInlineButtons.viewSiteBtn') || 'مشاهده سایت',
					value: 'https://site.com',
					type: 'url',
					style: 'primary',
					emoji: '📎',
					click_count: 0,
					is_active: true,
				},
				{
					id: 'p2',
					title: t('channelInlineButtons.shareBtn') || 'اشتراک‌گذاری',
					value: 'share',
					type: 'share',
					style: 'default',
					emoji: '📢',
					click_count: 0,
					is_active: true,
				},
			]);
		} else if (preset === 'buy') {
			setButtons([
				{
					id: 'p1',
					title: t('channelInlineButtons.buyNowBtn') || 'خرید مستقیم',
					value: 'payment_id',
					type: 'payment',
					style: 'primary',
					emoji: '🛒',
					click_count: 0,
					is_active: true,
				},
			]);
		} else if (preset === 'custom') {
			setButtons([]);
		}
	};

	const handleSave = async () => {
		setIsSaving(true);
		haptic.impact('medium');

		const buttonsPayload = buttons().map((b) => {
			const payload: any = {
				channel_id: params.id,
				title: b.title,
				value: b.value,
				type: b.type as any,
				style: b.style,
				emoji: b.emoji,
				click_count: b.click_count || 0,
				is_active: b.is_active !== false,
			};
			if (b.id && !b.id.startsWith('p') && !b.id.startsWith('local_')) {
				payload.id = b.id;
			}
			return payload;
		});

		try {
			await channelApi.saveInlineButtonsAtomic(params.id, {
				enabled: isButtonsEnabled(),
				preset: activePreset(),
				buttons: buttonsPayload,
			});
			setIsDirty(false);
			haptic.notify('success');
			showToast(t('channelInlineButtons.saveSuccess'), 'success');
			navigate(`/channel/${params.id}`);
		} catch (e) {
			console.error('Failed to save inline buttons to server:', e);
			haptic.notify('error');
			showToast(t('channelInlineButtons.saveFailed'), 'error');
		} finally {
			setIsSaving(false);
		}
	};

	return (
		<div
			class="min-h-screen bg-[#030303] pb-28 relative overflow-x-hidden text-white font-sans selection:bg-[#3390ec]/30"
			dir={t('dir' as any) === 'rtl' ? 'rtl' : 'ltr'}
		>
			{/* Ambient Top Glow */}
			<div class="absolute top-0 left-0 right-0 h-[350px] bg-gradient-to-b from-[#3390ec]/15 via-transparent to-transparent blur-[80px] pointer-events-none z-0" />

			{/* ═══════ PREMIUM STICKY HEADER ═══════ */}
			<div class="pt-6 pb-4 px-5 sticky top-0 bg-[#030303]/85 backdrop-blur-2xl z-40 border-b border-white/5 flex items-center justify-between gap-3 shadow-sm">
				<div class="flex items-center gap-3.5 overflow-hidden flex-1">
					<button
						onClick={() => {
							haptic.impact('light');
							navigate(`/channel/${params.id}`);
						}}
						class="w-11 h-11 rounded-[14px] bg-[#12141C]/80 flex items-center justify-center border border-white/10 hover:bg-white/10 active:scale-95 transition-all shrink-0 shadow-sm text-white/80"
						aria-label="Back"
					>
						<span class="material-symbols-outlined text-[22px] rtl:-scale-x-100">
							arrow_back
						</span>
					</button>
					<div class="flex flex-col overflow-hidden">
						<div class="flex items-center gap-2.5">
							<h1 class="text-[18px] font-black text-white leading-tight truncate tracking-tight">
								{t('channelInlineButtons.title')}
							</h1>
							<Show when={isDirty()}>
								<span class="w-2 h-2 rounded-full bg-amber-400 animate-pulse shrink-0 shadow-[0_0_8px_rgba(251,191,36,0.8)]" />
							</Show>
						</div>
						<span class="text-[11px] text-white/50 font-bold uppercase tracking-wider truncate mt-0.5">
							{t('channelInlineButtons.subtitle')}
						</span>
					</div>
				</div>

				<button
					onClick={() => setIsMenuOpen(true)}
					class="w-11 h-11 rounded-[14px] bg-[#12141C]/80 flex items-center justify-center border border-white/10 hover:bg-white/10 active:scale-95 transition-colors shrink-0 shadow-sm text-white/80"
					aria-label="Open menu"
				>
					<span class="material-symbols-outlined text-[22px]">menu</span>
				</button>
			</div>

			<ChannelHamburgerMenu
				isOpen={isMenuOpen()}
				onClose={() => setIsMenuOpen(false)}
				channelId={params.id}
				activeTab="inline-buttons"
			/>

			<div class="px-5 pt-5 flex flex-col gap-4 max-w-md mx-auto relative z-10 w-full pb-10">
				<ChannelContextBar channelId={params.id} />

				{/* ═══════ GUIDE BANNER ═══════ */}
				<Motion.div
					initial={{ opacity: 0, y: 15 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ delay: 0.05 }}
					class="bg-gradient-to-br from-[#3390ec]/15 to-[#12141C]/50 border border-[#3390ec]/20 rounded-[24px] p-5 flex flex-col gap-3 relative overflow-hidden shadow-sm mt-1"
				>
					<div class="absolute -right-6 -top-6 w-32 h-32 bg-[#3390ec]/20 rounded-full blur-3xl pointer-events-none" />
					<div class="flex items-center gap-2.5 relative z-10">
						<div class="w-10 h-10 rounded-[12px] bg-[#3390ec]/15 flex items-center justify-center border border-[#3390ec]/30 shadow-inner shrink-0">
							<span class="material-symbols-outlined text-[#3390ec] text-[20px]">lightbulb</span>
						</div>
						<h2 class="text-[14px] font-black text-white tracking-tight">
							{t('channelInlineButtons.guideTitle')}
						</h2>
					</div>
					<ul class="text-[12px] text-white/70 font-medium leading-relaxed space-y-2 list-none p-0 m-0 mt-1 relative z-10 pl-2">
						<li class="flex items-start gap-2">
							<span class="text-[#3390ec] font-black">•</span>
							<span>{t('channelInlineButtons.guide1')}</span>
						</li>
						<li class="flex items-start gap-2">
							<span class="text-[#3390ec] font-black">•</span>
							<span>{t('channelInlineButtons.guide2')}</span>
						</li>
						<li class="flex items-start gap-2">
							<span class="text-[#3390ec] font-black">•</span>
							<span>{t('channelInlineButtons.guide3')}</span>
						</li>
						<li class="flex items-start gap-2">
							<span class="text-[#3390ec] font-black">•</span>
							<span>{t('channelInlineButtons.guide4')}</span>
						</li>
					</ul>
				</Motion.div>

				{/* ═══════ MAIN TOGGLE ═══════ */}
				<Motion.div
					initial={{ opacity: 0, y: 15 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ delay: 0.1 }}
					class="bg-[#12141C]/80 backdrop-blur-xl rounded-[24px] border border-white/5 p-2 shadow-sm"
				>
					<SettingsSection
						title={t('channelInlineButtons.defaultForAll')}
						description={t('channelInlineButtons.defaultForAllDesc')}
						enabled={isButtonsEnabled()}
						onToggle={(v) => {
							setIsButtonsEnabled(v);
							setIsDirty(true);
							haptic.selection();
						}}
					/>
				</Motion.div>

				<Show when={isButtonsEnabled()}>
					{/* ═══════ PRESETS (Glass Cards) ═══════ */}
					<Motion.div
						initial={{ opacity: 0, y: 15 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ delay: 0.15 }}
						class="flex flex-col gap-3"
					>
						<h3 class="text-[11px] font-black text-white/40 uppercase tracking-widest px-2 flex items-center gap-1.5">
							<span class="material-symbols-outlined text-[16px] text-white/30">ads_click</span>
							{t('channelInlineButtons.presetSelectorTitle')}
						</h3>

						<div class="grid grid-cols-2 gap-3">
							<button
								onClick={() => applyPreset('like')}
								class={`p-4 rounded-[20px] border transition-all flex flex-col gap-2 relative overflow-hidden active:scale-95 shadow-sm group ${activePreset() === 'like' ? 'bg-[#3390ec]/15 border-[#3390ec]/40 shadow-[0_0_20px_rgba(51,144,236,0.15)]' : 'bg-[#12141C]/80 border-white/5 hover:border-white/20'}`}
							>
								<Show when={activePreset() === 'like'}>
									<div class="absolute top-3 left-3 w-5 h-5 rounded-full bg-[#3390ec] flex items-center justify-center shadow-md">
										<span class="material-symbols-outlined text-[12px] text-white font-black">
											done
										</span>
									</div>
								</Show>
								<div class="w-10 h-10 rounded-[12px] flex items-center justify-center text-[22px] bg-gradient-to-br from-[#10b981]/20 to-[#ff4a4a]/20 border border-white/5 shadow-inner">
									👍
								</div>
								<div class="flex flex-col items-start text-start mt-1">
									<span class="text-[14px] font-black text-white">
										{t('channelInlineButtons.presetLikeTitle')}
									</span>
									<span class="text-[10px] text-white/50 font-bold leading-relaxed mt-0.5">
										{t('channelInlineButtons.presetLikeDesc')}
									</span>
								</div>
							</button>

							<button
								onClick={() => applyPreset('link_share')}
								class={`p-4 rounded-[20px] border transition-all flex flex-col gap-2 relative overflow-hidden active:scale-95 shadow-sm group ${activePreset() === 'link_share' ? 'bg-[#3390ec]/15 border-[#3390ec]/40 shadow-[0_0_20px_rgba(51,144,236,0.15)]' : 'bg-[#12141C]/80 border-white/5 hover:border-white/20'}`}
							>
								<Show when={activePreset() === 'link_share'}>
									<div class="absolute top-3 left-3 w-5 h-5 rounded-full bg-[#3390ec] flex items-center justify-center shadow-md">
										<span class="material-symbols-outlined text-[12px] text-white font-black">
											done
										</span>
									</div>
								</Show>
								<div class="w-10 h-10 rounded-[12px] flex items-center justify-center text-[22px] bg-[#3390ec]/20 border border-white/5 shadow-inner">
									📎
								</div>
								<div class="flex flex-col items-start text-start mt-1">
									<span class="text-[14px] font-black text-white">
										{t('channelInlineButtons.presetLinkShareTitle')}
									</span>
									<span class="text-[10px] text-white/50 font-bold leading-relaxed mt-0.5">
										{t('channelInlineButtons.presetLinkShareDesc')}
									</span>
								</div>
							</button>

							<button
								onClick={() => applyPreset('buy')}
								class={`p-4 rounded-[20px] border transition-all flex flex-col gap-2 relative overflow-hidden active:scale-95 shadow-sm group ${activePreset() === 'buy' ? 'bg-[#3390ec]/15 border-[#3390ec]/40 shadow-[0_0_20px_rgba(51,144,236,0.15)]' : 'bg-[#12141C]/80 border-white/5 hover:border-white/20'}`}
							>
								<Show when={activePreset() === 'buy'}>
									<div class="absolute top-3 left-3 w-5 h-5 rounded-full bg-[#3390ec] flex items-center justify-center shadow-md">
										<span class="material-symbols-outlined text-[12px] text-white font-black">
											done
										</span>
									</div>
								</Show>
								<div class="w-10 h-10 rounded-[12px] flex items-center justify-center text-[22px] bg-amber-400/20 border border-white/5 shadow-inner">
									🛒
								</div>
								<div class="flex flex-col items-start text-start mt-1">
									<span class="text-[14px] font-black text-white">
										{t('channelInlineButtons.presetBuyTitle')}
									</span>
									<span class="text-[10px] text-white/50 font-bold leading-relaxed mt-0.5">
										{t('channelInlineButtons.presetBuyDesc')}
									</span>
								</div>
							</button>

							<button
								onClick={() => applyPreset('custom')}
								class={`p-4 rounded-[20px] border transition-all flex flex-col gap-2 relative overflow-hidden active:scale-95 shadow-sm group ${activePreset() === 'custom' ? 'bg-[#3390ec]/15 border-[#3390ec]/40 shadow-[0_0_20px_rgba(51,144,236,0.15)]' : 'bg-[#12141C]/80 border-white/5 hover:border-white/20'}`}
							>
								<Show when={activePreset() === 'custom'}>
									<div class="absolute top-3 left-3 w-5 h-5 rounded-full bg-[#3390ec] flex items-center justify-center shadow-md">
										<span class="material-symbols-outlined text-[12px] text-white font-black">
											done
										</span>
									</div>
								</Show>
								<div class="w-10 h-10 rounded-[12px] flex items-center justify-center text-[22px] bg-white/10 border border-white/5 shadow-inner">
									🛠️
								</div>
								<div class="flex flex-col items-start text-start mt-1">
									<span class="text-[14px] font-black text-white">
										{t('channelInlineButtons.presetCustomTitle')}
									</span>
									<span class="text-[10px] text-white/50 font-bold leading-relaxed mt-0.5">
										{t('channelInlineButtons.presetCustomDesc')}
									</span>
								</div>
							</button>
						</div>
					</Motion.div>

					{/* ═══════ ACTIVE BUTTONS & VISUAL BUILDER ═══════ */}
					<Motion.div
						initial={{ opacity: 0, y: 15 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ delay: 0.2 }}
						class="bg-[#12141C]/80 backdrop-blur-xl rounded-[28px] border border-white/5 p-5 flex flex-col gap-6 shadow-sm mt-1"
					>
						{/* Active Buttons List */}
						<div class="flex flex-col gap-3">
							<h3 class="text-[11px] font-black uppercase tracking-widest text-white/40 flex items-center gap-1.5 px-1 border-b border-white/5 pb-2 mb-1">
								<span class="material-symbols-outlined text-[16px] text-white/30">
									splitscreen
								</span>
								{t('channelInlineButtons.activeButtons')}
							</h3>

							<Show when={buttons().length === 0}>
								<div class="text-center py-6 bg-[#08090D] border border-dashed border-white/10 rounded-[16px] flex flex-col items-center gap-2 shadow-inner">
									<span class="material-symbols-outlined text-white/20 text-[28px]">
										add_circle
									</span>
									<span class="text-[11px] font-bold text-white/40 tracking-wider uppercase">
										{t('channelInlineButtons.noButtons')}
									</span>
								</div>
							</Show>

							<Show when={buttons().length > 0}>
								<div class="flex flex-col gap-2">
									<For each={buttons()}>
										{(btn, index) => {
											const styleClass =
												btn.style === 'primary'
													? 'bg-[#3390ec]/10 text-[#3390ec] border-[#3390ec]/30'
													: btn.style === 'success'
														? 'bg-[#10b981]/10 text-[#10b981] border-[#10b981]/30'
														: btn.style === 'danger'
															? 'bg-[#ff4a4a]/10 text-[#ff4a4a] border-[#ff4a4a]/30'
															: 'bg-white/5 text-white/90 border-white/10';

											return (
												<div
													class={`flex items-center justify-between p-3.5 rounded-[16px] border shadow-sm ${styleClass}`}
												>
													<div class="flex items-center gap-3.5 flex-1 min-w-0 pr-2">
														<div class="w-10 h-10 rounded-[10px] bg-black/30 flex items-center justify-center text-[18px] shadow-inner shrink-0 border border-white/5">
															{btn.emoji || '🔘'}
														</div>
														<div class="flex flex-col min-w-0">
															<span class="text-[14px] font-black truncate">{btn.title}</span>
															<span
																class="text-[10px] font-bold opacity-60 mt-0.5 truncate font-mono tracking-tight"
																dir="ltr"
															>
																{btn.value}
															</span>
														</div>
													</div>
													<div class="flex items-center gap-1.5 shrink-0">
														<Show when={index() > 0}>
															<button
																onClick={() => {
																	haptic.impact('light');
																	const newBtns = [...buttons()];
																	[newBtns[index() - 1], newBtns[index()]] = [
																		newBtns[index()],
																		newBtns[index() - 1],
																	];
																	setButtons(newBtns);
																	setIsDirty(true);
																}}
																class="w-8 h-8 bg-black/20 hover:bg-black/40 rounded-[8px] flex items-center justify-center text-current opacity-70 hover:opacity-100 transition-all border border-white/5 active:scale-95"
																title="Move Up"
															>
																<span class="material-symbols-outlined text-[16px]">
																	keyboard_arrow_up
																</span>
															</button>
														</Show>
														<Show when={index() < buttons().length - 1}>
															<button
																onClick={() => {
																	haptic.impact('light');
																	const newBtns = [...buttons()];
																	[newBtns[index() + 1], newBtns[index()]] = [
																		newBtns[index()],
																		newBtns[index() + 1],
																	];
																	setButtons(newBtns);
																	setIsDirty(true);
																}}
																class="w-8 h-8 bg-black/20 hover:bg-black/40 rounded-[8px] flex items-center justify-center text-current opacity-70 hover:opacity-100 transition-all border border-white/5 active:scale-95"
																title="Move Down"
															>
																<span class="material-symbols-outlined text-[16px]">
																	keyboard_arrow_down
																</span>
															</button>
														</Show>
														<button
															onClick={() => handleEditButton(btn.id)}
															class="w-8 h-8 bg-black/20 hover:bg-black/40 rounded-[8px] flex items-center justify-center text-current opacity-70 hover:opacity-100 transition-all border border-white/5 active:scale-95 ml-1"
															title={t('channelInlineButtons.editButton')}
														>
															<span class="material-symbols-outlined text-[16px]">
																edit
															</span>
														</button>
														<button
															onClick={() => handleRemoveButton(btn.id)}
															class="w-8 h-8 bg-[#ff4a4a]/20 hover:bg-[#ff4a4a] rounded-[8px] flex items-center justify-center text-[#ff4a4a] hover:text-white transition-all border border-[#ff4a4a]/30 active:scale-95"
															title={t('common.close')}
														>
															<span class="material-symbols-outlined text-[16px]">
																delete
															</span>
														</button>
													</div>
												</div>
											);
										}}
									</For>
								</div>
							</Show>
						</div>

						{/* VISUAL BUILDER FORM */}
						<div
							class={`flex flex-col gap-4 p-4.5 rounded-[20px] border transition-colors shadow-inner relative overflow-hidden ${editingId() ? 'bg-gradient-to-br from-[#3390ec]/15 to-[#08090D] border-[#3390ec]/40' : 'bg-[#08090D] border-white/5'}`}
						>
							<div class="flex items-center justify-between border-b border-white/5 pb-3">
								<h3 class="text-[12px] font-black uppercase tracking-widest text-white flex items-center gap-2">
									<span
										class={`material-symbols-outlined text-[18px] ${editingId() ? 'text-[#3390ec]' : 'text-white/40'}`}
									>
										{editingId() ? 'edit' : 'add_circle'}
									</span>
									{editingId()
										? t('channelInlineButtons.editButton')
										: t('channelInlineButtons.addButtonForm')}
								</h3>
							</div>

							<div class="flex gap-2">
								<div class="w-16 flex-shrink-0 flex flex-col gap-1.5">
									<label class="text-[9px] font-black uppercase tracking-widest text-white/40 px-1 text-center">
										Icon
									</label>
									<input
										type="text"
										value={btnEmoji()}
										onInput={(e) => setBtnEmoji(e.currentTarget.value)}
										placeholder="🔘"
										class="w-full h-12 bg-[#12141C] text-white text-[18px] font-black text-center rounded-[14px] border border-white/5 focus:outline-none focus:border-[#3390ec]/50 placeholder-white/20 transition-colors shadow-inner"
									/>
								</div>
								<div class="flex-1 flex flex-col gap-1.5">
									<label class="text-[9px] font-black uppercase tracking-widest text-white/40 px-1">
										{t('channelInlineButtons.buttonText')}
									</label>
									<input
										type="text"
										value={btnTitle()}
										onInput={(e) => setBtnTitle(e.currentTarget.value)}
										placeholder="e.g. Join Channel"
										class="w-full h-12 bg-[#12141C] text-white text-[13px] font-bold rounded-[14px] px-4 border border-white/5 focus:outline-none focus:border-[#3390ec]/50 placeholder-white/20 transition-colors shadow-inner"
									/>
								</div>
							</div>

							<div class="grid grid-cols-2 gap-3 bg-[#12141C] p-1.5 rounded-[16px] border border-white/5 shadow-inner">
								<SelectField
									label=""
									value={btnType()}
									onChange={(v) => setBtnType(v)}
									options={[
										{ value: 'url', label: t('channelInlineButtons.typeUrl') },
										{ value: 'counter', label: t('channelInlineButtons.typeCounter') },
										{ value: 'share', label: t('channelInlineButtons.typeShare') },
										{ value: 'webapp', label: t('channelInlineButtons.typeWebApp') },
										{ value: 'payment', label: t('channelInlineButtons.typePay') },
									]}
								/>
								<SelectField
									label=""
									value={btnStyle()}
									onChange={(v) => setBtnStyle(v)}
									options={[
										{ value: 'default', label: t('channelInlineButtons.styleDefault') },
										{ value: 'primary', label: t('channelInlineButtons.stylePrimary') },
										{ value: 'success', label: t('channelInlineButtons.styleSuccess') },
										{ value: 'danger', label: t('channelInlineButtons.styleDanger') },
									]}
								/>
							</div>

							<div class="flex flex-col gap-1.5">
								<label class="text-[9px] font-black uppercase tracking-widest text-white/40 px-1 flex justify-between">
									{t('channelInlineButtons.buttonValue')}
									<span class="lowercase font-normal tracking-normal text-[#3390ec]">
										url, command, or callback
									</span>
								</label>
								<input
									type="text"
									value={btnValue()}
									onInput={(e) => setBtnValue(e.currentTarget.value)}
									placeholder="https://t.me/..."
									class="w-full h-12 bg-[#12141C] text-white text-[13px] font-mono font-bold rounded-[14px] px-4 border border-white/5 focus:outline-none focus:border-[#3390ec]/50 placeholder-white/20 transition-colors shadow-inner"
									dir="ltr"
								/>
							</div>

							<div class="flex gap-2.5 w-full mt-2">
								<Show when={editingId()}>
									<button
										onClick={handleCancelEdit}
										class="flex-1 h-12 bg-[#12141C] text-white/60 hover:text-white border border-white/5 hover:border-white/10 rounded-[14px] font-black uppercase tracking-widest text-[11px] flex items-center justify-center transition-all active:scale-95 shadow-sm"
									>
										{t('common.cancel')}
									</button>
								</Show>
								<button
									onClick={handleAddButton}
									disabled={!btnTitle().trim() || !btnValue().trim()}
									class={`flex-[2] h-12 rounded-[14px] font-black uppercase tracking-widest text-[12px] flex items-center justify-center gap-2 transition-all active:scale-95 disabled:active:scale-100 disabled:opacity-40 border ${
										editingId()
											? 'bg-gradient-to-r from-[#3390ec] to-[#2b7ec9] text-white border-white/10 shadow-[0_4px_15px_rgba(51,144,236,0.3)]'
											: 'bg-white/5 text-white/80 border-white/10 hover:bg-white/10 shadow-sm'
									}`}
								>
									<span class="material-symbols-outlined text-[18px]">
										{editingId() ? 'save' : 'add'}
									</span>
									{editingId()
										? t('channelInlineButtons.saveChanges')
										: t('channelInlineButtons.addButtonToList')}
								</button>
							</div>
						</div>

						{/* ═══════ TELEGRAM LIVE MOCKUP SIMULATOR ═══════ */}
						<div class="flex flex-col gap-2.5 mt-2">
							<label class="text-[11px] font-black uppercase tracking-widest text-white/40 px-1 flex items-center gap-1.5">
								<span class="material-symbols-outlined text-[16px] text-[#3390ec]">
									visibility
								</span>
								{t('channelDynamicBio.preview')}
							</label>

							<div class="bg-gradient-to-br from-[#1c2c3d] via-[#111a22] to-[#0a0f14] rounded-[24px] p-5 min-h-[180px] flex flex-col justify-end relative overflow-hidden border border-[#2a3c4f] shadow-inner">
								<div class="absolute inset-0 bg-black/30"></div>

								<div class="flex flex-col max-w-[90%] self-end w-full relative z-10">
									{/* Telegram Message Bubble */}
									<div class="bg-[#2b5278] text-white rounded-[18px] rounded-br-sm p-3.5 shadow-[0_4px_15px_rgba(0,0,0,0.3)] text-[13.5px] leading-relaxed font-medium">
										{t('channelInlineButtons.mockPostText')}
										<div class="flex items-center justify-end gap-1 mt-1.5 text-white/50 text-[10px] font-bold">
											<span>
												{new Date().toLocaleTimeString([], {
													hour: '2-digit',
													minute: '2-digit',
												})}
											</span>
											<span class="material-symbols-outlined text-[14px] text-[#60a5fa]">
												done_all
											</span>
										</div>
									</div>

									{/* Glass Buttons Mockup */}
									<div class="flex flex-col gap-1.5 mt-2 w-full">
										<Show when={buttons().length === 0}>
											<div class="text-center py-2.5 bg-black/20 backdrop-blur-md border border-dashed border-white/10 rounded-[12px] text-[11px] font-bold text-white/40 uppercase tracking-widest">
												{t('channelInlineButtons.noButtonsMock')}
											</div>
										</Show>
										<Show when={buttons().length > 0}>
											<div class="grid grid-cols-2 gap-1.5 w-full">
												<For each={buttons()}>
													{(btn) => {
														const styleClass =
															btn.style === 'primary'
																? 'bg-[#3b82f6]/90 text-white border-[#60a5fa]/30 shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]'
																: btn.style === 'success'
																	? 'bg-[#10b981]/25 text-[#34d399] border-[#10b981]/30 backdrop-blur-md'
																	: btn.style === 'danger'
																		? 'bg-[#ef4444]/25 text-[#f87171] border-[#ef4444]/30 backdrop-blur-md'
																		: 'bg-[#1e293b]/90 text-[#60a5fa] border-[#334155] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]';

														return (
															<div class="relative w-full">
																<button
																	class={`w-full h-[38px] rounded-[10px] text-[12px] font-black flex items-center justify-center gap-1.5 shadow-sm border ${styleClass} pointer-events-none`}
																>
																	<Show when={btn.emoji}>
																		<span class="text-[14px]">{btn.emoji}</span>
																	</Show>
																	<span class="truncate px-1">{btn.title}</span>
																</button>
															</div>
														);
													}}
												</For>
											</div>
										</Show>
									</div>
								</div>
							</div>
						</div>
					</Motion.div>
				</Show>
			</div>

			{/* ═══════ FLOATING SAVE BUTTON ═══════ */}
			<Show when={isDirty()}>
				<div class="fixed bottom-0 left-0 right-0 p-5 bg-gradient-to-t from-[#030303] via-[#030303]/90 to-transparent z-40 pointer-events-none">
					<div class="max-w-md mx-auto flex gap-3 pointer-events-auto">
						<button
							onClick={() => {
								haptic.impact('light');
								navigate(`/channel/${params.id}`);
							}}
							disabled={isSaving()}
							class="w-16 h-14 bg-[#12141C]/80 backdrop-blur-md text-[#ff4a4a] border border-[#ff4a4a]/20 rounded-[16px] transition-all flex items-center justify-center hover:bg-[#ff4a4a]/10 active:scale-95 shadow-sm"
						>
							<span class="material-symbols-outlined text-[24px]">close</span>
						</button>
						<button
							onClick={handleSave}
							disabled={isSaving()}
							class="flex-1 h-14 bg-gradient-to-r from-[#3390ec] to-[#2b7ec9] hover:from-[#2b7ec9] hover:to-[#3390ec] text-white rounded-[16px] font-black text-[14px] uppercase tracking-widest shadow-[0_10px_30px_rgba(51,144,236,0.35)] transition-all flex items-center justify-center gap-2 disabled:opacity-40 disabled:scale-100 active:scale-95 border border-white/10"
						>
							<Show
								when={!isSaving()}
								fallback={
									<span class="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
								}
							>
								{t('channelInlineButtons.saveSettings')}{' '}
								<span class="material-symbols-outlined text-[22px]">save</span>
							</Show>
						</button>
					</div>
				</div>
			</Show>
		</div>
	);
};

import { Motion } from '@motionone/solid';
import { useNavigate, useParams } from '@solidjs/router';
import { backButton, hapticFeedback } from '@tma.js/sdk-solid';
import { Component, createResource, createSignal, For, onCleanup, onMount, Show, Suspense } from 'solid-js';
import { createStore, reconcile } from 'solid-js/store';
import { groupApi } from '@/shared/api/bot-management.js';
import { t } from '@/shared/i18n/index.js';
import { HamburgerMenu } from '@/shared/ui/hamburger-menu.js';
import { InlineButtonField } from '@/shared/ui/settings-controls.js';
import { showToast } from '@/shared/ui/toast.js';

interface CustomTextsConfig { welcomeText: string; warningText: string; silenceStartText: string; silenceEndText: string; rulesText: string; forceJoinText: string; forceAddText: string; inlineButtons: { id: string; title: string; url: string }[]; }

const defaults: CustomTextsConfig = {
	welcomeText: '👋 Welcome {user}',
	warningText: '⚠️ {user} | Warning {count}/{threshold} ▫️ {reason}',
	silenceStartText: '🔒 Quiet mode activated',
	silenceEndText: '🔓 Quiet mode deactivated',
	rulesText: '📜 <b>Rules</b>: Respect others • No spam or links',
	forceJoinText: '📢 {user}, join required channels to chat:\n{channel_names}',
	forceAddText: '👥 {user}, invite {remainadd} member(s) to chat ({added}/{number})',
	inlineButtons: [],
};

export const CustomTextsPage: Component = () => {
	const navigate = useNavigate();
	const params = useParams();

	const [isMenuOpen, setIsMenuOpen] = createSignal(false);
	const [isSaving, setIsSaving] = createSignal(false);
	const [isDirty, setIsDirty] = createSignal(false);
	const [settingsVersion, setSettingsVersion] = createSignal(1);

	const [cfg, setCfg] = createStore<CustomTextsConfig>({ ...defaults });

	const [_, { refetch }] = createResource(() => params.id, async (groupId) => {
		const data = await groupApi.getSettings(groupId);
		setSettingsVersion(data.version);
		const ct = (data.custom_texts || {}) as Partial<CustomTextsConfig>;
		setCfg(reconcile({ ...defaults, ...ct }));
		setIsDirty(false);
		return data;
	});

	onMount(() => {
		backButton.show();
		const off = backButton.onClick(() => { try { hapticFeedback.impactOccurred('light'); } catch (_) {} window.history.back(); });
		onCleanup(() => off());
	});

	const update = (key: keyof CustomTextsConfig, val: any) => { setCfg(key, val); setIsDirty(true); };

	const handleSave = async () => {
		if (!isDirty()) return;
		try { hapticFeedback.notificationOccurred('success'); } catch (_) {}
		setIsSaving(true);
		try {
			const result = await groupApi.updateSettings(params.id, 'custom_texts', cfg as any, settingsVersion());
			setSettingsVersion(result.version);
			setIsDirty(false);
			showToast(t('common.settingsSaved') || 'Settings saved successfully', 'success');
			navigate(`/group/${params.id}`);
			backButton.hide();
		} catch (_e) {
			showToast(t('error.title'), 'error');
			try { hapticFeedback.notificationOccurred('error'); } catch (_) {}
		} finally {
			setIsSaving(false);
		}
	};

	return (
		<div class="min-h-screen bg-[#030303] text-white pb-28 relative font-sans selection:bg-[#3390ec]/30" dir={t('dir' as any) === 'rtl' ? 'rtl' : 'ltr'}>
			
			{/* Ambient Top Glow */}
			<div class="absolute top-0 left-0 right-0 h-[350px] bg-gradient-to-b from-[#3390ec]/15 via-transparent to-transparent blur-[80px] pointer-events-none z-0" />

			{/* ═══════ PREMIUM STICKY HEADER ═══════ */}
			<div class="pt-6 pb-4 px-5 sticky top-0 bg-[#030303]/85 backdrop-blur-2xl z-40 border-b border-white/5 flex items-center justify-between gap-3 shadow-sm">
				<div class="flex items-center gap-3.5 overflow-hidden flex-1">
					<button onClick={() => { try { hapticFeedback.impactOccurred('light'); } catch (_) {} window.history.back(); }} class="w-11 h-11 rounded-[14px] bg-[#12141C]/80 flex items-center justify-center border border-white/10 hover:bg-white/10 active:scale-95 transition-all shrink-0 shadow-sm">
						<span class="material-symbols-outlined text-white/80 text-[22px] rtl:-scale-x-100">arrow_back</span>
					</button>
					<div class="flex flex-col overflow-hidden">
						<div class="flex items-center gap-2.5">
							<h1 class="text-[18px] font-black text-white leading-tight truncate tracking-tight">{t('customTextsSettings.title')}</h1>
							<Show when={isDirty()}><span class="w-2 h-2 rounded-full bg-amber-400 animate-pulse shrink-0 shadow-[0_0_8px_rgba(251,191,36,0.8)]" /></Show>
						</div>
						<p class="text-[11px] text-white/50 font-bold uppercase tracking-wider leading-snug truncate mt-0.5">{t('customTextsSettings.subtitle')}</p>
					</div>
				</div>
				<button onClick={() => setIsMenuOpen(true)} class="w-11 h-11 rounded-[14px] bg-[#12141C]/80 flex items-center justify-center border border-white/10 hover:bg-white/10 active:scale-95 transition-colors shrink-0 shadow-sm text-white/80">
					<span class="material-symbols-outlined text-[22px]">menu</span>
				</button>
			</div>

			<HamburgerMenu isOpen={isMenuOpen()} onClose={() => setIsMenuOpen(false)} groupId={params.id} activeTab="custom" />

			<Suspense fallback={null}>
				<div class="p-5 flex flex-col gap-4 max-w-md mx-auto relative z-10 w-full">
					
					{/* ═══════ INFO BANNER (Placeholders) ═══════ */}
					<Motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} class="bg-gradient-to-br from-[#3390ec]/10 to-transparent border border-[#3390ec]/20 rounded-[24px] p-5 flex flex-col gap-4 shadow-sm relative overflow-hidden">
						<div class="absolute -right-10 -top-10 w-32 h-32 bg-[#3390ec]/10 rounded-full blur-2xl pointer-events-none" />
						
						<div class="flex items-center gap-3 relative z-10">
							<div class="w-10 h-10 rounded-[12px] bg-[#3390ec]/15 flex items-center justify-center border border-[#3390ec]/30 shadow-inner">
								<span class="material-symbols-outlined text-[#3390ec] text-[20px]">data_object</span>
							</div>
							<span class="text-[14px] font-black text-white tracking-tight">{t('customTextsSettings.placeholders')}</span>
						</div>

						<div class="grid grid-cols-2 gap-x-4 gap-y-3 relative z-10 bg-[#08090D]/50 p-4 rounded-[16px] border border-white/5">
							<For each={[
								{ tag: '{user}', label: t('customTextsSettings.phUser') }, { tag: '{id}', label: t('customTextsSettings.phId') },
								{ tag: '{group}', label: t('customTextsSettings.phGroup') }, { tag: '{time}', label: t('customTextsSettings.phTime') },
								{ tag: '{reason}', label: t('customTextsSettings.phReason') }, { tag: '{rule}', label: t('customTextsSettings.phRule') },
								{ tag: '{count}', label: t('customTextsSettings.phCount') }, { tag: '{threshold}', label: t('customTextsSettings.phThreshold') },
								{ tag: '{number}', label: t('customTextsSettings.phNumber') }, { tag: '{added}', label: t('customTextsSettings.phAdded') },
								{ tag: '{remainadd}', label: t('customTextsSettings.phRemainAdd') }, { tag: '{channel_names}', label: t('customTextsSettings.phChannelNames') }
							]}>
								{(ph) => (
									<div class="flex flex-col items-start gap-1">
										<code class="text-[#3390ec] font-mono text-[10px] font-bold bg-[#3390ec]/10 px-2 py-0.5 rounded-[6px] border border-[#3390ec]/20">{ph.tag}</code>
										<span class="text-[10px] text-white/50 leading-tight font-medium px-1">{ph.label}</span>
									</div>
								)}
							</For>
						</div>
					</Motion.div>

					{/* ═══════ TEXT EDITORS ═══════ */}
					
					{/* Welcome Message */}
					<Motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} class="bg-[#12141C]/80 backdrop-blur-xl rounded-[24px] border border-white/5 p-5 flex flex-col gap-3 shadow-sm">
						<div class="flex flex-col gap-1 mb-1">
							<label class="text-[14px] font-black text-white flex items-center gap-2.5">
								<div class="w-8 h-8 rounded-[10px] bg-[#34c759]/10 flex items-center justify-center border border-[#34c759]/20 shadow-inner"><span class="material-symbols-outlined text-[#34c759] text-[16px]">waving_hand</span></div>
								{t('customTextsSettings.welcomeText')}
							</label>
							<span class="text-[11px] text-white/50 font-medium leading-snug px-1.5">{t('customTextsSettings.welcomeTextDesc')}</span>
						</div>
						<textarea value={cfg.welcomeText} onInput={(e) => update('welcomeText', e.currentTarget.value)} placeholder="👋 Welcome {user}" class="w-full h-20 bg-[#08090D] text-white text-[13px] font-medium leading-relaxed rounded-[16px] px-4 py-3.5 focus:outline-none focus:ring-1 focus:ring-[#3390ec]/50 border border-white/5 transition-all resize-none placeholder-white/20 shadow-inner" />
					</Motion.div>

					{/* Warning Message */}
					<Motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} class="bg-[#12141C]/80 backdrop-blur-xl rounded-[24px] border border-white/5 p-5 flex flex-col gap-3 shadow-sm">
						<div class="flex flex-col gap-1 mb-1">
							<label class="text-[14px] font-black text-white flex items-center gap-2.5">
								<div class="w-8 h-8 rounded-[10px] bg-[#ffcc00]/10 flex items-center justify-center border border-[#ffcc00]/20 shadow-inner"><span class="material-symbols-outlined text-[#ffcc00] text-[16px]">warning</span></div>
								{t('customTextsSettings.warningText')}
							</label>
							<span class="text-[11px] text-white/50 font-medium leading-snug px-1.5">{t('customTextsSettings.warningTextDesc')}</span>
						</div>
						<textarea value={cfg.warningText} onInput={(e) => update('warningText', e.currentTarget.value)} placeholder="⚠️ {user} | Warning {count}/{threshold} ▫️ {reason}" class="w-full h-20 bg-[#08090D] text-white text-[13px] font-medium leading-relaxed rounded-[16px] px-4 py-3.5 focus:outline-none focus:ring-1 focus:ring-[#3390ec]/50 border border-white/5 transition-all resize-none placeholder-white/20 shadow-inner" />
					</Motion.div>

					{/* Silence Messaging */}
					<Motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} class="bg-[#12141C]/80 backdrop-blur-xl rounded-[24px] border border-white/5 p-5 flex flex-col gap-6 shadow-sm">
						<div class="flex flex-col gap-3">
							<div class="flex flex-col gap-1">
								<label class="text-[14px] font-black text-white flex items-center gap-2.5">
									<div class="w-8 h-8 rounded-[10px] bg-[#ff3b30]/10 flex items-center justify-center border border-[#ff3b30]/20 shadow-inner"><span class="material-symbols-outlined text-[#ff3b30] text-[16px]">notifications_paused</span></div>
									{t('customTextsSettings.silenceStartText')}
								</label>
								<span class="text-[11px] text-white/50 font-medium leading-snug px-1.5">{t('customTextsSettings.silenceStartTextDesc')}</span>
							</div>
							<textarea value={cfg.silenceStartText} onInput={(e) => update('silenceStartText', e.currentTarget.value)} placeholder="🔒 Quiet mode activated" class="w-full h-20 bg-[#08090D] text-white text-[13px] font-medium leading-relaxed rounded-[16px] px-4 py-3.5 focus:outline-none focus:ring-1 focus:ring-[#3390ec]/50 border border-white/5 transition-all resize-none placeholder-white/20 shadow-inner" />
						</div>

						<div class="w-full h-[1px] bg-white/5 rounded-full" />

						<div class="flex flex-col gap-3">
							<div class="flex flex-col gap-1">
								<label class="text-[14px] font-black text-white flex items-center gap-2.5">
									<div class="w-8 h-8 rounded-[10px] bg-[#34c759]/10 flex items-center justify-center border border-[#34c759]/20 shadow-inner"><span class="material-symbols-outlined text-[#34c759] text-[16px]">notifications_active</span></div>
									{t('customTextsSettings.silenceEndText')}
								</label>
								<span class="text-[11px] text-white/50 font-medium leading-snug px-1.5">{t('customTextsSettings.silenceEndTextDesc')}</span>
							</div>
							<textarea value={cfg.silenceEndText} onInput={(e) => update('silenceEndText', e.currentTarget.value)} placeholder="🔓 Quiet mode deactivated" class="w-full h-20 bg-[#08090D] text-white text-[13px] font-medium leading-relaxed rounded-[16px] px-4 py-3.5 focus:outline-none focus:ring-1 focus:ring-[#3390ec]/50 border border-white/5 transition-all resize-none placeholder-white/20 shadow-inner" />
						</div>
					</Motion.div>

					{/* Rules Text */}
					<Motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} class="bg-[#12141C]/80 backdrop-blur-xl rounded-[24px] border border-white/5 p-5 flex flex-col gap-3 shadow-sm">
						<div class="flex flex-col gap-1 mb-1">
							<label class="text-[14px] font-black text-white flex items-center gap-2.5">
								<div class="w-8 h-8 rounded-[10px] bg-[#ffcc00]/10 flex items-center justify-center border border-[#ffcc00]/20 shadow-inner"><span class="material-symbols-outlined text-[#ffcc00] text-[16px]">gavel</span></div>
								{t('customTextsSettings.rulesText')}
							</label>
							<span class="text-[11px] text-white/50 font-medium leading-snug px-1.5">{t('customTextsSettings.rulesTextDesc')}</span>
						</div>
						<textarea value={cfg.rulesText} onInput={(e) => update('rulesText', e.currentTarget.value)} placeholder="📜 <b>Rules</b>: Respect others • No spam or links" class="w-full h-20 bg-[#08090D] text-white text-[13px] font-medium leading-relaxed rounded-[16px] px-4 py-3.5 focus:outline-none focus:ring-1 focus:ring-[#3390ec]/50 border border-white/5 transition-all resize-none placeholder-white/20 shadow-inner" />
					</Motion.div>

					{/* Force Join & Add */}
					<Motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }} class="bg-[#12141C]/80 backdrop-blur-xl rounded-[24px] border border-white/5 p-5 flex flex-col gap-6 shadow-sm">
						<div class="flex flex-col gap-3">
							<div class="flex flex-col gap-1">
								<label class="text-[14px] font-black text-white flex items-center gap-2.5">
									<div class="w-8 h-8 rounded-[10px] bg-[#3390ec]/10 flex items-center justify-center border border-[#3390ec]/20 shadow-inner"><span class="material-symbols-outlined text-[#3390ec] text-[16px]">campaign</span></div>
									{t('customTextsSettings.forceJoinText')}
								</label>
								<span class="text-[11px] text-white/50 font-medium leading-snug px-1.5">{t('customTextsSettings.forceJoinTextDesc')}</span>
							</div>
							<textarea value={cfg.forceJoinText} onInput={(e) => update('forceJoinText', e.currentTarget.value)} placeholder="📢 {user}, join required channels to chat:\n{channel_names}" class="w-full h-20 bg-[#08090D] text-white text-[13px] font-medium leading-relaxed rounded-[16px] px-4 py-3.5 focus:outline-none focus:ring-1 focus:ring-[#3390ec]/50 border border-white/5 transition-all resize-none placeholder-white/20 shadow-inner" />
						</div>

						<div class="w-full h-[1px] bg-white/5 rounded-full" />

						<div class="flex flex-col gap-3">
							<div class="flex flex-col gap-1">
								<label class="text-[14px] font-black text-white flex items-center gap-2.5">
									<div class="w-8 h-8 rounded-[10px] bg-[#ff9500]/10 flex items-center justify-center border border-[#ff9500]/20 shadow-inner"><span class="material-symbols-outlined text-[#ff9500] text-[16px]">person_add</span></div>
									{t('customTextsSettings.forceAddText')}
								</label>
								<span class="text-[11px] text-white/50 font-medium leading-snug px-1.5">{t('customTextsSettings.forceAddTextDesc')}</span>
							</div>
							<textarea value={cfg.forceAddText} onInput={(e) => update('forceAddText', e.currentTarget.value)} placeholder="👥 {user}, invite {remainadd} member(s) to chat ({added}/{number})" class="w-full h-20 bg-[#08090D] text-white text-[13px] font-medium leading-relaxed rounded-[16px] px-4 py-3.5 focus:outline-none focus:ring-1 focus:ring-[#3390ec]/50 border border-white/5 transition-all resize-none placeholder-white/20 shadow-inner" />
						</div>
					</Motion.div>

					{/* Inline Buttons */}
					<Motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} class="bg-[#12141C]/80 backdrop-blur-xl rounded-[24px] border border-white/5 p-5 flex flex-col shadow-sm">
						<InlineButtonField
							label={t('customTextsSettings.inlineButtons')}
							description={t('customTextsSettings.inlineButtonsDesc')}
							buttons={cfg.inlineButtons}
							onAdd={(btn) => update('inlineButtons', [...cfg.inlineButtons, btn])}
							onRemove={(id) => update('inlineButtons', cfg.inlineButtons.filter((b) => b.id !== id))}
						/>
					</Motion.div>
				</div>
			</Suspense>

			{/* ═══════ FLOATING SAVE BUTTON ═══════ */}
			<Show when={isDirty()}>
				<div class="fixed bottom-0 left-0 right-0 p-5 bg-gradient-to-t from-[#030303] via-[#030303]/90 to-transparent z-40 pointer-events-none">
					<div class="max-w-md mx-auto flex gap-3 pointer-events-auto">
						<button onClick={() => refetch()} disabled={isSaving()} class="w-16 h-14 bg-[#12141C]/80 backdrop-blur-md text-[#ff4a4a] border border-[#ff4a4a]/20 rounded-[16px] transition-all flex items-center justify-center hover:bg-[#ff4a4a]/10 active:scale-95 shadow-sm">
							<span class="material-symbols-outlined text-[24px]">close</span>
						</button>
						<button onClick={handleSave} disabled={isSaving()} class="flex-1 h-14 bg-gradient-to-r from-[#3390ec] to-[#2b7ec9] hover:from-[#2b7ec9] hover:to-[#3390ec] text-white rounded-[16px] font-black text-[14px] uppercase tracking-widest shadow-[0_10px_30px_rgba(51,144,236,0.35)] transition-all flex items-center justify-center gap-2 disabled:opacity-40 disabled:scale-100 active:scale-95 border border-white/10">
							<Show when={!isSaving()} fallback={<span class="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />}>
								{t('generalSettings.saveSettings')} <span class="material-symbols-outlined text-[22px]">save</span>
							</Show>
						</button>
					</div>
				</div>
			</Show>
		</div>
	);
};

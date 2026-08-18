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
import { isRtl, t } from '@/shared/i18n/index.js';
import { showConfirm } from '@/shared/lib/telegram-native.js';
import { SelectField, SettingsSection } from '@/shared/ui/settings-controls.js';
import { showToast } from '@/shared/ui/index.js';
import { haptic } from '@/shared/lib/haptic.js';

interface ContentTypes { text: boolean; photos: boolean; videos: boolean; files: boolean; voice: boolean; }
interface ForwardRule { id: string; direction: 'inbound' | 'outbound'; targetType: 'telegram' | 'webhook'; target: string; mode: string; active: boolean; }

export const ChannelForwardingPage: Component = () => {
	const params = useParams();
	const navigate = useNavigate();
	const [isMenuOpen, setIsMenuOpen] = createSignal(false);
	const [isCreating, setIsCreating] = createSignal(false);

	// Rule Form State
	const [direction, setDirection] = createSignal<'inbound' | 'outbound'>('outbound');
	const [targetType, setTargetType] = createSignal<'telegram' | 'webhook'>('telegram');
	const [sourceChat, setSourceChat] = createSignal('');
	const [targetChat, setTargetChat] = createSignal('');
	const [isSourceVerified, setIsSourceVerified] = createSignal<boolean | null>(null);
	const [verifiedSourceId, setVerifiedSourceId] = createSignal('');
	const [isTargetVerified, setIsTargetVerified] = createSignal<boolean | null>(null);
	const [verifiedTargetId, setVerifiedTargetId] = createSignal('');
	const [mode, setMode] = createSignal('forward');

	const [contentTypes, setContentTypes] = createSignal<ContentTypes>({ text: true, photos: true, videos: true, files: true, voice: true });

	const [inboundWebhookUrl] = createSignal(`${import.meta.env.VITE_API_URL || 'https://api.ifragment.app'}/wh/${params.id}/${Math.random().toString(36).substring(2, 15)}`);

	// Advanced Options State
	const [showAdvanced, setShowAdvanced] = createSignal(false);
	const [removeAds, setRemoveAds] = createSignal(false);
	const [removeHashtags, setRemoveHashtags] = createSignal(false);
	const [removeLinks, setRemoveLinks] = createSignal(false);
	const [watermark, setWatermark] = createSignal('');
	const [delay, setDelay] = createSignal('');

	const [rules, setRules] = createSignal<ForwardRule[]>([]);
	const [isForwardingEnabled, setIsForwardingEnabled] = createSignal(localStorage.getItem(`forwarding_enabled_${params.id}`) !== 'false');

	const [rulesData, { refetch: refetchRules }] = createResource(() => params.id, (id) => channelApi.getForwardingRules(id));
	const [logsData] = createResource(() => params.id, (id) => channelApi.getForwardingLogs(id));

	createEffect(() => {
		const list = rulesData();
		if (list) {
			setRules(list.map((r: any) => ({
				id: r.id || '',
				direction: r.direction,
				targetType: r.target_type,
				target: r.target,
				sourceChannel: r.source_channel,
				targetChannel: r.target_channel,
				mode: r.mode,
				active: r.is_active,
			})));
		}
	});

	const forwardLog = () => {
		const logs = logsData();
		if (!logs || !Array.isArray(logs)) return [];
		return logs.map((l: any, idx: number) => ({
			id: l.id || idx,
			text: l.message || l.text || t('channelForwarding.logReceived'),
			time: l.created_at ? new Date(l.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Just now',
			status: l.status || 'success',
		}));
	};

	const getLocalizedMode = (mode: string) => {
		if (mode === 'forward') return t('channelForwarding.modeForwardLabel');
		if (mode === 'copy') return t('channelForwarding.modeCopyLabel');
		if (mode === 'ai') return t('channelForwarding.modeCopyAiLabel');
		return mode;
	};

	const getLocalizedDirection = (direction: string) => {
		if (direction === 'inbound') return t('channelForwarding.inbound');
		if (direction === 'outbound') return t('channelForwarding.outbound');
		return direction;
	};

	const formatTelegramTarget = (target: string) => {
		if (!target) return '';
		if (target.startsWith('@') || target.startsWith('-') || /^\d+$/.test(target)) return target;
		return `@${target}`;
	};

	onMount(() => {
		backButton.show();
		const off = backButton.onClick(() => {
			haptic.impact('light');
			if (isCreating()) setIsCreating(false);
			else navigate(`/channel/${params.id}`);
		});
		onCleanup(() => off());
	});

	const cleanTelegramInput = (input: string) => {
		let str = input.trim();
		if (!str) return str;
		if (str.includes('t.me/') || str.includes('telegram.me/')) {
			str = str.replace(/https?:\/\/(t|telegram)\.me\//i, '');
			str = str.split('/')[0];
		}
		str = str.replace(/@/g, '');
		if (!str.startsWith('-100') && !str.startsWith('http')) {
			str = '@' + str;
		}
		return str;
	};

	const handleVerifySource = async () => {
		let src = sourceChat().trim();
		if (!src) return;
		if (targetType() === 'telegram') {
			src = cleanTelegramInput(src);
			setSourceChat(src.replace(/@/g, ''));
		}
		haptic.impact('medium');
		setIsSourceVerified(null);
		try {
			const result = await channelApi.verifyForwardingTarget(params.id, src);
			setVerifiedSourceId(result?.id ? String(result.id) : '');
			setIsSourceVerified(true);
			haptic.notify('success');
			showToast(t('channelForwarding.targetVerified'), 'success');
		} catch (_err) {
			setVerifiedSourceId('');
			setIsSourceVerified(false);
			haptic.notify('error');
			showToast(t('channelForwarding.targetVerifyFailed'), 'error');
		}
	};

	const handleVerifyTarget = async () => {
		let tgt = targetChat().trim();
		if (!tgt) return;
		if (targetType() === 'telegram') {
			tgt = cleanTelegramInput(tgt);
			setTargetChat(tgt.replace(/@/g, ''));
		}
		haptic.impact('medium');
		setIsTargetVerified(null);
		try {
			const result = await channelApi.verifyForwardingTarget(params.id, tgt);
			setVerifiedTargetId(result?.id ? String(result.id) : '');
			setIsTargetVerified(true);
			haptic.notify('success');
			showToast(t('channelForwarding.targetVerified'), 'success');
		} catch (_err) {
			setVerifiedTargetId('');
			setIsTargetVerified(false);
			haptic.notify('error');
			showToast(t('channelForwarding.targetVerifyFailed'), 'error');
		}
	};

	const handleSaveRule = async () => {
		let finalSource = sourceChat().trim();
		let finalTarget = targetChat().trim();

		if (targetType() === 'telegram') {
			if (finalSource) finalSource = cleanTelegramInput(finalSource);
			if (finalTarget) finalTarget = cleanTelegramInput(finalTarget);
		}

		if (finalSource && finalTarget && finalSource.replace(/@/g, '').toLowerCase() === finalTarget.replace(/@/g, '').toLowerCase()) {
			showToast(t('channelForwarding.sourceAndTargetMustBeDifferent') || 'Source and target channels must be different', 'error');
			haptic.notify('error');
			return;
		}

		let isReadyToSave = false;

		if (targetType() === 'webhook') {
			if (direction() === 'inbound') {
				showToast(t('channelForwarding.inboundWebhookUnavailable'), 'error');
				haptic.notify('error');
				return;
			} else if (finalTarget && (isTargetVerified() === true || finalTarget.startsWith('http'))) {
				isReadyToSave = true;
			}
		} else {
			if (finalSource && finalTarget) isReadyToSave = true;
		}

		if (isReadyToSave) {
			const primaryTarget = direction() === 'outbound' ? (verifiedTargetId() || finalTarget) : (verifiedSourceId() || finalSource);
			const newRule = {
				channel_id: params.id,
				direction: direction(),
				target_type: targetType(),
				target: primaryTarget,
				source_channel: finalSource,
				target_channel: finalTarget,
				mode: mode() as any,
				delay: delay(),
				is_active: true,
				content_types: contentTypes(),
				remove_ads: removeAds(),
				remove_hashtags: removeHashtags(),
				remove_links: removeLinks(),
				watermark: watermark(),
			};

			try {
				await channelApi.createForwardingRule(params.id, newRule);
				refetchRules();
				haptic.notify('success');
				showToast(t('channelForwarding.ruleSaved'), 'success');
				setIsCreating(false);
				setSourceChat(''); setTargetChat('');
				setIsSourceVerified(null); setVerifiedSourceId('');
				setIsTargetVerified(null); setVerifiedTargetId('');
				setMode('forward'); setDelay('');
			} catch (err) {
				console.error('Failed to create rule:', err);
				haptic.notify('error');
				showToast(t('channelForwarding.ruleSaveFailed'), 'error');
			}
		} else {
			showToast(t('channelForwarding.verifyBeforeSave'), 'error');
		}
	};

	const toggleContentType = (key: keyof ContentTypes) => {
		haptic.selection();
		setContentTypes((prev) => ({ ...prev, [key]: !prev[key] }));
	};

	return (
		<div class="min-h-screen bg-[#030303] pb-28 relative overflow-x-hidden text-white font-sans selection:bg-[#3390ec]/30" dir={isRtl() ? 'rtl' : 'ltr'}>
			
			{/* Ambient Top Glow */}
			<div class="absolute top-0 left-0 right-0 h-[350px] bg-gradient-to-b from-[#3390ec]/15 via-transparent to-transparent blur-[80px] pointer-events-none z-0" />

			{/* ═══════ PREMIUM STICKY HEADER ═══════ */}
			<div class="pt-6 pb-4 px-5 sticky top-0 bg-[#030303]/85 backdrop-blur-2xl z-40 border-b border-white/5 flex items-center justify-between gap-3 shadow-sm">
				<div class="flex items-center gap-3.5 overflow-hidden flex-1">
					<button
						onClick={() => {
							haptic.impact('light');
							if (isCreating()) setIsCreating(false);
							else navigate(`/channel/${params.id}`);
						}}
						class="w-11 h-11 rounded-[14px] bg-[#12141C]/80 flex items-center justify-center border border-white/10 hover:bg-white/10 active:scale-95 transition-all shrink-0 shadow-sm text-white/80"
						aria-label={t('common.back')}
					>
						<span class="material-symbols-outlined text-[22px] rtl:-scale-x-100">arrow_back</span>
					</button>
					<div class="flex flex-col overflow-hidden">
						<h1 class="text-[18px] font-black text-white leading-tight truncate tracking-tight">
							{t('channelForwarding.autoForward')}
						</h1>
						<span class="text-[11px] font-bold uppercase tracking-wider text-white/50 truncate mt-0.5">
							{t('channelForwarding.duplicatePosts')}
						</span>
					</div>
				</div>

				<button
					onClick={() => setIsMenuOpen(true)}
					class="w-11 h-11 rounded-[14px] bg-[#12141C]/80 flex items-center justify-center border border-white/10 hover:bg-white/10 active:scale-95 transition-colors shrink-0 shadow-sm text-white/80"
					aria-label={t('common.toggle')}
				>
					<span class="material-symbols-outlined text-[22px]">menu</span>
				</button>
			</div>

			<ChannelHamburgerMenu isOpen={isMenuOpen()} onClose={() => setIsMenuOpen(false)} channelId={params.id} activeTab="forwarding" />

			<div class="px-5 pt-5 flex flex-col gap-5 max-w-md mx-auto relative z-10 w-full pb-10">
				
				<ChannelContextBar channelId={params.id} />

				<Show when={!isCreating()}>
					<Motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} class="flex flex-col gap-4 mt-1">
						
						{/* ═══════ GUIDE BANNER ═══════ */}
						<div class="bg-gradient-to-br from-[#3390ec]/15 to-[#12141C]/50 border border-[#3390ec]/20 rounded-[24px] p-5 flex flex-col gap-3 relative overflow-hidden shadow-sm">
							<div class="absolute -top-10 -right-10 w-36 h-36 bg-[#3390ec]/20 rounded-full blur-3xl pointer-events-none" />
							<div class="flex items-start gap-3 relative z-10 w-full">
								<div class="w-10 h-10 rounded-[12px] bg-[#3390ec]/15 flex items-center justify-center border border-[#3390ec]/30 shadow-inner shrink-0 mt-0.5">
									<span class="material-symbols-outlined text-[#3390ec] text-[20px]">route</span>
								</div>
								<div class="flex flex-col gap-1 w-full">
									<h3 class="text-[14px] font-black text-[#3390ec] tracking-tight">
										{t('channelForwarding.howForwardingWorks')}
									</h3>
									<p class="text-[12px] text-white/70 font-medium leading-relaxed">
										{t('channelForwarding.howForwardingWorksDesc')}
									</p>
								</div>
							</div>
						</div>

						{/* ═══════ MASTER TOGGLE ═══════ */}
						<div class="bg-[#12141C]/80 backdrop-blur-xl rounded-[24px] border border-white/5 p-2 shadow-sm">
							<SettingsSection
								title={t('channelForwarding.enableAutoForward')}
								description={t('channelForwarding.enableAutoForwardDesc')}
								enabled={isForwardingEnabled()}
								onToggle={(v) => {
									setIsForwardingEnabled(v);
									localStorage.setItem(`forwarding_enabled_${params.id}`, String(v));
									haptic.selection();
								}}
							/>
						</div>

						<Show when={isForwardingEnabled()}>
							
							{/* EMPTY STATE */}
							<Show when={rules().length === 0}>
								<div class="bg-[#12141C]/80 backdrop-blur-xl rounded-[28px] border border-white/5 border-dashed p-8 flex flex-col items-center text-center gap-3 shadow-sm mt-2">
									<div class="w-16 h-16 rounded-[20px] bg-white/5 flex items-center justify-center mb-1 border border-white/10 shadow-inner">
										<span class="material-symbols-outlined text-[36px] text-white/30">call_split</span>
									</div>
									<h2 class="text-[15px] font-black text-white/60 tracking-tight">
										{t('channelForwarding.noForwardingRules')}
									</h2>
									<p class="text-[12px] text-white/40 font-medium leading-relaxed">
										{t('channelForwarding.noForwardingRulesDesc')}
									</p>
									<button
										onClick={() => { haptic.impact('light'); setIsCreating(true); }}
										class="mt-4 w-full h-14 bg-gradient-to-r from-[#3390ec] to-[#2b7ec9] text-white font-black text-[13px] uppercase tracking-widest rounded-[16px] hover:from-[#2b7ec9] hover:to-[#3390ec] transition-all shadow-[0_10px_25px_rgba(51,144,236,0.3)] active:scale-95 border border-white/10"
									>
										{t('channelForwarding.createRule')}
									</button>
								</div>
							</Show>

							{/* RULES LIST */}
							<Show when={rules().length > 0}>
								<div class="flex items-center justify-between px-1 mt-2 mb-1">
									<h2 class="text-[12px] font-black text-white/60 uppercase tracking-widest flex items-center gap-2">
										<span class="material-symbols-outlined text-[20px] text-white/40">account_tree</span>
										{t('channelForwarding.activeRules')}
									</h2>
								</div>
								<div class="flex flex-col gap-3">
									<For each={rules()}>
										{(rule) => (
											<div class="bg-[#12141C]/80 backdrop-blur-xl rounded-[24px] border border-white/5 p-4.5 flex flex-col gap-4 shadow-sm hover:border-white/10 transition-colors">
												<div class="flex items-center justify-between">
													<div class="flex items-center gap-3.5 flex-1 min-w-0 pr-2">
														<div class={`w-12 h-12 rounded-[14px] flex items-center justify-center shrink-0 shadow-inner border ${rule.direction === 'inbound' ? 'bg-[#10b981]/15 text-[#10b981] border-[#10b981]/30' : 'bg-[#3390ec]/15 text-[#3390ec] border-[#3390ec]/30'}`}>
															<span class="material-symbols-outlined text-[22px] drop-shadow-md">
																{rule.targetType === 'webhook' ? 'webhook' : rule.direction === 'inbound' ? 'download' : 'upload'}
															</span>
														</div>
														<div class="flex flex-col min-w-0 gap-1">
															<span class="text-[15px] font-black text-white truncate tracking-tight">
																{rule.targetType === 'webhook'
																	? rule.direction === 'inbound' ? rule.target : `${t('channelForwarding.to')} ${rule.target}`
																	: rule.direction === 'inbound' ? `${t('channelForwarding.from')} ${formatTelegramTarget(rule.target)}` : `${t('channelForwarding.to')} ${formatTelegramTarget(rule.target)}`}
															</span>
															<span class="text-[10px] font-bold text-white/50 uppercase tracking-widest flex items-center gap-1.5 truncate">
																<Show when={rule.targetType === 'webhook'}>
																	<span class="material-symbols-outlined text-[12px] text-[#ff4a4a]">webhook</span>
																</Show>
																{getLocalizedMode(rule.mode)} <span class="w-1 h-1 rounded-full bg-white/20" /> {getLocalizedDirection(rule.direction)}
															</span>
														</div>
													</div>
													<div class="flex items-center gap-2.5 shrink-0">
														<button
															onClick={async () => {
																haptic.selection();
																try {
																	const r = rulesData()?.find((x: any) => x.id === rule.id);
																	if (r) {
																		const updated = { ...r, is_active: !r.is_active };
																		await channelApi.updateForwardingRule(params.id, r.id!, updated);
																		refetchRules();
																	}
																} catch (_err) {
																	haptic.notify('error');
																	showToast(t('channelForwarding.toggleFailed'), 'error');
																}
															}}
															class={`w-12 h-7 rounded-full relative transition-colors ${rule.active ? 'bg-[#10b981]' : 'bg-white/10'}`}
														>
															<div class={`absolute top-1 left-1 w-5 h-5 bg-white rounded-full transition-transform shadow-sm ${rule.active ? 'translate-x-5' : 'translate-x-0'}`}></div>
														</button>

														<button
															onClick={async () => {
																const confirmed = await showConfirm(t('channelForwarding.deleteRuleConfirm'));
																if (!confirmed) return;
																try {
																	haptic.impact('medium');
																	await channelApi.deleteForwardingRule(params.id, rule.id);
																	refetchRules();
																	showToast(t('channelForwarding.ruleDeleted'), 'success');
																} catch (_err) {
																	haptic.notify('error');
																	showToast(t('channelForwarding.deleteRuleFailed'), 'error');
																}
															}}
															class="w-9 h-9 rounded-[10px] bg-[#ff4a4a]/10 border border-[#ff4a4a]/20 hover:bg-[#ff4a4a] text-[#ff4a4a] hover:text-white flex items-center justify-center transition-all shadow-sm shrink-0 active:scale-95"
														>
															<span class="material-symbols-outlined text-[18px]">delete</span>
														</button>
													</div>
												</div>
											</div>
										)}
									</For>
								</div>

								<button
									onClick={() => { haptic.impact('light'); setIsCreating(true); }}
									class="h-14 bg-white/5 text-white/60 hover:text-white hover:bg-white/10 font-black text-[12px] uppercase tracking-widest rounded-[16px] transition-all flex items-center justify-center gap-2 mt-1 border border-white/10 active:scale-95 shadow-sm"
								>
									<span class="material-symbols-outlined text-[20px]">add_circle</span>
									{t('channelForwarding.addNewRule')}
								</button>
							</Show>

							{/* RECENT ACTIVITY LOGS */}
							<Show when={forwardLog().length > 0}>
								<div class="mt-6 flex flex-col gap-3">
									<div class="flex items-center gap-2 px-1 mb-1">
										<span class="material-symbols-outlined text-[#8e8e93] text-[20px]">history</span>
										<h2 class="text-[12px] font-black text-white/60 uppercase tracking-widest">{t('channelForwarding.recentActivity')}</h2>
									</div>
									<div class="bg-[#12141C]/80 backdrop-blur-xl rounded-[24px] border border-white/5 p-2 shadow-inner">
										<For each={forwardLog()}>
											{(log, index) => (
												<div class={`p-3.5 flex items-start gap-3.5 group hover:bg-white/[0.02] rounded-[16px] transition-colors ${index() !== forwardLog().length - 1 ? 'border-b border-white/5' : ''}`}>
													<span class="material-symbols-outlined text-[#10b981] text-[20px] mt-0.5 drop-shadow-md">check_circle</span>
													<div class="flex flex-col flex-1 gap-1">
														<span class="text-[13px] font-bold text-white/90 leading-snug">{log.text}</span>
														<span class="text-[10px] font-mono font-bold text-white/40 bg-[#08090D] border border-white/5 px-2 py-0.5 rounded-[6px] w-fit shadow-inner">{log.time}</span>
													</div>
												</div>
											)}
										</For>
									</div>
								</div>
							</Show>
						</Show>
					</Motion.div>
				</Show>

				{/* ═══════ CREATE ROUTE VIEW ═══════ */}
				<Show when={isCreating()}>
					<Motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.3, easing: [0.32, 0.72, 0, 1] }} class="flex flex-col gap-4">
						
						{/* MODULE 1: Target Definition */}
						<div class="bg-[#12141C]/80 backdrop-blur-xl rounded-[24px] border border-white/5 p-5 flex flex-col gap-5 shadow-sm relative overflow-hidden">
							<div class="flex items-center gap-3 relative z-10 border-b border-white/5 pb-3">
								<div class="w-10 h-10 rounded-[12px] bg-[#3390ec]/15 flex items-center justify-center border border-[#3390ec]/30 shadow-inner shrink-0">
									<span class="material-symbols-outlined text-[20px] text-[#3390ec]">add_route</span>
								</div>
								<h2 class="text-[15px] font-black text-white tracking-tight">{t('channelForwarding.addNewRule')}</h2>
							</div>

							<div class="flex flex-col gap-1.5 relative z-10">
								<label class="text-[10px] font-black uppercase tracking-widest text-white/40 px-1">{t('channelForwarding.ruleDirection')}</label>
								<div class="bg-[#08090D] p-1.5 rounded-[16px] flex border border-white/5 shadow-inner">
									<button
										onClick={() => { setDirection('outbound'); setIsSourceVerified(null); setIsTargetVerified(null); haptic.selection(); }}
										class={`flex-1 h-10 text-[11px] font-black uppercase tracking-widest rounded-[12px] transition-all flex items-center justify-center gap-2 ${direction() === 'outbound' ? 'bg-[#3390ec] text-white shadow-sm' : 'text-white/40 hover:text-white'}`}
									>
										<span class="material-symbols-outlined text-[16px]">upload</span> {t('channelForwarding.outbound')}
									</button>
									<button
										onClick={() => { setDirection('inbound'); setIsSourceVerified(null); setIsTargetVerified(null); haptic.selection(); }}
										class={`flex-1 h-10 text-[11px] font-black uppercase tracking-widest rounded-[12px] transition-all flex items-center justify-center gap-2 ${direction() === 'inbound' ? 'bg-[#10b981] text-white shadow-sm' : 'text-white/40 hover:text-white'}`}
									>
										<span class="material-symbols-outlined text-[16px]">download</span> {t('channelForwarding.inbound')}
									</button>
								</div>
								<p class="text-[10px] text-white/40 mt-1 text-center font-bold px-4">
									{direction() === 'outbound' ? t('channelForwarding.outboundDesc') : t('channelForwarding.inboundDesc')}
								</p>
							</div>

							<div class="flex flex-col gap-1.5 relative z-10">
								<label class="text-[10px] font-black uppercase tracking-widest text-white/40 px-1">{t('channelForwarding.integrationType')}</label>
								<div class="bg-[#08090D] p-1.5 rounded-[16px] flex border border-white/5 shadow-inner">
									<button
										onClick={() => { setTargetType('telegram'); setIsSourceVerified(null); setIsTargetVerified(null); haptic.selection(); }}
										class={`flex-1 h-10 text-[11px] font-black uppercase tracking-widest rounded-[12px] transition-all flex items-center justify-center gap-2 ${targetType() === 'telegram' ? 'bg-white/10 text-white shadow-sm' : 'text-white/40 hover:text-white'}`}
									>
										<span class="material-symbols-outlined text-[16px]">telegram</span> {t('channelForwarding.telegram')}
									</button>
									<button
										onClick={() => { setTargetType('webhook'); setIsSourceVerified(null); setIsTargetVerified(null); haptic.selection(); }}
										class={`flex-1 h-10 text-[11px] font-black uppercase tracking-widest rounded-[12px] transition-all flex items-center justify-center gap-2 ${targetType() === 'webhook' ? 'bg-white/10 text-white shadow-sm' : 'text-white/40 hover:text-white'}`}
									>
										<span class="material-symbols-outlined text-[16px]">webhook</span> {t('channelForwarding.webhookApi')}
									</button>
								</div>
							</div>

							<Show when={targetType() === 'telegram'}>
								{/* Source Channel Field */}
								<div class="flex flex-col gap-1.5 relative z-10">
									<label class="text-[10px] font-black uppercase tracking-widest text-white/40 px-1 flex items-center gap-2">
										{t('channelForwarding.sourceChannel')}
									</label>
									<div class="flex gap-2">
										<div class="relative flex-1">
											<span class="absolute left-4 top-1/2 -translate-y-1/2 text-white/30 font-black">@</span>
											<input
												type="text" value={sourceChat()}
												onInput={(e) => { setSourceChat(e.currentTarget.value.replace(/@/g, '')); setIsSourceVerified(null); setVerifiedSourceId(''); }}
												placeholder="source_channel_username"
												class="bg-[#08090D] border border-white/5 text-white text-[14px] font-mono font-bold rounded-[16px] pl-10 pr-4 py-4 w-full focus:outline-none focus:border-[#3390ec]/50 shadow-inner transition-colors"
											/>
										</div>
										<button
											onClick={handleVerifySource} disabled={!sourceChat().trim()}
											class="w-14 shrink-0 bg-white/5 hover:bg-white/10 border border-white/10 disabled:opacity-50 disabled:bg-transparent text-white rounded-[16px] flex items-center justify-center transition-all active:scale-95 shadow-sm"
										>
											<Show when={isSourceVerified() === null}><span class="material-symbols-outlined text-[24px]">search</span></Show>
											<Show when={isSourceVerified() === true}><span class="material-symbols-outlined text-[#10b981] text-[24px] drop-shadow-md">check_circle</span></Show>
											<Show when={isSourceVerified() === false}><span class="material-symbols-outlined text-[#ff4a4a] text-[24px] drop-shadow-md">error</span></Show>
										</button>
									</div>
								</div>

								{/* Target Channel Field */}
								<div class="flex flex-col gap-1.5 relative z-10">
									<label class="text-[10px] font-black uppercase tracking-widest text-white/40 px-1 flex items-center gap-2">
										{t('channelForwarding.targetChannel')}
									</label>
									<div class="flex gap-2">
										<div class="relative flex-1">
											<span class="absolute left-4 top-1/2 -translate-y-1/2 text-white/30 font-black">@</span>
											<input
												type="text" value={targetChat()}
												onInput={(e) => { setTargetChat(e.currentTarget.value.replace(/@/g, '')); setIsTargetVerified(null); setVerifiedTargetId(''); }}
												placeholder="target_channel_username"
												class="bg-[#08090D] border border-white/5 text-white text-[14px] font-mono font-bold rounded-[16px] pl-10 pr-4 py-4 w-full focus:outline-none focus:border-[#3390ec]/50 shadow-inner transition-colors"
											/>
										</div>
										<button
											onClick={handleVerifyTarget} disabled={!targetChat().trim()}
											class="w-14 shrink-0 bg-white/5 hover:bg-white/10 border border-white/10 disabled:opacity-50 disabled:bg-transparent text-white rounded-[16px] flex items-center justify-center transition-all active:scale-95 shadow-sm"
										>
											<Show when={isTargetVerified() === null}><span class="material-symbols-outlined text-[24px]">search</span></Show>
											<Show when={isTargetVerified() === true}><span class="material-symbols-outlined text-[#10b981] text-[24px] drop-shadow-md">check_circle</span></Show>
											<Show when={isTargetVerified() === false}><span class="material-symbols-outlined text-[#ff4a4a] text-[24px] drop-shadow-md">error</span></Show>
										</button>
									</div>
								</div>
							</Show>

							<Show when={targetType() === 'webhook' && direction() === 'outbound'}>
								<div class="flex flex-col gap-1.5 relative z-10">
									<label class="text-[10px] font-black uppercase tracking-widest text-white/40 px-1 flex items-center justify-between">
										{t('channelForwarding.destinationWebhook')}
									</label>
									<div class="relative">
										<span class="absolute left-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-white/30 text-[20px]">link</span>
										<input
											type="url" value={targetChat()}
											onInput={(e) => { setTargetChat(e.currentTarget.value); setIsTargetVerified(!!e.currentTarget.value.startsWith('http')); setVerifiedTargetId(''); }}
											placeholder="https://api.example.com/webhook"
											class="bg-[#08090D] border border-white/5 text-white text-[13px] font-mono font-bold rounded-[16px] pl-12 pr-4 py-4 w-full focus:outline-none focus:border-[#3390ec]/50 shadow-inner transition-colors"
											dir="ltr"
										/>
									</div>
								</div>
							</Show>

							<Show when={targetType() === 'webhook' && direction() === 'inbound'}>
								<div class="flex flex-col gap-1.5 relative z-10">
									<label class="text-[10px] font-black uppercase tracking-widest text-white/40 px-1">
										{t('channelForwarding.uniqueInboundWebhook')}
									</label>
									<div class="flex gap-2">
										<input
											type="text" value={inboundWebhookUrl()} readonly
											class="bg-[#08090D] border border-white/5 text-[#10b981] text-[11px] font-mono font-bold rounded-[16px] px-4 py-4 w-full focus:outline-none shadow-inner opacity-80"
											dir="ltr"
										/>
										<button
											onClick={() => {
												haptic.selection();
												navigator.clipboard.writeText(inboundWebhookUrl());
												showToast(t('common.copiedToClipboard'), 'success');
											}}
											class="w-14 shrink-0 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-[16px] flex items-center justify-center transition-all active:scale-95 shadow-sm"
										>
											<span class="material-symbols-outlined text-[20px]">content_copy</span>
										</button>
									</div>
									<p class="text-[10px] font-bold text-white/40 px-1">{t('channelForwarding.inboundWebhookPlaceholder')}</p>
								</div>
							</Show>

							<div class="flex flex-col gap-1.5 relative z-10">
								<label class="text-[10px] font-black uppercase tracking-widest text-white/40 px-1">
									{t('channelForwarding.mode')}
								</label>
								<div class="bg-[#08090D] rounded-[16px] border border-white/5 p-1.5 shadow-inner">
									<SelectField
										label=""
										value={mode()}
										onChange={(v) => { haptic.selection(); setMode(v); }}
										options={[
											{ value: 'forward', label: t('channelForwarding.modeForwardLabel') },
											{ value: 'copy', label: t('channelForwarding.modeCopyLabel') },
											{ value: 'ai', label: t('channelForwarding.modeCopyAiLabel') },
										]}
									/>
								</div>
							</div>

							<div class="flex flex-col gap-1.5 relative z-10">
								<label class="text-[10px] font-black uppercase tracking-widest text-white/40 px-1">
									{t('channelForwarding.delay')}
								</label>
								<div class="relative">
									<span class="absolute left-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-white/30 text-[20px]">timer</span>
									<input
										type="number" value={delay()} onInput={(e) => setDelay(e.currentTarget.value)}
										placeholder={t('channelForwarding.delayPlaceholder')}
										class="bg-[#08090D] border border-white/5 text-white text-[14px] font-mono font-bold rounded-[16px] pl-12 pr-4 py-4 w-full focus:outline-none focus:border-[#3390ec]/50 shadow-inner transition-colors"
										dir="ltr"
									/>
								</div>
							</div>
						</div>

						{/* MODULE 2: Content Filters */}
						<div class="bg-[#12141C]/80 backdrop-blur-xl rounded-[24px] border border-white/5 p-5 flex flex-col gap-4 shadow-sm">
							<div class="flex flex-col gap-0.5">
								<h3 class="text-[14px] font-black text-white flex items-center gap-2">
									<span class="material-symbols-outlined text-white/40 text-[20px]">filter_alt</span>
									{t('channelForwarding.allowedContentTypes')}
								</h3>
								<p class="text-[11px] font-bold text-white/50 px-7">
									{t('channelForwarding.allowedContentTypesDesc')}
								</p>
							</div>
							
							<div class="grid grid-cols-2 gap-3 mt-1">
								<div onClick={() => toggleContentType('text')} class={`p-3.5 rounded-[16px] border flex items-center gap-2.5 transition-all cursor-pointer active:scale-95 shadow-sm ${contentTypes().text ? 'bg-[#3390ec]/15 border-[#3390ec]/30 text-[#3390ec] shadow-[inset_0_0_15px_rgba(51,144,236,0.1)]' : 'bg-[#08090D] border-white/5 text-white/40 hover:bg-white/5'}`}>
									<span class="material-symbols-outlined text-[20px]">format_align_left</span>
									<span class="text-[12px] font-black uppercase tracking-widest">{t('channelForwarding.filterText')}</span>
								</div>
								<div onClick={() => toggleContentType('photos')} class={`p-3.5 rounded-[16px] border flex items-center gap-2.5 transition-all cursor-pointer active:scale-95 shadow-sm ${contentTypes().photos ? 'bg-[#3390ec]/15 border-[#3390ec]/30 text-[#3390ec] shadow-[inset_0_0_15px_rgba(51,144,236,0.1)]' : 'bg-[#08090D] border-white/5 text-white/40 hover:bg-white/5'}`}>
									<span class="material-symbols-outlined text-[20px]">image</span>
									<span class="text-[12px] font-black uppercase tracking-widest">{t('channelForwarding.filterPhoto')}</span>
								</div>
								<div onClick={() => toggleContentType('videos')} class={`p-3.5 rounded-[16px] border flex items-center gap-2.5 transition-all cursor-pointer active:scale-95 shadow-sm ${contentTypes().videos ? 'bg-[#3390ec]/15 border-[#3390ec]/30 text-[#3390ec] shadow-[inset_0_0_15px_rgba(51,144,236,0.1)]' : 'bg-[#08090D] border-white/5 text-white/40 hover:bg-white/5'}`}>
									<span class="material-symbols-outlined text-[20px]">movie</span>
									<span class="text-[12px] font-black uppercase tracking-widest">{t('channelForwarding.filterVideo')}</span>
								</div>
								<div onClick={() => toggleContentType('files')} class={`p-3.5 rounded-[16px] border flex items-center gap-2.5 transition-all cursor-pointer active:scale-95 shadow-sm ${contentTypes().files ? 'bg-[#3390ec]/15 border-[#3390ec]/30 text-[#3390ec] shadow-[inset_0_0_15px_rgba(51,144,236,0.1)]' : 'bg-[#08090D] border-white/5 text-white/40 hover:bg-white/5'}`}>
									<span class="material-symbols-outlined text-[20px]">description</span>
									<span class="text-[12px] font-black uppercase tracking-widest">{t('channelForwarding.filterDocument')}</span>
								</div>
								<div onClick={() => toggleContentType('voice')} class={`p-3.5 rounded-[16px] border flex items-center justify-center gap-2.5 transition-all cursor-pointer col-span-2 active:scale-95 shadow-sm ${contentTypes().voice ? 'bg-[#3390ec]/15 border-[#3390ec]/30 text-[#3390ec] shadow-[inset_0_0_15px_rgba(51,144,236,0.1)]' : 'bg-[#08090D] border-white/5 text-white/40 hover:bg-white/5'}`}>
									<span class="material-symbols-outlined text-[20px]">mic</span>
									<span class="text-[12px] font-black uppercase tracking-widest">{t('channelForwarding.filterVoice')}</span>
								</div>
							</div>
						</div>

						{/* MODULE 3: Advanced Options */}
						<div class="bg-[#12141C]/80 backdrop-blur-xl rounded-[24px] border border-white/5 flex flex-col shadow-sm transition-all">
							<button onClick={() => { haptic.impact('light'); setShowAdvanced(!showAdvanced()); }} class="p-5 flex items-center justify-between w-full text-left focus:outline-none">
								<span class="text-[14px] font-black text-white flex items-center gap-2.5">
									<span class="material-symbols-outlined text-white/40 text-[20px]">tune</span>
									{t('channelForwarding.advancedMutators')}
								</span>
								<span class={`material-symbols-outlined text-white/50 transition-transform duration-300 ${showAdvanced() ? 'rotate-180' : ''}`}>expand_more</span>
							</button>

							<Show when={showAdvanced()}>
								<div class="px-5 pb-5 flex flex-col gap-4 border-t border-white/5 pt-4">
									<div class="bg-[#08090D] rounded-[20px] p-2 border border-white/5 shadow-inner flex flex-col gap-1">
										<SettingsSection title={t('channelForwarding.removeAds')} description={t('channelForwarding.removeAdsDesc')} enabled={removeAds()} onToggle={(v) => { haptic.selection(); setRemoveAds(v); }} />
										<div class="h-[1px] bg-white/5 mx-4" />
										<SettingsSection title={t('channelForwarding.removeHashtags')} description={t('channelForwarding.removeHashtagsDesc')} enabled={removeHashtags()} onToggle={(v) => { haptic.selection(); setRemoveHashtags(v); }} />
										<div class="h-[1px] bg-white/5 mx-4" />
										<SettingsSection title={t('channelForwarding.removeLinks')} description={t('channelForwarding.removeLinksDesc')} enabled={removeLinks()} onToggle={(v) => { haptic.selection(); setRemoveLinks(v); }} />
									</div>

									<div class="flex flex-col gap-1.5 mt-2">
										<label class="text-[10px] font-black uppercase tracking-widest text-white/40 px-1">{t('channelForwarding.watermarkText')}</label>
										<input
											type="text" value={watermark()} onInput={(e) => setWatermark(e.currentTarget.value)}
											placeholder={t('channelForwarding.watermarkPlaceholder')}
											class="bg-[#08090D] border border-white/5 text-white text-[13px] font-bold rounded-[16px] px-4 py-4 w-full focus:outline-none focus:border-[#3390ec]/50 shadow-inner transition-colors placeholder-white/20"
										/>
										<p class="text-[10px] font-bold text-white/40 px-1 mt-0.5">{t('channelForwarding.watermarkDesc')}</p>
									</div>
								</div>
							</Show>
						</div>

						{/* Action Buttons */}
						<div class="flex gap-3 mt-2">
							<button onClick={() => { haptic.impact('light'); setIsCreating(false); }} class="flex-1 h-14 bg-white/5 hover:bg-white/10 border border-white/10 text-white/60 hover:text-white rounded-[16px] font-black uppercase tracking-widest text-[13px] transition-all active:scale-95 shadow-sm">
								{t('common.cancel')}
							</button>
							<button
								onClick={handleSaveRule}
								disabled={(targetType() === 'telegram' && direction() === 'outbound' && !targetChat().trim()) || (targetType() === 'telegram' && direction() === 'inbound' && !sourceChat().trim()) || (targetType() === 'webhook' && direction() === 'outbound' && !targetChat().trim()) || (targetType() === 'webhook' && direction() === 'inbound') || (targetType() === 'telegram' && direction() === 'outbound' && isTargetVerified() === false) || (targetType() === 'telegram' && direction() === 'inbound' && isSourceVerified() === false)}
								class="flex-[2] h-14 bg-gradient-to-r from-[#3390ec] to-[#2b7ec9] hover:from-[#2b7ec9] hover:to-[#3390ec] text-white rounded-[16px] font-black uppercase tracking-widest text-[13px] transition-all disabled:opacity-40 disabled:scale-100 active:scale-95 shadow-[0_10px_25px_rgba(51,144,236,0.3)] border border-white/10"
							>
								{t('channelForwarding.saveRule')}
							</button>
						</div>
					</Motion.div>
				</Show>
			</div>
		</div>
	);
};

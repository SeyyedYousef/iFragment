import { Motion } from '@motionone/solid';
import { useNavigate, useParams } from '@solidjs/router';
import { backButton, hapticFeedback } from '@tma.js/sdk-solid';
import {
	Component,
	createEffect,
	createMemo,
	createResource,
	createSignal,
	For,
	onCleanup,
	onMount,
	Show,
} from 'solid-js';
import { channelApi } from '@/shared/api/channel-management.js';
import { isRtl, t } from '@/shared/i18n/index.js';
import { ChannelContextBar } from '@/shared/ui/ChannelContextBar.js';
import { ChannelHamburgerMenu } from '@/shared/ui/channel-hamburger-menu.js';
import { SelectField, SettingsSection, ToggleSwitch } from '@/shared/ui/settings-controls.js';
import { showToast } from '@/shared/ui/toast.js';

interface AutoResponderRule {
	id: string;
	keys: string;
	match: string;
	replyText: string;
	enabled: boolean;
	useAi: boolean;
}

export const ChannelAutoResponderPage: Component = () => {
	const params = useParams();
	const navigate = useNavigate();
	const [isMenuOpen, setIsMenuOpen] = createSignal(false);

	const [isCreating, setIsCreating] = createSignal(false);

	// Keyword Rules State
	const [enabled, setEnabled] = createSignal(true);
	const [isRuleEnabled, setIsRuleEnabled] = createSignal(true);
	const [keywords, setKeywords] = createSignal('');
	const [matchType, setMatchType] = createSignal('contains');
	const [replyText, setReplyText] = createSignal('');
	const [useAi, setUseAi] = createSignal(false);
	const [rules, setRules] = createSignal<AutoResponderRule[]>([]);

	// Top-Level State
	const [autoFirstComment, setAutoFirstComment] = createSignal(false);
	const [commentMode, setCommentMode] = createSignal('fixed'); // fixed, rotating, ai
	const [fixedComment, setFixedComment] = createSignal('');
	const [rotatingTexts, setRotatingTexts] = createSignal<string[]>([]);
	const [newRotatingText, setNewRotatingText] = createSignal('');

	const [attachButton, setAttachButton] = createSignal('');

	const [newMemberWelcome, setNewMemberWelcome] = createSignal(false);
	const [welcomeDelay, setWelcomeDelay] = createSignal('3'); // Smart Default: 3 seconds delay
	const [welcomeText, setWelcomeText] = createSignal('');

	const [isSaving, setIsSaving] = createSignal(false);

	const [settings] = createResource(
		() => params.id,
		(id) => channelApi.getSettings(id),
	);

	const normalizeRule = (rule: any, index = 0): AutoResponderRule => ({
		id: String(rule?.id || `rule_${index}`),
		keys: rule?.keys || rule?.trigger || '',
		match: rule?.match || rule?.type || 'contains',
		replyText: rule?.replyText || rule?.response || '',
		enabled: rule?.enabled ?? true,
		useAi: rule?.useAi ?? false,
	});

	// Parse settings on load
	createEffect(() => {
		const data = settings();
		if (data) {
			try {
				let ar = data.auto_responder;
				if (typeof ar === 'string') {
					ar = JSON.parse(ar);
				}
				if (ar && typeof ar === 'object') {
					const obj = ar as Record<string, any>;
					if ('enabled' in obj) setEnabled(!!obj.enabled);
					if ('autoFirstComment' in obj) setAutoFirstComment(!!obj.autoFirstComment);
					if ('commentMode' in obj) setCommentMode(String(obj.commentMode || ''));
					if ('fixedComment' in obj) setFixedComment(String(obj.fixedComment || ''));
					if ('rotatingTexts' in obj && Array.isArray(obj.rotatingTexts))
						setRotatingTexts(obj.rotatingTexts.map(String));
					if ('attachButton' in obj) setAttachButton(String(obj.attachButton || ''));
					if ('newMemberWelcome' in obj) setNewMemberWelcome(!!obj.newMemberWelcome);
					if ('welcomeDelay' in obj) setWelcomeDelay(String(obj.welcomeDelay || '0'));
					if ('welcomeText' in obj) setWelcomeText(String(obj.welcomeText || ''));
					if ('rules' in obj && Array.isArray(obj.rules)) setRules(obj.rules.map(normalizeRule));
				}
			} catch (e) {
				console.error('Failed to parse auto_responder settings:', e);
			}
		}
	});

	const isDirty = createMemo(() => {
		const data = settings();
		if (!data) return false;

		let originalAR: any = {};
		try {
			originalAR =
				typeof data.auto_responder === 'string'
					? JSON.parse(data.auto_responder)
					: data.auto_responder;
		} catch (_e) {
			originalAR = {};
		}

		const currentPayload = {
			enabled: enabled(),
			autoFirstComment: autoFirstComment(),
			commentMode: commentMode(),
			fixedComment: fixedComment(),
			rotatingTexts: rotatingTexts(),
			attachButton: attachButton(),
			newMemberWelcome: newMemberWelcome(),
			welcomeDelay: welcomeDelay(),
			welcomeText: welcomeText(),
			rules: rules(),
		};

		return (
			JSON.stringify(currentPayload) !==
			JSON.stringify({
				enabled: originalAR?.enabled ?? true,
				autoFirstComment: !!originalAR?.autoFirstComment,
				commentMode: originalAR?.commentMode || 'fixed',
				fixedComment: originalAR?.fixedComment || '',
				rotatingTexts: originalAR?.rotatingTexts || [],
				attachButton: originalAR?.attachButton || '',
				newMemberWelcome: !!originalAR?.newMemberWelcome,
				welcomeDelay: originalAR?.welcomeDelay || '0',
				welcomeText: originalAR?.welcomeText || '',
				rules: Array.isArray(originalAR?.rules) ? originalAR.rules.map(normalizeRule) : [],
			})
		);
	});

	const getLocalizedMatch = (match: string) => {
		if (match === 'exact') return t('channelAutoResponder.matchExact');
		if (match === 'contains') return t('channelAutoResponder.matchContains');
		if (match === 'regex') return t('channelAutoResponder.matchRegex');
		return match;
	};

	const handleSaveRule = () => {
		if (keywords().trim() && replyText().trim()) {
			try { hapticFeedback.notificationOccurred('success'); } catch (_) {}
			setRules([
				...rules(),
				{
					id: Date.now().toString(),
					keys: keywords().trim(),
					match: matchType(),
					replyText: replyText().trim(),
					enabled: isRuleEnabled(),
					useAi: useAi(),
				},
			]);
			setIsCreating(false);
			setKeywords('');
			setReplyText('');
			setIsRuleEnabled(true);
			setUseAi(false);
		}
	};

	const handleAddRotatingText = () => {
		if (newRotatingText().trim()) {
			try { hapticFeedback.impactOccurred('light'); } catch (_) {}
			setRotatingTexts([...rotatingTexts(), newRotatingText().trim()]);
			setNewRotatingText('');
		}
	};

	const handleRemoveRotatingText = (idx: number) => {
		try { hapticFeedback.impactOccurred('light'); } catch (_) {}
		setRotatingTexts(rotatingTexts().filter((_, i) => i !== idx));
	};

	const handleSave = async () => {
		setIsSaving(true);

		const currentVersion = settings()?.version ?? 1;
		const payload = {
			enabled: enabled(),
			autoFirstComment: autoFirstComment(),
			commentMode: commentMode(),
			fixedComment: fixedComment(),
			rotatingTexts: rotatingTexts(),
			attachButton: attachButton(),
			newMemberWelcome: newMemberWelcome(),
			welcomeDelay: welcomeDelay(),
			welcomeText: welcomeText(),
			rules: rules(),
		};

		try {
			await channelApi.updateSettings(params.id, 'auto_responder', payload, currentVersion);
			try { hapticFeedback.notificationOccurred('success'); } catch (_) {}
			showToast(t('common.settingsSaved'), 'success');
			navigate(`/channel/${params.id}`);
		} catch (e) {
			console.error('Failed to save auto responder settings:', e);
			try { hapticFeedback.notificationOccurred('error'); } catch (_) {}
			showToast(t('common.saveFailed'), 'error');
		} finally {
			setIsSaving(false);
		}
	};

	onMount(() => {
		backButton.show();
		const off = backButton.onClick(() => {
			try { hapticFeedback.impactOccurred('light'); } catch (_) {}
			if (isCreating()) {
				setIsCreating(false);
			} else {
				navigate(`/channel/${params.id}`);
			}
		});
		onCleanup(() => off());
	});

	return (
		<div class="min-h-screen bg-[#030303] pb-28 relative overflow-x-hidden text-white font-sans selection:bg-[#3390ec]/30" dir={isRtl() ? 'rtl' : 'ltr'}>
			
			{/* Ambient Top Glow */}
			<div class="absolute top-0 left-0 right-0 h-[350px] bg-gradient-to-b from-[#3390ec]/15 via-transparent to-transparent blur-[80px] pointer-events-none z-0" />

			{/* ═══════ PREMIUM STICKY HEADER ═══════ */}
			<div class="pt-6 pb-4 px-5 sticky top-0 bg-[#030303]/85 backdrop-blur-2xl z-40 border-b border-white/5 flex items-center justify-between gap-3 shadow-sm">
				<div class="flex items-center gap-3.5 overflow-hidden flex-1">
					<button
						onClick={() => {
							try { hapticFeedback.impactOccurred('light'); } catch (_) {}
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
							{t('channelAutoResponder.title')}
						</h1>
						<span class="text-[11px] font-bold uppercase tracking-wider text-white/50 truncate mt-0.5">
							{t('channelAutoResponder.subtitle')}
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

			<ChannelHamburgerMenu isOpen={isMenuOpen()} onClose={() => setIsMenuOpen(false)} channelId={params.id} activeTab="auto-responder" />

			<div class="px-5 pt-5 flex flex-col gap-5 max-w-md mx-auto relative z-10 w-full pb-10">
				
				<ChannelContextBar channelId={params.id} />

				<Show when={settings.loading}>
					<div class="flex flex-col gap-4 animate-pulse mt-2">
						<div class="h-40 bg-[#12141C]/50 rounded-[24px] border border-white/5"></div>
						<div class="h-40 bg-[#12141C]/50 rounded-[24px] border border-white/5"></div>
					</div>
				</Show>

				<Show when={settings()}>
					{/* ═══════ MAIN ENGINE TOGGLE ═══════ */}
					<Motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} class="bg-[#12141C]/80 backdrop-blur-xl rounded-[24px] border border-white/5 p-5 flex items-center justify-between gap-3 shadow-sm relative overflow-hidden">
						<div class="absolute -right-10 -top-10 w-32 h-32 bg-[#3390ec]/10 rounded-full blur-3xl pointer-events-none" />
						<div class="flex flex-col flex-1 min-w-0 relative z-10">
							<span class="text-[15px] font-black text-white tracking-tight flex items-center gap-2">
								<span class="material-symbols-outlined text-[#3390ec] text-[20px]">smart_toy</span>
								{t('channelAutoResponder.title')}
							</span>
							<span class="text-[11px] font-medium text-white/50 mt-1">{t('channelAutoResponder.engineSub')}</span>
						</div>
						<div class="relative z-10">
							<ToggleSwitch checked={enabled()} onChange={(v) => { try { hapticFeedback.impactOccurred('light'); } catch (_) {} setEnabled(v); }} />
						</div>
					</Motion.div>

					<Show when={enabled()}>
						<Show when={!isCreating()}>
							<Motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} class="flex flex-col gap-5">
								
								{/* ═══════ GUIDE BANNER ═══════ */}
								<div class="bg-gradient-to-br from-[#3390ec]/15 to-[#12141C]/50 border border-[#3390ec]/20 rounded-[24px] p-5 flex flex-col gap-4 relative overflow-hidden shadow-sm">
									<div class="absolute -right-6 -top-6 w-32 h-32 bg-[#3390ec]/20 rounded-full blur-3xl pointer-events-none" />
									
									<div class="flex items-center gap-2.5 relative z-10">
										<div class="w-10 h-10 rounded-[12px] bg-[#3390ec]/15 flex items-center justify-center border border-[#3390ec]/30 shadow-inner shrink-0">
											<span class="material-symbols-outlined text-[#3390ec] text-[20px]">lightbulb</span>
										</div>
										<h2 class="text-[14px] font-black text-white tracking-tight">{t('channelAutoResponder.guideTitle')}</h2>
									</div>
									
									<p class="text-[12px] text-white/70 font-medium leading-relaxed relative z-10 pl-1">
										{t('channelAutoResponder.guideDesc')}
									</p>
									
									<div class="bg-amber-400/10 border border-amber-400/20 rounded-[16px] p-4 flex items-start gap-3 relative z-10 shadow-inner">
										<span class="material-symbols-outlined text-amber-400 text-[20px] shrink-0 mt-0.5">warning</span>
										<p class="text-[11px] text-amber-400/90 font-bold leading-relaxed">
											{t('channelAutoResponder.adminRequirementNotice')}
										</p>
									</div>
									
									<div class="flex flex-col gap-3.5 relative z-10 mt-1 pl-1">
										<div class="flex items-center gap-3">
											<div class="w-8 h-8 rounded-[10px] bg-white/5 flex items-center justify-center border border-white/10 shadow-inner shrink-0"><span class="material-symbols-outlined text-[#3390ec] text-[16px]">forum</span></div>
											<div class="flex flex-col"><span class="text-[13px] font-black text-white">{t('channelAutoResponder.featFirstCommentTitle')}</span><span class="text-[10px] font-medium text-white/50">{t('channelAutoResponder.featFirstCommentDesc')}</span></div>
										</div>
										<div class="flex items-center gap-3">
											<div class="w-8 h-8 rounded-[10px] bg-white/5 flex items-center justify-center border border-white/10 shadow-inner shrink-0"><span class="material-symbols-outlined text-emerald-400 text-[16px]">waving_hand</span></div>
											<div class="flex flex-col"><span class="text-[13px] font-black text-white">{t('channelAutoResponder.featWelcomeTitle')}</span><span class="text-[10px] font-medium text-white/50">{t('channelAutoResponder.featWelcomeDesc')}</span></div>
										</div>
										<div class="flex items-center gap-3">
											<div class="w-8 h-8 rounded-[10px] bg-white/5 flex items-center justify-center border border-white/10 shadow-inner shrink-0"><span class="material-symbols-outlined text-cyan-400 text-[16px]">quickreply</span></div>
											<div class="flex flex-col"><span class="text-[13px] font-black text-white">{t('channelAutoResponder.featKeywordTitle')}</span><span class="text-[10px] font-medium text-white/50">{t('channelAutoResponder.featKeywordDesc')}</span></div>
										</div>
									</div>
								</div>

								{/* ═══════ AUTO FIRST COMMENT ═══════ */}
								<div class="bg-[#12141C]/80 backdrop-blur-xl rounded-[24px] border border-white/5 p-5 flex flex-col gap-4 shadow-sm relative overflow-hidden">
									<SettingsSection
										title={t('channelAutoResponder.firstComment')}
										description={t('channelAutoResponder.firstCommentDesc')}
										enabled={autoFirstComment()}
										onToggle={(v) => { try { hapticFeedback.impactOccurred('light'); } catch (_) {} setAutoFirstComment(v); }}
									/>

									<Show when={autoFirstComment()}>
										<div class="flex flex-col gap-4 pt-4 border-t border-white/5 relative z-10">
											<div class="bg-[#08090D] rounded-[16px] border border-white/5 p-1.5 shadow-inner">
												<SelectField
													label={t('channelAutoResponder.firstCommentMode')}
													value={commentMode()}
													onChange={(v) => { try { hapticFeedback.selectionChanged(); } catch (_) {} setCommentMode(v); }}
													options={[
														{ value: 'fixed', label: t('channelAutoResponder.modeFixed') },
														{ value: 'rotating', label: t('channelAutoResponder.modeRotating') },
														{ value: 'ai', label: t('channelAutoResponder.modeAi') },
													]}
												/>
											</div>

											<Show when={commentMode() === 'fixed'}>
												<div class="flex flex-col gap-2">
													<label class="text-[11px] font-black uppercase tracking-widest text-white/40 px-1">{t('channelAutoResponder.commentText')}</label>
													<textarea
														value={fixedComment()} onInput={(e) => setFixedComment(e.currentTarget.value)}
														placeholder={t('channelAutoResponder.commentTextPlaceholder')}
														class="bg-[#08090D] border border-white/5 text-white text-[13px] font-medium leading-relaxed rounded-[16px] px-4 py-3.5 w-full min-h-[100px] focus:outline-none focus:border-[#3390ec]/50 transition-colors resize-none placeholder-white/20 shadow-inner"
													/>
												</div>
											</Show>

											<Show when={commentMode() === 'rotating'}>
												<div class="flex flex-col gap-3">
													<label class="text-[11px] font-black uppercase tracking-widest text-white/40 px-1">{t('channelAutoResponder.rotatingTexts')}</label>
													<div class="flex flex-col gap-2">
														<For each={rotatingTexts()}>
															{(text, i) => (
																<div class="flex items-center justify-between bg-[#08090D] px-4 py-3 rounded-[16px] border border-white/5 shadow-inner">
																	<span class="text-[13px] font-medium text-white/90">{text}</span>
																	<button onClick={() => handleRemoveRotatingText(i())} class="w-8 h-8 flex items-center justify-center text-[#ff4a4a] bg-[#ff4a4a]/10 hover:bg-[#ff4a4a] hover:text-white transition-all rounded-[10px] shrink-0 border border-[#ff4a4a]/20">
																		<span class="material-symbols-outlined text-[16px]">close</span>
																	</button>
																</div>
															)}
														</For>
													</div>
													<div class="flex gap-2.5 mt-1">
														<input
															type="text" value={newRotatingText()} onInput={(e) => setNewRotatingText(e.currentTarget.value)}
															placeholder={t('channelAutoResponder.addRotatingTextPlaceholder')}
															class="bg-[#08090D] border border-white/5 text-white text-[13px] font-bold rounded-[14px] px-4 py-3.5 flex-1 focus:outline-none focus:border-[#3390ec]/50 shadow-inner placeholder-white/20 transition-colors"
														/>
														<button onClick={handleAddRotatingText} disabled={!newRotatingText().trim()} class="px-5 bg-[#3390ec] text-white font-black uppercase tracking-widest text-[11px] rounded-[14px] hover:bg-[#2b7bc9] disabled:opacity-50 active:scale-95 transition-all shadow-[0_4px_15px_rgba(51,144,236,0.2)]">
															{t('channelAutoResponder.add')}
														</button>
													</div>
												</div>
											</Show>

											<Show when={commentMode() === 'ai'}>
												<div class="bg-gradient-to-r from-[#06b6d4]/15 to-[#06b6d4]/5 p-4 rounded-[16px] border border-[#06b6d4]/30 flex flex-col gap-2 shadow-inner">
													<span class="text-[14px] font-black text-[#06b6d4] flex items-center gap-2">
														<span class="material-symbols-outlined text-[20px]">auto_awesome</span>
														{t('channelAutoResponder.aiAutoComment')}
													</span>
													<span class="text-[12px] font-medium text-[#06b6d4]/70 leading-relaxed">
														{t('channelAutoResponder.aiAutoCommentDesc')}
													</span>
												</div>
											</Show>

											<div class="flex flex-col gap-2 pt-3 border-t border-white/5 mt-1">
												<div class="bg-[#08090D] rounded-[16px] border border-white/5 p-1.5 shadow-inner">
													<SelectField
														label={t('channelAutoResponder.attachInlineBtn')}
														value={attachButton()}
														onChange={(v) => { try { hapticFeedback.selectionChanged(); } catch (_) {} setAttachButton(v); }}
														options={[
															{ value: '', label: t('channelAutoResponder.btnNone') },
															{ value: 'like_set', label: t('channelAutoResponder.btnLikeSet') },
															{ value: 'share_set', label: t('channelAutoResponder.btnShareSet') },
														]}
													/>
												</div>
											</div>
										</div>
									</Show>
								</div>

								{/* ═══════ NEW MEMBER WELCOME ═══════ */}
								<div class="bg-[#12141C]/80 backdrop-blur-xl rounded-[24px] border border-white/5 p-5 flex flex-col gap-4 shadow-sm relative overflow-hidden">
									<SettingsSection
										title={t('channelAutoResponder.welcomeMessage')}
										description={t('channelAutoResponder.welcomeMessageDesc')}
										enabled={newMemberWelcome()}
										onToggle={(v) => { try { hapticFeedback.impactOccurred('light'); } catch (_) {} setNewMemberWelcome(v); }}
									/>
									<Show when={newMemberWelcome()}>
										<div class="flex flex-col gap-4 pt-4 border-t border-white/5 relative z-10">
											<div class="flex flex-col gap-1.5">
												<label class="text-[11px] font-black uppercase tracking-widest text-white/40 px-1">{t('channelAutoResponder.welcomeDelay')}</label>
												<input
													type="number" value={welcomeDelay()} onInput={(e) => setWelcomeDelay(e.currentTarget.value)} placeholder="0"
													class="bg-[#08090D] border border-white/5 text-white text-[13px] font-mono font-bold rounded-[16px] px-4 py-3.5 w-full focus:outline-none focus:border-[#3390ec]/50 shadow-inner transition-colors placeholder-white/20"
													dir="ltr"
												/>
											</div>
											<div class="flex flex-col gap-1.5 mt-1">
												<label class="text-[11px] font-black uppercase tracking-widest text-white/40 px-1 flex justify-between items-center">
													{t('channelAutoResponder.welcomeText')}
													<span class="text-[#3390ec] font-bold bg-[#3390ec]/10 px-2 py-0.5 rounded-[6px] border border-[#3390ec]/20 lowercase tracking-normal">{t('channelAutoResponder.useName')}</span>
												</label>
												<textarea
													value={welcomeText()} onInput={(e) => setWelcomeText(e.currentTarget.value)}
													placeholder={t('channelAutoResponder.welcomeTextPlaceholder')}
													class="bg-[#08090D] border border-white/5 text-white text-[13px] font-medium leading-relaxed rounded-[16px] px-4 py-3.5 w-full min-h-[100px] focus:outline-none focus:border-[#3390ec]/50 resize-none shadow-inner placeholder-white/20 transition-colors"
												/>
											</div>
										</div>
									</Show>
								</div>

								{/* ═══════ KEYWORD RULES LIST ═══════ */}
								<div class="flex flex-col gap-3.5">
									<div class="flex items-center justify-between px-2 mb-1">
										<h2 class="text-[13px] font-black text-white/80 uppercase tracking-widest flex items-center gap-2">
											<span class="material-symbols-outlined text-[#3390ec] text-[20px]">manage_search</span>
											{t('channelAutoResponder.keywordAutoReplies')}
										</h2>
										<span class="bg-[#3390ec]/10 text-[#3390ec] font-black px-2.5 py-1 rounded-[8px] text-[10px] border border-[#3390ec]/20 shadow-sm">{rules().length}</span>
									</div>

									<Show when={rules().length === 0}>
										<div class="bg-[#12141C]/80 backdrop-blur-xl rounded-[24px] border border-white/5 border-dashed p-8 flex flex-col items-center text-center gap-3 shadow-sm">
											<div class="w-16 h-16 rounded-[20px] bg-white/5 flex items-center justify-center mb-1 border border-white/10">
												<span class="material-symbols-outlined text-[36px] text-white/30">quickreply</span>
											</div>
											<h2 class="text-[15px] font-black text-white/60 tracking-tight">{t('channelAutoResponder.noRules')}</h2>
											<p class="text-[12px] text-white/40 font-medium">{t('channelAutoResponder.keywordRepliesDesc')}</p>
										</div>
									</Show>

									<Show when={rules().length > 0}>
										<div class="flex flex-col gap-3">
											<For each={rules()}>
												{(rule) => (
													<div class="bg-[#12141C]/80 backdrop-blur-xl rounded-[20px] border border-white/5 p-4.5 flex items-center justify-between gap-3 shadow-sm group hover:border-[#3390ec]/30 transition-colors">
														<div class="flex flex-col flex-1 min-w-0 gap-1.5">
															<span class="text-[15px] font-black text-white truncate tracking-tight">{rule.keys}</span>
															<div class="flex items-center gap-2 flex-wrap">
																<span class="text-[9px] font-black uppercase tracking-widest text-[#3390ec] bg-[#3390ec]/10 px-2 py-0.5 rounded-[6px] border border-[#3390ec]/20 shadow-sm">
																	{getLocalizedMatch(rule.match)}
																</span>
																<Show when={!rule.enabled}>
																	<span class="text-[9px] font-black uppercase tracking-widest text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded-[6px] border border-amber-400/20 shadow-sm">{t('channelAutoResponder.ruleDisabled')}</span>
																</Show>
																<Show when={rule.useAi}>
																	<span class="text-[9px] font-black uppercase tracking-widest text-[#06b6d4] bg-[#06b6d4]/10 px-2 py-0.5 rounded-[6px] border border-[#06b6d4]/20 shadow-sm flex items-center gap-1">
																		<span class="material-symbols-outlined text-[10px]">auto_awesome</span> AI
																	</span>
																</Show>
															</div>
														</div>
														<button
															onClick={() => {
																if (confirm(t('channelAutoResponder.deleteRuleConfirm'))) {
																	try { hapticFeedback.impactOccurred('medium'); } catch (_) {}
																	setRules(rules().filter((r) => r.id !== rule.id));
																}
															}}
															class="w-10 h-10 rounded-[12px] bg-white/5 text-white/30 flex items-center justify-center transition-all hover:bg-[#ff4a4a]/10 hover:text-[#ff4a4a] hover:border-[#ff4a4a]/20 border border-transparent shrink-0"
														>
															<span class="material-symbols-outlined text-[20px]">delete</span>
														</button>
													</div>
												)}
											</For>
										</div>
									</Show>
									
									<button
										onClick={() => { try { hapticFeedback.impactOccurred('light'); } catch (_) {} setIsCreating(true); }}
										class="mt-2 h-14 bg-white/5 border border-white/10 hover:border-[#3390ec]/50 hover:bg-[#3390ec]/10 text-white/60 hover:text-[#3390ec] font-black uppercase tracking-widest text-[12px] rounded-[16px] transition-all flex items-center justify-center gap-2 active:scale-95"
									>
										<span class="material-symbols-outlined text-[22px]">add_circle</span>
										{t('channelAutoResponder.addRule')}
									</button>
								</div>
							</Motion.div>
						</Show>

						{/* ═══════ CREATE RULE VIEW ═══════ */}
						<Show when={isCreating()}>
							<Motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.3, easing: [0.32, 0.72, 0, 1] }} class="flex flex-col gap-4">
								
								<div class="flex items-center justify-between px-2 mb-1">
									<h2 class="text-[14px] font-black text-white tracking-tight flex items-center gap-2">
										<span class="material-symbols-outlined text-[#3390ec] text-[20px]">add_task</span>
										{t('channelAutoResponder.addRule')}
									</h2>
									<ToggleSwitch checked={isRuleEnabled()} onChange={(v) => { try { hapticFeedback.impactOccurred('light'); } catch (_) {} setIsRuleEnabled(v); }} />
								</div>

								<div class="bg-[#12141C]/80 backdrop-blur-xl rounded-[24px] border border-white/5 p-5 flex flex-col gap-5 shadow-sm">
									<div class="flex flex-col gap-1.5">
										<label class="text-[11px] font-black uppercase tracking-widest text-white/40 px-1 flex justify-between items-end">
											{t('channelAutoResponder.triggerKey')}
											<span class="text-[9px] text-white/30 lowercase tracking-normal">{t('channelAutoResponder.commaSeparated')}</span>
										</label>
										<input
											type="text" value={keywords()} onInput={(e) => setKeywords(e.currentTarget.value)}
											placeholder="price, buy, cost"
											class="bg-[#08090D] border border-white/5 text-white text-[13px] font-bold rounded-[16px] px-4 py-3.5 w-full focus:outline-none focus:border-[#3390ec]/50 transition-colors shadow-inner placeholder-white/20"
										/>
									</div>

									<div class="bg-[#08090D] rounded-[16px] border border-white/5 p-1.5 shadow-inner">
										<SelectField
											label={t('channelAutoResponder.matchType')}
											value={matchType()}
											onChange={(v) => { try { hapticFeedback.selectionChanged(); } catch (_) {} setMatchType(v); }}
											options={[
												{ value: 'exact', label: t('channelAutoResponder.matchExact') },
												{ value: 'contains', label: t('channelAutoResponder.matchContains') },
												{ value: 'regex', label: t('channelAutoResponder.matchRegex') },
											]}
										/>
									</div>
								</div>

								<div class="bg-[#12141C]/80 backdrop-blur-xl rounded-[24px] border border-white/5 p-5 flex flex-col gap-5 shadow-sm">
									<div class="flex flex-col gap-1.5">
										<label class="text-[11px] font-black uppercase tracking-widest text-white/40 px-1">
											{t('channelAutoResponder.replyText')}
										</label>
										<textarea
											value={replyText()} onInput={(e) => setReplyText(e.currentTarget.value)}
											placeholder={t('channelAutoResponder.replyPlaceholder')}
											class="bg-[#08090D] border border-white/5 text-white text-[13px] font-medium leading-relaxed rounded-[16px] px-4 py-3.5 w-full min-h-[120px] focus:outline-none focus:border-[#3390ec]/50 transition-colors resize-none placeholder-white/20 shadow-inner"
										/>
									</div>

									<div class="flex items-center justify-between gap-3 bg-gradient-to-r from-[#06b6d4]/15 to-[#06b6d4]/5 p-4 rounded-[16px] border border-[#06b6d4]/30 shadow-inner">
										<div class="flex flex-col flex-1 min-w-0">
											<span class="text-[14px] font-black text-[#06b6d4] flex items-center gap-1.5 mb-0.5">
												<span class="material-symbols-outlined text-[18px]">auto_awesome</span>
												{t('channelAutoResponder.enhanceWithAi')}
											</span>
											<span class="text-[11px] font-medium text-[#06b6d4]/60 leading-snug">
												{t('channelAutoResponder.useAiDesc')}
											</span>
										</div>
										<ToggleSwitch checked={useAi()} onChange={(v) => { try { hapticFeedback.impactOccurred('light'); } catch (_) {} setUseAi(v); }} />
									</div>
								</div>

								<div class="flex gap-3 mt-1">
									<button onClick={() => { try { hapticFeedback.impactOccurred('light'); } catch (_) {} setIsCreating(false); }} class="flex-1 h-14 bg-white/5 hover:bg-white/10 text-white/60 hover:text-white rounded-[16px] font-black uppercase tracking-widest text-[13px] transition-all border border-transparent hover:border-white/10 active:scale-95">
										{t('common.cancel')}
									</button>
									<button onClick={handleSaveRule} disabled={!keywords().trim() || !replyText().trim()} class="flex-[2] h-14 bg-gradient-to-r from-[#3390ec] to-[#2b7ec9] hover:from-[#2b7ec9] hover:to-[#3390ec] text-white rounded-[16px] font-black uppercase tracking-widest text-[13px] shadow-[0_8px_20px_rgba(51,144,236,0.3)] transition-all disabled:opacity-50 disabled:scale-100 active:scale-95 border border-white/10">
										{t('channelAutoResponder.saveRule')}
									</button>
								</div>
							</Motion.div>
						</Show>
					</Show>
				</Show>
			</div>

			{/* ═══════ FLOATING ACTION BAR ═══════ */}
			<Show when={isDirty() && !isCreating()}>
				<div class="fixed bottom-0 left-0 right-0 p-5 bg-gradient-to-t from-[#030303] via-[#030303]/90 to-transparent z-40 pointer-events-none">
					<div class="max-w-md mx-auto flex gap-3 pointer-events-auto">
						<button
							onClick={() => { try { hapticFeedback.impactOccurred('light'); } catch (_) {} navigate(`/channel/${params.id}`); }} disabled={isSaving()}
							class="w-16 h-14 bg-[#12141C]/80 backdrop-blur-md text-[#ff4a4a] border border-[#ff4a4a]/20 rounded-[16px] transition-all flex items-center justify-center hover:bg-[#ff4a4a]/10 active:scale-95 shadow-sm"
						>
							<span class="material-symbols-outlined text-[24px]">close</span>
						</button>
						<button
							onClick={handleSave} disabled={isSaving()}
							class="flex-1 h-14 bg-gradient-to-r from-[#3390ec] to-[#2b7ec9] hover:from-[#2b7ec9] hover:to-[#3390ec] text-white rounded-[16px] font-black text-[14px] uppercase tracking-widest shadow-[0_10px_30px_rgba(51,144,236,0.35)] transition-all flex items-center justify-center gap-2 disabled:opacity-40 disabled:scale-100 active:scale-95 border border-white/10"
						>
							<Show when={!isSaving()} fallback={<span class="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />}>
								{t('common.save')} <span class="material-symbols-outlined text-[22px]">save</span>
							</Show>
						</button>
					</div>
				</div>
			</Show>
		</div>
	);
};

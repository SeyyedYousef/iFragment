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
import { t } from '@/shared/i18n/index.js';
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
				rules: Array.isArray(originalAR?.rules)
					? originalAR.rules.map(normalizeRule)
					: [],
			})
		);
	});

	const getLocalizedMatch = (match: string) => {
		if (match === 'exact') return t('channelAutoResponder.matchExact') || 'Exact Match';
		if (match === 'contains') return t('channelAutoResponder.matchContains') || 'Contains';
		if (match === 'regex') return t('channelAutoResponder.matchRegex') || 'Regex';
		return match;
	};

	const handleSaveRule = () => {
		if (keywords().trim() && replyText().trim()) {
			hapticFeedback.notificationOccurred('success');
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
			hapticFeedback.impactOccurred('light');
			setRotatingTexts([...rotatingTexts(), newRotatingText().trim()]);
			setNewRotatingText('');
		}
	};

	const handleRemoveRotatingText = (idx: number) => {
		hapticFeedback.impactOccurred('light');
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
			hapticFeedback.notificationOccurred('success');
			showToast(t('common.settingsSaved') || 'Settings saved successfully', 'success');
			navigate(`/channel/${params.id}`);
		} catch (e) {
			console.error('Failed to save auto responder settings:', e);
			hapticFeedback.notificationOccurred('error');
			showToast(t('common.saveFailed') || 'Failed to save settings', 'error');
		} finally {
			setIsSaving(false);
		}
	};

	onMount(() => {
		backButton.show();
		const off = backButton.onClick(() => {
			if (isCreating()) {
				setIsCreating(false);
			} else {
				navigate(`/channel/${params.id}`);
			}
		});
		onCleanup(() => off());
	});

	return (
		<div class="min-h-screen bg-[#0f1014] pb-28 relative overflow-x-hidden text-white">
			{/* Header */}
			<div class="px-5 pt-6 pb-4 bg-[#0f1014]/80 backdrop-blur-md sticky top-0 z-30 border-b border-[#1c1c1c] flex items-center justify-between gap-3">
				<div class="flex items-center gap-2 overflow-hidden flex-1">
					<button
						onClick={() => {
							hapticFeedback.impactOccurred('light');
							if (isCreating()) {
								setIsCreating(false);
							} else {
								navigate(`/channel/${params.id}`);
							}
						}}
						class="w-10 h-10 rounded-full bg-[#1c1c1c] flex items-center justify-center border border-[#2a2a2a] hover:bg-[#2a2a2a] active:scale-90 transition-all shrink-0"
						aria-label="Back"
					>
						<span class="material-symbols-outlined text-white text-[20px] rtl:-scale-x-100">
							arrow_back
						</span>
					</button>
					<div class="flex flex-col overflow-hidden">
						<h1 class="text-[18px] font-black text-white leading-tight truncate">
							{t('channelAutoResponder.title') || 'Auto Responder'}
						</h1>
						<span class="text-[12px] text-on-surface-variant truncate">
							{t('channelAutoResponder.subtitle') || 'Manage automated replies & comments'}
						</span>
					</div>
				</div>

				<button
					onClick={() => setIsMenuOpen(true)}
					class="w-10 h-10 rounded-full bg-[#1c1c1c] flex items-center justify-center border border-[#2a2a2a] hover:bg-[#2a2a2a] active:scale-95 transition-all shrink-0"
					aria-label="Open menu"
				>
					<span class="material-symbols-outlined text-white text-[20px]">menu</span>
				</button>
			</div>

			<ChannelHamburgerMenu
				isOpen={isMenuOpen()}
				onClose={() => setIsMenuOpen(false)}
				channelId={params.id}
				activeTab="auto-responder"
			/>

			<div class="px-5 pt-6 flex flex-col gap-6 pb-24">
				<ChannelContextBar channelId={params.id} />

				<Show when={settings.loading}>
					<div class="flex flex-col gap-4 animate-pulse">
						<div class="h-40 bg-[#1c1c1c] rounded-3xl"></div>
						<div class="h-40 bg-[#1c1c1c] rounded-3xl"></div>
					</div>
				</Show>

				<Show when={settings()}>
					<Motion.div
						initial={{ opacity: 0, y: 10 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ delay: 0.05 }}
						class="bg-[#1c1c1c] rounded-3xl border border-[#2a2a2a] p-4 flex flex-col gap-4 mb-4"
					>
						<div class="flex items-center justify-between gap-3">
							<div class="flex flex-col flex-1 min-w-0">
								<span class="text-[15px] font-bold text-white">
									{t('channelAutoResponder.title') || 'Auto-Responder Engine'}
								</span>
								<span class="text-[11px] text-[#8e8e93]">
									Automatically reply to comments and messages
								</span>
							</div>
							<ToggleSwitch checked={enabled()} onChange={setEnabled} />
						</div>
					</Motion.div>

					<Show when={enabled()}>
						<Show when={!isCreating()}>
							<Motion.div
								initial={{ opacity: 0, y: 10 }}
								animate={{ opacity: 1, y: 0 }}
								transition={{ delay: 0.05 }}
								class="flex flex-col gap-6"
							>
								{/* Features Guide Banner */}
								<div class="bg-gradient-to-br from-[#32ade6]/20 to-[#0f1014] border border-[#32ade6]/30 rounded-3xl p-5 flex flex-col gap-3 relative overflow-hidden">
									<div class="absolute -right-4 -top-4 w-24 h-24 bg-[#32ade6]/20 rounded-full blur-2xl"></div>
									<div class="flex items-center gap-2 mb-1">
										<span class="material-symbols-outlined text-[#32ade6] text-[24px]">lightbulb</span>
										<h2 class="text-[16px] font-bold text-white">{t('channelAutoResponder.guideTitle') || 'راهنمای قابلیت‌های پاسخگوی خودکار'}</h2>
									</div>
									<p class="text-[13px] text-on-surface-variant leading-relaxed">
										{t('channelAutoResponder.guideDesc') || 'با روشن شدن این بخش، ربات در گروه متصل به کانال شما (Discuss Group) فعال می‌شود. قابلیت‌های زیر در اختیار شماست:'}
									</p>
									<ul class="flex flex-col gap-3 mt-1">
										<li class="flex items-start gap-2">
											<div class="w-6 h-6 rounded-full bg-[#32ade6]/20 flex items-center justify-center shrink-0 mt-0.5">
												<span class="material-symbols-outlined text-[#32ade6] text-[14px]">forum</span>
											</div>
											<div class="flex flex-col">
												<span class="text-[14px] font-bold text-white">{t('channelAutoResponder.featFirstCommentTitle') || 'Auto First Comment'}</span>
												<span class="text-[12px] text-[#8e8e93]">{t('channelAutoResponder.featFirstCommentDesc') || 'Registers the first comment instantly when a post is published.'}</span>
											</div>
										</li>
										<li class="flex items-start gap-2">
											<div class="w-6 h-6 rounded-full bg-[#32ade6]/20 flex items-center justify-center shrink-0 mt-0.5">
												<span class="material-symbols-outlined text-[#32ade6] text-[14px]">waving_hand</span>
											</div>
											<div class="flex flex-col">
												<span class="text-[14px] font-bold text-white">{t('channelAutoResponder.featWelcomeTitle') || 'Welcome Message'}</span>
												<span class="text-[12px] text-[#8e8e93]">{t('channelAutoResponder.featWelcomeDesc') || 'Greets new members with a custom message.'}</span>
											</div>
										</li>
										<li class="flex items-start gap-2">
											<div class="w-6 h-6 rounded-full bg-[#32ade6]/20 flex items-center justify-center shrink-0 mt-0.5">
												<span class="material-symbols-outlined text-[#32ade6] text-[14px]">smart_toy</span>
											</div>
											<div class="flex flex-col">
												<span class="text-[14px] font-bold text-white">{t('channelAutoResponder.featKeywordTitle') || 'Keyword Replies'}</span>
												<span class="text-[12px] text-[#8e8e93]">{t('channelAutoResponder.featKeywordDesc') || 'Automatically replies to common questions.'}</span>
											</div>
										</li>
									</ul>
								</div>

								{/* Auto First Comment */}
								<div class="bg-[#1c1c1c] rounded-3xl border border-[#2a2a2a] p-5 flex flex-col gap-4">
									<SettingsSection
										title={t('channelAutoResponder.firstComment') || 'Auto First Comment'}
										description={
											t('channelAutoResponder.firstCommentDesc') ||
											'Automatically comment on your own posts.'
										}
										enabled={autoFirstComment()}
										onToggle={setAutoFirstComment}
									/>

									<Show when={autoFirstComment()}>
										<div class="flex flex-col gap-4 pt-4 border-t border-[#2a2a2a]">
											<SelectField
												label={t('channelAutoResponder.firstCommentMode') || 'Comment Mode'}
												value={commentMode()}
												onChange={setCommentMode}
												options={[
													{
														value: 'fixed',
														label: t('channelAutoResponder.modeFixed') || 'Fixed Text',
													},
													{
														value: 'rotating',
														label:
															t('channelAutoResponder.modeRotating') || 'Rotating Texts (Random)',
													},
													{
														value: 'ai',
														label:
															t('channelAutoResponder.modeAi') || 'AI Generated (Context Aware)',
													},
												]}
											/>

											<Show when={commentMode() === 'fixed'}>
												<div class="flex flex-col gap-2">
													<label class="text-[13px] font-bold text-white">
														{t('channelAutoResponder.commentText') || 'Comment Text'}
													</label>
													<textarea
														value={fixedComment()}
														onInput={(e) => setFixedComment(e.currentTarget.value)}
														placeholder={
															t('channelAutoResponder.commentTextPlaceholder') ||
															'e.g. Let us know what you think!'
														}
														class="bg-[#2c2c2e] text-white text-[15px] rounded-xl px-4 py-3 w-full min-h-[80px] focus:outline-none focus:ring-2 focus:ring-[#32ade6] resize-none"
													/>
												</div>
											</Show>

											<Show when={commentMode() === 'rotating'}>
												<div class="flex flex-col gap-3">
													<label class="text-[13px] font-bold text-white">
														{t('channelAutoResponder.rotatingTexts') || 'Rotating Texts'}
													</label>
													<div class="flex flex-col gap-2">
														<For each={rotatingTexts()}>
															{(text, i) => (
																<div class="flex items-center justify-between bg-[#2c2c2e] px-3 py-2 rounded-lg border border-[#3a3a3c]">
																	<span class="text-[14px]">{text}</span>
																	<button
																		onClick={() => handleRemoveRotatingText(i())}
																		class="w-6 h-6 flex items-center justify-center text-[#ff3b30] bg-[#ff3b30]/10 rounded-full"
																	>
																		<span class="material-symbols-outlined text-[14px]">close</span>
																	</button>
																</div>
															)}
														</For>
													</div>
													<div class="flex gap-2">
														<input
															type="text"
															value={newRotatingText()}
															onInput={(e) => setNewRotatingText(e.currentTarget.value)}
															placeholder={
																t('channelAutoResponder.addRotatingTextPlaceholder') ||
																'Add new text...'
															}
															class="bg-[#2c2c2e] text-white text-[14px] rounded-lg px-3 py-2 flex-1 focus:outline-none focus:ring-2 focus:ring-[#32ade6]"
														/>
														<button
															onClick={handleAddRotatingText}
															disabled={!newRotatingText().trim()}
															class="px-4 bg-[#32ade6] text-black font-bold rounded-lg hover:bg-[#2b96c8] disabled:opacity-50"
														>
															{t('channelAutoResponder.add') || 'Add'}
														</button>
													</div>
												</div>
											</Show>

											<Show when={commentMode() === 'ai'}>
												<div class="bg-gradient-to-r from-[#32ade6]/10 to-transparent p-3 rounded-xl border border-[#32ade6]/30 flex flex-col gap-1">
													<span class="text-[14px] font-bold text-[#32ade6] flex items-center gap-1.5">
														<span class="material-symbols-outlined text-[18px]">auto_awesome</span>
														{t('channelAutoResponder.aiAutoComment') || 'AI Auto-Comment'}
													</span>
													<span class="text-[12px] text-on-surface-variant">
														{t('channelAutoResponder.aiAutoCommentDesc') ||
															'The AI will read your post and generate a highly relevant first comment automatically.'}
													</span>
												</div>
											</Show>

											{/* Attach Inline Buttons */}
											<div class="flex flex-col gap-2 pt-2 border-t border-[#2a2a2a]">
												<SelectField
													label={
														t('channelAutoResponder.attachInlineBtn') || 'Attach Inline Buttons'
													}
													value={attachButton()}
													onChange={setAttachButton}
													options={[
														{ value: '', label: t('channelAutoResponder.btnNone') || 'None' },
														{
															value: 'like_set',
															label:
																t('channelAutoResponder.btnLikeSet') || '👍👎 Like/Dislike Set',
														},
														{
															value: 'share_set',
															label: t('channelAutoResponder.btnShareSet') || 'Share Set',
														},
													]}
												/>
											</div>
										</div>
									</Show>
								</div>

								{/* New Member Welcome */}
								<div class="bg-[#1c1c1c] rounded-3xl border border-[#2a2a2a] p-5 flex flex-col gap-4">
									<SettingsSection
										title={t('channelAutoResponder.welcomeMessage') || 'New Member Welcome'}
										description={
											t('channelAutoResponder.welcomeMessageDesc') ||
											'Send a message when someone joins the discussion group.'
										}
										enabled={newMemberWelcome()}
										onToggle={setNewMemberWelcome}
									/>
									<Show when={newMemberWelcome()}>
										<div class="flex flex-col gap-4 pt-4 border-t border-[#2a2a2a]">
											<div class="flex gap-2">
												<div class="flex-1 flex flex-col gap-2">
													<label class="text-[13px] font-bold text-white">
														{t('channelAutoResponder.welcomeDelay') || 'Delay (Seconds)'}
													</label>
													<input
														type="number"
														value={welcomeDelay()}
														onInput={(e) => setWelcomeDelay(e.currentTarget.value)}
														placeholder="0"
														class="bg-[#2c2c2e] text-white text-[15px] rounded-xl px-4 py-3 w-full focus:outline-none focus:ring-2 focus:ring-[#32ade6]"
													/>
												</div>
											</div>
											<div class="flex flex-col gap-2">
												<label class="text-[13px] font-bold text-white flex justify-between">
													{t('channelAutoResponder.welcomeText') || 'Message Template'}
													<span class="text-[#32ade6] text-[11px] font-normal">
														{t('channelAutoResponder.useName') || 'Use $name'}
													</span>
												</label>
												<textarea
													value={welcomeText()}
													onInput={(e) => setWelcomeText(e.currentTarget.value)}
													placeholder={
														t('channelAutoResponder.welcomeTextPlaceholder') ||
														'Welcome $name to the group!'
													}
													class="bg-[#2c2c2e] text-white text-[15px] rounded-xl px-4 py-3 w-full min-h-[80px] focus:outline-none focus:ring-2 focus:ring-[#32ade6] resize-none"
												/>
											</div>
										</div>
									</Show>
								</div>

								{/* Keyword Rules */}
								<div class="flex flex-col gap-3">
									<h2 class="text-[16px] font-bold text-white flex items-center justify-between">
										{t('channelAutoResponder.keywordAutoReplies') || 'Keyword Auto-Replies'}
										<span class="bg-[#32ade6] text-black px-2 py-0.5 rounded-md text-[11px]">
											{rules().length}
										</span>
									</h2>
									<Show when={rules().length === 0}>
										<div class="bg-[#1c1c1c] rounded-3xl border border-[#2a2a2a] p-5 flex flex-col items-center text-center gap-3">
											<div class="w-16 h-16 rounded-full bg-[#32ade6]/10 text-[#32ade6] flex items-center justify-center mb-2">
												<span class="material-symbols-outlined text-[32px]">quickreply</span>
											</div>
											<h2 class="text-[16px] font-bold text-white">
												{t('channelAutoResponder.noRules') || 'No Rules'}
											</h2>
											<p class="text-[13px] text-[#8e8e93]">
												{t('channelAutoResponder.keywordRepliesDesc') ||
													'Auto-reply to specific words in the comments.'}
											</p>
										</div>
									</Show>

									<Show when={rules().length > 0}>
										<div class="flex flex-col gap-3">
											<For each={rules()}>
												{(rule) => (
													<div class="bg-[#1c1c1c] rounded-2xl border border-[#2a2a2a] p-4 flex items-center justify-between gap-3">
														<div class="flex flex-col flex-1 min-w-0">
															<span class="text-[15px] font-bold text-white truncate">
																{rule.keys}
															</span>
															<div class="flex items-center gap-2 mt-0.5">
																<span class="text-[12px] text-[#32ade6] uppercase tracking-wide font-bold">
																	{getLocalizedMatch(rule.match)}
																</span>
																<Show when={!rule.enabled}>
																	<span class="text-[10px] font-black uppercase text-[#ff9f0a] bg-[#ff9f0a]/10 border border-[#ff9f0a]/20 rounded-md px-1.5 py-0.5">
																		Disabled
																	</span>
																</Show>
															</div>
														</div>
														<button
															onClick={() => {
																if (confirm(t('channelAutoResponder.deleteRuleConfirm') || 'Removing this rule will immediately stop automatic replies. Are you sure?')) {
																	hapticFeedback.impactOccurred('light');
																	setRules(rules().filter((r) => r.id !== rule.id));
																}
															}}
															class="w-8 h-8 rounded-full bg-[#ff3b30]/10 text-[#ff3b30] flex items-center justify-center transition-colors hover:bg-[#ff3b30]/20"
														>
															<span class="material-symbols-outlined text-[16px]">delete</span>
														</button>
													</div>
												)}
											</For>
										</div>
									</Show>
									<button
										onClick={() => setIsCreating(true)}
										class="mt-2 h-12 bg-[#32ade6] text-black font-bold rounded-xl hover:bg-[#2b96c8] transition-colors flex items-center justify-center gap-2"
									>
										<span class="material-symbols-outlined text-[18px]">add</span>
										{t('channelAutoResponder.addRule') || 'Add Keyword Rule'}
									</button>
								</div>
							</Motion.div>
						</Show>

						<Show when={isCreating()}>
							<Motion.div
								initial={{ opacity: 0, scale: 0.95 }}
								animate={{ opacity: 1, scale: 1 }}
								class="flex flex-col gap-4"
							>
								<div class="bg-[#1c1c1c] rounded-3xl border border-[#2a2a2a] p-5 flex flex-col gap-4">
									<div class="flex items-center justify-between">
										<h2 class="text-[16px] font-bold text-white">
											{t('channelAutoResponder.addRule') || 'Add Keyword Rule'}
										</h2>
										<ToggleSwitch checked={isRuleEnabled()} onChange={setIsRuleEnabled} />
									</div>

									<div class="flex flex-col gap-2">
										<label class="text-[13px] font-bold text-white">
											{t('channelAutoResponder.triggerKey') || 'Keywords'}
										</label>
										<p class="text-[11px] text-on-surface-variant -mt-1">
											{t('channelAutoResponder.commaSeparated') || 'Comma separated'}
										</p>
										<input
											type="text"
											value={keywords()}
											onInput={(e) => setKeywords(e.currentTarget.value)}
											placeholder="price, buy, cost"
											class="bg-[#2c2c2e] text-white text-[15px] rounded-xl px-4 py-3 w-full focus:outline-none focus:ring-2 focus:ring-[#32ade6]"
										/>
									</div>

									<SelectField
										label={t('channelAutoResponder.matchType') || 'Match Type'}
										value={matchType()}
										onChange={setMatchType}
										options={[
											{
												value: 'exact',
												label: t('channelAutoResponder.matchExact') || 'Exact Match',
											},
											{
												value: 'contains',
												label: t('channelAutoResponder.matchContains') || 'Contains',
											},
											{ value: 'regex', label: t('channelAutoResponder.matchRegex') || 'Regex' },
										]}
									/>
								</div>

								<div class="bg-[#1c1c1c] rounded-3xl border border-[#2a2a2a] p-5 flex flex-col gap-4">
									<div class="flex flex-col gap-2">
										<label class="text-[13px] font-bold text-white">
											{t('channelAutoResponder.replyText') || 'Reply Text'}
										</label>
										<textarea
											value={replyText()}
											onInput={(e) => setReplyText(e.currentTarget.value)}
											placeholder={
												t('channelAutoResponder.replyPlaceholder') ||
												'Type your automated reply here...'
											}
											class="bg-[#2c2c2e] text-white text-[15px] rounded-xl px-4 py-3 w-full min-h-[100px] focus:outline-none focus:ring-2 focus:ring-[#32ade6] resize-none"
										/>
									</div>

									<div class="flex items-center justify-between gap-3 bg-gradient-to-r from-[#32ade6]/10 to-transparent p-3 rounded-xl border border-[#32ade6]/20">
										<div class="flex flex-col flex-1 min-w-0">
											<span class="text-[14px] font-bold text-white flex items-center gap-2">
												<span class="material-symbols-outlined text-[#32ade6] text-[18px]">
													auto_awesome
												</span>
												{t('channelAutoResponder.enhanceWithAi') || 'Enhance with AI'}
											</span>
											<span class="text-[11px] text-[#8e8e93] leading-snug mt-1">
												{t('channelAutoResponder.useAiDesc') ||
													'Allow AI to slightly tweak the response for a natural tone.'}
											</span>
										</div>
										<ToggleSwitch checked={useAi()} onChange={setUseAi} />
									</div>
								</div>

								<div class="flex gap-3 mt-2">
									<button
										onClick={() => setIsCreating(false)}
										class="flex-1 h-12 bg-[#2c2c2e] text-white rounded-xl font-bold hover:bg-[#3a3a3c] transition-colors"
									>
										{t('common.cancel') || 'Cancel'}
									</button>
									<button
										onClick={handleSaveRule}
										disabled={!keywords().trim() || !replyText().trim()}
										class="flex-[2] h-12 bg-[#32ade6] text-black rounded-xl font-bold hover:bg-[#2b96c8] disabled:opacity-50 transition-colors"
									>
										{t('common.save') || 'Save'}
									</button>
								</div>
							</Motion.div>
						</Show>
					</Show>
				</Show>
			</div>

			{/* Footer Actions (Save button fixed bar) */}
			<Show when={isDirty()}>
				<div class="fixed bottom-0 left-0 right-0 p-5 bg-gradient-to-t from-[#0f1014] via-[#0f1014]/90 to-transparent z-40 flex gap-3">
					<button
						onClick={() => navigate(`/channel/${params.id}`)}
						disabled={isSaving()}
						class="flex-1 h-14 bg-[#1c1c1c] text-[#ff3b30] border border-[#ff3b30]/20 rounded-2xl font-bold text-[15px] transition-all flex items-center justify-center gap-2 hover:bg-[#ff3b30]/10"
					>
						{t('common.cancel') || 'Cancel'}
						<span class="material-symbols-outlined text-[18px]">close</span>
					</button>
					<button
						onClick={handleSave}
						disabled={isSaving()}
						class="flex-[2] h-14 bg-[#32ade6] hover:bg-[#2b96c8] text-black rounded-2xl font-bold text-[16px] shadow-[0_10px_25px_rgba(50,173,230,0.3)] transition-all flex items-center justify-center gap-2 disabled:opacity-40"
					>
						<Show
							when={!isSaving()}
							fallback={
								<span class="w-5 h-5 border-2 border-black/30 border-t-black rounded-full animate-spin"></span>
							}
						>
							{t('common.save') || 'Save Changes'}
							<span class="material-symbols-outlined text-[20px]">save</span>
						</Show>
					</button>
				</div>
			</Show>
		</div>
	);
};

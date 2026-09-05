import { Motion } from '@motionone/solid';
import { useNavigate, useParams } from '@solidjs/router';
import { backButton } from '@tma.js/sdk-solid';
import {
	type Component,
	createResource,
	createSignal,
	For,
	onCleanup,
	onMount,
	Show,
} from 'solid-js';
import { ChannelContextBar, ChannelHamburgerMenu, channelApi } from '@/entities/channel/index.js';
import type { ForwardingRule } from '@/entities/channel/model/types.js';
import { isRtl, t } from '@/shared/i18n/index.js';
import { haptic } from '@/shared/lib/haptic.js';
import { showToast } from '@/shared/ui/index.js';

export const ChannelForwardingPage: Component = () => {
	const params = useParams();
	const navigate = useNavigate();
	const [isMenuOpen, setIsMenuOpen] = createSignal(false);
	const [activeTab, setActiveTab] = createSignal<'rules' | 'webhooks' | 'logs'>('rules');

	// Rule Create/Edit State
	const [isCreatingRule, setIsCreatingRule] = createSignal(false);
	const [direction, setDirection] = createSignal<'inbound' | 'outbound'>('outbound');
	const [targetType, setTargetType] = createSignal<'telegram' | 'webhook'>('telegram');
	const [target, setTarget] = createSignal('');
	const [mode, setMode] = createSignal<'forward' | 'copy' | 'ai'>('forward');
	const [delay, setDelay] = createSignal('0');
	const [removeAds, setRemoveAds] = createSignal(false);
	const [removeLinks, setRemoveLinks] = createSignal(false);
	const [removeHashtags, setRemoveHashtags] = createSignal(false);
	const [watermark, setWatermark] = createSignal('');
	const [textType, _setTextType] = createSignal(true);
	const [photosType, _setPhotosType] = createSignal(true);
	const [videosType, _setVideosType] = createSignal(true);
	const [filesType, _setFilesType] = createSignal(true);
	const [voiceType, _setVoiceType] = createSignal(true);
	const [isVerifyingTarget, setIsVerifyingTarget] = createSignal(false);
	const [targetVerified, setTargetVerified] = createSignal<boolean | null>(null);
	const [isSaving, setIsSaving] = createSignal(false);

	// Webhook Ping State
	const [pingUrl, setPingUrl] = createSignal('');
	const [pingSecret, setPingSecret] = createSignal('');
	const [isPinging, setIsPinging] = createSignal(false);
	const [pingResult, setPingResult] = createSignal<{
		success: boolean;
		status_code?: number;
		error?: string;
	} | null>(null);

	// Resources
	const [rules, { refetch: refetchRules }] = createResource(
		() => params.id,
		(id) => channelApi.getForwardingRules(id),
	);
	const [logs] = createResource(
		() => params.id,
		(id) => channelApi.getForwardingLogs(id),
	);

	onMount(() => {
		try {
			if (backButton.isSupported() && backButton.mount.isAvailable()) {
				backButton.mount();
				backButton.show();
				backButton.onClick(() => {
					haptic.impact('light');
					navigate(`/channel/${params.id}/dashboard`);
				});
			}
		} catch (_e) {}
	});

	onCleanup(() => {
		try {
			if (backButton.isSupported()) {
				backButton.hide();
			}
		} catch (_e) {}
	});

	const handleVerifyTarget = async () => {
		if (!target().trim()) return;
		setIsVerifyingTarget(true);
		haptic.impact('light');
		try {
			const res = await channelApi.verifyForwardingTarget(params.id, target().trim());
			if (res?.valid) {
				setTargetVerified(true);
				haptic.notify('success');
				showToast(
					t('channel.forwarding.target_verified') || 'Target verified successfully!',
					'success',
				);
			} else {
				setTargetVerified(false);
				haptic.notify('error');
				showToast(res?.message || 'Invalid target destination', 'error');
			}
		} catch (err: any) {
			setTargetVerified(false);
			haptic.notify('error');
			showToast(err?.response?.data?.error || 'Verification failed', 'error');
		} finally {
			setIsVerifyingTarget(false);
		}
	};

	const handleSaveRule = async (e: Event) => {
		e.preventDefault();
		if (!target().trim()) {
			showToast(
				t('channel.forwarding.target_required') || 'Target destination is required',
				'error',
			);
			return;
		}

		setIsSaving(true);
		haptic.impact('medium');

		const rulePayload: ForwardingRule = {
			channel_id: params.id,
			direction: direction(),
			target_type: targetType(),
			target: target().trim(),
			mode: mode(),
			delay: delay(),
			is_active: true,
			content_types: {
				text: textType(),
				photos: photosType(),
				videos: videosType(),
				files: filesType(),
				voice: voiceType(),
			},
			remove_ads: removeAds(),
			remove_hashtags: removeHashtags(),
			remove_links: removeLinks(),
			watermark: watermark().trim(),
		};

		try {
			await channelApi.createForwardingRule(params.id, rulePayload);
			haptic.notify('success');
			showToast(
				t('channel.forwarding.rule_created') || 'Forwarding rule created successfully!',
				'success',
			);
			setIsCreatingRule(false);
			resetRuleForm();
			refetchRules();
		} catch (err: any) {
			haptic.notify('error');
			showToast(err?.response?.data?.error || 'Failed to create forwarding rule', 'error');
		} finally {
			setIsSaving(false);
		}
	};

	const handleToggleRule = async (rule: ForwardingRule) => {
		if (!rule.id) return;
		haptic.impact('light');
		try {
			await channelApi.updateForwardingRule(params.id, rule.id, {
				...rule,
				is_active: !rule.is_active,
			});
			showToast(rule.is_active ? 'Rule disabled' : 'Rule enabled', 'info');
			refetchRules();
		} catch (err: any) {
			showToast(err?.response?.data?.error || 'Failed to update rule', 'error');
		}
	};

	const handleDeleteRule = async (ruleId?: string) => {
		if (!ruleId) return;
		if (!confirm(t('channel.forwarding.confirm_delete_rule') || 'Delete this forwarding rule?'))
			return;
		haptic.notify('warning');
		try {
			await channelApi.deleteForwardingRule(params.id, ruleId);
			showToast(t('channel.forwarding.rule_deleted') || 'Rule deleted', 'info');
			refetchRules();
		} catch (err: any) {
			showToast(err?.response?.data?.error || 'Failed to delete rule', 'error');
		}
	};

	const handleTestPing = async () => {
		if (!pingUrl().trim()) {
			showToast('Please enter a Webhook URL to test', 'error');
			return;
		}
		setIsPinging(true);
		setPingResult(null);
		haptic.impact('medium');

		try {
			const res = await channelApi.pingWebhook(params.id, pingUrl().trim(), pingSecret().trim());
			setPingResult(res);
			if (res.success) {
				haptic.notify('success');
				showToast(`Webhook ping succeeded (Status ${res.status_code})`, 'success');
			} else {
				haptic.notify('error');
				showToast(`Webhook ping failed: ${res.error || 'Non-200 response'}`, 'error');
			}
		} catch (err: any) {
			haptic.notify('error');
			setPingResult({ success: false, error: err?.message });
			showToast(err?.response?.data?.error || 'Ping request failed', 'error');
		} finally {
			setIsPinging(false);
		}
	};

	const resetRuleForm = () => {
		setTarget('');
		setTargetVerified(null);
		setMode('forward');
		setDelay('0');
		setRemoveAds(false);
		setRemoveLinks(false);
		setRemoveHashtags(false);
		setWatermark('');
	};

	return (
		<div
			class="min-h-screen bg-neutral-950 text-neutral-100 pb-28 pt-2 px-4"
			dir={isRtl() ? 'rtl' : 'ltr'}
		>
			<ChannelContextBar channelId={params.id} />
			<ChannelHamburgerMenu
				isOpen={isMenuOpen()}
				onClose={() => setIsMenuOpen(false)}
				channelId={params.id}
				activeTab="forwarding"
			/>

			{/* Header */}
			<div class="mt-4 mb-5 flex items-center justify-between">
				<div>
					<h1 class="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
						<span>🔄</span>
						<span>{t('channel.forwarding.title') || 'Auto Forwarding & Webhooks'}</span>
					</h1>
					<p class="text-xs text-neutral-400 mt-1">
						{t('channel.forwarding.subtitle') ||
							'Replicate channel posts to Telegram targets or secure HTTP Webhooks.'}
					</p>
				</div>

				<button
					type="button"
					onClick={() => {
						haptic.impact('medium');
						setIsCreatingRule(true);
					}}
					class="py-2 px-3.5 rounded-xl bg-gradient-to-r from-[#0098EA] to-[#0081C8] text-white text-xs font-semibold shadow-lg shadow-[#0098EA]/20 hover:opacity-95 active:scale-95 transition-all flex items-center gap-1.5"
				>
					<span>➕</span>
					<span>{t('channel.forwarding.new_rule') || 'Add Rule'}</span>
				</button>
			</div>

			{/* Navigation Tabs */}
			<div class="flex items-center gap-2 p-1 rounded-xl bg-neutral-900 border border-neutral-800 mb-5">
				<button
					type="button"
					onClick={() => {
						haptic.selection();
						setActiveTab('rules');
					}}
					class={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold transition-all ${
						activeTab() === 'rules'
							? 'bg-[#0098EA] text-white shadow-md'
							: 'text-neutral-400 hover:text-white'
					}`}
				>
					📋 {t('channel.forwarding.tab_rules') || 'Rules'} ({rules()?.length || 0})
				</button>

				<button
					type="button"
					onClick={() => {
						haptic.selection();
						setActiveTab('webhooks');
					}}
					class={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold transition-all ${
						activeTab() === 'webhooks'
							? 'bg-[#0098EA] text-white shadow-md'
							: 'text-neutral-400 hover:text-white'
					}`}
				>
					🌐 {t('channel.forwarding.tab_webhooks') || 'Webhooks'}
				</button>

				<button
					type="button"
					onClick={() => {
						haptic.selection();
						setActiveTab('logs');
					}}
					class={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold transition-all ${
						activeTab() === 'logs'
							? 'bg-[#0098EA] text-white shadow-md'
							: 'text-neutral-400 hover:text-white'
					}`}
				>
					📜 {t('channel.forwarding.tab_logs') || 'Logs'}
				</button>
			</div>

			{/* TAB 1: RULES LIST */}
			<Show when={activeTab() === 'rules'}>
				<div class="space-y-3">
					<Show when={rules.loading}>
						<div class="h-32 rounded-2xl bg-neutral-900/60 animate-pulse border border-neutral-800" />
					</Show>

					<Show when={!rules.loading && (!rules() || rules()?.length === 0)}>
						<div class="py-12 px-6 rounded-2xl bg-neutral-900/40 border border-neutral-800 text-center space-y-3">
							<div class="w-14 h-14 mx-auto rounded-2xl bg-neutral-800 flex items-center justify-center text-2xl">
								📭
							</div>
							<div class="space-y-1">
								<h3 class="text-sm font-semibold text-white">
									{t('channel.forwarding.empty_rules') || 'No Forwarding Rules Active'}
								</h3>
								<p class="text-xs text-neutral-400 max-w-xs mx-auto">
									{t('channel.forwarding.empty_desc') ||
										'Create a rule to auto-copy incoming posts or publish outbound posts to other channels.'}
								</p>
							</div>
						</div>
					</Show>

					<For each={rules()}>
						{(rule) => (
							<div class="p-4 rounded-2xl bg-neutral-900/80 border border-neutral-800 hover:border-neutral-700 transition-all space-y-3 shadow-lg">
								<div class="flex items-center justify-between">
									<div class="flex items-center gap-2">
										<span class="text-base">{rule.target_type === 'webhook' ? '🌐' : '📢'}</span>
										<div>
											<div class="text-xs font-bold text-white flex items-center gap-1.5">
												<span>{rule.target}</span>
												<span
													class={`px-1.5 py-0.2 rounded text-[10px] uppercase font-semibold ${
														rule.direction === 'inbound'
															? 'bg-blue-500/10 text-blue-400'
															: 'bg-emerald-500/10 text-emerald-400'
													}`}
												>
													{rule.direction}
												</span>
											</div>
											<div class="text-[11px] text-neutral-400">
												Mode:{' '}
												<span class="capitalize text-neutral-300 font-medium">{rule.mode}</span>
											</div>
										</div>
									</div>

									<div class="flex items-center gap-2">
										<button
											type="button"
											onClick={() => handleToggleRule(rule)}
											class={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
												rule.is_active
													? 'bg-emerald-500/10 text-emerald-400'
													: 'bg-neutral-800 text-neutral-400'
											}`}
										>
											{rule.is_active ? 'Active' : 'Disabled'}
										</button>
										<button
											type="button"
											onClick={() => handleDeleteRule(rule.id)}
											class="p-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 text-xs"
										>
											🗑️
										</button>
									</div>
								</div>

								{/* Rule Filter Pills */}
								<div class="flex flex-wrap gap-1.5 pt-1 border-t border-neutral-800/60 text-[10px]">
									<Show when={rule.remove_ads}>
										<span class="px-2 py-0.5 rounded bg-neutral-950 text-neutral-300 border border-neutral-800">
											{t('channelForwarding.noAds')}
										</span>
									</Show>
									<Show when={rule.remove_links}>
										<span class="px-2 py-0.5 rounded bg-neutral-950 text-neutral-300 border border-neutral-800">
											{t('channelForwarding.noLinks')}
										</span>
									</Show>
									<Show when={rule.remove_hashtags}>
										<span class="px-2 py-0.5 rounded bg-neutral-950 text-neutral-300 border border-neutral-800">
											{t('channelForwarding.noTags')}
										</span>
									</Show>
									<Show when={rule.watermark}>
										<span class="px-2 py-0.5 rounded bg-neutral-950 text-neutral-300 border border-neutral-800">
											{t('channelForwarding.watermark')}
										</span>
									</Show>
								</div>
							</div>
						)}
					</For>
				</div>
			</Show>

			{/* TAB 2: WEBHOOKS */}
			<Show when={activeTab() === 'webhooks'}>
				<div class="space-y-4">
					<div class="p-4 rounded-2xl bg-neutral-900 border border-neutral-800 space-y-4">
						<div class="flex items-center gap-2 text-sm font-bold text-white">
							<span>🌐</span>
							<span>
								{t('channel.forwarding.webhook_tester') || 'Outbound Webhook Tester & HMAC'}
							</span>
						</div>

						<p class="text-xs text-neutral-400 leading-relaxed">
							{t('channel.forwarding.webhook_desc') ||
								'Receive realtime JSON payloads for every channel post with HMAC-SHA256 signature verification and SSRF-guarded delivery.'}
						</p>

						<div class="space-y-2">
							<div class="text-xs font-semibold text-neutral-300">
								{t('channelForwarding.targetWebhookHttps')}
							</div>
							<input
								type="url"
								value={pingUrl()}
								onInput={(e) => setPingUrl(e.currentTarget.value)}
								placeholder="https://api.yourdomain.com/webhooks/telegram"
								class="w-full py-2.5 px-3 rounded-xl bg-neutral-950 border border-neutral-800 text-white text-xs focus:border-[#0098EA] focus:outline-none"
							/>
						</div>

						<div class="space-y-2">
							<div class="text-xs font-semibold text-neutral-300">HMAC Secret Key (Optional)</div>
							<input
								type="password"
								value={pingSecret()}
								onInput={(e) => setPingSecret(e.currentTarget.value)}
								placeholder="whsec_xxxxxxxxxxxx"
								class="w-full py-2.5 px-3 rounded-xl bg-neutral-950 border border-neutral-800 text-white text-xs focus:border-[#0098EA] focus:outline-none"
							/>
						</div>

						<button
							type="button"
							onClick={handleTestPing}
							disabled={isPinging()}
							class="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-[#0098EA] to-[#0081C8] text-white text-xs font-semibold hover:opacity-90 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
						>
							<Show when={isPinging()}>
								<div class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
							</Show>
							<span>📡 {t('channel.forwarding.send_ping') || 'Send Test Ping Request'}</span>
						</button>

						<Show when={pingResult()}>
							<div
								class={`p-3 rounded-xl text-xs border ${
									pingResult()?.success
										? 'bg-emerald-950/30 border-emerald-500/30 text-emerald-300'
										: 'bg-red-950/30 border-red-500/30 text-red-300'
								}`}
							>
								<div class="font-bold">
									{pingResult()?.success ? '✅ Ping Succeeded' : '❌ Ping Failed'}
								</div>
								<div class="mt-1 text-[11px] opacity-90">
									{pingResult()?.success
										? `Remote server responded with HTTP status ${pingResult()?.status_code}`
										: pingResult()?.error || 'Connection timed out or returned error code.'}
								</div>
							</div>
						</Show>
					</div>
				</div>
			</Show>

			{/* TAB 3: LOGS */}
			<Show when={activeTab() === 'logs'}>
				<div class="space-y-3">
					<Show when={logs.loading}>
						<div class="h-40 rounded-2xl bg-neutral-900/60 animate-pulse border border-neutral-800" />
					</Show>

					<Show when={!logs.loading && (!logs() || logs()?.length === 0)}>
						<div class="py-12 px-6 rounded-2xl bg-neutral-900/40 border border-neutral-800 text-center text-xs text-neutral-400">
							{t('channelForwarding.noDeliveryEvents')}
						</div>
					</Show>

					<For each={logs()}>
						{(log: any) => (
							<div class="p-3 rounded-xl bg-neutral-900 border border-neutral-800 text-xs space-y-1">
								<div class="flex items-center justify-between">
									<span
										class={`font-semibold ${log.status === 'success' ? 'text-emerald-400' : 'text-amber-400'}`}
									>
										{log.status === 'success' ? '✅ Forwarded' : `⚠️ ${log.status || 'Event'}`}
									</span>
									<span class="text-[10px] text-neutral-500">
										{new Date(log.created_at || Date.now()).toLocaleTimeString()}
									</span>
								</div>
								<p class="text-neutral-300 font-mono text-[11px] truncate">
									{log.message || log.text || 'Message processed successfully'}
								</p>
							</div>
						)}
					</For>
				</div>
			</Show>

			{/* CREATE RULE MODAL */}
			<Show when={isCreatingRule()}>
				<div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
					<Motion.div
						initial={{ scale: 0.95, opacity: 0 }}
						animate={{ scale: 1, opacity: 1 }}
						class="w-full max-w-md rounded-2xl bg-neutral-900 border border-neutral-800 p-5 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto"
					>
						<div class="flex items-center justify-between pb-2 border-b border-neutral-800">
							<h3 class="text-base font-bold text-white flex items-center gap-2">
								<span>➕</span>
								<span>{t('channel.forwarding.create_rule_title') || 'New Forwarding Rule'}</span>
							</h3>
							<button
								type="button"
								onClick={() => setIsCreatingRule(false)}
								class="text-neutral-400 hover:text-white p-1"
							>
								✕
							</button>
						</div>

						<form onSubmit={handleSaveRule} class="space-y-4">
							{/* Direction & Target Type */}
							<div class="grid grid-cols-2 gap-2">
								<div class="space-y-1">
									<div class="text-[11px] font-semibold text-neutral-300">
										{t('channelForwarding.direction')}
									</div>
									<select
										value={direction()}
										onChange={(e) => setDirection(e.currentTarget.value as any)}
										class="w-full py-2 px-3 rounded-xl bg-neutral-950 border border-neutral-800 text-white text-xs"
									>
										<option value="outbound">Outbound (From This Channel)</option>
										<option value="inbound">Inbound (Into This Channel)</option>
									</select>
								</div>

								<div class="space-y-1">
									<div class="text-[11px] font-semibold text-neutral-300">
										{t('channelForwarding.targetType')}
									</div>
									<select
										value={targetType()}
										onChange={(e) => setTargetType(e.currentTarget.value as any)}
										class="w-full py-2 px-3 rounded-xl bg-neutral-950 border border-neutral-800 text-white text-xs"
									>
										<option value="telegram">Telegram Chat/Channel</option>
										<option value="webhook">{t('channelForwarding.httpsWebhook')}</option>
									</select>
								</div>
							</div>

							{/* Target Input with Verify */}
							<div class="space-y-1">
								<div class="text-[11px] font-semibold text-neutral-300">
									{targetType() === 'telegram'
										? 'Target Channel (@username or -100... ID)'
										: 'Target Webhook HTTPS URL'}
								</div>
								<div class="flex gap-2">
									<input
										type="text"
										value={target()}
										onInput={(e) => {
											setTarget(e.currentTarget.value);
											setTargetVerified(null);
										}}
										placeholder={
											targetType() === 'telegram'
												? '@target_channel'
												: 'https://api.domain.com/hook'
										}
										class="flex-1 py-2 px-3 rounded-xl bg-neutral-950 border border-neutral-800 text-white text-xs focus:border-[#0098EA] focus:outline-none"
										required
									/>
									<button
										type="button"
										onClick={handleVerifyTarget}
										disabled={isVerifyingTarget() || !target().trim()}
										class="py-2 px-3 rounded-xl bg-neutral-800 text-white text-xs font-semibold hover:bg-neutral-700 disabled:opacity-50"
									>
										{isVerifyingTarget() ? '...' : 'Verify'}
									</button>
								</div>
								<Show when={targetVerified() !== null}>
									<div
										class={`text-[10px] mt-1 ${targetVerified() ? 'text-emerald-400' : 'text-red-400'}`}
									>
										{targetVerified() ? '✓ Valid Destination' : '✗ Verification Failed'}
									</div>
								</Show>
							</div>

							{/* Forwarding Mode */}
							<div class="space-y-1">
								<div class="text-[11px] font-semibold text-neutral-300">
									{t('channelForwarding.deliveryMode')}
								</div>
								<select
									value={mode()}
									onChange={(e) => setMode(e.currentTarget.value as any)}
									class="w-full py-2 px-3 rounded-xl bg-neutral-950 border border-neutral-800 text-white text-xs"
								>
									<option value="forward">Standard Forward (Preserve Author)</option>
									<option value="copy">Clean Copy (No Forward Tag)</option>
									<option value="ai">{t('channelForwarding.aiParaphrasePolish')}</option>
								</select>
							</div>

							{/* Filter Options */}
							<div class="space-y-2 pt-2 border-t border-neutral-800">
								<div class="text-[11px] font-semibold text-neutral-300">
									{t('channelForwarding.cleanupFilters')}
								</div>
								<div class="grid grid-cols-3 gap-2">
									<div class="flex items-center gap-1.5 p-2 rounded-lg bg-neutral-950 border border-neutral-800 text-[11px] cursor-pointer">
										<input
											type="checkbox"
											checked={removeAds()}
											onChange={(e) => setRemoveAds(e.currentTarget.checked)}
										/>
										<span>{t('channelForwarding.noAds')}</span>
									</div>
									<div class="flex items-center gap-1.5 p-2 rounded-lg bg-neutral-950 border border-neutral-800 text-[11px] cursor-pointer">
										<input
											type="checkbox"
											checked={removeLinks()}
											onChange={(e) => setRemoveLinks(e.currentTarget.checked)}
										/>
										<span>{t('channelForwarding.noLinks')}</span>
									</div>
									<div class="flex items-center gap-1.5 p-2 rounded-lg bg-neutral-950 border border-neutral-800 text-[11px] cursor-pointer">
										<input
											type="checkbox"
											checked={removeHashtags()}
											onChange={(e) => setRemoveHashtags(e.currentTarget.checked)}
										/>
										<span>{t('channelForwarding.noTags')}</span>
									</div>
								</div>
							</div>

							{/* Watermark Signature */}
							<div class="space-y-1">
								<div class="text-[11px] font-semibold text-neutral-300">
									Attach Watermark / Signature (Optional)
								</div>
								<input
									type="text"
									value={watermark()}
									onInput={(e) => setWatermark(e.currentTarget.value)}
									placeholder="e.g. Join @mychannel"
									class="w-full py-2 px-3 rounded-xl bg-neutral-950 border border-neutral-800 text-white text-xs focus:border-[#0098EA] focus:outline-none"
								/>
							</div>

							{/* Submit */}
							<button
								type="submit"
								disabled={isSaving()}
								class="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-[#0098EA] to-[#0081C8] text-white font-semibold text-xs shadow-lg shadow-[#0098EA]/20 hover:opacity-95 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
							>
								<Show when={isSaving()}>
									<div class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
								</Show>
								<span>{t('channelForwarding.saveRule')}</span>
							</button>
						</form>
					</Motion.div>
				</div>
			</Show>
		</div>
	);
};

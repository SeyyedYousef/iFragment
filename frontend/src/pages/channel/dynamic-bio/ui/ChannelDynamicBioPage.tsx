import { Motion } from '@motionone/solid';
import { useNavigate, useParams } from '@solidjs/router';
import { backButton, hapticFeedback } from '@tma.js/sdk-solid';
import { Component, createEffect, createSignal, For, onCleanup, onMount, Show } from 'solid-js';
import { useChannelSettings, useUpdateChannelSettings } from '@/shared/api/queries.js';
import { t } from '@/shared/i18n/index.js';
import { ChannelContextBar } from '@/shared/ui/ChannelContextBar.js';
import { ChannelHamburgerMenu } from '@/shared/ui/channel-hamburger-menu.js';
import { SelectField, SettingsSection, ToggleSwitch } from '@/shared/ui/settings-controls.js';
import { showToast } from '@/shared/ui/toast.js';

export const ChannelDynamicBioPage: Component = () => {
	const params = useParams();
	const navigate = useNavigate();
	const [isMenuOpen, setIsMenuOpen] = createSignal(false);
	const [bioTemplate, setBioTemplate] = createSignal(
		'Official Channel | Members: $members | Price: $btc',
	);
	const [nameTemplate, setNameTemplate] = createSignal('');

	const [interval, setIntervalVal] = createSignal('10m');
	const [enabled, setEnabled] = createSignal(true);
	const [displayInName, setDisplayInName] = createSignal(false);

	const [isSaving, setIsSaving] = createSignal(false);

	// Countdown State
	const [enableCountdown, setEnableCountdown] = createSignal(false);
	const [eventName, setEventName] = createSignal('');
	const [targetDate, setTargetDate] = createSignal('');
	const [countdownLocation, setCountdownLocation] = createSignal('bio'); // bio, name, both
	const [postExpiryText, setPostExpiryText] = createSignal('');

	const settingsQuery = useChannelSettings(() => params.id!);
	const updateSettingsMutation = useUpdateChannelSettings(() => params.id!);

	createEffect(() => {
		const data = settingsQuery.data;
		if (data) {
			try {
				let dbio = data.dynamic_bio;
				if (typeof dbio === 'string') {
					dbio = JSON.parse(dbio);
				}
				if (dbio && typeof dbio === 'object') {
					if ('enabled' in dbio) setEnabled(dbio.enabled);
					if ('bioTemplate' in dbio) setBioTemplate(dbio.bioTemplate);
					if ('displayInName' in dbio) setDisplayInName(dbio.displayInName);
					if ('nameTemplate' in dbio) setNameTemplate(dbio.nameTemplate);
					if ('interval' in dbio) setIntervalVal(dbio.interval);
					if ('enableCountdown' in dbio) setEnableCountdown(dbio.enableCountdown);
					if ('eventName' in dbio) setEventName(dbio.eventName);
					if ('targetDate' in dbio) setTargetDate(dbio.targetDate);
					if ('countdownLocation' in dbio) setCountdownLocation(dbio.countdownLocation);
					if ('postExpiryText' in dbio) setPostExpiryText(dbio.postExpiryText);
				}
			} catch (e) {
				console.error('Failed to parse dynamic_bio settings:', e);
			}
		}
	});

	const variables = [
		{ tag: '$members', desc: t('channelDynamicBio.varMembers') || 'Member Count', val: '45,102' },
		{ tag: '$btc', desc: t('channelDynamicBio.varBtc') || 'Bitcoin Price', val: '$64,200' },
		{ tag: '$eth', desc: t('channelDynamicBio.varEth') || 'Ethereum Price', val: '$3,450' },
		{ tag: '$sol', desc: 'Solana Price', val: '$140' },
		{ tag: '$ton', desc: 'TON Price', val: '$5.50' },
		{ tag: '$time', desc: t('channelDynamicBio.varTime') || 'Current Time', val: '14:30' },
		{ tag: '$date', desc: 'Current Date', val: '12 May 2026' },
		{ tag: '$date_fa', desc: 'Persian Date', val: '۲۲ اردیبهشت ۱۴۰۵' },
		{ tag: '$day_name', desc: 'Day Name', val: 'Tuesday' },
		{ tag: '$countdown', desc: 'Live Countdown', val: '02:14:05' },
	];

	const handleSave = async () => {
		setIsSaving(true);

		const currentVersion = settingsQuery.data?.version ?? 1;
		const payload = {
			enabled: enabled(),
			bioTemplate: bioTemplate(),
			displayInName: displayInName(),
			nameTemplate: nameTemplate(),
			interval: interval(),
			enableCountdown: enableCountdown(),
			eventName: eventName(),
			targetDate: targetDate(),
			countdownLocation: countdownLocation(),
			postExpiryText: postExpiryText(),
		};

		try {
			await updateSettingsMutation.mutateAsync({
				category: 'dynamic_bio',
				data: payload,
				version: currentVersion,
			});
			hapticFeedback.notificationOccurred('success');
			showToast(t('common.settingsSaved') || 'Settings saved successfully', 'success');
			navigate(`/channel/${params.id}`);
		} catch (e) {
			console.error('Failed to save dynamic bio settings:', e);
			hapticFeedback.notificationOccurred('error');
			showToast(t('common.saveFailed') || 'Failed to save settings', 'error');
		} finally {
			setIsSaving(false);
		}
	};

	onMount(() => {
		backButton.show();
		const off = backButton.onClick(() => navigate(`/channel/${params.id}`));
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
							navigate(`/channel/${params.id}`);
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
							{t('channelDynamicBio.title') || 'Dynamic Bio & Name'}
						</h1>
						<span class="text-[12px] text-on-surface-variant truncate">
							{t('channelDynamicBio.subtitle') || 'Live updating channel description'}
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
				activeTab="dynamic-bio"
			/>

			<div class="px-5 pt-6 flex flex-col gap-6">
				<ChannelContextBar channelId={params.id} />

				<Show when={settingsQuery.isLoading}>
					<div class="flex flex-col gap-4 animate-pulse">
						<div class="h-40 bg-[#1c1c1c] rounded-3xl"></div>
						<div class="h-32 bg-[#1c1c1c] rounded-3xl"></div>
						<div class="h-24 bg-[#1c1c1c] rounded-3xl"></div>
					</div>
				</Show>

				<Show when={settingsQuery.isError}>
					<div class="bg-[#1c1c1c] rounded-3xl border border-[#ff3b30]/30 p-6 flex flex-col gap-4 items-center text-center">
						<span class="material-symbols-outlined text-[48px] text-[#ff3b30]">error</span>
						<div class="flex flex-col gap-1">
							<span class="text-[16px] font-bold text-white">Failed to Load Settings</span>
							<span class="text-[12px] text-[#8e8e93]">
								Please check your internet connection and try again.
							</span>
						</div>
						<button
							onClick={() => settingsQuery.refetch()}
							class="px-5 py-2.5 bg-[#32ade6] hover:bg-[#2b96c8] text-black rounded-xl font-bold text-[14px]"
						>
							Retry
						</button>
					</div>
				</Show>

				<Show when={settingsQuery.data}>
					<Motion.div
						initial={{ opacity: 0, y: 10 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ delay: 0.05 }}
						class="bg-[#1c1c1c] rounded-3xl border border-[#2a2a2a] p-4 flex flex-col gap-4"
					>
						<div class="flex items-center justify-between gap-3">
							<div class="flex flex-col flex-1 min-w-0">
								<span class="text-[15px] font-bold text-white">
									{t('channelDynamicBio.title') || 'Dynamic Bio & Name'}
								</span>
								<span class="text-[11px] text-[#8e8e93]">Update channel info in real-time</span>
							</div>
							<ToggleSwitch checked={enabled()} onChange={setEnabled} />
						</div>

						<Show when={enabled()}>
							<div class="h-[1px] bg-[#2a2a2a] w-full mt-1 mb-2"></div>

							{/* Bio Input */}
							<div class="flex flex-col gap-2">
								<label class="text-[13px] font-bold text-white flex justify-between">
									{t('channelDynamicBio.currentBio') || 'Bio Template'}
									<span
										class={`text-[11px] font-bold ${bioTemplate().length > 255 ? 'text-[#ff3b30]' : 'text-[#32ade6]'}`}
									>
										{bioTemplate().length} / 255
									</span>
								</label>

								<textarea
									value={bioTemplate()}
									onInput={(e) => setBioTemplate(e.currentTarget.value)}
									class="bg-[#2c2c2e] text-white text-[15px] rounded-xl px-4 py-3 w-full min-h-[80px] focus:outline-none focus:ring-2 focus:ring-[#32ade6] border border-transparent placeholder-[#a0a4ad] resize-none"
									placeholder="Official Channel | Members: $members"
									maxLength={255}
								/>
							</div>

							{/* Display in Name */}
							<div class="mt-2 bg-[#2c2c2e] p-3 rounded-xl border border-[#3a3a3c] flex flex-col gap-3">
								<div class="flex items-center justify-between">
									<div class="flex flex-col flex-1 min-w-0">
										<span class="text-[13px] font-bold text-white">Display in Channel Name</span>
										<span class="text-[11px] text-[#8e8e93]">
											Add dynamic tags to the channel name
										</span>
									</div>
									<ToggleSwitch checked={displayInName()} onChange={setDisplayInName} />
								</div>

								<Show when={displayInName()}>
									<input
										type="text"
										value={nameTemplate()}
										onInput={(e) => setNameTemplate(e.currentTarget.value)}
										placeholder="iFragment News $time"
										class="w-full bg-[#1c1c1c] text-white text-[14px] rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#32ade6]"
										maxLength={128}
									/>
								</Show>
							</div>

							{/* Variables */}
							<div class="mt-2 flex flex-col gap-2">
								<span class="text-[13px] font-bold text-white">
									{t('channelDynamicBio.variables') || 'Available Tags'}
								</span>
								<div class="flex flex-wrap gap-2">
									<For each={variables}>
										{(v) => (
											<button
												onClick={() => {
													hapticFeedback.impactOccurred('light');
													if (bioTemplate().length + v.tag.length <= 255) {
														setBioTemplate(`${bioTemplate()} ${v.tag}`);
													}
												}}
												class="bg-[#2c2c2e] hover:bg-[#3a3a3c] transition-colors border border-[#3a3a3c] rounded-lg px-2.5 py-1.5 flex flex-col items-start"
											>
												<span class="text-[12px] font-bold text-[#32ade6]">{v.tag}</span>
												<span class="text-[10px] text-on-surface-variant">{v.desc}</span>
											</button>
										)}
									</For>
								</div>
							</div>

							<div class="h-[1px] bg-[#2a2a2a] w-full my-2"></div>

							<SelectField
								label={t('channelDynamicBio.updateInterval') || 'Update Interval'}
								value={interval()}
								onChange={setIntervalVal}
								options={[
									{ value: '10m', label: t('channelDynamicBio.interval10m') || 'Every 10 minutes' },
									{ value: '30m', label: t('channelDynamicBio.interval30m') || 'Every 30 minutes' },
									{ value: '1h', label: t('channelDynamicBio.interval1h') || 'Every hour' },
									{ value: '24h', label: t('channelDynamicBio.interval24h') || 'Once a day' },
								]}
								description={
									t('channelDynamicBio.updateIntervalDesc') ||
									'How often the channel info refreshes.'
								}
							/>
						</Show>
					</Motion.div>

					<Show when={enabled()}>
						{/* Countdown Timer Module */}
						<Motion.div
							initial={{ opacity: 0, y: 10 }}
							animate={{ opacity: 1, y: 0 }}
							transition={{ delay: 0.1 }}
							class="bg-[#1c1c1c] rounded-3xl border border-[#2a2a2a] p-4 flex flex-col gap-4"
						>
							<SettingsSection
								title="Live Countdown Timer"
								description="Use $countdown to show time left until an event."
								enabled={enableCountdown()}
								onToggle={setEnableCountdown}
							/>

							<Show when={enableCountdown()}>
								<div class="flex flex-col gap-3 pt-3 border-t border-[#2a2a2a]">
									<div class="flex flex-col gap-2">
										<label class="text-[13px] font-bold text-white">Event Name</label>
										<input
											type="text"
											value={eventName()}
											onInput={(e) => setEventName(e.currentTarget.value)}
											placeholder="e.g. Next Bull Run"
											class="bg-[#2c2c2e] text-white text-[15px] rounded-xl px-4 py-3 w-full focus:outline-none focus:ring-2 focus:ring-[#32ade6]"
										/>
									</div>
									<div class="flex flex-col gap-2">
										<label class="text-[13px] font-bold text-white">Target Date & Time</label>
										<input
											type="datetime-local"
											value={targetDate()}
											onInput={(e) => setTargetDate(e.currentTarget.value)}
											class="bg-[#2c2c2e] text-white text-[15px] rounded-xl px-4 py-3 w-full focus:outline-none focus:ring-2 focus:ring-[#32ade6] color-scheme-dark"
										/>
									</div>

									<SelectField
										label="Display Location"
										value={countdownLocation()}
										onChange={setCountdownLocation}
										options={[
											{ value: 'bio', label: 'Only in Bio' },
											{ value: 'name', label: 'Only in Channel Name' },
											{ value: 'both', label: 'In both Bio & Name' },
										]}
									/>

									<div class="flex flex-col gap-2">
										<label class="text-[13px] font-bold text-white">Text After Expiry</label>
										<input
											type="text"
											value={postExpiryText()}
											onInput={(e) => setPostExpiryText(e.currentTarget.value)}
											placeholder="e.g. Event Started!"
											class="bg-[#2c2c2e] text-white text-[15px] rounded-xl px-4 py-3 w-full focus:outline-none focus:ring-2 focus:ring-[#32ade6]"
										/>
									</div>
								</div>
							</Show>
						</Motion.div>

						<Motion.div
							initial={{ opacity: 0, y: 10 }}
							animate={{ opacity: 1, y: 0 }}
							transition={{ delay: 0.15 }}
							class="bg-gradient-to-br from-[#1c1c1c] to-[#121212] rounded-3xl border border-[#32ade6]/30 p-5 flex flex-col gap-3 relative overflow-hidden"
						>
							<div class="absolute -top-10 -right-10 w-32 h-32 bg-[#32ade6]/10 rounded-full blur-2xl"></div>
							<span class="text-[13px] font-bold text-[#32ade6] flex items-center gap-2 relative z-10">
								<span class="material-symbols-outlined text-[16px]">visibility</span>
								{t('channelDynamicBio.preview') || 'Live Preview'}
							</span>
							<div class="bg-[#0f1014] rounded-xl p-4 border border-[#2a2a2a] relative z-10 flex flex-col gap-2">
								<Show when={displayInName() && nameTemplate()}>
									<div class="text-[16px] font-black text-white">
										{nameTemplate()
											.replace(/\$time/g, '14:30')
											.replace(/\$countdown/g, '02:14:05')}
									</div>
								</Show>
								<p class="text-[14px] text-[#a0a4ad] font-medium leading-relaxed">
									{bioTemplate()
										.replace(/\$members/g, '45,102')
										.replace(/\$btc/g, '$64,200')
										.replace(/\$eth/g, '$3,450')
										.replace(/\$sol/g, '$140')
										.replace(/\$ton/g, '$5.50')
										.replace(/\$time/g, '14:30')
										.replace(/\$date_fa/g, '۲۲ اردیبهشت ۱۴۰۵')
										.replace(/\$date/g, '12 May 2026')
										.replace(/\$day_name/g, 'Tuesday')
										.replace(/\$countdown/g, '02:14:05')}
								</p>
							</div>
						</Motion.div>
					</Show>
				</Show>
			</div>

			{/* Save Button */}
			<div class="fixed bottom-0 left-0 right-0 p-5 bg-gradient-to-t from-[#0f1014] via-[#0f1014]/90 to-transparent z-40 flex">
				<button
					onClick={handleSave}
					disabled={isSaving()}
					class="flex-1 h-14 bg-[#32ade6] hover:bg-[#2b96c8] text-black rounded-2xl font-bold text-[16px] shadow-[0_10px_25px_rgba(50,173,230,0.3)] transition-all flex items-center justify-center gap-2 disabled:opacity-40"
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
		</div>
	);
};

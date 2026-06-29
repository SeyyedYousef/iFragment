import { Motion } from '@motionone/solid';
import { useNavigate, useParams } from '@solidjs/router';
import { backButton, hapticFeedback } from '@tma.js/sdk-solid';
import {
	Component,
	createResource,
	createSignal,
	For,
	onCleanup,
	onMount,
	Show,
	Suspense,
} from 'solid-js';
import { createStore, reconcile } from 'solid-js/store';
import { groupApi } from '@/shared/api/bot-management.js';
import { t } from '@/shared/i18n/index.js';
import { HamburgerMenu } from '@/shared/ui/hamburger-menu.js';
import { InlineButtonField } from '@/shared/ui/settings-controls.js';
import { showToast } from '@/shared/ui/toast.js';

interface CustomTextsConfig {
	welcomeText: string;
	warningText: string;
	silenceStartText: string;
	silenceEndText: string;
	rulesText: string;
	forceJoinText: string;
	forceAddText: string;
	inlineButtons: { id: string; title: string; url: string }[];
}

const defaults: CustomTextsConfig = {
	welcomeText:
		'👋 Welcome to {group}, {user}!\n\nWe are delighted to have you join our community. To ensure a professional and respectful environment, please take a moment to review our group guidelines.\n\n🕒 Joined on: {time}\n👤 User ID: {id}\n\nThank you for being part of our network.',
	warningText:
		'⚠️ <b>Official Warning</b>\n\nUser: {user} ({id})\nReason: {reason}\nRule Violated: {rule}\n\nThis is warning {count} out of {threshold}. Please strictly adhere to the group rules to avoid further administrative actions.',
	silenceStartText:
		'🔒 <b>Group Lockdown Initiated</b>\n\nThe group {group} is currently in a scheduled quiet period or emergency lockdown. Standard members cannot send messages at this time. We appreciate your patience and cooperation.\n\n🕒 Time: {time}',
	silenceEndText:
		'🔓 <b>Group Lockdown Lifted</b>\n\nThe quiet period for {group} has concluded. The chat is now open for normal communication. Thank you for your patience.\n\n🕒 Time: {time}',
	rulesText:
		"📜 <b>Community Guidelines for {group}</b>\n\n1️⃣ Treat all members with utmost respect and professionalism.\n2️⃣ No spam, unauthorized links, or unsolicited advertisements.\n3️⃣ Keep discussions constructive and relevant to the group's core topic.\n4️⃣ Follow the instructions of the administrative team.\n\nFailure to comply may result in warnings or removal. Thank you for maintaining a high-quality environment.",
	forceJoinText:
		'📢 <b>Action Required: Channel Membership</b>\n\nHello {user}, to participate in {group}, you are required to join our official channels:\n\n{channel_names}\n\nPlease join them to instantly unlock your chat privileges.',
	forceAddText:
		'👥 <b>Action Required: Community Contribution</b>\n\nHello {user}, to send messages in {group}, you must invite members to our community.\n\n📊 Progress: {added} / {number} members added.\n⏳ Remaining: {remainadd} members.\n\nPlease complete this requirement to unlock your chat privileges.',
	inlineButtons: [],
};

export const CustomTextsPage: Component = () => {
	const navigate = useNavigate();
	const params = useParams();

	// Menu State
	const [isMenuOpen, setIsMenuOpen] = createSignal(false);
	const [isSaving, setIsSaving] = createSignal(false);
	const [isDirty, setIsDirty] = createSignal(false);
	const [settingsVersion, setSettingsVersion] = createSignal(1);

	const [cfg, setCfg] = createStore<CustomTextsConfig>({ ...defaults });

	const [_, { refetch }] = createResource(
		() => params.id,
		async (groupId) => {
			const data = await groupApi.getSettings(groupId);
			setSettingsVersion(data.version);
			const ct = (data.custom_texts || {}) as Partial<CustomTextsConfig>;
			setCfg(reconcile({ ...defaults, ...ct }));
			setIsDirty(false);
			return data;
		},
	);

	// Handle Telegram Back Button
	onMount(() => {
		backButton.show();
		const off = backButton.onClick(() => {
			hapticFeedback.impactOccurred('light');
			window.history.back();
		});
		onCleanup(() => off());
	});

	const update = (key: keyof CustomTextsConfig, val: any) => {
		setCfg(key, val);
		setIsDirty(true);
	};

	const handleSave = async () => {
		if (!isDirty()) return;
		hapticFeedback.notificationOccurred('success');
		setIsSaving(true);
		try {
			const result = await groupApi.updateSettings(
				params.id,
				'custom_texts',
				cfg as any,
				settingsVersion(),
			);
			setSettingsVersion(result.version);
			setIsDirty(false);
			showToast(t('common.settingsSaved') || 'Settings saved successfully', 'success');
			navigate(`/group/${params.id}`);
			backButton.hide();
		} catch (_e) {
			showToast(t('error.title'), 'error');
			hapticFeedback.notificationOccurred('error');
		} finally {
			setIsSaving(false);
		}
	};

	return (
		<div class="min-h-screen bg-[#0f1014] text-white pb-24">
			<div class="pt-6 pb-4 px-5 sticky top-0 bg-[#0f1014]/90 backdrop-blur-md z-20 border-b border-[#2a2a2a] flex items-center justify-between gap-3">
				<div class="flex items-center gap-2 overflow-hidden flex-1">
					<button
						onClick={() => {
							hapticFeedback.impactOccurred('light');
							window.history.back();
						}}
						class="w-10 h-10 rounded-full bg-[#1c1c1c] flex items-center justify-center border border-[#2a2a2a] hover:bg-[#2a2a2a] active:scale-90 transition-all shrink-0"
						aria-label="Back"
					>
						<span class="material-symbols-outlined text-white text-[20px] rtl:-scale-x-100">
							arrow_back
						</span>
					</button>
					<div class="flex flex-col overflow-hidden">
						<div class="flex items-center gap-2">
							<h1 class="text-[18px] font-black text-white leading-tight truncate">
								{t('customTextsSettings.title')}
							</h1>
							<Show when={isDirty()}>
								<span class="w-2.5 h-2.5 rounded-full bg-[#ff9f0a] animate-pulse shrink-0" />
							</Show>
						</div>
						<p class="text-[12px] text-[#8e8e93] font-medium leading-snug truncate">
							{t('customTextsSettings.subtitle')}
						</p>
					</div>
				</div>

				<button
					onClick={() => setIsMenuOpen(true)}
					class="w-10 h-10 rounded-full bg-[#1c1c1c] flex items-center justify-center border border-[#2a2a2a] hover:bg-[#2a2a2a] transition-colors shrink-0"
				>
					<span class="material-symbols-outlined text-white text-[20px]">menu</span>
				</button>
			</div>

			<HamburgerMenu
				isOpen={isMenuOpen()}
				onClose={() => setIsMenuOpen(false)}
				groupId={params.id}
				activeTab="custom"
			/>

			<Suspense fallback={null}>
				<div class="p-5 flex flex-col gap-5">
					{/* Info Banner for Placeholders */}
					<Motion.div
						initial={{ opacity: 0, y: 10 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ delay: 0.1 }}
						class="bg-[#3390ec]/10 border border-[#3390ec]/30 rounded-2xl p-4 flex flex-col gap-3"
					>
						<div class="flex items-center gap-2">
							<span class="material-symbols-outlined text-[#3390ec] text-[22px]">data_object</span>
							<span class="text-[14px] font-bold text-white">
								{t('customTextsSettings.placeholders')}
							</span>
						</div>

						<div class="grid grid-cols-2 gap-x-4 gap-y-2">
							<For
								each={[
									{ tag: '{user}', label: t('customTextsSettings.phUser') },
									{ tag: '{id}', label: t('customTextsSettings.phId') },
									{ tag: '{group}', label: t('customTextsSettings.phGroup') },
									{ tag: '{time}', label: t('customTextsSettings.phTime') },
									{ tag: '{reason}', label: t('customTextsSettings.phReason') },
									{ tag: '{rule}', label: t('customTextsSettings.phRule') },
									{ tag: '{count}', label: t('customTextsSettings.phCount') },
									{ tag: '{threshold}', label: t('customTextsSettings.phThreshold') },
									{ tag: '{number}', label: t('customTextsSettings.phNumber') },
									{ tag: '{added}', label: t('customTextsSettings.phAdded') },
									{ tag: '{remainadd}', label: t('customTextsSettings.phRemainAdd') },
									{ tag: '{channel_names}', label: t('customTextsSettings.phChannelNames') },
								]}
							>
								{(ph) => (
									<div class="flex flex-col gap-0.5">
										<code class="text-[#3390ec] font-mono text-[11px] font-bold">{ph.tag}</code>
										<span class="text-[10px] text-[#8e8e93] leading-tight">{ph.label}</span>
									</div>
								)}
							</For>
						</div>
					</Motion.div>

					{/* Welcome Message */}
					<Motion.div
						initial={{ opacity: 0, y: 10 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ delay: 0.2 }}
						class="flex flex-col gap-2"
					>
						<label class="text-[15px] font-bold text-white flex items-center gap-2">
							<span class="material-symbols-outlined text-[#34c759] text-[18px]">waving_hand</span>
							{t('customTextsSettings.welcomeText')}
						</label>
						<span class="text-[12px] text-[#8e8e93] leading-snug px-1 mb-1">
							{t('customTextsSettings.welcomeTextDesc')}
						</span>
						<textarea
							value={cfg.welcomeText}
							onInput={(e) => update('welcomeText', e.currentTarget.value)}
							placeholder="👋 Welcome to {group}, {user}!"
							class="w-full h-28 bg-[#1c1c1c] text-white text-[14px] rounded-2xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#3390ec] border border-[#2a2a2a] transition-all resize-none placeholder-[#8e8e93]"
						/>
					</Motion.div>

					{/* Warning Message */}
					<Motion.div
						initial={{ opacity: 0, y: 10 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ delay: 0.25 }}
						class="flex flex-col gap-2 mt-2"
					>
						<label class="text-[15px] font-bold text-white flex items-center gap-2">
							<span class="material-symbols-outlined text-[#ffcc00] text-[18px]">warning</span>
							{t('customTextsSettings.warningText')}
						</label>
						<span class="text-[12px] text-[#8e8e93] leading-snug px-1 mb-1">
							{t('customTextsSettings.warningTextDesc')}
						</span>
						<textarea
							value={cfg.warningText}
							onInput={(e) => update('warningText', e.currentTarget.value)}
							class="w-full h-24 bg-[#1c1c1c] text-white text-[14px] rounded-2xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#3390ec] border border-[#2a2a2a] transition-all resize-none placeholder-[#8e8e93]"
							placeholder="⚠️ Warning: Please respect the rules."
						/>
					</Motion.div>

					{/* Silence Messaging */}
					<Motion.div
						initial={{ opacity: 0, y: 10 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ delay: 0.3 }}
						class="flex flex-col gap-4 mt-2"
					>
						<div class="flex flex-col gap-2">
							<label class="text-[15px] font-bold text-white flex items-center gap-2">
								<span class="material-symbols-outlined text-[#ff3b30] text-[18px]">
									notifications_paused
								</span>
								{t('customTextsSettings.silenceStartText')}
							</label>
							<span class="text-[12px] text-[#8e8e93] leading-snug px-1 mb-1">
								{t('customTextsSettings.silenceStartTextDesc')}
							</span>
							<textarea
								value={cfg.silenceStartText}
								onInput={(e) => update('silenceStartText', e.currentTarget.value)}
								class="w-full h-20 bg-[#1c1c1c] text-white text-[14px] rounded-2xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#3390ec] border border-[#2a2a2a] transition-all resize-none placeholder-[#8e8e93]"
								placeholder="🔒 Quiet hours have started. The group is now muted."
							/>
						</div>

						<div class="flex flex-col gap-2">
							<label class="text-[15px] font-bold text-white flex items-center gap-2">
								<span class="material-symbols-outlined text-[#34c759] text-[18px]">
									notifications_active
								</span>
								{t('customTextsSettings.silenceEndText')}
							</label>
							<span class="text-[12px] text-[#8e8e93] leading-snug px-1 mb-1">
								{t('customTextsSettings.silenceEndTextDesc')}
							</span>
							<textarea
								value={cfg.silenceEndText}
								onInput={(e) => update('silenceEndText', e.currentTarget.value)}
								class="w-full h-20 bg-[#1c1c1c] text-white text-[14px] rounded-2xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#3390ec] border border-[#2a2a2a] transition-all resize-none placeholder-[#8e8e93]"
								placeholder="🔓 Quiet hours have ended. You can now send messages."
							/>
						</div>
					</Motion.div>

					{/* Rules Text */}
					<Motion.div
						initial={{ opacity: 0, y: 10 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ delay: 0.4 }}
						class="flex flex-col gap-2 mt-2"
					>
						<label class="text-[15px] font-bold text-white flex items-center gap-2">
							<span class="material-symbols-outlined text-[#ffcc00] text-[18px]">gavel</span>
							{t('customTextsSettings.rulesText')}
						</label>
						<span class="text-[12px] text-[#8e8e93] leading-snug px-1 mb-1">
							{t('customTextsSettings.rulesTextDesc')}
						</span>
						<textarea
							value={cfg.rulesText}
							onInput={(e) => update('rulesText', e.currentTarget.value)}
							class="w-full h-32 bg-[#1c1c1c] text-white text-[14px] rounded-2xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#3390ec] border border-[#2a2a2a] transition-all resize-none placeholder-[#8e8e93]"
							placeholder="Be respectful and follow standard group rules."
						/>
					</Motion.div>

					{/* Force Join Message */}
					<Motion.div
						initial={{ opacity: 0, y: 10 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ delay: 0.45 }}
						class="flex flex-col gap-2 mt-2"
					>
						<label class="text-[15px] font-bold text-white flex items-center gap-2">
							<span class="material-symbols-outlined text-[#3390ec] text-[18px]">campaign</span>
							{t('customTextsSettings.forceJoinText')}
						</label>
						<span class="text-[12px] text-[#8e8e93] leading-snug px-1 mb-1">
							{t('customTextsSettings.forceJoinTextDesc')}
						</span>
						<textarea
							value={cfg.forceJoinText}
							onInput={(e) => update('forceJoinText', e.currentTarget.value)}
							class="w-full h-24 bg-[#1c1c1c] text-white text-[14px] rounded-2xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#3390ec] border border-[#2a2a2a] transition-all resize-none placeholder-[#8e8e93]"
							placeholder="You must join {channel} first"
						/>
					</Motion.div>

					{/* Force Add Message */}
					<Motion.div
						initial={{ opacity: 0, y: 10 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ delay: 0.48 }}
						class="flex flex-col gap-2 mt-2"
					>
						<label class="text-[15px] font-bold text-white flex items-center gap-2">
							<span class="material-symbols-outlined text-[#ff9500] text-[18px]">person_add</span>
							{t('customTextsSettings.forceAddText')}
						</label>
						<span class="text-[12px] text-[#8e8e93] leading-snug px-1 mb-1">
							{t('customTextsSettings.forceAddTextDesc')}
						</span>
						<textarea
							value={cfg.forceAddText}
							onInput={(e) => update('forceAddText', e.currentTarget.value)}
							class="w-full h-24 bg-[#1c1c1c] text-white text-[14px] rounded-2xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#3390ec] border border-[#2a2a2a] transition-all resize-none placeholder-[#8e8e93]"
							placeholder="You must add {count} members to the group before you can send messages."
						/>
					</Motion.div>

					{/* Inline Buttons */}
					<Motion.div
						initial={{ opacity: 0, y: 10 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ delay: 0.5 }}
						class="bg-[#1c1c1c] rounded-3xl border border-[#2a2a2a] p-4 flex flex-col mt-2"
					>
						<InlineButtonField
							label={t('customTextsSettings.inlineButtons')}
							description={t('customTextsSettings.inlineButtonsDesc')}
							buttons={cfg.inlineButtons}
							onAdd={(btn) => update('inlineButtons', [...cfg.inlineButtons, btn])}
							onRemove={(id) =>
								update(
									'inlineButtons',
									cfg.inlineButtons.filter((b) => b.id !== id),
								)
							}
						/>
					</Motion.div>
				</div>
			</Suspense>

			{/* Floating Action Bar */}
			<Show when={isDirty()}>
				<div class="fixed bottom-0 left-0 right-0 p-5 bg-gradient-to-t from-[#0f1014] via-[#0f1014]/90 to-transparent z-40 flex gap-3">
					<button
						onClick={() => refetch()}
						disabled={isSaving()}
						class="flex-1 h-14 bg-[#1c1c1c] text-[#ff3b30] border border-[#ff3b30]/20 rounded-2xl font-bold text-[15px] transition-all flex items-center justify-center gap-2 hover:bg-[#ff3b30]/10"
					>
						{t('common.cancel')}
						<span class="material-symbols-outlined text-[18px]">close</span>
					</button>
					<button
						onClick={handleSave}
						disabled={isSaving()}
						class="flex-[2] h-14 bg-[#3390ec] hover:bg-[#2b7bc9] text-white rounded-2xl font-bold text-[16px] shadow-[0_10px_25_rgba(51,144,236,0.3)] transition-all flex items-center justify-center gap-2 disabled:opacity-40"
					>
						<Show
							when={!isSaving()}
							fallback={
								<span class="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
							}
						>
							{t('generalSettings.saveSettings')}
							<span class="material-symbols-outlined text-[20px]">save</span>
						</Show>
					</button>
				</div>
			</Show>
		</div>
	);
};

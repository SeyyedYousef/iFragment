import { Motion } from '@motionone/solid';
import { useNavigate, useParams } from '@solidjs/router';
import { backButton, hapticFeedback } from '@tma.js/sdk-solid';
import {
	Component,
	createResource,
	createSignal,
	onCleanup,
	onMount,
	Show,
	Suspense,
} from 'solid-js';
import { createStore, reconcile } from 'solid-js/store';
import { groupApi } from '@/shared/api/bot-management.js';
import { t } from '@/shared/i18n/index.js';
import { HamburgerMenu } from '@/shared/ui/hamburger-menu.js';
import { NumberInputField } from '@/shared/ui/settings-controls.js';
import { showToast } from '@/shared/ui/toast.js';

interface LimitsConfig {
	minMessageLength: number;
	maxMessageLength: number;
	floodMessages: number;
	floodWindow: number;
	duplicateCount: number;
	duplicateWindow: number;
}

const defaultConfig: LimitsConfig = {
	minMessageLength: 0,
	maxMessageLength: 0,
	floodMessages: 0,
	floodWindow: 0,
	duplicateCount: 0,
	duplicateWindow: 0,
};

export const LimitsPage: Component = () => {
	const navigate = useNavigate();
	const params = useParams();

	// Menu State
	const [isMenuOpen, setIsMenuOpen] = createSignal(false);

	const [isSaving, setIsSaving] = createSignal(false);
	const [isDirty, setIsDirty] = createSignal(false);
	const [settingsVersion, setSettingsVersion] = createSignal(1);

	// State Management with createStore for limits
	const [limits, setLimits] = createStore<LimitsConfig>({ ...defaultConfig });

	const [_, { refetch }] = createResource(
		() => params.id,
		async (groupId) => {
			const data = await groupApi.getSettings(groupId);
			setSettingsVersion(data.version);

			const remoteLimits = (data.limits || {}) as any;
			const mappedLimits = {
				minMessageLength: remoteLimits.minMessageLength ?? 0,
				maxMessageLength: remoteLimits.maxMessageLength ?? 0,
				floodMessages: remoteLimits.floodMessages ?? 0,
				floodWindow: remoteLimits.floodWindow ?? 0,
				duplicateCount: remoteLimits.duplicateCount ?? 0,
				duplicateWindow: remoteLimits.duplicateWindow ?? 0,
			};

			setLimits(reconcile({ ...defaultConfig, ...mappedLimits }));
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

	const updateField = (key: keyof LimitsConfig, value: number) => {
		setLimits(key, value);
		setIsDirty(true);
	};

	const handleSave = async () => {
		if (!isDirty()) return;
		hapticFeedback.notificationOccurred('success');
		setIsSaving(true);
		try {
			const payload = {
				minMessageLength: limits.minMessageLength,
				maxMessageLength: limits.maxMessageLength,
				floodMessages: limits.floodMessages,
				floodWindow: limits.floodWindow,
				duplicateCount: limits.duplicateCount,
				duplicateWindow: limits.duplicateWindow,
			};
			const result = await groupApi.updateSettings(params.id, 'limits', payload, settingsVersion());
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
								{t('limitsSettings.title')}
							</h1>
							<Show when={isDirty()}>
								<span class="w-2.5 h-2.5 rounded-full bg-[#ff9f0a] animate-pulse shrink-0" />
							</Show>
						</div>
						<p class="text-[12px] text-[#8e8e93] font-medium leading-snug truncate">
							{t('limitsSettings.subtitle')}
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
				activeTab="limits"
			/>

			<Suspense fallback={null}>
				<div class="p-5 flex flex-col gap-5">
					{/* Info Banner for Rule of Zero */}
					<Motion.div
						initial={{ opacity: 0, y: 10 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ delay: 0.1 }}
						class="bg-[#3390ec]/10 border border-[#3390ec]/30 rounded-2xl p-4 flex items-start gap-3"
					>
						<span class="material-symbols-outlined text-[#3390ec] text-[24px] shrink-0 mt-0.5">
							info
						</span>
						<div class="flex flex-col">
							<span class="text-[14px] font-bold text-white mb-1">
								{t('limitsSettings.ruleOfZero')}
							</span>
							<span class="text-[12px] text-[#8e8e93] leading-relaxed">
								{t('limitsSettings.ruleOfZeroDesc')}
								<br />
								<span class="text-[#3390ec] font-bold">{t('limitsSettings.ruleOfZeroExample')}</span> {t('limitsSettings.ruleOfZeroExampleText')}
							</span>
						</div>
					</Motion.div>

					{/* Message Length limits */}
					<Motion.div
						initial={{ opacity: 0, y: 10 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ delay: 0.2 }}
						class="bg-[#1c1c1c] rounded-3xl border border-[#2a2a2a] p-4 flex flex-col gap-4"
					>
						<div class="flex items-center gap-2 mb-2">
							<span class="material-symbols-outlined text-[#3390ec]">sort_by_alpha</span>
							<h2 class="text-[16px] font-bold text-white">{t('limitsSettings.messageLength')}</h2>
						</div>

						<NumberInputField
							label={t('limitsSettings.minLen')}
							description={t('limitsSettings.minLenDesc')}
							value={limits.minMessageLength}
							onChange={(v) => updateField('minMessageLength', v)}
							placeholder="0"
						/>

						<div class="w-full h-[1px] bg-[#2a2a2a]"></div>

						<NumberInputField
							label={t('limitsSettings.maxLen')}
							description={t('limitsSettings.maxLenDesc')}
							value={limits.maxMessageLength}
							onChange={(v) => updateField('maxMessageLength', v)}
							placeholder="0"
						/>
					</Motion.div>

					{/* Flood Control */}
					<Motion.div
						initial={{ opacity: 0, y: 10 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ delay: 0.3 }}
						class="bg-[#1c1c1c] rounded-3xl border border-[#2a2a2a] p-4 flex flex-col gap-4"
					>
						<div class="flex items-center gap-2 mb-2">
							<span class="material-symbols-outlined text-[#ffcc00]">speed</span>
							<h2 class="text-[16px] font-bold text-white">{t('limitsSettings.floodControl')}</h2>
						</div>

						<NumberInputField
							label={t('limitsSettings.floodMsgs')}
							description={t('limitsSettings.floodMsgsDesc')}
							value={limits.floodMessages}
							onChange={(v) => updateField('floodMessages', v)}
							placeholder="0"
						/>

						<div class="w-full h-[1px] bg-[#2a2a2a]"></div>

						<NumberInputField
							label={t('limitsSettings.floodWin')}
							description={t('limitsSettings.floodWinDesc')}
							value={limits.floodWindow}
							onChange={(v) => updateField('floodWindow', v)}
							placeholder="0"
						/>
					</Motion.div>

					{/* Duplicate Protection */}
					<Motion.div
						initial={{ opacity: 0, y: 10 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ delay: 0.4 }}
						class="bg-[#1c1c1c] rounded-3xl border border-[#2a2a2a] p-4 flex flex-col gap-4"
					>
						<div class="flex items-center gap-2 mb-2">
							<span class="material-symbols-outlined text-[#34c759]">file_copy</span>
							<h2 class="text-[16px] font-bold text-white">
								{t('limitsSettings.duplicateProtection')}
							</h2>
						</div>

						<NumberInputField
							label={t('limitsSettings.dupCount')}
							description={t('limitsSettings.dupCountDesc')}
							value={limits.duplicateCount}
							onChange={(v) => updateField('duplicateCount', v)}
							placeholder="0"
						/>

						<div class="w-full h-[1px] bg-[#2a2a2a]"></div>

						<NumberInputField
							label={t('limitsSettings.dupWin')}
							description={t('limitsSettings.dupWinDesc')}
							value={limits.duplicateWindow}
							onChange={(v) => updateField('duplicateWindow', v)}
							placeholder="0"
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

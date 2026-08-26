import { Motion } from '@motionone/solid';
import { useNavigate, useParams } from '@solidjs/router';
import { backButton } from '@tma.js/sdk-solid';
import {
	type Component,
	createResource,
	createSignal,
	onCleanup,
	onMount,
	Show,
	Suspense,
} from 'solid-js';
import { createStore, reconcile } from 'solid-js/store';
import { groupApi } from '@/entities/group/index.js';
import { isRtl, t } from '@/shared/i18n/index.js';
import { haptic } from '@/shared/lib/haptic.js';
import { HamburgerMenu } from '@/shared/ui/hamburger-menu.js';
import { SettingsGuard } from '@/shared/ui/SettingsGuard.js';
import { NumberInputField, StringListField, ToggleSwitch } from '@/shared/ui/settings-controls.js';
import { showToast } from '@/shared/ui/toast.js';

interface MandatoryConfig {
	forcedAddEnabled: boolean;
	forcedAddCount: number;
	forceJoinEnabled: boolean;
	requiredChannels: string[];
	verificationEnabled: boolean;
	excludedUsers: string[];
}

const defaults: MandatoryConfig = {
	forcedAddEnabled: false,
	forcedAddCount: 0,
	forceJoinEnabled: false,
	requiredChannels: [],
	verificationEnabled: false,
	excludedUsers: [],
};

export const MandatoryPage: Component = () => {
	const navigate = useNavigate();
	const params = useParams();
	const [isMenuOpen, setIsMenuOpen] = createSignal(false);
	const [isDirty, setIsDirty] = createSignal(false);
	const [isSaving, setIsSaving] = createSignal(false);
	const [showUnsavedSheet, setShowUnsavedSheet] = createSignal(false);
	const [settingsVersion, setSettingsVersion] = createSignal(1);

	const [cfg, setCfg] = createStore<MandatoryConfig>({ ...defaults });
	const [initialCfg, setInitialCfg] = createSignal<MandatoryConfig>({ ...defaults });

	const [_settingsData] = createResource(
		() => params.id,
		async (groupId) => {
			const res = await groupApi.getSettings(groupId);
			setSettingsVersion(res.version);
			const mm = (res.mandatory_membership || {}) as any;
			const mapped: MandatoryConfig = {
				forcedAddEnabled: mm.forced_add_enabled ?? false,
				forcedAddCount: mm.forced_add_count ?? 0,
				forceJoinEnabled: mm.force_join_enabled ?? false,
				requiredChannels: mm.required_channels ?? [],
				verificationEnabled: mm.verification_enabled ?? false,
				excludedUsers: mm.exemptions ?? [],
			};
			setInitialCfg({ ...mapped });
			setCfg(reconcile(mapped));
			setIsDirty(false);
			return res;
		},
	);

	const handleBack = () => {
		if (isDirty()) {
			setShowUnsavedSheet(true);
			return;
		}
		window.history.back();
	};

	onMount(() => {
		backButton.show();
		const off = backButton.onClick(handleBack);
		onCleanup(() => off());
	});

	const updateCfg = (key: keyof MandatoryConfig, value: any) => {
		setCfg(key, value);
		setIsDirty(true);
	};

	const handleSave = async () => {
		if (!isDirty() || isSaving()) return;
		setIsSaving(true);
		try {
			const payload = {
				forced_add_enabled: cfg.forcedAddEnabled,
				forced_add_count: cfg.forcedAddCount,
				force_join_enabled: cfg.forceJoinEnabled,
				required_channels: cfg.requiredChannels,
				verification_enabled: cfg.verificationEnabled,
				exemptions: cfg.excludedUsers,
			};
			const res = await groupApi.updateSettings(
				params.id,
				'mandatory_membership',
				payload,
				settingsVersion(),
			);
			setSettingsVersion(res.version);
			setInitialCfg({ ...cfg });
			setIsDirty(false);
			setShowUnsavedSheet(false);
			haptic.notify('success');
			showToast(t('common.settingsSaved'), 'success');
			navigate(`/group/${params.id}`);
		} catch (_e) {
			showToast(t('common.errorUpdateFailed'), 'error');
			haptic.notify('error');
		} finally {
			setIsSaving(false);
		}
	};

	const handleDiscard = () => {
		setCfg(reconcile({ ...initialCfg() }));
		setIsDirty(false);
		setShowUnsavedSheet(false);
		window.history.back();
	};

	return (
		<div
			class="min-h-screen bg-[#030303] pb-28 relative overflow-x-hidden text-white font-sans selection:bg-[#3390ec]/30"
			dir={isRtl() ? 'rtl' : 'ltr'}
		>
			{/* Ambient Top Glow */}
			<div class="absolute top-0 left-0 right-0 h-[350px] bg-gradient-to-b from-[#3390ec]/15 via-transparent to-transparent blur-[80px] pointer-events-none z-0" />

			{/* ═══════ PREMIUM STICKY HEADER ═══════ */}
			<div class="pt-6 pb-4 px-5 sticky top-0 bg-[#030303]/85 backdrop-blur-2xl z-40 border-b border-white/5 flex items-center justify-between gap-3 shadow-sm">
				<div class="flex items-center gap-3.5 overflow-hidden flex-1">
					<button
						type="button"
						onClick={() => {
							haptic.impact('light');
							handleBack();
						}}
						class="w-11 h-11 rounded-[14px] bg-[#12141C]/80 flex items-center justify-center border border-white/10 hover:bg-white/10 active:scale-95 transition-all shrink-0 shadow-sm"
						aria-label={t('common.back')}
					>
						<span class="material-symbols-outlined text-white/80 text-[22px] rtl:-scale-x-100">
							arrow_back
						</span>
					</button>
					<div class="flex flex-col overflow-hidden">
						<div class="flex items-center gap-2.5">
							<h1 class="text-[18px] font-black text-white leading-tight truncate tracking-tight">
								{t('mandatorySettings.title')}
							</h1>
							<Show when={isDirty()}>
								<span class="w-2 h-2 rounded-full bg-amber-400 animate-pulse shrink-0 shadow-[0_0_8px_rgba(251,191,36,0.8)]" />
							</Show>
						</div>
						<span class="text-[11px] text-white/50 font-bold uppercase tracking-wider leading-snug truncate mt-0.5">
							{t('mandatorySettings.description')}
						</span>
					</div>
				</div>

				<button
					type="button"
					onClick={() => setIsMenuOpen(true)}
					class="w-11 h-11 rounded-[14px] bg-[#12141C]/80 flex items-center justify-center border border-white/10 hover:bg-white/10 active:scale-95 transition-colors shrink-0 shadow-sm text-white/80"
					aria-label={t('common.toggle')}
				>
					<span class="material-symbols-outlined text-[22px]">menu</span>
				</button>
			</div>

			<HamburgerMenu
				isOpen={isMenuOpen()}
				onClose={() => setIsMenuOpen(false)}
				groupId={params.id}
				activeTab="mandatory"
			/>

			<Suspense
				fallback={
					<div class="p-8 flex justify-center">
						<div class="w-8 h-8 border-2 border-[#3390ec] border-t-transparent rounded-full animate-spin" />
					</div>
				}
			>
				<div class="p-5 flex flex-col gap-5 max-w-md mx-auto relative z-10 w-full">
					{/* ═══════ JOIN REQUESTS VERIFICATION (PV CAPTCHA) ═══════ */}
					<Motion.div
						initial={{ opacity: 0, y: 15 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ delay: 0.05 }}
					>
						<div class="bg-[#12141C]/80 backdrop-blur-xl border border-[#3390ec]/20 rounded-[24px] p-5 shadow-sm flex flex-col gap-4">
							<div class="flex items-center justify-between">
								<div class="flex items-center gap-2">
									<span class="material-symbols-outlined text-[#3390ec] text-[20px]">
										how_to_reg
									</span>
									<h2 class="text-[13px] font-black text-[#3390ec] uppercase tracking-widest">
										{t('groupMandatory.pvCaptcha')}
									</h2>
								</div>
								<span class="text-[9px] font-black bg-[#3390ec]/20 text-[#3390ec] border border-[#3390ec]/30 px-2 py-0.5 rounded-[6px] uppercase tracking-widest">
									{'NATIVE'}
								</span>
							</div>

							<div class="flex items-center justify-between gap-3">
								<div class="flex flex-col">
									<span class="text-[13px] font-bold text-white">{t('groupMandatory.verifyBeforeJoin')}</span>
									<span class="text-[11px] text-white/50 leading-relaxed mt-0.5">
										{t('groupMandatory.pvCaptchaDesc')}
									</span>
								</div>
								<ToggleSwitch
									checked={cfg.verificationEnabled}
									onChange={(v) => updateCfg('verificationEnabled', v)}
								/>
							</div>
						</div>
					</Motion.div>

					{/* ═══════ MANDATORY CHANNEL SUBSCRIPTION ═══════ */}
					<Motion.div
						initial={{ opacity: 0, y: 15 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ delay: 0.1 }}
					>
						<div class="bg-[#12141C]/80 backdrop-blur-xl border border-white/5 rounded-[24px] p-5 shadow-sm flex flex-col gap-4">
							<div class="flex items-center justify-between gap-3">
								<div class="flex flex-col">
									<h2 class="text-[13px] font-black text-white uppercase tracking-widest">
										{t('mandatorySettings.forceJoinTitle')}
									</h2>
									<span class="text-[11px] text-white/50 leading-relaxed mt-0.5">
										{t('mandatorySettings.forceJoinDesc')}
									</span>
								</div>
								<ToggleSwitch
									checked={cfg.forceJoinEnabled}
									onChange={(v) => updateCfg('forceJoinEnabled', v)}
								/>
							</div>

							<Show when={cfg.forceJoinEnabled}>
								<div class="pt-2 border-t border-white/5">
									<StringListField
										label={t('mandatorySettings.requiredChannels')}
										items={cfg.requiredChannels}
										onAdd={(item) => updateCfg('requiredChannels', [...cfg.requiredChannels, item])}
										onRemove={(item) =>
											updateCfg(
												'requiredChannels',
												cfg.requiredChannels.filter((c) => c !== item),
											)
										}
										placeholder="@yourchannel"
										description={t('mandatorySettings.requiredChannelsDesc')}
									/>
								</div>
							</Show>
						</div>
					</Motion.div>

					{/* ═══════ FORCED MEMBER INVITATION ═══════ */}
					<Motion.div
						initial={{ opacity: 0, y: 15 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ delay: 0.15 }}
					>
						<div class="bg-[#12141C]/80 backdrop-blur-xl border border-white/5 rounded-[24px] p-5 shadow-sm flex flex-col gap-4">
							<div class="flex items-center justify-between gap-3">
								<div class="flex flex-col">
									<h2 class="text-[13px] font-black text-white uppercase tracking-widest">
										{t('mandatorySettings.forcedAddTitle')}
									</h2>
									<span class="text-[11px] text-white/50 leading-relaxed mt-0.5">
										{t('mandatorySettings.forcedAddDesc')}
									</span>
								</div>
								<ToggleSwitch
									checked={cfg.forcedAddEnabled}
									onChange={(v) => updateCfg('forcedAddEnabled', v)}
								/>
							</div>

							<Show when={cfg.forcedAddEnabled}>
								<div class="pt-2 border-t border-white/5">
									<NumberInputField
										label={t('mandatorySettings.requiredAddCount')}
										value={cfg.forcedAddCount}
										onChange={(val) => updateCfg('forcedAddCount', val)}
										min={1}
										max={100}
										description={t('mandatorySettings.requiredAddCountDesc')}
									/>
								</div>
							</Show>
						</div>
					</Motion.div>

					{/* ═══════ EXEMPTED USERS ═══════ */}
					<Motion.div
						initial={{ opacity: 0, y: 15 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ delay: 0.2 }}
					>
						<div class="bg-[#12141C]/80 backdrop-blur-xl border border-white/5 rounded-[24px] p-5 shadow-sm flex flex-col gap-4">
							<StringListField
								label={t('mandatorySettings.excludedUsers')}
								items={cfg.excludedUsers}
								onAdd={(item) => updateCfg('excludedUsers', [...cfg.excludedUsers, item])}
								onRemove={(item) =>
									updateCfg(
										'excludedUsers',
										cfg.excludedUsers.filter((u) => u !== item),
									)
								}
								placeholder="@username / ID"
								description={t('mandatorySettings.excludedUsersDesc')}
							/>
						</div>
					</Motion.div>
				</div>
			</Suspense>

			<SettingsGuard
				isDirty={isDirty()}
				isSaving={isSaving()}
				showSheet={showUnsavedSheet()}
				onSave={handleSave}
				onDiscard={handleDiscard}
				onCloseSheet={() => setShowUnsavedSheet(false)}
			/>
		</div>
	);
};

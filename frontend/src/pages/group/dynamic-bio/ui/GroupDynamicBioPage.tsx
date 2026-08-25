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
import { groupApi } from '@/entities/group/index.js';
import { isRtl, t } from '@/shared/i18n/index.js';
import { HamburgerMenu } from '@/shared/ui/hamburger-menu.js';
import { SelectField, ToggleSwitch } from '@/shared/ui/settings-controls.js';
import { SettingsGuard } from '@/shared/ui/SettingsGuard.js';
import { showToast } from '@/shared/ui/toast.js';
import { haptic } from '@/shared/lib/haptic.js';

export const GroupDynamicBioPage: Component = () => {
	const params = useParams();
	const navigate = useNavigate();
	const [isMenuOpen, setIsMenuOpen] = createSignal(false);
	const [bioTemplate, setBioTemplate] = createSignal('');
	const [nameTemplate, setNameTemplate] = createSignal('');
	const [currentBio, setCurrentBio] = createSignal('');
	const [currentName, setCurrentName] = createSignal('');

	const [interval, setIntervalVal] = createSignal('10m');
	const [enabled, setEnabled] = createSignal(false);
	const [displayInName, setDisplayInName] = createSignal(false);

	const [isSaving, setIsSaving] = createSignal(false);
	const [isDirty, setIsDirty] = createSignal(false);
	const [showUnsavedSheet, setShowUnsavedSheet] = createSignal(false);
	const [settingsVersion, setSettingsVersion] = createSignal(1);

	const [initialState, setInitialState] = createSignal({
		enabled: false,
		bioTemplate: '',
		displayInName: false,
		nameTemplate: '',
		interval: '10m',
	});

	const [settings, { mutate }] = createResource(
		() => params.id,
		async (id) => {
			const s = await groupApi.getSettings(id);
			setSettingsVersion(s.version);
			return s;
		},
	);

	const [tgInfo] = createResource(() => params.id, (id) => groupApi.getGroupTelegramInfo(id));
	const [_group] = createResource(() => params.id, (id) => groupApi.getGroup(id));

	createEffect(() => {
		const data = settings();
		if (data) {
			try {
				let dbio = (data as any).dynamic_bio;
				if (typeof dbio === 'string') {
					dbio = JSON.parse(dbio);
				}
				const init = {
					enabled: !!dbio?.enabled,
					bioTemplate: String(dbio?.bioTemplate || ''),
					displayInName: !!dbio?.displayInName,
					nameTemplate: String(dbio?.nameTemplate || ''),
					interval: String(dbio?.interval || '10m'),
				};
				setInitialState(init);
				setEnabled(init.enabled);
				setBioTemplate(init.bioTemplate);
				setDisplayInName(init.displayInName);
				setNameTemplate(init.nameTemplate);
				setIntervalVal(init.interval);
				setIsDirty(false);

				let general = data.general;
				if (typeof general === 'string') {
					general = JSON.parse(general);
				}
				if (general && typeof general === 'object') {
					const genObj = general as Record<string, any>;
					if ('description' in genObj) setCurrentBio(String(genObj.description || ''));
					if ('name' in genObj) setCurrentName(String(genObj.name || ''));
				}
			} catch (e) {
				console.error('Failed to parse settings:', e);
			}
		}
	});

	const checkDirty = () => {
		const init = initialState();
		const dirty =
			enabled() !== init.enabled ||
			bioTemplate() !== init.bioTemplate ||
			displayInName() !== init.displayInName ||
			nameTemplate() !== init.nameTemplate ||
			interval() !== init.interval;
		setIsDirty(dirty);
	};

	const setBioAndDirty = (v: string) => {
		setBioTemplate(v);
		checkDirty();
	};

	const setNameAndDirty = (v: string) => {
		setNameTemplate(v);
		checkDirty();
	};

	const setEnabledAndDirty = (v: boolean) => {
		setEnabled(v);
		checkDirty();
	};

	const setDisplayInNameAndDirty = (v: boolean) => {
		setDisplayInName(v);
		checkDirty();
	};

	const setIntervalAndDirty = (v: string) => {
		setIntervalVal(v);
		checkDirty();
	};

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

	const variables = () => [
		{ tag: '$members', desc: t('channelDynamicBio.varMembers'), val: '45,102' },
		{ tag: '$Gram', desc: t('channelDynamicBio.varGram'), val: '$5.50' },
		{ tag: '$time', desc: t('channelDynamicBio.varTime'), val: '14:30' },
		{ tag: '$date', desc: t('channelDynamicBio.varDate'), val: '12 May 2026' },
		{ tag: '$day_name', desc: t('channelDynamicBio.varDayName'), val: 'Tuesday' },
	];

	const handleSave = async () => {
		if (!isDirty() || isSaving()) return;
		setIsSaving(true);

		const payload = {
			enabled: enabled(),
			bioTemplate: bioTemplate(),
			displayInName: displayInName(),
			nameTemplate: nameTemplate(),
			interval: interval(),
		};

		try {
			const res = await groupApi.updateSettings(
				params.id,
				'dynamic_bio',
				payload,
				settingsVersion(),
			);
			if (res?.version) setSettingsVersion(res.version);
			setInitialState(payload);
			setIsDirty(false);
			setShowUnsavedSheet(false);
			mutate((prev: any) => (prev ? { ...prev, dynamic_bio: payload } : { dynamic_bio: payload }));

			haptic.notify('success');
			showToast(t('common.settingsSaved'), 'success');
			navigate(`/group/${params.id}`);
		} catch (e) {
			console.error('Failed to save dynamic bio settings:', e);
			haptic.notify('error');
			showToast(t('common.saveFailed'), 'error');
		} finally {
			setIsSaving(false);
		}
	};

	const handleDiscard = () => {
		const init = initialState();
		setEnabled(init.enabled);
		setBioTemplate(init.bioTemplate);
		setDisplayInName(init.displayInName);
		setNameTemplate(init.nameTemplate);
		setIntervalVal(init.interval);
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

			{/* ═══════ STICKY HEADER ═══════ */}
			<div class="pt-6 pb-4 px-5 sticky top-0 bg-[#030303]/85 backdrop-blur-2xl z-40 border-b border-white/5 flex items-center justify-between gap-3 shadow-sm">
				<div class="flex items-center gap-3.5 overflow-hidden flex-1">
					<button
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
								{t('channelDynamicBio.title')}
							</h1>
							<Show when={isDirty()}>
								<span class="w-2 h-2 rounded-full bg-amber-400 animate-pulse shrink-0" />
							</Show>
						</div>
						<span class="text-[11px] text-white/50 font-bold uppercase tracking-wider leading-snug truncate mt-0.5">
							{t('channelDynamicBio.autoUpdates')}
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

			<HamburgerMenu
				isOpen={isMenuOpen()}
				onClose={() => setIsMenuOpen(false)}
				groupId={params.id}
				activeTab="dynamic-bio"
			/>

			<div class="p-5 flex flex-col gap-5 max-w-md mx-auto relative z-10 w-full">
				<Show
					when={!settings.loading}
					fallback={
						<div class="flex flex-col items-center justify-center py-20 gap-3">
							<span class="w-8 h-8 border-2 border-[#3390ec]/30 border-t-[#3390ec] rounded-full animate-spin" />
							<span class="text-[12px] font-bold text-white/40 uppercase tracking-widest">
								{t('common.loading')}
							</span>
						</div>
					}
				>
					{/* Proactive Permission Check Card */}
					<Show when={tgInfo() && tgInfo()?.can_change_info === false}>
						<div class="bg-amber-500/10 border border-amber-500/30 rounded-[20px] p-4 flex flex-col gap-2.5">
							<div class="flex items-center gap-2 text-amber-400">
								<span class="material-symbols-outlined text-[20px]">warning</span>
								<span class="text-[13px] font-bold">دسترسی تغییر اطلاعات گروه یافت نشد</span>
							</div>
							<p class="text-[11px] text-white/60 leading-relaxed font-medium">
								برای به‌روزرسانی خودکار بیوگرافی و نام، ربات باید دسترسی Change Group Info را در تلگرام داشته باشد.
							</p>
						</div>
					</Show>

					{/* ═══════ ENABLE MASTER TOGGLE ═══════ */}
					<div class="bg-[#12141C]/80 backdrop-blur-xl border border-white/5 rounded-[24px] p-5 shadow-sm relative overflow-hidden flex flex-col gap-4">
						<div class="flex items-center justify-between gap-3">
							<div class="flex flex-col">
								<h3 class="text-[15px] font-black text-white tracking-tight">
									{t('channelDynamicBio.enabled')}
								</h3>
								<p class="text-[11px] text-white/50 font-medium mt-0.5">
									{t('channelDynamicBio.enabledDesc')}
								</p>
							</div>
							<ToggleSwitch checked={enabled()} onChange={setEnabledAndDirty} />
						</div>

						<Show when={enabled()}>
							<div class="h-[1px] bg-white/5 w-full rounded-full my-1" />

							{/* ═══════ NAME TEMPLATE ═══════ */}
							<div class="flex flex-col gap-3">
								<div class="flex items-center justify-between">
									<div class="flex flex-col">
										<span class="text-[13px] font-bold text-white">
											{t('channelDynamicBio.displayInName')}
										</span>
										<span class="text-[11px] text-white/50">
											{t('channelDynamicBio.displayInNameDesc')}
										</span>
									</div>
									<ToggleSwitch checked={displayInName()} onChange={setDisplayInNameAndDirty} />
								</div>

								<Show when={displayInName()}>
									<div class="flex flex-col gap-1.5 mt-2">
										<div class="flex justify-between items-center px-1">
											<label class="text-[11px] font-bold text-white/50 uppercase tracking-wider">
												{t('channelDynamicBio.nameTemplate')}
											</label>
											<span class="text-[10px] font-mono text-white/40">
												{nameTemplate().length}/128
											</span>
										</div>
										<input
											type="text"
											value={nameTemplate()}
											onInput={(e) => setNameAndDirty(e.currentTarget.value)}
											placeholder={currentName() || 'Group Name | $members Members'}
											maxLength={128}
											class="w-full bg-[#08090D] border border-white/10 rounded-[14px] px-4 py-3 text-[13px] text-white focus:outline-none focus:border-[#3390ec]/50 transition-colors shadow-inner"
										/>
									</div>
								</Show>
							</div>

							<div class="h-[1px] bg-white/5 w-full rounded-full my-1" />

							{/* ═══════ BIO TEMPLATE ═══════ */}
							<div class="flex flex-col gap-2">
								<div class="flex justify-between items-center px-1">
									<label class="text-[11px] font-bold text-white/50 uppercase tracking-wider">
										{t('channelDynamicBio.bioTemplate')}
									</label>
									<span class="text-[10px] font-mono text-white/40">
										{bioTemplate().length}/255
									</span>
								</div>
								<textarea
									rows={4}
									value={bioTemplate()}
									onInput={(e) => setBioAndDirty(e.currentTarget.value)}
									placeholder={
										currentBio() ||
										'Welcome to our group! 🛡\nMembers: $members | Time: $time\nPrice: $Gram'
									}
									maxLength={255}
									class="w-full bg-[#08090D] border border-white/10 rounded-[16px] p-4 text-[13px] text-white focus:outline-none focus:border-[#3390ec]/50 transition-colors resize-none shadow-inner leading-relaxed"
								/>
							</div>

							{/* ═══════ VARIABLES INJECTOR ═══════ */}
							<div class="flex flex-col gap-2.5">
								<span class="text-[11px] font-bold text-white/50 uppercase tracking-wider px-1">
									{t('channelDynamicBio.availableVariables')}
								</span>
								<div class="grid grid-cols-2 gap-2">
									<For each={variables()}>
										{(v) => (
											<button
												type="button"
												onClick={() => {
													haptic.impact('light');
													if (bioTemplate().length + v.tag.length <= 255) {
														setBioAndDirty(`${bioTemplate()} ${v.tag}`);
													}
												}}
												class="bg-[#08090D] hover:bg-white/10 transition-all border border-white/5 hover:border-white/20 rounded-[14px] px-3 py-2 flex flex-col items-start active:scale-95 shadow-sm group"
											>
												<span class="text-[12px] font-black text-[#3390ec] font-mono group-hover:drop-shadow-[0_0_8px_rgba(51,144,236,0.5)]">
													{v.tag}
												</span>
												<span class="text-[10px] font-medium text-white/40 mt-0.5">{v.desc}</span>
											</button>
										)}
									</For>
								</div>
							</div>

							<div class="h-[1px] bg-white/5 w-full rounded-full my-1" />

							{/* ═══════ UPDATE INTERVAL ═══════ */}
							<SelectField
								label={t('channelDynamicBio.updateInterval')}
								value={interval()}
								onChange={setIntervalAndDirty}
								options={[
									{ value: '10m', label: t('channelDynamicBio.interval10m') },
									{ value: '30m', label: t('channelDynamicBio.interval30m') },
									{ value: '1h', label: t('channelDynamicBio.interval1h') },
									{ value: '24h', label: t('channelDynamicBio.interval24h') },
								]}
								description={t('channelDynamicBio.updateIntervalDesc')}
							/>
						</Show>
					</div>

					{/* ═══════ LIVE PREVIEW CARD ═══════ */}
					<Show when={enabled()}>
						<Motion.div
							initial={{ opacity: 0, y: 15 }}
							animate={{ opacity: 1, y: 0 }}
							transition={{ delay: 0.15 }}
							class="bg-gradient-to-br from-[#3390ec]/15 to-transparent rounded-[28px] border border-[#3390ec]/30 p-5 flex flex-col gap-4 relative overflow-hidden shadow-[inset_0_0_20px_rgba(51,144,236,0.05)]"
						>
							<div class="absolute -top-10 -right-10 w-32 h-32 bg-[#3390ec]/20 rounded-full blur-3xl pointer-events-none" />

							<div class="flex items-center gap-2 relative z-10">
								<div class="w-8 h-8 rounded-[10px] bg-[#3390ec]/20 flex items-center justify-center border border-[#3390ec]/40 shadow-inner">
									<span class="material-symbols-outlined text-[16px] text-[#3390ec]">
										visibility
									</span>
								</div>
								<span class="text-[12px] font-black uppercase tracking-widest text-[#3390ec]">
									{t('channelDynamicBio.preview')}
								</span>
							</div>

							<div class="bg-[#030303]/60 backdrop-blur-md rounded-[18px] p-4.5 border border-white/10 relative z-10 flex flex-col gap-2.5 shadow-sm">
								<Show when={displayInName() && nameTemplate()}>
									<div class="text-[16px] font-black text-white tracking-tight border-b border-white/5 pb-2">
										{nameTemplate()
											.replace(/\$members/g, '45,102')
											.replace(/\$time/g, '14:30')
											.replace(/\$date/g, '12 May 2026')
											.replace(/\$day_name/g, 'Tuesday')
											.replace(/\$Gram/g, '$5.50')}
									</div>
								</Show>
								<p class="text-[13px] text-white/70 font-medium leading-relaxed">
									{bioTemplate()
										.replace(/\$members/g, '45,102')
										.replace(/\$time/g, '14:30')
										.replace(/\$date/g, '12 May 2026')
										.replace(/\$day_name/g, 'Tuesday')
										.replace(/\$Gram/g, '$5.50') || (
										<span class="text-white/30 italic">No bio written yet...</span>
									)}
								</p>
							</div>
						</Motion.div>
					</Show>
				</Show>
			</div>

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

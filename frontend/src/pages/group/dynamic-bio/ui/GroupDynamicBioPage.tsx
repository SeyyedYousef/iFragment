import { Motion } from '@motionone/solid';
import { useNavigate, useParams } from '@solidjs/router';
import { backButton, hapticFeedback } from '@tma.js/sdk-solid';
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
import { groupApi } from '@/shared/api/bot-management.js';
import { isRtl, t } from '@/shared/i18n/index.js';
import { HamburgerMenu } from '@/shared/ui/hamburger-menu.js';
import { SelectField, ToggleSwitch } from '@/shared/ui/settings-controls.js';
import { showToast } from '@/shared/ui/toast.js';

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
	const [settingsVersion, setSettingsVersion] = createSignal(1);

	const [settings, { mutate }] = createResource(
		() => params.id,
		async (id) => {
			const s = await groupApi.getSettings(id);
			setSettingsVersion(s.version);
			return s;
		},
	);

	createEffect(() => {
		const data = settings();
		if (data) {
			try {
				let dbio = data.dynamic_bio;
				if (typeof dbio === 'string') {
					dbio = JSON.parse(dbio);
				}
				if (dbio && typeof dbio === 'object') {
					const obj = dbio as Record<string, any>;
					if ('enabled' in obj) setEnabled(!!obj.enabled);
					if ('bioTemplate' in obj) setBioTemplate(String(obj.bioTemplate || ''));
					if ('displayInName' in obj) setDisplayInName(!!obj.displayInName);
					if ('nameTemplate' in obj) setNameTemplate(String(obj.nameTemplate || ''));
					if ('interval' in obj) setIntervalVal(String(obj.interval || ''));
				}

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

	const variables = () => [
		{ tag: '$members', desc: t('channelDynamicBio.varMembers'), val: '45,102' },
		{ tag: '$Gram', desc: t('channelDynamicBio.varGram'), val: '$5.50' },
		{ tag: '$time', desc: t('channelDynamicBio.varTime'), val: '14:30' },
		{ tag: '$date', desc: t('channelDynamicBio.varDate'), val: '12 May 2026' },
		{ tag: '$day_name', desc: t('channelDynamicBio.varDayName'), val: 'Tuesday' },
	];

	const handleSave = async () => {
		try { hapticFeedback.impactOccurred('medium'); } catch (_) {}
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
			mutate((prev: any) => (prev ? { ...prev, dynamic_bio: payload } : { dynamic_bio: payload }));

			try { hapticFeedback.notificationOccurred('success'); } catch (_) {}
			showToast(t('common.settingsSaved'), 'success');
			navigate(`/group/${params.id}`);
		} catch (e) {
			console.error('Failed to save dynamic bio settings:', e);
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
			navigate(`/group/${params.id}`);
		});
		onCleanup(() => off());
	});

	return (
		<div class="min-h-screen bg-[#030303] pb-28 relative overflow-x-hidden text-white font-sans selection:bg-[#3390ec]/30" dir={isRtl() ? 'rtl' : 'ltr'}>
			
			{/* Ambient Top Glow */}
			<div class="absolute top-0 left-0 right-0 h-[350px] bg-gradient-to-b from-[#3390ec]/15 via-[#3390ec]/5 to-transparent blur-[80px] pointer-events-none z-0" />

			{/* ═══════ PREMIUM STICKY HEADER ═══════ */}
			<div class="pt-6 pb-4 px-5 sticky top-0 bg-[#030303]/85 backdrop-blur-2xl z-40 border-b border-white/5 flex items-center justify-between gap-3 shadow-sm">
				<div class="flex items-center gap-3.5 overflow-hidden flex-1">
					<button
						onClick={() => { try { hapticFeedback.impactOccurred('light'); } catch (_) {} navigate(`/group/${params.id}`); }}
						class="w-11 h-11 rounded-[14px] bg-[#12141C]/80 flex items-center justify-center border border-white/10 hover:bg-white/10 active:scale-95 transition-all shrink-0 shadow-sm"
						aria-label={t('common.back')}
					>
						<span class="material-symbols-outlined text-white/80 text-[22px] rtl:-scale-x-100">arrow_back</span>
					</button>
					<div class="flex flex-col overflow-hidden">
						<h1 class="text-[18px] font-black text-white leading-tight truncate tracking-tight">
							{t('channelDynamicBio.title')}
						</h1>
						<span class="text-[11px] text-white/50 font-bold uppercase tracking-wider leading-snug truncate mt-0.5">
							{t('channelDynamicBio.subtitle')}
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

			<div class="p-5 flex flex-col gap-4 max-w-md mx-auto relative z-10 w-full">
				
				<Show when={settings.loading}>
					<div class="flex flex-col gap-4 animate-pulse">
						<div class="h-48 bg-[#12141C]/50 rounded-[24px] border border-white/5" />
						<div class="h-32 bg-[#12141C]/50 rounded-[24px] border border-white/5" />
					</div>
				</Show>

				<Show when={settings.error}>
					<div class="bg-[#ff4a4a]/10 backdrop-blur-md rounded-[24px] border border-[#ff4a4a]/20 p-6 flex flex-col gap-3 items-center text-center shadow-sm">
						<span class="material-symbols-outlined text-[42px] text-[#ff4a4a] drop-shadow-md">error</span>
						<div class="flex flex-col gap-1">
							<span class="text-[15px] font-black text-white tracking-tight">{t('common.errors.generic')}</span>
							<span class="text-[12px] font-medium text-white/60 leading-relaxed">
								{t('common.errors.generic')}
							</span>
						</div>
					</div>
				</Show>

				<Show when={settings()}>
					<Motion.div
						initial={{ opacity: 0, y: 15 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ delay: 0.05 }}
						class="bg-[#12141C]/80 backdrop-blur-xl rounded-[28px] border border-white/5 p-5 flex flex-col gap-5 shadow-sm"
					>
						{/* Header Toggle */}
						<div class="flex items-center justify-between gap-3">
							<div class="flex flex-col flex-1 min-w-0">
								<span class="text-[15px] font-black text-white tracking-tight">
									{t('channelDynamicBio.title')}
								</span>
								<span class="text-[11px] font-medium text-white/50 mt-0.5">
									{t('channelDynamicBio.subtitle2')}
								</span>
							</div>
							<ToggleSwitch checked={enabled()} onChange={(v) => { try { hapticFeedback.impactOccurred('light'); } catch (_) {} setEnabled(v); }} />
						</div>

						{/* Guide Banner */}
						<Show when={!enabled()}>
							<div class="bg-[#3390ec]/10 border border-[#3390ec]/20 rounded-[16px] p-4 flex flex-col gap-2 shadow-inner">
								<span class="text-[13px] font-black text-[#3390ec] flex items-center gap-1.5">
									<span class="material-symbols-outlined text-[18px]">info</span>
									{t('channelDynamicBio.guideTitleGroup')}
								</span>
								<p class="text-[12px] font-medium text-white/70 leading-relaxed pl-6">
									{t('channelDynamicBio.guideDescGroup')}
								</p>
							</div>
						</Show>

						<Show when={enabled()}>
							<div class="h-[1px] bg-white/5 w-full -my-1 rounded-full" />

							{/* ═══════ CURRENT STATUS (Server Log Style) ═══════ */}
							<div class="bg-[#08090D] p-4 rounded-[20px] border border-white/5 flex flex-col gap-3 shadow-inner">
								<span class="text-[10px] font-black uppercase tracking-widest text-white/40 flex items-center gap-1.5">
									<span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_5px_#34d399]" />
									{t('channelDynamicBio.currentStatusTelegram')}
								</span>
								<div class="flex flex-col gap-2 border-t border-white/5 pt-2">
									<div class="flex flex-col gap-0.5">
										<span class="text-[10px] font-bold text-white/30 uppercase">{t('channelDynamicBio.currentNameLabel')}</span>
										<span class="text-[13px] font-bold text-white">{currentName() || t('common.loading')}</span>
									</div>
									<div class="flex flex-col gap-0.5">
										<span class="text-[10px] font-bold text-white/30 uppercase">{t('channelDynamicBio.currentBioLabel')}</span>
										<span class="text-[13px] font-medium text-white">{currentBio() || t('common.loading')}</span>
									</div>
								</div>
							</div>

							{/* ═══════ BIO TEMPLATE INPUT ═══════ */}
							<div class="flex flex-col gap-2">
								<label class="text-[12px] font-black text-white flex justify-between items-center uppercase tracking-wider px-1">
									<div class="flex items-center gap-1.5">
										<span class="material-symbols-outlined text-[16px] text-pink-400">format_quote</span>
										{t('channelDynamicBio.currentBio')}
									</div>
									<span class={`text-[10px] font-bold font-mono px-2 py-0.5 rounded-[6px] border ${bioTemplate().length > 255 ? 'bg-[#ff4a4a]/10 text-[#ff4a4a] border-[#ff4a4a]/20' : 'bg-white/5 text-white/40 border-white/10'}`}>
										{bioTemplate().length} / 255
									</span>
								</label>
								<textarea
									value={bioTemplate()}
									onInput={(e) => setBioTemplate(e.currentTarget.value)}
									class="bg-[#08090D] text-white text-[13px] font-medium leading-relaxed rounded-[18px] px-4 py-3.5 w-full min-h-[100px] focus:outline-none focus:ring-1 focus:ring-[#3390ec]/50 border border-white/5 transition-all resize-none placeholder-white/20 shadow-inner"
									placeholder="Official Group | Members: $members"
									maxLength={255}
								/>
							</div>

							{/* ═══════ NAME TEMPLATE INPUT ═══════ */}
							<div class="bg-[#08090D] p-4 rounded-[20px] border border-white/5 flex flex-col gap-4 shadow-inner">
								<div class="flex items-center justify-between">
									<div class="flex flex-col flex-1 min-w-0">
										<span class="text-[13px] font-bold text-white tracking-tight">{t('channelDynamicBio.displayInName')}</span>
										<span class="text-[11px] font-medium text-white/50 mt-0.5">{t('channelDynamicBio.displayInNameDesc')}</span>
									</div>
									<ToggleSwitch checked={displayInName()} onChange={(v) => { try { hapticFeedback.impactOccurred('light'); } catch (_) {} setDisplayInName(v); }} />
								</div>

								<Show when={displayInName()}>
									<div class="border-t border-white/5 pt-3">
										<input
											type="text"
											value={nameTemplate()}
											onInput={(e) => setNameTemplate(e.currentTarget.value)}
											placeholder="iFragment Chat $time"
											class="w-full bg-[#12141C] text-white text-[13px] font-bold rounded-[14px] px-4 py-3 border border-white/5 focus:outline-none focus:border-[#3390ec]/50 transition-colors placeholder-white/20 shadow-inner"
											maxLength={128}
										/>
									</div>
								</Show>
							</div>

							{/* ═══════ DYNAMIC VARIABLES ═══════ */}
							<div class="flex flex-col gap-2 mt-1">
								<span class="text-[11px] font-black uppercase tracking-widest text-white/40 px-1 flex items-center gap-1.5">
									<span class="material-symbols-outlined text-[16px] text-amber-400">data_object</span>
									{t('channelDynamicBio.variables')}
								</span>
								<div class="flex flex-wrap gap-2 pt-1">
									<For each={variables()}>
										{(v) => (
											<button
												onClick={() => {
													try { hapticFeedback.impactOccurred('light'); } catch (_) {}
													if (bioTemplate().length + v.tag.length <= 255) {
														setBioTemplate(`${bioTemplate()} ${v.tag}`);
													}
												}}
												class="bg-[#08090D] hover:bg-white/10 transition-all border border-white/5 hover:border-white/20 rounded-[14px] px-3 py-2 flex flex-col items-start active:scale-95 shadow-sm group"
											>
												<span class="text-[12px] font-black text-[#3390ec] font-mono group-hover:drop-shadow-[0_0_8px_rgba(51,144,236,0.5)]">{v.tag}</span>
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
								onChange={setIntervalVal}
								options={[
									{ value: '10m', label: t('channelDynamicBio.interval10m') },
									{ value: '30m', label: t('channelDynamicBio.interval30m') },
									{ value: '1h', label: t('channelDynamicBio.interval1h') },
									{ value: '24h', label: t('channelDynamicBio.interval24h') },
								]}
								description={t('channelDynamicBio.updateIntervalDesc')}
							/>
						</Show>
					</Motion.div>

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
									<span class="material-symbols-outlined text-[16px] text-[#3390ec]">visibility</span>
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
											.replace(/\$btc/g, '$64,200')
											.replace(/\$Gram/g, '$5.50')}
									</div>
								</Show>
								<p class="text-[13px] text-white/70 font-medium leading-relaxed">
									{bioTemplate()
										.replace(/\$members/g, '45,102')
										.replace(/\$time/g, '14:30')
										.replace(/\$date/g, '12 May 2026')
										.replace(/\$day_name/g, 'Tuesday')
										.replace(/\$btc/g, '$64,200')
										.replace(/\$Gram/g, '$5.50') || <span class="text-white/30 italic">No bio written yet...</span>}
								</p>
							</div>
						</Motion.div>
					</Show>
				</Show>
			</div>

			{/* ═══════ FLOATING SAVE BUTTON ═══════ */}
			<div class="fixed bottom-0 left-0 right-0 p-5 bg-gradient-to-t from-[#030303] via-[#030303]/90 to-transparent z-40 pointer-events-none">
				<div class="max-w-md mx-auto pointer-events-auto">
					<button
						onClick={handleSave}
						disabled={isSaving()}
						class="w-full h-14 bg-gradient-to-r from-[#3390ec] to-[#2b7ec9] hover:from-[#2b7ec9] hover:to-[#3390ec] text-white rounded-[16px] font-black text-[14px] uppercase tracking-widest shadow-[0_10px_30px_rgba(51,144,236,0.35)] transition-all flex items-center justify-center gap-2 disabled:opacity-40 disabled:scale-100 active:scale-95 border border-white/10"
					>
						<Show
							when={!isSaving()}
							fallback={<span class="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
						>
							{t('common.save')}
							<span class="material-symbols-outlined text-[22px]">save</span>
						</Show>
					</button>
				</div>
			</div>
		</div>
	);
};

import { Motion } from '@motionone/solid';
import { useNavigate, useParams } from '@solidjs/router';
import { backButton, hapticFeedback } from '@tma.js/sdk-solid';
import {
	Component,
	createEffect,
	createSignal,
	For,
	onCleanup,
	onMount,
	Show,
} from 'solid-js';
import { channelApi } from '@/shared/api/channel-management.js';
import { useChannelSettings, useUpdateChannelSettings } from '@/shared/api/queries.js';
import { isRtl, t } from '@/shared/i18n/index.js';
import { ChannelContextBar } from '@/shared/ui/ChannelContextBar.js';
import { ChannelHamburgerMenu } from '@/shared/ui/channel-hamburger-menu.js';
import { SelectField, ToggleSwitch } from '@/shared/ui/settings-controls.js';
import { showToast } from '@/shared/ui/toast.js';

export const ChannelDynamicBioPage: Component = () => {
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

	const [telegramInfo, setTelegramInfo] = createSignal<any>(null);

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

	onMount(async () => {
		backButton.show();
		const off = backButton.onClick(() => {
			try { hapticFeedback.impactOccurred('light'); } catch (_) {}
			navigate(`/channel/${params.id}`);
		});

		try {
			const info = await channelApi.getTelegramInfo(params.id!);
			if (info) setTelegramInfo(info);
		} catch (e) {
			console.error('Failed to fetch telegram info:', e);
		}

		onCleanup(() => {
			off();
			backButton.hide();
		});
	});

	const variables = [
		{ tag: '$members', desc: t('channelDynamicBio.varMembers'), val: '45,102' },
		{ tag: '$Gram', desc: t('channelDynamicBio.varGram'), val: '$5.50' },
		{ tag: '$time', desc: t('channelDynamicBio.varTime'), val: '14:30' },
		{ tag: '$date', desc: t('channelDynamicBio.varDate'), val: '12 May 2026' },
		{ tag: '$day_name', desc: t('channelDynamicBio.varDayNameEn'), val: 'Tuesday' },
	];

	const handleSave = async () => {
		try { hapticFeedback.impactOccurred('medium'); } catch (_) {}
		setIsSaving(true);

		const currentVersion = settingsQuery.data?.version ?? 1;
		const payload = {
			enabled: enabled(),
			bioTemplate: bioTemplate(),
			displayInName: displayInName(),
			nameTemplate: nameTemplate(),
			interval: interval(),
		};

		try {
			await updateSettingsMutation.mutateAsync({
				category: 'dynamic_bio',
				data: payload,
				version: currentVersion,
			});
			try { hapticFeedback.notificationOccurred('success'); } catch (_) {}
			showToast(t('common.settingsSaved'), 'success');
			navigate(`/channel/${params.id}`);
		} catch (e) {
			console.error('Failed to save dynamic bio settings:', e);
			try { hapticFeedback.notificationOccurred('error'); } catch (_) {}
			showToast(t('common.saveFailed'), 'error');
		} finally {
			setIsSaving(false);
		}
	};

	return (
		<div class="min-h-screen bg-[#030303] pb-28 relative overflow-x-hidden text-white font-sans selection:bg-[#3390ec]/30" dir={isRtl() ? 'rtl' : 'ltr'}>
			
			{/* Ambient Top Glow */}
			<div class="absolute top-0 left-0 right-0 h-[350px] bg-gradient-to-b from-[#3390ec]/15 via-transparent to-transparent blur-[80px] pointer-events-none z-0" />

			{/* ═══════ PREMIUM STICKY HEADER ═══════ */}
			<div class="pt-6 pb-4 px-5 sticky top-0 bg-[#030303]/85 backdrop-blur-2xl z-40 border-b border-white/5 flex items-center justify-between gap-3 shadow-sm">
				<div class="flex items-center gap-3.5 overflow-hidden flex-1">
					<button
						onClick={() => { try { hapticFeedback.impactOccurred('light'); } catch (_) {} navigate(`/channel/${params.id}`); }}
						class="w-11 h-11 rounded-[14px] bg-[#12141C]/80 flex items-center justify-center border border-white/10 hover:bg-white/10 active:scale-95 transition-all shrink-0 shadow-sm text-white/80"
						aria-label={t('common.back')}
					>
						<span class="material-symbols-outlined text-[22px] rtl:-scale-x-100">arrow_back</span>
					</button>
					<div class="flex flex-col overflow-hidden">
						<h1 class="text-[18px] font-black text-white leading-tight truncate tracking-tight">
							{t('channelDynamicBio.title')}
						</h1>
						<span class="text-[11px] text-white/50 font-bold uppercase tracking-wider truncate mt-0.5">
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

			<ChannelHamburgerMenu isOpen={isMenuOpen()} onClose={() => setIsMenuOpen(false)} channelId={params.id} activeTab="dynamic-bio" />

			<div class="px-5 pt-5 flex flex-col gap-4 max-w-md mx-auto relative z-10 w-full pb-10">
				
				<ChannelContextBar channelId={params.id} />

				<Show when={settingsQuery.isLoading}>
					<div class="flex flex-col gap-4 animate-pulse mt-2">
						<div class="h-40 bg-[#12141C]/50 rounded-[24px] border border-white/5"></div>
						<div class="h-32 bg-[#12141C]/50 rounded-[24px] border border-white/5"></div>
					</div>
				</Show>

				<Show when={settingsQuery.isError}>
					<div class="bg-[#ff4a4a]/10 backdrop-blur-md rounded-[24px] border border-[#ff4a4a]/20 p-6 flex flex-col gap-3 items-center text-center shadow-sm mt-2">
						<span class="material-symbols-outlined text-[42px] text-[#ff4a4a] drop-shadow-md">error</span>
						<div class="flex flex-col gap-1">
							<span class="text-[15px] font-black text-white tracking-tight">{t('common.errorUpdateFailed')}</span>
							<span class="text-[12px] font-medium text-white/60 leading-relaxed">
								{t('common.errors.generic')}
							</span>
						</div>
						<button onClick={() => settingsQuery.refetch()} class="px-6 py-3 bg-[#ff4a4a] hover:bg-[#ff3b30] text-white rounded-[14px] font-black uppercase tracking-widest text-[11px] shadow-[0_4px_15px_rgba(255,74,74,0.3)] active:scale-95 transition-all mt-2">
							{t('common.retry')}
						</button>
					</div>
				</Show>

				<Show when={settingsQuery.data}>
					<Motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} class="bg-[#12141C]/80 backdrop-blur-xl rounded-[28px] border border-white/5 p-5 flex flex-col gap-5 shadow-sm relative overflow-hidden">
						
						{/* ═══════ ENGINE TOGGLE ═══════ */}
						<div class="flex items-center justify-between gap-3 relative z-10 border-b border-white/5 pb-3">
							<div class="flex flex-col flex-1 min-w-0 gap-0.5">
								<span class="text-[15px] font-black text-white tracking-tight flex items-center gap-2">
									<span class="material-symbols-outlined text-[#3390ec] text-[20px]">smart_toy</span>
									{t('channelDynamicBio.title')}
								</span>
								<span class="text-[11px] font-medium text-white/50">
									{t('channelDynamicBio.subtitle2')}
								</span>
							</div>
							<ToggleSwitch checked={enabled()} onChange={(v) => { try { hapticFeedback.impactOccurred('light'); } catch (_) {} setEnabled(v); }} />
						</div>

						<Show when={!enabled()}>
							<div class="bg-[#3390ec]/10 border border-[#3390ec]/20 rounded-[16px] p-4 flex flex-col gap-2 shadow-inner">
								<span class="text-[13px] font-black text-[#3390ec] flex items-center gap-1.5">
									<span class="material-symbols-outlined text-[18px]">info</span>
									{t('channelDynamicBio.guideTitle')}
								</span>
								<p class="text-[12px] font-medium text-white/70 leading-relaxed pl-6">
									{t('channelDynamicBio.guideDesc')}
								</p>
							</div>
						</Show>

						<Show when={enabled()}>
							
							{/* ═══════ CURRENT TELEGRAM STATUS ═══════ */}
							<div class="bg-[#08090D] p-4 rounded-[20px] border border-white/5 flex flex-col gap-3 shadow-inner">
								<span class="text-[10px] font-black uppercase tracking-widest text-white/40 flex items-center gap-1.5">
									<span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_5px_#34d399]" />
									{t('channelDynamicBio.currentStatus')}
								</span>
								<div class="flex flex-col gap-2 border-t border-white/5 pt-2">
									<div class="flex flex-col gap-0.5">
										<span class="text-[10px] font-bold text-white/30 uppercase">{t('channelDynamicBio.currentName')}</span>
										<span class="text-[13px] font-bold text-white">
											{telegramInfo()?.title || currentName() || t('channelDynamicBio.fetching')}
										</span>
									</div>
									<div class="flex flex-col gap-0.5 mt-1">
										<span class="text-[10px] font-bold text-white/30 uppercase">{t('channelDynamicBio.currentBioReal')}</span>
										<span class="text-[13px] font-medium text-white leading-relaxed">
											{telegramInfo()?.description || currentBio() || t('channelDynamicBio.fetching')}
										</span>
									</div>
								</div>
							</div>

							{/* ═══════ BIO INPUT ═══════ */}
							<div class="flex flex-col gap-2 mt-1">
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
									value={bioTemplate()} onInput={(e) => setBioTemplate(e.currentTarget.value)}
									placeholder="Official Channel | Members: $members" maxLength={255}
									class="bg-[#08090D] border border-white/5 text-white text-[13px] font-medium leading-relaxed rounded-[18px] px-4 py-3.5 w-full min-h-[100px] focus:outline-none focus:border-[#3390ec]/50 transition-all resize-none placeholder-white/20 shadow-inner"
								/>
							</div>

							{/* ═══════ DISPLAY IN NAME ═══════ */}
							<div class="bg-[#08090D] p-4 rounded-[20px] border border-white/5 flex flex-col gap-4 shadow-inner mt-1">
								<div class="flex items-center justify-between">
									<div class="flex flex-col flex-1 min-w-0">
										<span class="text-[13px] font-bold text-white tracking-tight">{t('channelDynamicBio.displayName')}</span>
										<span class="text-[11px] font-medium text-white/50 mt-0.5">{t('channelDynamicBio.displayInNameDesc')}</span>
									</div>
									<ToggleSwitch checked={displayInName()} onChange={(v) => { try { hapticFeedback.impactOccurred('light'); } catch (_) {} setDisplayInName(v); }} />
								</div>

								<Show when={displayInName()}>
									<div class="border-t border-white/5 pt-3">
										<input
											type="text" value={nameTemplate()} onInput={(e) => setNameTemplate(e.currentTarget.value)}
											placeholder="iFragment News $time" maxLength={128}
											class="w-full h-12 bg-[#12141C] text-white text-[13px] font-bold rounded-[14px] px-4 border border-white/5 focus:outline-none focus:border-[#3390ec]/50 transition-colors placeholder-white/20 shadow-inner"
										/>
									</div>
								</Show>
							</div>

							{/* ═══════ DYNAMIC VARIABLES ═══════ */}
							<div class="flex flex-col gap-2 mt-2">
								<span class="text-[11px] font-black uppercase tracking-widest text-white/40 px-1 flex items-center gap-1.5">
									<span class="material-symbols-outlined text-[16px] text-amber-400">data_object</span>
									{t('channelDynamicBio.variables')}
								</span>
								<div class="flex flex-wrap gap-2 pt-1">
									<For each={variables}>
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

							<div class="h-[1px] bg-white/5 w-full rounded-full my-2" />

							{/* ═══════ UPDATE INTERVAL ═══════ */}
							<div class="bg-[#08090D] rounded-[16px] border border-white/5 p-1.5 shadow-inner">
								<SelectField
									label={t('channelDynamicBio.updateInterval')}
									value={interval()}
									onChange={(v) => { try { hapticFeedback.selectionChanged(); } catch (_) {} setIntervalVal(v); }}
									options={[
										{ value: '10m', label: t('channelDynamicBio.interval10m') },
										{ value: '30m', label: t('channelDynamicBio.interval30m') },
										{ value: '1h', label: t('channelDynamicBio.interval1h') },
										{ value: '24h', label: t('channelDynamicBio.interval24h') },
									]}
								/>
							</div>
						</Show>
					</Motion.div>

					{/* ═══════ LIVE PREVIEW CARD ═══════ */}
					<Show when={enabled()}>
						<Motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} class="bg-gradient-to-br from-[#3390ec]/15 to-transparent rounded-[28px] border border-[#3390ec]/30 p-5 flex flex-col gap-4 relative overflow-hidden shadow-[inset_0_0_20px_rgba(51,144,236,0.05)] mt-1">
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
										.replace(/\$Gram/g, '$5.50') || <span class="text-white/30 italic">{t('channelDynamicBio.noBioWritten')}</span>}
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
						onClick={handleSave} disabled={isSaving()}
						class="w-full h-14 bg-gradient-to-r from-[#3390ec] to-[#2b7ec9] hover:from-[#2b7ec9] hover:to-[#3390ec] text-white rounded-[16px] font-black text-[14px] uppercase tracking-widest shadow-[0_10px_30px_rgba(51,144,236,0.35)] transition-all flex items-center justify-center gap-2 disabled:opacity-40 disabled:scale-100 active:scale-95 border border-white/10"
					>
						<Show when={!isSaving()} fallback={<span class="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />}>
							{t('common.save')}
							<span class="material-symbols-outlined text-[22px]">save</span>
						</Show>
					</button>
				</div>
			</div>
		</div>
	);
};

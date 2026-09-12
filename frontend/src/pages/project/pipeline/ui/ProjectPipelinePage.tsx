import { useNavigate, useParams, useSearchParams } from '@solidjs/router';
import { backButton } from '@tma.js/sdk-solid';
import {
	type Component,
	createEffect,
	createResource,
	createSignal,
	For,
	onCleanup,
	onMount,
	Show,
} from 'solid-js';
import { channelApi } from '@/entities/channel/index.js';
import { isRtl, t } from '@/shared/i18n/index.js';
import { haptic } from '@/shared/lib/haptic.js';
import { showToast } from '@/shared/ui/index.js';
import { ProjectContextBar, ProjectHamburgerMenu } from '@/widgets/project/index.js';

interface AutoResponderRule {
	id: string;
	keys: string;
	replyText: string;
	match: 'keyword' | 'exact' | 'contains' | 'regex' | 'ai';
	useAi: boolean;
	enabled: boolean;
}

interface InlineButtonItem {
	title: string;
	value: string;
	type: 'url' | 'webapp' | 'copy';
}

const VALID_TABS = ['pipeline', 'ai', 'bio', 'responder', 'buttons', 'join'] as const;
type TabSection = (typeof VALID_TABS)[number];

export const ProjectPipelinePage: Component = () => {
	const params = useParams<{ projectId: string }>();
	const [searchParams, setSearchParams] = useSearchParams();
	const navigate = useNavigate();

	const [isMenuOpen, setIsMenuOpen] = createSignal(false);
	const [isSaving, setIsSaving] = createSignal(false);

	const getInitialTab = (): TabSection => {
		const t = searchParams.tab;
		if (typeof t === 'string' && (VALID_TABS as readonly string[]).includes(t)) {
			return t as TabSection;
		}
		return 'pipeline';
	};

	const [activeSection, setActiveSection] = createSignal<TabSection>(getInitialTab());

	createEffect(() => {
		const t = searchParams.tab;
		if (typeof t === 'string' && (VALID_TABS as readonly string[]).includes(t)) {
			if (activeSection() !== t) {
				setActiveSection(t as TabSection);
			}
		}
	});

	const switchSection = (section: TabSection) => {
		haptic.impact('light');
		setActiveSection(section);
		setSearchParams({ tab: section });
	};

	const [project, { refetch }] = createResource(
		() => params.projectId,
		(id) => channelApi.getProject(id),
	);

	// 1. Pipeline & Transforms signals
	const [autoPublish, setAutoPublish] = createSignal(false);
	const [removeAds, setRemoveAds] = createSignal(true);
	const [removeLinks, setRemoveLinks] = createSignal(false);
	const [removeHashtags, setRemoveHashtags] = createSignal(false);
	const [dropMedia, setDropMedia] = createSignal(false);
	const [mode, setMode] = createSignal<'copy' | 'forward'>('copy');
	const [watermark, setWatermark] = createSignal('');

	// 2. AI Post Composer signals
	const [aiRewrite, setAiRewrite] = createSignal(false);
	const [aiProvider, setAiProvider] = createSignal('gemini');
	const [aiModel, setAiModel] = createSignal('gemini-3.8-flash');
	const [selectedSkill, setSelectedSkill] = createSignal('standard');
	const [customPrompt, setCustomPrompt] = createSignal('');

	// 3. Dynamic Bio & Title signals
	const [bioEnabled, setBioEnabled] = createSignal(false);
	const [bioTarget, setBioTarget] = createSignal<'input' | 'output'>('output');
	const [bioTemplate, setBioTemplate] = createSignal(
		'🔥 $time | $members',
	);
	const [bioDisplayInName, setBioDisplayInName] = createSignal(false);
	const [bioNameTemplate, setBioNameTemplate] = createSignal('');
	const [bioInterval, setBioInterval] = createSignal('10m');
	const [bioEnableCountdown, setBioEnableCountdown] = createSignal(false);
	const [bioEventName, setBioEventName] = createSignal('');
	const [bioTargetDate, setBioTargetDate] = createSignal('');

	// 4. Auto-Responder & First Comment signals
	const [arEnabled, setArEnabled] = createSignal(false);
	const [arTarget, setArTarget] = createSignal<'input' | 'output'>('output');
	const [arFirstComment, setArFirstComment] = createSignal(false);
	const [arCommentMode, setArCommentMode] = createSignal<'fixed' | 'rotating' | 'ai'>('ai');
	const [arFixedComment, setArFixedComment] = createSignal('');
	const [arRules, setArRules] = createSignal<AutoResponderRule[]>([
		{
			id: '1',
			keys: 'price,buy,help',
			replyText: 'Hello! Please contact our bot for support.',
			match: 'contains',
			useAi: false,
			enabled: true,
		},
	]);

	// 5. Inline Buttons signals
	const [btnEnabled, setBtnEnabled] = createSignal(false);
	const [btnTarget, setBtnTarget] = createSignal<'input' | 'output' | 'both'>('output');
	const [buttonsList, setButtonsList] = createSignal<InlineButtonItem[]>([
		{ title: '🔗 iFragment', value: 'https://t.me/iFragmentBot', type: 'url' },
	]);

	// 6. Join Requests signals
	const [jrEnabled, setJrEnabled] = createSignal(false);
	const [jrTarget, setJrTarget] = createSignal<'input' | 'output'>('input');
	const [jrAutoApprove, setJrAutoApprove] = createSignal(false);
	const [jrApprovePremium, setJrApprovePremium] = createSignal(false);
	const [jrApprovePhoto, setJrApprovePhoto] = createSignal(false);
	const [jrApproveAge, setJrApproveAge] = createSignal(false);
	const [jrWelcome, setJrWelcome] = createSignal(
		'',
	);

	createEffect(() => {
		const p = project();
		if (p && p.pipeline_config) {
			const cfg = p.pipeline_config as any;
			if (typeof cfg.auto_publish === 'boolean') setAutoPublish(cfg.auto_publish);
			if (typeof cfg.remove_ads === 'boolean') setRemoveAds(cfg.remove_ads);
			if (typeof cfg.remove_links === 'boolean') setRemoveLinks(cfg.remove_links);
			if (typeof cfg.remove_hashtags === 'boolean') setRemoveHashtags(cfg.remove_hashtags);
			if (typeof cfg.drop_media === 'boolean') setDropMedia(cfg.drop_media);
			if (cfg.mode === 'forward') setMode('forward');
			if (typeof cfg.watermark === 'string') setWatermark(cfg.watermark);

			// AI
			if (typeof cfg.ai_rewrite === 'boolean') setAiRewrite(cfg.ai_rewrite);
			if (cfg.ai_provider) setAiProvider(cfg.ai_provider);
			if (cfg.ai_model) setAiModel(cfg.ai_model);
			if (cfg.selected_skill) setSelectedSkill(cfg.selected_skill);
			if (typeof cfg.custom_prompt === 'string') setCustomPrompt(cfg.custom_prompt);

			// Dynamic Bio
			if (cfg.dynamic_bio) {
				const b = cfg.dynamic_bio;
				if (typeof b.enabled === 'boolean') setBioEnabled(b.enabled);
				if (b.target === 'input' || b.target === 'output') setBioTarget(b.target);
				if (b.bio_template) setBioTemplate(b.bio_template);
				if (typeof b.display_in_name === 'boolean') setBioDisplayInName(b.display_in_name);
				if (b.name_template) setBioNameTemplate(b.name_template);
				if (b.interval) setBioInterval(String(b.interval));
				if (typeof b.enable_countdown === 'boolean') setBioEnableCountdown(b.enable_countdown);
				if (b.event_name) setBioEventName(b.event_name);
				if (b.target_date) setBioTargetDate(b.target_date);
			}

			// Auto Responder
			if (cfg.auto_responder) {
				const ar = cfg.auto_responder;
				if (typeof ar.enabled === 'boolean') setArEnabled(ar.enabled);
				if (ar.target === 'input' || ar.target === 'output') setArTarget(ar.target);
				if (typeof ar.auto_first_comment === 'boolean') setArFirstComment(ar.auto_first_comment);
				if (ar.comment_mode) setArCommentMode(ar.comment_mode);
				if (ar.fixed_comment) setArFixedComment(ar.fixed_comment);
				if (Array.isArray(ar.rules) && ar.rules.length > 0) {
					setArRules(ar.rules);
				}
			}

			// Inline Buttons
			if (cfg.inline_buttons) {
				const bt = cfg.inline_buttons;
				if (typeof bt.enabled === 'boolean') setBtnEnabled(bt.enabled);
				if (bt.target === 'input' || bt.target === 'output' || bt.target === 'both') {
					setBtnTarget(bt.target);
				}
				if (Array.isArray(bt.buttons) && bt.buttons.length > 0) {
					setButtonsList(bt.buttons);
				}
			}

			// Join Requests
			if (cfg.join_requests) {
				const jr = cfg.join_requests;
				if (typeof jr.enabled === 'boolean') setJrEnabled(jr.enabled);
				if (jr.target === 'input' || jr.target === 'output') setJrTarget(jr.target);
				if (typeof jr.auto_approve === 'boolean') setJrAutoApprove(jr.auto_approve);
				if (typeof jr.approve_premium === 'boolean') setJrApprovePremium(jr.approve_premium);
				if (typeof jr.approve_profile_photo === 'boolean') setJrApprovePhoto(jr.approve_profile_photo);
				if (typeof jr.approve_account_age === 'boolean') setJrApproveAge(jr.approve_account_age);
				if (typeof jr.welcome_message === 'string') setJrWelcome(jr.welcome_message);
			}
		}
	});

	onMount(() => {
		try {
			if (backButton.isSupported() && backButton.mount.isAvailable()) {
				backButton.mount();
				backButton.show();
				backButton.onClick(() => {
					haptic.impact('light');
					navigate(`/projects/${params.projectId}`);
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

	const handleSave = async () => {
		setIsSaving(true);
		try {
			haptic.impact('medium');
			await channelApi.updateProject(params.projectId, {
				pipeline_config: {
					auto_publish: autoPublish(),
					remove_ads: removeAds(),
					remove_links: removeLinks(),
					remove_hashtags: removeHashtags(),
					drop_media: dropMedia(),
					mode: mode(),
					watermark: watermark().trim(),
					ai_rewrite: aiRewrite(),
					ai_provider: aiProvider(),
					ai_model: aiModel(),
					selected_skill: selectedSkill(),
					custom_prompt: customPrompt().trim(),
					dynamic_bio: {
						enabled: bioEnabled(),
						target: bioTarget(),
						bio_template: bioTemplate().trim(),
						display_in_name: bioDisplayInName(),
						name_template: bioNameTemplate().trim(),
						interval: bioInterval(),
						enable_countdown: bioEnableCountdown(),
						event_name: bioEventName().trim(),
						target_date: bioTargetDate().trim(),
					},
					auto_responder: {
						enabled: arEnabled(),
						target: arTarget(),
						auto_first_comment: arFirstComment(),
						comment_mode: arCommentMode(),
						fixed_comment: arFixedComment().trim(),
						rules: arRules(),
					},
					inline_buttons: {
						enabled: btnEnabled(),
						target: btnTarget(),
						buttons: buttonsList(),
					},
					join_requests: {
						enabled: jrEnabled(),
						target: jrTarget(),
						auto_approve: jrAutoApprove(),
						approve_premium: jrApprovePremium(),
						approve_profile_photo: jrApprovePhoto(),
						approve_account_age: jrApproveAge(),
						welcome_message: jrWelcome().trim(),
					},
				},
			});
			haptic.notify('success');
			showToast(t('channelProjects.common.savedSuccess'), 'success');
			refetch();
		} catch (err: any) {
			haptic.notify('error');
			showToast(t('channelProjects.common.saveError') + ': ' + (err?.message || ''), 'error');
		} finally {
			setIsSaving(false);
		}
	};

	const insertBioVar = (varName: string) => {
		setBioTemplate((prev) => prev + ' ' + varName);
		haptic.impact('light');
	};

	const addResponderRule = () => {
		const newRule: AutoResponderRule = {
			id: String(Date.now()),
			keys: '',
			replyText: '',
			match: 'contains',
			useAi: false,
			enabled: true,
		};
		setArRules((prev) => [...prev, newRule]);
		haptic.impact('light');
	};

	const removeResponderRule = (id: string) => {
		setArRules((prev) => prev.filter((r) => r.id !== id));
		haptic.impact('light');
	};

	const addInlineButton = () => {
		const newBtn: InlineButtonItem = {
			title: t('channelProjects.buttonsTab.newButtonDefault'),
			value: 'https://',
			type: 'url',
		};
		setButtonsList((prev) => [...prev, newBtn]);
		haptic.impact('light');
	};

	const removeInlineButton = (index: number) => {
		setButtonsList((prev) => prev.filter((_, i) => i !== index));
		haptic.impact('light');
	};

	return (
		<div
			class="min-h-screen bg-[#030303] pb-28 relative overflow-x-hidden text-white font-sans selection:bg-[#3390ec]/30"
			dir={isRtl() ? 'rtl' : 'ltr'}
		>
			{/* ═══════ STICKY HEADER ═══════ */}
			<div class="pt-6 pb-3 px-5 sticky top-0 bg-[#030303]/90 backdrop-blur-2xl z-30 border-b border-white/5 flex items-center justify-between shadow-sm">
				<div class="flex items-center gap-3 min-w-0">
					<button
						type="button"
						onClick={() => {
							haptic.impact('light');
							navigate(`/projects/${params.projectId}`);
						}}
						class="w-10 h-10 rounded-[12px] bg-[#12141C] flex items-center justify-center border border-white/10 text-white/80 active:scale-95"
					>
						<span class="material-symbols-outlined text-[20px] rtl:-scale-x-100">arrow_back</span>
					</button>
					<div class="flex flex-col min-w-0">
						<h1 class="text-[17px] font-black text-white leading-tight truncate">
							{t('channelProjects.pipelineTab.title')}
						</h1>
						<span class="text-[10px] font-bold text-[#3390ec] uppercase tracking-wider">
							{t('channelProjects.nav.pipeline')}
						</span>
					</div>
				</div>

				<button
					type="button"
					onClick={() => setIsMenuOpen(true)}
					class="w-10 h-10 rounded-[12px] bg-[#12141C] flex items-center justify-center border border-white/10 text-white"
				>
					<span class="material-symbols-outlined text-[22px]">menu</span>
				</button>
			</div>

			<div class="px-5 pt-3 flex flex-col gap-4 max-w-md mx-auto relative z-10 w-full">
				<ProjectContextBar projectId={params.projectId} compact={true} />

				{/* ═══════ HORIZONTAL FEATURE TABS ═══════ */}
				<div class="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1 pt-1 -mx-1 px-1">
					<button
						type="button"
						onClick={() => switchSection('pipeline')}
						class={`px-3.5 py-2 rounded-[14px] text-[11px] font-black whitespace-nowrap flex items-center gap-1.5 transition-all ${
							activeSection() === 'pipeline'
								? 'bg-[#3390ec] text-white shadow-md'
								: 'bg-[#12141C] text-white/60 border border-white/5'
						}`}
					>
						<span class="material-symbols-outlined text-[16px]">tune</span>
						<span>{t('channelProjects.tabs.pipeline')}</span>
					</button>

					<button
						type="button"
						onClick={() => switchSection('bio')}
						class={`px-3.5 py-2 rounded-[14px] text-[11px] font-black whitespace-nowrap flex items-center gap-1.5 transition-all ${
							activeSection() === 'bio'
								? 'bg-[#3390ec] text-white shadow-md'
								: 'bg-[#12141C] text-white/60 border border-white/5'
						}`}
					>
						<span class="material-symbols-outlined text-[16px]">badge</span>
						<span>{t('channelProjects.tabs.bio')}</span>
						<Show when={bioEnabled()}>
							<span class="w-2 h-2 rounded-full bg-emerald-400"></span>
						</Show>
					</button>

					<button
						type="button"
						onClick={() => switchSection('responder')}
						class={`px-3.5 py-2 rounded-[14px] text-[11px] font-black whitespace-nowrap flex items-center gap-1.5 transition-all ${
							activeSection() === 'responder'
								? 'bg-[#3390ec] text-white shadow-md'
								: 'bg-[#12141C] text-white/60 border border-white/5'
						}`}
					>
						<span class="material-symbols-outlined text-[16px]">smart_toy</span>
						<span>{t('channelProjects.tabs.responder')}</span>
						<Show when={arEnabled()}>
							<span class="w-2 h-2 rounded-full bg-emerald-400"></span>
						</Show>
					</button>

					<button
						type="button"
						onClick={() => switchSection('buttons')}
						class={`px-3.5 py-2 rounded-[14px] text-[11px] font-black whitespace-nowrap flex items-center gap-1.5 transition-all ${
							activeSection() === 'buttons'
								? 'bg-[#3390ec] text-white shadow-md'
								: 'bg-[#12141C] text-white/60 border border-white/5'
						}`}
					>
						<span class="material-symbols-outlined text-[16px]">buttons_alt</span>
						<span>{t('channelProjects.tabs.buttons')}</span>
						<Show when={btnEnabled()}>
							<span class="w-2 h-2 rounded-full bg-emerald-400"></span>
						</Show>
					</button>

					<button
						type="button"
						onClick={() => switchSection('join')}
						class={`px-3.5 py-2 rounded-[14px] text-[11px] font-black whitespace-nowrap flex items-center gap-1.5 transition-all ${
							activeSection() === 'join'
								? 'bg-[#3390ec] text-white shadow-md'
								: 'bg-[#12141C] text-white/60 border border-white/5'
						}`}
					>
						<span class="material-symbols-outlined text-[16px]">how_to_reg</span>
						<span>{t('channelProjects.tabs.join')}</span>
						<Show when={jrEnabled()}>
							<span class="w-2 h-2 rounded-full bg-emerald-400"></span>
						</Show>
					</button>

					<button
						type="button"
						onClick={() => switchSection('ai')}
						class={`px-3.5 py-2 rounded-[14px] text-[11px] font-black whitespace-nowrap flex items-center gap-1.5 transition-all ${
							activeSection() === 'ai'
								? 'bg-[#3390ec] text-white shadow-md'
								: 'bg-[#12141C] text-white/60 border border-white/5'
						}`}
					>
						<span class="material-symbols-outlined text-[16px]">psychology</span>
						<span>{t('channelProjects.tabs.ai')}</span>
						<Show when={aiRewrite()}>
							<span class="w-2 h-2 rounded-full bg-emerald-400"></span>
						</Show>
					</button>
				</div>

				{/* ═══════ TAB 1: PIPELINE & TRANSFORMS ═══════ */}
				<Show when={activeSection() === 'pipeline'}>
					{/* Mode Selector */}
					<div class="bg-[#12141C] border border-white/10 rounded-[22px] p-4 flex flex-col gap-3">
						<span class="text-[13px] font-black text-white">{t('channelProjects.pipelineTab.transferMode')}</span>
						<div class="grid grid-cols-2 gap-2">
							<button
								type="button"
								onClick={() => setMode('copy')}
								class={`h-12 rounded-[16px] text-[12px] font-black flex items-center justify-center gap-1.5 transition-all ${
									mode() === 'copy'
										? 'bg-[#3390ec] text-white shadow-md'
										: 'bg-white/5 text-white/60 hover:bg-white/10'
								}`}
							>
								<span class="material-symbols-outlined text-[18px]">content_copy</span>
								<span>{t('channelProjects.pipelineTab.modeCopy')}</span>
							</button>

							<button
								type="button"
								onClick={() => setMode('forward')}
								class={`h-12 rounded-[16px] text-[12px] font-black flex items-center justify-center gap-1.5 transition-all ${
									mode() === 'forward'
										? 'bg-[#3390ec] text-white shadow-md'
										: 'bg-white/5 text-white/60 hover:bg-white/10'
								}`}
							>
								<span class="material-symbols-outlined text-[18px]">forward</span>
								<span>{t('channelProjects.pipelineTab.modeForward')}</span>
							</button>
						</div>
						<span class="text-[10px] text-white/40 leading-normal">
							{mode() === 'copy' ? t('channelProjects.pipelineTab.modeCopyDesc') : t('channelProjects.pipelineTab.modeForwardDesc')}
						</span>
					</div>

					{/* Switches Card */}
					<div class="bg-[#12141C] border border-white/10 rounded-[24px] p-4 flex flex-col gap-4">
						{/* Auto Publish */}
						<div class="flex items-center justify-between gap-3 pb-3 border-b border-white/5">
							<div class="flex flex-col">
								<span class="text-[13px] font-bold text-white">{t('channelProjects.pipelineTab.autoPublish')}</span>
								<span class="text-[10px] text-white/50">{t('channelProjects.pipelineTab.autoPublishDesc')}</span>
							</div>
							<button
								type="button"
								onClick={() => setAutoPublish(!autoPublish())}
								class={`w-12 h-6 rounded-full transition-colors relative ${
									autoPublish() ? 'bg-[#3390ec]' : 'bg-white/20'
								}`}
							>
								<span
									class={`w-5 h-5 rounded-full bg-white absolute top-0.5 transition-transform ${
										autoPublish() ? 'right-0.5' : 'right-6'
									}`}
								/>
							</button>
						</div>

						{/* Remove Ads */}
						<div class="flex items-center justify-between gap-3 pb-3 border-b border-white/5">
							<div class="flex flex-col">
								<span class="text-[13px] font-bold text-white">{t('channelProjects.pipelineTab.removeAds')}</span>
								<span class="text-[10px] text-white/50">{t('channelProjects.pipelineTab.removeAdsDesc')}</span>
							</div>
							<button
								type="button"
								onClick={() => setRemoveAds(!removeAds())}
								class={`w-12 h-6 rounded-full transition-colors relative ${
									removeAds() ? 'bg-emerald-500' : 'bg-white/20'
								}`}
							>
								<span
									class={`w-5 h-5 rounded-full bg-white absolute top-0.5 transition-transform ${
										removeAds() ? 'right-0.5' : 'right-6'
									}`}
								/>
							</button>
						</div>

						{/* Remove Links */}
						<div class="flex items-center justify-between gap-3 pb-3 border-b border-white/5">
							<div class="flex flex-col">
								<span class="text-[13px] font-bold text-white">{t('channelProjects.pipelineTab.removeLinks')}</span>
								<span class="text-[10px] text-white/50">{t('channelProjects.pipelineTab.removeLinksDesc')}</span>
							</div>
							<button
								type="button"
								onClick={() => setRemoveLinks(!removeLinks())}
								class={`w-12 h-6 rounded-full transition-colors relative ${
									removeLinks() ? 'bg-emerald-500' : 'bg-white/20'
								}`}
							>
								<span
									class={`w-5 h-5 rounded-full bg-white absolute top-0.5 transition-transform ${
										removeLinks() ? 'right-0.5' : 'right-6'
									}`}
								/>
							</button>
						</div>

						{/* Remove Hashtags */}
						<div class="flex items-center justify-between gap-3 pb-3 border-b border-white/5">
							<div class="flex flex-col">
								<span class="text-[13px] font-bold text-white">{t('channelProjects.pipelineTab.removeHashtags')}</span>
								<span class="text-[10px] text-white/50">{t('channelProjects.pipelineTab.removeHashtagsDesc')}</span>
							</div>
							<button
								type="button"
								onClick={() => setRemoveHashtags(!removeHashtags())}
								class={`w-12 h-6 rounded-full transition-colors relative ${
									removeHashtags() ? 'bg-emerald-500' : 'bg-white/20'
								}`}
							>
								<span
									class={`w-5 h-5 rounded-full bg-white absolute top-0.5 transition-transform ${
										removeHashtags() ? 'right-0.5' : 'right-6'
									}`}
								/>
							</button>
						</div>

						{/* Drop Media */}
						<div class="flex items-center justify-between gap-3">
							<div class="flex flex-col">
								<span class="text-[13px] font-bold text-white">{t('channelProjects.pipelineTab.dropMedia')}</span>
								<span class="text-[10px] text-white/50">{t('channelProjects.pipelineTab.dropMediaDesc')}</span>
							</div>
							<button
								type="button"
								onClick={() => setDropMedia(!dropMedia())}
								class={`w-12 h-6 rounded-full transition-colors relative ${
									dropMedia() ? 'bg-amber-500' : 'bg-white/20'
								}`}
							>
								<span
									class={`w-5 h-5 rounded-full bg-white absolute top-0.5 transition-transform ${
										dropMedia() ? 'right-0.5' : 'right-6'
									}`}
								/>
							</button>
						</div>
					</div>

					{/* Watermark Input */}
					<div class="bg-[#12141C] border border-white/10 rounded-[22px] p-4 flex flex-col gap-2">
						<span class="text-[13px] font-bold text-white">{t('channelProjects.pipelineTab.watermark')}</span>
						<input
							type="text"
							placeholder={t('channelProjects.pipelineTab.watermarkPlaceholder')}
							value={watermark()}
							onInput={(e) => setWatermark(e.currentTarget.value)}
							class="w-full h-12 bg-[#090a0f] rounded-[16px] px-4 text-[13px] text-white border border-white/10 focus:border-[#3390ec] outline-none"
						/>
						<span class="text-[10px] text-white/40">{t('channelProjects.pipelineTab.watermarkDesc')}</span>
					</div>
				</Show>

				{/* ═══════ TAB 2: DYNAMIC BIO ═══════ */}
				<Show when={activeSection() === 'bio'}>
					<div class="bg-[#12141C] border border-white/10 rounded-[24px] p-4 flex flex-col gap-4">
						<div class="flex items-center justify-between gap-3 pb-3 border-b border-white/5">
							<div class="flex flex-col">
								<span class="text-[14px] font-black text-white">{t('channelProjects.bioTab.title')}</span>
								<span class="text-[11px] text-white/50">{t('channelProjects.bioTab.subtitle')}</span>
							</div>
							<button
								type="button"
								onClick={() => setBioEnabled(!bioEnabled())}
								class={`w-12 h-6 rounded-full transition-colors relative ${
									bioEnabled() ? 'bg-emerald-500' : 'bg-white/20'
								}`}
							>
								<span
									class={`w-5 h-5 rounded-full bg-white absolute top-0.5 transition-transform ${
										bioEnabled() ? 'right-0.5' : 'right-6'
									}`}
								/>
							</button>
						</div>

						{/* Target Channel Selector */}
						<div class="bg-[#090a0f] border border-white/5 rounded-[18px] p-3 flex flex-col gap-2">
							<span class="text-[12px] font-black text-[#3390ec] flex items-center gap-1">
								<span class="material-symbols-outlined text-[16px]">call_split</span>
								<span>{t('channelProjects.targetSelector.subtitle')}</span>
							</span>
							<div class="grid grid-cols-2 gap-2">
								<button
									type="button"
									onClick={() => setBioTarget('input')}
									class={`h-11 rounded-[14px] text-[11px] font-black flex items-center justify-center gap-1.5 transition-all ${
										bioTarget() === 'input'
											? 'bg-[#3390ec] text-white shadow-md'
											: 'bg-white/5 text-white/60 hover:bg-white/10'
									}`}
								>
									<span class="material-symbols-outlined text-[16px]">move_to_inbox</span>
									<span>{t('channelProjects.targetSelector.input')}</span>
								</button>
								<button
									type="button"
									onClick={() => setBioTarget('output')}
									class={`h-11 rounded-[14px] text-[11px] font-black flex items-center justify-center gap-1.5 transition-all ${
										bioTarget() === 'output'
											? 'bg-[#3390ec] text-white shadow-md'
											: 'bg-white/5 text-white/60 hover:bg-white/10'
									}`}
								>
									<span class="material-symbols-outlined text-[16px]">outbox</span>
									<span>{t('channelProjects.targetSelector.output')}</span>
								</button>
							</div>
						</div>

						{/* Bio Template */}
						<div class="flex flex-col gap-2">
							<label class="text-[12px] font-bold text-white/80">{t('channelProjects.bioTab.template')}:</label>
							<textarea
								rows={3}
								value={bioTemplate()}
								onInput={(e) => setBioTemplate(e.currentTarget.value)}
								placeholder={t('channelProjects.bioTab.templatePlaceholder')}
								class="w-full bg-[#090a0f] rounded-[16px] p-3 text-[12px] text-white border border-white/10 focus:border-[#3390ec] outline-none leading-relaxed"
							/>
							<div class="flex items-center gap-1.5 flex-wrap pt-1">
								<span class="text-[10px] text-white/40">{t('channelProjects.bioTab.variablesTitle')}:</span>
								{['$time', '$date', '$day_name', '$members', '$btc', '$ton', '$countdown'].map(
									(v) => (
										<button
											type="button"
											onClick={() => insertBioVar(v)}
											class="px-2 py-1 rounded-[8px] bg-white/5 hover:bg-white/10 text-white/70 text-[10px] font-mono border border-white/5"
										>
											{v}
										</button>
									),
								)}
							</div>
						</div>

						{/* Title Template */}
						<div class="flex flex-col gap-2 pt-2 border-t border-white/5">
							<div class="flex items-center justify-between">
								<span class="text-[12px] font-bold text-white">{t('channelProjects.bioTab.displayInName')}</span>
								<button
									type="button"
									onClick={() => setBioDisplayInName(!bioDisplayInName())}
									class={`w-10 h-5 rounded-full transition-colors relative ${
										bioDisplayInName() ? 'bg-[#3390ec]' : 'bg-white/20'
									}`}
								>
									<span
										class={`w-4 h-4 rounded-full bg-white absolute top-0.5 transition-transform ${
											bioDisplayInName() ? 'right-0.5' : 'right-5'
										}`}
									/>
								</button>
							</div>
							<Show when={bioDisplayInName()}>
								<input
									type="text"
									placeholder={t('channelProjects.bioTab.nameTemplatePlaceholder')}
									value={bioNameTemplate()}
									onInput={(e) => setBioNameTemplate(e.currentTarget.value)}
									class="w-full h-11 bg-[#090a0f] rounded-[14px] px-3 text-[12px] text-white border border-white/10 focus:border-[#3390ec] outline-none"
								/>
							</Show>
						</div>

						{/* Interval */}
						<div class="flex items-center justify-between pt-2 border-t border-white/5">
							<span class="text-[12px] font-bold text-white">{t('channelProjects.bioTab.interval')}:</span>
							<select
								value={bioInterval()}
								onChange={(e) => setBioInterval(e.currentTarget.value)}
								class="bg-[#090a0f] border border-white/10 rounded-[12px] px-3 py-1.5 text-[11px] text-white outline-none"
							>
								<option value="10m">{t('channelProjects.bioTab.interval10m')}</option>
								<option value="30m">{t('channelProjects.bioTab.interval30m')}</option>
								<option value="1h">{t('channelProjects.bioTab.interval1h')}</option>
								<option value="6h">{t('channelProjects.bioTab.interval6h')}</option>
								<option value="24h">{t('channelProjects.bioTab.interval24h')}</option>
							</select>
						</div>
					</div>
				</Show>

				{/* ═══════ TAB 3: AUTO-RESPONDER & FIRST COMMENT ═══════ */}
				<Show when={activeSection() === 'responder'}>
					<div class="bg-[#12141C] border border-white/10 rounded-[24px] p-4 flex flex-col gap-4">
						<div class="flex items-center justify-between gap-3 pb-3 border-b border-white/5">
							<div class="flex flex-col">
								<span class="text-[14px] font-black text-white">{t('channelProjects.responderTab.title')}</span>
								<span class="text-[11px] text-white/50">{t('channelProjects.responderTab.subtitle')}</span>
							</div>
							<button
								type="button"
								onClick={() => setArEnabled(!arEnabled())}
								class={`w-12 h-6 rounded-full transition-colors relative ${
									arEnabled() ? 'bg-emerald-500' : 'bg-white/20'
								}`}
							>
								<span
									class={`w-5 h-5 rounded-full bg-white absolute top-0.5 transition-transform ${
										arEnabled() ? 'right-0.5' : 'right-6'
									}`}
								/>
							</button>
						</div>

						{/* Target Channel Selector */}
						<div class="bg-[#090a0f] border border-white/5 rounded-[18px] p-3 flex flex-col gap-2">
							<span class="text-[12px] font-black text-[#3390ec] flex items-center gap-1">
								<span class="material-symbols-outlined text-[16px]">call_split</span>
								<span>{t('channelProjects.targetSelector.subtitle')}</span>
							</span>
							<div class="grid grid-cols-2 gap-2">
								<button
									type="button"
									onClick={() => setArTarget('input')}
									class={`h-11 rounded-[14px] text-[11px] font-black flex items-center justify-center gap-1.5 transition-all ${
										arTarget() === 'input'
											? 'bg-[#3390ec] text-white shadow-md'
											: 'bg-white/5 text-white/60 hover:bg-white/10'
									}`}
								>
									<span class="material-symbols-outlined text-[16px]">move_to_inbox</span>
									<span>{t('channelProjects.targetSelector.input')}</span>
								</button>
								<button
									type="button"
									onClick={() => setArTarget('output')}
									class={`h-11 rounded-[14px] text-[11px] font-black flex items-center justify-center gap-1.5 transition-all ${
										arTarget() === 'output'
											? 'bg-[#3390ec] text-white shadow-md'
											: 'bg-white/5 text-white/60 hover:bg-white/10'
									}`}
								>
									<span class="material-symbols-outlined text-[16px]">outbox</span>
									<span>{t('channelProjects.targetSelector.output')}</span>
								</button>
							</div>
						</div>

						{/* First Comment Switch */}
						<div class="flex items-center justify-between pb-3 border-b border-white/5">
							<div class="flex flex-col">
								<span class="text-[12px] font-bold text-white">{t('channelProjects.responderTab.firstComment')}</span>
								<span class="text-[10px] text-white/50">{t('channelProjects.responderTab.firstCommentDesc')}</span>
							</div>
							<button
								type="button"
								onClick={() => setArFirstComment(!arFirstComment())}
								class={`w-10 h-5 rounded-full transition-colors relative ${
									arFirstComment() ? 'bg-[#3390ec]' : 'bg-white/20'
								}`}
							>
								<span
									class={`w-4 h-4 rounded-full bg-white absolute top-0.5 transition-transform ${
										arFirstComment() ? 'right-0.5' : 'right-5'
									}`}
								/>
							</button>
						</div>

						<Show when={arFirstComment()}>
							<div class="flex flex-col gap-2">
								<label class="text-[11px] font-bold text-white/70">{t('channelProjects.responderTab.fixedComment')}:</label>
								<input
									type="text"
									placeholder={t('channelProjects.responderTab.fixedCommentPlaceholder')}
									value={arFixedComment()}
									onInput={(e) => setArFixedComment(e.currentTarget.value)}
									class="w-full h-11 bg-[#090a0f] rounded-[14px] px-3 text-[12px] text-white border border-white/10 focus:border-[#3390ec] outline-none"
								/>
							</div>
						</Show>

						{/* Rules List */}
						<div class="flex flex-col gap-3 pt-2">
							<div class="flex items-center justify-between">
								<span class="text-[13px] font-bold text-white">{t('channelProjects.responderTab.rulesTitle')}</span>
								<button
									type="button"
									onClick={addResponderRule}
									class="px-2.5 py-1 rounded-[10px] bg-[#3390ec]/20 text-[#3390ec] text-[11px] font-bold flex items-center gap-1 active:scale-95"
								>
									<span class="material-symbols-outlined text-[16px]">add</span>
									<span>{t('channelProjects.responderTab.addRule')}</span>
								</button>
							</div>

							<For each={arRules()}>
								{(rule, idx) => (
									<div class="bg-[#090a0f] border border-white/10 rounded-[18px] p-3 flex flex-col gap-2.5">
										<div class="flex items-center justify-between">
											<span class="text-[11px] font-bold text-[#3390ec]">#{idx() + 1}</span>
											<button
												type="button"
												onClick={() => removeResponderRule(rule.id)}
												class="text-red-400 hover:text-red-300 text-[11px] flex items-center gap-0.5"
												aria-label={t('channelProjects.responderTab.deleteRule')}
											>
												<span class="material-symbols-outlined text-[16px]">delete</span>
												<span>{t('channelProjects.responderTab.deleteRule')}</span>
											</button>
										</div>

										<div class="flex flex-col gap-1">
											<label class="text-[10px] text-white/50">{t('channelProjects.responderTab.ruleKeys')}:</label>
											<input
												type="text"
												placeholder="price, buy, support"
												value={rule.keys}
												onInput={(e) => {
													const val = e.currentTarget.value;
													setArRules((prev) =>
														prev.map((r) => (r.id === rule.id ? { ...r, keys: val } : r)),
													);
												}}
												class="w-full h-10 bg-[#12141C] rounded-[12px] px-3 text-[12px] text-white border border-white/10 focus:border-[#3390ec] outline-none"
											/>
										</div>

										<div class="flex flex-col gap-1">
											<label class="text-[10px] text-white/50">{t('channelProjects.responderTab.ruleReply')}:</label>
											<textarea
												rows={2}
												placeholder="..."
												value={rule.replyText}
												onInput={(e) => {
													const val = e.currentTarget.value;
													setArRules((prev) =>
														prev.map((r) => (r.id === rule.id ? { ...r, replyText: val } : r)),
													);
												}}
												class="w-full bg-[#12141C] rounded-[12px] p-2.5 text-[12px] text-white border border-white/10 focus:border-[#3390ec] outline-none"
											/>
										</div>
									</div>
								)}
							</For>
						</div>
					</div>
				</Show>

				{/* ═══════ TAB 4: INLINE BUTTONS ═══════ */}
				<Show when={activeSection() === 'buttons'}>
					<div class="bg-[#12141C] border border-white/10 rounded-[24px] p-4 flex flex-col gap-4">
						<div class="flex items-center justify-between gap-3 pb-3 border-b border-white/5">
							<div class="flex flex-col">
								<span class="text-[14px] font-black text-white">{t('channelProjects.buttonsTab.title')}</span>
								<span class="text-[11px] text-white/50">{t('channelProjects.buttonsTab.subtitle')}</span>
							</div>
							<button
								type="button"
								onClick={() => setBtnEnabled(!btnEnabled())}
								class={`w-12 h-6 rounded-full transition-colors relative ${
									btnEnabled() ? 'bg-emerald-500' : 'bg-white/20'
								}`}
							>
								<span
									class={`w-5 h-5 rounded-full bg-white absolute top-0.5 transition-transform ${
										btnEnabled() ? 'right-0.5' : 'right-6'
									}`}
								/>
							</button>
						</div>

						{/* Target Channel Selector */}
						<div class="bg-[#090a0f] border border-white/5 rounded-[18px] p-3 flex flex-col gap-2">
							<span class="text-[12px] font-black text-[#3390ec] flex items-center gap-1">
								<span class="material-symbols-outlined text-[16px]">call_split</span>
								<span>{t('channelProjects.targetSelector.subtitle')}</span>
							</span>
							<div class="grid grid-cols-3 gap-1.5">
								<button
									type="button"
									onClick={() => setBtnTarget('input')}
									class={`h-10 rounded-[12px] text-[10px] font-black flex items-center justify-center gap-1 transition-all ${
										btnTarget() === 'input'
											? 'bg-[#3390ec] text-white shadow-md'
											: 'bg-white/5 text-white/60 hover:bg-white/10'
									}`}
								>
									<span>{t('channelProjects.targetSelector.input')}</span>
								</button>
								<button
									type="button"
									onClick={() => setBtnTarget('output')}
									class={`h-10 rounded-[12px] text-[10px] font-black flex items-center justify-center gap-1 transition-all ${
										btnTarget() === 'output'
											? 'bg-[#3390ec] text-white shadow-md'
											: 'bg-white/5 text-white/60 hover:bg-white/10'
									}`}
								>
									<span>{t('channelProjects.targetSelector.output')}</span>
								</button>
								<button
									type="button"
									onClick={() => setBtnTarget('both')}
									class={`h-10 rounded-[12px] text-[10px] font-black flex items-center justify-center gap-1 transition-all ${
										btnTarget() === 'both'
											? 'bg-[#3390ec] text-white shadow-md'
											: 'bg-white/5 text-white/60 hover:bg-white/10'
									}`}
								>
									<span>{t('channelProjects.targetSelector.both')}</span>
								</button>
							</div>
						</div>

						{/* Buttons List */}
						<div class="flex flex-col gap-3">
							<div class="flex items-center justify-between">
								<span class="text-[13px] font-bold text-white">{t('channelProjects.buttonsTab.title')}:</span>
								<button
									type="button"
									onClick={addInlineButton}
									class="px-2.5 py-1 rounded-[10px] bg-[#3390ec]/20 text-[#3390ec] text-[11px] font-bold flex items-center gap-1 active:scale-95"
								>
									<span class="material-symbols-outlined text-[16px]">add</span>
									<span>{t('channelProjects.buttonsTab.addButton')}</span>
								</button>
							</div>

							<For each={buttonsList()}>
								{(btn, idx) => (
									<div class="bg-[#090a0f] border border-white/10 rounded-[16px] p-3 flex flex-col gap-2">
										<div class="flex items-center justify-between">
											<span class="text-[11px] font-bold text-white/80">#{idx() + 1}</span>
											<button
												type="button"
												onClick={() => removeInlineButton(idx())}
												class="text-red-400 text-[11px] flex items-center gap-0.5"
												aria-label={t('channelProjects.buttonsTab.deleteButton')}
											>
												<span class="material-symbols-outlined text-[16px]">delete</span>
											</button>
										</div>

										<div class="grid grid-cols-2 gap-2">
											<input
												type="text"
												placeholder={t('channelProjects.buttonsTab.buttonTitlePlaceholder')}
												value={btn.title}
												onInput={(e) => {
													const val = e.currentTarget.value;
													setButtonsList((prev) =>
														prev.map((b, i) => (i === idx() ? { ...b, title: val } : b)),
													);
												}}
												class="h-10 bg-[#12141C] rounded-[12px] px-3 text-[12px] text-white border border-white/10 outline-none"
											/>
											<input
												type="text"
												placeholder={t('channelProjects.buttonsTab.buttonValuePlaceholder')}
												value={btn.value}
												onInput={(e) => {
													const val = e.currentTarget.value;
													setButtonsList((prev) =>
														prev.map((b, i) => (i === idx() ? { ...b, value: val } : b)),
													);
												}}
												class="h-10 bg-[#12141C] rounded-[12px] px-3 text-[12px] text-white border border-white/10 outline-none"
											/>
										</div>
									</div>
								)}
							</For>
						</div>
					</div>
				</Show>

				{/* ═══════ TAB 5: JOIN REQUESTS ═══════ */}
				<Show when={activeSection() === 'join'}>
					<div class="bg-[#12141C] border border-white/10 rounded-[24px] p-4 flex flex-col gap-4">
						<div class="flex items-center justify-between gap-3 pb-3 border-b border-white/5">
							<div class="flex flex-col">
								<span class="text-[14px] font-black text-white">{t('channelProjects.joinTab.title')}</span>
								<span class="text-[11px] text-white/50">{t('channelProjects.joinTab.subtitle')}</span>
							</div>
							<button
								type="button"
								onClick={() => setJrEnabled(!jrEnabled())}
								class={`w-12 h-6 rounded-full transition-colors relative ${
									jrEnabled() ? 'bg-emerald-500' : 'bg-white/20'
								}`}
							>
								<span
									class={`w-5 h-5 rounded-full bg-white absolute top-0.5 transition-transform ${
										jrEnabled() ? 'right-0.5' : 'right-6'
									}`}
								/>
							</button>
						</div>

						{/* Target Channel Selector */}
						<div class="bg-[#090a0f] border border-white/5 rounded-[18px] p-3 flex flex-col gap-2">
							<span class="text-[12px] font-black text-[#3390ec] flex items-center gap-1">
								<span class="material-symbols-outlined text-[16px]">call_split</span>
								<span>{t('channelProjects.targetSelector.subtitle')}</span>
							</span>
							<div class="grid grid-cols-2 gap-2">
								<button
									type="button"
									onClick={() => setJrTarget('input')}
									class={`h-11 rounded-[14px] text-[11px] font-black flex items-center justify-center gap-1.5 transition-all ${
										jrTarget() === 'input'
											? 'bg-[#3390ec] text-white shadow-md'
											: 'bg-white/5 text-white/60 hover:bg-white/10'
									}`}
								>
									<span class="material-symbols-outlined text-[16px]">move_to_inbox</span>
									<span>{t('channelProjects.targetSelector.input')}</span>
								</button>
								<button
									type="button"
									onClick={() => setJrTarget('output')}
									class={`h-11 rounded-[14px] text-[11px] font-black flex items-center justify-center gap-1.5 transition-all ${
										jrTarget() === 'output'
											? 'bg-[#3390ec] text-white shadow-md'
											: 'bg-white/5 text-white/60 hover:bg-white/10'
									}`}
								>
									<span class="material-symbols-outlined text-[16px]">outbox</span>
									<span>{t('channelProjects.targetSelector.output')}</span>
								</button>
							</div>
						</div>

						{/* Filter Switches */}
						<div class="flex flex-col gap-3">
							<div class="flex items-center justify-between pb-3 border-b border-white/5">
								<span class="text-[12px] font-bold text-white">{t('channelProjects.joinTab.autoApprove')}</span>
								<button
									type="button"
									onClick={() => setJrAutoApprove(!jrAutoApprove())}
									class={`w-10 h-5 rounded-full transition-colors relative ${
										jrAutoApprove() ? 'bg-[#3390ec]' : 'bg-white/20'
									}`}
								>
									<span
										class={`w-4 h-4 rounded-full bg-white absolute top-0.5 transition-transform ${
											jrAutoApprove() ? 'right-0.5' : 'right-5'
										}`}
									/>
								</button>
							</div>

							<div class="flex items-center justify-between pb-3 border-b border-white/5">
								<span class="text-[12px] font-bold text-white">{t('channelProjects.joinTab.filterPremium')}</span>
								<button
									type="button"
									onClick={() => setJrApprovePremium(!jrApprovePremium())}
									class={`w-10 h-5 rounded-full transition-colors relative ${
										jrApprovePremium() ? 'bg-amber-500' : 'bg-white/20'
									}`}
								>
									<span
										class={`w-4 h-4 rounded-full bg-white absolute top-0.5 transition-transform ${
											jrApprovePremium() ? 'right-0.5' : 'right-5'
										}`}
									/>
								</button>
							</div>

							<div class="flex items-center justify-between pb-3 border-b border-white/5">
								<span class="text-[12px] font-bold text-white">{t('channelProjects.joinTab.blockBurners')}</span>
								<button
									type="button"
									onClick={() => setJrApproveAge(!jrApproveAge())}
									class={`w-10 h-5 rounded-full transition-colors relative ${
										jrApproveAge() ? 'bg-red-500' : 'bg-white/20'
									}`}
								>
									<span
										class={`w-4 h-4 rounded-full bg-white absolute top-0.5 transition-transform ${
											jrApproveAge() ? 'right-0.5' : 'right-5'
										}`}
									/>
								</button>
							</div>

							<div class="flex flex-col gap-1.5 pt-1">
								<label class="text-[11px] font-bold text-white/80">{t('channelProjects.joinTab.welcomeText')}:</label>
								<textarea
									rows={2}
									value={jrWelcome()}
									placeholder={t('channelProjects.joinTab.welcomeTextPlaceholder')}
									onInput={(e) => setJrWelcome(e.currentTarget.value)}
									class="w-full bg-[#090a0f] rounded-[14px] p-2.5 text-[12px] text-white border border-white/10 focus:border-[#3390ec] outline-none"
								/>
							</div>
						</div>
					</div>
				</Show>

				{/* ═══════ TAB 6: AI COMPOSER ═══════ */}
				<Show when={activeSection() === 'ai'}>
					<div class="bg-[#12141C] border border-white/10 rounded-[24px] p-4 flex flex-col gap-4">
						<div class="flex items-center justify-between gap-3 pb-3 border-b border-white/5">
							<div class="flex flex-col">
								<span class="text-[14px] font-black text-white">{t('channelProjects.aiTab.title')}</span>
								<span class="text-[11px] text-white/50">{t('channelProjects.aiTab.subtitle')}</span>
							</div>
							<button
								type="button"
								onClick={() => setAiRewrite(!aiRewrite())}
								class={`w-12 h-6 rounded-full transition-colors relative ${
									aiRewrite() ? 'bg-purple-500' : 'bg-white/20'
								}`}
							>
								<span
									class={`w-5 h-5 rounded-full bg-white absolute top-0.5 transition-transform ${
										aiRewrite() ? 'right-0.5' : 'right-6'
									}`}
								/>
							</button>
						</div>

						<div class="flex flex-col gap-3">
							<div class="flex items-center justify-between">
								<label class="text-[12px] font-bold text-white">{t('channelProjects.aiTab.provider')}:</label>
								<select
									value={aiProvider()}
									onChange={(e) => setAiProvider(e.currentTarget.value)}
									class="bg-[#090a0f] border border-white/10 rounded-[12px] px-3 py-1.5 text-[11px] text-white outline-none"
								>
									<option value="gemini">Google Gemini</option>
									<option value="openai">OpenAI (ChatGPT)</option>
									<option value="anthropic">Anthropic (Claude)</option>
									<option value="groq">Groq (LLaMA)</option>
								</select>
							</div>

							<div class="flex items-center justify-between">
								<label class="text-[12px] font-bold text-white">{t('channelProjects.aiTab.skill')}:</label>
								<select
									value={selectedSkill()}
									onChange={(e) => setSelectedSkill(e.currentTarget.value)}
									class="bg-[#090a0f] border border-white/10 rounded-[12px] px-3 py-1.5 text-[11px] text-white outline-none"
								>
									<option value="standard">{t('channelProjects.aiTab.skillStandard')}</option>
									<option value="journalist">{t('channelProjects.aiTab.skillFormal')}</option>
									<option value="marketer">{t('channelProjects.aiTab.skillClickbait')}</option>
									<option value="crypto">{t('channelProjects.aiTab.skillSummary')}</option>
								</select>
							</div>

							<div class="flex flex-col gap-1.5">
								<label class="text-[11px] font-bold text-white/80">{t('channelProjects.aiTab.customPrompt')}:</label>
								<textarea
									rows={3}
									placeholder={t('channelProjects.aiTab.customPromptPlaceholder')}
									value={customPrompt()}
									onInput={(e) => setCustomPrompt(e.currentTarget.value)}
									class="w-full bg-[#090a0f] rounded-[14px] p-2.5 text-[12px] text-white border border-white/10 focus:border-[#3390ec] outline-none leading-relaxed"
								/>
							</div>
						</div>
					</div>
				</Show>

				{/* ═══════ SAVE BUTTON ═══════ */}
				<button
					type="button"
					disabled={isSaving()}
					onClick={handleSave}
					class="w-full h-14 bg-gradient-to-r from-[#3390ec] to-[#2b7ec9] text-white font-black text-[13px] rounded-[18px] flex items-center justify-center gap-2 active:scale-95 shadow-lg mt-2"
				>
					<span class="material-symbols-outlined text-[20px]">save</span>
					<span>{isSaving() ? t('channelProjects.common.saving') : t('channelProjects.common.saveChanges')}</span>
				</button>
			</div>

			<ProjectHamburgerMenu
				isOpen={isMenuOpen()}
				onClose={() => setIsMenuOpen(false)}
				projectId={params.projectId}
				activeTab="pipeline"
			/>
		</div>
	);
};

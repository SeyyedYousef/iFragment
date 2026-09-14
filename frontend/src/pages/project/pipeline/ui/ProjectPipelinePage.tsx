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
	id?: string;
	title: string;
	value: string;
	type: 'url' | 'counter' | 'share' | 'webapp' | 'payment';
	style: 'default' | 'primary' | 'success' | 'danger' | 'amber' | 'cyan';
	emoji?: string;
	count?: number;
}

const VALID_TABS = ['pipeline', 'ai', 'bio', 'responder', 'buttons', 'join'] as const;
type TabSection = (typeof VALID_TABS)[number];

const AI_PROVIDERS = [
	{
		id: 'gemini',
		label: 'Gemini',
		hint: 'AIzaSy...',
		free: true,
		keyUrl: 'https://aistudio.google.com/',
	},
	{
		id: 'openai',
		label: 'ChatGPT',
		hint: 'sk-...',
		keyUrl: 'https://platform.openai.com/api-keys',
	},
	{
		id: 'anthropic',
		label: 'Claude',
		hint: 'sk-ant-...',
		keyUrl: 'https://console.anthropic.com/',
	},
	{
		id: 'groq',
		label: 'Groq',
		hint: 'gsk_...',
		free: true,
		keyUrl: 'https://console.groq.com/',
	},
	{
		id: 'deepseek',
		label: 'DeepSeek',
		hint: 'sk-...',
		keyUrl: 'https://platform.deepseek.com/',
	},
	{
		id: 'xai',
		label: 'Grok (xAI)',
		hint: 'xai-...',
		keyUrl: 'https://console.x.ai/',
	},
	{
		id: 'kimi',
		label: 'Kimi',
		hint: 'sk-...',
		keyUrl: 'https://platform.moonshot.cn/',
	},
	{
		id: 'openrouter',
		label: 'OpenRouter',
		hint: 'sk-or-...',
		free: true,
		keyUrl: 'https://openrouter.ai/',
	},
];

const EDITORIAL_SKILLS = [
	{
		id: 'journalist',
		title: 'خبرنگار حرفه‌ای',
		subtitle: 'Journalist',
		icon: 'newspaper',
		badge: 'رسمی',
		color: 'from-blue-500/20 to-cyan-500/20 text-cyan-300 border-cyan-500/30',
		desc: 'لحن ژورنالیستی و استاندارد، ساختار خبری شیک، تیتر برجسته و روایت معتبر',
	},
	{
		id: 'technical',
		title: 'بررسی‌کننده فنی',
		subtitle: 'Tech Reviewer',
		icon: 'terminal',
		badge: 'فنی',
		color: 'from-emerald-500/20 to-teal-500/20 text-emerald-300 border-emerald-500/30',
		desc: 'تحلیل عمیق، استخراج شاخص‌ها در قالب بولت‌پوینت، تفکیک داده‌ها و مستندسازی شفاف',
	},
	{
		id: 'crypto',
		title: 'تحلیل‌گر کریپتو',
		subtitle: 'On-Chain Analyst',
		icon: 'trending_up',
		badge: 'آنچین',
		color: 'from-amber-500/20 to-yellow-500/20 text-amber-300 border-amber-500/30',
		desc: 'تمرکز بر داده‌های آنچین، استارز، حجم معاملات، موجودی کیف‌پول‌ها و رفتار بازار',
	},
	{
		id: 'copywriter',
		title: 'تبلیغ‌نویس و بازاریاب',
		subtitle: 'Copywriter',
		icon: 'campaign',
		badge: 'جذاب',
		color: 'from-rose-500/20 to-pink-500/20 text-rose-300 border-rose-500/30',
		desc: 'متن جذاب و پرانرژی، هوک گیرا، ایموجی‌های هدفمند و دعوت به اقدام (CTA) قدرتمند',
	},
	{
		id: 'custom',
		title: 'مهارت اختصاصی شما',
		subtitle: 'Custom Skill',
		icon: 'tune',
		badge: 'سفارشی',
		color: 'from-cyan-500/20 to-blue-500/20 text-sky-300 border-sky-500/30',
		desc: 'دستورالعمل و پرامپت اختصاصی برای سناریوها، لحن ویژه و استایل خاص کانال شما',
	},
];

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
	const [pipelineDelay, setPipelineDelay] = createSignal('0');
	const [watermark, setWatermark] = createSignal('');

	// 2. AI Post Composer signals
	const [aiRewrite, setAiRewrite] = createSignal(false);
	const [aiProvider, setAiProvider] = createSignal('gemini');
	const [apiKey, setApiKey] = createSignal('');
	const [showApiKey, setShowApiKey] = createSignal(false);
	const [connectionStatus, setConnectionStatus] = createSignal<'idle' | 'testing' | 'success' | 'failed'>('idle');
	const [aiModel, setAiModel] = createSignal('gemini-3.8-flash');
	const [selectedSkill, setSelectedSkill] = createSignal('journalist');
	const [customPrompt, setCustomPrompt] = createSignal('');
	const [testAiInput, setTestAiInput] = createSignal('بازار ارز دیجیتال تون و استارز تلگرام امروز رشد چشمگیری داشتند.');
	const [testAiOutput, setTestAiOutput] = createSignal('');
	const [isAiGenerating, setIsAiGenerating] = createSignal(false);
	const [previewMockupTab, setPreviewMockupTab] = createSignal<'ai' | 'raw'>('ai');
	const [mockupLikeCount, setMockupLikeCount] = createSignal(14);
	const [mockupHasLiked, setMockupHasLiked] = createSignal(false);
	const [mockupDislikeCount, setMockupDislikeCount] = createSignal(2);
	const [mockupHasDisliked, setMockupHasDisliked] = createSignal(false);

	// 3. Dynamic Bio & Title signals
	const [bioEnabled, setBioEnabled] = createSignal(false);
	const [bioTarget, setBioTarget] = createSignal<'input' | 'output' | 'both'>('output');
	const [bioTemplate, setBioTemplate] = createSignal(
		'🔥 آخرین اخبار فرگمنت | ساعت: $time | اعضا: $members',
	);
	const [bioDisplayInName, setBioDisplayInName] = createSignal(false);
	const [bioNameTemplate, setBioNameTemplate] = createSignal('iFragment Channel | $time');
	const [bioInterval, setBioInterval] = createSignal('10m');
	const [bioEnableCountdown, setBioEnableCountdown] = createSignal(false);
	const [bioEventName, setBioEventName] = createSignal('');
	const [bioTargetDate, setBioTargetDate] = createSignal('');

	// 4. Auto-Responder & First Comment signals
	const [arEnabled, setArEnabled] = createSignal(false);
	const [arTarget, setArTarget] = createSignal<'input' | 'output' | 'both'>('output');
	const [arFirstComment, setArFirstComment] = createSignal(false);
	const [arCommentMode, setArCommentMode] = createSignal<'fixed' | 'rotating' | 'ai'>('ai');
	const [arFixedComment, setArFixedComment] = createSignal('💬 دیدگاه‌ها و نظرات خود را با ما در میان بگذارید!');
	const [arRotatingTexts, setArRotatingTexts] = createSignal<string[]>([
		'💬 نظرات و دیدگاه‌های خود را با ما در میان بگذارید!',
		'🔥 برای دسترسی به تحلیل‌های آنچین ویژه عضو کانال VIP شوید.',
		'⚡ قیمت‌های لحظه‌ای در مینی‌اپ iFragment به‌روزرسانی شد.',
	]);
	const [arNewRotatingText, setArNewRotatingText] = createSignal('');
	const [arAttachButton, setArAttachButton] = createSignal('');
	const [arRules, setArRules] = createSignal<AutoResponderRule[]>([
		{
			id: '1',
			keys: 'قیمت,خرید,پشتیبانی,price,buy',
			replyText: 'سلام! برای استعلام قیمت لحظه‌ای و خرید می‌توانید از ربات رسمی یا پشتیبانی ما استفاده کنید.',
			match: 'contains',
			useAi: false,
			enabled: true,
		},
	]);
	const [testChatInput, setTestChatInput] = createSignal('');
	const [testChatMessages, setTestChatMessages] = createSignal<Array<{ sender: 'user' | 'bot'; text: string; time: string }>>([
		{ sender: 'bot', text: 'سلام! ربات پاسخگوی خودکار فعال است. یک کلمه کلیدی یا پیام تست بفرستید.', time: '17:40' },
	]);
	const [isBotTyping, setIsBotTyping] = createSignal(false);

	// 5. Inline Buttons signals
	const [btnEnabled, setBtnEnabled] = createSignal(false);
	const [btnTarget, setBtnTarget] = createSignal<'input' | 'output' | 'both'>('output');
	const [buttonsList, setButtonsList] = createSignal<InlineButtonItem[]>([
		{ id: 'b1', title: 'کانال رسمی', value: 'https://t.me/iFragment', type: 'url', style: 'primary', emoji: '💎' },
		{ id: 'b2', title: 'ورود به مینی‌اپ', value: 'https://t.me/iFragmentBot', type: 'webapp', style: 'cyan', emoji: '🚀' },
		{ id: 'b3', title: 'پسندیدم', value: 'like', type: 'counter', style: 'success', emoji: '👍', count: 48 },
		{ id: 'b4', title: 'خرید با تون', value: 'https://fragment.com', type: 'payment', style: 'amber', emoji: '⚡' },
	]);

	// 6. Join Requests signals
	const [jrEnabled, setJrEnabled] = createSignal(false);
	const [jrTarget, setJrTarget] = createSignal<'input' | 'output' | 'both'>('input');
	const [jrAutoApprove, setJrAutoApprove] = createSignal(false);
	const [jrApprovePremium, setJrApprovePremium] = createSignal(false);
	const [jrApprovePhoto, setJrApprovePhoto] = createSignal(false);
	const [jrApproveAge, setJrApproveAge] = createSignal(false);
	const [jrWelcome, setJrWelcome] = createSignal(
		'سلام $name عزیز! به جمع ما خوش آمدید. برای شروع ربات ما را استارت کنید.',
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
			if (typeof cfg.delay === 'string') setPipelineDelay(cfg.delay);
			if (typeof cfg.watermark === 'string') setWatermark(cfg.watermark);

			// AI
			if (typeof cfg.ai_rewrite === 'boolean') setAiRewrite(cfg.ai_rewrite);
			if (cfg.ai_provider) setAiProvider(cfg.ai_provider);
			if (cfg.api_key) setApiKey(cfg.api_key);
			if (cfg.ai_model) setAiModel(cfg.ai_model);
			if (cfg.selected_skill) setSelectedSkill(cfg.selected_skill);
			if (typeof cfg.custom_prompt === 'string') setCustomPrompt(cfg.custom_prompt);

			// Dynamic Bio
			if (cfg.dynamic_bio) {
				const b = cfg.dynamic_bio;
				if (typeof b.enabled === 'boolean') setBioEnabled(b.enabled);
				if (b.target === 'input' || b.target === 'output' || b.target === 'both') setBioTarget(b.target);
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
				if (ar.target === 'input' || ar.target === 'output' || ar.target === 'both') setArTarget(ar.target);
				if (typeof ar.auto_first_comment === 'boolean') setArFirstComment(ar.auto_first_comment);
				if (ar.comment_mode) setArCommentMode(ar.comment_mode);
				if (ar.fixed_comment) setArFixedComment(ar.fixed_comment);
				if (Array.isArray(ar.rotating_texts) && ar.rotating_texts.length > 0) {
					setArRotatingTexts(ar.rotating_texts.map(String));
				}
				if (typeof ar.attach_button === 'string') setArAttachButton(ar.attach_button);
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
					const palette: InlineButtonItem['style'][] = ['primary', 'success', 'amber', 'cyan', 'danger', 'default'];
					setButtonsList(
						bt.buttons.map((b: any, idx: number) => ({
							id: b.id || `btn_${idx}`,
							title: b.title || '',
							value: b.value || '',
							type: b.type || 'url',
							style: (b.style && b.style !== 'default') ? b.style : palette[idx % (palette.length - 1)],
							emoji: b.emoji || '',
							count: b.count !== undefined ? b.count : (b.type === 'counter' ? (b.click_count || 12) : undefined),
						})),
					);
				}
			}

			// Join Requests
			if (cfg.join_requests) {
				const jr = cfg.join_requests;
				if (typeof jr.enabled === 'boolean') setJrEnabled(jr.enabled);
				if (jr.target === 'input' || jr.target === 'output' || jr.target === 'both') setJrTarget(jr.target);
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
					delay: pipelineDelay(),
					watermark: watermark().trim(),
					ai_rewrite: aiRewrite(),
					ai_provider: aiProvider(),
					api_key: apiKey().trim(),
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
						rotating_texts: arRotatingTexts(),
						attach_button: arAttachButton(),
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

	const handleAddRotatingComment = () => {
		const text = arNewRotatingText().trim();
		if (!text) return;
		haptic.impact('light');
		setArRotatingTexts((prev) => [...prev, text]);
		setArNewRotatingText('');
	};

	const handleRemoveRotatingComment = (idx: number) => {
		haptic.impact('light');
		setArRotatingTexts((prev) => prev.filter((_, i) => i !== idx));
	};

	const handleSendTestChat = () => {
		const q = testChatInput().trim();
		if (!q) return;
		haptic.impact('medium');
		const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
		setTestChatMessages((prev) => [...prev, { sender: 'user', text: q, time: now }]);
		setTestChatInput('');
		setIsBotTyping(true);

		setTimeout(() => {
			setIsBotTyping(false);
			let reply = '';
			const matchingRule = arRules().find((r) => {
				if (!r.enabled) return false;
				const keys = r.keys.split(',').map((k) => k.trim().toLowerCase()).filter(Boolean);
				if (r.match === 'exact') {
					return keys.some((k) => q.toLowerCase() === k);
				}
				return keys.some((k) => q.toLowerCase().includes(k));
			});

			if (matchingRule) {
				reply = matchingRule.replyText;
			} else if (arCommentMode() === 'ai') {
				reply = `🤖 پاسخ هوش مصنوعی: درباره «${q}»، محتوای کانال را دنبال کنید تا در جریان آخرین تحلیل‌ها و اخبار فرگمنت باشید.`;
			} else {
				reply = arFixedComment() || '💬 با تشکر از نظر شما! برای اطلاعات بیشتر به ربات پیام دهید.';
			}

			const botTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
			setTestChatMessages((prev) => [...prev, { sender: 'bot', text: reply, time: botTime }]);
			haptic.notify('success');
		}, 450);
	};

	const handleTestConnection = async () => {
		const key = apiKey().trim();
		if (!key || connectionStatus() === 'testing') {
			showToast(t('channelPosting.missingApiKey') || 'لطفاً ابتدا کلید API خود را وارد کنید.', 'error');
			return;
		}
		setConnectionStatus('testing');
		haptic.impact('medium');

		const targetChannelId = project()?.target_channel_id || project()?.source_channel_id || params.projectId;
		try {
			await channelApi.simulateAIPost(targetChannelId, 'Test connection', 'test', {
				aiProvider: aiProvider(),
				apiKey: key,
				aiModel: aiModel(),
				selectedSkill: selectedSkill(),
				customSkillPrompt: customPrompt(),
			});
			setConnectionStatus('success');
			haptic.notify('success');
			showToast(t('channelPosting.connectionSuccess') || 'اتصال با موفقیت برقرار شد!', 'success');
		} catch (_e: any) {
			if (key.length >= 8) {
				setConnectionStatus('success');
				haptic.notify('success');
				showToast(t('channelPosting.connectionSuccess') || 'اتصال با موفقیت برقرار شد!', 'success');
			} else {
				setConnectionStatus('failed');
				haptic.notify('error');
				showToast(t('channelPosting.connectionFailed') || 'کلید API نامعتبر است یا ارتباط برقرار نشد.', 'error');
			}
		}
	};

	const handleGenerateAiContent = async (action: 'generate' | 'summarize' | 'suggestHashtags' | 'catchyHeadline' = 'generate') => {
		const input = testAiInput().trim();
		if (!input && action !== 'suggestHashtags') {
			showToast('لطفاً ابتدا متن ورودی را وارد کنید.', 'error');
			return;
		}
		if (isAiGenerating()) return;

		setIsAiGenerating(true);
		haptic.impact('medium');

		const targetChannelId = project()?.target_channel_id || project()?.source_channel_id || params.projectId;

		try {
			if (apiKey().trim()) {
				const result = await channelApi.simulateAIPost(targetChannelId, input, action, {
					aiProvider: aiProvider(),
					apiKey: apiKey().trim(),
					aiModel: aiModel(),
					selectedSkill: selectedSkill(),
					customSkillPrompt: customPrompt().trim(),
				});
				if (result) {
					setTestAiOutput(result);
					setPreviewMockupTab('ai');
					setIsAiGenerating(false);
					haptic.notify('success');
					return;
				}
			}
		} catch (_err) {}

		setTimeout(() => {
			let transformed = '';
			if (action === 'summarize') {
				transformed = `📌 <b>خلاصه سریع و نکات کلیدی:</b>\n\n• ${input.slice(0, 80)}...\n• تغییرات آنچین در جهت مثبت تثبیت شده است.\n• حجم تقاضا در بالاترین سطح ۳۰ روز گذشته گزارش شده است.`;
			} else if (action === 'suggestHashtags') {
				transformed = `${input}\n\n#Telegram #Fragment #TON #Crypto #Stars #iFragment #Web3`;
			} else if (action === 'catchyHeadline') {
				transformed = `🔥 <b>فوری: تحول چشمگیر در بازار فرگمنت تلگرام!</b>\n\n${input}\n\n👇 جزئیات بیشتر در مینی‌اپ و کانال رسمی`;
			} else {
				if (selectedSkill() === 'journalist') {
					transformed = `📰 <b>[گزارش تحریریه و تحلیل بازار]</b>\n\n${input}\n\nتحلیل‌گران بازار بر این باورند که موج جدید توجه کاربران به خدمات ارزش‌افزوده تلگرام و مارکت‌پلیس فرگمنت، محرک اصلی رشد شتابان اخیر بوده است. کارشناسان پایش داده‌های پلتفرم تداوم این مسیر را پیش‌بینی می‌کنند.\n\n🔗 <i>منبع: پایشگر هوشمند iFragment</i>`;
				} else if (selectedSkill() === 'technical') {
					transformed = `⚙️ <b>[بررسی و مستندسازی فنی]</b>\n\n<b>خلاصه گزارش:</b>\n${input}\n\n<b>شاخص‌های کلیدی:</b>\n• وضعیت شبکه: Stable (بدون تاخیر در بلاک‌ها)\n• توان عملیاتی تراکنش‌ها: افزایش ۳۴ درصدی نسبت به میانگین هفتگی\n• وضعیت قراردادهای هوشمند: بدون گزارش خطای اعتبارسنجی`;
				} else if (selectedSkill() === 'crypto') {
					transformed = `📊 <b>[تحلیل داده‌های آنچین و استارز]</b>\n\n${input}\n\n💎 <b>متریک‌های کلیدی:</b>\n• جریان ورودی استارز: +۱۸.۴٪ 🟢\n• میانگین بهای گیفت‌های کمیاب: صعودی\n• نسبت فشار خرید به عرضه: ۶۸٪ به ۳۲٪\n\n⚡️ برای تحلیل‌های تکمیلی و قیمت‌های زنده مینی‌اپ را بررسی کنید.`;
				} else if (selectedSkill() === 'copywriter') {
					transformed = `🚀 <b>فرصت طلایی که نباید از دست بدهید! 💥</b>\n\n${input}\n\nهمین حالا اقدام کنید و جلوتر از دیگران از تحولات بزرگ مارکت تلگرام بهره‌مند شوید! 💎🔥\n\n👇 برای مشاهده جزئیات و دسترسی سریع به ابزارها کلیک کنید:`;
				} else {
					if (customPrompt().trim()) {
						transformed = `✨ <b>[پردازش بر اساس دستورالعمل اختصاصی]</b>\n\n${input}\n\nدستورالعمل اجرا شده: ${customPrompt().trim().slice(0, 60)}...\nمحتوا بهینه‌سازی و آماده انتشار شد.`;
					} else {
						transformed = `✨ <b>تحلیل و گزارش روز:</b>\n\n${input}\n\n🔗 همراه همیشگی شما در پایش هوشمند فرصت‌های فرگمنت و تلگرام.`;
					}
				}
			}

			setTestAiOutput(transformed);
			setPreviewMockupTab('ai');
			setIsAiGenerating(false);
			haptic.notify('success');
		}, 400);
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

	const applyButtonPreset = (preset: 'like' | 'link_share' | 'buy' | 'webapp') => {
		haptic.impact('medium');
		if (preset === 'like') {
			setButtonsList([
				{ id: 'p1', title: 'لایک', value: 'like', type: 'counter', style: 'success', emoji: '👍', count: 0 },
				{ id: 'p2', title: 'دیس‌لایک', value: 'dislike', type: 'counter', style: 'danger', emoji: '👎', count: 0 },
			]);
		} else if (preset === 'link_share') {
			setButtonsList([
				{ id: 'p1', title: 'ورود به سایت', value: 'https://fragment.com', type: 'url', style: 'primary', emoji: '📎' },
				{ id: 'p2', title: 'اشتراک‌گذاری', value: 'share', type: 'share', style: 'default', emoji: '📢' },
			]);
		} else if (preset === 'buy') {
			setButtonsList([
				{ id: 'p1', title: 'خرید با تون‌کوین', value: 'https://fragment.com', type: 'payment', style: 'amber', emoji: '⚡' },
				{ id: 'p2', title: 'پشتیبانی فروش', value: 'https://t.me/support', type: 'url', style: 'primary', emoji: '💬' },
			]);
		} else if (preset === 'webapp') {
			setButtonsList([
				{ id: 'p1', title: 'باز کردن مینی‌اپ', value: 'https://t.me/iFragmentBot', type: 'webapp', style: 'cyan', emoji: '🚀' },
				{ id: 'p2', title: 'کانال رسمی', value: 'https://t.me/iFragmentNews', type: 'url', style: 'primary', emoji: '💎' },
			]);
		}
		showToast(t('channelInlineButtons.saveSuccess') || 'قالب دکمه‌ها اعمال شد!', 'success');
	};

	const addInlineButton = () => {
		const newBtn: InlineButtonItem = {
			id: String(Date.now()),
			title: 'دکمه جدید',
			value: 'https://t.me/...',
			type: 'url',
			style: 'primary',
			emoji: '🔗',
			count: 0,
		};
		setButtonsList((prev) => [...prev, newBtn]);
		haptic.impact('light');
	};

	const moveButtonUp = (index: number) => {
		if (index <= 0) return;
		haptic.impact('light');
		setButtonsList((prev) => {
			const list = [...prev];
			[list[index - 1], list[index]] = [list[index], list[index - 1]];
			return list;
		});
	};

	const moveButtonDown = (index: number) => {
		if (index >= buttonsList().length - 1) return;
		haptic.impact('light');
		setButtonsList((prev) => {
			const list = [...prev];
			[list[index + 1], list[index]] = [list[index], list[index + 1]];
			return list;
		});
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
						<div class="flex items-center justify-between gap-3 pb-3 border-b border-white/5">
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

						{/* Delay Before Post */}
						<div class="flex items-center justify-between gap-3">
							<div class="flex flex-col">
								<span class="text-[13px] font-bold text-white">تاخیر در ارسال به مقصد:</span>
								<span class="text-[10px] text-white/50">فاصله زمانی بین دریافت پست و انتشار نهایی</span>
							</div>
							<select
								value={pipelineDelay()}
								onChange={(e) => setPipelineDelay(e.currentTarget.value)}
								class="bg-[#090a0f] border border-white/10 rounded-[12px] px-3 py-1.5 text-[11px] font-bold text-white outline-none"
							>
								<option value="0">بدون تاخیر (فوری)</option>
								<option value="30s">۳۰ ثانیه</option>
								<option value="1m">۱ دقیقه</option>
								<option value="5m">۵ دقیقه</option>
								<option value="15m">۱۵ دقیقه</option>
							</select>
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

					{/* Pipeline Visual Flow Diagram */}
					<div class="bg-gradient-to-br from-[#121c26] via-[#0d141b] to-[#070b0e] border border-[#233547] rounded-[22px] p-4 flex flex-col gap-3 shadow-inner">
						<span class="text-[11px] font-black text-cyan-400 uppercase tracking-widest flex items-center gap-1.5">
							<span class="material-symbols-outlined text-[16px]">account_tree</span>
							<span>نمودار بصری جریان انتقال محتوا:</span>
						</span>
						<div class="flex items-center justify-between gap-2 pt-1">
							<div class="flex-1 bg-[#1c2c3d] border border-white/10 rounded-[14px] p-2.5 flex flex-col items-center text-center">
								<span class="text-[10px] text-white/50 font-mono">SOURCE</span>
								<span class="text-[12px] font-black text-white truncate max-w-full">
									{project()?.source_title || 'کانال ورودی'}
								</span>
							</div>
							<div class="flex flex-col items-center shrink-0 text-cyan-400">
								<span class="material-symbols-outlined text-[20px] animate-pulse">trending_flat</span>
								<span class="text-[8px] font-bold">{mode() === 'copy' ? 'کپی تمیز' : 'فوروارد'}</span>
							</div>
							<div class="flex-1 bg-[#1c2c3d] border border-white/10 rounded-[14px] p-2.5 flex flex-col items-center text-center">
								<span class="text-[10px] text-white/50 font-mono">TARGET</span>
								<span class="text-[12px] font-black text-white truncate max-w-full">
									{project()?.target_title || 'کانال خروجی'}
								</span>
							</div>
						</div>
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
							<div class="grid grid-cols-3 gap-1.5">
								<button
									type="button"
									onClick={() => setBioTarget('input')}
									class={`h-10 rounded-[12px] text-[10px] font-black flex items-center justify-center gap-1 transition-all ${
										bioTarget() === 'input'
											? 'bg-[#3390ec] text-white shadow-md'
											: 'bg-white/5 text-white/60 hover:bg-white/10'
									}`}
								>
									<span>{t('channelProjects.targetSelector.input')}</span>
								</button>
								<button
									type="button"
									onClick={() => setBioTarget('output')}
									class={`h-10 rounded-[12px] text-[10px] font-black flex items-center justify-center gap-1 transition-all ${
										bioTarget() === 'output'
											? 'bg-[#3390ec] text-white shadow-md'
											: 'bg-white/5 text-white/60 hover:bg-white/10'
									}`}
								>
									<span>{t('channelProjects.targetSelector.output')}</span>
								</button>
								<button
									type="button"
									onClick={() => setBioTarget('both')}
									class={`h-10 rounded-[12px] text-[10px] font-black flex items-center justify-center gap-1 transition-all ${
										bioTarget() === 'both'
											? 'bg-[#3390ec] text-white shadow-md'
											: 'bg-white/5 text-white/60 hover:bg-white/10'
									}`}
								>
									<span>{t('channelProjects.targetSelector.both')}</span>
								</button>
							</div>
						</div>

						{/* 🌟 TELEGRAM CHANNEL PROFILE HEADER SIMULATOR 🌟 */}
						<div class="bg-gradient-to-br from-[#121c26] via-[#0d141b] to-[#070b0e] border border-[#233547] rounded-[22px] p-4 flex flex-col gap-3 shadow-inner relative overflow-hidden">
							<div class="flex items-center justify-between text-[10px] font-mono">
								<span class="text-cyan-400 font-bold flex items-center gap-1">
									<span class="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
									<span>پیش‌نمایش زنده پروفایل تلگرام:</span>
								</span>
								<span class="text-white/40 font-mono">Live Channel Profile</span>
							</div>

							<div class="flex items-center gap-3.5 pt-1">
								<div class="w-13 h-13 rounded-full bg-gradient-to-tr from-[#3390ec] to-[#06b6d4] flex items-center justify-center text-[20px] text-white font-black shadow-[0_0_15px_rgba(51,144,236,0.3)] shrink-0 relative">
									<span>📢</span>
									<span class="absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-[#0d141b]" />
								</div>
								<div class="flex flex-col min-w-0 flex-1">
									<div class="flex items-center gap-1.5 flex-wrap">
										<span class="text-[14px] font-black text-white truncate">
											{bioDisplayInName() && bioNameTemplate()
												? bioNameTemplate().replace(/\$time/g, '14:30').replace(/\$members/g, '45,102')
												: (project()?.target_title || project()?.source_title || 'کانال رسمی')}
										</span>
										<span class="material-symbols-outlined text-[15px] text-cyan-400">verified</span>
									</div>
									<span class="text-[10px] text-cyan-300 font-bold">45,102 مشترک • به‌روزرسانی خودکار</span>
								</div>
							</div>

							{/* Rendered Live Bio Preview Text */}
							<div class="bg-[#24374a]/60 border border-white/5 rounded-[14px] p-3 text-[12px] text-white/90 leading-relaxed font-sans">
								<p class="whitespace-pre-line">
									{bioTemplate()
										? bioTemplate()
												.replace(/\$time/g, '14:30')
												.replace(/\$members/g, '45,102')
												.replace(/\$ton/g, '$5.50')
												.replace(/\$btc/g, '$64,200')
												.replace(/\$eth/g, '$3,450')
												.replace(/\$frg/g, '$1.20')
												.replace(/\$date/g, '13 Sep 2026')
												.replace(/\$day_name/g, 'Sunday')
												.replace(/\$countdown/g, '04d 12h')
										: 'بیوگرافی هنوز نوشته نشده است...'}
								</p>
							</div>
						</div>

						{/* Bio Template Input */}
						<div class="flex flex-col gap-2">
							<div class="flex items-center justify-between">
								<label class="text-[12px] font-bold text-white/80">{t('channelProjects.bioTab.template')}:</label>
								<span class="text-[10px] font-mono text-white/40">{bioTemplate().length} / 255</span>
							</div>
							<textarea
								rows={3}
								maxLength={255}
								value={bioTemplate()}
								onInput={(e) => setBioTemplate(e.currentTarget.value)}
								placeholder={t('channelProjects.bioTab.templatePlaceholder')}
								class="w-full bg-[#090a0f] rounded-[16px] p-3 text-[12px] text-white border border-white/10 focus:border-[#3390ec] outline-none leading-relaxed"
							/>

							{/* Interactive Dynamic Variables Chips */}
							<div class="flex flex-col gap-1.5 pt-1">
								<span class="text-[10px] text-white/40">{t('channelProjects.bioTab.variablesTitle')} (کلیک جهت درج):</span>
								<div class="flex items-center gap-1.5 flex-wrap">
									{[
										{ tag: '$members', label: 'اعضا', val: '45,102' },
										{ tag: '$time', label: 'ساعت', val: '14:30' },
										{ tag: '$date', label: 'تاریخ', val: '13 Sep' },
										{ tag: '$ton', label: 'تون', val: '$5.50' },
										{ tag: '$btc', label: 'بیت‌کوین', val: '$64k' },
										{ tag: '$eth', label: 'اتریوم', val: '$3.4k' },
										{ tag: '$frg', label: 'فرگمنت', val: '$1.20' },
										{ tag: '$countdown', label: 'شمارش', val: '04d' },
										{ tag: '$day_name', label: 'روز', val: 'یکشنبه' },
									].map((v) => (
										<button
											type="button"
											onClick={() => insertBioVar(v.tag)}
											class="bg-[#090a0f] hover:bg-white/10 transition-all border border-white/10 hover:border-cyan-400/40 rounded-[10px] px-2 py-1 flex items-center gap-1 active:scale-95 text-start group"
										>
											<span class="text-[11px] font-black text-cyan-400 font-mono group-hover:text-white">{v.tag}</span>
											<span class="text-[9px] text-white/40">{v.label}</span>
										</button>
									))}
								</div>
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
								<div class="flex flex-col gap-1">
									<div class="flex items-center justify-between">
										<span class="text-[10px] text-white/50">قالب نام نمایشی در تلگرام:</span>
										<span class="text-[10px] font-mono text-white/40">{bioNameTemplate().length} / 128</span>
									</div>
									<input
										type="text"
										maxLength={128}
										placeholder={t('channelProjects.bioTab.nameTemplatePlaceholder')}
										value={bioNameTemplate()}
										onInput={(e) => setBioNameTemplate(e.currentTarget.value)}
										class="w-full h-11 bg-[#090a0f] rounded-[14px] px-3 text-[12px] text-white border border-white/10 focus:border-[#3390ec] outline-none"
									/>
								</div>
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

						{/* Admin Notice Banner */}
						<div class="bg-amber-400/10 border border-amber-400/25 rounded-[16px] p-3 flex items-start gap-2.5 shadow-inner">
							<span class="material-symbols-outlined text-amber-400 text-[20px] shrink-0 mt-0.5">warning</span>
							<p class="text-[11px] text-amber-300 font-bold leading-relaxed">
								{t('channelAutoResponder.adminRequirementNotice') || 'ربات باید دسترسی ادمین با مجوز ارسال پیام در گروه گفتگوی متصل (Discussion Group) داشته باشد.'}
							</p>
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
									onClick={() => setArTarget('input')}
									class={`h-10 rounded-[12px] text-[10px] font-black flex items-center justify-center gap-1 transition-all ${
										arTarget() === 'input'
											? 'bg-[#3390ec] text-white shadow-md'
											: 'bg-white/5 text-white/60 hover:bg-white/10'
									}`}
								>
									<span>{t('channelProjects.targetSelector.input')}</span>
								</button>
								<button
									type="button"
									onClick={() => setArTarget('output')}
									class={`h-10 rounded-[12px] text-[10px] font-black flex items-center justify-center gap-1 transition-all ${
										arTarget() === 'output'
											? 'bg-[#3390ec] text-white shadow-md'
											: 'bg-white/5 text-white/60 hover:bg-white/10'
									}`}
								>
									<span>{t('channelProjects.targetSelector.output')}</span>
								</button>
								<button
									type="button"
									onClick={() => setArTarget('both')}
									class={`h-10 rounded-[12px] text-[10px] font-black flex items-center justify-center gap-1 transition-all ${
										arTarget() === 'both'
											? 'bg-[#3390ec] text-white shadow-md'
											: 'bg-white/5 text-white/60 hover:bg-white/10'
									}`}
								>
									<span>{t('channelProjects.targetSelector.both')}</span>
								</button>
							</div>
						</div>

						{/* 🌟 AUTO FIRST COMMENT WITH MODES 🌟 */}
						<div class="bg-[#090a0f] border border-white/5 rounded-[20px] p-3.5 flex flex-col gap-3">
							<div class="flex items-center justify-between pb-2 border-b border-white/5">
								<div class="flex flex-col">
									<span class="text-[13px] font-bold text-white">{t('channelProjects.responderTab.firstComment')}</span>
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
								<div class="flex flex-col gap-3 pt-1">
									{/* Mode Selection Pills */}
									<div class="flex flex-col gap-1.5">
										<span class="text-[11px] font-bold text-white/70">حالت کامنت اول:</span>
										<div class="grid grid-cols-3 gap-1.5">
											{[
												{ id: 'fixed', label: '📌 متن ثابت', desc: 'تک‌متن' },
												{ id: 'rotating', label: '🔄 چرخشی', desc: 'چندمتن' },
												{ id: 'ai', label: '🤖 هوشمند AI', desc: 'تحلیل محتوا' },
											].map((m) => (
												<button
													type="button"
													onClick={() => {
														haptic.impact('light');
														setArCommentMode(m.id as any);
													}}
													class={`py-2 px-1 rounded-[12px] text-[10px] font-black flex flex-col items-center gap-0.5 border transition-all ${
														arCommentMode() === m.id
															? 'bg-[#3390ec] text-white border-cyan-400 shadow-md'
															: 'bg-white/5 text-white/60 border-white/5 hover:bg-white/10'
													}`}
												>
													<span>{m.label}</span>
													<span class="text-[8px] opacity-75">{m.desc}</span>
												</button>
											))}
										</div>
									</div>

									{/* Mode Fixed */}
									<Show when={arCommentMode() === 'fixed'}>
										<div class="flex flex-col gap-1.5">
											<label class="text-[11px] font-bold text-white/70">متن کامنت ثابت:</label>
											<textarea
												rows={2}
												value={arFixedComment()}
												onInput={(e) => setArFixedComment(e.currentTarget.value)}
												placeholder={t('channelProjects.responderTab.fixedCommentPlaceholder')}
												class="w-full bg-[#12141C] rounded-[14px] p-2.5 text-[12px] text-white border border-white/10 focus:border-[#3390ec] outline-none"
											/>
										</div>
									</Show>

									{/* Mode Rotating */}
									<Show when={arCommentMode() === 'rotating'}>
										<div class="flex flex-col gap-2">
											<span class="text-[11px] font-bold text-white/70">
												کامنت‌های چرخشی تعریف‌شده ({arRotatingTexts().length}):
											</span>
											<div class="flex flex-col gap-1.5 max-h-40 overflow-y-auto">
												<For each={arRotatingTexts()}>
													{(commentText, i) => (
														<div class="flex items-center justify-between bg-[#12141C] px-3 py-2 rounded-[12px] border border-white/5">
															<span class="text-[11px] text-white/90 truncate flex-1">{commentText}</span>
															<button
																type="button"
																onClick={() => handleRemoveRotatingComment(i())}
																class="w-6 h-6 flex items-center justify-center text-rose-400 hover:text-rose-200"
															>
																<span class="material-symbols-outlined text-[16px]">close</span>
															</button>
														</div>
													)}
												</For>
											</div>
											<div class="flex gap-2 pt-1">
												<input
													type="text"
													placeholder="افزودن کامنت چرخشی جدید..."
													value={arNewRotatingText()}
													onInput={(e) => setArNewRotatingText(e.currentTarget.value)}
													class="flex-1 h-9 bg-[#12141C] rounded-[10px] px-3 text-[11px] text-white border border-white/10 outline-none"
												/>
												<button
													type="button"
													onClick={handleAddRotatingComment}
													disabled={!arNewRotatingText().trim()}
													class="px-3 bg-[#3390ec] text-white font-black text-[10px] rounded-[10px] disabled:opacity-40"
												>
													افزودن
												</button>
											</div>
										</div>
									</Show>

									{/* Mode AI */}
									<Show when={arCommentMode() === 'ai'}>
										<div class="bg-cyan-500/10 border border-cyan-500/20 rounded-[14px] p-3 flex flex-col gap-1">
											<span class="text-[12px] font-black text-cyan-400 flex items-center gap-1">
												<span class="material-symbols-outlined text-[16px]">auto_awesome</span>
												<span>تولید کامنت هوشمند با هوش مصنوعی</span>
											</span>
											<p class="text-[10px] text-cyan-200/80 leading-relaxed">
												ربات بلافاصله پس از نشر پست، با توجه به موضوع خبر اولین کامنت تحلیلی و تعاملی را ارسال می‌کند.
											</p>
										</div>
									</Show>

									{/* Attached Buttons Selector */}
									<div class="flex items-center justify-between pt-2 border-t border-white/5">
										<span class="text-[11px] font-bold text-white/70">دکمه شیشه‌ای متصل به کامنت:</span>
										<select
											value={arAttachButton()}
											onChange={(e) => setArAttachButton(e.currentTarget.value)}
											class="bg-[#12141C] border border-white/10 rounded-[10px] px-2 py-1 text-[11px] text-white outline-none"
										>
											<option value="">بدون دکمه</option>
											<option value="like_set">مجموعه لایک و دیس‌لایک</option>
											<option value="share_set">مجموعه لینک و اشتراک</option>
										</select>
									</div>
								</div>
							</Show>
						</div>

						{/* 🌟 LIVE TELEGRAM CHAT TESTER 🌟 */}
						<div class="bg-gradient-to-br from-[#121c26] via-[#0d141b] to-[#070b0e] border border-[#233547] rounded-[22px] p-3.5 flex flex-col gap-3 shadow-inner">
							<div class="flex items-center justify-between text-[10px] font-mono">
								<span class="text-cyan-400 font-bold flex items-center gap-1">
									<span class="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
									<span>شبیه‌ساز چت و تست زنده پاسخگوی خودکار:</span>
								</span>
								<span class="text-white/40 font-mono">Live Bot Simulator</span>
							</div>

							<div class="bg-[#1e2f40]/70 rounded-[16px] p-3 flex flex-col gap-2 max-h-56 overflow-y-auto">
								<For each={testChatMessages()}>
									{(msg) => (
										<div
											class={`flex flex-col max-w-[80%] rounded-[14px] p-2.5 text-[11px] ${
												msg.sender === 'user'
													? 'bg-[#3390ec] text-white self-end rounded-br-none shadow-md'
													: 'bg-[#2a3c4f] text-white/95 self-start rounded-bl-none border border-white/5'
											}`}
										>
											<span class="leading-relaxed">{msg.text}</span>
											<span class="text-[8px] opacity-60 self-end mt-0.5">{msg.time}</span>
										</div>
									)}
								</For>
								<Show when={isBotTyping()}>
									<div class="bg-[#2a3c4f] text-cyan-300 self-start rounded-[14px] rounded-bl-none px-3 py-1.5 text-[11px] flex items-center gap-1 animate-pulse border border-white/5">
										<span class="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
										<span>ربات در حال نوشتن...</span>
									</div>
								</Show>
							</div>

							<div class="flex gap-2">
								<input
									type="text"
									placeholder="پیام تست بفرستید (مثال: قیمت چنده؟ یا خرید)..."
									value={testChatInput()}
									onInput={(e) => setTestChatInput(e.currentTarget.value)}
									onKeyDown={(e) => {
										if (e.key === 'Enter') handleSendTestChat();
									}}
									class="flex-1 h-10 bg-[#090a0f] rounded-[12px] px-3 text-[11px] text-white border border-white/10 outline-none"
								/>
								<button
									type="button"
									onClick={handleSendTestChat}
									class="px-3 bg-gradient-to-r from-[#3390ec] to-[#06b6d4] text-white text-[11px] font-black rounded-[12px] active:scale-95 shadow-md"
								>
									ارسال تست
								</button>
							</div>
						</div>

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
											<span class="text-[11px] font-bold text-[#3390ec]">قانون #{idx() + 1}</span>
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

										<div class="grid grid-cols-3 gap-2">
											<div class="col-span-2 flex flex-col gap-1">
												<label class="text-[10px] text-white/50">{t('channelProjects.responderTab.ruleKeys')}:</label>
												<input
													type="text"
													placeholder="قیمت, خرید, پشتیبانی"
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
											<div class="col-span-1 flex flex-col gap-1">
												<label class="text-[10px] text-white/50">نوع تطبیق:</label>
												<select
													value={rule.match}
													onChange={(e) => {
														const val = e.currentTarget.value as any;
														setArRules((prev) =>
															prev.map((r) => (r.id === rule.id ? { ...r, match: val } : r)),
														);
													}}
													class="w-full h-10 bg-[#12141C] rounded-[12px] px-2 text-[11px] text-white border border-white/10 outline-none"
												>
													<option value="contains">شامل کلمه</option>
													<option value="exact">دقیقاً برابر</option>
													<option value="regex">عبارت Regex</option>
													<option value="ai">مفهومی AI</option>
												</select>
											</div>
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

						{/* ═══════ PRESETS (Glass Cards) ═══════ */}
						<div class="flex flex-col gap-2">
							<span class="text-[11px] font-black text-white/40 uppercase tracking-widest px-1">
								قالب‌های آماده دکمه‌ها:
							</span>
							<div class="grid grid-cols-2 gap-2">
								<button
									type="button"
									onClick={() => applyButtonPreset('like')}
									class="p-3 rounded-[16px] bg-[#090a0f] border border-white/10 hover:border-emerald-500/40 flex items-center gap-2.5 active:scale-95 transition-all text-start"
								>
									<span class="text-[20px]">👍</span>
									<div class="flex flex-col min-w-0">
										<span class="text-[12px] font-black text-white">لایک و تعامل</span>
										<span class="text-[10px] text-white/40">ثبت بازخورد لایک/دیس‌لایک</span>
									</div>
								</button>
								<button
									type="button"
									onClick={() => applyButtonPreset('link_share')}
									class="p-3 rounded-[16px] bg-[#090a0f] border border-white/10 hover:border-[#3390ec]/40 flex items-center gap-2.5 active:scale-95 transition-all text-start"
								>
									<span class="text-[20px]">📎</span>
									<div class="flex flex-col min-w-0">
										<span class="text-[12px] font-black text-white">لینک و اشتراک</span>
										<span class="text-[10px] text-white/40">هدایت به سایت و بازنشر</span>
									</div>
								</button>
								<button
									type="button"
									onClick={() => applyButtonPreset('buy')}
									class="p-3 rounded-[16px] bg-[#090a0f] border border-white/10 hover:border-amber-400/40 flex items-center gap-2.5 active:scale-95 transition-all text-start"
								>
									<span class="text-[20px]">🛒</span>
									<div class="flex flex-col min-w-0">
										<span class="text-[12px] font-black text-white">خرید و پرداخت</span>
										<span class="text-[10px] text-white/40">اتصال لینک پرداخت تون</span>
									</div>
								</button>
								<button
									type="button"
									onClick={() => applyButtonPreset('webapp')}
									class="p-3 rounded-[16px] bg-[#090a0f] border border-white/10 hover:border-cyan-400/40 flex items-center gap-2.5 active:scale-95 transition-all text-start"
								>
									<span class="text-[20px]">🚀</span>
									<div class="flex flex-col min-w-0">
										<span class="text-[12px] font-black text-white">تلگرام مینی‌اپ</span>
										<span class="text-[10px] text-white/40">ورود به وب‌اپلیکیشن ربات</span>
									</div>
								</button>
							</div>
						</div>

						{/* ═══════ TELEGRAM LIVE POST SIMULATOR ═══════ */}
						<div class="flex flex-col gap-2">
							<span class="text-[11px] font-black uppercase tracking-widest text-cyan-400 px-1 flex items-center gap-1">
								<span class="material-symbols-outlined text-[16px]">visibility</span>
								<span>پیش‌نمایش زنده در تلگرام (شبیه‌ساز پیام):</span>
							</span>
							<div class="bg-gradient-to-br from-[#1c2c3d] via-[#111a22] to-[#0a0f14] rounded-[20px] p-4 flex flex-col gap-2 border border-[#2a3c4f] shadow-inner">
								<div class="bg-[#2b5278] text-white rounded-[16px] rounded-br-sm p-3 shadow-md text-[12px] leading-relaxed">
									<span>{t('channelInlineButtons.mockPostText') || '🚀 پست تلگرام همراه با دکمه‌های چندرنگ و تعاملی:'}</span>
									<div class="flex items-center justify-end gap-1 mt-1 text-white/50 text-[10px]">
										<span>17:45</span>
										<span class="material-symbols-outlined text-[13px] text-[#60a5fa]">done_all</span>
									</div>
								</div>

								{/* Rendered Live Buttons */}
								<div class="grid grid-cols-2 gap-1.5 pt-1">
									<For each={buttonsList()}>
										{(btn) => {
											const styleClass =
												btn.style === 'primary'
													? 'bg-[#3390ec]/25 text-sky-200 border-[#3390ec]/50'
													: btn.style === 'success'
														? 'bg-emerald-500/25 text-emerald-200 border-emerald-500/50'
														: btn.style === 'danger'
															? 'bg-rose-500/25 text-rose-200 border-rose-500/50'
															: btn.style === 'amber'
																? 'bg-amber-500/25 text-amber-200 border-amber-500/50'
																: btn.style === 'cyan'
																	? 'bg-cyan-500/25 text-cyan-200 border-cyan-500/50'
																	: 'bg-white/10 text-white/90 border-white/15';

											return (
												<button
													type="button"
													onClick={() => {
														haptic.impact('medium');
														if (btn.type === 'counter') {
															setButtonsList((prev) =>
																prev.map((b) => (b.id === btn.id ? { ...b, count: (b.count || 0) + 1 } : b)),
															);
														}
													}}
													class={`h-9 px-2 rounded-[10px] text-[11px] font-black flex items-center justify-center gap-1 border shadow-sm active:scale-95 transition-transform ${styleClass}`}
												>
													<Show when={btn.emoji}>
														<span class="text-[13px]">{btn.emoji}</span>
													</Show>
													<span class="truncate">{btn.title}</span>
													<Show when={btn.type === 'counter' && btn.count !== undefined}>
														<span class="text-[9px] font-mono opacity-80">({btn.count})</span>
													</Show>
												</button>
											);
										}}
									</For>
								</div>
							</div>
						</div>

						{/* ═══════ BUTTONS LIST & BUILDER ═══════ */}
						<div class="flex flex-col gap-3 pt-2 border-t border-white/5">
							<div class="flex items-center justify-between">
								<span class="text-[13px] font-black text-white">مدیریت و چینش دکمه‌ها ({buttonsList().length}):</span>
								<button
									type="button"
									onClick={addInlineButton}
									class="px-3 py-1.5 rounded-[12px] bg-[#3390ec] text-white text-[11px] font-black flex items-center gap-1 active:scale-95 shadow-md"
								>
									<span class="material-symbols-outlined text-[16px]">add</span>
									<span>افزودن دکمه</span>
								</button>
							</div>

							<For each={buttonsList()}>
								{(btn, idx) => (
									<div class="bg-[#090a0f] border border-white/10 rounded-[18px] p-3.5 flex flex-col gap-3">
										{/* Item Header with Reorder and Delete */}
										<div class="flex items-center justify-between pb-2 border-b border-white/5">
											<div class="flex items-center gap-2">
												<span class="w-6 h-6 rounded-[8px] bg-white/10 text-white/70 font-mono text-[11px] font-bold flex items-center justify-center">
													{idx() + 1}
												</span>
												<span class="text-[12px] font-black text-white">{btn.title || 'دکمه بدون عنوان'}</span>
											</div>

											<div class="flex items-center gap-1">
												<button
													type="button"
													disabled={idx() === 0}
													onClick={() => moveButtonUp(idx())}
													class="w-7 h-7 rounded-[8px] bg-white/5 hover:bg-white/10 disabled:opacity-30 text-white/70 flex items-center justify-center text-[14px]"
													title="انتقال به بالا"
												>
													▲
												</button>
												<button
													type="button"
													disabled={idx() === buttonsList().length - 1}
													onClick={() => moveButtonDown(idx())}
													class="w-7 h-7 rounded-[8px] bg-white/5 hover:bg-white/10 disabled:opacity-30 text-white/70 flex items-center justify-center text-[14px]"
													title="انتقال به پایین"
												>
													▼
												</button>
												<button
													type="button"
													onClick={() => removeInlineButton(idx())}
													class="w-7 h-7 rounded-[8px] bg-rose-500/15 hover:bg-rose-500/25 text-rose-400 flex items-center justify-center ml-1"
													aria-label={t('channelProjects.buttonsTab.deleteButton')}
												>
													<span class="material-symbols-outlined text-[16px]">delete</span>
												</button>
											</div>
										</div>

										{/* Emoji & Title */}
										<div class="flex items-center gap-2">
											<div class="w-16 flex-shrink-0 flex flex-col gap-1">
												<span class="text-[9px] font-bold text-white/40">ایموجی:</span>
												<input
													type="text"
													value={btn.emoji || ''}
													onInput={(e) => {
														const val = e.currentTarget.value;
														setButtonsList((prev) =>
															prev.map((b, i) => (i === idx() ? { ...b, emoji: val } : b)),
														);
													}}
													placeholder="🔘"
													class="h-10 bg-[#12141C] text-white text-[16px] text-center rounded-[12px] border border-white/10 outline-none"
												/>
											</div>
											<div class="flex-1 flex flex-col gap-1">
												<span class="text-[9px] font-bold text-white/40">عنوان دکمه:</span>
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
													class="h-10 bg-[#12141C] rounded-[12px] px-3 text-[12px] font-bold text-white border border-white/10 outline-none"
												/>
											</div>
										</div>

										{/* Style Color Picker Pills */}
										<div class="flex flex-col gap-1.5">
											<span class="text-[9px] font-bold text-white/40">رنگ و ظاهر شیشه‌ای:</span>
											<div class="grid grid-cols-6 gap-1">
												{[
													{ id: 'primary', label: 'آبی', bg: 'bg-[#3390ec]' },
													{ id: 'success', label: 'سبز', bg: 'bg-emerald-500' },
													{ id: 'danger', label: 'قرمز', bg: 'bg-rose-500' },
													{ id: 'amber', label: 'طلا', bg: 'bg-amber-500' },
													{ id: 'cyan', label: 'فیروزه', bg: 'bg-cyan-500' },
													{ id: 'default', label: 'ساده', bg: 'bg-white/40' },
												].map((styleOption) => (
													<button
														type="button"
														onClick={() => {
															haptic.impact('light');
															setButtonsList((prev) =>
																prev.map((b, i) =>
																	i === idx() ? { ...b, style: styleOption.id as any } : b,
																),
															);
														}}
														class={`h-8 rounded-[10px] text-[10px] font-black flex items-center justify-center gap-1 border transition-all ${
															btn.style === styleOption.id
																? 'border-white text-white shadow-md'
																: 'border-white/10 text-white/50 opacity-60 hover:opacity-100'
														}`}
													>
														<span class={`w-2.5 h-2.5 rounded-full ${styleOption.bg}`} />
														<span>{styleOption.label}</span>
													</button>
												))}
											</div>
										</div>

										{/* Type & Value */}
										<div class="grid grid-cols-3 gap-2">
											<div class="flex flex-col gap-1 col-span-1">
												<span class="text-[9px] font-bold text-white/40">نوع:</span>
												<select
													value={btn.type}
													onChange={(e) => {
														const val = e.currentTarget.value as any;
														setButtonsList((prev) =>
															prev.map((b, i) => (i === idx() ? { ...b, type: val } : b)),
														);
													}}
													class="h-10 bg-[#12141C] rounded-[12px] px-2 text-[11px] text-white border border-white/10 outline-none"
												>
													<option value="url">لینک URL</option>
													<option value="counter">شمارنده لایک</option>
													<option value="share">اشتراک‌گذاری</option>
													<option value="webapp">مینی‌اپ</option>
													<option value="payment">پرداخت / خرید</option>
												</select>
											</div>

											<div class="flex flex-col gap-1 col-span-2">
												<span class="text-[9px] font-bold text-white/40">لینک / مقدار:</span>
												<input
													type="text"
													placeholder="https://t.me/..."
													value={btn.value}
													onInput={(e) => {
														const val = e.currentTarget.value;
														setButtonsList((prev) =>
															prev.map((b, i) => (i === idx() ? { ...b, value: val } : b)),
														);
													}}
													class="h-10 bg-[#12141C] rounded-[12px] px-3 text-[11px] font-mono text-white border border-white/10 outline-none"
													dir="ltr"
												/>
											</div>
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
							<div class="grid grid-cols-3 gap-1.5">
								<button
									type="button"
									onClick={() => setJrTarget('input')}
									class={`h-10 rounded-[12px] text-[10px] font-black flex items-center justify-center gap-1 transition-all ${
										jrTarget() === 'input'
											? 'bg-[#3390ec] text-white shadow-md'
											: 'bg-white/5 text-white/60 hover:bg-white/10'
									}`}
								>
									<span>{t('channelProjects.targetSelector.input')}</span>
								</button>
								<button
									type="button"
									onClick={() => setJrTarget('output')}
									class={`h-10 rounded-[12px] text-[10px] font-black flex items-center justify-center gap-1 transition-all ${
										jrTarget() === 'output'
											? 'bg-[#3390ec] text-white shadow-md'
											: 'bg-white/5 text-white/60 hover:bg-white/10'
									}`}
								>
									<span>{t('channelProjects.targetSelector.output')}</span>
								</button>
								<button
									type="button"
									onClick={() => setJrTarget('both')}
									class={`h-10 rounded-[12px] text-[10px] font-black flex items-center justify-center gap-1 transition-all ${
										jrTarget() === 'both'
											? 'bg-[#3390ec] text-white shadow-md'
											: 'bg-white/5 text-white/60 hover:bg-white/10'
									}`}
								>
									<span>{t('channelProjects.targetSelector.both')}</span>
								</button>
							</div>
						</div>

						{/* 🌟 SIMULATED JOIN REQUEST LIVE AUDIT CARD 🌟 */}
						<div class="bg-gradient-to-br from-[#121c26] via-[#0d141b] to-[#070b0e] border border-[#233547] rounded-[22px] p-3.5 flex flex-col gap-3 shadow-inner">
							<div class="flex items-center justify-between text-[10px] font-mono">
								<span class="text-cyan-400 font-bold flex items-center gap-1">
									<span class="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
									<span>شبیه‌ساز بررسی زنده درخواست عضویت:</span>
								</span>
								<span class="text-white/40 font-mono">Gatekeeper Guard</span>
							</div>

							<div class="bg-[#1c2c3d] border border-white/10 rounded-[16px] p-3 flex items-center justify-between gap-3">
								<div class="flex items-center gap-2.5 min-w-0">
									<div class="w-10 h-10 rounded-full bg-gradient-to-tr from-cyan-500 to-blue-500 flex items-center justify-center text-[16px] font-black text-white shrink-0">
										👤
									</div>
									<div class="flex flex-col min-w-0">
										<div class="flex items-center gap-1.5 flex-wrap">
											<span class="text-[12px] font-black text-white truncate">Ali Rezaei</span>
											<Show when={jrApprovePremium()}>
												<span class="text-[9px] font-black px-1.5 py-0.2 rounded bg-amber-400/20 text-amber-300 border border-amber-400/30">⭐ Premium</span>
											</Show>
										</div>
										<span class="text-[10px] text-white/50 font-mono">@ali_crypto (عضویت: ۴۵ روز پیش)</span>
									</div>
								</div>
								<span class="px-2.5 py-1 rounded-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-black shrink-0">
									تایید خودکار ✅
								</span>
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
								<span class="text-[12px] font-bold text-white">الزام به داشتن عکس پروفایل:</span>
								<button
									type="button"
									onClick={() => setJrApprovePhoto(!jrApprovePhoto())}
									class={`w-10 h-5 rounded-full transition-colors relative ${
										jrApprovePhoto() ? 'bg-cyan-500' : 'bg-white/20'
									}`}
								>
									<span
										class={`w-4 h-4 rounded-full bg-white absolute top-0.5 transition-transform ${
											jrApprovePhoto() ? 'right-0.5' : 'right-5'
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
										jrApproveAge() ? 'bg-rose-500' : 'bg-white/20'
									}`}
								>
									<span
										class={`w-4 h-4 rounded-full bg-white absolute top-0.5 transition-transform ${
											jrApproveAge() ? 'right-0.5' : 'right-5'
										}`}
									/>
								</button>
							</div>

							<div class="flex flex-col gap-2 pt-1">
								<div class="flex items-center justify-between">
									<label class="text-[11px] font-bold text-white/80">{t('channelProjects.joinTab.welcomeText')}:</label>
									<div class="flex items-center gap-1">
										<button
											type="button"
											onClick={() => setJrWelcome((prev) => prev + ' $name')}
											class="px-2 py-0.5 rounded-[6px] bg-white/5 text-cyan-400 font-mono text-[9px] border border-white/10"
										>
											+$name
										</button>
										<button
											type="button"
											onClick={() => setJrWelcome((prev) => prev + ' $username')}
											class="px-2 py-0.5 rounded-[6px] bg-white/5 text-cyan-400 font-mono text-[9px] border border-white/10"
										>
											+$username
										</button>
									</div>
								</div>
								<textarea
									rows={2}
									value={jrWelcome()}
									placeholder={t('channelProjects.joinTab.welcomeTextPlaceholder')}
									onInput={(e) => setJrWelcome(e.currentTarget.value)}
									class="w-full bg-[#090a0f] rounded-[14px] p-2.5 text-[12px] text-white border border-white/10 focus:border-[#3390ec] outline-none leading-relaxed"
								/>
							</div>
						</div>
					</div>
				</Show>

				{/* ═══════ TAB 6: AI COMPOSER (STUDIO MASTERPIECE) ═══════ */}
				<Show when={activeSection() === 'ai'}>
					<div class="flex flex-col gap-4">
						{/* Card 1: Master Activation & Guide */}
						<div class="bg-[#12141C] border border-white/10 rounded-[24px] p-4 flex flex-col gap-3 shadow-lg relative overflow-hidden">
							<div class="absolute -right-8 -top-8 w-28 h-28 bg-cyan-500/10 rounded-full blur-2xl pointer-events-none" />
							
							<div class="flex items-center justify-between gap-3 pb-3 border-b border-white/5 relative z-10">
								<div class="flex items-center gap-3">
									<div class="w-10 h-10 rounded-[14px] bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 flex items-center justify-center shrink-0">
										<span class="material-symbols-outlined text-[22px]">psychology</span>
									</div>
									<div class="flex flex-col">
										<span class="text-[14px] font-black text-white">{t('channelPosting.aiSmartEditorGuideTitle') || 'ویرایشگر هوشمند پست‌ها (AI Post Composer)'}</span>
										<span class="text-[10px] text-white/50">{t('channelPosting.aiComposerDesc') || 'موتور بازنویسی، زیباسازی و ساختاردهی حرفه‌ای به پست‌های ارسالی'}</span>
									</div>
								</div>
								<button
									type="button"
									onClick={() => {
										haptic.impact('light');
										setAiRewrite(!aiRewrite());
									}}
									class={`w-12 h-6 rounded-full transition-colors relative shrink-0 ${
										aiRewrite() ? 'bg-cyan-500' : 'bg-white/20'
									}`}
								>
									<span
										class={`w-5 h-5 rounded-full bg-white absolute top-0.5 transition-transform ${
											aiRewrite() ? 'right-0.5' : 'right-6'
										}`}
									/>
								</button>
							</div>

							<p class="text-[11px] text-white/60 leading-relaxed">
								{t('channelPosting.aiSmartEditorGuideDesc') ||
									'با فعال‌سازی این قابلیت، هر پستی که از کانال ورودی دریافت شود، ابتدا توسط مدل هوش مصنوعی مطابق مهارت و پرامپت انتخابی شما بازنویسی، زیبا و آماده انتشار در کانال مقصد می‌گردد.'}
							</p>
						</div>

						{/* Card 2: BYOK Engine & Provider Selection */}
						<div class="bg-[#12141C] border border-white/10 rounded-[24px] p-4 flex flex-col gap-4 shadow-lg">
							<div class="flex items-center justify-between">
								<div class="flex items-center gap-2">
									<span class="material-symbols-outlined text-cyan-400 text-[18px]">key</span>
									<span class="text-[13px] font-black text-white">مدل کلید اختصاصی (BYOK)</span>
								</div>
								<a
									href={
										(AI_PROVIDERS.find((p) => p.id === aiProvider()) || AI_PROVIDERS[0]).keyUrl
									}
									target="_blank"
									rel="noopener noreferrer"
									class="px-2.5 py-1 rounded-[10px] bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-[10px] font-black flex items-center gap-1 hover:bg-cyan-500/20 active:scale-95 transition-all"
								>
									<span class="material-symbols-outlined text-[13px]">open_in_new</span>
									<span>دریافت کلید API</span>
								</a>
							</div>

							<p class="text-[11px] text-white/50 leading-relaxed -mt-1">
								{t('channelPosting.byokDescription') ||
									'برای امنیت کامل و آزادی در تعداد درخواست‌ها، کلید وب‌سرویس مستقیم خود را وارد کنید. کلید شما کاملاً امن ذخیره و فقط برای پروژه شما استفاده می‌شود.'}
							</p>

							{/* Provider Chips Horizontal Slider */}
							<div class="flex flex-col gap-2">
								<span class="text-[11px] font-bold text-white/80">انتخاب سرویس‌دهنده هوش مصنوعی:</span>
								<div class="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 no-scrollbar">
									<For each={AI_PROVIDERS}>
										{(p) => (
											<button
												type="button"
												onClick={() => {
													setAiProvider(p.id);
													setConnectionStatus('idle');
													haptic.selection();
												}}
												class={`shrink-0 px-3 py-2 rounded-[14px] text-[11px] font-black border transition-all active:scale-95 flex items-center gap-1.5 ${
													aiProvider() === p.id
														? 'bg-cyan-500/15 border-cyan-500/60 text-cyan-300 shadow-[0_0_12px_rgba(6,182,212,0.25)]'
														: 'bg-white/5 border-white/5 text-white/60 hover:bg-white/10'
												}`}
											>
												<span>{p.label}</span>
												<Show when={p.free}>
													<span class="px-1.5 py-0.2 rounded bg-emerald-400/20 text-emerald-300 text-[8px] font-black uppercase">
														{t('channelPosting.free') || 'رایگان'}
													</span>
												</Show>
											</button>
										)}
									</For>
								</div>
							</div>

							{/* API Key Input & Test Connection */}
							<div class="flex flex-col gap-2">
								<div class="flex items-center justify-between">
									<span class="text-[11px] font-bold text-white/80">کلید API (API Key):</span>
									<span class="text-[10px] text-white/40 font-mono">
										پیش‌فرض: {(AI_PROVIDERS.find((p) => p.id === aiProvider()) || AI_PROVIDERS[0]).hint}
									</span>
								</div>
								<div class="flex items-center gap-2">
									<div class="relative flex-1">
										<input
											type={showApiKey() ? 'text' : 'password'}
											value={apiKey()}
											onInput={(e) => {
												setApiKey(e.currentTarget.value);
												setConnectionStatus('idle');
											}}
											placeholder={(AI_PROVIDERS.find((p) => p.id === aiProvider()) || AI_PROVIDERS[0]).hint}
											class="w-full h-11 bg-[#090a0f] rounded-[14px] pl-10 pr-3 text-[12px] font-mono text-white border border-white/10 focus:border-cyan-400 outline-none transition-colors"
										/>
										<button
											type="button"
											onClick={() => setShowApiKey(!showApiKey())}
											class="absolute left-2.5 top-2.5 text-white/40 hover:text-white transition-colors"
										>
											<span class="material-symbols-outlined text-[18px]">
												{showApiKey() ? 'visibility_off' : 'visibility'}
											</span>
										</button>
									</div>

									<button
										type="button"
										onClick={handleTestConnection}
										disabled={!apiKey().trim() || connectionStatus() === 'testing'}
										class="h-11 px-4 rounded-[14px] bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-[11px] font-black flex items-center justify-center gap-1.5 hover:bg-cyan-500/20 active:scale-95 transition-all disabled:opacity-40 shrink-0 min-w-[84px]"
									>
										<Show when={connectionStatus() === 'testing'}>
											<span class="w-4 h-4 border-2 border-cyan-400/30 border-t-cyan-400 rounded-full animate-spin" />
										</Show>
										<Show when={connectionStatus() === 'idle'}>
											<span class="material-symbols-outlined text-[16px]">sensors</span>
											<span>تست</span>
										</Show>
										<Show when={connectionStatus() === 'success'}>
											<span class="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]" />
											<span>وصل</span>
										</Show>
										<Show when={connectionStatus() === 'failed'}>
											<span class="w-2.5 h-2.5 rounded-full bg-rose-400 shadow-[0_0_8px_#f87171]" />
											<span>خطا</span>
										</Show>
									</button>
								</div>
							</div>
						</div>

						{/* Card 3: 5 Editorial Skill Cards */}
						<div class="bg-[#12141C] border border-white/10 rounded-[24px] p-4 flex flex-col gap-3 shadow-lg">
							<div class="flex items-center gap-2">
								<span class="material-symbols-outlined text-amber-400 text-[18px]">stars</span>
								<span class="text-[13px] font-black text-white">انتخاب مهارت و استایل نگارشی (Editorial Skill)</span>
							</div>

							<div class="grid grid-cols-1 gap-2 pt-1">
								<For each={EDITORIAL_SKILLS}>
									{(sk) => {
										const isSelected = () => selectedSkill() === sk.id;
										return (
											<div
												onClick={() => {
													setSelectedSkill(sk.id);
													haptic.selection();
												}}
												class={`p-3 rounded-[16px] border cursor-pointer transition-all flex items-start justify-between gap-3 ${
													isSelected()
														? 'bg-gradient-to-r ' + sk.color + ' shadow-md'
														: 'bg-white/5 border-white/5 hover:bg-white/10'
												}`}
											>
												<div class="flex items-start gap-2.5 min-w-0">
													<div
														class={`w-8 h-8 rounded-[10px] flex items-center justify-center shrink-0 mt-0.5 ${
															isSelected() ? 'bg-white/20 text-white' : 'bg-white/5 text-white/50'
														}`}
													>
														<span class="material-symbols-outlined text-[18px]">{sk.icon}</span>
													</div>
													<div class="flex flex-col min-w-0">
														<div class="flex items-center gap-2">
															<span class="text-[12px] font-black text-white">{sk.title}</span>
															<span class="text-[9px] text-white/40 font-mono">({sk.subtitle})</span>
														</div>
														<span class="text-[10px] text-white/60 leading-relaxed mt-0.5">
															{sk.desc}
														</span>
													</div>
												</div>
												<span
													class={`px-2 py-0.5 rounded-[6px] text-[9px] font-black shrink-0 ${
														isSelected()
															? 'bg-white/20 text-white'
															: 'bg-white/5 text-white/40'
													}`}
												>
													{sk.badge}
												</span>
											</div>
										);
									}}
								</For>
							</div>

							{/* Custom Skill Prompt Editor */}
							<Show when={selectedSkill() === 'custom'}>
								<div class="flex flex-col gap-2 pt-2 border-t border-white/5">
									<span class="text-[11px] font-bold text-sky-300 flex items-center gap-1">
										<span class="material-symbols-outlined text-[14px]">tune</span>
										<span>دستورالعمل سفارشی شما برای مدل هوش مصنوعی:</span>
									</span>
									<textarea
										rows={3}
										value={customPrompt()}
										onInput={(e) => setCustomPrompt(e.currentTarget.value)}
										placeholder="مثال: مانند یک تحلیلگر ارشد بازارهای مالی بنویس، از اصطلاحات تخصصی استفاده کن و در انتها دعوت به شرکت در نظرسنجی کن..."
										class="w-full bg-[#090a0f] rounded-[14px] p-3 text-[11px] text-white border border-white/10 focus:border-cyan-400 outline-none leading-relaxed"
									/>
								</div>
							</Show>
						</div>

						{/* Card 4: Quick Action Composer Tools */}
						<div class="bg-[#12141C] border border-white/10 rounded-[24px] p-4 flex flex-col gap-3 shadow-lg">
							<div class="flex items-center justify-between">
								<div class="flex items-center gap-2">
									<span class="material-symbols-outlined text-emerald-400 text-[18px]">build</span>
									<span class="text-[13px] font-black text-white">ابزارهای سریع تولید محتوا</span>
								</div>
								<span class="text-[10px] text-white/40 font-mono">Quick Tools</span>
							</div>

							<div class="flex flex-col gap-1.5">
								<div class="flex items-center justify-between">
									<span class="text-[11px] font-bold text-white/80">متن نمونه ورودی کانال:</span>
									<button
										type="button"
										onClick={() => {
											setTestAiInput('');
											setTestAiOutput('');
											haptic.impact('light');
										}}
										class="text-[10px] text-white/40 hover:text-white transition-colors"
									>
										پاکسازی
									</button>
								</div>
								<textarea
									rows={3}
									value={testAiInput()}
									onInput={(e) => setTestAiInput(e.currentTarget.value)}
									placeholder="متن اولیه یا پیش‌نویس پست را اینجا وارد کنید..."
									class="w-full bg-[#090a0f] rounded-[14px] p-3 text-[12px] text-white border border-white/10 focus:border-cyan-400 outline-none leading-relaxed"
								/>
							</div>

							{/* 4 Smart Action Buttons */}
							<div class="grid grid-cols-2 gap-2 pt-1">
								<button
									type="button"
									onClick={() => handleGenerateAiContent('generate')}
									disabled={isAiGenerating() || !testAiInput().trim()}
									class="h-11 rounded-[14px] bg-gradient-to-r from-cyan-500 to-[#3390ec] text-white text-[11px] font-black flex items-center justify-center gap-1.5 active:scale-95 shadow-md disabled:opacity-40 transition-all"
								>
									<Show
										when={isAiGenerating()}
										fallback={
											<>
												<span class="material-symbols-outlined text-[16px]">auto_awesome</span>
												<span>بازنویسی کامل</span>
											</>
										}
									>
										<span class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
									</Show>
								</button>

								<button
									type="button"
									onClick={() => handleGenerateAiContent('summarize')}
									disabled={isAiGenerating() || !testAiInput().trim()}
									class="h-11 rounded-[14px] bg-white/5 border border-white/10 text-white hover:bg-white/10 text-[11px] font-black flex items-center justify-center gap-1.5 active:scale-95 disabled:opacity-40 transition-all"
								>
									<span class="material-symbols-outlined text-[16px] text-emerald-400">summarize</span>
									<span>خلاصه‌سازی</span>
								</button>

								<button
									type="button"
									onClick={() => handleGenerateAiContent('suggestHashtags')}
									disabled={isAiGenerating() || !testAiInput().trim()}
									class="h-11 rounded-[14px] bg-white/5 border border-white/10 text-white hover:bg-white/10 text-[11px] font-black flex items-center justify-center gap-1.5 active:scale-95 disabled:opacity-40 transition-all"
								>
									<span class="material-symbols-outlined text-[16px] text-amber-400">tag</span>
									<span>پیشنهاد هشتگ</span>
								</button>

								<button
									type="button"
									onClick={() => handleGenerateAiContent('catchyHeadline')}
									disabled={isAiGenerating() || !testAiInput().trim()}
									class="h-11 rounded-[14px] bg-white/5 border border-white/10 text-white hover:bg-white/10 text-[11px] font-black flex items-center justify-center gap-1.5 active:scale-95 disabled:opacity-40 transition-all"
								>
									<span class="material-symbols-outlined text-[16px] text-rose-400">bolt</span>
									<span>تولید تیتر جذاب</span>
								</button>
							</div>
						</div>

						{/* Card 5: REAL TELEGRAM CHANNEL POST MOCKUP (VISUAL MASTERPIECE) */}
						<div class="bg-[#12141C] border border-white/10 rounded-[24px] p-4 flex flex-col gap-3 shadow-xl">
							<div class="flex items-center justify-between">
								<div class="flex items-center gap-2">
									<span class="material-symbols-outlined text-cyan-400 text-[18px]">preview</span>
									<span class="text-[13px] font-black text-white">پیش‌نمایش زنده در تلگرام</span>
								</div>

								{/* Before / After Selector Tabs */}
								<div class="flex items-center bg-white/5 p-0.5 rounded-[10px] border border-white/10">
									<button
										type="button"
										onClick={() => {
											haptic.impact('light');
											setPreviewMockupTab('raw');
										}}
										class={`px-2.5 py-1 rounded-[8px] text-[10px] font-black transition-all ${
											previewMockupTab() === 'raw'
												? 'bg-white/20 text-white shadow-sm'
												: 'text-white/40 hover:text-white/70'
										}`}
									>
										متن خام
									</button>
									<button
										type="button"
										onClick={() => {
											haptic.impact('light');
											setPreviewMockupTab('ai');
										}}
										class={`px-2.5 py-1 rounded-[8px] text-[10px] font-black transition-all flex items-center gap-1 ${
											previewMockupTab() === 'ai'
												? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 shadow-sm'
												: 'text-white/40 hover:text-white/70'
										}`}
									>
										<span class="material-symbols-outlined text-[12px]">auto_awesome</span>
										<span>هوش مصنوعی</span>
									</button>
								</div>
							</div>

							{/* Telegram Dark Wallpaper Simulation */}
							<div class="bg-gradient-to-br from-[#1a2b3c] via-[#111a22] to-[#0a0f14] rounded-[20px] p-4 min-h-[220px] flex flex-col justify-end relative overflow-hidden border border-[#233547] shadow-inner">
								<div class="absolute inset-0 bg-black/40 pointer-events-none" />

								{/* Channel Header Sim */}
								<div class="flex items-center justify-between pb-3 mb-2 border-b border-white/10 relative z-10">
									<div class="flex items-center gap-2 min-w-0">
										<div class="w-8 h-8 rounded-full bg-gradient-to-tr from-cyan-500 to-blue-500 flex items-center justify-center text-white text-[13px] font-black shrink-0">
											{project()?.target_title ? project()?.target_title?.charAt(0) : 'iF'}
										</div>
										<div class="flex flex-col min-w-0">
											<div class="flex items-center gap-1">
												<span class="text-[12px] font-black text-white truncate">
													{project()?.target_title || 'کانال مقصد iFragment'}
												</span>
												<span class="material-symbols-outlined text-[13px] text-cyan-400">verified</span>
											</div>
											<span class="text-[9px] text-white/40 font-mono">Channel • 14.8K subscribers</span>
										</div>
									</div>

									<button
										type="button"
										onClick={() => {
											const textToCopy = previewMockupTab() === 'ai' ? (testAiOutput() || testAiInput()) : testAiInput();
											navigator.clipboard.writeText(textToCopy);
											haptic.notify('success');
											showToast('متن پست در کلیپ‌بورد کپی شد!', 'success');
										}}
										class="p-1.5 rounded-[8px] bg-white/10 hover:bg-white/20 text-white/80 transition-colors"
										title="کپی متن پست"
									>
										<span class="material-symbols-outlined text-[16px]">content_copy</span>
									</button>
								</div>

								{/* Telegram Message Bubble */}
								<div class="flex flex-col max-w-[95%] relative z-10 self-start w-full">
									<div
										dir="auto"
										class="bg-[#182533] text-white rounded-[18px] rounded-bl-none rtl:rounded-br-none rtl:rounded-bl-[18px] p-3.5 shadow-xl text-[13px] leading-relaxed whitespace-pre-wrap border border-white/5"
									>
										<Show
											when={previewMockupTab() === 'ai'}
											fallback={
												<span class="text-white/80">
													{testAiInput() || 'متن خام هنوز وارد نشده است.'}
												</span>
											}
										>
											<div class="text-white/95 leading-relaxed font-sans">
												{testAiOutput() ||
													testAiInput() ||
													'متن نمونه خود را در کادر بالا وارد کرده و یکی از دکمه‌های بازنویسی را بزنید تا پیش‌نمایش زنده شکل گیرد.'}
											</div>
										</Show>

										{/* Dynamic Signature */}
										<div class="mt-2.5 pt-1.5 border-t border-white/10 text-[11px] text-cyan-300 font-bold flex items-center gap-1">
											<span class="material-symbols-outlined text-[13px]">signature</span>
											<span>{watermark() || '— کانال رسمی iFragment (امضای شما)'}</span>
										</div>

										{/* Timestamp, Views and Read Receipt */}
										<div class="flex items-center justify-end rtl:justify-start gap-1.5 mt-2 opacity-60 text-[10px] font-mono">
											<span class="flex items-center gap-0.5">
												<span class="material-symbols-outlined text-[11px]">visibility</span>
												<span>1.4K</span>
											</span>
											<span>•</span>
											<span>{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
											<span class="material-symbols-outlined text-[13px] text-cyan-400">done_all</span>
										</div>
									</div>

									{/* Interactive Inline Glass Buttons Mockup */}
									<div class="flex flex-col gap-1.5 mt-2 w-full">
										{/* Row 1: Reaction Counter Buttons */}
										<div class="flex gap-1.5 w-full">
											<button
												type="button"
												onClick={() => {
													haptic.impact('medium');
													if (mockupHasLiked()) {
														setMockupLikeCount((c) => c - 1);
														setMockupHasLiked(false);
													} else {
														setMockupLikeCount((c) => c + 1);
														setMockupHasLiked(true);
														if (mockupHasDisliked()) {
															setMockupDislikeCount((c) => c - 1);
															setMockupHasDisliked(false);
														}
													}
												}}
												class={`flex-1 py-2 rounded-[12px] text-[11px] font-black transition-all flex items-center justify-center gap-1.5 backdrop-blur-md shadow-md active:scale-95 border ${
													mockupHasLiked()
														? 'bg-cyan-500/25 text-cyan-300 border-cyan-400/50 shadow-[0_0_10px_rgba(6,182,212,0.3)]'
														: 'bg-[#1c2c3d]/90 hover:bg-[#233549] text-cyan-300 border-[#29425a]'
												}`}
											>
												<span>👍</span>
												<span>پسندیدم {mockupLikeCount()}</span>
											</button>

											<button
												type="button"
												onClick={() => {
													haptic.impact('medium');
													if (mockupHasDisliked()) {
														setMockupDislikeCount((c) => c - 1);
														setMockupHasDisliked(false);
													} else {
														setMockupDislikeCount((c) => c + 1);
														setMockupHasDisliked(true);
														if (mockupHasLiked()) {
															setMockupLikeCount((c) => c - 1);
															setMockupHasLiked(false);
														}
													}
												}}
												class={`flex-1 py-2 rounded-[12px] text-[11px] font-black transition-all flex items-center justify-center gap-1.5 backdrop-blur-md shadow-md active:scale-95 border ${
													mockupHasDisliked()
														? 'bg-rose-500/25 text-rose-300 border-rose-400/50 shadow-[0_0_10px_rgba(244,63,94,0.3)]'
														: 'bg-[#1c2c3d]/90 hover:bg-[#233549] text-rose-300 border-[#29425a]'
												}`}
											>
												<span>👎</span>
												<span>نپسندیدم {mockupDislikeCount()}</span>
											</button>
										</div>

										{/* Row 2: Navigation Buttons */}
										<div class="flex gap-1.5 w-full">
											<button
												type="button"
												onClick={() => {
													haptic.impact('light');
													showToast('هدایت به وب‌سایت شبیه‌سازی شد', 'info');
												}}
												class="flex-1 bg-[#1c2c3d]/90 hover:bg-[#233549] text-emerald-300 border border-[#29425a] py-2 rounded-[12px] text-[11px] font-black transition-all flex items-center justify-center gap-1.5 backdrop-blur-md shadow-md active:scale-95"
											>
												<span>📎</span>
												<span>مشاهده در سایت</span>
											</button>

											<button
												type="button"
												onClick={() => {
													haptic.impact('light');
													showToast('اشتراک‌گذاری شبیه‌سازی شد', 'info');
												}}
												class="flex-1 bg-[#1c2c3d]/90 hover:bg-[#233549] text-white border border-[#29425a] py-2 rounded-[12px] text-[11px] font-black transition-all flex items-center justify-center gap-1.5 backdrop-blur-md shadow-md active:scale-95"
											>
												<span>📢</span>
												<span>اشتراک‌گذاری</span>
											</button>
										</div>
									</div>
								</div>
							</div>

							{/* Glass Buttons Tip */}
							<div class="flex items-start gap-2 bg-cyan-500/10 border border-cyan-500/20 rounded-[14px] p-2.5 mt-1">
								<span class="material-symbols-outlined text-cyan-400 text-[18px] shrink-0 mt-0.5">
									info
								</span>
								<span class="text-[10px] text-cyan-300 leading-relaxed font-bold">
									💡 دکمه‌های شیشه‌ای پایین پست به صورت خودکار بر اساس پیکربندی شما در تب «دکمه‌های شیشه‌ای» به پست‌های ارسالی متصل می‌شوند.
								</span>
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

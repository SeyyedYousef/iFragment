import { useNavigate, useParams } from '@solidjs/router';
import { backButton } from '@tma.js/sdk-solid';
import {
	type Component,
	createEffect,
	createResource,
	createSignal,
	onCleanup,
	onMount,
} from 'solid-js';
import { channelApi } from '@/entities/channel/index.js';
import { isRtl } from '@/shared/i18n/index.js';
import { haptic } from '@/shared/lib/haptic.js';
import { showToast } from '@/shared/ui/index.js';
import { ProjectContextBar, ProjectHamburgerMenu } from '@/widgets/project/index.js';

export const ProjectPipelinePage: Component = () => {
	const params = useParams<{ projectId: string }>();
	const navigate = useNavigate();

	const [isMenuOpen, setIsMenuOpen] = createSignal(false);
	const [isSaving, setIsSaving] = createSignal(false);

	const [project, { refetch }] = createResource(
		() => params.projectId,
		(id) => channelApi.getProject(id),
	);

	// Pipeline signals
	const [autoPublish, setAutoPublish] = createSignal(false);
	const [removeAds, setRemoveAds] = createSignal(true);
	const [removeLinks, setRemoveLinks] = createSignal(false);
	const [removeHashtags, setRemoveHashtags] = createSignal(false);
	const [aiRewrite, setAiRewrite] = createSignal(false);
	const [mode, setMode] = createSignal<'copy' | 'forward'>('copy');
	const [watermark, setWatermark] = createSignal('');

	createEffect(() => {
		const p = project();
		if (p && p.pipeline_config) {
			const cfg = p.pipeline_config as any;
			if (typeof cfg.auto_publish === 'boolean') setAutoPublish(cfg.auto_publish);
			if (typeof cfg.remove_ads === 'boolean') setRemoveAds(cfg.remove_ads);
			if (typeof cfg.remove_links === 'boolean') setRemoveLinks(cfg.remove_links);
			if (typeof cfg.remove_hashtags === 'boolean') setRemoveHashtags(cfg.remove_hashtags);
			if (typeof cfg.ai_rewrite === 'boolean') setAiRewrite(cfg.ai_rewrite);
			if (cfg.mode === 'forward') setMode('forward');
			if (typeof cfg.watermark === 'string') setWatermark(cfg.watermark);
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
					ai_rewrite: aiRewrite(),
					mode: mode(),
					watermark: watermark().trim(),
				},
			});
			haptic.notify('success');
			showToast('تنظیمات پایپ‌لاین ذخیره شد', 'success');
			refetch();
		} catch (err: any) {
			haptic.notify('error');
			showToast('خطا در ذخیره تنظیمات', 'error');
		} finally {
			setIsSaving(false);
		}
	};

	return (
		<div
			class="min-h-screen bg-[#030303] pb-28 relative overflow-x-hidden text-white font-sans selection:bg-[#3390ec]/30"
			dir={isRtl() ? 'rtl' : 'ltr'}
		>
			{/* ═══════ STICKY HEADER ═══════ */}
			<div class="pt-6 pb-4 px-5 sticky top-0 bg-[#030303]/85 backdrop-blur-2xl z-30 border-b border-white/5 flex items-center justify-between shadow-sm">
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
							قوانین پایپ‌لاین محتوا
						</h1>
						<span class="text-[10px] font-bold text-white/50 uppercase tracking-wider">
							Processing & Publishing Rules
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

			<div class="px-5 pt-4 flex flex-col gap-4 max-w-md mx-auto relative z-10 w-full">
				<ProjectContextBar projectId={params.projectId} compact={true} />

				{/* Mode Selector */}
				<div class="bg-[#12141C] border border-white/10 rounded-[22px] p-4 flex flex-col gap-3">
					<span class="text-[13px] font-black text-white">حالت انتشار به خروجی</span>
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
							<span>Copy Mode (پیشنهادی)</span>
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
							<span>Forward Mode</span>
						</button>
					</div>
					<span class="text-[10px] text-white/40 leading-normal">
						در حالت Copy، پیام بدون انتساب و با ظاهر اختصاصی منتشر می‌شود و امکان ویرایش، حذف تبلیغات و افزودن دکمه‌ها فعال است.
					</span>
				</div>

				{/* Switches Card */}
				<div class="bg-[#12141C] border border-white/10 rounded-[24px] p-4 flex flex-col gap-4">
					{/* Auto Publish */}
					<div class="flex items-center justify-between gap-3 pb-3 border-b border-white/5">
						<div class="flex flex-col">
							<span class="text-[13px] font-bold text-white">ارسال خودکار بدون تایید</span>
							<span class="text-[10px] text-white/50">غیرفعال = ورود به صندوق بررسی (Review Inbox)</span>
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
							<span class="text-[13px] font-bold text-white">حذف تبلیغات متنی</span>
							<span class="text-[10px] text-white/50">شناسایی و پالایش عبارات اسپانسر و تبلیغاتی</span>
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
							<span class="text-[13px] font-bold text-white">حذف لینک‌ها و منشن‌ها</span>
							<span class="text-[10px] text-white/50">حذف آیدی‌های مبدا (@username و t.me/...)</span>
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
							<span class="text-[13px] font-bold text-white">حذف هشتگ‌های مبدا</span>
							<span class="text-[10px] text-white/50">پاکسازی هشتگ‌های قدیمی متن</span>
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

					{/* AI Rewrite */}
					<div class="flex items-center justify-between gap-3">
						<div class="flex flex-col">
							<span class="text-[13px] font-bold text-white">بازنویسی هوش مصنوعی</span>
							<span class="text-[10px] text-white/50">تغییر لحن و اختصاصی‌سازی متن با هوش مصنوعی</span>
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
				</div>

				{/* Watermark Input */}
				<div class="bg-[#12141C] border border-white/10 rounded-[22px] p-4 flex flex-col gap-2">
					<span class="text-[13px] font-bold text-white">امضا و واترمارک کانال مقصد</span>
					<input
						type="text"
						placeholder="مثال: 📢 عضویت در کانال: @my_channel"
						value={watermark()}
						onInput={(e) => setWatermark(e.currentTarget.value)}
						class="w-full h-12 bg-[#090a0f] rounded-[16px] px-4 text-[13px] text-white border border-white/10 focus:border-[#3390ec] outline-none"
					/>
					<span class="text-[10px] text-white/40">این متن به انتهای تمامی پست‌های منتشرشده اضافه می‌شود.</span>
				</div>

				{/* Save Button */}
				<button
					type="button"
					disabled={isSaving()}
					onClick={handleSave}
					class="w-full h-14 bg-gradient-to-r from-[#3390ec] to-[#2b7ec9] text-white font-black text-[13px] rounded-[18px] flex items-center justify-center gap-2 active:scale-95 shadow-lg"
				>
					<span class="material-symbols-outlined text-[20px]">save</span>
					<span>{isSaving() ? 'در حال ذخیره...' : 'ذخیره تغییرات پایپ‌لاین'}</span>
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

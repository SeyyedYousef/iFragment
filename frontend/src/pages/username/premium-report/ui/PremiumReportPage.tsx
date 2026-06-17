import { Motion } from '@motionone/solid';
import { useNavigate, useSearchParams } from '@solidjs/router';
import { backButton, openLink, openTelegramLink } from '@tma.js/sdk-solid';
import { Component, createMemo, createSignal, For, onCleanup, onMount, Show } from 'solid-js';
import type { SaleRecord } from '@/entities/username/api/index.js';
import { requestPremiumReport, usePremiumReport } from '@/entities/username/api/index.js';
import { formatNumber, useI18n } from '@/shared/i18n/index.js';
import { openInvoice } from '@/shared/lib/telegram-native.js';

const tooltipDict = {
	wallet_portfolio: {
		en: "Total value of all assets held in the owner's wallet",
		fa: 'ارزش کل دارایی‌های موجود در کیف پول مالک',
		ru: 'Общая стоимость всех активов в кошельке владельца',
		ar: 'القيمة الإجمالية لجميع الأصول الموجودة في محفظة المالك',
		zh: '所有者钱包中持有的所有资产的总价值',
	},
	has_ton_synergy: {
		en: 'Indicates if the username aligns well with the TON ecosystem',
		fa: 'نشان می‌دهد که آیا نام کاربری با اکوسیستم TON همسو است یا خیر',
		ru: 'Указывает, хорошо ли имя пользователя согласуется с экосистемой TON',
		ar: 'يشير إلى ما إذا كان اسم المستخدم يتماشى جيدًا مع نظام TON البيئي',
		zh: '指示用户名是否与 TON 生态系统良好契合',
	},
	roi_percentage: {
		en: 'Estimated Return on Investment based on historical sales',
		fa: 'بازده تخمینی سرمایه‌گذاری بر اساس فروش‌های گذشته',
		ru: 'Предполагаемая рентабельность инвестиций на основе исторических продаж',
		ar: 'العائد المقدر على الاستثمار بناءً على المبيعات التاريخية',
		zh: '基于历史销售情况的预计投资回报率',
	},
	channel_empire_reach: {
		en: 'Potential audience reach if used for a Telegram channel',
		fa: 'دسترسی بالقوه به مخاطبان در صورت استفاده برای کانال تلگرام',
		ru: 'Потенциальный охват аудитории при использовании для Telegram-канала',
		ar: 'الوصول المحتمل للجمهور إذا تم استخدامه لقناة تيليجرام',
		zh: '如果用于 Telegram 频道的潜在受众范围',
	},
	potential_buyers: {
		en: 'List of wallets with high balance that might be interested',
		fa: 'لیست کیف پول‌های با موجودی بالا که ممکن است علاقه‌مند باشند',
		ru: 'Список кошельков с высоким балансом, которые могут быть заинтересованы',
		ar: 'قائمة المحافظ ذات الرصيد المرتفع التي قد تكون مهتمة',
		zh: '可能感兴趣的高余额钱包列表',
	},
};

const Tooltip: Component<{ textKey: keyof typeof tooltipDict; locale: string }> = (props) => {
	const currentLocale = () =>
		(['en', 'fa', 'ru', 'ar', 'zh'].includes(props.locale) ? props.locale : 'en') as
			| 'en'
			| 'fa'
			| 'ru'
			| 'ar'
			| 'zh';
	const text = () => tooltipDict[props.textKey][currentLocale()];
	const isRtl = () => currentLocale() === 'fa' || currentLocale() === 'ar';

	return (
		<div class="group relative flex items-center justify-center cursor-help ml-1">
			<span class="material-symbols-outlined text-[#8e8e93] text-[14px]">info</span>
			<div
				class="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block w-48 p-2 bg-[#1c1c1c] text-white text-[10px] rounded-lg shadow-xl border border-[#2a2a2a] z-50 pointer-events-none"
				dir={isRtl() ? 'rtl' : 'ltr'}
			>
				{text()}
				<div class="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-[#1c1c1c]"></div>
			</div>
		</div>
	);
};

type ApiError = Error & { response?: { status?: number; data?: { message?: string } } };

const Skeleton: Component = () => (
	<div class="animate-pulse space-y-8">
		<div class="flex flex-col items-center gap-4">
			<div class="w-32 h-6 bg-[#1c1c1c] rounded-full border border-[#2a2a2a]" />
			<div class="w-56 h-12 bg-[#1c1c1c] rounded-2xl border border-[#2a2a2a]" />
			<div class="w-24 h-8 bg-[#1c1c1c] rounded-xl border border-[#2a2a2a]" />
		</div>
		<div class="w-full h-64 bg-[#1c1c1c] rounded-[40px] border border-[#2a2a2a]" />
		<div class="grid grid-cols-2 gap-4">
			<div class="h-24 bg-[#1c1c1c] rounded-3xl border border-[#2a2a2a]" />
			<div class="h-24 bg-[#1c1c1c] rounded-3xl border border-[#2a2a2a]" />
			<div class="h-32 bg-[#1c1c1c] rounded-3xl col-span-2 border border-[#2a2a2a]" />
		</div>
	</div>
);

export const PremiumReportPage: Component = () => {
	const [searchParams] = useSearchParams();
	const navigate = useNavigate();
	const { t, locale } = useI18n();
	const username = () => searchParams.u || '';
	const [isPaying, setIsPaying] = createSignal(false);
	const [paymentError, setPaymentError] = createSignal('');

	const report = usePremiumReport(username);
	const isPaymentRequired = () => {
		const err = report.error as ApiError | null;
		if (!err) return false;
		const status = err.response?.status;
		const message = err.response?.data?.message || err.message || '';
		return status === 402 || /payment[_ ]required/i.test(message);
	};

	onMount(() => {
		backButton.show();
		const unsubscribe = backButton.onClick(() => {
			if (window.history.length > 1) navigate(-1);
			else navigate('/');
		});
		onCleanup(() => {
			unsubscribe();
			backButton.hide();
		});
	});

	const handleShare = () => {
		const text = t('pages.premiumReport.shareText')
			.replace('{u}', username())
			.replace('{score}', String(report.data?.rarity_score || 0));

		const shareUrl = `https://t.me/share/url?url=${encodeURIComponent('https://t.me/iFragmentBot/app')}&text=${encodeURIComponent(text)}`;
		openTelegramLink(shareUrl);
	};

	const handlePayment = async () => {
		if (!username() || isPaying()) return;
		setPaymentError('');
		setIsPaying(true);
		try {
			const { invoice_link } = await requestPremiumReport(username());
			const status = await openInvoice(invoice_link);
			if (status === 'paid') {
				for (let attempt = 0; attempt < 5; attempt += 1) {
					try {
						await report.refetch();
					} catch (_e) {
						// Ignore fetch errors during polling
					}
					if (report.data) return;
					await new Promise((resolve) => setTimeout(resolve, 800));
				}
				setPaymentError(t('pages.premiumReport.unlockPending'));
			} else {
				setPaymentError(t('pages.premiumReport.paymentNotCompleted'));
			}
		} catch (err: any) {
			setPaymentError(
				err?.response?.data?.error ||
					err?.response?.data?.message ||
					err?.message ||
					t('pages.premiumReport.paymentStartFailed'),
			);
		} finally {
			setIsPaying(false);
		}
	};

	const openFragment = () => {
		const fragmentUrl = report.data?.fragment_url;
		if (!fragmentUrl) return;
		try {
			const url = new URL(fragmentUrl);
			if (url.protocol === 'https:' && url.hostname === 'fragment.com') {
				openLink(url.toString());
			}
		} catch {
			// Ignore malformed external URLs from upstream data.
		}
	};

	const usdValue = (ton?: number) => {
		const rate = report.data?.exchange_rate;
		if (ton === undefined || !rate) return '';
		return (ton * rate).toFixed(2);
	};

	const paidSales = createMemo(() => {
		const sales = report.data?.past_sales || [];
		return sales
			.filter(
				(sale): sale is SaleRecord =>
					Number(sale.price) > 0 && !!sale.date && !Number.isNaN(new Date(sale.date).getTime()),
			)
			.slice()
			.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
	});

	const priceStats = createMemo(() => {
		const sales = paidSales();
		if (sales.length === 0) return { min: 0, max: 0, span: 1 };
		const prices = sales.map((sale) => sale.price);
		const min = Math.min(...prices);
		const max = Math.max(...prices);
		return { min, max, span: max - min || 1 };
	});

	const chartPoints = createMemo(() => {
		const sales = paidSales();
		if (sales.length === 0) return '';
		const { min, span } = priceStats();
		return sales
			.map((sale, index) => {
				const x = sales.length === 1 ? 160 : 16 + (index / (sales.length - 1)) * 288;
				const y = 112 - ((sale.price - min) / span) * 88;
				return `${x},${y}`;
			})
			.join(' ');
	});

	const confidencePercent = () => Math.round((report.data?.value_estimate?.confidence || 0) * 100);

	const getFormatType = (score: number) => {
		const isFa = locale() === 'fa';
		if (score > 5000) return isFa ? 'افسانه‌ای' : 'Legendary';
		if (score > 2000) return isFa ? 'فوق‌العاده کمیاب' : 'Ultra Rare';
		if (score > 1000) return isFa ? 'کمیاب' : 'Rare';
		if (score > 500) return isFa ? 'غیرمعمول' : 'Uncommon';
		return isFa ? 'استاندارد' : 'Standard';
	};

	return (
		<div class="min-h-screen bg-[#0a0b0e] text-white p-4 pb-32 safe-area-bottom">
			<Show when={!report.isLoading} fallback={<Skeleton />}>
				<Show when={report.error}>
					<div class="flex flex-col items-center justify-center pt-20">
						<Show
							when={isPaymentRequired()}
							fallback={
								<>
									<span class="material-symbols-outlined text-[48px] text-red-500 mb-4">error</span>
									<p class="text-white/80 font-bold text-center mb-4">
										{report.error?.message || 'Error loading report'}
									</p>
									<button
										class="px-6 py-3 bg-[#3390ec] active:scale-95 transition-all rounded-xl font-black uppercase tracking-wider"
										onClick={() => report.refetch().catch(() => {})}
										aria-label="Retry connection"
									>
										{locale() === 'fa' ? 'تلاش مجدد اتصال' : 'Retry Connection'}
									</button>
								</>
							}
						>
							<span class="material-symbols-outlined text-[48px] text-[#3390ec] mb-4">lock</span>
							<h2 class="text-2xl font-black text-center mb-2">@{username()}</h2>
							<p class="text-[#a6a6ad] font-bold text-center mb-6 max-w-[320px]">
								{t('pages.premiumReport.paymentRequired')}
							</p>
							<button
								class="px-6 py-3 bg-[#3390ec] active:scale-95 transition-all rounded-xl font-black uppercase tracking-wider disabled:opacity-50"
								onClick={handlePayment}
								disabled={isPaying()}
								aria-busy={isPaying()}
							>
								{isPaying()
									? t('pages.premiumReport.openingInvoice')
									: t('pages.premiumReport.unlock')}
							</button>
							<Show when={paymentError()}>
								<p class="text-red-400 text-xs font-bold text-center mt-4" aria-live="polite">
									{paymentError()}
								</p>
							</Show>
						</Show>
					</div>
				</Show>

				<Show when={report.data}>
					<Motion.div
						initial={{ opacity: 0, scale: 0.98 }}
						animate={{ opacity: 1, scale: 1 }}
						transition={{ duration: 0.5, easing: [0.23, 1, 0.32, 1] }}
					>
						{/* ── HEADER ── */}
						<div class="text-center mb-8">
							<div class="inline-block px-4 py-1.5 rounded-full bg-[#3390ec]/10 border border-[#3390ec]/20 text-[#3390ec] text-[10px] font-black uppercase tracking-widest mb-4">
								{locale() === 'fa' ? 'اطلاعات هوشمند جهانی' : 'Global Intelligence'}
							</div>
							<h1 class="text-4xl font-black tracking-tight text-white mb-4">@{username()}</h1>

							<div class="flex flex-wrap items-center justify-center gap-2">
								<span
									class={`px-3 py-1.5 rounded-lg text-xs font-black uppercase border shadow-sm ${
										report.data?.status === 'available' ||
										report.data?.status === 'purchase_available'
											? 'bg-[#34c759]/10 text-[#34c759] border-[#34c759]/20'
											: report.data?.status === 'on_auction' || report.data?.status === 'on_sale'
												? 'bg-[#ff9500]/10 text-[#ff9500] border-[#ff9500]/20'
												: 'bg-[#ff3b30]/10 text-[#ff3b30] border-[#ff3b30]/20'
									}`}
								>
									{report.data?.status === 'purchase_available'
										? locale() === 'fa'
											? 'موجود برای خرید'
											: 'Purchase Available'
										: report.data?.status
											? t(`pages.premiumReport.status.${report.data.status}` as any)
											: ''}
								</span>
								<Show when={report.data?.peer_type && report.data.peer_type !== 'unknown'}>
									<span class="px-3 py-1.5 rounded-lg text-xs font-black uppercase border bg-[#1c1c1c] text-[#8e8e93] border-[#2a2a2a]">
										{locale() === 'fa'
											? report.data?.peer_type === 'user'
												? 'کاربر'
												: report.data?.peer_type === 'channel'
													? 'کانال'
													: report.data?.peer_type === 'bot'
														? 'ربات'
														: 'نامشخص'
											: report.data?.peer_type}
									</span>
								</Show>
							</div>

							{/* Badges / Warnings */}
							<div class="flex flex-wrap items-center justify-center gap-2 mt-3">
								<Show when={report.data?.is_verified}>
									<span class="flex items-center gap-1 px-2.5 py-1 bg-blue-500/20 border border-blue-500/30 text-blue-400 rounded-md text-[10px] font-bold uppercase">
										<span class="material-symbols-outlined text-[12px]">verified</span>{' '}
										{locale() === 'fa' ? 'تایید شده' : 'Verified'}
									</span>
								</Show>
								<Show when={report.data?.is_premium}>
									<span class="flex items-center gap-1 px-2.5 py-1 bg-blue-600/20 border border-blue-600/30 text-blue-400 rounded-md text-[10px] font-bold uppercase">
										<span class="material-symbols-outlined text-[12px]">star</span>{' '}
										{locale() === 'fa' ? 'پرمیوم' : 'Premium'}
									</span>
								</Show>
								<Show when={report.data?.is_scam}>
									<span class="flex items-center gap-1 px-2.5 py-1 bg-red-500/20 border border-red-500/30 text-red-400 rounded-md text-[10px] font-bold uppercase">
										<span class="material-symbols-outlined text-[12px]">warning</span>{' '}
										{locale() === 'fa' ? 'کلاهبرداری' : 'Scam'}
									</span>
								</Show>
								<Show when={report.data?.is_fake}>
									<span class="flex items-center gap-1 px-2.5 py-1 bg-orange-500/20 border border-orange-500/30 text-orange-400 rounded-md text-[10px] font-bold uppercase">
										<span class="material-symbols-outlined text-[12px]">report</span>{' '}
										{locale() === 'fa' ? 'جعلی (Fake)' : 'Fake'}
									</span>
								</Show>
							</div>
						</div>

						{/* ── MAIN METRICS (Rarity & Value) ── */}
						<div class="bg-[#141518] border border-[#2a2a2a] rounded-[32px] p-6 mb-4 relative overflow-hidden shadow-[0_10px_30px_rgba(0,0,0,0.5)]">
							<div class="absolute -right-10 -top-10 opacity-5 pointer-events-none">
								<span class="material-symbols-outlined" style={{ 'font-size': '200px' }}>
									diamond
								</span>
							</div>

							<div class="grid grid-cols-2 gap-4 items-center">
								<div class="flex flex-col items-center border-r border-[#2a2a2a] pr-4">
									<span class="text-[10px] text-[#8e8e93] font-black uppercase tracking-widest mb-2 flex items-center gap-1">
										<span class="material-symbols-outlined text-[14px]">stars</span>{' '}
										{locale() === 'fa' ? 'کمیابی' : 'Rarity'}
									</span>
									<div class="flex items-baseline gap-1">
										<span class="text-4xl font-black text-[#3390ec]">
											{report.data?.rarity_score}
										</span>
										<span class="text-sm text-white/40 font-bold">/10k</span>
									</div>
									<span class="text-[11px] font-bold text-white/60 mt-1">
										{getFormatType(report.data?.rarity_score || 0)}
									</span>
								</div>

								<div class="flex flex-col items-center pl-4">
									<span class="text-[10px] text-[#8e8e93] font-black uppercase tracking-widest mb-2 flex items-center gap-1">
										<span class="material-symbols-outlined text-[14px]">query_stats</span>{' '}
										{locale() === 'fa' ? 'ارزش تخمینی' : 'Est. Value'}
									</span>
									<div class="flex items-baseline gap-1">
										<span class="text-3xl font-black text-white">
											{report.data?.estimated_value?.toFixed(1) || 'N/A'}
										</span>
										<span class="text-sm text-[#3390ec] font-bold">TON</span>
									</div>
									<Show
										when={
											report.data?.estimated_value !== undefined &&
											report.data?.exchange_rate !== undefined
										}
									>
										<span class="text-[11px] font-bold text-[#8e8e93] mt-0.5">
											~${(report.data!.estimated_value! * report.data!.exchange_rate!).toFixed(2)}
										</span>
									</Show>
									<Show when={report.data?.value_estimate}>
										<span class="text-[10px] font-bold text-[#8e8e93] mt-1">
											{report.data!.value_estimate!.p10_ton.toFixed(1)}-
											{report.data!.value_estimate!.p90_ton.toFixed(1)} TON
										</span>
									</Show>
									<span class="text-[10px] font-bold text-[#34c759] mt-1.5 flex items-center gap-1 bg-[#34c759]/10 px-2 py-0.5 rounded">
										<span class="material-symbols-outlined text-[12px]">trending_up</span>{' '}
										{locale() === 'fa' ? 'دارایی قوی' : 'Strong Asset'}
									</span>
								</div>
							</div>
						</div>

						<Show when={report.data?.value_estimate}>
							<div class="bg-[#141518] border border-[#2a2a2a] p-5 rounded-[24px] mb-4">
								<div class="flex items-center justify-between mb-4">
									<h3 class="text-[#8e8e93] text-xs font-black uppercase tracking-widest flex items-center gap-2">
										<span class="material-symbols-outlined text-[16px]">analytics</span>{' '}
										{locale() === 'fa' ? 'مدل قیمت‌گذاری' : 'Price Model'}
									</h3>
									<span class="text-[10px] font-black text-[#34c759] bg-[#34c759]/10 border border-[#34c759]/20 px-2.5 py-1 rounded-lg">
										{confidencePercent()}% {locale() === 'fa' ? 'اطمینان' : 'confidence'}
									</span>
								</div>
								<div class="grid grid-cols-3 gap-2">
									<div class="bg-[#1c1c1c] rounded-xl border border-[#2a2a2a] p-3">
										<span class="text-[9px] text-[#8e8e93] font-black uppercase">P10</span>
										<div class="text-sm font-black text-white mt-1">
											{report.data!.value_estimate!.p10_ton.toFixed(1)}
										</div>
									</div>
									<div class="bg-[#1c1c1c] rounded-xl border border-[#3390ec]/30 p-3">
										<span class="text-[9px] text-[#3390ec] font-black uppercase">
											{locale() === 'fa' ? 'میانه' : 'Median'}
										</span>
										<div class="text-sm font-black text-white mt-1">
											{report.data!.value_estimate!.p50_ton.toFixed(1)}
										</div>
									</div>
									<div class="bg-[#1c1c1c] rounded-xl border border-[#2a2a2a] p-3">
										<span class="text-[9px] text-[#8e8e93] font-black uppercase">P90</span>
										<div class="text-sm font-black text-white mt-1">
											{report.data!.value_estimate!.p90_ton.toFixed(1)}
										</div>
									</div>
								</div>
								<Show when={report.data?.value_estimate?.signals?.length}>
									<div class="flex flex-wrap gap-1.5 mt-4">
										<For each={report.data?.value_estimate?.signals?.slice(0, 6)}>
											{(signal) => (
												<span class="text-[9px] font-bold uppercase text-[#8e8e93] bg-[#1c1c1c] border border-[#2a2a2a] px-2 py-1 rounded-md">
													{signal.split('_').join(' ')}
												</span>
											)}
										</For>
									</div>
								</Show>
							</div>
						</Show>

						{/* ── LINGUISTIC & SEARCH DATA ── */}
						<div class="grid grid-cols-2 gap-3 mb-4">
							<div class="bg-[#141518] border border-[#2a2a2a] p-4 rounded-[24px]">
								<span class="text-[10px] text-[#8e8e93] font-black uppercase tracking-widest flex items-center gap-1">
									<span class="material-symbols-outlined text-[14px]">spellcheck</span>{' '}
									{locale() === 'fa' ? 'زبان‌شناسی' : 'Linguistic'}
								</span>
								<div class="flex items-end justify-between mt-3">
									<span class="text-2xl font-black text-white">
										{report.data?.linguistic_score?.toFixed(0)}
										<span class="text-xs text-white/30 ml-1">/100</span>
									</span>
								</div>
								<div class="flex flex-wrap gap-1 mt-3">
									<span class="bg-[#1c1c1c] text-[#8e8e93] text-[9px] font-bold px-2 py-1 rounded-md uppercase border border-[#2a2a2a]">
										{report.data?.length} {locale() === 'fa' ? 'حرف' : 'chars'}
									</span>
									<Show when={report.data?.is_dictionary_word}>
										<span class="bg-blue-500/10 text-blue-400 text-[9px] font-bold px-2 py-1 rounded-md uppercase border border-blue-500/20">
											{locale() === 'fa' ? 'کلمه واژه‌نامه' : 'Dict Word'}
										</span>
									</Show>
									<Show when={report.data?.contains_numbers}>
										<span class="bg-orange-500/10 text-orange-400 text-[9px] font-bold px-2 py-1 rounded-md uppercase border border-orange-500/20">
											{locale() === 'fa' ? 'دارای عدد' : 'Numbers'}
										</span>
									</Show>
								</div>
							</div>

							<div class="bg-[#141518] border border-[#2a2a2a] p-4 rounded-[24px]">
								<span class="text-[10px] text-[#8e8e93] font-black uppercase tracking-widest flex items-center gap-1">
									<span class="material-symbols-outlined text-[14px]">public</span>{' '}
									{locale() === 'fa' ? 'حجم جستجو' : 'Search Vol'}
								</span>
								<div class="flex items-end justify-between mt-3">
									<span class="text-2xl font-black text-white">
										{report.data?.search_popularity}
									</span>
								</div>
								<div class="mt-3">
									<span class="text-[10px] text-[#8e8e93] font-medium block mb-1">
										{locale() === 'fa' ? 'اعضا' : 'Participants'}
									</span>
									<span class="text-sm font-black text-white">
										{report.data?.participants_count
											? formatNumber(report.data.participants_count)
											: 'N/A'}
									</span>
								</div>
							</div>
						</div>

						{/* ── MARKET & OWNERSHIP ── */}
						<div class="bg-[#141518] border border-[#2a2a2a] p-5 rounded-[24px] mb-4 space-y-4">
							<h3 class="text-[#8e8e93] text-xs font-black uppercase tracking-widest flex items-center gap-2">
								<span class="material-symbols-outlined text-[16px]">account_balance_wallet</span>{' '}
								{locale() === 'fa' ? 'بلاک‌چین و بازار' : 'Blockchain & Market'}
							</h3>

							<div class="grid grid-cols-2 gap-4 border-b border-[#2a2a2a] pb-4">
								<div class="flex flex-col gap-1">
									<span class="text-[10px] text-[#8e8e93] font-bold uppercase">
										{locale() === 'fa' ? 'وضعیت بازار' : 'Market Status'}
									</span>
									<span class="text-sm font-black text-[#ff9500] uppercase">
										{report.data?.sale_status?.replace(/_/g, ' ') || ''}
									</span>
								</div>
								<Show when={report.data?.mint_date}>
									<div class="flex flex-col gap-1">
										<span class="text-[10px] text-[#8e8e93] font-bold uppercase">
											{locale() === 'fa' ? 'تاریخ ثبت' : 'Mint Date'}
										</span>
										<span class="text-sm font-bold text-white">
											{new Date(report.data!.mint_date!).toLocaleDateString('en-US')}
										</span>
									</div>
								</Show>
							</div>

							<Show when={report.data?.sale_status !== 'not_for_sale'}>
								<div class="flex items-center justify-between py-2 border-b border-[#2a2a2a]">
									<span class="text-sm font-bold text-[#8e8e93]">
										{locale() === 'fa' ? 'بالاترین پیشنهاد' : 'Highest Bid'}
									</span>
									<div class="text-right">
										<span class="text-sm font-black text-white">
											{report.data?.highest_bid !== undefined ? report.data.highest_bid : 0} TON
										</span>
										<Show when={usdValue(report.data?.highest_bid)}>
											<span class="text-[10px] text-[#8e8e93] font-bold block">
												~${usdValue(report.data?.highest_bid)}
											</span>
										</Show>
									</div>
								</div>
								<div class="flex items-center justify-between py-2 border-b border-[#2a2a2a]">
									<span class="text-sm font-bold text-[#8e8e93]">
										{locale() === 'fa' ? 'خرید فوری' : 'Buy Now'}
									</span>
									<div class="text-right">
										<span class="text-sm font-black text-white">
											{report.data?.buy_now_price !== undefined ? report.data.buy_now_price : 'N/A'}{' '}
											TON
										</span>
										<Show when={usdValue(report.data?.buy_now_price)}>
											<span class="text-[10px] text-[#8e8e93] font-bold block">
												~${usdValue(report.data?.buy_now_price)}
											</span>
										</Show>
									</div>
								</div>
								<Show when={report.data?.end_time}>
									<div class="flex items-center justify-between py-2 border-b border-[#2a2a2a]">
										<span class="text-sm font-bold text-[#8e8e93]">
											{locale() === 'fa' ? 'پایان حراجی' : 'Auction Ends'}
										</span>
										<span class="text-sm font-bold text-[#ff3b30]">
											{new Date(report.data!.end_time!).toLocaleString('en-US')}
										</span>
									</div>
								</Show>
							</Show>

							<Show when={report.data?.owner_address}>
								<div class="py-2">
									<span class="text-[11px] font-bold text-[#8e8e93] mb-1.5 block uppercase tracking-wider">
										{locale() === 'fa' ? 'آدرس مالک' : 'Owner Address'}
									</span>
									<div class="flex items-center gap-2">
										<span class="text-xs font-mono font-medium text-[#3390ec] break-all bg-[#3390ec]/10 px-3 py-2 rounded-xl border border-[#3390ec]/20">
											{report.data?.owner_address}
										</span>
									</div>
								</div>

								<Show when={report.data?.owner_wallet_balance !== undefined}>
									<div class="flex items-center justify-between py-3 mt-2 bg-[#1c1c1c] rounded-xl px-4 border border-[#2a2a2a]">
										<span class="text-[11px] font-black text-[#8e8e93] uppercase tracking-wider flex items-center gap-1.5">
											<span class="material-symbols-outlined text-[14px]">water</span>{' '}
											{locale() === 'fa' ? 'وضعیت نهنگ' : 'Whale Status'}
										</span>
										<div class="text-right">
											<div class="text-sm font-black text-white">
												{report.data?.owner_wallet_balance?.toFixed(2)} TON
											</div>
											<Show when={usdValue(report.data?.owner_wallet_balance)}>
												<div class="text-[10px] text-[#8e8e93] font-bold">
													~${usdValue(report.data?.owner_wallet_balance)}
												</div>
											</Show>
											<div class="text-[10px] font-bold text-[#8e8e93] mt-0.5">
												{report.data?.owner_other_assets}{' '}
												{locale() === 'fa' ? 'یوزرنیم‌های دیگر' : 'other NFTs'}
											</div>
										</div>
									</div>
								</Show>
							</Show>

							{/* Past Sales (If any) */}
							<Show when={paidSales().length > 0}>
								<div class="pt-2">
									<span class="text-[11px] font-bold text-[#8e8e93] uppercase tracking-wider mb-2 block">
										{locale() === 'fa' ? 'تاریخچه قیمت' : 'Price History'}
									</span>
									<div class="bg-[#1c1c1c] rounded-2xl border border-[#2a2a2a] p-3 mb-3">
										<svg
											viewBox="0 0 320 128"
											class="w-full h-32"
											role="img"
											aria-label="Username price history chart"
										>
											<line x1="16" y1="112" x2="304" y2="112" stroke="#2a2a2a" stroke-width="2" />
											<line x1="16" y1="24" x2="16" y2="112" stroke="#2a2a2a" stroke-width="2" />
											<polyline
												points={chartPoints()}
												fill="none"
												stroke="#3390ec"
												stroke-width="4"
												stroke-linecap="round"
												stroke-linejoin="round"
											/>
											<For each={paidSales()}>
												{(sale, index) => (
													<circle
														cx={
															paidSales().length === 1
																? 160
																: 16 + (index() / (paidSales().length - 1)) * 288
														}
														cy={112 - ((sale.price - priceStats().min) / priceStats().span) * 88}
														r="4"
														fill="#34c759"
														stroke="#0a0b0e"
														stroke-width="2"
													/>
												)}
											</For>
										</svg>
										<div class="flex justify-between text-[10px] text-[#8e8e93] font-bold px-1">
											<span>{new Date(paidSales()[0].date).toLocaleDateString('en-US')}</span>
											<span>{paidSales()[paidSales().length - 1].price} TON</span>
										</div>
									</div>
									<div class="space-y-2">
										<For each={paidSales()}>
											{(sale) => (
												<div class="flex items-center justify-between bg-[#1c1c1c] p-2.5 rounded-lg border border-[#2a2a2a]">
													<span class="text-xs text-white/60">
														{new Date(sale.date).toLocaleDateString('en-US')}
													</span>
													<span class="text-xs font-black text-white">{sale.price} TON</span>
												</div>
											)}
										</For>
									</div>
								</div>
							</Show>
						</div>

						{/* ── PHASE 3 & ADVANCED METRICS ── */}
						<Show
							when={
								report.data?.wallet_portfolio !== undefined ||
								report.data?.has_ton_synergy !== undefined ||
								report.data?.roi_percentage !== undefined ||
								report.data?.channel_empire_reach !== undefined ||
								(report.data?.potential_buyers && report.data?.potential_buyers.length > 0)
							}
						>
							<div class="bg-[#141518] border border-[#2a2a2a] p-5 rounded-none border-l-4 border-l-[#3390ec] mb-4 space-y-4 relative overflow-hidden shadow-[0_10px_30px_rgba(0,0,0,0.5)]">
								<h3 class="text-[#8e8e93] text-xs font-black uppercase tracking-widest flex items-center gap-2">
									<span class="material-symbols-outlined text-[16px]">insights</span>{' '}
									{locale() === 'fa' ? 'اطلاعات هوشمند پیشرفته' : 'Advanced Intelligence'}
								</h3>

								<div class="grid grid-cols-2 gap-4 border-b border-[#2a2a2a] pb-4">
									<Show when={report.data?.wallet_portfolio !== undefined}>
										<div class="flex flex-col gap-1">
											<div class="flex items-center gap-1">
												<span class="text-[10px] text-[#8e8e93] font-bold uppercase">
													{locale() === 'fa' ? 'کل دارایی کیف پول' : 'Wallet Portfolio'}
												</span>
												<Tooltip textKey="wallet_portfolio" locale={locale()} />
											</div>
											<span class="text-sm font-black text-white">
												{report.data!.wallet_portfolio} TON
											</span>
										</div>
									</Show>

									<Show when={report.data?.has_ton_synergy !== undefined}>
										<div class="flex flex-col gap-1">
											<div class="flex items-center gap-1">
												<span class="text-[10px] text-[#8e8e93] font-bold uppercase">
													{locale() === 'fa' ? 'هم‌افزایی با شبکه TON' : 'TON Synergy'}
												</span>
												<Tooltip textKey="has_ton_synergy" locale={locale()} />
											</div>
											<span
												class={`text-sm font-black uppercase ${report.data!.has_ton_synergy ? 'text-[#34c759]' : 'text-[#ff3b30]'}`}
											>
												{report.data!.has_ton_synergy
													? locale() === 'fa'
														? 'بالا'
														: 'High'
													: locale() === 'fa'
														? 'پایین'
														: 'Low'}
											</span>
										</div>
									</Show>

									<Show when={report.data?.roi_percentage !== undefined}>
										<div class="flex flex-col gap-1">
											<div class="flex items-center gap-1">
												<span class="text-[10px] text-[#8e8e93] font-bold uppercase">
													{locale() === 'fa' ? 'بازده تخمینی سرمایه' : 'Est. ROI'}
												</span>
												<Tooltip textKey="roi_percentage" locale={locale()} />
											</div>
											<span class="text-sm font-black text-[#ff9500]">
												+{report.data!.roi_percentage}%
											</span>
										</div>
									</Show>

									<Show when={report.data?.channel_empire_reach !== undefined}>
										<div class="flex flex-col gap-1">
											<div class="flex items-center gap-1">
												<span class="text-[10px] text-[#8e8e93] font-bold uppercase">
													{locale() === 'fa' ? 'بازدید مخاطبان' : 'Empire Reach'}
												</span>
												<Tooltip textKey="channel_empire_reach" locale={locale()} />
											</div>
											<span class="text-sm font-black text-[#3390ec]">
												{formatNumber(report.data!.channel_empire_reach!)}
											</span>
										</div>
									</Show>
								</div>

								<Show
									when={report.data?.potential_buyers && report.data?.potential_buyers.length > 0}
								>
									<div class="pt-2">
										<div class="flex items-center gap-1 mb-3">
											<span class="text-[11px] font-bold text-[#8e8e93] uppercase tracking-wider">
												{locale() === 'fa' ? 'خریداران احتمالی' : 'Potential Buyers'}
											</span>
											<Tooltip textKey="potential_buyers" locale={locale()} />
										</div>
										<div class="bg-[#1c1c1c] border border-[#2a2a2a] rounded-xl overflow-hidden max-h-[200px] overflow-y-auto">
											<table class="w-full text-left text-xs">
												<thead class="bg-[#2a2a2a] text-[#8e8e93] sticky top-0 z-10">
													<tr>
														<th class="px-3 py-2 font-bold uppercase text-left">
															{locale() === 'fa' ? 'آدرس' : 'Address'}
														</th>
														<th class="px-3 py-2 font-bold uppercase text-right">
															{locale() === 'fa' ? 'موجودی' : 'Balance'}
														</th>
													</tr>
												</thead>
												<tbody class="divide-y divide-[#2a2a2a]">
													<For each={report.data!.potential_buyers}>
														{(buyer) => (
															<tr class="hover:bg-[#2a2a2a]/50 transition-colors">
																<td
																	class="px-3 py-2 font-mono text-[#3390ec] max-w-[120px] truncate"
																	title={buyer.owner_address}
																>
																	{buyer.owner_address.slice(0, 4)}...
																	{buyer.owner_address.slice(-4)}
																</td>
																<td class="px-3 py-2 font-black text-white text-right">
																	{buyer.balance !== undefined ? buyer.balance.toFixed(1) : 'N/A'}{' '}
																	TON
																</td>
															</tr>
														)}
													</For>
												</tbody>
											</table>
										</div>
									</div>
								</Show>
							</div>
						</Show>

						{/* ── ACTION BUTTONS ── */}
						<div class="mt-8 space-y-3">
							<button
								onClick={openFragment}
								class="w-full bg-[#3390ec] active:scale-95 text-white font-black py-4 rounded-2xl flex items-center justify-center gap-3 transition-all shadow-[0_4px_20px_rgba(51,144,236,0.3)]"
								aria-label="Open username in Fragment market"
							>
								<span class="material-symbols-outlined text-[20px]">shopping_cart</span>
								{locale() === 'fa' ? 'مشاهده در فرگمنت' : 'Open in Fragment'}
							</button>
							<button
								onClick={handleShare}
								class="w-full bg-[#1c1c1c] border border-[#2a2a2a] text-white font-black py-4 rounded-2xl active:scale-95 transition-all flex items-center justify-center gap-3 hover:bg-[#2a2a2a]"
								aria-label="Share this report"
							>
								<span class="material-symbols-outlined text-[20px]">ios_share</span>
								{locale() === 'fa' ? 'اشتراک‌گذاری گزارش هوشمند' : 'Share Intelligence Report'}
							</button>
						</div>

						<p class="text-center text-[#8e8e93] text-[10px] mt-6 font-medium tracking-wide">
							{locale() === 'fa' ? 'تاریخ ثبت گزارش:' : 'Data generated at'}{' '}
							{new Date(report.data!.generated_at).toLocaleString('en-US')}
						</p>
					</Motion.div>
				</Show>
			</Show>
		</div>
	);
};

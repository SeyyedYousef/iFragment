import { backButton, hapticFeedback } from '@tma.js/sdk-solid';
import { Component, createSignal, createEffect, onCleanup, onMount, Show, For } from 'solid-js';
import { useSearchParams } from '@solidjs/router';
import { apiFetch } from '@/shared/api/base.js';
import { Motion } from '@motionone/solid';

interface ValuationResult {
	run_id: number;
	username: string;
	model_version: string;
	base_price_ton: string;
	low_ton: string;
	expected_ton: string;
	high_ton: string;
	low_usd: string;
	expected_usd: string;
	high_usd: string;
	confidence_score: number;
	ton_usd_rate: number;
	comparable_sales_count: number;
	rarity: {
		tier: string;
		stars: string;
	};
	tags: string[];
	reasoning_log: Record<string, any>;
}

export const UsernamePage: Component = () => {
	const [searchParams] = useSearchParams();
	const [data, setData] = createSignal<ValuationResult | null>(null);
	const [loading, setLoading] = createSignal<boolean>(true);
	const [error, setError] = createSignal<string | null>(null);

	const username = () => searchParams.u || '';

	onMount(() => {
		backButton.show();
		const off = backButton.onClick(() => {
			try {
				hapticFeedback.impactOccurred('light');
			} catch (_) {}
			window.history.back();
		});

		onCleanup(() => {
			off();
			backButton.hide();
		});
	});

	createEffect(() => {
		const fetchValuation = async () => {
			const u = username();
			if (!u) return;

			setLoading(true);
			setError(null);
			try {
				const result = await apiFetch<ValuationResult>(`/usernames/valuate?u=${u}`);
				if (result) {
					setData(result);
				} else {
					setError('فراخوانی متادیتا با خطا مواجه شد');
				}
			} catch (err: any) {
				setError(err.message || 'خطایی در ارتباط با سرور رخ داد');
			} finally {
				setLoading(false);
			}
		};

		fetchValuation();
	});

	const getConfidenceColor = (score: number) => {
		if (score >= 70) return '#30d158'; // green
		if (score >= 40) return '#ff9f0a'; // orange
		return '#ff453a'; // red
	};

	return (
		<Show
			when={!loading()}
			fallback={
				<div class="flex flex-col justify-center items-center h-screen bg-[#0f1014] text-white/60 gap-4">
					<div class="w-10 h-10 rounded-full border-[3px] border-white/10 border-t-[#3390ec] animate-spin" />
					<span class="text-[13px] font-medium tracking-wide">در حال تحلیل ارزش بازار...</span>
				</div>
			}
		>
			<Show
				when={!error()}
				fallback={
					<div class="min-h-screen bg-[#0f1014] text-white flex flex-col items-center justify-center p-6 text-center">
						<div class="w-16 h-16 rounded-full bg-[#ff453a]/10 flex items-center justify-center mb-4 text-[#ff453a]">
							<span class="material-symbols-outlined text-[32px]">error</span>
						</div>
						<h1 class="text-lg font-bold mb-2">خطا در بارگذاری اطلاعات</h1>
						<p class="text-[13px] text-white/40 leading-relaxed mb-6 max-w-xs">{error()}</p>
						<button
							onClick={() => window.history.back()}
							class="h-11 px-6 bg-white/[0.04] border border-white/10 text-white font-medium rounded-xl transition-all active:scale-95"
						>
							بازگشت
						</button>
					</div>
				}
			>
				<div class="min-h-screen bg-[#0f1014] text-white px-5 py-8 flex flex-col items-center font-sans pb-24">
					{/* Glowing Header */}
					<div class="text-center mb-8 relative w-full">
						<div class="absolute -top-12 left-1/2 -translate-x-1/2 w-32 h-32 bg-[#3390ec]/10 rounded-full blur-2xl pointer-events-none" />
						<span class="text-[28px] font-black text-transparent bg-clip-text bg-gradient-to-b from-white to-white/70 tracking-tight block mb-2" dir="ltr">
							@{data()?.username || username()}
						</span>
						<span class="px-2.5 py-1 bg-white/[0.04] border border-white/[0.06] rounded-full text-[10px] font-semibold tracking-wider text-white/40 uppercase">
							تحلیل ارزش بازار
						</span>
					</div>

					{/* Hero Card */}
					<div class="w-full max-w-[480px] bg-white/[0.02] border border-white/[0.06] rounded-[28px] p-6 shadow-2xl backdrop-blur-xl relative overflow-hidden mb-6">
						<div class="absolute inset-0 bg-gradient-to-b from-white/[0.01] to-transparent pointer-events-none" />
						
						<div class="text-center mb-6">
							<span class="text-white/40 text-[11px] font-bold uppercase tracking-wider block mb-1">قیمت تخمینی بازار</span>
							<div class="flex items-baseline justify-center gap-2">
								<span class="text-[44px] font-black tracking-tight text-white">{parseFloat(data()?.expected_ton || '0').toLocaleString()}</span>
								<span class="text-[18px] font-bold text-[#3390ec]">TON</span>
							</div>
							<span class="text-[14px] font-medium text-white/50 block mt-1" dir="ltr">
								${parseFloat(data()?.expected_usd || '0').toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD
							</span>
						</div>

						{/* Range Grid */}
						<div class="grid grid-cols-2 gap-4 mb-6 border-t border-b border-white/[0.06] py-5">
							<div class="text-center border-r border-white/[0.06]">
								<span class="text-[10px] font-semibold text-white/35 uppercase tracking-wider block mb-1">کف بازه منصفانه</span>
								<span class="text-[18px] font-extrabold text-white/80">{parseFloat(data()?.low_ton || '0').toLocaleString()} TON</span>
								<span class="text-[11px] text-white/40 block mt-0.5" dir="ltr">${parseFloat(data()?.low_usd || '0').toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
							</div>
							<div class="text-center">
								<span class="text-[10px] font-semibold text-white/35 uppercase tracking-wider block mb-1">سقف بازه منصفانه</span>
								<span class="text-[18px] font-extrabold text-white/80">{parseFloat(data()?.high_ton || '0').toLocaleString()} TON</span>
								<span class="text-[11px] text-white/40 block mt-0.5" dir="ltr">${parseFloat(data()?.high_usd || '0').toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
							</div>
						</div>

						{/* Metainfo stats */}
						<div class="flex justify-between items-center bg-[#111214] rounded-2xl p-4">
							<div class="text-right">
								<span class="text-[10px] font-semibold text-white/35 uppercase tracking-wider block mb-1">درجه کمیابی</span>
								<div class="flex items-center gap-1.5 justify-end">
									<span class="text-[12px] text-yellow-400" dir="ltr">{data()?.rarity.stars}</span>
									<span class="text-[13px] font-bold text-[#3390ec]">{data()?.rarity.tier}</span>
								</div>
							</div>
							<div class="text-left">
								<span class="text-[10px] font-semibold text-white/35 uppercase tracking-wider block mb-1">درجه اطمینان مدل</span>
								<div class="flex items-center gap-2 justify-start">
									<span 
										class="w-2 h-2 rounded-full shadow-[0_0_8px_currentColor]"
										style={{ color: getConfidenceColor(data()?.confidence_score || 0) }}
									/>
									<span class="text-[13px] font-bold text-white/80">{data()?.confidence_score} / 100</span>
								</div>
							</div>
						</div>
					</div>

					{/* Reasoning details */}
					<div class="w-full max-w-[480px] bg-white/[0.01] border border-white/[0.04] rounded-[24px] p-5 shadow-lg backdrop-blur-md">
						<h3 class="text-[15px] font-bold text-white/80 border-b border-white/[0.06] pb-3 mb-4 flex items-center gap-2">
							<span class="material-symbols-outlined text-[18px] text-[#3390ec]">analytics</span>
							جزئیات تحلیل فنی ارزش
						</h3>

						<div class="flex flex-col gap-4">
							{/* AI signal */}
							<div class="flex flex-col gap-1 border-b border-white/[0.04] pb-3.5">
								<div class="flex justify-between items-center">
									<span class="text-[13px] font-bold text-white/70">سیگنال هوش مصنوعی (AI)</span>
									<span class="text-[13px] font-extrabold text-[#3390ec]" dir="ltr">
										{data()?.reasoning_log?.semantic_ai_score || 10} / 100
									</span>
								</div>
								<p class="text-[12px] text-white/40 leading-relaxed text-right mt-1.5">
									{data()?.reasoning_log?.semantic_ai_reason || 'کلمه فاقد هرگونه سیگنال فرهنگی، اجتماعی یا کریپتویی در بستر شبکه تلگرام است.'}
								</p>
							</div>

							{/* Wikipedia signal */}
							<Show when={data()?.reasoning_log?.semantic_wiki && data()?.reasoning_log?.semantic_wiki > 0}>
								<div class="flex flex-col gap-1 border-b border-white/[0.04] pb-3.5">
									<div class="flex justify-between items-center">
										<span class="text-[13px] font-bold text-white/70">تراکم فرهنگی (Wikipedia)</span>
										<span class="text-[13px] font-extrabold text-green-400" dir="ltr">
											{data()?.reasoning_log?.semantic_wiki} / 100
										</span>
									</div>
									<Show when={data()?.reasoning_log?.semantic_wiki_desc}>
										<p class="text-[12px] text-white/40 leading-relaxed text-right mt-1.5">
											{data()?.reasoning_log?.semantic_wiki_desc}
										</p>
									</Show>
								</div>
							</Show>

							{/* Comparable Sales */}
							<div class="flex justify-between items-center border-b border-white/[0.04] pb-3.5">
								<span class="text-[13px] font-bold text-white/70">تعداد معاملات هم‌گروه مقایسه‌ای</span>
								<span class="text-[13px] font-extrabold text-white/80">
									{data()?.comparable_sales_count || 0} مورد
								</span>
							</div>

							{/* Model Version */}
							<div class="flex justify-between items-center">
								<span class="text-[13px] font-bold text-white/70">نسخه الگوریتم ارزش‌گذاری</span>
								<span class="text-[13px] font-bold text-white/40" dir="ltr">
									{data()?.model_version}
								</span>
							</div>
						</div>
					</div>
				</div>
			</Show>
		</Show>
	);
};

export default UsernamePage;

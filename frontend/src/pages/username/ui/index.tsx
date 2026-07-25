import { Motion } from '@motionone/solid';
import { useSearchParams } from '@solidjs/router';
import { backButton, hapticFeedback, openTelegramLink } from '@tma.js/sdk-solid';
import { toPng } from 'html-to-image';
import { Component, createEffect, createSignal, onCleanup, onMount, Show } from 'solid-js';
import { apiFetch } from '@/shared/api/base.js';
import { valuationApi } from '@/shared/api/bot-management.js';
import { isRtl, t } from '@/shared/i18n/index.js';
import { cloudStorage } from '@/shared/lib/cloud-storage.js';
import { shareToStory } from '@/shared/lib/telegram-native.js';

interface ValuationResult {
	run_id: number; username: string; model_version: string; base_price_ton: string; low_ton: string; expected_ton: string; high_ton: string; low_usd: string; expected_usd: string; high_usd: string; confidence_score: number; ton_usd_rate: number; comparable_sales_count: number;
	rarity: { tier: string; stars: string; }; tags: string[]; length: number;
	dictionary: { is_word: boolean; part_of_speech?: string; definition?: string; };
	history: { is_sold: boolean; owner_address?: string; highest_past_sale_ton?: number; transactions?: { sale_price_ton: string; date: string; buyer: string; }[]; };
	similar: { username: string; reason: string; status?: string; sale_price?: number; sale_price_usd?: number; sale_date?: string; }[];
	portfolio?: { owner_address: string; total_count: number; total_spent_ton: number; total_spent_usd: number; total_value_ton: number; items: { username: string; sold_price?: number; sale_date?: string; status: string; }[]; };
	owner_profile?: { user_id?: number; first_name?: string; last_name?: string; username?: string; is_premium?: boolean; has_photo?: boolean; peer_type?: string; };
	structure: { has_digits: boolean; letters_only: boolean; has_underscore: boolean; };
	seo: { score: number; verdict: string; };
	liquidity_rating?: string; estimated_sell_time?: string; target_buyer_profile?: string;
	projected_growth?: { bull_ton: number; base_ton: number; bear_ton: number; bull_usd: number; base_usd: number; bear_usd: number; };
	liquidity_metrics?: { score: number; estimated_days: string; };
	auction_playbook?: { start_price_ton: number; bid_step_ton: number; best_day: string; best_hour_utc: string; };
	search_trend?: { surge_percent: number; status: string; };
	reasoning_log: Record<string, any>; investment_grade: string; comparables: { username: string; price: number; date: string; }[]; price_trend: { label: string; value: number; }[]; wallet_info?: { balance: number; nft_count: number; is_whale: boolean; }; entity_info?: { type: string; members: number; verified: boolean; }; status?: string; brandability: number; fear_greed_index: number; fear_greed_label: string; wikipedia_summary: string; rarity_breakdown: Record<string, number>;
}

export const UsernamePage: Component = () => {
	const [searchParams] = useSearchParams();
	const [data, setData] = createSignal<ValuationResult | null>(null);
	const [loading, setLoading] = createSignal<boolean>(true);
	const [error, setError] = createSignal<string | null>(null);
	const [sharing, setSharing] = createSignal<boolean>(false);
	const [downloading, setDownloading] = createSignal<boolean>(false);
	const [sent, setSent] = createSignal<boolean>(false);
	const [sendCount, setSendCount] = createSignal<number>(0);

	const [_accessGranted, setAccessGranted] = createSignal<boolean>(false);
	const [accessMethod, setAccessMethod] = createSignal<'free' | 'stars' | 'coins' | null>(null);
	const [showPaymentGate, setShowPaymentGate] = createSignal<boolean>(false);
	const [freeQuotaUsed, setFreeQuotaUsed] = createSignal<boolean>(false);
	const [isProcessingPayment, setIsProcessingPayment] = createSignal<boolean>(false);
	const [paymentError, setPaymentError] = createSignal<string>('');

	const username = () => searchParams.u || '';
	let cardRef: HTMLDivElement | undefined;
	let hiddenCardRef: HTMLDivElement | undefined;
	const [tilt, setTilt] = createSignal({ x: 0, y: 0, glossX: 50, glossY: 50 });

	const handleMouseMove = (e: MouseEvent) => {
		if (!cardRef) return;
		const rect = cardRef.getBoundingClientRect();
		const x = e.clientX - rect.left;
		const y = e.clientY - rect.top;
		setTilt({ x: ((rect.height / 2) - y) / 10, y: (x - (rect.width / 2)) / 10, glossX: (x / rect.width) * 100, glossY: (y / rect.height) * 100 });
	};
	const handleMouseLeave = () => setTilt({ x: 0, y: 0, glossX: 50, glossY: 50 });

	const getFontSize = (name: string) => {
		const len = name.length;
		if (len <= 5) return '46px';
		if (len <= 8) return '38px';
		if (len <= 12) return '30px';
		return '24px';
	};

	const getTierTheme = (tier: string) => {
		const t = (tier || '').toLowerCase();
		if (t.includes('legendary') || t.includes('grail') || t.includes('god')) return { wrapper: 'from-[#ffaa00] via-[#ff5500] to-[#ff0055] shadow-[0_20px_50px_rgba(255,85,0,0.5),inset_0_2px_10px_rgba(255,255,255,0.3)]', badge: 'bg-[#ffaa00]/15 border-[#ffaa00]/40 text-[#ffaa00] shadow-[0_0_15px_rgba(255,170,0,0.3)]', text: 'from-[#ffeaa7] via-[#ffaa00] to-[#ff5500]', glow: 'rgba(255,85,0,0.3)' };
		if (t.includes('epic') || t.includes('elite') || t.includes('apex')) return { wrapper: 'from-[#00f0ff] via-[#0057ff] to-[#7000ff] shadow-[0_20px_50px_rgba(0,87,255,0.5),inset_0_2px_10px_rgba(255,255,255,0.3)]', badge: 'bg-[#00f0ff]/15 border-[#00f0ff]/40 text-[#00f0ff] shadow-[0_0_15px_rgba(0,240,255,0.3)]', text: 'from-[#a5f3fc] via-[#00f0ff] to-[#0057ff]', glow: 'rgba(0,87,255,0.3)' };
		if (t.includes('rare') || t.includes('premium') || t.includes('grand')) return { wrapper: 'from-[#10b981] via-[#059669] to-[#047857] shadow-[0_20px_50px_rgba(16,185,129,0.5),inset_0_2px_10px_rgba(255,255,255,0.3)]', badge: 'bg-[#10b981]/15 border-[#10b981]/40 text-[#10b981] shadow-[0_0_15px_rgba(16,185,129,0.3)]', text: 'from-[#a7f3d0] via-[#10b981] to-[#059669]', glow: 'rgba(16,185,129,0.3)' };
		return { wrapper: 'from-[#94a3b8] via-[#475569] to-[#334155] shadow-[0_20px_50px_rgba(148,163,184,0.3),inset_0_2px_10px_rgba(255,255,255,0.2)]', badge: 'bg-[#94a3b8]/15 border-[#94a3b8]/40 text-[#e2e8f0]', text: 'from-white via-[#cbd5e1] to-[#94a3b8]', glow: 'rgba(255,255,255,0.15)' };
	};

	const triggerAlert = (msg: string) => {
		const tg = (window as any).Telegram?.WebApp;
		tg?.showAlert ? tg.showAlert(msg) : alert(msg);
	};

	const handleSendToChat = async () => {
		if (!hiddenCardRef || downloading()) return;
		if (sendCount() >= 2) return triggerAlert(t('valuation.err_server') || 'Send limit reached.');
		setDownloading(true); setSent(false);
		try {
			try { hapticFeedback.impactOccurred('medium'); } catch (_) {}
			const dataUrl = await toPng(hiddenCardRef, { width: 400, height: 400, pixelRatio: 3 });
			const res = await apiFetch<{ success: boolean }>('/usernames/send-to-chat', { method: 'POST', body: JSON.stringify({ image: dataUrl }), headers: { 'Content-Type': 'application/json' } });
			if (res?.success) {
				try { hapticFeedback.notificationOccurred('success'); } catch (_) {}
				setSent(true); setSendCount(c => c + 1); setTimeout(() => setSent(false), 3000);
			}
		} catch (err) {
			triggerAlert(t('valuation.err_server') || 'Failed to send.');
		} finally { setDownloading(false); }
	};

	const handleShareToStory = async () => {
		const u = data()?.username || username();
		if (!u || !hiddenCardRef || sharing()) return;
		setSharing(true);
		try {
			try { hapticFeedback.impactOccurred('medium'); } catch (_) {}
			const dataUrl = await toPng(hiddenCardRef, { width: 400, height: 400, pixelRatio: 3 });
			const res = await apiFetch<{ url: string }>('/usernames/share', { method: 'POST', body: JSON.stringify({ image: dataUrl }), headers: { 'Content-Type': 'application/json' } });
			if (res?.url) {
				shareToStory(res.url, { text: `Check out the market valuation of @${u} on iFragment! 💎`, widget_link: { url: `https://t.me/iFragmentBot/iFragment?startapp=val_${u}`, name: 'iFragment' } });
			}
		} catch (err) {} finally { setSharing(false); }
	};

	onMount(() => {
		backButton.show();
		const off = backButton.onClick(() => { try { hapticFeedback.impactOccurred('light'); } catch (_) {} window.history.back(); });
		onCleanup(() => { off(); backButton.hide(); });
	});

	const grantAccess = (method: 'free' | 'stars' | 'coins', targetUser: string) => {
		try { localStorage.setItem(`val_access_${targetUser}`, method); } catch (_) {}
		setAccessMethod(method); setAccessGranted(true); setShowPaymentGate(false); fetchValuation(targetUser);
	};

	const fetchValuation = async (u: string) => {
		if (!u) return;
		setLoading(true); setError(null);
		try {
			const res = await apiFetch<ValuationResult>(`/usernames/valuate?u=${u}`);
			res ? setData(res) : setError(t('valuation.err_meta') || 'Failed to fetch metadata');
		} catch (err: any) {
			setError(err.message || t('valuation.err_server') || 'A server error occurred');
		} finally { setLoading(false); }
	};

	const handlePayStars = async () => {
		const u = username();
		if (!u || isProcessingPayment()) return;
		setIsProcessingPayment(true); setPaymentError('');
		try {
			const res = await valuationApi.createStarsInvoice(u);
			if (res?.invoice_link) {
				const tg = (window as any).Telegram?.WebApp;
				if (tg?.openInvoice) {
					tg.openInvoice(res.invoice_link, (status: string) => { if (status === 'paid') { hapticFeedback.notificationOccurred('success'); grantAccess('stars', u); } });
				} else { openTelegramLink(res.invoice_link); grantAccess('stars', u); }
			} else grantAccess('stars', u);
		} catch (e: any) {
			setPaymentError(e?.message || 'Payment failed'); hapticFeedback.notificationOccurred('error');
		} finally { setIsProcessingPayment(false); }
	};

	const handlePayCoins = async () => {
		const u = username();
		if (!u || isProcessingPayment()) return;
		setIsProcessingPayment(true); setPaymentError('');
		try {
			const res = await valuationApi.payWithAirdrop(u);
			if (res?.success) { hapticFeedback.notificationOccurred('success'); grantAccess('coins', u); }
			else grantAccess('coins', u);
		} catch (e: any) {
			setPaymentError(e?.response?.data?.error || e?.message || 'Insufficient coin balance'); hapticFeedback.notificationOccurred('error');
		} finally { setIsProcessingPayment(false); }
	};

	const handleVerifyFreeAccess = async () => {
		const u = username();
		if (!u || isProcessingPayment()) return;
		if (freeQuotaUsed()) { setPaymentError(t('valuation.free_quota_used') || 'Free quota used.'); hapticFeedback.notificationOccurred('error'); return; }
		setIsProcessingPayment(true); setPaymentError('');
		try {
			const res = await valuationApi.verifyFreeAccess(u);
			if (res?.has_access) {
				hapticFeedback.notificationOccurred('success');
				localStorage.setItem('val_free_used', 'true'); cloudStorage.setItem('val_free_used', 'true');
				setFreeQuotaUsed(true); grantAccess('free', u);
			} else {
				setPaymentError(t('valuation.free_quota_used') || 'Verification failed.'); hapticFeedback.notificationOccurred('error');
			}
		} catch (e: any) {
			setPaymentError(e?.response?.data?.error || e?.message || 'Verification failed'); hapticFeedback.notificationOccurred('error');
		} finally { setIsProcessingPayment(false); }
	};

	createEffect(() => {
		const initValuation = async () => {
			const u = username(); if (!u) return;
			setLoading(true); setError(null);
			const cachedAccess = localStorage.getItem(`val_access_${u}`);
			if (localStorage.getItem('val_free_used') === 'true') setFreeQuotaUsed(true);
			else cloudStorage.getItem('val_free_used').then((val) => { if (val === 'true') { setFreeQuotaUsed(true); localStorage.setItem('val_free_used', 'true'); } });

			if (cachedAccess) { setAccessGranted(true); setAccessMethod(cachedAccess as any); fetchValuation(u); }
			else {
				try {
					const res = await valuationApi.checkAccess(u);
					if (res?.free_quota_used) { setFreeQuotaUsed(true); localStorage.setItem('val_free_used', 'true'); cloudStorage.setItem('val_free_used', 'true'); }
					if (res?.has_access) { setAccessGranted(true); setAccessMethod(res.method || 'stars'); fetchValuation(u); }
					else { setShowPaymentGate(true); setLoading(false); }
				} catch (_) { setShowPaymentGate(true); setLoading(false); }
			}
		};
		initValuation();
	});

	// --- Derived Intelligence Data ---
	const expectedTon = () => parseFloat(data()?.expected_ton || '0');
	
	// Historical purchase price if sold previously
	const pastSaleTon = () => {
		if (data()?.history?.highest_past_sale_ton && data()!.history!.highest_past_sale_ton! > 0) {
			return data()!.history!.highest_past_sale_ton!;
		}
		if (data()?.history?.transactions && data()!.history!.transactions!.length > 0) {
			const p = parseFloat(data()!.history!.transactions![0].sale_price_ton);
			if (!isNaN(p) && p > 0) return p;
		}
		return 0;
	};

	const netSaleTon = () => expectedTon() * 0.95;
	const netFlipProfit = () => {
		const past = pastSaleTon();
		if (past > 0) return netSaleTon() - past;
		return netSaleTon();
	};
	const netRoiPercent = () => {
		const past = pastSaleTon();
		if (past > 0) return ((netSaleTon() - past) / past) * 100;
		return 0;
	};

	return (
		<Show
			when={!loading()}
			fallback={
				<div class="flex flex-col justify-center items-center h-screen bg-[#030303] text-white/60 gap-5 relative overflow-hidden">
					<div class="absolute inset-0 bg-gradient-to-b from-[#3390ec]/15 to-transparent blur-[120px]" />
					<div class="relative flex items-center justify-center w-20 h-20">
						<div class="absolute w-full h-full border-[3px] border-white/5 border-t-[#3390ec] rounded-full animate-spin shadow-[0_0_20px_rgba(51,144,236,0.6)]" />
						<span class="material-symbols-outlined text-[24px] text-[#3390ec] animate-pulse">radar</span>
					</div>
					<div class="flex flex-col items-center gap-1">
						<span class="text-[13px] font-black tracking-[4px] uppercase text-[#3390ec] animate-pulse">{t('valuation.analyzing') || 'DECRYPTING'}</span>
						<span class="text-[10px] font-mono font-bold text-white/40 tracking-widest">ON-CHAIN INTELLIGENCE...</span>
					</div>
				</div>
			}
		>
			<Show
				when={!error()}
				fallback={
					<div class="min-h-screen bg-[#030303] text-white flex flex-col items-center justify-center p-6 text-center relative overflow-hidden">
						<div class="absolute inset-0 bg-gradient-to-b from-[#ff4a4a]/15 to-transparent blur-[120px]" />
						<div class="w-24 h-24 rounded-[24px] bg-[#ff4a4a]/10 flex items-center justify-center mb-6 border border-[#ff4a4a]/30 shadow-[0_0_30px_rgba(255,74,74,0.2)] z-10">
							<span class="material-symbols-outlined text-[48px] text-[#ff4a4a] drop-shadow-md">gpp_bad</span>
						</div>
						<h1 class="text-[22px] font-black mb-2 tracking-tight z-10 font-mono">{t('valuation.error_title') || 'INTELLIGENCE FAILED'}</h1>
						<p class="text-[13px] text-white/50 leading-relaxed mb-8 max-w-[280px] font-medium z-10">{error()}</p>
						<button onClick={() => window.history.back()} class="h-14 px-10 bg-[#12141C]/80 hover:bg-white/10 border border-white/10 text-white font-black uppercase tracking-widest text-[13px] rounded-[16px] transition-all active:scale-95 shadow-sm z-10 backdrop-blur-md">
							{t('valuation.back') || 'RETURN TO BASE'}
						</button>
					</div>
				}
			>
				<div class="min-h-screen bg-[#030303] text-white px-5 py-6 flex flex-col items-center font-sans pb-32 select-none relative overflow-x-hidden overflow-y-auto w-full" style={{ 'touch-action': 'pan-y' }} dir={isRtl() ? 'rtl' : 'ltr'}>
					
					{/* ═══════ AMBIENT DYNAMIC BACKGROUND ═══════ */}
					<div class="fixed top-0 left-1/2 -translate-x-1/2 w-[150vw] h-[500px] blur-[120px] pointer-events-none z-0 opacity-50 transition-colors duration-1000" style={{ background: `radial-gradient(circle, ${getTierTheme(data()?.rarity?.tier || '').glow} 0%, transparent 60%)` }} />

					<div class="w-full max-w-[420px] flex flex-col items-center gap-4">

						{/* ═══════ ACCESS AUDIT BADGE ═══════ */}
						<Show when={accessMethod()}>
							<div class="w-full bg-[#12141C]/80 backdrop-blur-2xl border border-white/5 rounded-[20px] p-3.5 flex items-center justify-between shadow-sm relative z-10">
								<div class="flex items-center gap-3.5">
									<div class={`w-11 h-11 rounded-[14px] flex items-center justify-center text-[22px] shrink-0 border shadow-inner ${accessMethod() === 'stars' ? 'bg-amber-400/10 text-amber-400 border-amber-400/30' : accessMethod() === 'coins' ? 'bg-cyan-400/10 text-cyan-400 border-cyan-400/30' : 'bg-emerald-400/10 text-emerald-400 border-emerald-400/30'}`}>
										{accessMethod() === 'stars' ? '⭐' : accessMethod() === 'coins' ? '🪙' : '🎁'}
									</div>
									<div class="flex flex-col text-start">
										<span class="text-[9px] text-white/40 uppercase font-black tracking-widest">{t('valuation.payment_method_badge') || 'ACCESS PROTOCOL'}</span>
										<span class="text-[13px] font-black text-white">{accessMethod() === 'stars' ? t('valuation.method_stars') : accessMethod() === 'coins' ? t('valuation.method_coins') : t('valuation.method_free')}</span>
									</div>
								</div>
								<span class="text-[10px] font-mono px-3 py-1.5 rounded-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-black uppercase tracking-widest shadow-sm flex items-center gap-1">
									<div class="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse shadow-[0_0_8px_#34d399]" />
									VERIFIED
								</span>
							</div>
						</Show>

						{/* ═══════ HERO HOLOGRAPHIC CARD ═══════ */}
						<div class={`w-full aspect-square p-[3px] bg-gradient-to-br ${getTierTheme(data()?.rarity?.tier || '').wrapper} rounded-[48px] my-2 relative z-20 transition-all duration-300`} style={{ 'aspect-ratio': '1 / 1' }}>
							<div
								ref={cardRef} onMouseMove={handleMouseMove} onMouseLeave={handleMouseLeave}
								class="w-full h-full bg-[#08090D] rounded-[45px] p-8 relative overflow-hidden flex flex-col justify-between shadow-inner"
								style={{ transform: `perspective(1200px) rotateX(${tilt().x}deg) rotateY(${tilt().y}deg)`, 'background-image': 'radial-gradient(rgba(255, 255, 255, 0.08) 1.5px, transparent 1.5px)', 'background-size': '24px 24px', transition: 'transform 0.1s ease-out' }}
							>
								<div class="absolute inset-0 pointer-events-none z-20 mix-blend-overlay transition-opacity duration-300 opacity-80" style={{ background: `radial-gradient(circle at ${tilt().glossX}% ${tilt().glossY}%, rgba(255,255,255,0.4) 0%, transparent 60%)` }} />
								<div class="absolute inset-0 bg-gradient-to-b from-white/[0.05] to-transparent pointer-events-none" />

								<div class="flex justify-between items-center z-10">
									<span class={`px-4 py-2 border rounded-[12px] text-[10px] font-black tracking-widest uppercase shadow-sm ${getTierTheme(data()?.rarity?.tier || '').badge}`}>
										{data()?.rarity?.tier || 'STANDARD'}
									</span>
									<span class="text-[11px] font-mono font-black text-white/30 tracking-[5px] uppercase bg-white/5 border border-white/5 px-4 py-1.5 rounded-[12px] shadow-inner">IFRAGMENT</span>
								</div>

								<div class="flex flex-col justify-center items-center z-10 text-center flex-grow relative py-6 w-full">
									<div class="absolute w-full h-[160px] opacity-70 -z-10 pointer-events-none mix-blend-screen" style={{ background: `radial-gradient(ellipse 60% 60% at 50% 50%, ${getTierTheme(data()?.rarity?.tier || '').glow}, transparent 70%)` }} />
									<div class="flex items-center justify-center gap-2.5 w-full">
										<span class="text-white/20 font-black text-[28px] select-none drop-shadow-md">✦</span>
										<span class={`inline-block font-black tracking-tighter bg-gradient-to-r ${getTierTheme(data()?.rarity?.tier || '').text} bg-clip-text text-transparent drop-shadow-[0_10px_30px_rgba(0,0,0,0.8)] truncate max-w-[75%] pb-2`} style={{ 'font-size': getFontSize(data()?.username || username()) }} dir="ltr">
											@{data()?.username || username()}
										</span>
										<span class="text-white/20 font-black text-[28px] select-none drop-shadow-md">✦</span>
									</div>
								</div>

								<div class="flex justify-between items-end border-t border-white/10 pt-5 z-10">
									<div class="flex flex-col gap-1 text-left">
										<span class="text-[10px] font-black text-white/40 uppercase tracking-widest mb-0.5">{t('valuation.estimated_price') || 'ESTIMATED VALUE'}</span>
										<div class="flex items-center gap-2.5">
											<svg class="w-8 h-8 filter drop-shadow-[0_0_15px_rgba(0,152,234,0.6)]" viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M28 56C43.464 56 56 43.464 56 28C56 12.536 43.464 0 28 0C12.536 0 0 12.536 0 28C0 43.464 12.536 56 28 56Z" fill="#0098EA"/><path d="M37.5603 15.6277H18.4386C14.9228 15.6277 12.6944 19.4202 14.4632 22.4861L26.2644 42.9409C27.0345 44.2765 28.9644 44.2765 29.7345 42.9409L41.5765 22.4861C43.3045 19.4202 41.0761 15.6277 37.5765 15.6277H37.5603ZM26.2483 36.8068L23.6119 31.8097L17.2017 20.6506C16.6742 19.7557 17.3255 18.6198 18.4223 18.6198H26.2483V36.8068ZM38.7972 20.6506L32.387 31.8259L29.7506 36.8068V18.6361H37.5765C38.6734 18.6361 39.3247 19.772 38.7972 20.6669V20.6506Z" fill="white"/></svg>
											<span class="text-[34px] font-black text-white leading-none drop-shadow-[0_2px_10px_rgba(0,0,0,0.8)] tracking-tight">{parseFloat(data()?.expected_ton || '0').toLocaleString('en-US')}</span>
											<span class="text-[15px] font-black text-[#3390ec] leading-none mb-1">TON</span>
										</div>
									</div>
									<div class="flex flex-col items-end gap-2.5">
										<div class="flex items-center gap-2 bg-[#10b981]/15 px-3.5 py-1.5 rounded-[10px] border border-[#10b981]/40 text-[#10b981] font-black uppercase tracking-widest text-[9px] shadow-[0_0_20px_rgba(16,185,129,0.2)] backdrop-blur-sm">
											<div class="w-2 h-2 bg-[#10b981] rounded-full animate-pulse shadow-[0_0_10px_#10b981]" /> VERIFIED
										</div>
										<span class="text-[15px] text-white/60 font-black leading-none tracking-tight font-mono">≈ ${parseFloat(data()?.expected_usd || '0').toLocaleString('en-US', { maximumFractionDigits: 0 })}</span>
									</div>
								</div>
							</div>
						</div>

						{/* ═══════ ACTION BUTTONS ═══════ */}
						<div class="flex gap-3 w-full relative z-20 mb-2">
							<button onClick={handleSendToChat} disabled={downloading() || sent()} class={`flex-1 h-14 rounded-[16px] font-black text-[13px] uppercase tracking-widest flex items-center justify-center gap-2 transition-all disabled:opacity-60 shadow-sm border ${sent() ? 'bg-[#10b981]/20 border-[#10b981]/40 text-[#10b981]' : 'bg-[#12141C]/90 backdrop-blur-xl hover:bg-white/10 active:scale-95 border-white/10 text-white/90'}`}>
								<Show when={!downloading()} fallback={<><div class="w-5 h-5 rounded-full border-[3px] border-current border-t-transparent animate-spin" /><span>{t('valuation.sending') || 'SENDING...'}</span></>}>
									<Show when={!sent()} fallback={<><span class="material-symbols-outlined text-[20px]">check_circle</span><span>{t('valuation.sent_to_chat') || 'SENT!'}</span></>}>
										<span class="material-symbols-outlined text-[20px]">send</span> {t('valuation.download') || 'SEND TO CHAT'}
									</Show>
								</Show>
							</button>
							<button onClick={handleShareToStory} disabled={sharing()} class="flex-1 h-14 bg-gradient-to-r from-[#3390ec] to-[#2b7ec9] hover:from-[#2b7ec9] hover:to-[#3390ec] active:scale-95 text-white font-black text-[13px] uppercase tracking-widest rounded-[16px] flex items-center justify-center gap-2 transition-all shadow-[0_10px_30px_rgba(51,144,236,0.4)] disabled:opacity-60 border border-white/10">
								<Show when={!sharing()} fallback={<><div class="w-5 h-5 rounded-full border-[3px] border-white/30 border-t-white animate-spin" /><span>{t('valuation.sharing') || 'UPLOADING...'}</span></>}>
									<span class="material-symbols-outlined text-[22px]" style={{ 'font-variation-settings': '"FILL" 1' }}>auto_stories</span> {t('valuation.share') || 'STORY'}
								</Show>
							</button>
						</div>

						{/* 🌟 1. LINGUISTIC MEANING & DICTIONARY */}
						<div class="w-full bg-gradient-to-br from-[#3390ec]/15 via-[#12141C]/90 to-[#08090D] backdrop-blur-2xl border border-[#3390ec]/30 rounded-[28px] p-6 flex flex-col gap-3.5 shadow-[0_10px_30px_rgba(51,144,236,0.15)] relative overflow-hidden">
							<div class="absolute -right-8 -top-8 w-32 h-32 bg-[#3390ec]/10 blur-3xl rounded-full pointer-events-none" />
							
							<div class="flex items-center justify-between text-white/90 relative z-10 border-b border-[#3390ec]/20 pb-3">
								<div class="flex items-center gap-2.5">
									<span class="material-symbols-outlined text-[22px] text-[#3390ec]">translate</span>
									<span class="text-[13px] font-black uppercase tracking-widest text-[#3390ec]">{t('valuation.ling_meaning_title') || 'MEANING & IDENTITY'}</span>
								</div>
								<span class={`text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-[8px] border shadow-sm ${data()?.dictionary?.is_word ? 'bg-[#10b981]/15 text-[#10b981] border-[#10b981]/40' : 'bg-white/5 text-white/40 border-white/10'}`}>
									{data()?.dictionary?.is_word ? (t('valuation.yes') || 'DICTIONARY WORD') : (t('valuation.no') || 'GENERIC HANDLE')}
								</span>
							</div>

							<div class="relative z-10 flex flex-col gap-2.5">
								<Show when={data()?.dictionary?.is_word && data()?.dictionary?.definition}>
									<div class="bg-[#08090D]/80 rounded-[18px] p-4 border border-[#3390ec]/20 text-white/80 text-[13px] leading-relaxed font-medium italic border-l-[4px] border-l-[#3390ec] shadow-inner">
										"{data()?.dictionary?.definition}"
									</div>
								</Show>

								<Show when={data()?.wikipedia_summary}>
									<div class="bg-[#08090D]/80 rounded-[18px] p-4 border border-white/5 flex flex-col gap-2 shadow-inner">
										<span class="text-[10px] font-black text-amber-400 uppercase tracking-widest flex items-center gap-1.5">
											<span class="material-symbols-outlined text-[16px] text-amber-400">menu_book</span>
											{t('valuation.wiki_summary_title') || 'WIKIPEDIA & KNOWLEDGE BASE'}
										</span>
										<p class="text-[12px] font-medium text-white/70 leading-relaxed">
											{data()?.wikipedia_summary}
										</p>
									</div>
								</Show>
							</div>
						</div>

						{/* 🚀 2. PRICE RANGE HUD */}
						<div class="w-full bg-[#12141C]/80 backdrop-blur-2xl border border-white/5 rounded-[28px] p-6 flex flex-col gap-5 shadow-sm">
							<div class="flex items-center justify-between text-white/90 border-b border-white/5 pb-3">
								<div class="flex items-center gap-2">
									<span class="material-symbols-outlined text-[20px] text-white">monitoring</span>
									<span class="text-[13px] font-black uppercase tracking-widest">{t('valuation.price_range') || 'PRICE RANGE'}</span>
								</div>
								<span class="text-[10px] font-black text-white/30 uppercase tracking-widest bg-white/5 px-2.5 py-1 rounded-[8px] border border-white/5 shadow-inner">{t('valuation.market_estimation') || 'ESTIMATION'}</span>
							</div>
							
							<div class="relative w-full h-4 bg-[#08090D] rounded-full overflow-hidden flex shadow-inner border border-white/5">
								<div class="h-full bg-gradient-to-r from-white/20 to-white/60 rounded-l-full" style={{ width: '30%' }} />
								<div class="h-full bg-white relative shadow-[0_0_15px_white]" style={{ width: '40%' }} />
								<div class="h-full bg-gradient-to-r from-white/60 to-white/10 rounded-r-full" style={{ width: '30%' }} />
								<div class="absolute top-0 bottom-0 w-1.5 bg-[#3390ec] left-[50%] -translate-x-1/2 shadow-[0_0_15px_#3390ec] rounded-full" />
							</div>
							
							<div class="flex justify-between items-end w-full mt-1">
								<div class="flex flex-col text-left opacity-50">
									<span class="text-white/60 text-[10px] uppercase font-black tracking-widest mb-1">{t('valuation.floor') || 'LOW'}</span>
									<span class="text-white font-mono font-black text-[13px]">{parseFloat(data()?.low_ton || '0').toLocaleString('en-US')}</span>
								</div>
								<div class="flex flex-col text-center opacity-50">
									<span class="text-white/60 text-[10px] uppercase font-black tracking-widest mb-1">{t('valuation.expected_label') || 'EXPECTED'}</span>
									<span class="text-white font-mono font-black text-[13px]">{parseFloat(data()?.expected_ton || '0').toLocaleString('en-US')}</span>
								</div>
								<div class="flex flex-col text-right opacity-50">
									<span class="text-white/60 text-[10px] uppercase font-black tracking-widest mb-1">{t('valuation.ceiling') || 'HIGH'}</span>
									<span class="text-white font-mono font-black text-[13px]">{parseFloat(data()?.high_ton || '0').toLocaleString('en-US')}</span>
								</div>
							</div>
						</div>

						{/* 🧮 3. ADVANCED NET FLIP ROI ESTIMATOR (WITH HISTORICAL ACQUISITION DEDUCTION) */}
						<div class="w-full bg-gradient-to-br from-[#10b981]/15 via-[#12141C]/90 to-[#08090D] backdrop-blur-2xl border border-[#10b981]/30 rounded-[28px] p-6 flex flex-col gap-4 shadow-[0_10px_30px_rgba(16,185,129,0.15)] relative overflow-hidden">
							<div class="absolute -right-10 -top-10 w-40 h-40 bg-[#10b981]/10 blur-3xl rounded-full pointer-events-none" />
							<div class="flex items-center justify-between text-white/90 relative z-10 border-b border-[#10b981]/20 pb-3">
								<div class="flex items-center gap-2">
									<span class="material-symbols-outlined text-[22px] text-[#10b981]">calculate</span>
									<span class="text-[13px] font-black uppercase tracking-widest text-[#10b981]">{t('valuation.net_flip_title') || 'NET FLIP ESTIMATOR'}</span>
								</div>
								<span class="text-[9px] font-black text-[#10b981] bg-[#10b981]/10 px-2.5 py-1 rounded-[8px] border border-[#10b981]/30 shadow-sm">-5% FRAGMENT FEE</span>
							</div>
							
							<div class="flex flex-col gap-3 relative z-10">
								<Show when={pastSaleTon() > 0}>
									<div class="grid grid-cols-2 gap-2.5">
										<div class="bg-[#08090D]/80 border border-white/5 rounded-[16px] p-3 flex flex-col gap-0.5">
											<span class="text-white/40 text-[9px] font-black uppercase tracking-widest">{t('valuation.net_flip_past_buy') || 'PAST PURCHASE PRICE'}</span>
											<span class="text-white font-mono font-black text-[14px]">{pastSaleTon().toLocaleString('en-US')} TON</span>
										</div>
										<div class="bg-[#08090D]/80 border border-white/5 rounded-[16px] p-3 flex flex-col gap-0.5">
											<span class="text-white/40 text-[9px] font-black uppercase tracking-widest">{t('valuation.gross_sale') || 'GROSS VALUATION'}</span>
											<span class="text-white font-mono font-black text-[14px]">{expectedTon().toLocaleString('en-US')} TON</span>
										</div>
									</div>
								</Show>

								<div class="flex justify-between items-center w-full bg-[#08090D]/90 rounded-[20px] p-4 border border-[#10b981]/30 shadow-inner">
									<div class="flex flex-col text-start">
										<span class="text-white/50 text-[10px] uppercase font-black tracking-widest mb-0.5">{t('valuation.net_profit_wallet') || 'NET PROFIT TO WALLET'}</span>
										<span class="text-[#10b981] font-mono font-black text-[22px] tracking-tight drop-shadow-[0_0_10px_rgba(16,185,129,0.5)]">
											{netFlipProfit().toLocaleString('en-US', { maximumFractionDigits: 1 })} TON
										</span>
									</div>

									<Show when={pastSaleTon() > 0 && netRoiPercent() !== 0}>
										<div class="flex flex-col items-end">
											<span class="text-white/40 text-[9px] uppercase font-black tracking-widest mb-0.5">{t('valuation.net_flip_roi') || 'NET ROI'}</span>
											<span class={`font-mono font-black text-[16px] px-3 py-1 rounded-[10px] border shadow-sm ${netRoiPercent() > 0 ? 'bg-[#10b981]/20 text-[#10b981] border-[#10b981]/40' : 'bg-[#ff4a4a]/20 text-[#ff4a4a] border-[#ff4a4a]/40'}`}>
												{netRoiPercent() > 0 ? `+${netRoiPercent().toFixed(1)}%` : `${netRoiPercent().toFixed(1)}%`}
											</span>
										</div>
									</Show>
								</div>
							</div>
						</div>

						{/* 🔥 4. SEMANTIC SIMILAR USERNAMES & BRAND EQUIVALENTS */}
						<Show when={(data()?.similar?.length ?? 0) > 0}>
							<div class="w-full bg-[#12141C]/90 backdrop-blur-2xl border border-[#3390ec]/30 rounded-[28px] p-6 flex flex-col gap-4 shadow-[0_10px_30px_rgba(51,144,236,0.15)] relative overflow-hidden">
								<div class="absolute -right-8 -bottom-8 w-28 h-28 bg-[#3390ec]/10 blur-3xl rounded-full pointer-events-none" />
								
								<div class="flex items-center justify-between text-white/90 relative z-10 border-b border-white/5 pb-3">
									<div class="flex items-center gap-2.5">
										<span class="material-symbols-outlined text-[22px] text-[#3390ec]">hub</span>
										<span class="text-[13px] font-black uppercase tracking-widest text-white">{t('valuation.concept_similar_title') || 'CONCEPT SIMILAR USERNAMES'}</span>
									</div>
									<span class="text-[10px] font-black text-[#3390ec] bg-[#3390ec]/10 border border-[#3390ec]/30 px-2.5 py-1 rounded-[8px] shadow-sm">
										{t('valuation.ai_matched') || 'AI MATCHED'}
									</span>
								</div>

								<div class="flex flex-col gap-2.5 relative z-10">
									{data()?.similar?.map((item) => (
										<div 
											onClick={() => window.location.href = `/username?u=${item.username}`}
											class="flex items-center justify-between bg-[#08090D] hover:bg-white/[0.04] p-4 rounded-[18px] border border-white/5 transition-all cursor-pointer shadow-inner group"
										>
											<div class="flex flex-col gap-1 min-w-0">
												<div class="flex items-center gap-2">
													<span class="text-[#3390ec] font-black text-[15px] group-hover:underline truncate">@{item.username}</span>
													<span class={`text-[8px] font-black uppercase px-2 py-0.5 rounded-[6px] border ${item.status === 'sold' ? 'bg-[#10b981]/15 text-[#10b981] border-[#10b981]/30' : 'bg-amber-400/15 text-amber-400 border-amber-400/30'}`}>
														{item.status === 'sold' ? (t('valuation.historical_sale_badge') || 'HISTORICAL SALE') : (t('valuation.estimated_badge') || 'ESTIMATED')}
													</span>
												</div>
												<span class="text-white/40 text-[11px] font-medium truncate">{item.reason}</span>
											</div>

											<div class="flex flex-col items-end shrink-0 pl-3">
												<span class="text-white font-mono font-black text-[14px]">{item.sale_price?.toLocaleString()} TON</span>
												<span class="text-white/40 text-[10px] font-mono font-bold">≈ ${item.sale_price_usd?.toLocaleString('en-US', { maximumFractionDigits: 0 })}</span>
											</div>
										</div>
									))}
								</div>
							</div>
						</Show>

						{/* 🧬 5. SELLER DNA & BIDDING WAR RADAR */}
						<div class="w-full bg-[#12141C]/80 backdrop-blur-2xl border border-white/5 rounded-[28px] p-6 flex flex-col gap-4 shadow-sm">
							<div class="flex items-center justify-between text-white/90 border-b border-white/5 pb-3">
								<div class="flex items-center gap-2">
									<span class="material-symbols-outlined text-[20px] text-amber-400">person_search</span>
									<span class="text-[13px] font-black uppercase tracking-widest">{t('valuation.seller_dna_title') || 'SELLER DNA & RADAR'}</span>
								</div>
								<span class="text-[10px] font-black text-amber-400 bg-amber-400/10 border border-amber-400/20 px-2.5 py-1 rounded-[8px] shadow-sm">
									{data()?.wallet_info?.is_whale ? (t('valuation.market_whale') || 'MARKET WHALE') : (t('valuation.retail_holder') || 'RETAIL HOLDER')}
								</span>
							</div>

							<div class="grid grid-cols-2 gap-3">
								<div class="bg-[#08090D] border border-white/5 rounded-[18px] p-4 flex flex-col gap-1 shadow-inner">
									<span class="text-white/40 text-[10px] font-black uppercase tracking-widest">{t('valuation.bidding_war_title') || 'BIDDING WAR PROBABILITY'}</span>
									<span class="text-amber-400 font-mono font-black text-[16px]">
										{data()?.brandability ? `${Math.min(98, data()!.brandability + 15)}%` : '85%'}
									</span>
								</div>
								<div class="bg-[#08090D] border border-white/5 rounded-[18px] p-4 flex flex-col gap-1 shadow-inner">
									<span class="text-white/40 text-[10px] font-black uppercase tracking-widest">NEGOTIATION TACTIC</span>
									<span class="text-white font-mono font-black text-[13px]">
										{data()?.dictionary?.is_word ? (t('valuation.hard_negotiation') || 'HARD HOLD') : (t('valuation.soft_negotiation') || 'FLEXIBLE')}
									</span>
								</div>
							</div>
						</div>

						{/* ⚖️ 6. AUCTION PLAYBOOK & LIQUIDITY SCORE */}
						<div class="w-full bg-[#12141C]/80 backdrop-blur-2xl border border-white/5 rounded-[28px] p-6 flex flex-col gap-4 shadow-sm">
							<div class="flex items-center justify-between text-white/90 border-b border-white/5 pb-3">
								<div class="flex items-center gap-2">
									<span class="material-symbols-outlined text-[20px] text-[#3390ec]">gavel</span>
									<span class="text-[13px] font-black uppercase tracking-widest">{t('valuation.auction_playbook_title') || 'AI AUCTION PLAYBOOK'}</span>
								</div>
								<span class="text-[10px] font-black text-[#3390ec] bg-[#3390ec]/10 border border-[#3390ec]/20 px-2.5 py-1 rounded-[8px] shadow-sm">
									LIQUIDITY: {data()?.liquidity_rating || 'HIGH'}
								</span>
							</div>

							<div class="grid grid-cols-2 gap-3">
								<div class="bg-[#08090D] border border-white/5 rounded-[18px] p-4 flex flex-col gap-1 shadow-inner">
									<span class="text-white/40 text-[10px] font-black uppercase tracking-widest">RECOMMENDED START</span>
									<span class="text-white font-mono font-black text-[15px]">
										{data()?.auction_playbook?.start_price_ton ? `${data()?.auction_playbook?.start_price_ton} TON` : `${Math.round(expectedTon() * 0.7)} TON`}
									</span>
								</div>
								<div class="bg-[#08090D] border border-white/5 rounded-[18px] p-4 flex flex-col gap-1 shadow-inner">
									<span class="text-white/40 text-[10px] font-black uppercase tracking-widest">ESTIMATED DAYS TO SELL</span>
									<span class="text-emerald-400 font-mono font-black text-[15px]">
										{data()?.estimated_sell_time || '1-3 Days'}
									</span>
								</div>
							</div>
						</div>

						{/* 🚀 7. 12-MONTH PROJECTIONS */}
						<div class="w-full bg-[#12141C]/80 backdrop-blur-2xl border border-white/5 rounded-[28px] p-6 flex flex-col gap-5 shadow-sm">
							<div class="flex items-center justify-between border-b border-white/5 pb-4">
								<div class="flex items-center gap-2 text-white/90">
									<span class="material-symbols-outlined text-[20px] text-[#10b981]">rocket_launch</span>
									<span class="text-[13px] font-black uppercase tracking-widest">{t('valuation.roi_title') || '12-MO PROJECTION'}</span>
								</div>
								<span class="text-[9px] font-black text-[#10b981] bg-[#10b981]/10 border border-[#10b981]/20 px-2.5 py-1 rounded-[8px] shadow-sm">
									3-SCENARIOS
								</span>
							</div>

							<div class="grid grid-cols-3 gap-3">
								<div class="bg-[#08090D] border border-[#10b981]/30 rounded-[20px] p-4 flex flex-col items-center text-center gap-1.5 shadow-[inset_0_0_15px_rgba(16,185,129,0.1)]">
									<span class="text-[#10b981] text-[10px] font-black uppercase tracking-widest">BULL (+45%)</span>
									<span class="text-white font-mono font-black text-[14px] mt-1">
										{data()?.projected_growth?.bull_ton ? `${data()?.projected_growth?.bull_ton.toLocaleString()} TON` : `${Math.round(expectedTon() * 1.45).toLocaleString()} TON`}
									</span>
								</div>
								<div class="bg-[#08090D] border border-white/20 rounded-[20px] p-4 flex flex-col items-center text-center gap-1.5 shadow-inner">
									<span class="text-white/60 text-[10px] font-black uppercase tracking-widest">BASE (+22%)</span>
									<span class="text-white font-mono font-black text-[14px] mt-1">
										{data()?.projected_growth?.base_ton ? `${data()?.projected_growth?.base_ton.toLocaleString()} TON` : `${Math.round(expectedTon() * 1.22).toLocaleString()} TON`}
									</span>
								</div>
								<div class="bg-[#08090D] border border-[#ff4a4a]/30 rounded-[20px] p-4 flex flex-col items-center text-center gap-1.5 shadow-[inset_0_0_15px_rgba(255,74,74,0.1)]">
									<span class="text-[#ff4a4a] text-[10px] font-black uppercase tracking-widest">BEAR (-5%)</span>
									<span class="text-white font-mono font-black text-[14px] mt-1">
										{data()?.projected_growth?.bear_ton ? `${data()?.projected_growth?.bear_ton.toLocaleString()} TON` : `${Math.round(expectedTon() * 0.95).toLocaleString()} TON`}
									</span>
								</div>
							</div>
						</div>

						{/* 🧬 8. USERNAME STRUCTURAL ANATOMY */}
						<div class="w-full bg-[#12141C]/80 backdrop-blur-2xl border border-white/5 rounded-[28px] p-6 flex flex-col gap-4 shadow-sm">
							<div class="flex items-center justify-between text-white/90 border-b border-white/5 pb-3">
								<div class="flex items-center gap-2">
									<span class="material-symbols-outlined text-[20px] text-cyan-400">dna</span>
									<span class="text-[13px] font-black uppercase tracking-widest">STRUCTURAL ANATOMY</span>
								</div>
								<span class="text-[10px] font-mono font-black text-cyan-400 bg-cyan-400/10 border border-cyan-400/20 px-2.5 py-1 rounded-[8px]">
									LENGTH: {data()?.length || (data()?.username || username()).length} CHARS
								</span>
							</div>

							<div class="grid grid-cols-3 gap-3">
								<div class="bg-[#08090D] border border-white/5 rounded-[18px] p-3.5 flex flex-col gap-1 text-center shadow-inner">
									<span class="text-white/40 text-[9px] font-black uppercase">LETTERS ONLY</span>
									<span class="text-white font-mono font-black text-[13px]">
										{data()?.structure?.letters_only ? 'YES (PURE)' : 'NO'}
									</span>
								</div>
								<div class="bg-[#08090D] border border-white/5 rounded-[18px] p-3.5 flex flex-col gap-1 text-center shadow-inner">
									<span class="text-white/40 text-[9px] font-black uppercase">DIGITS</span>
									<span class="text-white font-mono font-black text-[13px]">
										{data()?.structure?.has_digits ? 'CONTAINS' : 'NONE'}
									</span>
								</div>
								<div class="bg-[#08090D] border border-white/5 rounded-[18px] p-3.5 flex flex-col gap-1 text-center shadow-inner">
									<span class="text-white/40 text-[9px] font-black uppercase">UNDERSCORE</span>
									<span class="text-white font-mono font-black text-[13px]">
										{data()?.structure?.has_underscore ? 'YES' : 'CLEAN'}
									</span>
								</div>
							</div>
						</div>

						{/* 🚀 9. HISTORY */}
						<div class="w-full bg-[#12141C]/80 backdrop-blur-2xl border border-white/5 rounded-[28px] p-6 flex flex-col gap-4 shadow-sm">
							<div class="flex items-center gap-2 text-white/90 border-b border-white/5 pb-3">
								<span class="material-symbols-outlined text-[20px] text-white">history</span>
								<span class="text-[13px] font-black uppercase tracking-widest">{t('valuation.history_title') || 'OWNERSHIP HISTORY'}</span>
							</div>
							<Show when={data()?.history?.is_sold || (data()?.history?.transactions?.length ?? 0) > 0} fallback={
								<div class="flex items-center gap-3.5 bg-[#10b981]/10 border border-[#10b981]/20 rounded-[16px] p-4.5 shadow-inner">
									<div class="w-8 h-8 rounded-[10px] bg-[#10b981]/20 flex items-center justify-center shrink-0">
										<span class="material-symbols-outlined text-[#10b981] text-[18px]">verified</span>
									</div>
									<span class="text-[#10b981] text-[12px] font-black uppercase tracking-widest">{t('valuation.not_sold') || 'NEVER SOLD ON FRAGMENT!'}</span>
								</div>
							}>
								<div class="flex flex-col rounded-[16px] overflow-hidden bg-[#08090D] border border-white/5 shadow-inner">
									<div class="grid grid-cols-3 p-3.5 bg-white/[0.03] text-[10px] font-black text-white/30 uppercase tracking-widest border-b border-white/5">
										<span>{t('valuation.sale_price') || 'PRICE'}</span><span class="text-center">{t('valuation.date') || 'DATE'}</span><span class="text-right">{t('valuation.buyer') || 'BUYER'}</span>
									</div>
									<Show when={(data()?.history?.transactions?.length ?? 0) > 0} fallback={<div class="p-6 text-center text-white/30 text-[12px] font-bold uppercase tracking-widest">NO TRANSACTION DATA</div>}>
										{data()?.history?.transactions?.map((tx, idx) => (
											<div class={`grid grid-cols-3 p-4 items-center text-[13px] hover:bg-white/[0.02] transition-colors ${idx !== (data()?.history?.transactions?.length || 0) - 1 ? 'border-b border-white/5' : ''}`}>
												<span class="text-white font-mono font-black">{tx.sale_price_ton} TON</span>
												<span class="text-white/40 text-[11px] font-mono font-bold text-center">{new Date(tx.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' })}</span>
												<span class="text-white font-mono font-black text-[12px] truncate text-right">{tx.buyer ? `${tx.buyer.slice(0, 5)}...${tx.buyer.slice(-4)}` : 'Fragment'}</span>
											</div>
										))}
									</Show>
								</div>
							</Show>
						</div>

					</div>

					{/* ═══════ HIDDEN HOLOGRAPHIC EXPORT CARD ═══════ */}
					<div class="fixed left-[-9999px] top-[-9999px] pointer-events-none">
						<div
							ref={hiddenCardRef}
							class={`w-[400px] h-[400px] p-[3px] bg-gradient-to-br ${getTierTheme(data()?.rarity?.tier || '').wrapper} rounded-[40px] flex flex-col overflow-hidden`}
						>
							<div class="w-full h-full bg-[#08090D] rounded-[37px] p-7 flex flex-col justify-between relative overflow-hidden">
								<div class="flex justify-between items-center z-10">
									<span class={`px-3 py-1.5 border rounded-[10px] text-[9px] font-black tracking-widest uppercase shadow-sm ${getTierTheme(data()?.rarity?.tier || '').badge}`}>
										{data()?.rarity?.tier || 'STANDARD'}
									</span>
									<span class="text-[10px] font-mono font-black text-white/30 tracking-[4px] uppercase bg-white/5 border border-white/5 px-3 py-1 rounded-[10px]">IFRAGMENT</span>
								</div>

								<div class="flex flex-col justify-center items-center z-10 text-center flex-grow py-4 w-full">
									<div class="flex items-center justify-center gap-2 w-full">
										<span class="text-white/20 font-black text-[22px]">✦</span>
										<span class={`inline-block font-black tracking-tighter bg-gradient-to-r ${getTierTheme(data()?.rarity?.tier || '').text} bg-clip-text text-transparent truncate max-w-[80%]`} style={{ 'font-size': getFontSize(data()?.username || username()) }} dir="ltr">
											@{data()?.username || username()}
										</span>
										<span class="text-white/20 font-black text-[22px]">✦</span>
									</div>
								</div>

								<div class="flex justify-between items-end border-t border-white/10 pt-4 z-10">
									<div class="flex flex-col gap-0.5 text-left">
										<span class="text-[9px] font-black text-white/40 uppercase tracking-widest">ESTIMATED VALUE</span>
										<div class="flex items-center gap-2">
											<span class="text-[28px] font-black text-white leading-none tracking-tight">{parseFloat(data()?.expected_ton || '0').toLocaleString('en-US')}</span>
											<span class="text-[13px] font-black text-[#3390ec] mb-0.5">TON</span>
										</div>
									</div>
									<div class="flex flex-col items-end gap-1.5">
										<span class="text-[13px] text-white/60 font-black leading-none font-mono">≈ ${parseFloat(data()?.expected_usd || '0').toLocaleString('en-US', { maximumFractionDigits: 0 })}</span>
									</div>
								</div>
							</div>
						</div>
					</div>

					{/* ═══════ PAYMENT MODAL GATE ═══════ */}
					<Show when={showPaymentGate()}>
						<Motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} class="fixed inset-0 bg-black/80 backdrop-blur-xl z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
							<Motion.div initial={{ y: '100%' }} animate={{ y: 0 }} class="w-full max-w-[420px] bg-[#12141C] border-t sm:border border-white/10 rounded-t-[32px] sm:rounded-[32px] p-6 flex flex-col gap-5 shadow-2xl relative">
								<div class="flex justify-between items-center border-b border-white/5 pb-4">
									<div class="flex items-center gap-2">
										<span class="material-symbols-outlined text-amber-400 text-[24px]">lock</span>
										<h3 class="text-[17px] font-black text-white tracking-tight">{t('valuation.gate_title') || 'UNLOCK FULL AI INTELLIGENCE'}</h3>
									</div>
									<button onClick={() => window.history.back()} class="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/60 transition-colors">
										<span class="material-symbols-outlined text-[18px]">close</span>
									</button>
								</div>

								<Show when={paymentError()}>
									<div class="p-[#ff4a4a]/10 border border-[#ff4a4a]/30 rounded-[14px] text-[#ff4a4a] text-[12px] font-bold text-center">
										{paymentError()}
									</div>
								</Show>

								<div class="flex flex-col gap-3">
									{/* Stars Option */}
									<button onClick={handlePayStars} disabled={isProcessingPayment()} class="w-full relative group overflow-hidden bg-[#08090D] border border-amber-400/20 hover:border-amber-400/50 rounded-[24px] p-4.5 text-left transition-all active:scale-[0.98] disabled:opacity-50 shadow-md">
										<div class="absolute -right-6 -top-6 w-24 h-24 bg-amber-400/10 rounded-full blur-2xl group-hover:bg-amber-400/20 transition-all pointer-events-none" />
										<div class="relative flex items-center justify-between gap-3 z-10 w-full">
											<div class="flex items-center gap-4 flex-1 min-w-0">
												<div class="w-12 h-12 rounded-[16px] bg-amber-400/10 border border-amber-400/30 flex items-center justify-center shrink-0 shadow-inner">
													<span class="material-symbols-outlined text-amber-400 text-[26px]">star</span>
												</div>
												<div class="flex flex-col text-start min-w-0">
													<h4 class="text-[15px] font-black text-white truncate">{t('valuation.pay_stars_title') || 'Pay with Stars'}</h4>
													<span class="text-[11px] font-medium text-white/50 mt-0.5 truncate">{t('valuation.pay_stars_desc') || 'Instant Telegram Payment'}</span>
												</div>
											</div>
											<div class="px-3.5 py-1.5 rounded-[10px] bg-amber-400/10 border border-amber-400/30 text-amber-400 font-black text-[13px] shrink-0 flex items-center gap-1.5 shadow-sm">
												<span class="material-symbols-outlined text-[16px]">star</span> 49
											</div>
										</div>
									</button>

									{/* Coins Option */}
									<button onClick={handlePayCoins} disabled={isProcessingPayment()} class="w-full relative group overflow-hidden bg-[#08090D] border border-cyan-400/20 hover:border-cyan-400/50 rounded-[24px] p-4.5 text-left transition-all active:scale-[0.98] disabled:opacity-50 shadow-md">
										<div class="absolute -right-6 -top-6 w-24 h-24 bg-cyan-400/10 rounded-full blur-2xl group-hover:bg-cyan-400/20 transition-all pointer-events-none" />
										<div class="relative flex items-center justify-between gap-3 z-10 w-full">
											<div class="flex items-center gap-4 flex-1 min-w-0">
												<div class="w-12 h-12 rounded-[16px] bg-cyan-400/10 border border-cyan-400/30 flex items-center justify-center shrink-0 shadow-inner">
													<span class="material-symbols-outlined text-cyan-400 text-[26px]">toll</span>
												</div>
												<div class="flex flex-col text-start min-w-0">
													<h4 class="text-[15px] font-black text-white truncate">{t('valuation.pay_coins_title') || 'Pay with Coins'}</h4>
													<span class="text-[11px] font-medium text-white/50 mt-0.5 truncate">{t('valuation.pay_coins_desc') || 'Use your mined balance'}</span>
												</div>
											</div>
											<div class="px-3.5 py-1.5 rounded-[10px] bg-cyan-400/10 border border-cyan-400/30 text-cyan-400 font-black text-[13px] shrink-0 flex items-center gap-1.5 shadow-sm">
												<span class="material-symbols-outlined text-[16px]">toll</span> 88K
											</div>
										</div>
									</button>

									{/* Community Free Access */}
									<Show when={!freeQuotaUsed()}>
										<div class="w-full bg-[#08090D] border border-emerald-400/20 hover:border-emerald-400/50 rounded-[24px] p-4.5 flex flex-col gap-4 transition-all shadow-md mt-2">
											<div class="flex items-center gap-4">
												<div class="w-12 h-12 rounded-[16px] bg-emerald-400/10 border border-emerald-400/30 flex items-center justify-center shrink-0 shadow-inner">
													<span class="material-symbols-outlined text-emerald-400 text-[26px]">card_giftcard</span>
												</div>
												<div class="flex-1 flex flex-col text-start min-w-0">
													<h4 class="text-[15px] font-black text-white truncate">{t('valuation.free_channel_group_title') || 'Community Access'}</h4>
													<span class="text-[11px] font-medium text-white/50 mt-0.5 leading-relaxed">{t('valuation.free_channel_group_desc') || '1-Time Free pass for members'}</span>
												</div>
											</div>

											<div class="grid grid-cols-2 gap-2.5 w-full">
												<button onClick={() => openTelegramLink('https://t.me/FragmentsCommunity')} class="h-11 bg-white/5 hover:bg-white/10 border border-white/5 text-emerald-300 font-bold text-[12px] rounded-[14px] flex items-center justify-center gap-1.5 transition-all active:scale-95">
													<span class="material-symbols-outlined text-[18px]">podcasts</span> {t('valuation.join_channel_btn') || 'CHANNEL'}
												</button>
												<button onClick={() => openTelegramLink('https://t.me/FragmentInvestors')} class="h-11 bg-white/5 hover:bg-white/10 border border-white/5 text-emerald-300 font-bold text-[12px] rounded-[14px] flex items-center justify-center gap-1.5 transition-all active:scale-95">
													<span class="material-symbols-outlined text-[18px]">groups</span> {t('valuation.join_group_btn') || 'GROUP'}
												</button>
											</div>

											<button onClick={handleVerifyFreeAccess} disabled={isProcessingPayment()} class="w-full h-14 bg-gradient-to-r from-emerald-400 to-emerald-500 hover:from-emerald-300 hover:to-emerald-400 text-black font-black text-[13px] tracking-widest uppercase rounded-[16px] flex items-center justify-center gap-2 shadow-[0_8px_20px_rgba(52,211,153,0.3)] active:scale-95 transition-all disabled:opacity-50">
												<Show when={isProcessingPayment()} fallback={<><span class="material-symbols-outlined text-[20px]">verified</span>{t('valuation.verify_membership_btn') || 'VERIFY & ANALYZE'}</>}>
													<div class="w-5 h-5 border-2 border-black/20 border-t-black rounded-full animate-spin" />
												</Show>
											</button>
										</div>
									</Show>
								</div>

								<Show when={isProcessingPayment()}>
									<div class="absolute inset-0 bg-[#12141C]/90 backdrop-blur-md z-30 flex flex-col items-center justify-center rounded-t-[32px]">
										<span class="w-12 h-12 border-4 border-[#3390ec]/30 border-t-[#3390ec] rounded-full animate-spin mb-4 shadow-[0_0_15px_#3390ec]" />
										<span class="text-[14px] font-black uppercase tracking-widest text-white animate-pulse">PROCESSING...</span>
									</div>
								</Show>
							</Motion.div>
						</Motion.div>
					</Show>
				</div>
			</Show>
		</Show>
	);
};

export default UsernamePage;

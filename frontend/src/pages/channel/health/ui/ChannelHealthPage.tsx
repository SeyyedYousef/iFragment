import { Component, createResource, Show, For, onMount, onCleanup, createSignal } from 'solid-js';
import { useNavigate, useParams } from '@solidjs/router';
import { backButton } from '@tma.js/sdk-solid';
import { ChannelContextBar, ChannelHamburgerMenu, channelApi } from '@/entities/channel/index.js';
import { t, isRtl } from '@/shared/i18n/index.js';
import { haptic } from '@/shared/lib/haptic.js';

export const ChannelHealthPage: Component = () => {
	const params = useParams();
	const navigate = useNavigate();
	const [isMenuOpen, setIsMenuOpen] = createSignal(false);

	const [health, { refetch: refetchHealth }] = createResource(
		() => params.id,
		(id) => channelApi.getChannelHealth(id)
	);

	onMount(() => {
		try {
			if (backButton.isSupported() && backButton.mount.isAvailable()) {
				backButton.mount();
				backButton.show();
				backButton.onClick(() => {
					haptic.impact('light');
					navigate(`/channel/${params.id}/dashboard`);
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

	const getGradeColor = (grade: string) => {
		switch (grade) {
			case 'A': return 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10';
			case 'B': return 'text-blue-400 border-blue-500/30 bg-blue-500/10';
			case 'C': return 'text-amber-400 border-amber-500/30 bg-amber-500/10';
			default: return 'text-red-400 border-red-500/30 bg-red-500/10';
		}
	};

	const getRouteForCode = (code: string) => {
		switch (code) {
			case 'BOT_NOT_ADMIN': return `/channel/${params.id}/admins`;
			case 'NO_POSTING': return `/channel/${params.id}/posting`;
			case 'NO_FORWARDING': return `/channel/${params.id}/forwarding`;
			case 'NO_AUTO_RESPONDER': return `/channel/${params.id}/auto-responder`;
			case 'NO_DYNAMIC_BIO': return `/channel/${params.id}/dynamic-bio`;
			case 'NO_BUTTONS': return `/channel/${params.id}/buttons`;
			default: return `/channel/${params.id}/general`;
		}
	};

	return (
		<div class="min-h-screen bg-neutral-950 text-neutral-100 pb-28 pt-2 px-4" dir={isRtl() ? 'rtl' : 'ltr'}>
			<ChannelContextBar channelId={params.id} />
			<ChannelHamburgerMenu isOpen={isMenuOpen()} onClose={() => setIsMenuOpen(false)} channelId={params.id} activeTab="health" />

			{/* Header */}
			<div class="mt-4 mb-5 flex items-center justify-between">
				<div>
					<h1 class="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
						<span>🩺</span>
						<span>{t('channel.health.title') || 'Channel Health & Audit'}</span>
					</h1>
					<p class="text-xs text-neutral-400 mt-1">
						{t('channel.health.subtitle') || 'Live diagnostic audit of bot permissions, automation, and channel configuration.'}
					</p>
				</div>

				<button
					onClick={() => {
						haptic.impact('light');
						refetchHealth();
					}}
					class="p-2.5 rounded-xl bg-neutral-900 border border-neutral-800 text-neutral-300 hover:text-white text-xs transition-all active:scale-95"
					title="Refresh Audit"
				>
					🔄
				</button>
			</div>

			<Show when={health.loading}>
				<div class="space-y-4">
					<div class="h-44 rounded-2xl bg-neutral-900/60 animate-pulse border border-neutral-800" />
					<div class="h-64 rounded-2xl bg-neutral-900/60 animate-pulse border border-neutral-800" />
				</div>
			</Show>

			<Show when={!health.loading && health()}>
				{(data) => (
					<div class="space-y-5">
						{/* Overall Health Score Card */}
						<div class="p-6 rounded-2xl bg-gradient-to-br from-neutral-900 via-neutral-900/90 to-neutral-950 border border-neutral-800 relative overflow-hidden shadow-2xl">
							<div class="flex items-center justify-between">
								<div>
									<span class="text-xs font-semibold text-neutral-400 uppercase tracking-wider">
										{t('channel.health.overall_score') || 'Overall Health Score'}
									</span>
									<div class="text-4xl font-extrabold text-white mt-1 flex items-baseline gap-2">
										<span>{data().score}</span>
										<span class="text-xs text-neutral-500 font-normal">/ 100</span>
									</div>
									<div class="text-xs font-medium text-neutral-400 mt-1">
										Status: <span class="capitalize text-white font-semibold">{data().status}</span>
									</div>
								</div>

								<div class={`w-16 h-16 rounded-2xl border-2 flex items-center justify-center text-3xl font-black shadow-lg ${getGradeColor(data().grade)}`}>
									{data().grade}
								</div>
							</div>

							{/* Progress Bar */}
							<div class="w-full h-2 rounded-full bg-neutral-800 mt-4 overflow-hidden">
								<div
									class="h-full bg-gradient-to-r from-[#0098EA] to-emerald-400 rounded-full transition-all duration-500"
									style={{ width: `${data().score}%` }}
								/>
							</div>
						</div>

						{/* Diagnostic Checks Grid */}
						<div class="space-y-3">
							<h3 class="text-xs font-bold text-neutral-400 uppercase tracking-wider">
								{t('channel.health.diagnostic_checks') || 'System Diagnostics'}
							</h3>

							<div class="grid grid-cols-2 gap-2.5">
								<div class="p-3.5 rounded-xl bg-neutral-900 border border-neutral-800 flex items-center gap-3">
									<span class="text-lg">{data().bot_admin_verified ? '✅' : '❌'}</span>
									<div class="text-xs">
										<div class="font-semibold text-white">Bot Permissions</div>
										<div class="text-[10px] text-neutral-400">{data().bot_admin_verified ? 'Admin verified' : 'Missing admin rights'}</div>
									</div>
								</div>

								<div class="p-3.5 rounded-xl bg-neutral-900 border border-neutral-800 flex items-center gap-3">
									<span class="text-lg">{data().has_posting_configured ? '✅' : '⚠️'}</span>
									<div class="text-xs">
										<div class="font-semibold text-white">AI & Posting</div>
										<div class="text-[10px] text-neutral-400">{data().has_posting_configured ? 'Active' : 'Not configured'}</div>
									</div>
								</div>

								<div class="p-3.5 rounded-xl bg-neutral-900 border border-neutral-800 flex items-center gap-3">
									<span class="text-lg">{data().has_forwarding_rules ? '✅' : 'ℹ️'}</span>
									<div class="text-xs">
										<div class="font-semibold text-white">Forwarding Rules</div>
										<div class="text-[10px] text-neutral-400">{data().has_forwarding_rules ? 'Configured' : 'None active'}</div>
									</div>
								</div>

								<div class="p-3.5 rounded-xl bg-neutral-900 border border-neutral-800 flex items-center gap-3">
									<span class="text-lg">{data().has_auto_responder ? '✅' : 'ℹ️'}</span>
									<div class="text-xs">
										<div class="font-semibold text-white">Auto Responder</div>
										<div class="text-[10px] text-neutral-400">{data().has_auto_responder ? 'Enabled' : 'Disabled'}</div>
									</div>
								</div>

								<div class="p-3.5 rounded-xl bg-neutral-900 border border-neutral-800 flex items-center gap-3">
									<span class="text-lg">{data().has_dynamic_bio ? '✅' : 'ℹ️'}</span>
									<div class="text-xs">
										<div class="font-semibold text-white">Dynamic Bio</div>
										<div class="text-[10px] text-neutral-400">{data().has_dynamic_bio ? 'Syncing' : 'Disabled'}</div>
									</div>
								</div>

								<div class="p-3.5 rounded-xl bg-neutral-900 border border-neutral-800 flex items-center gap-3">
									<span class="text-lg">{data().has_inline_buttons ? '✅' : 'ℹ️'}</span>
									<div class="text-xs">
										<div class="font-semibold text-white">Inline Buttons</div>
										<div class="text-[10px] text-neutral-400">{data().has_inline_buttons ? 'Attached' : 'None'}</div>
									</div>
								</div>
							</div>
						</div>

						{/* Actionable Recommendations */}
						<div class="space-y-3">
							<h3 class="text-xs font-bold text-neutral-400 uppercase tracking-wider">
								{t('channel.health.recommendations') || 'Recommendations & Action Items'}
							</h3>

							<Show when={!data().recommendations || data().recommendations.length === 0}>
								<div class="p-4 rounded-xl bg-emerald-950/20 border border-emerald-500/20 text-center text-xs text-emerald-400">
									🎉 Excellent! All channel optimizations and bot permissions are in optimal health.
								</div>
							</Show>

							<For each={data().recommendations}>
								{(rec) => (
									<div class="p-4 rounded-xl bg-neutral-900 border border-neutral-800 flex items-center justify-between gap-3 shadow-md">
										<div class="flex items-start gap-2.5">
											<span class="text-base mt-0.5">
												{rec.severity === 'high' ? '🚨' : rec.severity === 'medium' ? '⚠️' : '💡'}
											</span>
											<div>
												<div class="text-xs font-bold text-white">
													{t(rec.title_key as any) || rec.code}
												</div>
												<div class="text-[11px] text-neutral-400 mt-0.5">
													{t(rec.desc_key as any) || 'Improve your channel automation score by configuring this module.'}
												</div>
											</div>
										</div>

										<button
											onClick={() => {
												haptic.impact('light');
												navigate(getRouteForCode(rec.code));
											}}
											class="py-1.5 px-3 rounded-lg bg-[#0098EA]/10 border border-[#0098EA]/30 text-[#0098EA] text-xs font-semibold hover:bg-[#0098EA]/20 active:scale-95 transition-all shrink-0"
										>
											{t('channel.health.fix_now') || 'Fix Now ➔'}
										</button>
									</div>
								)}
							</For>
						</div>
					</div>
				)}
			</Show>
		</div>
	);
};

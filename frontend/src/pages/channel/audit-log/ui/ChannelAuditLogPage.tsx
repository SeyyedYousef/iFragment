import { Motion } from '@motionone/solid';
import { useParams } from '@solidjs/router';
import { backButton } from '@tma.js/sdk-solid';
import { Component, createResource, createSignal, For, onCleanup, onMount, Show } from 'solid-js';
import { channelApi } from '@/shared/api/channel-management.js';
import { isRtl, t } from '@/shared/i18n/index.js';
import { ChannelContextBar } from '@/shared/ui/ChannelContextBar.js';
import { ChannelHamburgerMenu } from '@/shared/ui/channel-hamburger-menu.js';
import { SelectField } from '@/shared/ui/settings-controls.js';
import { showToast } from '@/shared/ui/toast.js';
import { haptic } from '@/shared/lib/haptic.js';

export const ChannelAuditLogPage: Component = () => {
	const params = useParams();
	const [isMenuOpen, setIsMenuOpen] = createSignal(false);

	const [actionFilter, setActionFilter] = createSignal('all');
	const [searchQuery, setSearchQuery] = createSignal('');

	const [auditLogsData] = createResource(
		() => params.id,
		(channelId) => channelApi.getAuditLogs(channelId),
	);

	const getActionIcon = (action: string) => {
		const act = action.toLowerCase();
		if (act.includes('delete') || act.includes('remove') || act.includes('disconnect')) return 'delete';
		if (act.includes('settings') || act.includes('update')) return 'settings';
		if (act.includes('ban') || act.includes('restrict')) return 'block';
		if (act.includes('create') || act.includes('add') || act.includes('connect')) return 'add_circle';
		if (act.includes('sync')) return 'sync';
		return 'info';
	};

	const getActionColor = (action: string) => {
		const act = action.toLowerCase();
		if (act.includes('delete') || act.includes('remove') || act.includes('disconnect')) return '#ff4a4a'; // Premium Red
		if (act.includes('settings') || act.includes('update')) return '#3390ec'; // Premium Blue
		if (act.includes('ban') || act.includes('restrict')) return '#ff9f0a'; // Premium Orange
		if (act.includes('create') || act.includes('add') || act.includes('connect')) return '#10b981'; // Premium Green
		if (act.includes('sync')) return '#06b6d4'; // Premium Cyan
		return '#8e8e93'; // Neutral
	};

	const formatLogTime = (timeStr: string) => {
		if (!timeStr) return '';
		const d = new Date(timeStr);
		return (
			d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) +
			' • ' +
			d.toLocaleDateString([], { month: 'short', day: 'numeric' })
		);
	};

	const filteredLogs = () => {
		const list = auditLogsData()?.data || [];
		return list.filter((log: any) => {
			const searchStr = searchQuery().toLowerCase();
			const actionMatch = actionFilter() === 'all' || log.action.toLowerCase().includes(actionFilter().toLowerCase());

			const actionStr = log.action.toLowerCase();
			const actorStr = log.actor_name.toLowerCase();

			const textMatch = actionStr.includes(searchStr) || actorStr.includes(searchStr);

			return textMatch && actionMatch;
		});
	};

	const escapeCsv = (value: unknown) => {
		const text = String(value ?? '');
		return `"${text.replace(/"/g, '""')}"`;
	};

	const handleExport = (format: 'csv' | 'json') => {
		const rows = filteredLogs();
		if (rows.length === 0) {
			haptic.notify('warning');
			showToast(t('channelAuditLog.noLogs'), 'info');
			return;
		}

		const content =
			format === 'json'
				? JSON.stringify(rows, null, 2)
				: [
						['id', 'actor_name', 'action', 'created_at'].map(escapeCsv).join(','),
						...rows.map((log: any) => [log.id, log.actor_name, log.action, log.created_at].map(escapeCsv).join(',')),
				  ].join('\n');
		const blob = new Blob([content], {
			type: format === 'json' ? 'application/json;charset=utf-8' : 'text/csv;charset=utf-8',
		});
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `channel-audit-${params.id}.${format}`;
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		URL.revokeObjectURL(url);
		haptic.notify('success');
		showToast(t('channelAuditLog.exported'), 'success');
	};

	onMount(() => {
		backButton.show();
		const off = backButton.onClick(() => {
			haptic.impact('light');
			window.history.back();
		});
		onCleanup(() => off());
	});

	return (
		<div class="min-h-screen bg-[#030303] pb-28 relative overflow-x-hidden text-white font-sans selection:bg-[#3390ec]/30" dir={isRtl() ? 'rtl' : 'ltr'}>
			
			{/* Ambient Top Glow */}
			<div class="absolute top-0 left-0 right-0 h-[350px] bg-gradient-to-b from-[#3390ec]/15 via-transparent to-transparent blur-[80px] pointer-events-none z-0" />

			{/* ═══════ PREMIUM STICKY HEADER ═══════ */}
			<div class="pt-6 pb-4 px-5 sticky top-0 bg-[#030303]/85 backdrop-blur-2xl z-40 border-b border-white/5 flex items-center justify-between gap-3 shadow-sm">
				<div class="flex items-center gap-3.5 overflow-hidden flex-1">
					<button
						onClick={() => { haptic.impact('light'); window.history.back(); }}
						class="w-11 h-11 rounded-[14px] bg-[#12141C]/80 flex items-center justify-center border border-white/10 hover:bg-white/10 active:scale-95 transition-all shrink-0 shadow-sm text-white/80"
						aria-label={t('common.back')}
					>
						<span class="material-symbols-outlined text-[22px] rtl:-scale-x-100">arrow_back</span>
					</button>
					<div class="flex flex-col overflow-hidden">
						<h1 class="text-[18px] font-black text-white leading-tight truncate tracking-tight">
							{t('channelAuditLog.title')}
						</h1>
						<span class="text-[11px] text-white/50 font-bold uppercase tracking-wider truncate mt-0.5">
							{t('channelAuditLog.subtitle')}
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

			<ChannelHamburgerMenu isOpen={isMenuOpen()} onClose={() => setIsMenuOpen(false)} channelId={params.id} activeTab="audit-log" />

			<div class="px-5 pt-5 flex flex-col gap-4 max-w-md mx-auto relative z-10 w-full pb-10">
				
				<ChannelContextBar channelId={params.id} />

				<Motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} class="flex flex-col gap-4">
					
					{/* ═══════ SEARCH & FILTERS ═══════ */}
					<div class="flex flex-col gap-3">
						<div class="relative z-10">
							<span class="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-white/40 text-[22px] pointer-events-none">search</span>
							<input
								type="text" value={searchQuery()} onInput={(e) => setSearchQuery(e.currentTarget.value)}
								placeholder={t('channelAuditLog.searchPlaceholder')}
								class="w-full h-14 bg-[#12141C]/80 backdrop-blur-xl border border-white/5 text-white text-[13px] font-bold rounded-[18px] pl-12 pr-4 focus:outline-none focus:border-[#3390ec]/50 placeholder-white/30 transition-all shadow-inner"
							/>
						</div>

						<div class="bg-[#12141C]/80 backdrop-blur-xl rounded-[18px] border border-white/5 p-1.5 shadow-sm">
							<SelectField
								label={t('channelAuditLog.filterAction')}
								value={actionFilter()}
								onChange={(v) => { haptic.selection(); setActionFilter(v); }}
								options={[
									{ value: 'all', label: t('channelAuditLog.allActions') },
									{ value: 'delete', label: t('channelAuditLog.actDeleted') },
									{ value: 'settings', label: t('channelAuditLog.actSettings') },
									{ value: 'sync', label: t('channelAuditLog.actSynced') },
								]}
							/>
						</div>

						{/* Export Buttons */}
						<div class="flex items-center gap-2.5">
							<button onClick={() => handleExport('csv')} class="flex-1 h-12 bg-white/5 border border-white/10 rounded-[14px] text-[12px] font-black uppercase tracking-widest hover:bg-white/10 active:scale-95 transition-all flex items-center justify-center gap-2 shadow-sm text-white/80">
								<span class="material-symbols-outlined text-[18px]">download</span> {t('channelAuditLog.exportCsv')}
							</button>
							<button onClick={() => handleExport('json')} class="flex-1 h-12 bg-white/5 border border-white/10 rounded-[14px] text-[12px] font-black uppercase tracking-widest hover:bg-white/10 active:scale-95 transition-all flex items-center justify-center gap-2 shadow-sm text-white/80">
								<span class="material-symbols-outlined text-[18px]">data_object</span> {t('channelAuditLog.exportJson')}
							</button>
						</div>
					</div>

					{/* ═══════ AUDIT LOG TIMELINE ═══════ */}
					<div class="bg-[#12141C]/80 backdrop-blur-xl rounded-[28px] border border-white/5 p-5 flex flex-col shadow-[0_10px_30px_rgba(0,0,0,0.2)] relative mt-2">
						
						<Show when={filteredLogs().length === 0}>
							<div class="py-10 flex flex-col items-center justify-center text-center gap-3 border border-dashed border-white/5 rounded-[20px]">
								<div class="w-14 h-14 rounded-[16px] bg-white/5 flex items-center justify-center border border-white/10 mb-1">
									<span class="material-symbols-outlined text-[28px] text-white/40">receipt_long</span>
								</div>
								<span class="text-white/40 text-[12px] font-bold tracking-wide">
									{t('channelAuditLog.noLogs')}
								</span>
							</div>
						</Show>

						<For each={filteredLogs()}>
							{(log: any, i) => {
								const color = getActionColor(log.action);
								return (
									<div class="flex gap-4 relative mb-5 last:mb-0 group">
										{/* Timeline Connector Line */}
										<Show when={i() !== filteredLogs().length - 1}>
											<div class="absolute top-12 bottom-[-20px] w-[2px] bg-gradient-to-b from-white/10 to-transparent" style={{ 'inset-inline-start': '23px' }} />
										</Show>
										
										{/* Action Icon */}
										<div
											class="w-12 h-12 rounded-[16px] flex items-center justify-center shrink-0 z-10 shadow-inner border transition-transform duration-300 group-hover:scale-105"
											style={{ 'background-color': `${color}15`, 'border-color': `${color}30`, color: color }}
										>
											<span class="material-symbols-outlined text-[20px] drop-shadow-md">
												{getActionIcon(log.action)}
											</span>
										</div>

										{/* Log Content */}
										<div class="flex flex-col flex-1 min-w-0 pt-0.5 justify-center">
											<div class="flex items-center justify-between gap-2 mb-1">
												<span class="text-[14px] font-black text-white truncate tracking-tight">
													{log.actor_name}
												</span>
												<span class="text-[10px] text-white/40 font-mono font-bold shrink-0 bg-white/5 px-2 py-0.5 rounded-[6px]">
													{formatLogTime(log.created_at)}
												</span>
											</div>
											<div class="flex items-center">
												<span class="text-[11px] font-black uppercase tracking-widest px-2 py-0.5 rounded-[6px] border shadow-sm" style={{ 'background-color': `${color}10`, 'border-color': `${color}20`, color: color }}>
													{log.action}
												</span>
											</div>
										</div>
									</div>
								);
							}}
						</For>
					</div>

				</Motion.div>
			</div>
		</div>
	);
};

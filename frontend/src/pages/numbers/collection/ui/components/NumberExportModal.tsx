import { type Component, Show } from 'solid-js';
import type { NumbersInstitutionalCollectionOverview } from '@/entities/numbers/model/types.js';
import { useI18n } from '@/shared/i18n/index.js';
import { haptic } from '@/shared/lib/haptic.js';

interface ExportModalProps {
	isOpen: boolean;
	onClose: () => void;
	overview?: NumbersInstitutionalCollectionOverview;
}

const EXPORT_COPY: Record<
	string,
	{
		title: string;
		desc: string;
		csvTitle: string;
		csvSub: string;
		jsonTitle: string;
		jsonSub: string;
		collectionLabel: string;
		schemaVer: string;
	}
> = {
	fa: {
		title: 'استخراج اسنپ‌شات کالکشن',
		desc: 'اسنپ‌شات کامل شامل شناسه رهگیری (Snapshot ID)، تایم‌استمپ رسمی UTC، وضعیت احراز اصالت آن‌چین و تمام متریک‌های نقدشوندگی است.',
		csvTitle: 'فرمت جدول اکسل (CSV)',
		csvSub: 'مناسب تحلیل در Excel / Google Sheets',
		jsonTitle: 'فرمت استاندارد برنامه‌نویسی (JSON)',
		jsonSub: 'داده خام ساخت‌یافته همراه با متادیتای کامل',
		collectionLabel: 'کالکشن EQAOQd...',
		schemaVer: 'نسخه اسکیما ۲.۰',
	},
	en: {
		title: 'Export Collection Snapshot',
		desc: 'Full institutional snapshot including Snapshot ID, UTC timestamp, on-chain provenance verification, and all liquidity metrics.',
		csvTitle: 'Spreadsheet Table (CSV)',
		csvSub: 'Ready for Excel / Google Sheets analysis',
		jsonTitle: 'Structured Developer Data (JSON)',
		jsonSub: 'Raw structured metrics with full provenance metadata',
		collectionLabel: 'Collection EQAOQd...',
		schemaVer: 'Schema v2.0',
	},
	ru: {
		title: 'Экспорт снимка коллекции',
		desc: 'Полный снимок включает Snapshot ID, метку времени UTC, статус ончейн-проверки и все показатели ликвидности.',
		csvTitle: 'Таблица CSV (Excel)',
		csvSub: 'Для анализа в Excel / Google Sheets',
		jsonTitle: 'Структурированный JSON',
		jsonSub: 'Сырые метрики с полными метаданными',
		collectionLabel: 'Коллекция EQAOQd...',
		schemaVer: 'Схема v2.0',
	},
	zh: {
		title: '导出系列快照数据',
		desc: '完整机构级快照包含 Snapshot ID、UTC 时间戳、链上防伪溯源状态及全套流动性指标。',
		csvTitle: '电子表格格式 (CSV)',
		csvSub: '适用于 Excel / Google Sheets 分析',
		jsonTitle: '标准开发者格式 (JSON)',
		jsonSub: '带完整元数据的结构化原始数据',
		collectionLabel: '合约 EQAOQd...',
		schemaVer: 'Schema v2.0',
	},
};

export const NumberExportModal: Component<ExportModalProps> = (props) => {
	const { locale } = useI18n();
	const copy = () => EXPORT_COPY[locale()] || EXPORT_COPY.fa;

	const downloadFile = (format: 'csv' | 'json') => {
		try {
			haptic.selection();
		} catch {}
		const baseUrl = '/api/v1/numbers/export';
		window.open(`${baseUrl}?format=${format}`, '_blank');
		props.onClose();
	};

	return (
		<Show when={props.isOpen}>
			<div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
				<div class="bg-[#0e121d] border border-white/10 rounded-3xl p-5 max-w-sm w-full shadow-2xl relative text-start">
					<div class="flex items-center justify-between mb-4 pb-2 border-b border-white/[0.08]">
						<div class="flex items-center gap-2">
							<span class="material-symbols-outlined text-emerald-400 text-xl">file_download</span>
							<h3 class="text-sm font-black text-white">{copy().title}</h3>
						</div>
						<button
							type="button"
							onClick={props.onClose}
							class="w-8 h-8 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] flex items-center justify-center text-white/50 hover:text-white"
						>
							<span class="material-symbols-outlined text-base">close</span>
						</button>
					</div>

					<p class="text-xs text-white/70 leading-relaxed mb-4">{copy().desc}</p>

					<div class="space-y-2.5">
						<button
							type="button"
							onClick={() => downloadFile('csv')}
							class="w-full p-3.5 rounded-2xl bg-white/[0.03] hover:bg-emerald-500/15 border border-white/[0.08] hover:border-emerald-500/30 flex items-center justify-between transition-all group"
						>
							<div class="flex items-center gap-3">
								<span class="material-symbols-outlined text-emerald-400 text-2xl">table_chart</span>
								<div class="text-start">
									<span class="text-xs font-black text-white block group-hover:text-emerald-400">
										{copy().csvTitle}
									</span>
									<span class="text-[10px] text-white/40 block mt-0.5">{copy().csvSub}</span>
								</div>
							</div>
							<span class="material-symbols-outlined text-white/40 group-hover:text-emerald-400 text-lg">
								arrow_forward
							</span>
						</button>

						<button
							type="button"
							onClick={() => downloadFile('json')}
							class="w-full p-3.5 rounded-2xl bg-white/[0.03] hover:bg-cyan-500/15 border border-white/[0.08] hover:border-cyan-500/30 flex items-center justify-between transition-all group"
						>
							<div class="flex items-center gap-3">
								<span class="material-symbols-outlined text-cyan-400 text-2xl">data_object</span>
								<div class="text-start">
									<span class="text-xs font-black text-white block group-hover:text-cyan-400">
										{copy().jsonTitle}
									</span>
									<span class="text-[10px] text-white/40 block mt-0.5">{copy().jsonSub}</span>
								</div>
							</div>
							<span class="material-symbols-outlined text-white/40 group-hover:text-cyan-400 text-lg">
								arrow_forward
							</span>
						</button>
					</div>

					<div class="mt-4 pt-3 border-t border-white/[0.06] text-[10px] font-mono text-white/40 flex justify-between">
						<span>{copy().collectionLabel}</span>
						<span>{copy().schemaVer}</span>
					</div>
				</div>
			</div>
		</Show>
	);
};

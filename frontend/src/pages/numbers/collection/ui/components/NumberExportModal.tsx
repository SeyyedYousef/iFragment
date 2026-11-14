import { type Component, Show } from 'solid-js';
import type { NumbersInstitutionalCollectionOverview } from '@/entities/numbers/model/types.js';
import { t } from '@/shared/i18n/index.js';
import { haptic } from '@/shared/lib/haptic.js';

interface ExportModalProps {
	isOpen: boolean;
	onClose: () => void;
	overview?: NumbersInstitutionalCollectionOverview;
}

export const NumberExportModal: Component<ExportModalProps> = (props) => {
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
			<div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
				<div class="frag-sheet rounded-[20px] p-5 max-w-sm w-full relative text-start">
					<div class="flex items-center justify-between mb-3.5 pb-2.5 border-b border-white/[0.07]">
						<div class="flex items-center gap-2">
							<span class="material-symbols-outlined text-[#4cd964] text-[20px]">
								file_download
							</span>
							<h3 class="text-[14.5px] font-semibold text-white">{t('numExport.title')}</h3>
						</div>
						<button
							type="button"
							onClick={props.onClose}
							class="w-8 h-8 rounded-[9px] frag-btn-secondary flex items-center justify-center text-[#8c9ba5] hover:text-white"
						>
							<span class="material-symbols-outlined text-[17px]">close</span>
						</button>
					</div>

					<p class="text-[12px] text-[#c7d0d9] leading-relaxed mb-4">{t('numExport.desc')}</p>

					<div class="space-y-2.5">
						<button
							type="button"
							onClick={() => downloadFile('csv')}
							class="w-full p-3.5 rounded-[12px] frag-inset hover:bg-[#4cd964]/10 hover:border-[#4cd964]/35 flex items-center justify-between transition-all group"
						>
							<div class="flex items-center gap-3">
								<span class="material-symbols-outlined text-[#4cd964] text-[22px]">
									table_chart
								</span>
								<div class="text-start">
									<span class="text-[13px] font-semibold text-white block group-hover:text-[#4cd964]">
										{t('numExport.csvTitle')}
									</span>
									<span class="text-[11px] text-[#8c9ba5] block mt-0.5">
										{t('numExport.csvSub')}
									</span>
								</div>
							</div>
							<span class="material-symbols-outlined text-[#60707c] group-hover:text-[#4cd964] text-[18px]">
								arrow_forward
							</span>
						</button>

						<button
							type="button"
							onClick={() => downloadFile('json')}
							class="w-full p-3.5 rounded-[12px] frag-inset hover:bg-[#2990ff]/10 hover:border-[#2990ff]/35 flex items-center justify-between transition-all group"
						>
							<div class="flex items-center gap-3">
								<span class="material-symbols-outlined text-[#2990ff] text-[22px]">
									data_object
								</span>
								<div class="text-start">
									<span class="text-[13px] font-semibold text-white block group-hover:text-[#2990ff]">
										{t('numExport.jsonTitle')}
									</span>
									<span class="text-[11px] text-[#8c9ba5] block mt-0.5">
										{t('numExport.jsonSub')}
									</span>
								</div>
							</div>
							<span class="material-symbols-outlined text-[#60707c] group-hover:text-[#2990ff] text-[18px]">
								arrow_forward
							</span>
						</button>
					</div>

					<div class="mt-4 pt-3 border-t border-white/[0.06] text-[11px] font-mono text-[#60707c] flex justify-between">
						<span>{t('numExport.collectionLabel')}</span>
						<span>{t('numExport.schemaVer')}</span>
					</div>
				</div>
			</div>
		</Show>
	);
};

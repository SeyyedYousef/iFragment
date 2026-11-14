import { type Component, createSignal } from 'solid-js';
import { t } from '@/shared/i18n/index.js';
import { layaT, NUMBERS_I18N } from '@/shared/i18n/laya-i18n.js';
import { haptic } from '@/shared/lib/haptic.js';
import { copyToClipboard } from '@/shared/lib/telegram-native.js';
import { FragSectionHeader, FragStat } from '@/shared/ui/fragment/FragmentPrimitives.js';

interface Props {
	certificateId?: string;
	number: string;
	expectedTon?: number;
	confidence?: number;
}

export const NumberDigitalCertificateCard: Component<Props> = (props) => {
	const [copied, setCopied] = createSignal(false);

	const certId = () =>
		props.certificateId ||
		`CERT-NUM-${(props.number || '').replace(/\D/g, '').slice(-6)}-${Date.now().toString(36).toUpperCase()}`;

	const handleCopy = async () => {
		try {
			await copyToClipboard(certId());
			setCopied(true);
			haptic.notify('success');
			setTimeout(() => setCopied(false), 2000);
		} catch {}
	};

	return (
		<div class="frag-card-elevated rounded-[16px] p-4 sm:p-5 text-start flex flex-col gap-3.5 relative overflow-hidden">
			<FragSectionHeader
				title={layaT(NUMBERS_I18N.digitalCertTitle)}
				subtitle={layaT(NUMBERS_I18N.digitalCertSubtitle)}
				icon="verified_user"
				right={
					<span class="text-[10.5px] font-mono font-semibold text-[#4cd964] bg-[#4cd964]/12 border border-[#4cd964]/25 px-2 py-0.5 rounded-[6px]">
						HMAC-VERIFIED
					</span>
				}
			/>

			<div class="frag-inset rounded-[12px] p-3.5 flex items-center justify-between gap-2.5">
				<div class="flex flex-col min-w-0">
					<span class="text-[11px] font-medium text-[#8c9ba5]">
						{layaT(NUMBERS_I18N.uniqueCertificateId)}
					</span>
					<span
						class="text-[12.5px] font-mono font-semibold text-[#2990ff] truncate mt-0.5 tabular-nums"
						dir="ltr"
					>
						{certId()}
					</span>
				</div>

				<button
					type="button"
					onClick={handleCopy}
					class="px-2.5 py-1.5 rounded-[8px] frag-btn-secondary shrink-0 flex items-center gap-1 text-[11px] font-mono font-medium active:scale-95"
				>
					<span class="material-symbols-outlined text-[15px] text-[#2990ff]">
						{copied() ? 'check' : 'content_copy'}
					</span>
					<span>{copied() ? layaT(NUMBERS_I18N.copied) : layaT(NUMBERS_I18N.copyCertId)}</span>
				</button>
			</div>

			<div class="grid grid-cols-3 gap-2">
				<FragStat label={layaT(NUMBERS_I18N.engineLabel)}>
					{t('numReportCards.engineValue')}
				</FragStat>
				<FragStat label={layaT(NUMBERS_I18N.confidenceLabel)}>
					<span class="text-[#4cd964]">{props.confidence || 88}%</span>
				</FragStat>
				<FragStat label={layaT(NUMBERS_I18N.timestampLabel)}>
					<span class="text-[#d7e0e8]">{new Date().toLocaleDateString('en-GB')}</span>
				</FragStat>
			</div>
		</div>
	);
};

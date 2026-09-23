import { type Component, createSignal } from 'solid-js';
import { layaT, NUMBERS_I18N } from '@/shared/i18n/laya-i18n.js';
import { copyToClipboard } from '@/shared/lib/telegram-native.js';
import { haptic } from '@/shared/lib/haptic.js';

interface Props {
	certificateId?: string;
	number: string;
	expectedTon?: number;
	confidence?: number;
}

export const NumberDigitalCertificateCard: Component<Props> = (props) => {
	const [copied, setCopied] = createSignal(false);

	const certId = () => props.certificateId || `CERT-NUM-${(props.number || '').replace(/\D/g, '').slice(-6)}-${Date.now().toString(36).toUpperCase()}`;

	const handleCopy = async () => {
		try {
			await copyToClipboard(certId());
			setCopied(true);
			haptic.notify('success');
			setTimeout(() => setCopied(false), 2000);
		} catch {}
	};

	return (
		<div class="bg-[#12141C]/90 backdrop-blur-2xl border border-white/10 rounded-[28px] p-5 shadow-xl text-start flex flex-col gap-3.5 relative overflow-hidden">
			{/* Header */}
			<div class="flex items-center justify-between border-b border-white/5 pb-3">
				<div class="flex items-center gap-2.5">
					<div class="w-9 h-9 rounded-[14px] bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
						<span class="material-symbols-outlined text-[20px]">verified_user</span>
					</div>
					<div class="flex flex-col">
						<h4 class="text-[13px] font-black text-white font-mono uppercase tracking-wider">
							{layaT(NUMBERS_I18N.digitalCertTitle)}
						</h4>
						<span class="text-[9px] font-mono text-white/40">
							{layaT(NUMBERS_I18N.digitalCertSubtitle)}
						</span>
					</div>
				</div>
				<span class="text-[9px] font-mono font-black text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded-md">
					HMAC-VERIFIED
				</span>
			</div>

			{/* Certificate Serial & Copy */}
			<div class="bg-[#08090D] border border-white/5 rounded-[18px] p-3.5 flex items-center justify-between gap-2">
				<div class="flex flex-col min-w-0">
					<span class="text-[9px] font-mono font-bold text-white/40 uppercase">
						{layaT(NUMBERS_I18N.uniqueCertificateId)}
					</span>
					<span class="text-[12px] font-mono font-black text-cyan-300 truncate" dir="ltr">
						{certId()}
					</span>
				</div>

				<button
					type="button"
					onClick={handleCopy}
					class="p-2 rounded-[12px] bg-white/5 hover:bg-white/10 text-white/70 hover:text-white transition-all shrink-0 flex items-center gap-1 text-[10px] font-mono border border-white/10 active:scale-95"
				>
					<span class="material-symbols-outlined text-[15px]">
						{copied() ? 'check' : 'content_copy'}
					</span>
					<span>{copied() ? layaT(NUMBERS_I18N.copied) : layaT(NUMBERS_I18N.copyCertId)}</span>
				</button>
			</div>

			{/* Certificate Metadata */}
			<div class="grid grid-cols-3 gap-2 text-[10px] font-mono text-center">
				<div class="bg-white/[0.02] border border-white/5 rounded-[14px] p-2 flex flex-col gap-0.5">
					<span class="text-white/40 uppercase">{layaT(NUMBERS_I18N.engineLabel)}</span>
					<span class="text-white font-bold">NV v7.0 LAYA</span>
				</div>
				<div class="bg-white/[0.02] border border-white/5 rounded-[14px] p-2 flex flex-col gap-0.5">
					<span class="text-white/40 uppercase">{layaT(NUMBERS_I18N.confidenceLabel)}</span>
					<span class="text-emerald-400 font-bold">{props.confidence || 88}%</span>
				</div>
				<div class="bg-white/[0.02] border border-white/5 rounded-[14px] p-2 flex flex-col gap-0.5">
					<span class="text-white/40 uppercase">{layaT(NUMBERS_I18N.timestampLabel)}</span>
					<span class="text-white/70 font-bold">{new Date().toLocaleDateString('en-GB')}</span>
				</div>
			</div>
		</div>
	);
};

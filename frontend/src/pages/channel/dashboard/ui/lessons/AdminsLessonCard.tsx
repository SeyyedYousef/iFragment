import { Component } from 'solid-js';
import { t } from '@/shared/i18n/index.js';

export const AdminsLessonCard: Component<{ onNavigate: () => void; isDone?: boolean }> = (props) => {
	return (
		<div class="bg-[#12141C]/80 backdrop-blur-xl border border-white/5 hover:border-white/15 rounded-[28px] p-5 flex flex-col gap-4 shadow-sm relative overflow-hidden transition-all">
			<div class="absolute -right-10 -bottom-10 w-32 h-32 bg-indigo-500/10 blur-3xl rounded-full pointer-events-none" />

			<div class="flex items-center justify-between relative z-10">
				<div class="flex items-center gap-2.5">
					<div class="w-9 h-9 rounded-[12px] bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
						<span class="material-symbols-outlined text-[20px]">admin_panel_settings</span>
					</div>
					<h3 class="text-[14px] font-black text-white">{t('lessons.admins.title')}</h3>
				</div>
				{props.isDone && (
					<span class="text-[10px] font-black text-[#10b981] bg-[#10b981]/10 border border-[#10b981]/25 px-2 py-0.5 rounded-[6px] flex items-center gap-1 uppercase tracking-wider">
						<span class="material-symbols-outlined text-[12px]">check_circle</span>
						{t('lessons.statusActive')}
					</span>
				)}
			</div>

			<p class="text-[12px] text-white/60 leading-relaxed font-medium relative z-10">
				{t('lessons.admins.desc')}
			</p>

			{/* Roles & Audit Log Visual Demo */}
			<div class="h-28 bg-[#08090D] rounded-[20px] border border-white/5 p-3 flex flex-col justify-around shadow-inner">
				<div class="flex items-center justify-between text-[11px] font-bold text-white/80 border-b border-white/5 pb-2">
					<span class="flex items-center gap-1.5">
						<span class="material-symbols-outlined text-[16px] text-indigo-400">shield_person</span>
						{t('lessons.admins.roleManagement')}
					</span>
					<span class="text-[9px] font-mono text-indigo-300 bg-indigo-500/10 px-2 py-0.5 rounded-[4px] border border-indigo-500/20">
						{t('lessons.admins.fullControl')}
					</span>
				</div>

				<div class="flex items-center justify-between text-[11px] font-bold text-white/80">
					<span class="flex items-center gap-1.5">
						<span class="material-symbols-outlined text-[16px] text-indigo-400">history</span>
						{t('lessons.admins.auditTrail')}
					</span>
					<span class="text-[9px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-[4px] border border-emerald-500/20">
						{t('lessons.admins.logged')}
					</span>
				</div>
			</div>

			<button
				onClick={props.onNavigate}
				class="w-full h-12 bg-white/5 border border-indigo-500/30 text-indigo-400 hover:bg-indigo-500/10 rounded-[16px] text-[12px] font-black uppercase tracking-widest flex items-center justify-center gap-2 active:scale-95 transition-all"
			>
				{t('lessons.admins.cta')}
				<span class="material-symbols-outlined text-[18px] rtl:-scale-x-100">arrow_forward</span>
			</button>
		</div>
	);
};

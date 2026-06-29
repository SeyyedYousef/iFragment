import { Component } from 'solid-js';
import { backButton } from '@tma.js/sdk-solid';
import { useNavigate } from '@solidjs/router';
import { t } from '@/shared/i18n/index.js';

export const CollectionInfoPage: Component = () => {
    const navigate = useNavigate();

    backButton.show();
    backButton.onClick(() => {
        navigate(-1);
    });

    return (
        <div class="min-h-screen bg-[#111214] flex flex-col items-center justify-center p-6 text-center">
            <div class="w-16 h-16 rounded-full bg-white/[0.03] border border-white/[0.06] flex items-center justify-center mb-6">
                <span class="material-symbols-outlined text-[32px] text-white/50">lock</span>
            </div>
            <h2 class="text-xl font-semibold text-white/90 mb-3">{t('home.collectionInfo')}</h2>
            <p class="text-[14px] text-white/50">{t('action.tempDisabled')}</p>
        </div>
    );
};

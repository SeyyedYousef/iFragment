import { apiClient } from './axios.js';

export interface ManagedUserbot {
	id: string;
	phone_number: string;
	status: string;
	channels_count: number;
	created_at: string;
	updated_at: string;
}

export const ownerApi = {
	listUserbots: () => apiClient.get<ManagedUserbot[]>('/owner/userbots').then((r: any) => r.data),

	sendUserbotCode: (phone: string) =>
		apiClient.post<{ phone_code_hash: string }>('/owner/userbot/send-code', { phone }).then((r: any) => r.data),

	verifyUserbotCode: (phone: string, code: string, phoneCodeHash: string) =>
		apiClient
			.post('/owner/userbot/verify-code', { phone, code, phone_code_hash: phoneCodeHash })
			.then((r: any) => r.data),

	deleteUserbot: (id: string) => apiClient.delete(`/owner/userbots/${id}`).then((r: any) => r.data),
};

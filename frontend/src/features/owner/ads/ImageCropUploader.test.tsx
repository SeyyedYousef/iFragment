import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ImageCropUploader } from './ImageCropUploader.js';

vi.mock('@/shared/i18n/index.js', () => ({
	t: (key: string, params?: Record<string, unknown>) =>
		params?.width && params?.height ? `${key} (${params.width}×${params.height})` : key,
	isRtl: () => false,
}));

vi.mock('@/shared/api/config.js', () => ({
	API_CONFIG: {
		BASE_URL: 'http://localhost:8080/api/v1',
		TIMEOUT: 10000,
	},
	buildMediaUrl: (url: string) => url,
}));

describe('ImageCropUploader', () => {
	afterEach(() => {
		cleanup();
		document.body.innerHTML = '';
	});
	it('renders drop zone when no currentImageUrl is provided', () => {
		const onUploaded = vi.fn();
		render(() => (
			<ImageCropUploader
				slot="investors_page"
				targetWidth={1080}
				targetHeight={1920}
				aspectRatio={9 / 16}
				onUploaded={onUploaded}
			/>
		));

		expect(screen.getByText('imageCrop.dragDrop')).toBeInTheDocument();
		expect(screen.getByText(/imageCrop\.formatsSpecs.*1080×1920/)).toBeInTheDocument();
	});

	it('renders active image preview and action buttons when currentImageUrl exists', () => {
		const onUploaded = vi.fn();
		const onRemove = vi.fn();

		render(() => (
			<ImageCropUploader
				slot="investors_page"
				currentImageUrl="/uploads/ads/test-investors.webp"
				targetWidth={1080}
				targetHeight={1920}
				aspectRatio={9 / 16}
				onUploaded={onUploaded}
				onRemove={onRemove}
			/>
		));

		const previewImg = screen.getByAltText('imageCrop.bannerPreviewAlt') as HTMLImageElement;
		expect(previewImg).toBeInTheDocument();
		expect(previewImg.src).toContain('/uploads/ads/test-investors.webp');

		expect(screen.getByText('imageCrop.replace')).toBeInTheDocument();
		expect(screen.getByText('imageCrop.remove')).toBeInTheDocument();
	});

	it('requires confirmation before triggering onRemove', () => {
		const onUploaded = vi.fn();
		const onRemove = vi.fn();

		render(() => (
			<ImageCropUploader
				slot="investors_page"
				currentImageUrl="/uploads/ads/test-investors.webp"
				onUploaded={onUploaded}
				onRemove={onRemove}
			/>
		));

		const removeBtn = screen.getByText('imageCrop.remove');
		fireEvent.click(removeBtn);

		expect(screen.getByText('imageCrop.removeConfirm')).toBeInTheDocument();
		expect(onRemove).not.toHaveBeenCalled();

		const confirmBtn = screen.getByText('imageCrop.confirm');
		fireEvent.click(confirmBtn);

		expect(onRemove).toHaveBeenCalledTimes(1);
	});
});

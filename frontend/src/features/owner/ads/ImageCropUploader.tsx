import { type Component, createEffect, createSignal, Show } from 'solid-js';
import { ownerApi } from '@/entities/owner/index.js';
import { buildMediaUrl } from '@/shared/api/config.js';
import { t } from '@/shared/i18n/index.js';

interface ImageCropUploaderProps {
	slot?: string;
	currentImageUrl?: string;
	onUploaded: (url: string, width: number, height: number, sizeBytes: number) => void;
}

export const ImageCropUploader: Component<ImageCropUploaderProps> = (props) => {
	const slot = () => props.slot || 'dashboard_banner';
	const targetWidth = 1080;
	const targetHeight = 384;

	const [_selectedFile, setSelectedFile] = createSignal<File | null>(null);
	const [imageSrc, setImageSrc] = createSignal<string | null>(null);
	const [imageEl, setImageEl] = createSignal<HTMLImageElement | null>(null);

	const [zoom, setZoom] = createSignal(1);
	const [panX, setPanX] = createSignal(0);
	const [panY, setPanY] = createSignal(0);
	const [isDragging, setIsDragging] = createSignal(false);
	const [dragStart, setDragStart] = createSignal({ x: 0, y: 0 });

	const [isUploading, setIsUploading] = createSignal(false);
	const [uploadProgress, setUploadProgress] = createSignal(0);
	const [errorMessage, setErrorMessage] = createSignal<string | null>(null);
	const [uploadedUrl, setUploadedUrl] = createSignal<string | null>(props.currentImageUrl || null);

	let canvasRef: HTMLCanvasElement | undefined;

	const handleFileSelect = (e: Event) => {
		const target = e.target as HTMLInputElement;
		if (target.files?.[0]) {
			loadFile(target.files[0]);
		}
	};

	const handleDrop = (e: DragEvent) => {
		e.preventDefault();
		if (e.dataTransfer?.files?.[0]) {
			loadFile(e.dataTransfer.files[0]);
		}
	};

	const loadFile = (file: File) => {
		setErrorMessage(null);
		if (
			!file.type.startsWith('image/') &&
			!/\.(jpe?g|png|webp|gif|bmp|avif|heic|svg)$/i.test(file.name)
		) {
			setErrorMessage(t('imageCrop.invalidFormat') || 'Only image files are supported');
			return;
		}
		if (file.size > 5 * 1024 * 1024) {
			setErrorMessage('File size exceeds maximum allowed limit of 5MB');
			return;
		}

		setSelectedFile(file);
		const reader = new FileReader();
		reader.onload = (ev) => {
			const src = ev.target?.result as string;
			setImageSrc(src);
			const img = new Image();
			img.onload = () => {
				setImageEl(img);
				setZoom(1);
				setPanX(0);
				setPanY(0);
			};
			img.src = src;
		};
		reader.readAsDataURL(file);
	};

	// Draw Canvas preview when zoom, pan, or image changes
	createEffect(() => {
		const img = imageEl();
		const canvas = canvasRef;
		if (!img || !canvas) return;

		const ctx = canvas.getContext('2d');
		if (!ctx) return;

		canvas.width = targetWidth;
		canvas.height = targetHeight;

		ctx.clearRect(0, 0, targetWidth, targetHeight);

		// Calculate scaled dimensions to fill canvas
		const scale = Math.max(targetWidth / img.width, targetHeight / img.height) * zoom();
		const drawW = img.width * scale;
		const drawH = img.height * scale;

		// Center + pan
		const x = (targetWidth - drawW) / 2 + panX();
		const y = (targetHeight - drawH) / 2 + panY();

		ctx.drawImage(img, x, y, drawW, drawH);
	});

	const handleMouseDown = (e: MouseEvent) => {
		setIsDragging(true);
		setDragStart({ x: e.clientX - panX(), y: e.clientY - panY() });
	};

	const handleMouseMove = (e: MouseEvent) => {
		if (!isDragging()) return;
		setPanX(e.clientX - dragStart().x);
		setPanY(e.clientY - dragStart().y);
	};

	const handleMouseUp = () => {
		setIsDragging(false);
	};

	const handlePerformUpload = async () => {
		const canvas = canvasRef;
		if (!canvas) return;

		setIsUploading(true);
		setUploadProgress(20);
		setErrorMessage(null);

		try {
			canvas.toBlob(async (blob) => {
				if (!blob) {
					setErrorMessage('Failed to generate image from canvas');
					setIsUploading(false);
					return;
				}

				setUploadProgress(50);
				try {
					const result = await ownerApi.uploadAdImage(blob, slot());
					setUploadProgress(100);
					setUploadedUrl(result.url);
					props.onUploaded(result.url, result.width, result.height, result.size_bytes);
					setImageSrc(null);
					setImageEl(null);
				} catch (err: any) {
					setErrorMessage(err.response?.data?.error || err.message || 'Upload failed');
				} finally {
					setIsUploading(false);
				}
			}, 'image/png');
		} catch (err: any) {
			setErrorMessage(err.message || 'Error processing crop');
			setIsUploading(false);
		}
	};

	return (
		<div class="space-y-4">
			{/* Current Active Banner Preview */}
			<Show when={uploadedUrl() && !imageSrc()}>
				<div class="rounded-xl border border-white/10 bg-black/40 p-4">
					<div class="mb-2 flex items-center justify-between text-xs text-white/60">
						<span>{t('imageCrop.activeBanner')}</span>
						<span class="text-emerald-400 font-mono">{t('imageCrop.ready')}</span>
					</div>
					<div class="relative overflow-hidden rounded-lg border border-white/10 aspect-[25/9] bg-white/5">
						<img
							src={buildMediaUrl(uploadedUrl()!)}
							alt={t('imageCrop.bannerPreviewAlt')}
							class="h-full w-full object-cover"
						/>
					</div>
				</div>
			</Show>

			{/* Drop Zone */}
			<Show when={!imageSrc()}>
				<div
					onDragOver={(e) => e.preventDefault()}
					onDrop={handleDrop}
					class="relative flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-white/20 bg-white/[0.02] p-6 text-center hover:border-amber-500/50 hover:bg-white/[0.04] transition-all cursor-pointer"
				>
					<input
						type="file"
						aria-label={t('imageCrop.uploadAriaLabel')}
						accept="image/*"
						onChange={handleFileSelect}
						class="absolute inset-0 opacity-0 cursor-pointer"
					/>
					<div class="flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/10 text-amber-400 mb-3">
						<span class="material-symbols-outlined text-2xl">cloud_upload</span>
					</div>
					<div class="text-sm font-medium text-white">{t('imageCrop.dragDrop')}</div>
					<div class="text-xs text-white/50 mt-1">{t('imageCrop.formats')}</div>
				</div>
			</Show>

			{/* Interactive Canvas Cropper */}
			<Show when={imageSrc()}>
				<div class="rounded-2xl border border-amber-500/30 bg-black/60 p-4 space-y-4">
					<div class="flex items-center justify-between">
						<div class="flex items-center gap-2">
							<span class="material-symbols-outlined text-amber-400 text-lg">crop</span>
							<span class="text-sm font-semibold text-white">{t('imageCrop.adjustCrop')}</span>
						</div>
						<button
							type="button"
							onClick={() => {
								setImageSrc(null);
								setImageEl(null);
							}}
							class="text-xs text-white/50 hover:text-rose-400 transition"
						>
							{t('ownerCommon.cancel')}
						</button>
					</div>

					{/* Crop Canvas Display */}
					<div
						class="relative overflow-hidden rounded-xl border border-white/20 aspect-[25/9] bg-black cursor-move select-none"
						role="application"
						aria-label={t('imageCrop.cropAreaAriaLabel')}
						onMouseDown={handleMouseDown}
						onMouseMove={handleMouseMove}
						onMouseUp={handleMouseUp}
						onMouseLeave={handleMouseUp}
					>
						<canvas ref={canvasRef} class="w-full h-full object-contain pointer-events-none" />
						{/* Grid overlay guides */}
						<div class="absolute inset-0 grid grid-cols-3 grid-rows-3 pointer-events-none border border-amber-500/20">
							<div class="border-r border-b border-amber-500/10" />
							<div class="border-r border-b border-amber-500/10" />
							<div class="border-b border-amber-500/10" />
							<div class="border-r border-b border-amber-500/10" />
							<div class="border-r border-b border-amber-500/10" />
							<div class="border-b border-amber-500/10" />
							<div class="border-r border-amber-500/10" />
							<div class="border-r border-amber-500/10" />
							<div />
						</div>
					</div>

					{/* Zoom & Controls */}
					<div class="flex items-center gap-4 bg-white/5 p-3 rounded-xl cursor-pointer">
						<span class="material-symbols-outlined text-white/50 text-base">zoom_out</span>
						<input
							type="range"
							aria-label={t('imageCrop.zoomAriaLabel')}
							min="1"
							max="3"
							step="0.05"
							value={zoom()}
							onInput={(e) => setZoom(parseFloat(e.currentTarget.value))}
							class="w-full accent-amber-500"
						/>
						<span class="material-symbols-outlined text-white/50 text-base">zoom_in</span>
					</div>

					{/* Action Buttons */}
					<div class="flex items-center justify-end gap-3 pt-2">
						<button
							type="button"
							onClick={() => {
								setImageSrc(null);
								setImageEl(null);
							}}
							class="px-4 py-2 rounded-xl text-xs font-medium text-white/70 hover:bg-white/5 transition"
						>
							{t('ownerCommon.cancel')}
						</button>
						<button
							type="button"
							onClick={handlePerformUpload}
							disabled={isUploading()}
							class="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold bg-amber-500 hover:bg-amber-400 text-black transition shadow-lg shadow-amber-500/20 disabled:opacity-50"
						>
							<Show when={isUploading()} fallback={<span>{t('imageCrop.applyUpload')}</span>}>
								<div class="h-3.5 w-3.5 animate-spin rounded-full border-2 border-black border-t-transparent" />
								<span>Processing... {uploadProgress()}%</span>
							</Show>
						</button>
					</div>
				</div>
			</Show>

			{/* Error Message Alert */}
			<Show when={errorMessage()}>
				<div class="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300 flex items-center gap-2">
					<span class="material-symbols-outlined text-rose-400">error</span>
					<span>{errorMessage()}</span>
				</div>
			</Show>
		</div>
	);
};

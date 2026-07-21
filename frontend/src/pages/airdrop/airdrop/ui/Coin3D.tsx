import { createSignal, onCleanup, onMount } from 'solid-js';
import * as THREE from 'three';

interface Coin3DProps {
	onTap: (e: PointerEvent) => void;
	isPressed: boolean;
	isTurboActive: boolean;
	textureUrl?: string;
}

export function Coin3D(props: Coin3DProps) {
	let containerRef!: HTMLDivElement;
	let renderer: THREE.WebGLRenderer;
	let scene: THREE.Scene;
	let camera: THREE.PerspectiveCamera;
	let coinMesh: THREE.Mesh;
	let animationFrameId: number;

	const [tiltX, setTiltX] = createSignal(0);
	const [tiltY, setTiltY] = createSignal(0);

	onMount(() => {
		// Setup Scene
		scene = new THREE.Scene();

		// Setup Camera
		camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1000);
		camera.position.z = 5;

		// Setup Renderer
		renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
		renderer.setSize(containerRef.clientWidth, containerRef.clientHeight);
		renderer.setPixelRatio(window.devicePixelRatio);
		containerRef.appendChild(renderer.domElement);

		// Create Coin Geometry (Cylinder)
		const geometry = new THREE.CylinderGeometry(1.5, 1.5, 0.2, 64);

		// Create Material
		const textureLoader = new THREE.TextureLoader();
		let material: THREE.MeshStandardMaterial;

		if (props.textureUrl) {
			const texture = textureLoader.load(props.textureUrl);
			material = new THREE.MeshStandardMaterial({
				map: texture,
				metalness: 0.8,
				roughness: 0.2,
			});
		} else {
			material = new THREE.MeshStandardMaterial({
				color: 0xffd700, // Gold color fallback
				metalness: 0.9,
				roughness: 0.1,
			});
		}

		coinMesh = new THREE.Mesh(geometry, material);
		// Rotate to face camera
		coinMesh.rotation.x = Math.PI / 2;
		scene.add(coinMesh);

		// Add Lights
		const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
		scene.add(ambientLight);

		const directionalLight = new THREE.DirectionalLight(0xffffff, 2);
		directionalLight.position.set(2, 3, 4);
		scene.add(directionalLight);

		// Add pointer down logic to raycaster
		const raycaster = new THREE.Raycaster();
		const mouse = new THREE.Vector2();

		const handlePointerDown = (event: PointerEvent) => {
			const rect = renderer.domElement.getBoundingClientRect();
			mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
			mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

			raycaster.setFromCamera(mouse, camera);
			const intersects = raycaster.intersectObject(coinMesh);

			if (intersects.length > 0) {
				props.onTap(event);
			}
		};

		renderer.domElement.addEventListener('pointerdown', handlePointerDown);

		// Gyroscope tracking for parallax
		const handleOrientation = (event: DeviceOrientationEvent) => {
			if (event.gamma && event.beta) {
				// gamma is left/right tilt [-90, 90]
				// beta is front/back tilt [-180, 180]
				const clampedGamma = Math.max(-45, Math.min(45, event.gamma));
				const clampedBeta = Math.max(-45, Math.min(45, event.beta - 45)); // adjust base angle for holding phone

				setTiltX(clampedBeta * (Math.PI / 180));
				setTiltY(clampedGamma * (Math.PI / 180));
			}
		};

		if (window.DeviceOrientationEvent) {
			window.addEventListener('deviceorientation', handleOrientation);
		}

		// Animation Loop
		const animate = () => {
			animationFrameId = requestAnimationFrame(animate);

			// Apply tilt + idle animation
			const targetRotationX = Math.PI / 2 + tiltX() + (props.isPressed ? 0.1 : 0);
			const targetRotationY = tiltY();

			coinMesh.rotation.x += (targetRotationX - coinMesh.rotation.x) * 0.1;
			coinMesh.rotation.y += (targetRotationY - coinMesh.rotation.y) * 0.1;

			// Scale effect on press
			const targetScale = props.isPressed ? 0.95 : 1.0;
			coinMesh.scale.set(targetScale, targetScale, targetScale);

			// Turbo color change
			if (props.isTurboActive) {
				material.color.setHex(0xff5555);
			} else {
				material.color.setHex(0xffd700);
			}

			renderer.render(scene, camera);
		};

		animate();

		onCleanup(() => {
			cancelAnimationFrame(animationFrameId);
			window.removeEventListener('deviceorientation', handleOrientation);
			renderer.domElement.removeEventListener('pointerdown', handlePointerDown);
			renderer.dispose();
			geometry.dispose();
			material.dispose();
			if (containerRef && renderer.domElement) {
				containerRef.removeChild(renderer.domElement);
			}
		});
	});

	return (
		<div
			ref={containerRef}
			class="w-full h-full absolute inset-0 z-20 flex items-center justify-center cursor-pointer touch-none"
		/>
	);
}

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { GammaCorrectionShader } from 'three/addons/shaders/GammaCorrectionShader.js';

/* ====================================================================
   DEEP SPACE CINEMATIC EXPERIENCE (INTERSTELLAR STYLE)
   Features: Astronaut, Volumetric Nebulae, Galaxy, Film Grain, Bloom
   ==================================================================== */

// ── Globals ──────────────────────────────────────────────────────────
let scene, camera, renderer, composer, controls;
let astronaut, mixer;
let starSystem, nebulaSystem, galaxySystem;
let clock = new THREE.Clock();
let mouse = new THREE.Vector2();

// ── Configuration ────────────────────────────────────────────────────
const CONFIG = {
  bloomStrength: 1.5,
  bloomRadius: 0.5,
  bloomThreshold: 0.2, // Lower threshold to catch nebula glow
  filmGrain: 0.35,
  starCount: 12000,
  nebulaCount: 30,
  cameraDriftSpeed: 0.05
};

// ── Custom Shaders ───────────────────────────────────────────────────
const FilmGrainShader = {
  uniforms: {
    "tDiffuse": { value: null },
    "amount": { value: CONFIG.filmGrain },
    "time": { value: 0.0 }
  },
  vertexShader: `
        varying vec2 vUv;
        void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
        }
    `,
  fragmentShader: `
        uniform float amount;
        uniform float time;
        uniform sampler2D tDiffuse;
        varying vec2 vUv;
        float random( vec2 p ) {
            vec2 K1 = vec2( 23.14069263277926, 2.665144142690225 );
            return fract( cos( dot(p,K1) ) * 12345.6789 );
        }
        void main() {
            vec4 color = texture2D( tDiffuse, vUv );
            vec2 uvRandom = vUv;
            uvRandom.y *= random(vec2(uvRandom.y, time));
            color.rgb += random(uvRandom) * amount;
            gl_FragColor = vec4( color.rgb, color.a );
        }
    `
};

const VignetteShader = {
  uniforms: {
    "tDiffuse": { value: null },
    "offset": { value: 1.0 },
    "darkness": { value: 1.2 }
  },
  vertexShader: `
        varying vec2 vUv;
        void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
        }
    `,
  fragmentShader: `
        uniform float offset;
        uniform float darkness;
        uniform sampler2D tDiffuse;
        varying vec2 vUv;
        void main() {
            vec4 texel = texture2D( tDiffuse, vUv );
            vec2 uv = ( vUv - vec2( 0.5 ) ) * vec2( offset );
            gl_FragColor = vec4( texel.rgb * ( 1.0 - dot( uv, uv ) * darkness ), texel.a );
        }
    `
};

// ── Init ─────────────────────────────────────────────────────────────
init();
animate();

async function init() {
  // 1. Scene Setup
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000); // Pure black base
  scene.fog = new THREE.FogExp2(0x000005, 0.002); // Deep blue-black fog

  camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.set(0, 0, 15); // Start close to astronaut

  // 2. Renderer (High Quality)
  renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: "high-performance" }); // AA handled by composer
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.9;
  document.body.prepend(renderer.domElement);

  // 3. Post-Processing Pipeline
  composer = new EffectComposer(renderer);

  const renderPass = new RenderPass(scene, camera);
  composer.addPass(renderPass);

  const bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 1.5, 0.4, 0.85);
  bloomPass.threshold = CONFIG.bloomThreshold;
  bloomPass.strength = CONFIG.bloomStrength;
  bloomPass.radius = CONFIG.bloomRadius;
  composer.addPass(bloomPass);

  const grainPass = new ShaderPass(FilmGrainShader);
  grainPass.uniforms["amount"].value = CONFIG.filmGrain;
  composer.addPass(grainPass);

  const vignettePass = new ShaderPass(VignetteShader);
  vignettePass.uniforms["darkness"].value = 1.1;
  composer.addPass(vignettePass);

  const gammaCorrection = new ShaderPass(GammaCorrectionShader);
  composer.addPass(gammaCorrection);

  // 4. Controls (Cinematic)
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.02; // Very heavy, slow damping
  controls.enablePan = false;
  controls.minDistance = 5;
  controls.maxDistance = 50;
  controls.autoRotate = true;
  controls.autoRotateSpeed = 0.2; // Slow drift

  // 5. Lighting
  // Key Light (Distant Star) - Warm
  const keyLight = new THREE.DirectionalLight(0xffaa33, 3.0);
  keyLight.position.set(5, 5, 10);
  scene.add(keyLight);

  // Rim Light (Blue/Cold) - Backlight
  const rimLight = new THREE.SpotLight(0x4455ff, 5.0);
  rimLight.position.set(-5, 0, -5);
  rimLight.lookAt(0, 0, 0);
  scene.add(rimLight);

  // Fill (Very subtle purple)
  const fillLight = new THREE.PointLight(0x330044, 1.0, 20);
  fillLight.position.set(0, -5, 0);
  scene.add(fillLight);

  // 6. Environment Buildup
  createStarfield();
  createNebulae();
  createGalaxy();

  // 7. Load Astronaut
  await loadAstronaut();

  // 8. Event Listeners
  window.addEventListener('resize', onResize);
  document.getElementById('loader').classList.add('hidden'); // Hide loader when ready (or after delay)
}

// ── Astronaut ────────────────────────────────────────────────────────
async function loadAstronaut() {
  const loader = new GLTFLoader();
  // Using a reliable public domain model (Neil Armstrong / Spacesuit)
  const url = 'https://raw.githubusercontent.com/mrdoob/three.js/master/examples/models/gltf/NeilArmstrong.glb';

  return new Promise((resolve) => {
    loader.load(url, (gltf) => {
      astronaut = gltf.scene;
      astronaut.scale.set(1, 1, 1);
      astronaut.position.set(0, -1, 0);

      // Apply better PBR properties to existing materials
      astronaut.traverse((child) => {
        if (child.isMesh) {
          child.material.envMapIntensity = 1.0;
          child.material.metalness = 0.6;
          child.material.roughness = 0.4;
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });

      scene.add(astronaut);

      // Setup simple idle animation if present, otherwise procedural float
      mixer = new THREE.AnimationMixer(astronaut);
      if (gltf.animations.length > 0) {
        // Try to find a subtle idle
        const clip = gltf.animations[0];
        const action = mixer.clipAction(clip);
        action.play();
        action.timeScale = 0.5; // Slow motion breathing
      }

      resolve(astronaut);
    }, undefined, (error) => {
      console.error("Error loading astronaut", error);
      resolve(null);
    });
  });
}

// ── Starfield (10k Particles) ────────────────────────────────────────
function createStarfield() {
  const geometry = new THREE.BufferGeometry();
  const count = CONFIG.starCount;
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const sizes = new Float32Array(count);

  const color1 = new THREE.Color(0x9db4ff); // Blue-white
  const color2 = new THREE.Color(0xfff4ea); // Yellow-white
  const color3 = new THREE.Color(0xffc1c1); // Reddish

  for (let i = 0; i < count; i++) {
    // Uniform sphere distribution
    const r = 40 + Math.random() * 300;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);

    positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    positions[i * 3 + 2] = r * Math.cos(phi);

    const choice = Math.random();
    const c = choice > 0.8 ? color1 : (choice > 0.4 ? color2 : color3);
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;

    sizes[i] = Math.random() * 0.5 + 0.1;
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

  // Custom shader material for twinkling
  const material = new THREE.PointsMaterial({
    size: 0.2,
    vertexColors: true,
    transparent: true,
    opacity: 0.8,
    sizeAttenuation: true
  });

  starSystem = new THREE.Points(geometry, material);
  scene.add(starSystem);
}

// ── Nebulae (Volumetric Sprites) ─────────────────────────────────────
function createNebulae() {
  const geometry = new THREE.BufferGeometry();
  const count = CONFIG.nebulaCount;
  const positions = [];
  const colors = [];

  // Cloud texture loader
  const loader = new THREE.TextureLoader();
  const texture = loader.load('https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/sprites/cloud10.png');

  for (let i = 0; i < count; i++) {
    // Random placement in distance
    const x = (Math.random() - 0.5) * 100;
    const y = (Math.random() - 0.5) * 60;
    const z = (Math.random() - 0.5) * 60 - 50; // Push back
    positions.push(x, y, z);
    colors.push(Math.random(), Math.random(), Math.random());
  }

  // Using Sprites for Nebulae is easier than points for "Cloud" look
  nebulaSystem = new THREE.Group();
  for (let i = 0; i < count; i++) {
    const material = new THREE.SpriteMaterial({
      map: texture,
      color: Math.random() > 0.5 ? 0x220044 : 0x001133, // Purple / Deep Blue
      transparent: true,
      opacity: 0.05 + Math.random() * 0.1,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    const sprite = new THREE.Sprite(material);
    sprite.position.set(
      (Math.random() - 0.5) * 200,
      (Math.random() - 0.5) * 100,
      (Math.random() - 0.5) * 100 - 40
    );
    const scale = 40 + Math.random() * 60;
    sprite.scale.set(scale, scale, 1);
    sprite.rotation.z = Math.random() * Math.PI;
    nebulaSystem.add(sprite);
  }
  scene.add(nebulaSystem);
}

// ── Galaxy (Spiral) ──────────────────────────────────────────────────
function createGalaxy() {
  const params = {
    count: 5000,
    size: 0.2,
    radius: 100,
    branches: 3,
    spin: 1,
    randomness: 0.5,
    randomnessPower: 3,
    insideColor: '#ff6030',
    outsideColor: '#1b3984'
  };

  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(params.count * 3);
  const colors = new Float32Array(params.count * 3);

  const colorInside = new THREE.Color(params.insideColor);
  const colorOutside = new THREE.Color(params.outsideColor);

  for (let i = 0; i < params.count; i++) {
    const i3 = i * 3;
    const radius = Math.random() * params.radius;
    const spinAngle = radius * params.spin;
    const branchAngle = (i % params.branches) / params.branches * Math.PI * 2;

    const randomX = Math.pow(Math.random(), params.randomnessPower) * (Math.random() < 0.5 ? 1 : -1) * params.randomness * radius;
    const randomY = Math.pow(Math.random(), params.randomnessPower) * (Math.random() < 0.5 ? 1 : -1) * params.randomness * radius;
    const randomZ = Math.pow(Math.random(), params.randomnessPower) * (Math.random() < 0.5 ? 1 : -1) * params.randomness * radius;

    positions[i3] = Math.cos(branchAngle + spinAngle) * radius + randomX;
    positions[i3 + 1] = randomY; // Flat galaxy
    positions[i3 + 2] = Math.sin(branchAngle + spinAngle) * radius + randomZ;

    const mixedColor = colorInside.clone();
    mixedColor.lerp(colorOutside, radius / params.radius);

    colors[i3] = mixedColor.r;
    colors[i3 + 1] = mixedColor.g;
    colors[i3 + 2] = mixedColor.b;
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const material = new THREE.PointsMaterial({
    size: params.size,
    sizeAttenuation: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexColors: true
  });

  galaxySystem = new THREE.Points(geometry, material);
  galaxySystem.position.set(-60, -30, -100); // Distance placement
  galaxySystem.rotation.x = Math.PI / 3;
  scene.add(galaxySystem);
}

function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
}

// ── Animation Loop ───────────────────────────────────────────────────
function animate() {
  requestAnimationFrame(animate);

  const delta = clock.getDelta();
  const elapsed = clock.getElapsedTime();

  // 1. Astronaut Procedural Float
  if (astronaut) {
    astronaut.position.y = -1 + Math.sin(elapsed * 0.5) * 0.2; // Slow vertical drift
    astronaut.rotation.y = Math.sin(elapsed * 0.2) * 0.1; // Slow yaw drift
    astronaut.rotation.z = Math.cos(elapsed * 0.3) * 0.05; // Slow roll

    if (mixer) mixer.update(delta);
  }

  // 2. Slow Galaxy Rotation
  if (galaxySystem) {
    galaxySystem.rotation.y += 0.0005;
  }

  // 3. Nebula Drift
  if (nebulaSystem) {
    nebulaSystem.rotation.z += 0.0002;
  }

  // 4. Update Shader TimeUniforms
  const grainPass = composer.passes.find(p => p.uniforms && p.uniforms.time);
  if (grainPass) grainPass.uniforms.time.value = elapsed;

  controls.update();
  composer.render();
}

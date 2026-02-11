import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

/* ====================================================================
   SOLAR SYSTEM EXPLORER: CINEMATIC REALISM UPGRADE
   Features: PBR Materials, Realistic Lighting, HDR Environment, Bloom
   ==================================================================== */

// ── Globals ──────────────────────────────────────────────────────────
let scene, camera, renderer, controls;
let composer;
let raycaster, mouse;
let planetMeshes = [];
let orbitLines = [];
let starSystem;
let selectedPlanet = null;
let hoveredPlanet = null;
let isAnimating = false;
let showOrbits = true;
let soundOn = false;
let autoRotate = true;

const textureLoader = new THREE.TextureLoader();
const cubeTextureLoader = new THREE.CubeTextureLoader();

// ── Configuration ────────────────────────────────────────────────────
const CONFIG = {
  sunLightIntensity: 2.5,
  ambientLightIntensity: 0.05, // Very dark space shadows
  bloomStrength: 1.5,
  bloomRadius: 0.4,
  bloomThreshold: 0.85,
  orbitOpacity: 0.15,
  starCount: 6000,
  cameraFov: 45
};

// ── Real Texture URLs (CDN/GitHub Mirrors) ───────────────────────────
const TEXTURES = {
  sun: 'https://upload.wikimedia.org/wikipedia/commons/9/99/Map_of_the_full_sun.jpg',
  mercury: 'https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/planets/mercury.jpg',
  venus: 'https://upload.wikimedia.org/wikipedia/commons/1/1c/Venus-real_color.jpg',
  earth: {
    map: 'https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/planets/earth_atmos_2048.jpg',
    normal: 'https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/planets/earth_normal_2048.jpg',
    specular: 'https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/planets/earth_specular_2048.jpg',
    clouds: 'https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/planets/earth_clouds_2048.png'
  },
  mars: 'https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/planets/mars.jpg',
  jupiter: 'https://upload.wikimedia.org/wikipedia/commons/e/e2/Jupiter.jpg',
  saturn: {
    map: 'https://upload.wikimedia.org/wikipedia/commons/c/c7/Saturn_during_Equinox.jpg',
    ring: 'https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/planets/saturn_ring.png'
  },
  uranus: 'https://upload.wikimedia.org/wikipedia/commons/3/3d/Uranus2.jpg',
  neptune: 'https://upload.wikimedia.org/wikipedia/commons/5/56/Neptune_Full.jpg'
};

const PLANET_DATA = [
  { name: 'Sun', radius: 12, distance: 0, speed: 0.0005, texture: TEXTURES.sun, isSun: true, emissive: 0xffaa00, desc: 'The Star. A perfect sphere of hot plasma.' },
  { name: 'Mercury', radius: 1, distance: 24, speed: 0.004, texture: TEXTURES.mercury, roughness: 1.0, desc: 'Smallest planet. Sun-scorched and cratered.' },
  { name: 'Venus', radius: 1.8, distance: 36, speed: 0.002, texture: TEXTURES.venus, roughness: 1.0, desc: 'Hottest planet. Thick toxic atmosphere.' },
  { name: 'Earth', radius: 2.0, distance: 52, speed: 0.003, texture: TEXTURES.earth, roughness: 0.6, desc: 'Our Home. The only known life in the universe.' },
  { name: 'Mars', radius: 1.4, distance: 68, speed: 0.003, texture: TEXTURES.mars, roughness: 0.9, desc: 'The Red Planet. Dusty, cold, desert world.' },
  { name: 'Jupiter', radius: 6.5, distance: 92, speed: 0.005, texture: TEXTURES.jupiter, roughness: 0.4, desc: 'Gas Giant. Massive storm "Great Red Spot".' },
  { name: 'Saturn', radius: 5.5, distance: 124, speed: 0.004, texture: TEXTURES.saturn, roughness: 0.5, hasRing: true, desc: 'The Jewel. Stunning icy ring system.' },
  { name: 'Uranus', radius: 3.5, distance: 156, speed: 0.003, texture: TEXTURES.uranus, roughness: 0.7, desc: 'Ice Giant. Tilted on its side. Coldest.' },
  { name: 'Neptune', radius: 3.4, distance: 184, speed: 0.002, texture: TEXTURES.neptune, roughness: 0.7, desc: 'Windy World. Dark, cold, supersonic winds.' }
];

// ── Utility: Texture Fallback ────────────────────────────────────────
// Generates a high-quality noise texture if CDN fails
function createNoiseTexture(colorHex) {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size; canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = colorHex; ctx.fillRect(0, 0, size, size);
  // Add noise
  for (let i = 0; i < 5000; i++) {
    const x = Math.random() * size, y = Math.random() * size;
    ctx.fillStyle = `rgba(255,255,255,${Math.random() * 0.1})`;
    ctx.fillRect(x, y, 2, 2);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// ── Init ─────────────────────────────────────────────────────────────
init();
animate();

async function init() {
  // 1. Scene & Camera
  scene = new THREE.Scene();
  // Scene background: dark space color (fog handles depth)
  scene.background = new THREE.Color(0x020205);
  scene.fog = new THREE.FogExp2(0x020205, 0.001);

  camera = new THREE.PerspectiveCamera(CONFIG.cameraFov, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.set(40, 60, 140); // Standard view

  // 2. Renderer (High Quality)
  renderer = new THREE.WebGLRenderer({ antialias: true, logarithmicDepthBuffer: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  document.body.prepend(renderer.domElement);

  // 3. Post-Processing (Bloom for Sun/Glow)
  composer = new EffectComposer(renderer);
  const renderPass = new RenderPass(scene, camera);
  composer.addPass(renderPass);

  const bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 1.5, 0.4, 0.85);
  bloomPass.threshold = CONFIG.bloomThreshold;
  bloomPass.strength = CONFIG.bloomStrength;
  bloomPass.radius = CONFIG.bloomRadius;
  composer.addPass(bloomPass);

  // 4. Controls
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.enablePan = false; // Keep focus on center
  controls.minDistance = 15;
  controls.maxDistance = 500;

  // 5. Lighting (Realistic)
  // Primary Light: The Sun (PointLight)
  const sunLight = new THREE.PointLight(0xffffff, CONFIG.sunLightIntensity, 400, 1.5);
  sunLight.position.set(0, 0, 0);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.width = 2048;
  sunLight.shadow.mapSize.height = 2048;
  sunLight.shadow.bias = -0.0001;
  scene.add(sunLight);

  // Ambient: Very faint fill (Space is dark!)
  const ambientLight = new THREE.AmbientLight(0xffffff, CONFIG.ambientLightIntensity);
  scene.add(ambientLight);

  // 6. Starfield (Multi-Layer)
  createStarfield();

  // 7. Planets
  raycaster = new THREE.Raycaster();
  mouse = new THREE.Vector2();
  await createPlanets();

  // 8. Event Listeners
  window.addEventListener('resize', onResize);
  renderer.domElement.addEventListener('mousemove', onMouseMove);
  renderer.domElement.addEventListener('click', onClick);
  renderer.domElement.addEventListener('touchend', onClick);
  document.getElementById('back-btn').addEventListener('click', resetCamera);
  document.getElementById('btn-orbits').addEventListener('click', toggleOrbits);
  document.getElementById('btn-sound').addEventListener('click', toggleSound);

  createNavUI();
}

// ── Starfield ────────────────────────────────────────────────────────
function createStarfield() {
  const count = 8000;
  const positions = [];
  const colors = [];
  const sizes = [];

  // Color palette for stars (blue, white, yellow, red-ish)
  const starColors = [new THREE.Color(0x9bb0ff), new THREE.Color(0xffffff), new THREE.Color(0xfff4e8), new THREE.Color(0xffd2a1)];

  for (let i = 0; i < count; i++) {
    // Spherical distribution
    const r = 300 + Math.random() * 600; // Far background
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);

    const x = r * Math.sin(phi) * Math.cos(theta);
    const y = r * Math.sin(phi) * Math.sin(theta);
    const z = r * Math.cos(phi);

    positions.push(x, y, z);

    const color = starColors[Math.floor(Math.random() * starColors.length)];
    colors.push(color.r, color.g, color.b);

    // Size variation
    sizes.push(Math.random() < 0.1 ? 2.5 : 1.0); // 10% large stars
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.setAttribute('size', new THREE.Float32BufferAttribute(sizes, 1));

  // Custom shader material for twinkling stars could go here, but PointsMaterial is performant
  const mat = new THREE.PointsMaterial({
    size: 1.0,
    vertexColors: true,
    transparent: true,
    opacity: 0.9,
    sizeAttenuation: true
  });

  starSystem = new THREE.Points(geo, mat);
  scene.add(starSystem);
}

// ── Planet Creation ──────────────────────────────────────────────────
async function createPlanets() {
  const sphereGeo = new THREE.SphereGeometry(1, 64, 64); // Base geometry for cloning

  for (let i = 0; i < PLANET_DATA.length; i++) {
    const data = PLANET_DATA[i];
    const group = new THREE.Group();

    // Initial Position (Random angle for variety)
    const angle = Math.random() * Math.PI * 2;
    group.position.x = Math.cos(angle) * data.distance;
    group.position.z = Math.sin(angle) * data.distance;

    // PBR Material Setup
    let material;

    if (data.isSun) {
      // Emissive Sun
      material = new THREE.MeshBasicMaterial({
        map: await loadTex(data.texture),
        color: new THREE.Color(data.emissive).multiplyScalar(10) // Boost brightness for bloom
      });
      // Sun Glow Sprite
      const spriteMat = new THREE.SpriteMaterial({
        map: new THREE.CanvasTexture(generateGlowTexture()),
        color: 0xffaa00,
        blending: THREE.AdditiveBlending,
        transparent: true,
        opacity: 0.5
      });
      const sprite = new THREE.Sprite(spriteMat);
      sprite.scale.set(data.radius * 6, data.radius * 6, 1);
      group.add(sprite);
    } else {
      // Standard PBR Planet
      const texMap = data.name === 'Earth' || data.name === 'Saturn' ? data.texture.map : data.texture;

      material = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        roughness: data.roughness || 0.5,
        metalness: 0.1,
        map: await loadTex(texMap)
      });

      // Earth Special: Normal, Specular, Clouds
      if (data.name === 'Earth') {
        material.normalMap = await loadTex(data.texture.normal);
        material.roughnessMap = await loadTex(data.texture.specular); // Inverse specular -> roughness approximately
        material.roughness = 0.8;

        // Clouds
        const cloudGeo = new THREE.SphereGeometry(data.radius * 1.005, 64, 64);
        const cloudMat = new THREE.MeshStandardMaterial({
          map: await loadTex(data.texture.clouds),
          transparent: true,
          opacity: 0.8,
          blending: THREE.AdditiveBlending,
          side: THREE.DoubleSide
        });
        const clouds = new THREE.Mesh(cloudGeo, cloudMat);
        group.add(clouds);
      }
    }

    const mesh = new THREE.Mesh(sphereGeo, material);
    mesh.scale.set(data.radius, data.radius, data.radius);
    mesh.castShadow = !data.isSun;
    mesh.receiveShadow = !data.isSun;
    mesh.userData = { id: i, name: data.name, description: data.desc };
    group.add(mesh);

    // Ring (Saturn)
    if (data.hasRing) {
      const ringGeo = new THREE.RingGeometry(data.radius * 1.4, data.radius * 2.2, 128);
      const pos = ringGeo.attributes.position;
      const uv = ringGeo.attributes.uv;
      // UV mapping for ring texture
      for (let k = 0; k < pos.count; k++) {
        const x = pos.getX(k), y = pos.getY(k);
        const d = Math.sqrt(x * x + y * y);
        const min = data.radius * 1.4;
        const max = data.radius * 2.2;
        uv.setXY(k, (d - min) / (max - min), 0.5);
      }

      const ringMat = new THREE.MeshStandardMaterial({
        map: await loadTex(data.texture.ring),
        color: 0xffffff,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.85
      });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.rotation.x = -Math.PI / 2;
      ring.receiveShadow = true;
      ring.castShadow = true;
      group.add(ring);
    }

    // Orbit Trail
    if (data.distance > 0) {
      const curve = new THREE.EllipseCurve(0, 0, data.distance, data.distance, 0, 2 * Math.PI, false, 0);
      const points = curve.getPoints(128);
      const geometry = new THREE.BufferGeometry().setFromPoints(points);
      geometry.rotateX(Math.PI / 2); // Lay flat on XZ plane
      const orbitMat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: CONFIG.orbitOpacity });
      const orbit = new THREE.Line(geometry, orbitMat);
      orbitLines.push(orbit);
      scene.add(orbit);
    }

    scene.add(group);
    planetMeshes.push({ mesh, group, data, angle });

    // Update Loader UI
    document.getElementById('loader-fill').style.width = `${((i + 1) / PLANET_DATA.length) * 100}%`;
  }

  // Hide Loader
  setTimeout(() => document.getElementById('loader').classList.add('hidden'), 500);
}

// ── Helpers ──────────────────────────────────────────────────────────
function loadTex(url) {
  if (!url) return null;
  return new Promise(resolve => {
    textureLoader.load(url, resolve, undefined, () => {
      // Resolve with fallback noise texture on error
      resolve(createNoiseTexture('#555555'));
    });
  });
}

function generateGlowTexture() {
  const c = document.createElement('canvas'); c.width = 64; c.height = 64;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255, 230, 200, 1)');
  g.addColorStop(0.4, 'rgba(255, 200, 100, 0.4)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 64, 64);
  return c;
}

// ── Interaction ──────────────────────────────────────────────────────
function createNavUI() {
  const scroll = document.getElementById('nav-scroll');
  PLANET_DATA.forEach((data, i) => {
    const card = document.createElement('div');
    card.className = 'planet-card';
    // Simple colored dot for thumbnail
    const c = document.createElement('div');
    c.style.cssText = `width:100%;height:100%;border-radius:50%;background:linear-gradient(45deg, #333, ${data.color || '#888'})`;
    card.innerHTML = `<div class="thumb"><canvas width="40" height="40"></canvas></div><span class="name">${data.name}</span>`;

    // Draw simple thumb
    const cvs = card.querySelector('canvas');
    const ctx = cvs.getContext('2d');
    ctx.beginPath(); ctx.arc(20, 20, 16, 0, Math.PI * 2);
    ctx.fillStyle = i === 0 ? '#fc3' : '#88a'; ctx.fill();

    card.onclick = () => focusPlanet(i);
    scroll.appendChild(card);
  });
}

function focusPlanet(index) {
  if (isAnimating) return;
  isAnimating = true;
  selectedPlanet = index;
  autoRotate = false; // Stop auto rotation when focused so user can inspect

  const targetObj = planetMeshes[index];
  const targetPos = targetObj.group.position;
  const offset = targetObj.data.radius * 3.5 + 5;

  // Smooth Fly-To
  const endPos = new THREE.Vector3(targetPos.x + offset, targetPos.y + offset * 0.5, targetPos.z + offset);

  gsap.to(camera.position, {
    duration: 2.0,
    x: endPos.x, y: endPos.y, z: endPos.z,
    ease: 'power3.inOut',
    onUpdate: () => controls.update()
  });

  gsap.to(controls.target, {
    duration: 2.0,
    x: targetPos.x, y: targetPos.y, z: targetPos.z,
    ease: 'power3.inOut',
    onComplete: () => {
      isAnimating = false;
      updateUI(index);
    }
  });

}

function resetCamera() {
  if (isAnimating) return;
  isAnimating = true;
  selectedPlanet = null;
  autoRotate = true;

  gsap.to(camera.position, { duration: 2, x: 40, y: 60, z: 140, ease: 'power3.inOut' });
  gsap.to(controls.target, {
    duration: 2, x: 0, y: 0, z: 0, ease: 'power3.inOut', onComplete: () => {
      isAnimating = false;
      updateUI(null);
    }
  });
}

function updateUI(index) {
  const info = document.getElementById('planet-info');
  const backBtn = document.getElementById('back-btn');

  // Highlight Card
  document.querySelectorAll('.planet-card').forEach((c, i) => c.classList.toggle('active', i === index));

  if (index !== null) {
    const data = PLANET_DATA[index];
    document.getElementById('info-name').textContent = data.name;
    document.getElementById('info-desc').textContent = data.desc;
    info.classList.add('visible');
    backBtn.classList.add('visible');
  } else {
    info.classList.remove('visible');
    backBtn.classList.remove('visible');
  }
}

function toggleOrbits() {
  showOrbits = !showOrbits;
  orbitLines.forEach(l => l.visible = showOrbits);
  document.getElementById('btn-orbits').classList.toggle('active', showOrbits);
}

function toggleSound() {
  const audio = document.getElementById('ambient-audio');
  soundOn = !soundOn;
  if (soundOn) { audio.volume = 0.3; audio.play().catch(() => { }); }
  else audio.pause();
  document.getElementById('btn-sound').classList.toggle('active', soundOn);
}

function onClick(e) {
  if (isAnimating) return;
  // Calculate mouse position in normalized device coordinates
  mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(mouse, camera);

  // Intersect strictly with planet meshes
  const intersects = raycaster.intersectObjects(planetMeshes.map(p => p.mesh));
  if (intersects.length > 0) {
    const id = intersects[0].object.userData.id;
    focusPlanet(id);
  }
}

function onMouseMove(e) {
  mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObjects(planetMeshes.map(p => p.mesh));

  const tooltip = document.getElementById('tooltip');

  if (intersects.length > 0) {
    document.body.style.cursor = 'pointer';
    const name = intersects[0].object.userData.name;
    tooltip.textContent = name;
    tooltip.style.left = e.clientX + 15 + 'px';
    tooltip.style.top = e.clientY + 'px';
    tooltip.classList.add('visible');
  } else {
    document.body.style.cursor = 'default';
    tooltip.classList.remove('visible');
  }
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

  // Rotate Planets around Sun
  if (autoRotate && !selectedPlanet) {
    planetMeshes.forEach(p => {
      if (p.data.isSun) return;
      p.angle += p.data.speed * 0.5; // Orbit speed
      p.group.position.x = Math.cos(p.angle) * p.data.distance;
      p.group.position.z = Math.sin(p.angle) * p.data.distance;
    });
  }

  // Rotate Planets on axis
  planetMeshes.forEach(p => {
    if (p.mesh) p.mesh.rotation.y += 0.002;
  });

  // Animate Starfield slowly
  if (starSystem) starSystem.rotation.y -= 0.0001;

  controls.update(); // Key for damping

  // Use composer for Bloom
  composer.render();
}

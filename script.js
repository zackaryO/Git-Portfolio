/* ============================================================
   Portfolio interactions:
   - Three.js hero (icosahedron + particle field, mouse parallax)
   - Sticky-nav state on scroll
   - Mobile nav toggle
   - Reveal-on-scroll
   ============================================================ */

(function () {
  'use strict';

  /* ---------- Mobile nav ---------- */
  const burger = document.querySelector('.hamburger');
  const navLinks = document.querySelector('.nav-links');
  if (burger && navLinks) {
    burger.addEventListener('click', () => {
      const open = navLinks.classList.toggle('active');
      burger.setAttribute('aria-expanded', String(open));
    });
    navLinks.querySelectorAll('a').forEach(a => {
      a.addEventListener('click', () => {
        navLinks.classList.remove('active');
        burger.setAttribute('aria-expanded', 'false');
      });
    });
  }

  /* ---------- Sticky nav state ---------- */
  const header = document.getElementById('siteHeader');
  if (header) {
    const onScroll = () => {
      if (window.scrollY > 24) header.classList.add('scrolled');
      else header.classList.remove('scrolled');
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  /* ---------- Reveal-on-scroll ---------- */
  const revealTargets = document.querySelectorAll(
    '.section-title, .section-eyebrow, .about-card, .stat, .skill-group, .project-feature, .project-card, .contact-card, .other-work-title, .other-work-sub'
  );
  revealTargets.forEach(el => el.classList.add('reveal'));
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          e.target.classList.add('visible');
          io.unobserve(e.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -60px 0px' });
    revealTargets.forEach(el => io.observe(el));
  } else {
    revealTargets.forEach(el => el.classList.add('visible'));
  }

  /* ---------- Three.js hero ---------- */
  const canvas = document.getElementById('heroCanvas');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!canvas || typeof THREE === 'undefined' || reduceMotion) return;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100);
  camera.position.z = 4;

  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight, false);

  /* Wireframe icosahedron */
  const baseGeo = new THREE.IcosahedronGeometry(1.35, 1);
  const wire = new THREE.LineSegments(
    new THREE.WireframeGeometry(baseGeo),
    new THREE.LineBasicMaterial({
      color: 0x06b6d4,
      transparent: true,
      opacity: 0.55
    })
  );
  scene.add(wire);

  /* Inner ghost mesh for subtle depth */
  const ghostMesh = new THREE.Mesh(
    baseGeo,
    new THREE.MeshBasicMaterial({
      color: 0x0a3a4a,
      transparent: true,
      opacity: 0.18,
      side: THREE.BackSide
    })
  );
  scene.add(ghostMesh);

  /* Particle field */
  const PCOUNT = 380;
  const positions = new Float32Array(PCOUNT * 3);
  const speeds = new Float32Array(PCOUNT);
  for (let i = 0; i < PCOUNT; i++) {
    const r = 4 + Math.random() * 6;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    positions[i * 3]     = r * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta) * 0.6;
    positions[i * 3 + 2] = r * Math.cos(phi);
    speeds[i] = 0.0005 + Math.random() * 0.0015;
  }
  const pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const particles = new THREE.Points(
    pGeo,
    new THREE.PointsMaterial({
      color: 0x94a3b8,
      size: 0.025,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.7
    })
  );
  scene.add(particles);

  /* Mouse parallax */
  let targetX = 0, targetY = 0;
  let camX = 0, camY = 0;
  window.addEventListener('mousemove', (e) => {
    targetX = (e.clientX / window.innerWidth - 0.5) * 0.6;
    targetY = (e.clientY / window.innerHeight - 0.5) * 0.4;
  });
  window.addEventListener('touchmove', (e) => {
    if (!e.touches[0]) return;
    targetX = (e.touches[0].clientX / window.innerWidth - 0.5) * 0.6;
    targetY = (e.touches[0].clientY / window.innerHeight - 0.5) * 0.4;
  }, { passive: true });

  /* Resize */
  function resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
  }
  window.addEventListener('resize', resize);

  /* Animate */
  let running = true;
  document.addEventListener('visibilitychange', () => {
    running = !document.hidden;
    if (running) animate();
  });

  function animate() {
    if (!running) return;
    requestAnimationFrame(animate);

    wire.rotation.x += 0.0018;
    wire.rotation.y += 0.0024;
    ghostMesh.rotation.x = wire.rotation.x;
    ghostMesh.rotation.y = wire.rotation.y;

    particles.rotation.y += 0.0006;
    particles.rotation.x += 0.0002;

    /* Smooth parallax */
    camX += (targetX - camX) * 0.04;
    camY += (targetY - camY) * 0.04;
    camera.position.x = camX;
    camera.position.y = -camY;
    camera.lookAt(0, 0, 0);

    renderer.render(scene, camera);
  }
  animate();
})();

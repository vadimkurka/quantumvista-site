// ═══ THREE.JS PARTICLES ═══
(function(){
  const canvas = document.getElementById('particle-canvas');
  const renderer = new THREE.WebGLRenderer({canvas, alpha:true, antialias:true});
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(75, window.innerWidth/window.innerHeight, 0.1, 1000);
  camera.position.z = 3;

  const count = 2000;
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(count * 3);
  const vel = new Float32Array(count * 3);

  for(let i=0; i<count*3; i++){
    pos[i] = (Math.random()-0.5)*8;
    vel[i] = (Math.random()-0.5)*0.002;
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos,3));

  const mat = new THREE.PointsMaterial({
    color: 0x00F2FF,
    size: 0.015,
    transparent: true,
    opacity: 0.6,
    sizeAttenuation: true,
    blending: THREE.AdditiveBlending,
  });

  const points = new THREE.Points(geo, mat);
  scene.add(points);

  let mouseX=0, mouseY=0;
  document.addEventListener('mousemove', e=>{
    mouseX = (e.clientX/window.innerWidth-0.5)*2;
    mouseY = (e.clientY/window.innerHeight-0.5)*2;
  });

  function animate(){
    requestAnimationFrame(animate);
    const p = geo.attributes.position.array;
    for(let i=0; i<count*3; i++){
      p[i] += vel[i];
      if(Math.abs(p[i])>4) vel[i]*=-1;
    }
    geo.attributes.position.needsUpdate = true;

    points.rotation.x += 0.0002;
    points.rotation.y += 0.0003;

    camera.position.x += (mouseX*0.3 - camera.position.x)*0.02;
    camera.position.y += (-mouseY*0.3 - camera.position.y)*0.02;
    camera.lookAt(scene.position);

    renderer.render(scene, camera);
  }
  animate();

  window.addEventListener('resize', ()=>{
    camera.aspect = window.innerWidth/window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
})();

// ═══ NAV SCROLL ═══
const nav = document.getElementById('nav');
window.addEventListener('scroll', ()=> nav.classList.toggle('scrolled', window.scrollY>40));

// ═══ MOBILE MENU ═══
const toggle = document.getElementById('navToggle');
const links = document.getElementById('navLinks');
toggle.addEventListener('click', ()=> links.classList.toggle('open'));
links.querySelectorAll('a').forEach(a=> a.addEventListener('click', ()=> links.classList.remove('open')));

// ═══ SCROLL REVEAL ═══
const obs = new IntersectionObserver(entries=>{
  entries.forEach(e=>{
    if(e.isIntersecting){e.target.classList.add('vis');obs.unobserve(e.target)}
  });
},{threshold:0.1, rootMargin:'0px 0px -30px 0px'});
document.querySelectorAll('.rv').forEach(el=> obs.observe(el));

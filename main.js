import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

/* =========================
   RENDERER / SCENE
   ========================= */
const app = document.getElementById('app');
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NoToneMapping; // graphic/flat look
renderer.toneMappingExposure = 1.0;
app.appendChild(renderer.domElement);

const scene = new THREE.Scene();

/* =========================
   CAMERA / CONTROLS
   ========================= */
const cam = new THREE.PerspectiveCamera(48, innerWidth / innerHeight, 0.1, 10000);
cam.position.set(-140, 260, 560);
cam.lookAt(0, 60, 0);

const controls = new OrbitControls(cam, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.minDistance = 260;
controls.maxDistance = 1800;
controls.minPolarAngle = THREE.MathUtils.degToRad(12);
controls.maxPolarAngle = THREE.MathUtils.degToRad(84);
controls.autoRotate = false;

/* =========================
   LIGHTS (simple, for flat look)
   ========================= */
scene.add(new THREE.HemisphereLight('#dbe9ff', '#071121', 0.85));
const key = new THREE.DirectionalLight('#ffffff', 1.0);
key.position.set(500, 800, 480);
scene.add(key);

/* =========================
   THEME BACKDROP
   ========================= */
makeStars(2400, 3000, 1.4);
makeStars(1600, 2200, 1.0);
makeNebulaBillboard();

function makeStars(count, spread, size){
  const geom = new THREE.BufferGeometry();
  const pos = new Float32Array(count*3);
  for(let i=0;i<count;i++){
    const r = spread * (0.2 + Math.random()*0.8);
    const t = Math.random()*Math.PI*2;
    const p = (Math.random()-0.5)*0.6*Math.PI;
    pos[i*3+0] = Math.cos(t)*Math.cos(p)*r;
    pos[i*3+1] = Math.sin(p)*r*0.25;
    pos[i*3+2] = Math.sin(t)*Math.cos(p)*r;
  }
  geom.setAttribute('position', new THREE.BufferAttribute(pos,3));
  const mat = new THREE.PointsMaterial({ color:'#d9e8ff', size, transparent:true, opacity:0.95 });
  scene.add(new THREE.Points(geom, mat));
}
function makeNebulaBillboard(){
  const s = 1024;
  const c = document.createElement('canvas'); c.width=s; c.height=s;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(s/2,s/2,60,s/2,s/2,540);
  grad.addColorStop(0,'rgba(120,180,255,0.40)');
  grad.addColorStop(1,'rgba(20,30,60,0.0)');
  g.fillStyle=grad; g.fillRect(0,0,s,s);
  const tex = new THREE.CanvasTexture(c);
  const mat = new THREE.SpriteMaterial({ map: tex, transparent:true, depthWrite:false });
  const spr = new THREE.Sprite(mat);
  spr.scale.set(3200,3200,1);
  spr.position.set(0, -180, 0);
  scene.add(spr);
}

/* =========================
   HUD refs
   ========================= */
const LEGEND = document.getElementById('legend');

/* =========================
   UTILS
   ========================= */
const clamp = (v,a,b)=>Math.min(b,Math.max(a,v));
const lerp  = (a,b,t)=>a+(b-a)*t;
const norm  = (v,a,b)=> (b-a)? (v-a)/(b-a) : 0.5;
const clamp01 = t => clamp(t, 0, 1);
const fmtUSD = v=>{
  const s = Number(v||0);
  if (s>=1e9) return `$${(s/1e9).toFixed(2)}B`;
  if (s>=1e6) return `$${(s/1e6).toFixed(1)}M`;
  return s?`$${Math.round(s).toLocaleString()}`:'-';
};
const GENRE_COLORS = {
  'Action': '#ff6b6b',
  'Adventure': '#86e1ff',
  'Animation': '#ffd166',
  'Drama': '#7aa2ff',
  'Comedy': '#a3eea0',
  'Sci-Fi': '#b693ff',
  'Horror': '#ff9de2',
  'Crime': '#7bdff2',
  'Fantasy': '#d3b7ff',
  'Family': '#ffe29a',
  'Other': '#cbd5e1'
};

// store flag planes globally (declare BEFORE animate/init)
let FLAG_PLANES = [];

// Flat, non-reflective material
function flatMat(colorHex, emissiveIntensity = 0){
  const col = new THREE.Color(colorHex);
  return new THREE.MeshStandardMaterial({
    color: col,
    flatShading: true,
    metalness: 0,
    roughness: 1,
    emissive: col.clone().multiplyScalar(emissiveIntensity>0?1:0),
    emissiveIntensity
  });
}

// ROI unit normalizer: 1.6 -> 160, 160 -> 160
function normalizeROI(raw) {
  const v = Number(String(raw ?? 0).replace(/[^\d.\-]/g,'')) || 0;
  return (v > 0 && v <= 3) ? v * 100 : v;
}

// Build legend (compact)
(function buildLegend(){
  const ring = document.createElement('div'); ring.className='ring-swatch';
  const ringLbl = document.createElement('div'); ringLbl.textContent = 'Glowing summits (top peaks)';
  LEGEND.append(ring, ringLbl);
  for (const [k,v] of Object.entries(GENRE_COLORS)) {
    const sw = document.createElement('div'); sw.className='swatch'; sw.style.background=v;
    const label = document.createElement('div'); label.textContent = k;
    LEGEND.append(sw, label);
  }
})();

/* =========================
   LABEL SPRITES (no glow)
   ========================= */
const LABEL_SPRITES = [];
function makeTextSprite(text, {
  fontSize=18, color='#000207ff', panel=false, maxWidth=300
}={}){
  const padX = panel? 8:0, padY = panel? 3:0;
  const ctx0 = document.createElement('canvas').getContext('2d');
  ctx0.font = `800 ${fontSize}px Inter, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif`;
  let s = String(text);
  if (ctx0.measureText(s).width > maxWidth){
    while(s.length>0 && ctx0.measureText(s+'…').width>maxWidth) s=s.slice(0,-1);
    s+='…';
  }
  const w = Math.ceil(ctx0.measureText(s).width) + padX*2;
  const h = fontSize + padY*2;

  const c = document.createElement('canvas'); c.width=w*2; c.height=h*2;
  const ctx = c.getContext('2d'); ctx.scale(2,2);

  if(panel){
    ctx.fillStyle='rgba(10,15,28,0.92)';
    roundRect(ctx,0,0,w,h,6); ctx.fill();
    ctx.strokeStyle='rgba(120,150,220,0.85)'; ctx.lineWidth=1; ctx.stroke();
  }

  // NO glow/shadow/stroke:
  ctx.font = `800 ${fontSize}px Inter, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif`;
  ctx.textBaseline='top';
  ctx.fillStyle = color;
  ctx.fillText(s, padX, padY);

  const tex = new THREE.CanvasTexture(c);
  const mat = new THREE.SpriteMaterial({ map: tex, transparent:true, depthWrite:false });
  mat.depthTest = false;
  const spr = new THREE.Sprite(mat);
  spr.renderOrder = 999;
  spr.userData.pixelW=w; spr.userData.pixelH=h;
  LABEL_SPRITES.push(spr);

  // Keep approximate pixel size on screen
  const update=()=>{
    const distance = cam.position.distanceTo(spr.getWorldPosition(new THREE.Vector3()));
    const vFov = cam.fov * Math.PI/180;
    const worldScreenHeight = 2 * Math.tan(vFov/2) * distance;
    const worldPerPixel = worldScreenHeight / renderer.domElement.clientHeight;
    spr.scale.set(spr.userData.pixelW * worldPerPixel, spr.userData.pixelH * worldPerPixel, 1);
    requestAnimationFrame(update);
  };
  update();
  return spr;
}
function roundRect(ctx,x,y,w,h,r){
  const rr=Math.min(r,w/2,h/2);
  ctx.beginPath();
  ctx.moveTo(x+rr,y);
  ctx.arcTo(x+w,y,x+w,y+h,rr);
  ctx.arcTo(x+w,y+h,x,y+h,rr);
  ctx.arcTo(x,y+h,x,y,rr);
  ctx.arcTo(x,y,x+w,y,rr);
  ctx.closePath();
}

/* =========================
   SOFT GLOW TEXTURE (for summits only)
   ========================= */
let GLOW_TEX=null;
function getGlowTexture(){
  if(GLOW_TEX) return GLOW_TEX;
  const s=128;
  const c=document.createElement('canvas'); c.width=s; c.height=s;
  const g=c.getContext('2d');
  const r=s/2;
  const grad=g.createRadialGradient(r,r,0,r,r,r);
  grad.addColorStop(0,'rgba(255,255,220,1)');
  grad.addColorStop(0.5,'rgba(255,220,120,0.55)');
  grad.addColorStop(1,'rgba(255,220,120,0)');
  g.fillStyle=grad; g.fillRect(0,0,s,s);
  const tex=new THREE.CanvasTexture(c);
  tex.needsUpdate=true;
  GLOW_TEX=tex;
  return tex;
}

/* =========================
   BOOT
   ========================= */
animate();
init().catch(console.error);

window.addEventListener('resize', ()=>{
  cam.aspect = innerWidth / innerHeight;
  cam.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

/* =========================
   MAIN
   ========================= */
async function init(){
  // Load data
  let rows=[];
  try{
    rows = await loadCSV('./boxoffice_top50_roi.csv');
  }catch(e){
    console.warn('CSV fetch failed — using demo data', e);
  }
  if(!rows.length){
    rows = [
      { Title: 'Avatar', Worldwide_Gross: '2847246203', Profit_Margin_Pct: '160', IMDb_Rating: '7.8', Year: '2009', Main_Genre: 'Sci-Fi' },
      { Title: 'Avengers: Endgame', Worldwide_Gross: '2797800564', Profit_Margin_Pct: '140', IMDb_Rating: '8.4', Year: '2019', Main_Genre: 'Action' },
      { Title: 'Joker', Worldwide_Gross: '1074251311', Profit_Margin_Pct: '1000', IMDb_Rating: '8.4', Year: '2019', Main_Genre: 'Crime' },
      { Title: 'Top Gun: Maverick', Worldwide_Gross: '1493555028', Profit_Margin_Pct: '220', IMDb_Rating: '8.2', Year: '2022', Main_Genre: 'Action' },
      { Title: 'Oppenheimer', Worldwide_Gross: '960000000', Profit_Margin_Pct: '300', IMDb_Rating: '8.3', Year: '2023', Main_Genre: 'Drama' },
      { Title: 'The Dark Knight', Worldwide_Gross: '1004000000', Profit_Margin_Pct: '500', IMDb_Rating: '9.0', Year: '2008', Main_Genre: 'Action' },
      { Title: 'Spirited Away', Worldwide_Gross: '380000000', Profit_Margin_Pct: '800', IMDb_Rating: '8.6', Year: '2001', Main_Genre: 'Animation' },
      { Title: 'Frozen', Worldwide_Gross: '1280000000', Profit_Margin_Pct: '300', IMDb_Rating: '7.4', Year: '2013', Main_Genre: 'Animation' },
      { Title: 'Barbie', Worldwide_Gross: '1445834615', Profit_Margin_Pct: '420', IMDb_Rating: '6.8', Year: '2023', Main_Genre: 'Comedy' },
      { Title: 'Inception', Worldwide_Gross: '836000000', Profit_Margin_Pct: '350', IMDb_Rating: '8.8', Year: '2010', Main_Genre: 'Sci-Fi' },
      { Title: 'Parasite', Worldwide_Gross: '263000000', Profit_Margin_Pct: '600', IMDb_Rating: '8.5', Year: '2019', Main_Genre: 'Drama' },
      { Title: 'Minions', Worldwide_Gross: '1160000000', Profit_Margin_Pct: '400', IMDb_Rating: '6.4', Year: '2015', Main_Genre: 'Animation' }
    ];
  }

  // Normalize & compute Impact
  const rowsN = rows.map(r=>{
    const Title = r.Title || r.title || 'Untitled';
    const Gross = num(r.Worldwide_Gross || r.Gross || 0);
    const ROI   = normalizeROI(r.Profit_Margin_Pct ?? r.ROI ?? r.Return ?? 0); // percent
    const Rating= num(r.IMDb_Rating || r.rating || 0);
    const Year  = parseInt(r.Year || 0,10) || 0;
    const Genre = (r.Main_Genre || r.Genre || 'Other').split('/')[0];
    const Impact = (Rating || 0) * (ROI || 0) * Math.sqrt(Math.max(0, Gross));
    return { Title, Worldwide_Gross: Gross, ROI, IMDb_Rating: Rating, Year, Main_Genre: Genre, Impact };
  }).filter(d=>d.IMDb_Rating>0 && d.ROI>0 && d.Worldwide_Gross>0 && d.Year>0);

  if (!rowsN.length) return;

  // === Grid design ===
  const BUCKET_YEARS = 5; // 5-year bins
  const years = rowsN.map(d=>d.Year);
  const yearMin = Math.min(...years), yearMax = Math.max(...years);
  const y0 = Math.floor(yearMin / BUCKET_YEARS) * BUCKET_YEARS;
  const y1 = Math.ceil(yearMax / BUCKET_YEARS) * BUCKET_YEARS;
  const bins = [];
  for(let y=y0; y<=y1; y+=BUCKET_YEARS) bins.push(y);

  // Genres present -> rows
  const uniqueGenres = Array.from(new Set(rowsN.map(d=>d.Main_Genre))).sort();
  const G = uniqueGenres.length;
  const T = Math.max(1, bins.length - 1);

  // Aggregation: Impact per (genre,row) × (timeBin,col)
  // Keep best movie per cell for flags
  const grid = Array.from({length:G}, ()=> Array.from({length:T}, ()=>({ sum:0, count:0, best:null })));
  rowsN.forEach(d=>{
    const gi = uniqueGenres.indexOf(d.Main_Genre);
    const bi = clamp(Math.floor((d.Year - y0)/BUCKET_YEARS), 0, T-1);
    if (gi<0 || bi<0 || gi>=G || bi>=T) return;
    const cell = grid[gi][bi];
    cell.sum += d.Impact;
    cell.count++;
    if (!cell.best || d.Impact > cell.best.Impact) cell.best = d;
  });

  // Height domain
  const vals = [];
  grid.forEach(row=> row.forEach(c=> vals.push(c.sum)));
  const minH = Math.min(...vals);
  const maxH = Math.max(...vals);
  const scaleY = v => {
    const t = clamp01(norm(v, minH, maxH));
    return lerp(6, 180, Math.sqrt(t)); // eased vertical scale
  };

  // === Build terrain geometry ===
  const sizeX = 720; // world width across time
  const sizeZ = 420; // world depth across genres
  const segX = Math.max(1, T-1);
  const segZ = Math.max(1, G-1);

  const plane = new THREE.PlaneGeometry(sizeX, sizeZ, segX, segZ);
  plane.rotateX(-Math.PI/2); // make it horizontal

  const pos = plane.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const colorTmp = new THREE.Color();

  const vxPerRow = segX + 1;
  const vzPerCol = segZ + 1;

  for (let iz=0; iz<vzPerCol; iz++){
    for (let ix=0; ix<vxPerRow; ix++){
      const vIdx = iz*vxPerRow + ix;

      // Nearest cell indices
      const cx = clamp(ix-0.5, 0, segX-1);
      const cz = clamp(iz-0.5, 0, segZ-1);
      const bi = Math.round(cx);
      const gi = Math.round(cz);

      const cell = (grid[gi] && grid[gi][bi]) ? grid[gi][bi] : { sum: 0 };
      const h = scaleY(cell.sum);

      // Set height
      pos.setY(vIdx, h);

      // Color by genre row
      const genre = uniqueGenres[gi] || 'Other';
      colorTmp.set(GENRE_COLORS[genre] || GENRE_COLORS['Other']);

      // Slight brightness by height
      const t = clamp01(norm(h, 6, 180));
      const rgb = colorTmp.clone().lerp(new THREE.Color('#ffffff'), 0.18*t);
      colors[vIdx*3+0] = rgb.r;
      colors[vIdx*3+1] = rgb.g;
      colors[vIdx*3+2] = rgb.b;
    }
  }
  plane.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  plane.computeVertexNormals();

  const terrain = new THREE.Mesh(plane, new THREE.MeshStandardMaterial({
    vertexColors: true,
    flatShading: true,
    metalness: 0,
    roughness: 1
  }));
  terrain.position.y = 0;
  scene.add(terrain);

  // Axes labels + frame with vertical ticks (numbers)
  const padX = sizeX/2, padZ = sizeZ/2;
  addFrameBoxWithTicks(sizeX, sizeZ, 220, [0,25,50,75,100]); // % ticks on Y

  // Genre labels along Z
  for (let gi=0; gi<G; gi++){
    const z = lerp(-padZ, padZ, gi/(Math.max(1,G-1)));
    const lab = makeTextSprite(uniqueGenres[gi], { fontSize: 15, color:'#dfe8ff', panel:false, maxWidth: 220 });
    lab.position.set(-padX - 24, 12, z);
    scene.add(lab);
  }
  // Time labels along X
  for (let bi=0; bi<T; bi++){
    const x = lerp(-padX, padX, bi/(Math.max(1,T-1)));
    const yStart = y0 + bi*BUCKET_YEARS;
    const yEnd = yStart + BUCKET_YEARS - 1;
    const lab = makeTextSprite(`${yStart}–${yEnd}`, { fontSize: 15, color:'#dfe8ff', panel:false, maxWidth: 160 });
    lab.position.set(x, 12, padZ + 40);
    scene.add(lab);
  }

  // Summits (top N cells) with glow, adaptive pole & billboarding flags
  const PEAK_COUNT = 8;
  const cells = [];
  for (let gi=0; gi<G; gi++){
    for (let bi=0; bi<T; bi++){
      const c = grid[gi][bi];
      cells.push({ gi, bi, sum: c.sum, best: c.best });
    }
  }
  cells.sort((a,b)=> b.sum - a.sum);
  const peaks = cells.slice(0, Math.min(PEAK_COUNT, cells.length)).filter(p => p.sum>0);

  peaks.forEach(p=>{
    const x = lerp(-padX, padX, p.bi/(Math.max(1,T-1)));
    const z = lerp(-padZ, padZ, p.gi/(Math.max(1,G-1)));

    // sample height at nearest vertex (approx)
    const ix = Math.round(p.bi);
    const iz = Math.round(p.gi);
    const vIdx = iz*(segX+1) + ix;
    const y = pos.getY(vIdx);

    // glow (summit only, not text)
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({
      map: getGlowTexture(),
      color: 0xffffff,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      opacity: 0.92
    }));
    halo.scale.set(70, 70, 1);
    halo.position.set(x, y + 6, z);
    scene.add(halo);

    // adaptive pole
    const poleHeight = 26 + Math.random() * 4;
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.7, 0.7, poleHeight, 8),
      flatMat('#e6edf8', 0.05)
    );
    pole.position.set(x, y + poleHeight / 2, z);
    scene.add(pole);

    // flag (billboards toward camera)
    const flag = new THREE.Mesh(
      new THREE.PlaneGeometry(18, 9),
      flatMat('#ffe96f', 0.15)
    );
    flag.position.set(x + 9, y + poleHeight - 2, z);
    scene.add(flag);
    FLAG_PLANES.push(flag);

    // label (best movie in that cell) — NO glow
    const title = p.best ? p.best.Title : 'Peak';
    const metaTxt = p.best ? `IMDb ${p.best.IMDb_Rating.toFixed(1)} · ROI ${p.best.ROI.toFixed(0)}% · ${fmtUSD(p.best.Worldwide_Gross)}` : '';
    const lab1 = makeTextSprite(title, { fontSize: 15, color:'#000000ff', panel:false, maxWidth: 280 });
    lab1.position.set(x + 28, y + poleHeight - 0, z);
    scene.add(lab1);
    if (metaTxt){
      const lab2 = makeTextSprite(metaTxt, { fontSize: 15, color:'#000000ff', panel:false, maxWidth: 320 });
      lab2.position.set(x + 28, y + poleHeight - 16, z);
      scene.add(lab2);
    }
  });
}

/* =========================
   FRAME BOX WITH TICKS
   ========================= */
function addFrameBoxWithTicks(w, d, h=220, yTicks=[0,25,50,75,100]){
  const group = new THREE.Group();
  scene.add(group);
  const hw = w/2, hd = d/2;

  // main frame
  const edges = new THREE.EdgesGeometry(new THREE.BoxGeometry(w, h, d));
  const frame = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color:'#78aaff', transparent:true, opacity:0.5 }));
  frame.position.set(0, h/2, 0);
  group.add(frame);

  // ground grid
  const grid = new THREE.GridHelper(w, 8, '#5b7db5', '#223548');
  grid.position.y = 0.1;
  group.add(grid);

  // Axis labels (simple, no glow)
  const xLbl = makeTextSprite('Time → (5-yr bins)', { fontSize: 18, color: '#cfe6ff', panel:false });
  xLbl.position.set(hw+24, 18, 0); group.add(xLbl);

  const yLbl = makeTextSprite('Impact ↑', { fontSize: 18, color: '#cfe6ff', panel:false });
  yLbl.position.set(0, h+24, -hd-8); group.add(yLbl);

  const zLbl = makeTextSprite('Genre ⤴', { fontSize: 18, color: '#cfe6ff', panel:false });
  zLbl.position.set(0, 18, hd+24); group.add(zLbl);

  // Vertical ticks with numeric labels on the front-left edge
  const tickMat = new THREE.LineBasicMaterial({ color: '#8fb3ff', transparent:true, opacity:0.8 });
  const tickGeom = new THREE.BufferGeometry();
  const tickVerts = [];

  yTicks.forEach(pct=>{
    const yPos = (pct/100) * h; // percentage of box height
    const leftX = -hw, frontZ = -hd;

    // small tick line
    tickVerts.push(leftX, yPos, frontZ, leftX - 8, yPos, frontZ);

    // number label (no glow)
    const tLab = makeTextSprite(String(pct), { fontSize: 12, color:'#cfe6ff', panel:false });
    tLab.position.set(leftX - 14, yPos - 6, frontZ - 2);
    scene.add(tLab);
  });

  const tickPos = new Float32Array(tickVerts);
  tickGeom.setAttribute('position', new THREE.BufferAttribute(tickPos, 3));
  const ticks = new THREE.LineSegments(tickGeom, tickMat);
  group.add(ticks);
}

/* =========================
   RENDER LOOP
   ========================= */
function animate(){
  controls.update();

  // Billboard all flags to face camera + subtle flutter
  const t = performance.now() * 0.001;
  for (const flag of FLAG_PLANES){
    flag.lookAt(cam.position);
    flag.position.y += Math.sin(t * 2 + flag.position.x * 0.08) * 0.03; // optional flutter
  }

  renderer.render(scene, cam);
  requestAnimationFrame(animate);
}

/* =========================
   CSV loader / parsing
   ========================= */
async function loadCSV(url){
  const res = await fetch(url, { cache: 'no-cache' });
  if(!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  const text = await res.text();
  return parseCSV(text);
}
function parseCSV(text){
  const lines = text.replace(/\r\n/g,'\n').trim().split('\n');
  const headers = splitCSVLine(lines.shift());
  const out = [];
  for(const line of lines){
    if(!line.trim()) continue;
    const cols = splitCSVLine(line);
    const obj={};
    headers.forEach((h,i)=> obj[h.trim()] = (cols[i]??'').trim());
    out.push(obj);
  }
  return out;
}
function splitCSVLine(line){
  const out=[]; let cur=''; let inQ=false;
  for(let i=0;i<line.length;i++){
    const ch=line[i];
    if(ch==='"'){ if(inQ && line[i+1]==='"'){cur+='"'; i++;} else inQ=!inQ; }
    else if(ch===',' && !inQ){ out.push(cur); cur=''; }
    else cur+=ch;
  }
  out.push(cur); return out;
}
function num(v){
  if(v===null||v===undefined||v==='') return 0;
  const n=Number(String(v).replace(/[^\d.-]/g,'')); return isNaN(n)?0:n;
}

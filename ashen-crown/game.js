import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {Chess} from 'chess.js';

const $ = id => document.getElementById(id);
const app=$('app'), stage=$('stage'), chess=new Chess();
const TYPES={p:'pawn',n:'knight',b:'bishop',r:'rook',q:'queen',k:'king'};
const SCALE=1/0.057888091, TOP=.30;
const HOME={yaw:.055,pitch:1.00,zoom:1}, orbit={...HOME};
let mode='loading', pieces=[], selected=null, legal=[], animation=null, previewState=null;
let sound=false, audio=null, viewIndex=0, history=[], captures=[], ready=false;
const templates={}, particles=[], marks=[];
const reduced=$('motionSetting');
reduced.checked=matchMedia('(prefers-reduced-motion: reduce)').matches;
const v=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z);
const clamp=THREE.MathUtils.clamp;
const smooth=t=>{t=clamp(t,0,1);return t*t*(3-2*t)};
const positionOf=(s,y=TOP)=>v(s.charCodeAt(0)-100.5,y,3.5-(+s[1]-1));
const labelSide=c=>c==='w'?'Aurell':'Veyr';

const renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(devicePixelRatio,1.75));
renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.toneMapping=THREE.NeutralToneMapping;
renderer.toneMappingExposure=.90;
renderer.shadowMap.enabled=true;
renderer.shadowMap.type=THREE.PCFSoftShadowMap;
renderer.domElement.setAttribute('aria-label','Sculpted chess pieces on the Treaty Table');
$('viewport').append(renderer.domElement);
const scene=new THREE.Scene();scene.background=new THREE.Color(0x111310);
const camera=new THREE.PerspectiveCamera(36,1,.1,100), target=v(0,.42,0);
const pmrem=new THREE.PMREMGenerator(renderer), room=new RoomEnvironment();
scene.environment=pmrem.fromScene(room,.055).texture;
scene.environmentIntensity=.32;
room.dispose();pmrem.dispose();
scene.add(new THREE.HemisphereLight(0xdce1d1,0x26241d,.35));
const key=new THREE.DirectionalLight(0xffedda,1.6);key.position.set(-3,9,6);key.castShadow=true;
key.shadow.mapSize.set(innerWidth>=900?2048:1024,innerWidth>=900?2048:1024);
Object.assign(key.shadow.camera,{left:-6,right:6,top:6,bottom:-6,near:.5,far:25});
key.shadow.normalBias=.018;key.shadow.bias=-.00015;key.shadow.radius=3;scene.add(key);
const rim=new THREE.DirectionalLight(0xcbd7c7,.90);rim.position.set(5,5,-6);scene.add(rim);
const mat={
  white:new THREE.MeshPhysicalMaterial({color:0xcfc7b1,metalness:0,roughness:.36,clearcoat:.18,clearcoatRoughness:.30,envMapIntensity:.55}),
  black:new THREE.MeshPhysicalMaterial({color:0x232a23,metalness:.06,roughness:.28,clearcoat:.25,clearcoatRoughness:.24,envMapIntensity:.75}),
  light:new THREE.MeshStandardMaterial({color:0x929783,roughness:.7,metalness:0}),
  dark:new THREE.MeshStandardMaterial({color:0x353d30,roughness:.7,metalness:0}),
  frame:new THREE.MeshStandardMaterial({color:0x2b271f,roughness:.5,metalness:.03}),
  trim:new THREE.MeshStandardMaterial({color:0x76684b,roughness:.44,metalness:.45})
};
// The authored glTF supplies geometry only. Assign every surface explicitly.
const board=new THREE.Group();scene.add(board);
function box(w,h,d,material,x=0,y=0,z=0){const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material);m.position.set(x,y,z);m.receiveShadow=true;m.castShadow=true;board.add(m);return m}
box(8.8,.42,8.8,mat.frame,0,-.02,0);box(8.45,.06,8.45,mat.trim,0,.21,0);box(8.2,.045,8.2,mat.frame,0,.25,0);
const tileGeo=new THREE.BoxGeometry(.994,.055,.994), matrix=new THREE.Matrix4();
for(let parity=0;parity<2;parity++){
  const tiles=new THREE.InstancedMesh(tileGeo,parity?mat.light:mat.dark,32);let index=0;
  for(let rank=0;rank<8;rank++)for(let file=0;file<8;file++)if((rank+file)%2===parity){matrix.makeTranslation(file-3.5,TOP-.0275,3.5-rank);tiles.setMatrixAt(index++,matrix)}
  tiles.receiveShadow=true;board.add(tiles);
}
const floor=new THREE.Mesh(new THREE.PlaneGeometry(200,200),new THREE.MeshStandardMaterial({color:0x111310,roughness:1,metalness:0}));
floor.rotation.x=-Math.PI/2;floor.position.y=-.24;floor.receiveShadow=true;scene.add(floor);
function coordinate(text,x,z,rotation=0){
  const canvas=document.createElement('canvas');canvas.width=128;canvas.height=128;
  const ctx=canvas.getContext('2d');ctx.fillStyle='#aaa58b';ctx.font='52px Georgia';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,64,66);
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
  const m=new THREE.Mesh(new THREE.PlaneGeometry(.23,.23),new THREE.MeshBasicMaterial({map:texture,transparent:true,opacity:.75,depthWrite:false}));
  m.rotation.set(-Math.PI/2,0,rotation);m.position.set(x,.201,z);board.add(m);
}
for(let i=0;i<8;i++){coordinate('abcdefgh'[i],i-3.5,4.28);coordinate(String(i+1),-4.28,3.5-i)}
const pieceRoot=new THREE.Group();scene.add(pieceRoot);
const selector=new THREE.Mesh(new THREE.PlaneGeometry(.94,.94),new THREE.MeshBasicMaterial({color:0xb7c397,transparent:true,opacity:.24,depthWrite:false}));
selector.rotation.x=-Math.PI/2;selector.visible=false;scene.add(selector);
const dots=[];
for(let i=0;i<32;i++){
  const dot=new THREE.Mesh(new THREE.RingGeometry(.07,.12,28),new THREE.MeshBasicMaterial({color:0xc6d1b2,transparent:true,opacity:.85,side:THREE.DoubleSide,depthWrite:false}));
  dot.rotation.x=-Math.PI/2;dot.visible=false;scene.add(dot);dots.push(dot);
}
const pickPlane=new THREE.Plane(v(0,1,0),-TOP), raycaster=new THREE.Raycaster();
const LORE={
  a1:['The Last Gate','The western fortress surrendered once, then asked to be carved into a rook so it could never retreat again.'],
  b1:['Sir Cael, The Winter Rider','He crossed the frozen north to warn Aurell that the peace had already failed. He arrived one day too late.'],
  c1:['Ilyr, Keeper of Cinders','He memorised every name spoken before a battle and spent forty years reciting them back to the crown.'],
  d1:['Queen Elowen, The Bright Ruin','She signed the treaty knowing it would fail, because one night without war was still worth buying.'],
  e1:['Aurel IV, The Crown Without Sleep','Every move is made in his name. Every missing piece is counted against him.'],
  f1:['Saint Vessa of the Split Bell','She blessed both armies before discovering they were praying for the same victory.'],
  g1:['Ser Oris, The Thaw Rider','He was born during the first siege and has never seen a winter without soldiers in it.'],
  h1:['The Dawn Bastion','Its stones came from the palace nursery. The royal children learned to walk where soldiers now die.'],
  a2:['Mara of the Reed Gate','She moved one ink mark on a military map and sent an army around her village instead of through it.'],
  b2:['Tomas Bellmaker','He melted the treaty bells into armour when their sound stopped meaning peace.'],
  c2:['Nerin, Son of No Banner','He enlisted under an empty crest so no lord could claim the life he gave.'],
  d2:['Sela of the Salt Road','She carried letters between enemies until the letters became orders to kill each other.'],
  e2:['Ser Orren, The First Vow','He carried the first treaty over the winter pass and still believes words should weigh more than steel.'],
  f2:['Pera the Orchard Keeper','Her orchard became a battlefield. She fights so one tree might outlive the war.'],
  g2:['Milo, The Unrecorded','He scratched his own name from the rolls after learning history only remembers officers.'],
  h2:['Ysra of the River Steps','She ferried refugees at night and soldiers by day, never asking which side deserved the shore.'],
  a8:['The Black Rampart','Built from conquered gatehouses, it carries the keys of seven cities inside its hollow crown.'],
  b8:['Veyr Blackmane','He returned from the eastern battle without his horse and has never spoken of the road home.'],
  c8:['The Veiled Confessor','He hears the dying truth of soldiers and seals each secret beneath black wax.'],
  d8:['Queen Maevra, The Quiet Knife','She never raised her voice in council. Three kingdoms disappeared while she whispered.'],
  e8:['Veyr IX, The Hollow Crown','He inherited a victory no living witness remembers and a war every child understands.'],
  f8:['Mother Sable','She taught battlefield surgeons to pray only after their hands stopped shaking.'],
  g8:['Rooke of the Red Snow','The name is a joke. He is a knight, and the snow was only red once. Once was enough.'],
  h8:['The Night Citadel','Its foundations contain the first stone thrown when the treaty collapsed.'],
  a7:['Ashen Fen','He joined for bread and stayed because going home required crossing the front.'],
  b7:['Kell, Keeper of Crows','He fed the battlefield birds so they would stop feeding on the dead.'],
  c7:['Dara Without Hearth','Her village exists on maps printed before the war and nowhere else.'],
  d7:['Old Ren','He has survived long enough to serve three kings and trust none of them.'],
  e7:['Venn the Lamp-Lighter','He lit the surrender road every night even after both armies forgot it existed.'],
  f7:['Tal of the Broken Oar','A river conscript who cannot swim and somehow keeps surviving crossings.'],
  g7:['Eris, Last of Hollow Farm','She carries soil from home in a pouch under her armour.'],
  h7:['Noam the Witness','His only order was to remember what happened. He wishes they had given him any other task.']
};
function sourceFor(gltf,type,side){const stem=`piece_${type}_${side==='w'?'white':'black'}`;return gltf.scene.getObjectByName(stem)||gltf.scene.children.find(n=>n.name.startsWith(stem+'_'))}
function shapeFor(type,side){
  const source=templates[side+type];if(!source)throw Error(`Missing sculpture: ${side}${type}`);
  const shape=source.clone(true);shape.position.set(0,0,0);shape.scale.setScalar(SCALE);
  const bounds=new THREE.Box3().setFromObject(shape),center=bounds.getCenter(v());
  shape.position.x-=center.x;shape.position.z-=center.z;shape.position.y-=bounds.min.y;
  const material=(side==='w'?mat.white:mat.black).clone();
  shape.traverse(n=>{if(n.isMesh){n.material=material;n.castShadow=true;n.receiveShadow=true}});
  return {shape,material,height:bounds.max.y-bounds.min.y};
}
function replaceShape(p,type){if(p.material)p.material.dispose();p.group.clear();const model=shapeFor(type,p.side);p.group.add(model.shape);p.material=model.material;p.height=model.height;p.type=type;p.group.traverse(n=>n.userData.piece=p)}
function buildPieces(){
  for(const p of pieces)p.material.dispose();pieceRoot.clear();pieces=[];
  for(const row of chess.board())for(const cell of row){if(!cell)continue;const story=LORE[cell.square]||[`${labelSide(cell.color)} ${TYPES[cell.type]}`,'A witness to the broken peace.'];const p={id:cell.square,square:cell.square,side:cell.color,type:cell.type,name:story[0],story:story[1],alive:true,group:new THREE.Group()};replaceShape(p,p.type);p.group.rotation.y=Math.PI;p.group.position.copy(positionOf(p.square));pieceRoot.add(p.group);pieces.push(p)}
}
function at(s){return pieces.find(p=>p.alive&&p.square===s)}
function clearSelection(){selected=null;legal=[];selector.visible=false;dots.forEach(d=>d.visible=false);$('selectionLabel').textContent='Choose a piece to move.';$('selectionBtn').disabled=true;$('selectionArrow').hidden=true}
function select(p){
  if(mode!=='play'||!p)return;clearSelection();selected=p;
  if(p.side===chess.turn()&&!chess.isGameOver())legal=chess.moves({square:p.square,verbose:true});
  const destinations=[...new Map(legal.map(m=>[m.to,m])).values()];
  selector.position.copy(positionOf(p.square,TOP+.007));selector.visible=true;
  dots.forEach((d,i)=>{const m=destinations[i];d.visible=!!m;if(m){d.position.copy(positionOf(m.to,TOP+.013));d.scale.setScalar(m.captured?3.0:1);d.material.color.set(m.captured?0xc88d75:0xc6d1b2)}});
  $('selectionLabel').textContent=p.name;$('selectionBtn').disabled=false;$('selectionArrow').hidden=false;
}
function inspect(p){if(!p)return;$('loreMeta').textContent=`${labelSide(p.side)} · ${TYPES[p.type]} · ${p.square.toUpperCase()}`;$('loreName').textContent=p.name;$('loreText').textContent=p.story;$('pieceDialog').showModal()}
function snapshot(){return pieces.map(p=>({id:p.id,square:p.square,type:p.type,alive:p.alive}))}
function restore(data){for(const state of data){const p=pieces.find(x=>x.id===state.id);if(!p)continue;if(state.type!==p.type)replaceShape(p,state.type);p.square=state.square;p.alive=state.alive;p.group.visible=state.alive;p.group.position.copy(positionOf(p.square));p.group.rotation.set(0,Math.PI,0);p.material.opacity=1;p.material.transparent=false;p.material.depthWrite=true}clearSelection()}
function releaseFX(){for(const p of particles){scene.remove(p.mesh);p.mesh.geometry.dispose();p.mesh.material.dispose()}particles.length=0}
function clearMarks(){for(const m of marks){scene.remove(m);m.geometry.dispose();m.material.dispose()}marks.length=0}
function syncUI(){
  const white=chess.turn()==='w',over=chess.isGameOver();let status=white?'White to move':'Black to move';
  if(chess.isCheckmate())status=`${white?'Black':'White'} wins · Checkmate`;else if(chess.isStalemate())status='Draw · Stalemate';else if(chess.isDraw())status='Draw';else if(chess.inCheck())status+=' · Check';
  $('turnLabel').textContent=status;$('moveLabel').textContent=`Move ${Math.floor(chess.history().length/2)+1}`;$('blackState').textContent=over?'Match ended':white?'Waiting':'To move';
  $('whitePlayer').classList.toggle('is-turn',white&&!over);$('blackPlayer').classList.toggle('is-turn',!white&&!over);
  $('undoBtn').disabled=mode!=='play'||history.length===0;for(const id of ['viewBtn','newGameBtn','previewBtn'])$(id).disabled=mode!=='play';
  const moves=chess.history();$('moveRecord').replaceChildren();
  if(!moves.length){const p=document.createElement('p');p.className='empty-record';p.textContent='The first move is yours.';$('moveRecord').append(p)}
  for(let i=0;i<moves.length;i+=2){const row=document.createElement('div');row.className='record-row';for(const text of [`${i/2+1}.`,moves[i],moves[i+1]||'']){const el=document.createElement('span');el.textContent=text;row.append(el)}$('moveRecord').append(row)}$('moveRecord').scrollTop=$('moveRecord').scrollHeight;
}
function updateJournal(){
  const el=$('journalContent');el.replaceChildren();
  if(captures.length){const title=document.createElement('h3');title.textContent='Lost in this match';el.append(title);for(const text of captures){const p=document.createElement('p');p.className='muted';p.textContent=text;el.append(p)}}
  for(const side of ['w','b']){const title=document.createElement('h3');title.textContent=side==='w'?'House Aurell':'House Veyr';el.append(title);for(const p of pieces.filter(p=>p.side===side)){const item=document.createElement('article');item.className='journal-entry';const meta=document.createElement('small');meta.textContent=`${TYPES[p.type]} · ${p.alive?p.square.toUpperCase():'Captured'}`;const name=document.createElement('h4');name.textContent=p.name;const story=document.createElement('p');story.textContent=p.story;item.append(meta,name,story);el.append(item)}}
}
function newGame(){if(mode!=='play')return;chess.reset();history=[];captures=[];releaseFX();clearMarks();buildPieces();clearSelection();Object.assign(orbit,HOME);syncUI();updateJournal();$('selectionLabel').textContent='Choose a piece to begin.'}
function finishMove(p,move,victim){
  p.square=move.to;p.group.position.copy(positionOf(move.to));p.group.rotation.set(0,Math.PI,0);
  if(victim){victim.alive=false;victim.group.visible=false;victim.material.opacity=1;victim.material.transparent=false;victim.material.depthWrite=true;captures.push(`${p.name} took ${victim.name}.`)}
  if(move.promotion)replaceShape(p,move.promotion);
  if(move.flags.includes('k')||move.flags.includes('q')){const rank=p.side==='w'?'1':'8',king=move.flags.includes('k'),rook=at((king?'h':'a')+rank);if(rook){rook.square=(king?'f':'d')+rank;rook.group.position.copy(positionOf(rook.square))}}
  mode='play';animation=null;clearSelection();syncUI();updateJournal();
}
function choosePromotion(){return new Promise(resolve=>{const dialog=document.createElement('dialog');dialog.className='sheet';dialog.innerHTML='<header><h2>Promote your pawn</h2></header><div class="confirm-actions"></div>';for(const t of ['q','r','b','n']){const b=document.createElement('button');b.className='outline-button';b.style.padding='12px 6px';b.textContent=TYPES[t][0].toUpperCase()+TYPES[t].slice(1);b.onclick=()=>dialog.close(t);dialog.querySelector('div').append(b)}dialog.addEventListener('close',()=>{const result=dialog.returnValue;dialog.remove();resolve(result||null)},{once:true});document.body.append(dialog);dialog.showModal()})}
async function commit(p,to){
  if(mode!=='play'||chess.isGameOver())return;let promotion;const candidate=legal.find(m=>m.to===to);if(!candidate)return;
  if(candidate.promotion){mode='promotion';promotion=await choosePromotion();mode='play';if(!promotion)return}
  const victim=candidate.flags.includes('e')?at(to[0]+p.square[1]):at(to),before=snapshot();let move;
  try{move=chess.move({from:p.square,to,promotion})}catch(e){console.warn(e);return}
  history.push({board:before,captures:[...captures],marks:marks.length});clearSelection();
  if(victim&&$('cinemaSetting').checked&&!reduced.checked)beginCapture(p,victim,to,()=>finishMove(p,move,victim));
  else {mode='move';const start=p.group.position.clone(),end=positionOf(to);animation={kind:'move',elapsed:0,duration:reduced.checked?.14:.42,update(t){p.group.position.lerpVectors(start,end,smooth(t));if(!reduced.checked)p.group.position.y+=Math.sin(t*Math.PI)*.065;if(victim){victim.material.transparent=true;victim.material.opacity=1-t}},done(){tone(victim?'capture':'move',p.type);if(victim)boardMark(to);finishMove(p,move,victim)}}}syncUI();
}
function fitDistance(yaw=orbit.yaw,pitch=orbit.pitch){
  const backward=v(Math.sin(yaw)*Math.cos(pitch),Math.sin(pitch),Math.cos(yaw)*Math.cos(pitch));
  const right=v(Math.cos(yaw),0,-Math.sin(yaw)),up=new THREE.Vector3().crossVectors(backward,right);
  const tanV=Math.tan(THREE.MathUtils.degToRad(camera.fov/2)),tanH=tanV*camera.aspect;let distance=5;
  const points=[];for(const x of [-4.55,4.55])for(const z of [-4.55,4.55])for(const y of [-.25,.35])points.push(v(x,y,z));
  for(const p of pieces)if(p.alive){const base=positionOf(p.square);for(const dx of [-.4,.4])points.push(base.clone().add(v(dx,p.height||1.9,0)))}
  for(const p of points){p.sub(target);const depth=p.dot(backward);distance=Math.max(distance,depth+Math.abs(p.dot(right))/(tanH*.93),depth+Math.abs(p.dot(up))/(tanV*.87))}return distance;
}
function overviewPosition(){const d=fitDistance()*orbit.zoom;return v(Math.sin(orbit.yaw)*Math.cos(orbit.pitch),Math.sin(orbit.pitch),Math.cos(orbit.yaw)*Math.cos(orbit.pitch)).multiplyScalar(d).add(target)}
function boardMark(square){const pos=positionOf(square,TOP+.014),points=[];for(let i=0;i<8;i++){const angle=i*.84;points.push(v(pos.x+Math.cos(angle)*.20,pos.y,pos.z+Math.sin(angle)*.14),v(pos.x+Math.cos(angle+.3)*.30,pos.y,pos.z+Math.sin(angle+.3)*.24))}const line=new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(points),new THREE.LineBasicMaterial({color:0x25281f,transparent:true,opacity:.5}));scene.add(line);marks.push(line)}
function chips(p,center){releaseFX();for(let i=0;i<22;i++){const mesh=new THREE.Mesh(new THREE.TetrahedronGeometry(.018+Math.random()*.035),new THREE.MeshStandardMaterial({color:p.side==='w'?0xb9b29b:0x22281f,roughness:.64,transparent:true}));mesh.position.copy(center).add(v((Math.random()-.5)*.2,.15+Math.random()*.35,(Math.random()-.5)*.2));mesh.castShadow=true;scene.add(mesh);particles.push({mesh,vel:v((Math.random()-.5)*1.3,.5+Math.random()*1.3,(Math.random()-.5)*1.3),spin:v(Math.random()*5,Math.random()*5,Math.random()*5),life:1.3+Math.random()*.6})}}
const captureStyle={p:{lift:.08,side:1,quote:'One square changes a life.'},n:{lift:1.10,side:-1,quote:'A leap over old blood.'},b:{lift:.12,side:1,quote:'Some confessions are never spoken.'},r:{lift:.02,side:-1,quote:'The gate will not yield.'},q:{lift:.30,side:1,quote:'The room goes quiet.'},k:{lift:.05,side:-1,quote:'The crown steps forward.'}};
function beginCapture(p,victim,to,onDone,preview=false){
  mode='capture';app.classList.add('cinematic');$('skipBtn').hidden=false;$('caption').classList.remove('visible');
  const style=captureStyle[p.type],from=p.group.position.clone(),end=positionOf(to),victimPos=victim.group.position.clone();
  const dir=end.clone().sub(from).setY(0).normalize(),side=v(-dir.z,0,dir.x).multiplyScalar(style.side);
  const focus=from.clone().lerp(victimPos,.60).add(v(0,.60,0)),hitFocus=victimPos.clone().add(v(0,.6,0));
  const savedCamera=camera.position.clone(),savedTarget=target.clone();
  const portraitScale=Math.max(1,.86/camera.aspect);
  const approach=focus.clone().addScaledVector(side,3.6*portraitScale).addScaledVector(dir,-1.0).add(v(0,1.75*portraitScale,0));
  const impact=hitFocus.clone().addScaledVector(side,3.1*portraitScale).addScaledVector(dir,.5).add(v(0,1.55*portraitScale,0));
  const returnFrom=impact.clone().addScaledVector(side,.3).add(v(0,.25,0));let hit=false;
  $('captureMeta').textContent=`${labelSide(p.side)} · ${TYPES[p.type]}`;$('captureTitle').textContent=p.name;$('captureText').textContent=`${victim.name} falls. ${style.quote}`;
  const finish=()=>{p.group.position.copy(end);p.group.rotation.set(0,Math.PI,0);victim.group.rotation.set(0,Math.PI,0);camera.position.copy(savedCamera);camera.lookAt(savedTarget);app.classList.remove('cinematic');$('skipBtn').hidden=true;$('caption').classList.remove('visible');animation=null;releaseFX();onDone()};
  animation={kind:'capture',elapsed:0,duration:4.25,done:finish,update(t){
    const look=focus.clone();
    if(t<.23){const e=smooth(t/.23);camera.position.lerpVectors(savedCamera,approach,e);look.lerpVectors(savedTarget,focus,e)}
    else if(t<.62){const e=smooth((t-.23)/.39);p.group.position.lerpVectors(from,end,e);p.group.position.y+=Math.sin(e*Math.PI)*style.lift;if(p.type==='n')p.group.rotation.z=-Math.sin(e*Math.PI)*.10;camera.position.lerpVectors(approach,impact,e);look.lerpVectors(focus,hitFocus,e);if(e>.91&&!hit){hit=true;tone('capture',p.type);chips(victim,victimPos);if(!preview)boardMark(to);if(navigator.vibrate)navigator.vibrate(18)}}
    else if(t<.83){const e=smooth((t-.62)/.21);p.group.position.copy(end);victim.group.rotation.z=style.side*e*.82;victim.group.position.y=TOP-e*.11;victim.material.transparent=true;victim.material.depthWrite=false;victim.material.opacity=1-e;camera.position.lerpVectors(impact,returnFrom,e);look.copy(hitFocus);$('caption').classList.add('visible')}
    else {const e=smooth((t-.83)/.17);victim.material.opacity=0;camera.position.lerpVectors(returnFrom,savedCamera,e);look.lerpVectors(hitFocus,savedTarget,e);if(t>.92)$('caption').classList.remove('visible')}camera.lookAt(look);
  }};syncUI();
}
function preview(){
  if(mode!=='play')return;document.querySelectorAll('dialog[open]').forEach(d=>d.close());
  const p=pieces.find(p=>p.side==='w'&&p.type==='n'&&p.alive),victim=pieces.find(p=>p.side==='b'&&p.type==='p'&&p.alive);
  if(!p||!victim){$('selectionLabel').textContent='A knight and opposing pawn are needed for this preview.';return}
  if(reduced.checked){inspect(p);return}
  previewState=snapshot();clearSelection();p.group.position.copy(positionOf('d4'));victim.group.position.copy(positionOf('e6'));
  pieces.filter(other=>other!==p&&other!==victim&&['d4','e6'].includes(other.square)).forEach(other=>other.group.visible=false);
  beginCapture(p,victim,'e6',()=>{restore(previewState);previewState=null;mode='play';syncUI()},true);
}
function tone(event,type='p'){
  if(!sound)return;try{audio??=new (window.AudioContext||window.webkitAudioContext)();audio.resume();const now=audio.currentTime;
    const osc=audio.createOscillator(),gain=audio.createGain(),frequency=event==='capture'?({p:100,n:135,b:170,r:68,q:115,k:88}[type]):185;
    osc.type='sine';osc.frequency.setValueAtTime(frequency,now);osc.frequency.exponentialRampToValueAtTime(frequency*.40,now+.15);gain.gain.setValueAtTime(event==='capture'?.09:.045,now);gain.gain.exponentialRampToValueAtTime(.001,now+.25);osc.connect(gain);gain.connect(audio.destination);osc.start(now);osc.stop(now+.27);
    if(event==='capture'){const length=Math.floor(audio.sampleRate*.12),buffer=audio.createBuffer(1,length,audio.sampleRate),data=buffer.getChannelData(0);for(let i=0;i<length;i++)data[i]=(Math.random()*2-1)*Math.pow(1-i/length,3);const src=audio.createBufferSource(),filter=audio.createBiquadFilter(),g=audio.createGain();src.buffer=buffer;filter.type='lowpass';filter.frequency.value=1600;g.gain.value=.035;src.connect(filter);filter.connect(g);g.connect(audio.destination);src.start(now)}
  }catch(e){console.warn('Audio unavailable',e)}
}
function tickParticles(dt){for(let i=particles.length-1;i>=0;i--){const p=particles[i];p.life-=dt;p.vel.y-=6*dt;p.mesh.position.addScaledVector(p.vel,dt);p.mesh.rotation.x+=p.spin.x*dt;p.mesh.rotation.z+=p.spin.z*dt;if(p.mesh.position.y<TOP+.015){p.mesh.position.y=TOP+.015;p.vel.y=Math.abs(p.vel.y)*.18;p.vel.x*=.8;p.vel.z*=.8}p.mesh.material.opacity=Math.min(1,p.life*2);if(p.life<=0){scene.remove(p.mesh);p.mesh.geometry.dispose();p.mesh.material.dispose();particles.splice(i,1)}}}
function pick(x,y){
  const rect=renderer.domElement.getBoundingClientRect();raycaster.setFromCamera(new THREE.Vector2((x-rect.left)/rect.width*2-1,-(y-rect.top)/rect.height*2+1),camera);
  const hits=raycaster.intersectObject(pieceRoot,true);for(const h of hits){const p=h.object.userData.piece;if(p?.alive&&p.group.visible)return {p,square:p.square}}
  const point=raycaster.ray.intersectPlane(pickPlane,v());if(!point)return null;const f=Math.floor(point.x+4),r=Math.floor(4-point.z);if(f<0||f>7||r<0||r>7)return null;return {square:'abcdefgh'[f]+(r+1)};
}
const pointers=new Map();let down=null,pinch=0;
renderer.domElement.addEventListener('pointerdown',e=>{if(mode!=='play')return;renderer.domElement.setPointerCapture(e.pointerId);pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});if(pointers.size===1)down={x:e.clientX,y:e.clientY,yaw:orbit.yaw,pitch:orbit.pitch,moved:false};else {if(down)down.moved=true;const ps=[...pointers.values()];pinch=Math.hypot(ps[0].x-ps[1].x,ps[0].y-ps[1].y)}});
renderer.domElement.addEventListener('pointermove',e=>{
  if(!pointers.has(e.pointerId)||mode!=='play')return;pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
  if(pointers.size===2){const ps=[...pointers.values()],dist=Math.hypot(ps[0].x-ps[1].x,ps[0].y-ps[1].y);if(pinch>0&&dist>0)orbit.zoom=clamp(orbit.zoom*pinch/dist,.80,1.5);pinch=dist;return}
  if(!down)return;const dx=e.clientX-down.x,dy=e.clientY-down.y;if(Math.hypot(dx,dy)>7)down.moved=true;if(down.moved){orbit.yaw=down.yaw-dx*.006;orbit.pitch=clamp(down.pitch+dy*.005,.42,1.42);$('gestureHint').classList.add('dismissed')}
});
renderer.domElement.addEventListener('pointerup',e=>{pointers.delete(e.pointerId);if(pointers.size)return;const d=down;down=null;pinch=0;if(!d||d.moved||mode!=='play')return;$('gestureHint').classList.add('dismissed');const hit=pick(e.clientX,e.clientY);if(!hit){clearSelection();return}if(selected&&legal.some(m=>m.to===hit.square)){commit(selected,hit.square);return}if(hit.p)select(hit.p);else clearSelection()});
renderer.domElement.addEventListener('pointercancel',()=>{pointers.clear();down=null;pinch=0});
renderer.domElement.addEventListener('wheel',e=>{if(mode!=='play')return;e.preventDefault();orbit.zoom=clamp(orbit.zoom+e.deltaY*.001,.8,1.5)},{passive:false});
$('selectionBtn').onclick=()=>inspect(selected);
$('viewBtn').onclick=()=>{if(mode!=='play')return;viewIndex=(viewIndex+1)%3;Object.assign(orbit,[HOME,{yaw:0,pitch:1.42,zoom:1},{yaw:.62,pitch:.64,zoom:1}][viewIndex])};
$('undoBtn').onclick=()=>{if(mode!=='play'||!history.length)return;chess.undo();const prev=history.pop();restore(prev.board);captures=prev.captures;while(marks.length>prev.marks){const m=marks.pop();scene.remove(m);m.geometry.dispose();m.material.dispose()}releaseFX();syncUI();updateJournal()};
$('previewBtn').onclick=preview;
$('skipBtn').onclick=()=>{if(animation?.kind==='capture'){const current=animation;current.update(1);current.done()}};
$('soundBtn').onclick=()=>{sound=!sound;$('soundBtn').setAttribute('aria-pressed',String(sound));$('soundLabel').textContent=sound?'Sound on':'Sound off';if(sound)tone('move')};
$('newGameBtn').onclick=()=>{if(mode!=='play')return;$('menuDialog').close();if(history.length)$('confirmDialog').showModal();else newGame()};
$('confirmReset').onclick=()=>{$('confirmDialog').close();newGame()};
function resize(){const w=stage.clientWidth,h=stage.clientHeight;if(!w||!h)return;camera.aspect=w/h;camera.updateProjectionMatrix();renderer.setSize(w,h,false);if(mode!=='capture'){camera.position.copy(overviewPosition());camera.lookAt(target)}}
new ResizeObserver(resize).observe(stage);resize();
let previous=performance.now();
function frame(now){
  const dt=Math.min((now-previous)/1000,.075);previous=now;
  if(animation){const current=animation;current.elapsed+=dt;const t=Math.min(1,current.elapsed/current.duration);current.update(t);if(t===1&&animation===current)current.done()}
  if(mode!=='capture'){const pos=overviewPosition();camera.position.lerp(pos,reduced.checked?1:1-Math.exp(-dt*12));camera.lookAt(target)}
  tickParticles(dt);renderer.render(scene,camera);
}
renderer.setAnimationLoop(frame);
renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();mode='error';window.reportGameError(new Error('Graphics context lost'))});
async function load(){
  const urls=['https://raw.githubusercontent.com/Mike1934F/3d-chess/main/assets/chess_set.gltf','https://cdn.jsdelivr.net/gh/Mike1934F/3d-chess@main/assets/chess_set.gltf'];let gltf,error;
  for(const url of urls){try{gltf=await new GLTFLoader().loadAsync(url);break}catch(e){error=e}}if(!gltf)throw error||Error('Could not load sculptures');
  for(const side of ['w','b'])for(const [type,name] of Object.entries(TYPES)){const model=sourceFor(gltf,name,side);if(!model)throw Error(`The ${name} sculpture is missing`);templates[side+type]=model}
  buildPieces();mode='play';ready=true;clearSelection();syncUI();updateJournal();resize();await renderer.compileAsync(scene,camera);renderer.render(scene,camera);$('loading').hidden=true;window.__ASHEN_READY__=true;
}
if(new URLSearchParams(location.search).has('qa'))window.__ASHEN_QA__={
  state:()=>({ready,mode,fen:chess.fen(),pieces:pieces.filter(p=>p.alive).length,board:snapshot(),whiteColor:mat.white.color.getHexString(),blackColor:mat.black.color.getHexString(),lightTile:mat.light.color.getHexString(),darkTile:mat.dark.color.getHexString(),exposure:renderer.toneMappingExposure,scrollWidth:document.documentElement.scrollWidth,viewportWidth:innerWidth}),
  project:s=>{const p=positionOf(s,.7).project(camera),r=renderer.domElement.getBoundingClientRect();return {x:r.left+(p.x+1)*r.width/2,y:r.top+(1-p.y)*r.height/2}},
  select:s=>select(at(s)),move:to=>selected&&commit(selected,to),preview,
  freezeCapture:t=>{if(animation?.kind!=='capture')return;renderer.setAnimationLoop(null);animation.elapsed=t*animation.duration;animation.update(t);renderer.render(scene,camera)},
  resume:()=>{previous=performance.now();renderer.setAnimationLoop(frame)},
  loadFen:fen=>{if(mode!=='play')throw Error('Match busy');chess.load(fen);history=[];captures=[];releaseFX();clearMarks();buildPieces();clearSelection();syncUI();updateJournal();resize()}
};
load().catch(e=>{mode='error';window.reportGameError(e)});

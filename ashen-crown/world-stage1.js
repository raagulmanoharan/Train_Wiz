import * as THREE from 'three';
import {HDRLoader} from 'three/addons/loaders/HDRLoader.js';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {GTAOPass} from 'three/addons/postprocessing/GTAOPass.js';
import {BokehPass} from 'three/addons/postprocessing/BokehPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';
export const V=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z);
export const TOP=.3005;
export const squarePosition=(s,y=TOP)=>V(s.charCodeAt(0)-100.5,y,4.5-Number(s[1]));
export const smooth=t=>{t=THREE.MathUtils.clamp(t,0,1);return t*t*(3-2*t)};
export function seeded(seed){return ()=>((seed=(Math.imul(1664525,seed)+1013904223)>>>0)/4294967296)}
function canvasTexture(canvas){const t=new THREE.CanvasTexture(canvas);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=8;return t;}
function grainTexture(){const c=document.createElement('canvas');c.width=c.height=512;const ctx=c.getContext('2d'),d=ctx.createImageData(512,512),rnd=seeded(4162);for(let y=0;y<512;y++)for(let x=0;x<512;x++){const i=(y*512+x)*4,n=128+(rnd()-.5)*32+Math.sin(x*3.14)*3;d.data.set([n,n,n,255],i)}ctx.putImageData(d,0,0);const t=canvasTexture(c);t.colorSpace=THREE.NoColorSpace;t.wrapS=t.wrapT=THREE.RepeatWrapping;return t;}
function lathe(points,material,parent,segments=96){const g=new THREE.LatheGeometry(points.map(p=>new THREE.Vector2(...p)),segments);const m=new THREE.Mesh(g,material);m.castShadow=m.receiveShadow=true;parent.add(m);return m;}
function rounded(w,h,d,r,material,parent,position=[0,0,0]){const m=new THREE.Mesh(new RoundedBoxGeometry(w,h,d,3,r),material);m.position.set(...position);m.castShadow=m.receiveShadow=true;parent.add(m);return m;}
function torus(radius,tube,material,parent,pos=[0,0,0],rotation=[Math.PI/2,0,0]){const m=new THREE.Mesh(new THREE.TorusGeometry(radius,tube,12,96),material);m.position.set(...pos);m.rotation.set(...rotation);m.castShadow=m.receiveShadow=true;parent.add(m);return m;}
export function createWorld(stage){
 const renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});
 const dpr=Math.min(devicePixelRatio,1.5);renderer.setPixelRatio(dpr);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=.86;renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFShadowMap;stage.append(renderer.domElement);
 renderer.domElement.setAttribute('aria-label','The Red Room. Fixed overhead 3D chess table. Tap a piece, then a destination.');
 const scene=new THREE.Scene();scene.background=new THREE.Color(0x0c0b0d);scene.fog=new THREE.FogExp2(0x0c0b0d,.009);
 const camera=new THREE.PerspectiveCamera(36,1,.15,140),target=V(0,.45,.12),playPosition=V();
 const room=new THREE.Group();room.name='The Red Room';scene.add(room);const props=new THREE.Group();props.name='Still life';room.add(props);const micro=grainTexture();
 const brass=new THREE.MeshPhysicalMaterial({color:0xa08158,metalness:1,roughness:.51,bumpMap:micro,bumpScale:.005,clearcoat:.08});
 const darkBrass=new THREE.MeshStandardMaterial({color:0x332a23,metalness:.85,roughness:.35});
 const leather=new THREE.MeshPhysicalMaterial({color:0x3d3028,roughness:.67,bumpMap:micro,bumpScale:.025,clearcoat:.06});
 const velvet=new THREE.MeshPhysicalMaterial({color:0x430610,roughness:.96,sheen:1,sheenColor:0x8c2534,sheenRoughness:.78,bumpMap:micro,bumpScale:.010,side:THREE.DoubleSide});
 // Tall, pleated fabric with unequal folds and gathering near the floor.
 const curtainGeo=new THREE.PlaneGeometry(40,18,400,100),cp=curtainGeo.attributes.position,uv=curtainGeo.attributes.uv;
 for(let i=0;i<cp.count;i++){const x=cp.getX(i),y=cp.getY(i),v=(y+9)/18,fold=x*3.3+.18*Math.sin(x*.6),hem=(1-v)*(1-v);const z=.34*Math.sin(fold)+.10*Math.sin(fold*2+.6)+.045*Math.sin(x*10.3+y*.43)+hem*.35*Math.sin(x*1.8+y*.55);cp.setXYZ(i,x,y,z);uv.setXY(i,(x+20)*2.4,v*18)}
 curtainGeo.computeVertexNormals();const curtain=new THREE.Mesh(curtainGeo,velvet);curtain.position.set(0,5.0,-13.2);curtain.castShadow=curtain.receiveShadow=true;room.add(curtain);
 const floorMat=new THREE.MeshStandardMaterial({color:0x514c43,roughness:.88});
 floorMat.onBeforeCompile=s=>{s.vertexShader=s.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vFloorLocal;').replace('#include <begin_vertex>','#include <begin_vertex>\nvFloorLocal=position;');s.fragmentShader=s.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 vFloorLocal;').replace('#include <color_fragment>',`#include <color_fragment>
 float zig=abs(fract(vFloorLocal.x*.18)-.5)*2.;float stripe=step(.48,fract(vFloorLocal.y*.21+zig*.85));diffuseColor.rgb*=mix(vec3(.055,.066,.069),vec3(.65,.58,.47),stripe);`);};
 const floor=new THREE.Mesh(new THREE.PlaneGeometry(90,90),floorMat);floor.rotation.x=-Math.PI/2;floor.position.y=-4.4;floor.receiveShadow=true;room.add(floor);
 // Rounded, weighty tabletop with planar stone coordinates.
 const tableMat=new THREE.MeshPhysicalMaterial({color:0xffffff,roughness:.42,metalness:0,clearcoat:.20,clearcoatRoughness:.35});
 const table=lathe([[0,-.49],[8.52,-.49],[8.70,-.43],[8.80,-.29],[8.80,-.13],[8.74,-.045],[8.65,0],[0,0]],tableMat,room,192);table.scale.z=1.22;table.name='Emerald marble table';
 const tpos=table.geometry.attributes.position,tuv=table.geometry.attributes.uv;for(let i=0;i<tpos.count;i++)tuv.setXY(i,tpos.getX(i)/17.6+.5,tpos.getZ(i)/17.6+.5);tuv.needsUpdate=true;
 torus(8.69,.018,darkBrass,room,[0,-.38,0]).scale.y=1.22;
 lathe([[0,-4.35],[1.55,-4.35],[1.70,-4.18],[.72,-3.9],[.40,-1.7],[1.35,-.5]],darkBrass,room,96);
 const chair=new THREE.Group();chair.position.set(0,-3.5,10.25);room.add(chair);rounded(4.8,.50,4.3,.23,leather,chair);rounded(4.8,2.2,.40,.22,leather,chair,[0,1.1,1.95]);
 // Turned brass lamp: separate shell, inner reflector, lip and visible bulb.
 const lamp=new THREE.Group();lamp.name='Brass practical lamp';lamp.position.set(5.25,.015,-6.72);props.add(lamp);
 lathe([[0,0],[.85,0],[.98,.08],[.98,.16],[.91,.24],[.50,.31],[.25,.42],[.16,.62],[.14,2.5]],brass,lamp);
 lathe([[1.50,2.15],[1.51,2.23],[1.47,2.45],[1.34,2.82],[1.09,3.16],[.77,3.42],[.39,3.6],[.08,3.65],[0,3.65]],brass,lamp,128);torus(1.5,.033,brass,lamp,[0,2.19,0]);
 const inner=new THREE.MeshPhysicalMaterial({color:0xe6cca0,metalness:.25,roughness:.35,side:THREE.BackSide});lathe([[1.45,2.20],[1.43,2.45],[1.28,2.80],[1.04,3.12],[.74,3.38],[.38,3.55],[0,3.61]],inner,lamp,96);
 const bulb=new THREE.Mesh(new THREE.SphereGeometry(.23,24,16),new THREE.MeshStandardMaterial({color:0xffdba5,emissive:0xffb354,emissiveIntensity:2.7,roughness:.2}));bulb.position.set(0,2.37,0);lamp.add(bulb);const practical=new THREE.PointLight(0xffb768,10,10,2);practical.position.set(0,2.21,0);lamp.add(practical);
 const cable=new THREE.CatmullRomCurve3([V(.25,.03,-.9),V(.6,.03,-2),V(1.8,.02,-2.4),V(2.6,-.03,-2.5)]);lamp.add(new THREE.Mesh(new THREE.TubeGeometry(cable,32,.022,8,false),new THREE.MeshStandardMaterial({color:0x16130f,roughness:.7})));
 // Closed book with recessed pages, spine, page lines and stamped cover.
 const book=new THREE.Group();book.name='The unread book';book.position.set(3.48,.025,-5.48);book.rotation.y=-.34;book.scale.setScalar(1.42);props.add(book);
 const pagesCanvas=document.createElement('canvas');pagesCanvas.width=64;pagesCanvas.height=512;const pg=pagesCanvas.getContext('2d');pg.fillStyle='#b8ab91';pg.fillRect(0,0,64,512);const rnd=seeded(846);for(let i=0;i<180;i++){pg.fillStyle=`rgba(57,42,32,${.1+rnd()*.23})`;pg.fillRect(0,i*3,64,1)}
 const paper=new THREE.MeshStandardMaterial({map:canvasTexture(pagesCanvas),roughness:.94});rounded(2.05,.28,2.95,.035,paper,book,[0,.20,0]);rounded(2.20,.075,3.1,.035,leather,book,[0,.047,0]);rounded(2.20,.075,3.1,.035,leather,book,[0,.375,0]);rounded(.12,.39,3.1,.035,leather,book,[-1.06,.2,0]);
 const title=document.createElement('canvas');title.width=512;title.height=768;const tc=title.getContext('2d');tc.strokeStyle='#a18655';tc.lineWidth=1;tc.strokeRect(41,48,430,672);tc.strokeRect(49,56,414,656);tc.textAlign='center';tc.fillStyle='#b9a178';tc.font='28px Georgia';['THE','QUIET','HOURS'].forEach((s,i)=>tc.fillText(s,256,285+i*49));tc.font='13px Georgia';tc.fillText('EDRATH  /  XL',256,655);
 const stamp=new THREE.Mesh(new THREE.PlaneGeometry(2,2.93),new THREE.MeshStandardMaterial({map:canvasTexture(title),transparent:true,metalness:.6,roughness:.42,polygonOffset:true,polygonOffsetFactor:-1}));stamp.rotation.x=-Math.PI/2;stamp.position.y=.417;book.add(stamp);
 const sphereMat=new THREE.MeshPhysicalMaterial({color:0x152623,roughness:.16,clearcoat:.5,clearcoatRoughness:.10});
// Cut-glass ashtray and extinguished cigarette replace the decorative orb.
const ashtray=new THREE.Group();ashtray.name='Cut glass ashtray';ashtray.position.set(-3.68,.035,-5.42);ashtray.scale.setScalar(1.48);props.add(ashtray);
const ashGlass=new THREE.MeshPhysicalMaterial({color:0xb8ada2,roughness:.18,transmission:.84,thickness:.22,ior:1.50,clearcoat:1,clearcoatRoughness:.12});
const dish=new THREE.Mesh(new THREE.CylinderGeometry(.92,.78,.18,12,1,true),ashGlass);dish.position.y=.10;dish.castShadow=dish.receiveShadow=true;ashtray.add(dish);
torus(.84,.075,ashGlass,ashtray,[0,.20,0]);
const ash=new THREE.Mesh(new THREE.CylinderGeometry(.62,.62,.025,64),new THREE.MeshStandardMaterial({color:0x171312,roughness:1}));ash.position.y=.13;ashtray.add(ash);
const cig=new THREE.Mesh(new THREE.CylinderGeometry(.055,.055,1.28,18),new THREE.MeshStandardMaterial({color:0xc6bba5,roughness:.82}));cig.rotation.z=Math.PI/2;cig.rotation.y=.26;cig.position.set(.06,.29,.04);cig.castShadow=true;ashtray.add(cig);
const ember=new THREE.Mesh(new THREE.CylinderGeometry(.057,.057,.08,18),new THREE.MeshStandardMaterial({color:0x462018,emissive:0x8f2e12,emissiveIntensity:.35,roughness:.9}));ember.rotation.z=Math.PI/2;ember.position.set(.68,.29,.04);ashtray.add(ember);
const smokeCurve=new THREE.CatmullRomCurve3([V(.69,.34,.04),V(.58,.62,.03),V(.73,.95,.08),V(.60,1.30,.02)]);
const smoke=new THREE.Mesh(new THREE.TubeGeometry(smokeCurve,28,.012,6,false),new THREE.MeshBasicMaterial({color:0xb9afa7,transparent:true,opacity:.16,depthWrite:false}));ashtray.add(smoke);
 // Closed fluted glass volume using real WebGL transmission.
 const glass=new THREE.Group();glass.name='Amber tumbler';glass.position.set(-5.55,.01,5.95);props.add(glass);
 const glassMat=new THREE.MeshPhysicalMaterial({color:0xe9dfcc,metalness:0,roughness:.09,transmission:.97,thickness:.14,ior:1.49,attenuationColor:0xe0c395,attenuationDistance:2,clearcoat:1});
 const tumbler=lathe([[0,0],[.58,0],[.64,.10],[.68,1.26],[.66,1.32],[.62,1.32],[.61,1.22],[.55,.19],[0,.19]],glassMat,glass,160);const gp=tumbler.geometry.attributes.position;for(let i=0;i<gp.count;i++){const x=gp.getX(i),y=gp.getY(i),z=gp.getZ(i),r=Math.hypot(x,z);if(r>.54&&y<1.24){const delta=.010*Math.sin(Math.atan2(z,x)*32);gp.setXYZ(i,x*(r+delta)/r,y,z*(r+delta)/r)}}tumbler.geometry.computeVertexNormals();
 const amber=new THREE.MeshPhysicalMaterial({color:0x9d3d06,roughness:.12,metalness:0,transmission:.62,thickness:.7,ior:1.34,attenuationColor:0x6c2405,attenuationDistance:.55});lathe([[0,.19],[.55,.19],[.59,.64],[0,.64]],amber,glass,96);torus(.58,.012,new THREE.MeshPhysicalMaterial({color:0xb97a37,metalness:0,roughness:.11,transmission:.5,thickness:.06}),glass,[0,.641,0]);const coaster=new THREE.Mesh(new THREE.CylinderGeometry(.85,.85,.034,96),leather);coaster.position.y=.017;glass.add(coaster);
 // Asymmetric practical-led key, cool edge, and restrained ambient fill.
 const fill=new THREE.HemisphereLight(0xc3c8bf,0x1a0e0d,.15);room.add(fill);
 const key=new THREE.SpotLight(0xffc98e,112,32,Math.PI*.29,.84,1.55);key.position.set(6.7,9.1,-1.2);key.target.position.set(.35,.05,.15);key.castShadow=true;key.shadow.mapSize.set(2048,2048);key.shadow.bias=-.000055;key.shadow.normalBias=.010;key.shadow.radius=3;room.add(key,key.target);
 const rim=new THREE.DirectionalLight(0x9eaaa7,.19);rim.position.set(-5,7,3);room.add(rim);
 const velvetWash=new THREE.SpotLight(0x9b1728,132,29,Math.PI*.36,.92,2);velvetWash.position.set(3.8,5.4,-7.5);velvetWash.target.position.set(-1.0,3.5,-13.0);room.add(velvetWash,velvetWash.target);
 const boardLift=new THREE.SpotLight(0xffd9a2,17,23,Math.PI*.28,.92,2);boardLift.position.set(2.5,7.2,5.8);boardLift.target.position.set(0,.1,0);room.add(boardLift,boardLift.target);
 const farKey=new THREE.SpotLight(0xffd0a0,35,25,Math.PI*.36,.92,1.8);farKey.position.set(4.3,8.0,-6.3);farKey.target.position.set(-.2,.22,-2.1);farKey.castShadow=true;farKey.shadow.mapSize.set(1024,1024);farKey.shadow.bias=-.00005;farKey.shadow.normalBias=.012;farKey.shadow.radius=2;room.add(farKey,farKey.target);
 const frontFill=new THREE.SpotLight(0xffbd78,13,30,Math.PI*.43,.98,2);frontFill.position.set(-1.8,7.4,8.6);frontFill.target.position.set(0,-.05,2.4);room.add(frontFill,frontFill.target);
 const softKey=new THREE.RectAreaLight(0xffcfa0,6.1,9.5,6.2);softKey.position.set(4.8,7.8,3.8);softKey.lookAt(0,.15,0);room.add(softKey);
 const softFill=new THREE.RectAreaLight(0xa9b3aa,2.1,10,7);softFill.position.set(-5.4,6.8,2.2);softFill.lookAt(0,.1,.3);room.add(softFill);
 const curtainFill=new THREE.RectAreaLight(0x85111e,6.4,12,5.5);curtainFill.position.set(0,5.0,-8.7);curtainFill.lookAt(0,4.2,-13.2);room.add(curtainFill);
 // Existing authored board/piece treatment retained. This pass does not rewrite game systems.
 const mat={
 white:new THREE.MeshPhysicalMaterial({color:0xe7dfcc,roughness:.58,clearcoat:.09,clearcoatRoughness:.44,specularIntensity:.48}),
 black:new THREE.MeshPhysicalMaterial({color:0x8f9597,roughness:.54,clearcoat:.10,clearcoatRoughness:.42,specularIntensity:.52}),
 board:new THREE.MeshPhysicalMaterial({color:0xc8beac,roughness:1,clearcoat:0,clearcoatRoughness:1,specularIntensity:.12})
};const boardRoot=new THREE.Group();scene.add(boardRoot);const loader=new THREE.TextureLoader();
 async function surface(name,material){const maps=await Promise.all(['diff','nor_gl','arm'].map(k=>loader.loadAsync(`./textures/chess_set_${name}_${k}_1k.jpg`)));for(const t of maps){t.flipY=false;t.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy())}maps[0].colorSpace=THREE.SRGBColorSpace;Object.assign(material,{map:maps[0],normalMap:maps[1],roughnessMap:maps[2],aoMap:maps[2],aoMapIntensity:.65});material.normalScale.set(.55,.55);material.needsUpdate=true;}
 const loaded={hdr:false,stone:false};
 async function environment(){const [hdr,albedo,normal,rough]=await Promise.all([new HDRLoader().loadAsync('./art-v6/studio-soft.hdr'),loader.loadAsync('./art-v6/marble_rock_01_diff.jpg'),loader.loadAsync('./art-v6/marble_rock_01_nor_gl.jpg'),loader.loadAsync('./art-v6/marble_rock_01_rough.jpg')]);const hd=hdr.image.data,half=hd instanceof Uint16Array,channels=hd.length/(hdr.image.width*hdr.image.height);for(let i=0;i<hd.length;i+=channels){const read=j=>half?THREE.DataUtils.fromHalfFloat(hd[j]):hd[j],lum=Math.min(256,read(i)*.2126+read(i+1)*.7152+read(i+2)*.0722);for(let c=0;c<3;c++){const val=lum*[1,.97,.92][c];hd[i+c]=half?THREE.DataUtils.toHalfFloat(val):val;}}hdr.needsUpdate=true;hdr.mapping=THREE.EquirectangularReflectionMapping;const pmrem=new THREE.PMREMGenerator(renderer);scene.environment=pmrem.fromEquirectangular(hdr).texture;scene.environmentIntensity=.16;scene.environmentRotation.y=.8;hdr.dispose();pmrem.dispose();loaded.hdr=true;
  const c=document.createElement('canvas');c.width=albedo.image.width;c.height=albedo.image.height;const ctx=c.getContext('2d');ctx.drawImage(albedo.image,0,0);const d=ctx.getImageData(0,0,c.width,c.height);for(let i=0;i<d.data.length;i+=4){const l=(d.data[i]*.25+d.data[i+1]*.6+d.data[i+2]*.15)/255,vein=Math.pow(THREE.MathUtils.clamp((.43-l)/.33,0,1),2),grain=l;d.data[i]=16+grain*11+vein*110;d.data[i+1]=43+grain*15+vein*106;d.data[i+2]=35+grain*13+vein*86;}ctx.putImageData(d,0,0);const emerald=canvasTexture(c);emerald.wrapS=emerald.wrapT=THREE.RepeatWrapping;normal.wrapS=normal.wrapT=rough.wrapS=rough.wrapT=THREE.RepeatWrapping;normal.anisotropy=rough.anisotropy=8;tableMat.map=emerald;tableMat.normalMap=normal;tableMat.normalScale.set(.025,.025);tableMat.roughnessMap=rough;tableMat.needsUpdate=true;sphereMat.map=emerald;sphereMat.color.set(0xa5bbb2);sphereMat.needsUpdate=true;albedo.dispose();loaded.stone=true;}
 async function install(gltf,scale){const boardMesh=gltf.scene.getObjectByName('board').clone(true);boardMesh.scale.setScalar(scale);boardMesh.rotation.y=Math.PI/2;boardMesh.traverse(n=>{if(n.isMesh){n.material=mat.board;n.receiveShadow=true;n.castShadow=true}});boardRoot.add(boardMesh);await Promise.all([surface('board',mat.board),surface('pieces_white',mat.white),surface('pieces_black',mat.black),environment()]);}
 function label(text,x,z){const c=document.createElement('canvas');c.width=c.height=128;const t=c.getContext('2d');t.font='54px Georgia';t.textAlign='center';t.textBaseline='middle';t.fillStyle='#c5b89b';t.fillText(text,64,66);const m=new THREE.Mesh(new THREE.PlaneGeometry(.18,.18),new THREE.MeshBasicMaterial({map:canvasTexture(c),transparent:true,opacity:.63,depthWrite:false}));m.rotation.x=-Math.PI/2;m.position.set(x,.313,z);scene.add(m)}for(let i=0;i<8;i++){label('abcdefgh'[i],i-3.5,4.13);label(String(i+1),-4.13,3.5-i)}
 const renderTarget=new THREE.WebGLRenderTarget(1,1,{type:THREE.HalfFloatType,samples:2});const composer=new EffectComposer(renderer,renderTarget);composer.addPass(new RenderPass(scene,camera));const ao=new GTAOPass(scene,camera,1,1);ao.updateGtaoMaterial({radius:.19,thickness:.5,distanceExponent:1.8,distanceFallOff:.65,scale:1,samples:12});ao.blendIntensity=.78;ao.updatePdMaterial({lumaPhi:8,depthPhi:2,normalPhi:3,radius:4});composer.addPass(ao);const bokeh=new BokehPass(scene,camera,{focus:5,aperture:.007,maxblur:.008});bokeh.enabled=false;composer.addPass(bokeh);composer.addPass(new OutputPass());
 let orientation='w';
 function resize(w,h){if(!w||!h)return;renderer.setSize(w,h,false);camera.aspect=w/h;const sign=orientation==='w'?1:-1,pitch=THREE.MathUtils.degToRad(45.5),back=V(0,Math.sin(pitch),sign*Math.cos(pitch)),up=V(0,Math.cos(pitch),-sign*Math.sin(pitch));target.set(0,.44,-sign*(w<h?.52:.18));const tv=Math.tan(THREE.MathUtils.degToRad(18)),th=tv*camera.aspect;let distance=1;const marginY=Math.max(.70,1-92/h);for(const x of [-5.55,5.55])for(const z of [-4.82,4.82])for(const y of [.01,1.95]){const p=V(x,y,z).sub(target),depth=p.dot(back);distance=Math.max(distance,depth+Math.abs(x)/(th*.97),depth+Math.abs(p.dot(up))/(tv*marginY))}playPosition.copy(back).multiplyScalar(distance).add(target);composer.setSize(w,h);}
 function lock(){camera.fov=36;camera.position.copy(playPosition);camera.lookAt(target);camera.updateProjectionMatrix()}
 function render(cinema=false,focus=5){bokeh.enabled=cinema;bokeh.uniforms.focus.value=focus;composer.render();}
 function orient(side){orientation=side;room.rotation.y=side==='b'?Math.PI:0;scene.environmentRotation.y=.8+room.rotation.y;resize(stage.clientWidth,stage.clientHeight);lock()}
 const api={renderer,scene,camera,target,mat,boardRoot,install,resize,lock,render,playPosition,orient};if(new URLSearchParams(location.search).has('qa'))window.__ENV_QA__={state:()=>({stage:'Camera and environment',hdr:loaded.hdr,stone:loaded.stone,ao:'GTAO',pitch:45.5,orientation,canvas:renderer.domElement.getBoundingClientRect().toJSON(),calls:renderer.info.render.calls,triangles:renderer.info.render.triangles}),world:api};return api;
}

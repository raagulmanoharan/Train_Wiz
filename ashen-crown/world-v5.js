import * as THREE from 'three';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {BokehPass} from 'three/addons/postprocessing/BokehPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';
export const V=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z);
export const TOP=.3005;
export const squarePosition=(s,y=TOP)=>V(s.charCodeAt(0)-100.5,y,4.5-Number(s[1]));
export const smooth=t=>{t=THREE.MathUtils.clamp(t,0,1);return t*t*(3-2*t)};
export function seeded(seed){return ()=>((seed=(Math.imul(1664525,seed)+1013904223)>>>0)/4294967296)}
export function createWorld(stage){
 const renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});
 renderer.setPixelRatio(Math.min(devicePixelRatio,1.65));renderer.outputColorSpace=THREE.SRGBColorSpace;
 renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=.90;
 renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
 stage.append(renderer.domElement);
 const scene=new THREE.Scene();scene.background=new THREE.Color(0x171510);
 const camera=new THREE.PerspectiveCamera(28,1,.07,120),target=V(0,.45,0),playPosition=V();
 const pmrem=new THREE.PMREMGenerator(renderer),room=new RoomEnvironment();scene.environment=pmrem.fromScene(room,.08).texture;scene.environmentIntensity=.33;room.dispose();pmrem.dispose();
 scene.add(new THREE.HemisphereLight(0xe4e8ed,0x302619,.35));
 const key=new THREE.DirectionalLight(0xffecd6,1.8);key.position.set(-5,9,6);key.castShadow=true;key.shadow.mapSize.set(2048,2048);
 Object.assign(key.shadow.camera,{left:-10,right:10,top:10,bottom:-10,near:.1,far:32});key.shadow.normalBias=.008;key.shadow.bias=-.00007;scene.add(key);
 const rim=new THREE.DirectionalLight(0xb9cbdc,.8);rim.position.set(4,6,-6);scene.add(rim);
 const mat={white:new THREE.MeshPhysicalMaterial({color:0xe7dfcc,roughness:.50,clearcoat:.16,clearcoatRoughness:.34}),black:new THREE.MeshPhysicalMaterial({color:0xa6acaf,roughness:.45,clearcoat:.2,clearcoatRoughness:.3}),board:new THREE.MeshPhysicalMaterial({color:0xc8beac,roughness:.72,clearcoat:.1,clearcoatRoughness:.6})};
 const rnd=seeded(1827),woodCanvas=document.createElement('canvas');woodCanvas.width=woodCanvas.height=1024;const ctx=woodCanvas.getContext('2d'),im=ctx.createImageData(1024,1024);
 for(let y=0;y<1024;y++)for(let x=0;x<1024;x++){const bend=Math.sin(y*.006)*6+Math.sin(y*.002+x*.005)*12,grain=Math.sin((x+bend)*.48)*2+Math.sin((x+bend)*.10)*3+Math.sin(x*.017+y*.002)*6;const n=grain+(rnd()-.5)*6-(x%256<2?13:0),k=(y*1024+x)*4;im.data[k]=55+n;im.data[k+1]=40+n*.8;im.data[k+2]=28+n*.58;im.data[k+3]=255}ctx.putImageData(im,0,0);
 const wood=new THREE.CanvasTexture(woodCanvas);wood.colorSpace=THREE.SRGBColorSpace;wood.wrapS=wood.wrapT=THREE.RepeatWrapping;wood.repeat.set(2,3);wood.anisotropy=8;
 const table=new THREE.Mesh(new RoundedBoxGeometry(34,.68,48,3,.13),new THREE.MeshStandardMaterial({map:wood,bumpMap:wood,bumpScale:.024,roughness:.81}));table.position.y=-.34;table.receiveShadow=true;scene.add(table);
 const leather=new THREE.MeshStandardMaterial({color:0x222723,roughness:.92});
 const pad=new THREE.Mesh(new RoundedBoxGeometry(10,.025,10,3,.10),leather);pad.position.y=.012;pad.receiveShadow=true;scene.add(pad);
 const props=new THREE.Group();scene.add(props);const brass=new THREE.MeshStandardMaterial({color:0x7b6547,metalness:.65,roughness:.42});
 const cylinder=(rt,rb,h,m,x,y,z)=>{const a=new THREE.Mesh(new THREE.CylinderGeometry(rt,rb,h,40),m);a.position.set(x,y,z);a.castShadow=true;a.receiveShadow=true;props.add(a);return a};
 for(const [x,z,h] of [[-5.8,-5.2,1.1],[-6.5,-4.8,.7]]){cylinder(.36,.44,.1,brass,x,.06,z);cylinder(.15,.19,h,new THREE.MeshStandardMaterial({color:0xa79c82,roughness:.84}),x,.12+h/2,z);cylinder(.008,.01,.08,new THREE.MeshStandardMaterial({color:0x15110d}),x,h+.15,z);const f=new THREE.Mesh(new THREE.SphereGeometry(.045,12,8),new THREE.MeshBasicMaterial({color:0xffdfaa}));f.scale.y=2.6;f.position.set(x,h+.23,z);props.add(f);const light=new THREE.PointLight(0xffc383,1.8,5,2);light.position.copy(f.position);props.add(light)}
 const book=new THREE.Group();book.position.set(6,.05,-4.5);book.rotation.y=-.19;props.add(book);
 for(const [y,h,m] of [[.02,.045,leather],[.16,.25,new THREE.MeshStandardMaterial({color:0xaea185,roughness:1})],[.30,.045,leather]]){const b=new THREE.Mesh(new RoundedBoxGeometry(1.7,h,2.5,2,.025),m);b.position.y=y;b.castShadow=true;book.add(b)}
 const band=new THREE.Mesh(new THREE.BoxGeometry(.16,.016,2.4),brass);band.position.set(.55,.335,0);book.add(band);
 cylinder(.18,.2,.035,new THREE.MeshStandardMaterial({color:0x562b25,roughness:.5}),5.4,.025,-2.8);
 const boardRoot=new THREE.Group();scene.add(boardRoot);const loader=new THREE.TextureLoader();
 async function surface(name,material){const maps=await Promise.all(['diff','nor_gl','arm'].map(k=>loader.loadAsync(`./textures/chess_set_${name}_${k}_1k.jpg`)));for(const t of maps){t.flipY=false;t.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy())}maps[0].colorSpace=THREE.SRGBColorSpace;Object.assign(material,{map:maps[0],normalMap:maps[1],roughnessMap:maps[2],aoMap:maps[2],aoMapIntensity:.65});material.normalScale.set(.55,.55);material.needsUpdate=true;}
 async function install(gltf,scale){const boardMesh=gltf.scene.getObjectByName('board').clone(true);boardMesh.scale.setScalar(scale);boardMesh.rotation.y=Math.PI;boardMesh.traverse(n=>{if(n.isMesh){n.material=mat.board;n.receiveShadow=true;n.castShadow=true}});boardRoot.add(boardMesh);await Promise.all([surface('board',mat.board),surface('pieces_white',mat.white),surface('pieces_black',mat.black)]);}
 function label(text,x,z,rot=0){const c=document.createElement('canvas');c.width=c.height=128;const t=c.getContext('2d');t.font='54px Georgia';t.textAlign='center';t.textBaseline='middle';t.fillStyle='#c5b89b';t.fillText(text,64,66);const tex=new THREE.CanvasTexture(c);tex.colorSpace=THREE.SRGBColorSpace;const m=new THREE.Mesh(new THREE.PlaneGeometry(.18,.18),new THREE.MeshBasicMaterial({map:tex,transparent:true,opacity:.63,depthWrite:false}));m.rotation.set(-Math.PI/2,0,rot);m.position.set(x,.313,z);scene.add(m)}
 for(let i=0;i<8;i++){label('abcdefgh'[i],i-3.5,4.13);label(String(i+1),-4.13,3.5-i)}
 let orientation='w',composer=null,bokeh=null;
 function resize(w,h){renderer.setSize(w,h,false);camera.aspect=w/h;const pitch=THREE.MathUtils.degToRad(65),sign=orientation==='w'?1:-1,back=V(0,Math.sin(pitch),sign*Math.cos(pitch)),up=V(0,Math.cos(pitch),-sign*Math.sin(pitch)),tv=Math.tan(THREE.MathUtils.degToRad(14)),th=tv*camera.aspect;let distance=1;const marginY=Math.max(.56,1-150/h);
 for(const x of [-4.44,4.44])for(const z of [-4.44,4.44])for(const y of [.01,1.6]){const p=V(x,y,z).sub(target),depth=p.dot(back);distance=Math.max(distance,depth+Math.abs(x)/(th*.963),depth+Math.abs(p.dot(up))/(tv*marginY))}
 playPosition.copy(back).multiplyScalar(distance).add(target);if(composer)composer.setSize(w,h);}
 function lock(){camera.fov=28;camera.position.copy(playPosition);camera.lookAt(target);camera.updateProjectionMatrix()}
 function render(cinema=false,focus=5){if(cinema){if(!composer){composer=new EffectComposer(renderer);composer.addPass(new RenderPass(scene,camera));bokeh=new BokehPass(scene,camera,{focus,aperture:.007,maxblur:.008});composer.addPass(bokeh);composer.addPass(new OutputPass());composer.setSize(stage.clientWidth,stage.clientHeight)}bokeh.uniforms.focus.value=focus;composer.render()}else renderer.render(scene,camera)}
 function orient(side){orientation=side;resize(stage.clientWidth,stage.clientHeight);lock()}
 return {renderer,scene,camera,target,mat,boardRoot,install,resize,lock,render,playPosition,orient};
}

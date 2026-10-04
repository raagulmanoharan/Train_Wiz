import * as THREE from 'three';
import {V,TOP,seeded,squarePosition} from './world-v5.js';
const VALUES={p:1,n:3,b:3,r:5,q:9,k:0};
export function damageValue(losses,side){return Math.min(39,losses.filter(x=>x.side===side).reduce((n,x)=>n+(VALUES[x.type]||0),0))}
export function damageLabel(value){return value===0?'Unbroken':value<5?'Scarred':value<12?'Fractured':value<23?'Battered':'Ruined'}
export function wearMaterial(material,seed=1){const wear={value:0};material.userData.wear=wear;material.onBeforeCompile=shader=>{shader.uniforms.uWear=wear;shader.uniforms.uSeed={value:seed};shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vWearPosition;').replace('#include <begin_vertex>','#include <begin_vertex>\nvWearPosition = position;');shader.fragmentShader=shader.fragmentShader.replace('#include <common>',`#include <common>
 varying vec3 vWearPosition;uniform float uWear;uniform float uSeed;
 float crackNoise(float x){return sin(x*51.0+uSeed)*.14+sin(x*143.0+uSeed*.7)*.065;}
 `).replace('#include <color_fragment>',`#include <color_fragment>
 vec3 wp=vWearPosition*80.0;
 float seam=abs(sin(wp.x*8.5+wp.z*5.0+crackNoise(wp.y)*2.2+uSeed));
 float crossSeam=abs(sin(wp.y*7.0+crackNoise(wp.x)*3.5+uSeed));
 float crack=(1.0-smoothstep(.012,.05,seam))*(.5+.5*sin(wp.y*2.7+uSeed));
 crack=max(crack,(1.0-smoothstep(.015,.043,crossSeam))*.4);
 diffuseColor.rgb *= (1.0-uWear*.24) * (1.0-crack*min(1.0,uWear*3.8)*.87);
 `);};material.customProgramCacheKey=()=> 'crown-procedural-wear-v5';return material;}
export class DamageField{
 constructor(world){this.world=world;this.root=new THREE.Group();world.scene.add(this.root);this.state={w:0,b:0};this.enabled=true;this.signature='';this.geometries=[];this.materials=[]}
 clear(){this.root.clear();this.geometries.forEach(x=>x.dispose());this.materials.forEach(x=>{x.map?.dispose();x.dispose()});this.geometries=[];this.materials=[]}
 mesh(g,m){const a=new THREE.Mesh(g,m);this.geometries.push(g);this.materials.push(m);this.root.add(a);return a}
 update(losses,pieces,enabled=true){this.enabled=enabled;this.state={w:damageValue(losses,'w'),b:damageValue(losses,'b')};for(const p of pieces){if(p.material?.userData.wear)p.material.userData.wear.value=enabled?this.state[p.side]/39:0;}const signature=JSON.stringify([enabled,losses.map(x=>[x.id,x.type,x.side,x.square])]);if(signature===this.signature)return;this.signature=signature;this.clear();if(!enabled)return;for(const side of ['w','b']){const amount=this.state[side];if(!amount)continue;this.half(side,amount,losses.filter(x=>x.side===side));}}
 half(side,amount,losses){const rnd=seeded(side==='w'?5741:11982),sign=side==='w'?1:-1,size=1024,c=document.createElement('canvas');c.width=c.height=size;const ctx=c.getContext('2d');const point=(x,z)=>[(x+4)/8*size,(z+4)/8*size];
 const branch=(x,z,angle,len,width,depth)=>{const pts=[[x,z]];const count=8;for(let j=0;j<count;j++){angle+=(rnd()-.5)*.6;x+=Math.cos(angle)*len/count;z+=Math.sin(angle)*len/count;x=Math.max(-3.97,Math.min(3.97,x));z=sign*Math.max(.06,Math.min(3.97,sign*z));pts.push([x,z]);if(depth>0&&j===4)branch(x,z,angle+(rnd()>.5?1:-1)*.8,len*.47,width*.6,depth-1)}ctx.beginPath();pts.forEach(([a,b],i)=>{const [u,v]=point(a,b);i?ctx.lineTo(u,v):ctx.moveTo(u,v)});ctx.strokeStyle='rgba(5,7,5,.9)';ctx.lineWidth=width+1.1;ctx.lineJoin='round';ctx.stroke();ctx.save();ctx.translate(.7,1);ctx.strokeStyle='rgba(176,149,106,.65)';ctx.lineWidth=Math.max(.6,width*.27);ctx.stroke();ctx.restore();};
 const count=1+Math.floor(amount/3);for(let i=0;i<count;i++){const x=-3.7+rnd()*7.4,z=sign*3.95;branch(x,z,-sign*Math.PI/2+(rnd()-.5)*1.3,.7+Math.min(3,amount/7)+rnd()*.6,1+amount/15,2)}
 for(const loss of losses){const p=squarePosition(loss.square);const z=sign*Math.min(3.7,Math.max(.35,Math.abs(p.z))),[u,v]=point(p.x,z),radius=30+(VALUES[loss.type]||1)*5;const grad=ctx.createRadialGradient(u,v,2,u,v,radius);grad.addColorStop(0,'rgba(17,15,10,.45)');grad.addColorStop(.5,'rgba(32,24,14,.16)');grad.addColorStop(1,'rgba(0,0,0,0)');ctx.fillStyle=grad;ctx.fillRect(u-radius,v-radius,radius*2,radius*2)}
 const tex=new THREE.CanvasTexture(c);tex.colorSpace=THREE.SRGBColorSpace;tex.anisotropy=4;const decal=this.mesh(new THREE.PlaneGeometry(8,8),new THREE.MeshBasicMaterial({map:tex,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2}));decal.rotation.x=-Math.PI/2;decal.position.y=TOP+.008;
 for(let i=0;i<Math.floor(amount*.8);i++){const x=-3.9+rnd()*7.8,z=sign*(4.28+rnd()*.42),s=.035+rnd()*.07;const g=new THREE.DodecahedronGeometry(s,0);g.scale(1,.5+rnd(),1.5);const a=this.mesh(g,new THREE.MeshStandardMaterial({color:side==='w'?0x928575:0x31332e,roughness:.96}));a.position.set(x,.05+s*.25,z);a.rotation.set(rnd()*3,rnd()*6,rnd()*2);a.castShadow=true;a.receiveShadow=true;}
 for(let i=0;i<Math.ceil(amount/4);i++){const x=-3.65+rnd()*7.3,g=new THREE.BoxGeometry(.018+amount*.0006,.24,.3),m=new THREE.MeshStandardMaterial({color:0x181914,roughness:1});const a=this.mesh(g,m);a.position.set(x,.15,sign*4.08);a.rotation.z=(rnd()-.5)*.3;}
 }
}

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
 constructor(world){this.world=world;this.root=new THREE.Group();world.scene.add(this.root);this.state={w:0,b:0};this.enabled=true;this.signature='';this.baseMeshes=[];this.geometries=[];this.materials=[]}
 clear(){this.root.clear();this.geometries.forEach(x=>x.dispose());this.materials.forEach(x=>{x.map?.dispose();x.dispose()});this.geometries=[];this.materials=[]}
 mesh(g,m){const a=new THREE.Mesh(g,m);this.geometries.push(g);this.materials.push(m);this.root.add(a);return a}
 update(losses,pieces,enabled=true){this.enabled=enabled;this.state={w:damageValue(losses,'w'),b:damageValue(losses,'b')};for(const p of pieces){if(p.material?.userData.wear)p.material.userData.wear.value=enabled?this.state[p.side]/39:0;}const signature=JSON.stringify([enabled,losses.map(x=>[x.id,x.type,x.side,x.square])]);if(signature===this.signature)return;this.signature=signature;this.clear();this.erodeEdges(enabled);if(!enabled)return;for(const side of ['w','b']){const amount=this.state[side];if(!amount)continue;this.half(side,amount,losses.filter(x=>x.side===side));}}

 erodeEdges(enabled){
  this.world.boardRoot.updateWorldMatrix(true,true);
  if(!this.baseMeshes.length)this.world.boardRoot.traverse(mesh=>{if(!mesh.isMesh)return;mesh.geometry=mesh.geometry.clone();this.baseMeshes.push({mesh,base:mesh.geometry.attributes.position.array.slice()});});
  const points=[];for(const side of ['w','b']){const rnd=seeded(side==='w'?973:5543),sign=side==='w'?1:-1,loss=enabled?this.state[side]:0;for(let i=0;i<Math.floor(loss/3);i++)points.push({x:-4.4+rnd()*8.8,z:sign*4.77,radius:.25+rnd()*.40,depth:.04+Math.min(.16,loss*.006)});}
  for(const {mesh,base} of this.baseMeshes){const attr=mesh.geometry.attributes.position,inv=mesh.matrixWorld.clone().invert();for(let i=0;i<attr.count;i++){const original=V(base[i*3],base[i*3+1],base[i*3+2]),p=original.clone().applyMatrix4(mesh.matrixWorld);let amount=0;if(Math.abs(p.z)>4.13)for(const chip of points){const dist=Math.hypot(p.x-chip.x,p.z-chip.z);if(dist<chip.radius)amount=Math.max(amount,(1-dist/chip.radius)*chip.depth);}if(amount){p.y=Math.max(.025,p.y-amount);p.z-=Math.sign(p.z)*amount*.45;p.applyMatrix4(inv);attr.setXYZ(i,p.x,p.y,p.z);}else attr.setXYZ(i,original.x,original.y,original.z);}attr.needsUpdate=true;mesh.geometry.computeVertexNormals();mesh.geometry.computeBoundingSphere();}
 }
 half(side,amount,losses){
  const rnd=seeded(side==='w'?5741:11982),sign=side==='w'?1:-1,positions=[[],[],[]];
  const tri=(bucket,a,b,c)=>positions[bucket].push(...a,...b,...c);
  const quad=(bucket,a,b,c,d)=>{tri(bucket,a,b,c);tri(bucket,a,c,d)};
  const crack=(x,z,angle,length,width,depth)=>{
   const count=Math.max(8,Math.ceil(length/.08)),points=[];
   for(let i=0;i<=count;i++){
    const taper=Math.pow(1-i/(count+1),.6),w=width*(.5+rnd()*.8)*taper;
    points.push({x,z,w});angle+=(rnd()-.5)*.75;
    x=Math.max(-3.98,Math.min(3.98,x+Math.cos(angle)*length/count));
    z=sign*Math.max(.08,Math.min(3.98,sign*(z+Math.sin(angle)*length/count)));
    if(depth&&i>3&&i<count*.75&&(i%9===4))crack(x,z,angle+(rnd()>.5?1:-1)*(.65+rnd()*.4),length*.3,width*.48,depth-1);
   }
   for(let i=0;i<points.length-1;i++){
    const a=points[i],b=points[i+1],dx=b.x-a.x,dz=b.z-a.z,len=Math.hypot(dx,dz)||1,nx=-dz/len,nz=dx/len;
    const bed=TOP+.005,lip=TOP+.016,edge=.009;
    const al=[a.x+nx*a.w,bed,a.z+nz*a.w],ar=[a.x-nx*a.w,bed,a.z-nz*a.w],bl=[b.x+nx*b.w,bed,b.z+nz*b.w],br=[b.x-nx*b.w,bed,b.z-nz*b.w];
    quad(0,al,bl,br,ar);
    const bucket=(Math.floor((a.x+b.x)/2+4)+Math.floor(4-(a.z+b.z)/2))%2===0?1:2;
    quad(bucket,[a.x+nx*(a.w+edge),lip,a.z+nz*(a.w+edge)],[b.x+nx*(b.w+edge),lip,b.z+nz*(b.w+edge)],bl,al);
    quad(bucket,ar,br,[b.x-nx*(b.w+edge),lip,b.z-nz*(b.w+edge)],[a.x-nx*(a.w+edge),lip,a.z-nz*(a.w+edge)]);
   }
  };
  const roots=losses.filter(x=>x.type!=='p').slice(0,6);if(!roots.length)roots.push(losses[0]);
  for(const loss of roots){const weight=VALUES[loss.type]||1,x=Math.max(-3.8,Math.min(3.8,(loss.id.charCodeAt(0)-100.5)+(rnd()-.5)*.4));crack(x,sign*3.98,-sign*Math.PI/2+(rnd()-.5)*.45,Math.min(3.7,.65+weight*.16+amount*.055),.009+weight*.0018+amount*.00028,1);}
  for(const [i,array] of positions.entries()){if(!array.length)continue;const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(array,3));geo.computeVertexNormals();const m=this.mesh(geo,new THREE.MeshStandardMaterial({color:[0x161610,0x4b4a3c,0x9a8e72][i],roughness:.94,side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:-1}));m.receiveShadow=true;}
  for(let i=0;i<Math.floor(amount*1.2);i++){const x=-4.4+rnd()*8.8,z=sign*(4.88+rnd()*.38),s=.025+rnd()*.065;const g=new THREE.DodecahedronGeometry(s,0);g.scale(1,.6,1.45);const a=this.mesh(g,new THREE.MeshStandardMaterial({color:i%3===0?0x958773:0x35372f,roughness:.96}));a.position.set(x,.04+s*.35,z);a.rotation.set(rnd()*3,rnd()*6,rnd()*2);a.castShadow=true;a.receiveShadow=true;}
 }
}

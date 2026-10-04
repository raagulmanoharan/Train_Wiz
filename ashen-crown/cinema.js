import * as THREE from 'three';
import * as CANNON from 'cannon-es';
const v=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z);
const clamp=THREE.MathUtils.clamp;
const smooth=x=>{x=clamp(x,0,1);return x*x*(3-2*x)};

// Split actual sculpture surfaces, preserve UVs and normals, and close the cut faces.
function split(triangles,normal,constant){
  const halves=[[],[]],cuts=[];
  const interp=(a,b,t)=>({p:a.p.clone().lerp(b.p,t),n:a.n.clone().lerp(b.n,t).normalize(),uv:a.uv.clone().lerp(b.uv,t)});
  for(const tri of triangles){
    const ds=tri.v.map(a=>normal.dot(a.p)-constant);
    for(let side=0;side<2;side++){
      const polygon=[],sign=side===0?1:-1;
      for(let i=0;i<3;i++){
        const a=tri.v[i],b=tri.v[(i+1)%3],da=ds[i]*sign,db=ds[(i+1)%3]*sign;
        if(da>=-1e-6)polygon.push(a);
        if((da>1e-6&&db< -1e-6)||(da< -1e-6&&db>1e-6)){
          const point=interp(a,b,da/(da-db));polygon.push(point);if(side===0)cuts.push(point.p);
        }
      }
      for(let k=1;k+1<polygon.length;k++)halves[side].push({v:[polygon[0],polygon[k],polygon[k+1]],inside:tri.inside});
    }
  }
  if(cuts.length>=3){
    const u=v().crossVectors(normal,Math.abs(normal.y)<.9?v(0,1,0):v(1,0,0)).normalize(),w=v().crossVectors(normal,u);
    const seen=new Map();for(const p of cuts)seen.set([p.x,p.y,p.z].map(n=>n.toFixed(5)).join(','),p);
    const points=[...seen.values()].map(p=>({p,x:p.dot(u),y:p.dot(w)})).sort((a,b)=>a.x-b.x||a.y-b.y);
    const cross=(a,b,c)=>(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
    const hull=[];for(const p of points){while(hull.length>=2&&cross(hull.at(-2),hull.at(-1),p)<=0)hull.pop();hull.push(p)}
    const lower=hull.length;for(let i=points.length-2;i>=0;i--){const p=points[i];while(hull.length>lower&&cross(hull.at(-2),hull.at(-1),p)<=0)hull.pop();hull.push(p)}hull.pop();
    for(let side=0;side<2;side++)for(let i=1;i+1<hull.length;i++){
      const list=side===0?[hull[0],hull[i+1],hull[i]]:[hull[0],hull[i],hull[i+1]],n=normal.clone().multiplyScalar(side===0?-1:1);
      halves[side].push({v:list.map(a=>({p:a.p,n,uv:new THREE.Vector2(a.x,a.y)})),inside:true});
    }
  }
  return halves;
}
function fracture(shape,type){
  shape.updateWorldMatrix(true,true);const inverse=shape.parent.matrixWorld.clone().invert();let triangles=[];
  shape.traverse(mesh=>{if(!mesh.isMesh)return;const g=mesh.geometry.index?mesh.geometry.toNonIndexed():mesh.geometry.clone(),pos=g.attributes.position,nor=g.attributes.normal,uv=g.attributes.uv,matrix=inverse.clone().multiply(mesh.matrixWorld),normalMatrix=new THREE.Matrix3().getNormalMatrix(matrix);
    for(let i=0;i<pos.count;i+=3){const verts=[];for(let j=0;j<3;j++)verts.push({p:v().fromBufferAttribute(pos,i+j).applyMatrix4(matrix),n:v().fromBufferAttribute(nor,i+j).applyMatrix3(normalMatrix).normalize(),uv:uv?new THREE.Vector2().fromBufferAttribute(uv,i+j):new THREE.Vector2()});triangles.push({v:verts,inside:false})}g.dispose();
  });
  let chunks=[triangles];const depth=type==='b'?3:4;
  for(let level=0;level<depth;level++){
    const next=[];
    for(let i=0;i<chunks.length;i++){
      const part=chunks[i],bounds=new THREE.Box3();for(const t of part)for(const a of t.v)bounds.expandByPoint(a.p);
      const center=bounds.getCenter(v()),size=bounds.getSize(v());let n;
      if(level===0)n=v(.20,1,.13).normalize();else if(level===1)n=v(1,.12,.4).normalize();else if(level===2)n=v(-.25,.18,1).normalize();else n=size.y>size.x?v(.4,1,-.3).normalize():v(1,.3,-.4).normalize();
      const halves=split(part,n,n.dot(center)+(i%2?.015:-.015));for(const h of halves)if(h.length>8)next.push(h);
    }chunks=next;
  }
  return chunks.map(part=>{
    const bounds=new THREE.Box3();for(const t of part)for(const a of t.v)bounds.expandByPoint(a.p);const center=bounds.getCenter(v()),size=bounds.getSize(v()),positions=[],normals=[],uvs=[];
    const sorted=[...part.filter(t=>!t.inside),...part.filter(t=>t.inside)],outside=part.filter(t=>!t.inside).length*3;
    for(const t of sorted)for(const a of t.v){positions.push(a.p.x-center.x,a.p.y-center.y,a.p.z-center.z);normals.push(a.n.x,a.n.y,a.n.z);uvs.push(a.uv.x,a.uv.y)}
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));geometry.addGroup(0,outside,0);geometry.addGroup(outside,positions.length/3-outside,1);geometry.computeBoundingSphere();return {geometry,center,size};
  });
}
const styles={
  p:{title:'The first vow',duration:5.9,hit:.54,lift:.04,force:1.7,quote:'One square changes a life.'},
  n:{title:'The winter rider',duration:6.8,hit:.60,lift:1.75,force:2.5,quote:'He arrives before the warning.'},
  b:{title:'The silent confession',duration:6.2,hit:.56,lift:.03,force:1.5,quote:'Some confessions are never spoken.'},
  r:{title:'The last gate',duration:6.6,hit:.59,lift:.02,force:3.4,quote:'Nothing crosses the gate twice.'},
  q:{title:'The quiet command',duration:6.5,hit:.56,lift:.10,force:2.2,quote:'The room goes quiet.'},
  k:{title:'The weight of a crown',duration:6.3,hit:.55,lift:.035,force:1.8,quote:'For once, the crown pays its own debt.'}
};
export class CaptureDirector{
  constructor(world,audio){this.world=world;this.audio=audio;this.cache=new Map();this.debris=[];this.active=null;this.focus=8;this.physics=null;this.dust=null;this.physicsTime=0}
  clear(){
    for(const d of this.debris){this.world.scene.remove(d.mesh);d.mesh.material.forEach(m=>m.dispose())}this.debris=[];
    if(this.dust){this.world.scene.remove(this.dust);this.dust.geometry.dispose();this.dust.material.dispose();this.dust=null}
    this.physics=null;this.physicsTime=0;
  }
  prepare(p){const key=p.side+p.type;if(!this.cache.has(key))this.cache.set(key,fracture(p.group.children[0],p.type));return this.cache.get(key)}
  shatter(p,pos,dir,style){
    this.clear();this.physics=new CANNON.World({gravity:new CANNON.Vec3(0,-7.8,0),allowSleep:true});
    const stone=new CANNON.Material('stone'),ground=new CANNON.Body({mass:0,shape:new CANNON.Plane(),material:stone});ground.quaternion.setFromEuler(-Math.PI/2,0,0);ground.position.y=.30;ground.collisionFilterGroup=1;ground.collisionFilterMask=2;this.physics.addBody(ground);
    this.physics.addContactMaterial(new CANNON.ContactMaterial(stone,stone,{friction:.68,restitution:.18}));
    const rotation=p.group.quaternion.clone(),fragments=this.prepare(p);
    fragments.forEach((f,i)=>{
      const outer=p.material.clone();outer.transparent=true;outer.opacity=1;
      const inner=new THREE.MeshStandardMaterial({color:p.side==='w'?0xa89f8d:0x292b29,roughness:.92,transparent:true});
      const mesh=new THREE.Mesh(f.geometry,[outer,inner]);const center=f.center.clone().applyQuaternion(rotation);mesh.position.copy(pos).add(center);mesh.quaternion.copy(rotation);mesh.castShadow=true;mesh.receiveShadow=true;this.world.scene.add(mesh);
      const size=f.size.clone().multiplyScalar(.43),mass=Math.max(.04,size.x*size.y*size.z*10);
      const body=new CANNON.Body({mass,material:stone,shape:new CANNON.Box(new CANNON.Vec3(Math.max(.025,size.x),Math.max(.025,size.y),Math.max(.025,size.z))),linearDamping:.28,angularDamping:.26});
      body.position.copy(mesh.position);body.quaternion.copy(mesh.quaternion);body.collisionFilterGroup=2;body.collisionFilterMask=1;
      const radial=v(center.x,0,center.z).normalize(),spread=style.force;
      body.velocity.set(dir.x*spread+radial.x*.85,1.0+(i%4)*.22+(style===styles.q?.85:0),dir.z*spread+radial.z*.85);
      body.angularVelocity.set(Math.sin(i*3.1)*5,Math.cos(i*1.7)*4,Math.sin(i*2.4)*5);this.physics.addBody(body);this.debris.push({mesh,body});
    });
    const count=96,positions=new Float32Array(count*3);this.dustVelocity=[];
    for(let i=0;i<count;i++){const a=i*2.399;positions.set([pos.x,.34+Math.random()*p.height,pos.z],i*3);this.dustVelocity.push(v(Math.cos(a)*(1+(i%5)*.25)+dir.x,.3+(i%4)*.25,Math.sin(a)*(1+(i%3)*.25)+dir.z))}
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(positions,3));
    this.dust=new THREE.Points(geo,new THREE.PointsMaterial({color:p.side==='w'?0xc7bca2:0x797a72,size:.035,transparent:true,opacity:.6,depthWrite:false}));this.world.scene.add(this.dust);p.group.visible=false;
  }
  start(p,victim,end,onDone,{preview=false,onScar=()=>{}}={}){
    this.clear();this.prepare(victim);
    const {camera}=this.world,style=styles[p.type],from=p.group.position.clone(),victimPos=victim.group.position.clone(),dir=victimPos.clone().sub(from).setY(0).normalize();if(!dir.lengthSq())dir.z=-1;
    const side=v(-dir.z,0,dir.x);if(side.x<0)side.negate();
    const approach=victimPos.clone().addScaledVector(dir,-1.25),height=Math.max(p.height,victim.height);
    const saved={position:camera.position.clone(),quaternion:camera.quaternion.clone(),fov:camera.fov};
    const axis=v().crossVectors(v(0,1,0),dir).normalize(),base=p.group.quaternion.clone();
    this.active={p,victim,end,onDone,preview,onScar,style,from,victimPos,dir,side,approach,height,saved,axis,base,hit:false,shot:'anticipation'};
    this.audio('tension',p.type);
  }
  pose(pos,focus,fov){const camera=this.world.camera;camera.position.copy(pos);camera.fov=fov;camera.lookAt(focus);camera.updateProjectionMatrix();this.focus=pos.distanceTo(focus)}
  update(t){
    const a=this.active;if(!a)return;const {p,victim,style,from,victimPos,dir,side,approach,height,axis,base,end}=a;
    const portrait=clamp(.85/this.world.camera.aspect,1,1.8),hit=style.hit;
    const q=clamp((t-.25)/(hit-.25),0,1),wind=Math.sin(clamp(t/.25,0,1)*Math.PI);
    p.group.quaternion.copy(base);p.group.scale.setScalar(1);
    if(t<hit){
      if(t<.25){p.group.position.copy(from).addScaledVector(dir,-wind*.11);p.group.quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(axis,-wind*(p.type==='n'?.20:.045)))}
      else{
        const e=p.type==='r'?q*q*q:p.type==='n'?q:p.type==='q'?smooth(q*.7):q*q*(3-2*q);
        const destination=p.type==='q'?approach:victimPos;p.group.position.lerpVectors(from,destination,e);p.group.position.y=.30+Math.sin(q*Math.PI)*style.lift;
        if(p.type==='n'){p.group.position.addScaledVector(side,Math.sin(q*Math.PI)*.32);p.group.quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(axis,-Math.sin(q*Math.PI*1.5)*.27))}
        else if(p.type==='b'){p.group.position.addScaledVector(side,Math.sin(q*Math.PI)*.42);p.group.rotation.y+=Math.sin(q*Math.PI)*.55}
        else if(p.type==='p'||p.type==='k')p.group.quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(axis,Math.sin(q*Math.PI)*.055));
      }
    }
    if(t>=hit&&!a.hit){a.hit=true;this.shatter(victim,victimPos,dir,style);this.audio('impact',p.type);if(!a.preview)a.onScar();if(navigator.vibrate)navigator.vibrate([18,35,9])}
    if(t>=hit){const settle=smooth((t-hit)/.17);p.group.position.copy(p.type==='q'?approach:victimPos).lerp(end,settle);p.group.position.y=.30+(p.type==='n'?Math.sin(settle*Math.PI)*.09:0)}
    // Hard editorial cuts between lenses; tracking only within each shot.
    let focus,position,fov=39;
    if(t<.20){
      a.shot='anticipation';focus=p.group.position.clone().add(v(0,p.height*.56,0));position=focus.clone().addScaledVector(dir,-3.1*portrait).addScaledVector(side,1.4*portrait).add(v(0,.7,0));position.addScaledVector(dir,t*.8);fov=34;
    }else if(t<hit-.045){
      a.shot=p.type==='n'?'vault':'approach';focus=p.group.position.clone().lerp(victimPos,.30).add(v(0,height*.55,0));position=focus.clone().addScaledVector(side,4.1*portrait).addScaledVector(dir,-1.2*portrait).add(v(0,1.25*portrait,0));
      if(p.type==='n'){position.y+=Math.sin(q*Math.PI)*.65;focus.y+=Math.sin(q*Math.PI)*.15}fov=40;
    }else if(t<hit+.14){
      a.shot='impact';focus=victimPos.clone().add(v(0,height*.40,0));position=focus.clone().addScaledVector(side,3.9*portrait).addScaledVector(dir,-1.7*portrait).add(v(0,.55*portrait,0));fov=36;
      const age=Math.max(0,t-hit),shake=age<.05?Math.sin(age*1400)*(.05-age)*1.1:0;position.add(v(shake,shake*.5,0));
    }else if(t<.93){
      a.shot='aftermath';focus=end.clone().add(v(0,p.height*.48,0));const slide=smooth((t-hit-.14)/(.93-hit-.14));position=focus.clone().addScaledVector(side,(4.25+slide*.25)*portrait).addScaledVector(dir,-2.1*portrait).add(v(0,1.25*portrait,0));fov=38;
    }else{
      a.shot='return';this.world.camera.position.copy(a.saved.position);this.world.camera.quaternion.copy(a.saved.quaternion);this.world.camera.fov=a.saved.fov;this.world.camera.updateProjectionMatrix();this.focus=25;return;
    }
    this.pose(position,focus,fov);
    const fade=1-smooth((t-.83)/.10);for(const d of this.debris)for(const m of d.mesh.material)m.opacity=fade;
    if(this.dust)this.dust.material.opacity=fade*.4*Math.max(0,1-this.physicsTime*.55);
  }
  tick(dt,t){
    if(!this.physics||!this.active)return;
    const age=t-this.active.style.hit,speed=age<.09?.18:age<.16?.5:1;
    const step=Math.min(dt,.05)*speed;this.physics.step(1/120,step,8);this.physicsTime+=step;
    for(const d of this.debris){d.mesh.position.copy(d.body.position);d.mesh.quaternion.copy(d.body.quaternion)}
    if(this.dust){const p=this.dust.geometry.attributes.position;for(let i=0;i<p.count;i++){const vel=this.dustVelocity[i];vel.y-=step*.5;p.setXYZ(i,p.getX(i)+vel.x*step,Math.max(.33,p.getY(i)+vel.y*step),p.getZ(i)+vel.z*step)}p.needsUpdate=true}
  }
  finish(){const a=this.active;if(!a)return;this.clear();a.p.group.position.copy(a.end);a.p.group.quaternion.copy(a.base);a.victim.group.visible=false;this.world.camera.position.copy(a.saved.position);this.world.camera.quaternion.copy(a.saved.quaternion);this.world.camera.fov=a.saved.fov;this.world.camera.updateProjectionMatrix();this.active=null;a.onDone()}
  get duration(){return this.active?.style.duration||6.5}
}

// Layered synthesized Foley: transient, stone resonance, granular grit and a room tail.
export class Foley{
  constructor(){this.enabled=false;this.context=null}
  play(event,type='p'){
    if(!this.enabled)return;
    try{
      const c=this.context??=new(window.AudioContext||window.webkitAudioContext)();c.resume();const now=c.currentTime;
      const weight={p:1,n:1.2,b:.8,r:1.9,q:1.4,k:1.5}[type]||1;
      const master=c.createGain();master.gain.value=.36;master.connect(c.destination);
      const tone=(freq,vol,duration,delay=0)=>{const o=c.createOscillator(),g=c.createGain();o.frequency.setValueAtTime(freq,now+delay);o.frequency.exponentialRampToValueAtTime(Math.max(25,freq*.63),now+delay+duration);g.gain.setValueAtTime(.001,now+delay);g.gain.linearRampToValueAtTime(vol,now+delay+.008);g.gain.exponentialRampToValueAtTime(.0001,now+delay+duration);o.connect(g);g.connect(master);o.start(now+delay);o.stop(now+delay+duration+.02)};
      const noise=(duration,freq,vol,delay=0)=>{const buffer=c.createBuffer(1,Math.ceil(duration*c.sampleRate),c.sampleRate),data=buffer.getChannelData(0);for(let i=0;i<data.length;i++)data[i]=(Math.random()*2-1)*Math.pow(1-i/data.length,2.6);const src=c.createBufferSource(),f=c.createBiquadFilter(),g=c.createGain();src.buffer=buffer;f.type='bandpass';f.frequency.value=freq;f.Q.value=.7;g.gain.value=vol;src.connect(f);f.connect(g);g.connect(master);src.start(now+delay)};
      if(event==='tension'){noise(.65,650,.06);tone(62/weight,.055,.85);return}
      if(event==='move'){tone(190,.065,.14);noise(.055,2100,.09);return}
      tone(84/weight,.48,.65);tone(155/weight,.18,.33);tone(425/weight,.10,.25);noise(.10,1900,.54);noise(.65,4200,.28,.035);
      for(let i=0;i<9;i++)noise(.025+Math.random()*.07,1800+Math.random()*3200,.16/(1+i*.2),.1+i*.075);
      tone(96/weight,.06,1.2,.11);setTimeout(()=>master.disconnect(),2200);
    }catch(e){console.warn('Sound unavailable',e)}
  }
}

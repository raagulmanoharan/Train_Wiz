import * as THREE from 'three';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {BokehPass} from 'three/addons/postprocessing/BokehPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';

export function createWorld(stage){
  const renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure=1.10;
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  renderer.domElement.setAttribute('aria-label','Full-screen 3D chess table. Tap a piece and then its destination.');
  stage.append(renderer.domElement);
  const scene=new THREE.Scene();scene.background=new THREE.Color(0x151311);
  const camera=new THREE.PerspectiveCamera(27,1,.07,160);
  const target=new THREE.Vector3(0,.50,0),playPosition=new THREE.Vector3();
  const pmrem=new THREE.PMREMGenerator(renderer),room=new RoomEnvironment();
  scene.environment=pmrem.fromScene(room,.055).texture;scene.environmentIntensity=.40;
  room.dispose();pmrem.dispose();
  scene.add(new THREE.HemisphereLight(0xdbe1e8,0x302319,.45));
  const key=new THREE.DirectionalLight(0xffe6c8,2.25);key.position.set(-6,10,5);
  key.castShadow=true;key.shadow.mapSize.set(2048,2048);
  Object.assign(key.shadow.camera,{left:-11,right:11,top:11,bottom:-11,near:.1,far:35});
  key.shadow.normalBias=.007;key.shadow.bias=-.00008;scene.add(key);
  const rim=new THREE.DirectionalLight(0xbfd0e2,1.15);rim.position.set(3,7,-6);scene.add(rim);
  const mat={
    white:new THREE.MeshPhysicalMaterial({color:0xe6ddc9,roughness:.36,metalness:0,clearcoat:.16,clearcoatRoughness:.27}),
    black:new THREE.MeshPhysicalMaterial({color:0x777d80,roughness:.29,metalness:0,clearcoat:.24,clearcoatRoughness:.25}),
    board:new THREE.MeshPhysicalMaterial({color:0xd3cabb,roughness:.58,metalness:0,clearcoat:.12,clearcoatRoughness:.48})
  };
  // Seeded wood grain and fine pores for the surrounding table, not replacement piece geometry.
  function wood(){
    const c=document.createElement('canvas');c.width=c.height=1024;const ctx=c.getContext('2d'),image=ctx.createImageData(1024,1024);let seed=1827;
    const rnd=()=>((seed=(1664525*seed+1013904223)>>>0)/4294967296);
    for(let y=0;y<1024;y++)for(let x=0;x<1024;x++){
      const bend=Math.sin(y*.009)*4+Math.sin(y*.002+x*.007)*12;
      const grain=Math.sin((x+bend)*.62)*1.9+Math.sin((x+bend)*.15)*3+Math.sin(x*.018+y*.002)*5;
      const seam=(x%256<2)?-20:0,n=grain+(rnd()-.5)*7+seam,k=(y*1024+x)*4;
      image.data[k]=69+n;image.data[k+1]=47+n*.78;image.data[k+2]=33+n*.56;image.data[k+3]=255;
    }
    ctx.putImageData(image,0,0);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(2,3);t.anisotropy=8;return t;
  }
  const woodMap=wood(),tableMaterial=new THREE.MeshStandardMaterial({map:woodMap,bumpMap:woodMap,bumpScale:.025,roughness:.72,color:0xb7a797});
  const table=new THREE.Mesh(new RoundedBoxGeometry(32,.65,42,3,.11),tableMaterial);table.position.y=-.325;table.receiveShadow=true;scene.add(table);
  const leather=new THREE.MeshStandardMaterial({color:0x252925,roughness:.88});
  const pad=new THREE.Mesh(new RoundedBoxGeometry(10.25,.025,10.25,3,.08),leather);pad.position.y=.002;pad.receiveShadow=true;scene.add(pad);
  const brass=new THREE.MeshStandardMaterial({color:0x8c7150,metalness:.65,roughness:.37});
  const props=new THREE.Group();scene.add(props);
  const cylinder=(rt,rb,h,material,x,y,z)=>{const m=new THREE.Mesh(new THREE.CylinderGeometry(rt,rb,h,48),material);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;props.add(m);return m};
  const wax=new THREE.MeshStandardMaterial({color:0xb9a78a,roughness:.78});
  for(const [x,z,h] of [[-6.1,-5.9,1.2],[-6.8,-5.2,.8]]){
    cylinder(.39,.46,.10,brass,x,.08,z);cylinder(.19,.22,h,wax,x,h*.5+.13,z);
    cylinder(.01,.012,.12,new THREE.MeshStandardMaterial({color:0x15100a}),x,h+.15,z);
    const flame=new THREE.Mesh(new THREE.SphereGeometry(.055,12,8),new THREE.MeshBasicMaterial({color:0xffd79a}));flame.scale.set(1,2.6,1);flame.position.set(x,h+.28,z);props.add(flame);
    const light=new THREE.PointLight(0xffbc69,1.5,5,2);light.position.copy(flame.position);props.add(light);
  }
  const book=new THREE.Group();book.position.set(6.7,.03,-5.1);book.rotation.y=-.22;props.add(book);
  for(const [y,h,m] of [[.035,.06,leather],[.19,.26,new THREE.MeshStandardMaterial({color:0xa4997f,roughness:1})],[.35,.06,leather]]){
    const cover=new THREE.Mesh(new RoundedBoxGeometry(2.0,h,2.9,2,.025),m);cover.position.y=y;cover.castShadow=true;cover.receiveShadow=true;book.add(cover);
  }
  const seal=cylinder(.22,.22,.04,new THREE.MeshStandardMaterial({color:0x512c23,roughness:.42}),5.8,.10,-3.25);seal.rotation.z=.12;
  const boardRoot=new THREE.Group();scene.add(boardRoot);
  const loader=new THREE.TextureLoader();const warnings=[];
  async function surface(name,material){
    const root='https://dl.polyhaven.org/file/ph-assets/Models/jpg/1k/chess_set/';
    const maps=await Promise.all(['diff','nor_gl','arm'].map(kind=>loader.loadAsync(`${root}chess_set_${name}_${kind}_1k.jpg`)));
    for(const t of maps){t.flipY=false;t.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy())}
    maps[0].colorSpace=THREE.SRGBColorSpace;
    material.map=maps[0];material.normalMap=maps[1];material.normalScale.set(.55,.55);material.roughnessMap=maps[2];material.aoMap=maps[2];material.aoMapIntensity=.7;material.needsUpdate=true;
  }
  async function install(gltf,scale){
    const mesh=gltf.scene.getObjectByName('board').clone(true);mesh.scale.setScalar(scale);mesh.rotation.y=Math.PI;
    mesh.traverse(n=>{if(n.isMesh){n.material=mat.board;n.castShadow=true;n.receiveShadow=true}});boardRoot.add(mesh);
    const results=await Promise.allSettled([surface('board',mat.board),surface('pieces_white',mat.white),surface('pieces_black',mat.black)]);
    results.forEach((r,i)=>{if(r.status==='rejected')warnings.push(`Texture group ${i} unavailable`)});
    return results.every(r=>r.status==='fulfilled');
  }
  // Fixed, long-lens board view. Framing never depends on live piece positions.
  function resize(w,h){
    renderer.setSize(w,h,false);camera.aspect=w/h;
    const pitch=THREE.MathUtils.degToRad(64),back=new THREE.Vector3(0,Math.sin(pitch),Math.cos(pitch));
    const up=new THREE.Vector3(0,Math.cos(pitch),-Math.sin(pitch));
    const tanV=Math.tan(THREE.MathUtils.degToRad(27/2)),tanH=tanV*camera.aspect;
    let distance=1;const verticalMargin=Math.max(.55,1-140/h);
    for(const x of [-4.80,4.80])for(const z of [-4.80,4.80])for(const y of [0,1.6]){
      const p=new THREE.Vector3(x,y,z).sub(target),depth=p.dot(back);
      distance=Math.max(distance,depth+Math.abs(x)/(tanH*.96),depth+Math.abs(p.dot(up))/(tanV*verticalMargin));
    }
    playPosition.copy(back).multiplyScalar(distance).add(target);
    if(composer)composer.setSize(w,h);
  }
  function lock(){camera.fov=27;camera.position.copy(playPosition);camera.lookAt(target);camera.updateProjectionMatrix()}
  let composer=null,bokeh=null;
  function render(cinematic=false,focus=5){
    if(cinematic){
      if(!composer){composer=new EffectComposer(renderer);composer.addPass(new RenderPass(scene,camera));bokeh=new BokehPass(scene,camera,{focus,aperture:.012,maxblur:.011});composer.addPass(bokeh);composer.addPass(new OutputPass());composer.setSize(stage.clientWidth,stage.clientHeight)}
      bokeh.uniforms.focus.value=focus;composer.render();
    }else renderer.render(scene,camera);
  }
  return {renderer,scene,camera,target,mat,boardRoot,install,resize,lock,render,playPosition,warnings};
}

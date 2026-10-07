/** Extends the existing R3F renderer. No extra canvas, library or animation loop. */
export function createImmersionComponents(React, useFrame, T) {
 const h=React.createElement;
 const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
 function useScrollProgress(raw){
  const shared=React.useRef(raw.current);
  useFrame((_,dt)=>{shared.current+=(clamp(raw.current,0,1)-shared.current)*(1-Math.exp(-Math.min(dt,.06)*18));},-2);
  return shared;
 }
 function SimandouOrbitalRibbon({progress,light=false}) {
  const bundle=React.useMemo(()=>{
   // One continuous investment/corridor trajectory; deliberately schematic.
   const curve=new T.CatmullRomCurve3([
    [-10,2,-11],[-7,5,-14],[1,6,-15],[8,4,-12],[9,0,-7],
    [3,-.6,-5],[-3,-.7,-3],[-8,.3,-2],[-9,3,-6],[-3,5,-11],
    [4,3,-10],[7,1,-7],[5,1,-4],[1,2,-2],[-4,3,-4]
   ].map(p=>new T.Vector3(...p)),false,'catmullrom',.45);
   const geometry=new T.TubeGeometry(curve,light?180:320,.07,light?5:8,false);
   const material=new T.ShaderMaterial({transparent:true,depthWrite:false,side:2,toneMapped:false,
    uniforms:{uProgress:{value:.1},uVelocity:{value:0}},
    vertexShader:`varying vec2 vUv;uniform float uVelocity;void main(){vUv=uv;vec3 p=position+normal*uVelocity*.008;gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}`,
    fragmentShader:`varying vec2 vUv;uniform float uProgress;void main(){if(vUv.x>uProgress)discard;vec3 green=vec3(0.,.635,.416);vec3 glow=vec3(.192,.839,.627);vec3 copper=vec3(.89,.537,.243);vec3 color=mix(green,glow,smoothstep(0.,.45,vUv.x));color=mix(color,copper,smoothstep(.48,.96,vUv.x));float face=.72+.28*sin(vUv.y*6.283185);float tip=1.-smoothstep(uProgress-.018,uProgress,vUv.x);gl_FragColor=vec4(color*face,.92*tip);#include <colorspace_fragment>}`.replace(';#include',';\n#include')
   });return {geometry,material,last:0};
  },[light]);
  React.useEffect(()=>()=>{bundle.geometry.dispose();bundle.material.dispose();},[bundle]);
  useFrame((_,dt)=>{
   const p=progress.current;
   bundle.material.uniforms.uProgress.value=.12+.88*p;
   bundle.material.uniforms.uVelocity.value=clamp(Math.abs(p-bundle.last)/Math.max(dt,.001),0,1);
   bundle.last=p;
  });
  return h('mesh',{geometry:bundle.geometry,material:bundle.material,frustumCulled:false});
 }
 function SpatialDistortionPass({light=false,progress}) {
  const diagnosticsEnabled=React.useMemo(()=>new URLSearchParams(location.search).has('diagnostics'),[]);
  const diagnostics=React.useRef({frames:0,time:0,maxStrength:0});
  const field=React.useRef({x:.5,y:.5,tx:.5,ty:.5,speed:0,blocked:false,stamp:0});
  const resources=React.useMemo(()=>{
   const target=new T.WebGLRenderTarget(1,1,{depthBuffer:true,stencilBuffer:false});
   target.texture.colorSpace='srgb';
   const uniforms={tScene:{value:target.texture},uMouse:{value:{x:.5,y:.5}},uMouseVelocity:{value:0},uRadius:{value:.23},uStrength:{value:0},uTime:{value:0},uResolution:{value:{x:1,y:1}},uAspect:{value:1}};
   const material=new T.ShaderMaterial({uniforms,depthTest:false,depthWrite:false,toneMapped:false,
    vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}',
    fragmentShader:`uniform sampler2D tScene;uniform vec2 uMouse;uniform float uMouseVelocity,uRadius,uStrength,uTime,uAspect;uniform vec2 uResolution;varying vec2 vUv;
void main(){vec2 delta=vUv-uMouse;delta.x*=uAspect;float dist=length(delta);float lens=1.-smoothstep(0.,uRadius,dist);vec2 bend=delta*lens*lens*uStrength*(.45+uMouseVelocity);bend.x/=uAspect;vec2 pixel=1./uResolution;vec2 uv=clamp(vUv-bend,pixel,1.-pixel);gl_FragColor=texture2D(tScene,uv);
#include <colorspace_fragment>
}`});
   const scene=new T.Scene(),camera=new T.OrthographicCamera(-1,1,1,-1,0,1),geometry=new T.PlaneGeometry(2,2);
   scene.add(new T.Mesh(geometry,material));
   return {target,uniforms,material,scene,camera,geometry,w:0,h:0};
  },[]);
  React.useEffect(()=>{
   const f=field.current;
   function move(event){
    if(event.pointerType==='touch')return;
    const x=event.clientX/innerWidth,y=1-event.clientY/innerHeight;
    const dt=Math.max(8,performance.now()-f.stamp);
    f.speed=clamp(Math.hypot(x-f.tx,y-f.ty)*1000/dt,0,1.6);
    f.tx=x;f.ty=y;f.stamp=performance.now();
    f.blocked=!!event.target.closest?.('header,a,button,input,textarea,select,.partner-card,.institutional-logo');
   }
   const leave=()=>{f.speed=0;f.blocked=true;};
   window.addEventListener('pointermove',move,{passive:true});document.addEventListener('pointerleave',leave);
   return ()=>{window.removeEventListener('pointermove',move);document.removeEventListener('pointerleave',leave);};
  },[]);
  React.useEffect(()=>()=>{resources.target.dispose();resources.material.dispose();resources.geometry.dispose();},[resources]);
  useFrame(({gl,scene,camera,size,clock},dt)=>{
   // Positive priority owns the existing renderer's final draw. All 3D updates ran first.
   if(document.hidden)return;
   const f=field.current,r=resources,d=Math.min(dt,.05),ease=1-Math.exp(-d*12);
   f.x+=(f.tx-f.x)*ease;f.y+=(f.ty-f.y)*ease;f.speed*=Math.exp(-d*5);
   const u=r.uniforms;u.uMouse.value.x=f.x;u.uMouse.value.y=f.y;
   u.uMouseVelocity.value=f.speed;
   const intensity=light||f.blocked?0:clamp(f.speed*.23,0,.22);
   u.uStrength.value+=(intensity-u.uStrength.value)*ease;u.uTime.value=clock.elapsedTime;u.uAspect.value=size.width/size.height;
   // Low-end/touch path uses a direct render and allocates no full-size FBO.
   if(light){gl.setRenderTarget(null);gl.render(scene,camera);renderProtected();record();return;}
   const ratio=Math.min(gl.getPixelRatio(),1.25),w=Math.round(size.width*ratio),height=Math.round(size.height*ratio);
   if(w!==r.w||height!==r.h){r.target.setSize(w,height);r.w=w;r.h=height;u.uResolution.value.x=w;u.uResolution.value.y=height;}
   gl.setRenderTarget(r.target);gl.render(scene,camera);gl.setRenderTarget(null);gl.render(r.scene,r.camera);renderProtected();record();
   function renderProtected(){
    const background=scene.background,mask=camera.layers.mask,clear=gl.autoClear;
    scene.background=null;camera.layers.set(1);gl.autoClear=false;
    gl.clearDepth();gl.render(scene,camera);
    scene.background=background;camera.layers.mask=mask;gl.autoClear=clear;
   }
   function record(){
    if(!diagnosticsEnabled)return;
    const log=diagnostics.current;log.frames++;log.time+=dt;log.maxStrength=Math.max(log.maxStrength,u.uStrength.value);
    if(log.frames%30===0)gl.domElement.dataset.diagnostics=JSON.stringify({frames:log.frames,meanFrameMs:Math.round(log.time/log.frames*10000)/10,quality:light?'light':'full',progress:Math.round(progress.current*1000)/1000,ribbon:Math.round((.12+.88*progress.current)*1000)/1000,maxDistortion:Math.round(log.maxStrength*10000)/10000});
   }
  },1);
  return null;
 }
 return {useScrollProgress,SimandouOrbitalRibbon,SpatialDistortionPass};
}

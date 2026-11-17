window.Parkour = window.Parkour || {};
Parkour.Renderer = class {
  constructor(canvas) {
    this.canvas=canvas;this.ctx=canvas.getContext('2d');this.w=760;this.h=300;this.time=0;this.targets=[];this.animation=null;this.camera=0;
    this.reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
    matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change',e=>this.reduced=e.matches);
    new ResizeObserver(()=>this.resize()).observe(canvas);this.resize();
  }
  resize(){const r=this.canvas.getBoundingClientRect();this.w=r.width;this.h=r.height;const d=Math.min(devicePixelRatio||1,2);this.canvas.width=Math.round(this.w*d);this.canvas.height=Math.round(this.h*d);this.ctx.setTransform(d,0,0,d,0,0);}
  colors(){const s=getComputedStyle(document.body);return {ink:s.getPropertyValue('--ink').trim(),muted:s.getPropertyValue('--muted').trim(),line:s.getPropertyValue('--line').trim(),accent:'#d6f56b',green:s.getPropertyValue('--green').trim(),paper:s.getPropertyValue('--paper').trim()};}
  layout(n=3,level=1){const w=this.w,h=this.h;return Array.from({length:n},(_,i)=>({x:w*(.35+level*.025+i*((.53-level*.025)/Math.max(1,n-1))),y:h*(.61-(i%2)*.12),width:Math.min(100,w*.16)}));}
  animate(index,wrong,done){const targets=this.targets.length?this.targets:this.layout();const p=index<0?{x:this.w*.19,y:this.h*.68}:targets[index];this.animation={time:0,duration:this.reduced?.14:wrong?1.05:.72,from:{x:this.w*.19,y:this.h*.68},to:{x:p.x+p.dx||p.x,y:p.y+(p.dy||0)},wrong,index,done};}
  text(txt,x,y,size=10,color){const c=this.ctx;c.fillStyle=color||this.palette.muted;c.font=`${size}px monospace`;c.textAlign='center';c.fillText(txt,x,y);}
  platform(x,y,w,angle=0,cracks=0,broken=false){const c=this.ctx;c.save();c.translate(x,y);c.rotate(angle);c.fillStyle=broken?'#a8846d':this.palette.green;c.fillRect(-w/2,0,w,10);c.fillStyle='#91a67c';c.fillRect(-w/2,0,w,3);c.fillStyle=this.palette.line;c.fillRect(-w/2+5,10,w-10,9);if(cracks>0){c.strokeStyle=this.palette.paper;c.lineWidth=1.5;for(let i=0;i<Math.ceil(cracks*5);i++){const xx=-w/2+10+i*17;c.beginPath();c.moveTo(xx,0);c.lineTo(xx+6,5);c.lineTo(xx+2,10);c.stroke();}}c.restore();}
  stick(x,y,color,squash=1,pose=0){const c=this.ctx;c.save();c.translate(x,y);c.scale(1/Math.sqrt(squash),squash);c.strokeStyle=color;c.fillStyle=color;c.lineWidth=3;c.lineCap='round';c.beginPath();c.arc(0,-42,6,0,Math.PI*2);c.fill();c.beginPath();c.moveTo(0,-34);c.lineTo(-1,-18);c.lineTo(-10+pose,-2);c.moveTo(-1,-18);c.lineTo(10-pose,0);c.moveTo(0,-29);c.lineTo(-11,-22-pose);c.moveTo(0,-29);c.lineTo(12,-34+pose);c.stroke();c.restore();}
  coin(x,y){const c=this.ctx;c.fillStyle='#dec677';c.beginPath();c.arc(x,y,6,0,Math.PI*2);c.fill();c.strokeStyle='#a18b48';c.lineWidth=1;c.beginPath();c.moveTo(x,y-3);c.lineTo(x,y+3);c.stroke();}
  draw(dt,state,skin,trail,t){
    if(!state.paused)this.time+=dt;this.palette=this.colors();const c=this.ctx,w=this.w,h=this.h;c.clearRect(0,0,w,h);
    const time=this.time;
    // A quiet cartographic backdrop with a flat skyline.
    c.strokeStyle=this.palette.line;c.lineWidth=.6;for(let x=20;x<w;x+=32){c.beginPath();c.moveTo(x,0);c.lineTo(x,h);c.stroke();}for(let y=20;y<h;y+=32){c.beginPath();c.moveTo(0,y);c.lineTo(w,y);c.stroke();}
    c.globalAlpha=.4;c.fillStyle='#b9c8a6';c.beginPath();c.moveTo(0,h*.84);for(let x=0;x<=w+40;x+=40)c.lineTo(x,h*(.77+.05*Math.sin(x*.025)));c.lineTo(w,h);c.lineTo(0,h);c.fill();c.globalAlpha=.22;c.fillStyle='#8da17c';for(let i=0;i<12;i++){let x=(i*97+43)%w,y=h*.88;c.fillRect(x,y-18,3,23);c.beginPath();c.moveTo(x-12,y-13);c.lineTo(x+1,y-42-i%3*6);c.lineTo(x+15,y-13);c.fill();}c.globalAlpha=1;
    const level=state.phase==='idle'?2:Math.min(3,1+Math.floor(state.index/4));const n=state.phase==='final'?1:state.current?.answers.length||3;
    this.targets=this.layout(n,level).map((p,i)=>({...p,...Parkour.Physics.platform(i,time,level,this.reduced)}));
    const cracks=state.timer?Math.max(0,1-state.remaining/20):0;
    const cameraAnim=this.animation;const cameraProgress=cameraAnim?Math.min(1,cameraAnim.time/cameraAnim.duration):0;const camera=cameraAnim&&!cameraAnim.wrong&&!this.reduced?(cameraAnim.to.x-cameraAnim.from.x)*Parkour.Physics.ease(Math.max(0,(cameraProgress-.64)/.36)):0;c.save();c.translate(-camera,0);
    this.platform(w*.19,h*.68,w*.19*(1-cracks*.18),0,cracks,state.pendingWrong&&state.selected===-1);
    if(state.checkpoint>0){c.strokeStyle=this.palette.green;c.lineWidth=1.5;c.beginPath();c.moveTo(w*.10,h*.68);c.lineTo(w*.10,h*.68-34);c.stroke();c.fillStyle=this.palette.accent;c.fillRect(w*.10,h*.68-34,18,11);}
    for(let i=0;i<n;i++){let p=this.targets[i];const a=this.animation;let drop=0;const broken=a?.wrong&&a.index===i&&a.time/a.duration>.58;if(broken)drop=Math.pow((a.time/a.duration-.58)*2.4,2)*250;
      this.platform(p.x+p.dx,p.y+p.dy+drop,p.width,p.angle,broken?1:0,broken);
      if(!broken){this.coin(p.x+p.dx,p.y+p.dy-23);this.text(state.phase==='final'?'⚑':String.fromCharCode(65+i),p.x+p.dx,p.y+p.dy+37,10,this.palette.green);}
      if(broken&&!this.reduced){c.fillStyle=this.palette.green;for(let k=0;k<9;k++){const f=Math.max(0,a.time/a.duration-.58);c.save();c.translate(p.x+(k-4)*f*65,p.y+f*f*600+(k%3)*9);c.rotate(k+time*3);c.fillRect(-3,-3,6,6);c.restore();}}
    }
    let pos={x:w*.19,y:h*.68,squash:1};let pose=this.reduced?0:Math.sin(time*2)*1.5;
    if(this.animation){const a=this.animation;if(!state.paused)a.time+=dt;let f=Math.min(1,a.time/a.duration);pos=this.reduced?(f<1?a.from:a.to):Parkour.Physics.jump(a.from,a.to,f,a.wrong);pose=-7;
      if(trail==='gold'&&!this.reduced){c.fillStyle='#d5b34d';for(let j=1;j<7;j++){c.globalAlpha=(1-j/7)*.6;c.fillRect(pos.x-j*7,pos.y-25+Math.sin(time+j)*5,4,4);}c.globalAlpha=1;}
      if(f===1){this.animation=null;a.done();}
    }
    if(pos.y<h+55)this.stick(pos.x,pos.y,skin,pos.squash||1,pose);c.restore();
    // A direction marker and finish gate.
    c.strokeStyle=this.palette.muted;c.lineWidth=1;c.beginPath();c.moveTo(w*.28,h*.38);c.lineTo(w*.33,h*.38);c.lineTo(w*.32,h*.365);c.moveTo(w*.33,h*.38);c.lineTo(w*.32,h*.395);c.stroke();
    if(state.phase==='idle'){this.text('START',w*.19,h*.68+38,9);this.text('OPEN SOURCE / NO LIMITS',w*.66,h*.28,8);}
    if(state.phase==='final'){
      const gx=w*.28,gw=w*.44,gy=h*.27,zone=state.finalJump===0?.34:state.finalJump===1?.27:.20;const marker=state.gauge;
      c.fillStyle=this.palette.paper;c.fillRect(gx,gy,gw,12);c.fillStyle='#92b665';c.fillRect(gx+gw*(.5-zone/2),gy,gw*zone,12);c.fillStyle=this.palette.ink;c.fillRect(gx+gw*marker-2,gy-3,4,18);
      this.text(`${t(marker>.5-zone/2&&marker<.5+zone/2?'jumpNow':'wait')} · ${state.finalJump+1}/3`,w*.5,gy-12,10);
    }
  }
  hit(x,y){return this.targets.findIndex(p=>Math.abs(x-p.x-p.dx)<p.width/2+12&&y>p.y+p.dy-50&&y<p.y+p.dy+45);}
};

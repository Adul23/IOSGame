window.Parkour = window.Parkour || {};
Parkour.Physics = (() => {
  function ease(t) {return t<.5?2*t*t:1-Math.pow(-2*t+2,2)/2;}
  function jump(from,to,t,fall=false) {
    const x=from.x+(to.x-from.x)*ease(Math.min(t,1));
    let y=from.y+(to.y-from.y)*t-Math.sin(Math.PI*t)*110;
    if(fall && t>.65)y+=Math.pow((t-.65)/.35,2)*380;
    return {x,y,squash:t<.1?1+t*2:t>.88?1+(1-t)*1.5:1};
  }
  function platform(index,time,level,reduced) {
    if(reduced || level<2)return {dy:0,dx:0,angle:0};
    return {dy:Math.sin(time*1.3+index*1.8)*(level===3?15:8),dx:Math.cos(time*.9+index)* (level===3?8:0),angle:level===3?Math.sin(time+index)*.055:0};
  }
  return {ease,jump,platform};
})();

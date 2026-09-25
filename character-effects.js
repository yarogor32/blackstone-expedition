(() => {
  const halo=new Image();halo.src=new URL('effects/stress-halo-v1.png',document.currentScript.src).href;
  // Coordinates belong to the character canvas, so effects follow rank, camera and zoom.
  const definitions={stress:{image:halo,width:350,height:296,anchorX:260,anchorY:142,pivotX:.5,pivotY:400/760,fadeIn:180,fadeOut:500}};
  const confidence=new Image();confidence.src=new URL('effects/confidence-halo-v1.png',document.currentScript.src).href;
  definitions.confidence={...definitions.stress,image:confidence};
  class CharacterEffects {
    constructor(){this.active=new Map();}
    play(id,type,start,duration){if(definitions[type])this.active.set(id+':'+type,{id,type,start,end:start+duration});}
    draw(ctx,id,now){
      for(const [key,effect] of this.active){
        if(now>=effect.end){this.active.delete(key);continue;}
        if(effect.id!==id||now<effect.start)continue;
        const d=definitions[effect.type];if(!d.image.complete||!d.image.naturalWidth)continue;
        const age=now-effect.start,enter=Math.min(1,age/d.fadeIn),ease=1-Math.pow(1-enter,3);
        const pulseTime=Math.max(0,age-d.fadeIn);
        const scale=enter<1?.2+.8*ease:1+.1*(.5-.5*Math.cos(pulseTime/700*Math.PI*2));
        const alpha=Math.min(ease,(effect.end-now)/d.fadeOut);
        const w=d.width*scale,h=d.height*scale;
        ctx.save();ctx.filter='none';ctx.globalAlpha=Math.max(0,alpha);
        ctx.drawImage(d.image,d.anchorX-w*d.pivotX,d.anchorY-h*d.pivotY,w,h);ctx.restore();
      }
    }
    clear(){this.active.clear();}
  }
  window.CharacterEffects=CharacterEffects;
})();

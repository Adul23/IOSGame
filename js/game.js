window.Parkour = window.Parkour || {};
Parkour.Game = class {
  constructor(renderer,callbacks) {
    this.renderer=renderer;this.cb=callbacks;this.state={phase:'idle',paused:false,index:0,lives:3,score:0,coins:0,checkpoint:0,remaining:20,gauge:0,finalJump:0};this.last=0;
    this.tick=this.tick.bind(this);requestAnimationFrame(this.tick);
  }
  start(questions,options={}) {
    this.renderer.animation=null;this.questions=questions;this.earned=new Set();this.finalEarned=new Set();this.mistakes=[];this.correct=0;this.attempts=0;this.streak=0;this.options=options;
    this.state={phase:'question',paused:false,index:0,lives:3,score:0,coins:0,checkpoint:0,remaining:20,timer:options.timer,gauge:0,finalJump:0,location:options.location||null,prOpened:false};this.setQuestion();
  }
  setQuestion(){const s=this.state;s.phase='question';s.current=this.questions[s.index];s.remaining=20;s.selected=null;s.pendingWrong=false;this.cb.question(s);this.save();}
  answer(index){const s=this.state;if(s.phase!=='question'||s.paused)return;if(index!==-1&&(!Number.isInteger(index)||index<0||index>=s.current.answers.length))return;
    const ok=index===s.current.correct;s.phase='animating';s.selected=index;s.pendingWrong=!ok;this.attempts++;
    if(ok){this.correct++;this.streak++;if(!this.earned.has(s.current.id)){const reward=100+Math.min(this.streak-1,5)*25;s.score+=reward;s.coins+=10;this.cb.coins(10);this.earned.add(s.current.id);}}
    else {s.lives--;this.streak=0;this.mistakes.push({...s.current,chosen:index});}
    this.cb.answer(ok,index,s);this.save();this.renderer.animate(index,!ok,()=>{s.phase='feedback';this.cb.feedback(ok,index,s);this.save();});
  }
  next(){const s=this.state;if(s.phase!=='feedback')return;if(!s.lives){this.finish(false);return;}
    if(s.pendingWrong){s.index=s.checkpoint;this.cb.checkpoint(false,s);this.setQuestion();return;}
    s.index++;if(s.index%5===0){s.checkpoint=s.index;this.cb.checkpoint(true,s);}
    if(s.index>=this.questions.length){this.startFinal();return;}this.setQuestion();
  }
  startFinal(){const s=this.state;s.phase='final';s.current=null;s.finalJump=0;s.gauge=0;s.remaining=20;this.cb.final(s);this.save();}
  // Campaign: the collected commits become a pull request before the CI jumps.
  openPR(){const s=this.state;if(s.phase!=='final'||s.paused||!s.location||s.prOpened)return;s.prOpened=true;this.cb.final(s);this.save();}
  finalJump(){const s=this.state;if(s.phase!=='final'||s.paused||(s.location&&!s.prOpened))return;const zone=s.finalJump===0?.34:s.finalJump===1?.27:.20;const ok=Math.abs(s.gauge-.5)<zone/2;s.phase='finalAnimating';
    if(!ok){s.lives--;s.finalJump=0;}this.save();this.renderer.animate(0,!ok,()=>{if(ok){if(!this.finalEarned.has(s.finalJump)){this.finalEarned.add(s.finalJump);s.score+=50;s.coins+=5;this.cb.coins(5);}s.finalJump++;}else{s.finalJump=0;}
      this.cb.finalResult(ok,s);if(s.lives<=0)this.finish(false);else if(s.finalJump>=3)this.finish(true);else{s.phase='final';this.save();this.cb.hud(s);}});
  }
  pause(value){const s=this.state;if(['idle','finished'].includes(s.phase))return;s.paused=value;this.save();}
  finish(won){this.state.phase='finished';this.state.paused=false;this.cb.finish({won,state:this.state,accuracy:this.attempts?Math.round(this.correct/this.attempts*100):0,mistakes:this.mistakes,attempts:this.attempts});this.cb.persist(null);}
  save(){if(!this.questions)return;this.cb.persist({version:1,state:{...this.state,paused:true},questions:this.questions,earned:[...this.earned],finalEarned:[...this.finalEarned],mistakes:this.mistakes,correct:this.correct,attempts:this.attempts,streak:this.streak,options:this.options});}
  restore(data){
    if(data?.version!==1||!data.state||!Array.isArray(data.questions))return false;
    try {Parkour.Questions.validate(data.questions);const s=data.state;if(!['question','feedback','animating','final','finalAnimating'].includes(s.phase)||!Number.isInteger(s.index)||s.index<0||s.index>data.questions.length||!Number.isInteger(s.lives)||s.lives<0||s.lives>3||!Number.isFinite(s.score)||!Number.isFinite(s.coins)||!Number.isFinite(s.remaining)||!Number.isInteger(s.checkpoint)||s.checkpoint<0||s.checkpoint>s.index||!Array.isArray(data.earned)||!Array.isArray(data.finalEarned)||!Array.isArray(data.mistakes))return false;
      this.questions=data.questions;this.state={...s,paused:true};this.options=data.options;this.earned=new Set(data.earned);this.finalEarned=new Set(data.finalEarned);this.mistakes=data.mistakes;this.correct=Number(data.correct)||0;this.attempts=Number(data.attempts)||0;this.streak=Number(data.streak)||0;
      if(s.phase==='animating')this.state.phase='feedback';if(s.phase==='finalAnimating')this.state.phase='final';
      if(['final','finalAnimating'].includes(s.phase)){if(s.lives<=0){this.finish(false);return true;}this.cb.final(this.state);}else{if(!data.questions[s.index])return false;this.state.current=data.questions[s.index];this.cb.question(this.state);if(this.state.phase==='feedback'){this.cb.answer(!s.pendingWrong,s.selected,this.state);this.cb.feedback(!s.pendingWrong,s.selected,this.state);}}
      return true;
    }catch(e){console.warn('Could not restore run',e);return false;}
  }
  tick(now){const dt=this.last?Math.min((now-this.last)/1000,.1):0;this.last=now;const s=this.state;
    if(!s.paused){if(s.phase==='question'&&s.timer){s.remaining=Math.max(0,s.remaining-dt);if(s.remaining===0)this.answer(-1);}if(s.phase==='final'){s.gauge=(Math.sin(now/1000*(2.2+s.finalJump*.7))+1)/2;}this.cb.timer(s);}
    this.renderer.draw(dt,s,this.cb.skin(),this.cb.trail(),this.cb.t);requestAnimationFrame(this.tick);
  }
};

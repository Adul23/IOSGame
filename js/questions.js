/* Classic script modules keep index.html usable through file://. */
window.Parkour = window.Parkour || {};
Parkour.Questions = (() => {
  const MAX_BYTES = 2 * 1024 * 1024;
  function validate(data) {
    if (!Array.isArray(data) || !data.length || data.length > 500) throw Error('Expected 1–500 questions');
    const ids = new Set();
    for (const [i, q] of data.entries()) {
      const fail = () => { throw Error(`Question ${i + 1}: invalid fields, duplicate ID or unsafe source URL`); };
      if (!q || typeof q !== 'object') fail();
      if(Object.keys(q).some(k=>!['id','topic','difficulty','question','answers','correct','explanation','source'].includes(k)))fail();
      for (const key of ['id','topic','question','explanation','source']) if (typeof q[key] !== 'string' || !q[key].trim() || q[key].length > 4000) fail();
      if (ids.has(q.id) || ![1,2,3].includes(q.difficulty)) fail();
      ids.add(q.id);
      if (!Array.isArray(q.answers) || q.answers.length < 2 || q.answers.length > 4 || q.answers.some(a => typeof a !== 'string' || !a.trim() || a.length > 1000) || new Set(q.answers).size !== q.answers.length) fail();
      if (!Number.isInteger(q.correct) || q.correct < 0 || q.correct >= q.answers.length) fail();
      try { if (!['http:','https:'].includes(new URL(q.source).protocol)) fail(); } catch { fail(); }
    }
    return data;
  }
  function shuffle(items, random = Math.random) {
    const a = items.slice();
    for (let i=a.length-1;i>0;i--) { const j=Math.floor(random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; }
    return a;
  }
  async function builtin(lang) {
    if (location.protocol !== 'file:') {
      try { const r=await fetch(`questions/${lang}.json`); if (!r.ok) throw Error(r.status); return validate(await r.json()); } catch (e) { console.warn('Using bundled question data', e); }
    }
    return validate(ParkourData.questions[lang]);
  }
  function prepare(data, topic, length) {
    const filtered = topic==='mix' || topic==='custom' ? data : data.filter(q=>q.topic===topic);
    // Randomize within difficulty tiers so the course actually gets harder.
    const ordered = [1,2,3].flatMap(d=>shuffle(filtered.filter(q=>q.difficulty===d)));
    const n = length==='all' ? ordered.length : Math.min(Number(length), ordered.length);
    // Sample across all tiers, then sort to retain the difficulty ramp.
    const selected = shuffle(ordered).slice(0,n).sort((a,b)=>a.difficulty-b.difficulty);
    return selected.map((q,i)=> {
      const count = Math.min(q.answers.length, 2 + Math.floor(i / Math.max(1,Math.ceil(n/3))));
      const distractors = shuffle(q.answers.map((_,k)=>k).filter(k=>k!==q.correct)).slice(0,count-1);
      const indices = shuffle([q.correct,...distractors]);
      return {...q, answers:indices.map(k=>q.answers[k]), correct:indices.indexOf(q.correct)};
    });
  }
  function parse(text) {
    if (new TextEncoder().encode(text).length > MAX_BYTES) throw Error('Maximum size is 2 MB');
    return validate(JSON.parse(text));
  }
  async function fromURL(url) {
    const parsed=new URL(url); if(parsed.protocol!=='https:' || parsed.username || parsed.password) throw Error('Use an HTTPS URL without credentials');
    const controller=new AbortController(), timeout=setTimeout(()=>controller.abort(),10000);
    try {
      const r=await fetch(parsed.href,{signal:controller.signal,credentials:'omit',referrerPolicy:'no-referrer'});
      if(!r.ok) throw Error(`HTTP ${r.status}`);
      if(Number(r.headers.get('content-length'))>MAX_BYTES) throw Error('Maximum size is 2 MB');
      const reader=r.body.getReader(), decoder=new TextDecoder(); let bytes=0,text='';
      try { while(true) { const part=await reader.read(); if(part.done)break; bytes+=part.value.byteLength; if(bytes>MAX_BYTES)throw Error('Maximum size is 2 MB');text+=decoder.decode(part.value,{stream:true}); }text+=decoder.decode(); }
      catch(e){await reader.cancel();throw e;}
      return parse(text);
    } finally {clearTimeout(timeout);}
  }
  return {validate,shuffle,builtin,prepare,parse,fromURL};
})();

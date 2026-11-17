/* Campaign: a map of locations, each one a seminar with its own topics. */
window.Parkour = window.Parkour || {};
Parkour.Campaign = (() => {
  // Order is the story: basics → community → Git → DPG Registry.
  const locations = [
    {id:'island', topics:['history','licenses'], badge:'badgeIsland', glyph:'◒', ci:['ciLicense','ciHistory','ciReview']},
    {id:'village', topics:['culture','community'], badge:'badgeVillage', glyph:'⌂', ci:['ciCoc','ciContrib','ciReview']},
    {id:'mountain', topics:['git'], badge:'badgeMountain', glyph:'▲', ci:['ciLint','ciTests','ciReview']},
    {id:'city', topics:['dpg'], badge:'badgeCity', glyph:'▦', ci:['ciSdg','ciLicense','ciDoNoHarm']}
  ];
  const LENGTH = 8;
  function normalize(progress) {
    const p = progress && typeof progress === 'object' ? progress : {};
    const done = Array.isArray(p.done) ? locations.map(l=>l.id).filter(id=>p.done.includes(id)) : [];
    const n = k => Number.isFinite(p[k]) && p[k] >= 0 ? Math.floor(p[k]) : 0;
    return {done, commits:n('commits'), prs:n('prs')};
  }
  const byId = id => locations.find(l=>l.id===id) || null;
  // A location opens once every location before it is done.
  function status(progress, id) {
    const p = normalize(progress), i = locations.findIndex(l=>l.id===id);
    if (i < 0) return 'locked';
    if (p.done.includes(id)) return 'done';
    return locations.slice(0,i).every(l=>p.done.includes(l.id)) ? 'open' : 'locked';
  }
  function next(progress) { return locations.find(l=>status(progress,l.id)==='open') || null; }
  function complete(progress, id, commits) {
    const p = normalize(progress);
    if (status(p,id) === 'locked') return p;
    if (!p.done.includes(id)) p.done = locations.map(l=>l.id).filter(x=>x===id||p.done.includes(x));
    p.commits += Math.max(0, commits|0); p.prs += 1;
    return p;
  }
  function rank(progress) { const d = normalize(progress).done.length; return d === locations.length ? 'rankMaintainer' : d ? 'rankContributor' : 'rankNewcomer'; }
  // Stable short "hash" so a question always maps to the same commit id.
  function hash(text) { let h = 2166136261; for (const ch of String(text)) { h ^= ch.codePointAt(0); h = Math.imul(h, 16777619); } return (h >>> 0).toString(16).padStart(8,'0').slice(0,7); }
  function commitLog(questions, earned) {
    return questions.filter(q=>earned.has(q.id)).map(q=>({hash:hash(q.id), scope:q.topic, message:q.answers[q.correct]}));
  }
  return {locations, LENGTH, normalize, byId, status, next, complete, rank, hash, commitLog};
})();

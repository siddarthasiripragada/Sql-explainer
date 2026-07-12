(function(){
  'use strict';

  const CDN={
    d3:'https://cdn.jsdelivr.net/npm/d3@7.9.0/dist/d3.min.js',
    gsap:'https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/gsap.min.js',
    scroll:'https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/ScrollTrigger.min.js',
    rough:'https://cdn.jsdelivr.net/npm/roughjs@4.6.6/bundled/rough.js'
  };
  let libraryPromise=null;
  const renderVersion=new WeakMap();

  function loadScript(src,globalName){
    if(window[globalName])return Promise.resolve();
    return new Promise((resolve,reject)=>{
      const existing=document.querySelector(`script[data-pl-src="${src}"]`);
      if(existing){existing.addEventListener('load',resolve,{once:true});existing.addEventListener('error',reject,{once:true});return;}
      const script=document.createElement('script');script.src=src;script.async=true;script.dataset.plSrc=src;
      script.onload=resolve;script.onerror=()=>reject(new Error(`Could not load ${src}`));document.head.appendChild(script);
    });
  }
  function ensureLibraries(){
    if(libraryPromise)return libraryPromise;
    libraryPromise=Promise.all([loadScript(CDN.d3,'d3'),loadScript(CDN.rough,'rough'),loadScript(CDN.gsap,'gsap')])
      .then(()=>loadScript(CDN.scroll,'ScrollTrigger')).then(()=>{if(window.gsap&&window.ScrollTrigger)window.gsap.registerPlugin(window.ScrollTrigger);});
    return libraryPromise;
  }
  function esc(value){return String(value??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));}
  function fmt(value){if(value===null||value===undefined)return'NULL';if(typeof value==='number')return Number.isInteger(value)?String(value):value.toFixed(2);return String(value);}
  function nextVersion(visual){const version=(renderVersion.get(visual)||0)+1;renderVersion.set(visual,version);return version;}
  function isCurrent(visual,version){return renderVersion.get(visual)===version;}
  function destroyTriggers(visual){(visual._plTriggers||[]).forEach(t=>t.kill?.());visual._plTriggers=[];}

  function parseAccessQuery(sql){
    const table=sql.match(/\bFROM\s+([A-Za-z_]\w*)/i)?.[1];
    const where=sql.match(/\bWHERE\b\s+([\s\S]*?)(?=\bGROUP\s+BY\b|\bHAVING\b|\bORDER\s+BY\b|\bLIMIT\b|$)/i)?.[1]?.trim();
    const column=where?.match(/(?:[A-Za-z_]\w*\.)?([A-Za-z_]\w*)\s*(?:=|>=|<=|>|<|LIKE\b|IN\b)/i)?.[1];
    return{table,where,column};
  }
  function queryRows(bridge,sql){try{return bridge.exec(sql).rows}catch(_){return[]}}
  function makeIndexModel(sql,bridge){
    const parsed=parseAccessQuery(sql);if(!parsed.table||!parsed.where||!parsed.column)throw new Error('Choose a SELECT query with a simple WHERE filter.');
    const schema=bridge.schemaSnapshot(parsed.table).rows.map(r=>r.name);if(!schema.includes(parsed.column))throw new Error('The filter column was not found in the selected table.');
    const total=Number(queryRows(bridge,`SELECT COUNT(*) FROM ${parsed.table}`)[0]?.[0]||0);
    const matched=Number(queryRows(bridge,`SELECT COUNT(*) FROM ${parsed.table} WHERE ${parsed.where}`)[0]?.[0]||0);
    const returned=bridge.exec(sql).rows.length;
    const ordered=queryRows(bridge,`SELECT ${parsed.column}, rowid FROM ${parsed.table} WHERE ${parsed.column} IS NOT NULL ORDER BY ${parsed.column}`);
    const matchingIds=new Set(queryRows(bridge,`SELECT rowid FROM ${parsed.table} WHERE ${parsed.where}`).map(r=>Number(r[0])));
    const beforePlan=bridge.queryPlan(sql);let afterPlan=beforePlan;
    const selected=(sql.match(/^SELECT\s+([\s\S]*?)\s+FROM\b/i)?.[1]||'').split(',').map(s=>s.trim()).filter(s=>/^[A-Za-z_]\w*$/.test(s)&&schema.includes(s));
    const columns=[...new Set([parsed.column,...selected])],indexName=`__pl_${parsed.table}_${parsed.column}`;
    bridge.db.run('SAVEPOINT pl_card_catalog');
    try{bridge.db.run(`CREATE INDEX ${indexName} ON ${parsed.table}(${columns.join(',')})`);afterPlan=bridge.queryPlan(sql);}finally{bridge.db.run('ROLLBACK TO pl_card_catalog');bridge.db.run('RELEASE pl_card_catalog');}
    const chunk=Math.max(1,Math.ceil(ordered.length/4));
    const drawers=Array.from({length:4},(_,i)=>{
      const rows=ordered.slice(i*chunk,(i+1)*chunk);return{id:i,rows,label:rows.length?`${fmt(rows[0][0])}–${fmt(rows.at(-1)[0])}`:'empty',match:rows.some(r=>matchingIds.has(Number(r[1])))};
    }).filter(d=>d.rows.length);
    const selectedDrawer=Math.max(0,drawers.findIndex(d=>d.match));
    const scanRows=queryRows(bridge,`SELECT rowid, ${parsed.column} FROM ${parsed.table} LIMIT 24`).map(r=>({id:Number(r[0]),value:r[1],match:matchingIds.has(Number(r[0]))}));
    return{...parsed,sql,total,matched,returned,ordered,matchingIds,drawers,selectedDrawer,scanRows,beforePlan,afterPlan,indexUsed:/SEARCH|INDEX/i.test(afterPlan),rowsAvoided:Math.max(0,total-matched)};
  }

  function metric(label,value){return`<div class="pl-metric"><b>${esc(value)}</b><span>${esc(label)}</span></div>`;}
  function shellHead(eyebrow,title,anchor,badge){return`<div class="pl-module__head"><div><div class="pl-eyebrow">${esc(eyebrow)}</div><h3>${esc(title)}</h3><p class="pl-anchor">${esc(anchor)}</p></div><span class="pl-badge">${esc(badge)}</span></div>`;}
  function dataCard(model,title){return`<aside class="pl-data-card" aria-live="polite"><h4>${esc(title)}</h4><pre class="pl-sql">${esc(model.sql)}</pre><div class="pl-metrics">${metric('rows in table',model.total)}${metric('rows matched',model.matched)}${metric('rows returned',model.returned)}${metric('rows avoided',model.rowsAvoided)}</div><div class="pl-plan">${esc(model.afterPlan)}</div><div class="pl-detail-hint">Click a drawer to reveal the real plan ↗</div></aside>`;}
  function progress(count){return`<nav class="pl-progress" aria-label="Scene progress">${Array.from({length:count},(_,i)=>`<button data-pl-progress="${i}" aria-label="Go to scene ${i+1}"></button>`).join('')}</nav>`;}
  function tooltip(root){
    const tip=document.createElement('div');tip.className='pl-tooltip';document.body.appendChild(tip);root._plTooltip=tip;
    root.addEventListener('pointerover',e=>{const target=e.target.closest('[data-pl-tooltip]');if(!target)return;tip.textContent=target.dataset.plTooltip;tip.classList.add('pl-show');});
    root.addEventListener('pointermove',e=>{if(!tip.classList.contains('pl-show'))return;tip.style.left=`${Math.min(innerWidth-220,e.clientX+14)}px`;tip.style.top=`${Math.min(innerHeight-60,e.clientY+14)}px`;});
    root.addEventListener('pointerout',e=>{if(e.target.closest('[data-pl-tooltip]'))tip.classList.remove('pl-show');});
  }
  function drawRoughOutline(host){
    if(!window.rough||!host)return;const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.classList.add('pl-rough-layer');svg.setAttribute('viewBox',`0 0 ${host.clientWidth} ${host.clientHeight}`);host.appendChild(svg);
    const rc=window.rough.svg(svg),shape=rc.rectangle(5,5,Math.max(10,host.clientWidth-10),Math.max(10,host.clientHeight-10),{stroke:'#704b29',strokeWidth:1.3,roughness:1.5,bowing:1.2});svg.appendChild(shape);
  }
  function bindStepNavigation(visual,root,activate){
    destroyTriggers(visual);const steps=[...root.querySelectorAll('.pl-scroll-step')],dots=[...root.querySelectorAll('[data-pl-progress]')];
    let manualUntil=0;
    const go=(i,manual=false)=>{if(!manual&&Date.now()<manualUntil)return;if(manual)manualUntil=Date.now()+2000;activate(i);steps.forEach((s,n)=>s.classList.toggle('pl-active',n===i));dots.forEach((d,n)=>d.classList.toggle('pl-active',n===i));};
    steps.forEach((step,i)=>{step.addEventListener('click',()=>go(i,true));if(window.ScrollTrigger){visual._plTriggers.push(window.ScrollTrigger.create({trigger:step,start:'top 72%',end:'bottom 42%',onEnter:()=>go(i),onEnterBack:()=>go(i)}));}});
    dots.forEach((dot,i)=>dot.addEventListener('click',()=>{steps[i].scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'center'});go(i,true);}));
    go(0);
  }

  // Represents leaf-entry lookup after real, data-derived range narrowing.
  function buildIndex(visual,sql,bridge){
    const model=makeIndexModel(sql,bridge);destroyTriggers(visual);
    visual.innerHTML=`<section class="pl-lab pl-module" data-scene="0">${shellHead('LIBRARY EXAMPLE','The Card Catalog','Find one book without walking every aisle.','real SQLite plan')}${progress(3)}<div class="pl-scroll-shell"><div class="pl-sticky-stage"><div class="pl-stage-grid"><div class="pl-illustration"><span class="pl-scene-label">WITHOUT INDEX</span><div class="pl-library-wall"><div class="pl-aisle"><div class="pl-aisle__title">Every book must be checked</div><div class="pl-books"></div></div><div class="pl-cabinet-wrap"><div class="pl-cabinet"><div class="pl-drawer-grid"></div></div></div><i class="pl-path"></i></div></div>${dataCard(model,'Your query')}</div></div><div class="pl-steps"><button class="pl-scroll-step"><b>1 · No catalog</b><span>Check all ${model.total} books.</span></button><button class="pl-scroll-step"><b>2 · Open one drawer</b><span>Follow the matching range.</span></button><button class="pl-scroll-step"><b>3 · Flip one card</b><span>Read the shelf pointer.</span></button></div></div></section>`;
    const root=visual.querySelector('.pl-module'),books=window.d3.select(root).select('.pl-books').selectAll('.pl-book').data(model.scanRows).join('i').attr('class','pl-book').style('--h',(d,i)=>`${72+(i%6)*19}px`).style('--hm',(d,i)=>`${38+(i%5)*6}px`).attr('aria-label',d=>`Row ${d.id}, ${model.column} ${fmt(d.value)}`).text(d=>fmt(d.value));
    const drawers=window.d3.select(root).select('.pl-drawer-grid').selectAll('.pl-drawer').data(model.drawers).join('div').attr('class','pl-drawer pl-interactive').attr('role','button').attr('tabindex','0').attr('aria-label',d=>`Catalog drawer ${d.label}`).attr('data-pl-tooltip',d=>`Range ${d.label}. Click to open.`).html(d=>`${esc(d.label)}<div class="pl-cards">${d.rows.slice(0,5).map((r,i)=>`<i class="pl-card ${model.matchingIds.has(Number(r[1]))?'pl-match':''}" style="--fan:${(i-2)*5}deg">${esc(fmt(r[0]))}<br>#${r[1]}</i>`).join('')}</div>`);
    const sceneLabel=root.querySelector('.pl-scene-label'),dataPanel=root.querySelector('.pl-data-card');let selected=model.selectedDrawer;
    const openDrawer=(index,revealPlan=false)=>{selected=Math.max(0,index);root.querySelectorAll('.pl-drawer').forEach((d,i)=>d.classList.toggle('pl-open',i===selected));dataPanel.classList.toggle('pl-expanded',revealPlan);root.querySelector('.pl-detail-hint').textContent=revealPlan?`SEARCH via drawer ${model.drawers[selected].label}`:'One range opened. Flip a card for the plan.';};
    const activate=scene=>{root.dataset.scene=String(scene);root.querySelectorAll('.pl-book').forEach((b,i)=>{b.classList.toggle('pl-scanned',scene===0&&i<Math.min(model.total,model.scanRows.length));b.classList.toggle('pl-found',scene>0&&model.scanRows[i]?.match);});root.querySelectorAll('.pl-drawer').forEach(d=>d.classList.remove('pl-open'));root.querySelectorAll('.pl-card').forEach(c=>c.classList.remove('pl-flipped'));dataPanel.classList.toggle('pl-expanded',scene===2);sceneLabel.textContent=['WITHOUT INDEX','WITH B-TREE','REAL QUERY PLAN'][scene];if(scene>=1)openDrawer(selected,scene===2);if(scene===2){const card=root.querySelectorAll('.pl-drawer')[selected]?.querySelector('.pl-card.pl-match')||root.querySelectorAll('.pl-drawer')[selected]?.querySelector('.pl-card');card?.classList.add('pl-flipped');if(card&&window.gsap&&!matchMedia('(prefers-reduced-motion: reduce)').matches)window.gsap.fromTo(card,{y:0,rotateY:0},{y:-35,rotateY:180,duration:.65,ease:'back.out(1.4)'});}};
    drawers.each(function(_,i){const open=()=>{openDrawer(i);activate(2)};this.addEventListener('click',open);this.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();open();}});});
    tooltip(root);visual._plTooltip=root._plTooltip;drawRoughOutline(root.querySelector('.pl-cabinet'));bindStepNavigation(visual,root,activate);
  }

  function partitionSpecs(bridge){
    if(bridge.getDataset()==='bank')return[
      {name:'__pl_txn_morning',label:'09–11',where:"CAST(substr(txn_time,12,2) AS INTEGER) < 12"},
      {name:'__pl_txn_midday',label:'12–14',where:"CAST(substr(txn_time,12,2) AS INTEGER) BETWEEN 12 AND 14"},
      {name:'__pl_txn_afternoon',label:'15–16',where:"CAST(substr(txn_time,12,2) AS INTEGER) BETWEEN 15 AND 16"},
      {name:'__pl_txn_evening',label:'17–18',where:"CAST(substr(txn_time,12,2) AS INTEGER) >= 17"}
    ].map(p=>({...p,source:'bank_transactions'}));
    return[1,2,3,4].map(id=>({name:`__pl_orders_customer_${id}`,label:`customer ${id}`,where:`customer_id = ${id}`,source:'orders'}));
  }
  function makePartitionModel(bridge){
    const specs=partitionSpecs(bridge),parts=specs.map(spec=>{bridge.db.run(`DROP TABLE IF EXISTS ${spec.name}`);bridge.db.run(`CREATE TABLE ${spec.name} AS SELECT * FROM ${spec.source} WHERE ${spec.where}`);const count=Number(queryRows(bridge,`SELECT COUNT(*) FROM ${spec.name}`)[0]?.[0]||0);return{...spec,count,sql:`SELECT * FROM ${spec.name};`,plan:bridge.queryPlan(`SELECT * FROM ${spec.name}`)};});
    const total=parts.reduce((sum,p)=>sum+p.count,0),selected=Math.max(0,parts.findIndex(p=>p.count===Math.max(...parts.map(x=>x.count))));return{parts,total,selected};
  }
  function partitionDataCard(model,part){return`<aside class="pl-data-card" aria-live="polite"><h4>Archive query</h4><pre class="pl-sql">${esc(part.sql)}</pre><div class="pl-metrics">${metric('rows in all rooms',model.total)}${metric('rows opened',part.count)}${metric('rooms skipped',model.parts.length-1)}${metric('rooms opened',1)}</div><div class="pl-plan">${esc(part.plan)}</div><div class="pl-detail-hint">Click a door to run its real table query ↗</div><div class="pl-honesty">SQLite stand-in: each room is a real table. Warehouses prune native partitions.</div></aside>`;}

  // Represents partition pruning by querying only one real stand-in table.
  function buildPartition(visual,bridge){
    const model=makePartitionModel(bridge);destroyTriggers(visual);let selected=model.selected;
    visual.innerHTML=`<section class="pl-lab pl-module" data-scene="0">${shellHead('LIBRARY EXAMPLE','The Archive Wing','Open one room. Leave unrelated data sealed.','real table counts')}${progress(3)}<div class="pl-scroll-shell"><div class="pl-sticky-stage"><div class="pl-stage-grid"><div class="pl-illustration"><span class="pl-scene-label">ALL ROOMS</span><div class="pl-corridor"></div></div><div class="pl-panel-slot">${partitionDataCard(model,model.parts[selected])}</div></div></div><div class="pl-steps"><button class="pl-scroll-step"><b>1 · No pruning</b><span>Open all ${model.parts.length} rooms.</span></button><button class="pl-scroll-step"><b>2 · Read the door label</b><span>Lock unrelated rooms.</span></button><button class="pl-scroll-step"><b>3 · Open one room</b><span>Read ${model.parts[selected].count} real rows.</span></button></div></div></section>`;
    const root=visual.querySelector('.pl-module'),corridor=window.d3.select(root).select('.pl-corridor');
    const doors=corridor.selectAll('.pl-door').data(model.parts).join('div').attr('class','pl-door pl-interactive').attr('role','button').attr('tabindex','0').attr('aria-label',d=>`Archive room ${d.label}, ${d.count} rows`).attr('data-pl-tooltip',d=>`${d.count} real rows. Click to open.`).html(d=>`<b>${esc(d.label)}</b><div class="pl-room-rows">${Array.from({length:Math.min(d.count,12)},()=>'<i></i>').join('')}</div><span>${d.count} rows</span>`);
    const sceneLabel=root.querySelector('.pl-scene-label'),panelSlot=root.querySelector('.pl-panel-slot');
    const refreshPanel=()=>{panelSlot.innerHTML=partitionDataCard(model,model.parts[selected]);};
    const activate=scene=>{root.dataset.scene=String(scene);sceneLabel.textContent=['ALL ROOMS','PRUNE BY KEY','ONE ROOM OPEN'][scene];root.querySelectorAll('.pl-door').forEach((door,i)=>{door.classList.toggle('pl-locked',scene>=1&&i!==selected);door.classList.toggle('pl-open',scene===2&&i===selected);});panelSlot.querySelector('.pl-data-card')?.classList.toggle('pl-expanded',scene===2);if(scene>=1&&window.gsap&&!matchMedia('(prefers-reduced-motion: reduce)').matches)window.gsap.fromTo([...root.querySelectorAll('.pl-door.pl-locked')],{opacity:1},{opacity:.32,duration:.32,stagger:.08});};
    doors.each(function(_,i){const open=()=>{selected=i;refreshPanel();activate(2)};this.addEventListener('click',open);this.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();open();}});});
    tooltip(root);visual._plTooltip=root._plTooltip;drawRoughOutline(root.querySelector('.pl-corridor'));bindStepNavigation(visual,root,activate);
  }

  function render(kind,{visual,sql,bridge}){
    const version=nextVersion(visual);destroyTriggers(visual);visual._plTooltip?.remove();visual.innerHTML='<div class="pl-loading">Opening the library…</div>';
    ensureLibraries().then(()=>{if(!isCurrent(visual,version))return;if(kind==='index')buildIndex(visual,sql,bridge);else buildPartition(visual,bridge);}).catch(error=>{if(isCurrent(visual,version))visual.innerHTML=`<div class="pl-loading">${esc(error.message)}</div>`;});
  }
  window.PerformanceLibraryLab={renderIndex:options=>render('index',options),renderPartition:options=>render('partition',options),destroy:visual=>{nextVersion(visual);destroyTriggers(visual);visual._plTooltip?.remove();}};
})();

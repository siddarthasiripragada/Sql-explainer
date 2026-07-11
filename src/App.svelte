<script>
 import {onMount} from 'svelte';
 import initSqlJs from 'sql.js';
 const examples={
  'Plain SELECT':'SELECT id, account_holder, amount FROM bank_transactions',
  'WHERE':'SELECT account_holder, amount, status FROM bank_transactions WHERE amount > 1000',
  'JOIN':'SELECT t.account_holder, t.amount, b.city FROM bank_transactions t JOIN branches b ON t.branch = b.code',
  'GROUP + aggregate':'SELECT branch, COUNT(*) AS transactions, ROUND(AVG(amount),2) AS avg_amount FROM bank_transactions GROUP BY branch',
  'HAVING':'SELECT branch, SUM(amount) AS total FROM bank_transactions GROUP BY branch HAVING SUM(amount) > 3000',
  'DISTINCT':'SELECT DISTINCT status FROM bank_transactions',
  'ORDER + LIMIT':'SELECT account_holder, amount FROM bank_transactions ORDER BY amount DESC LIMIT 5',
  'Subquery':'SELECT account_holder, amount FROM bank_transactions WHERE amount > (SELECT AVG(amount) FROM bank_transactions)',
  'All clauses':'SELECT t.branch, b.city, COUNT(*) AS count, SUM(t.amount) AS total FROM bank_transactions t JOIN branches b ON t.branch=b.code WHERE t.status != \'declined\' GROUP BY t.branch, b.city HAVING SUM(t.amount)>1000 ORDER BY total DESC LIMIT 3'
 };
 let query=examples['WHERE'], db, loading=true, error='', warning='', stages=[], active=99, playing=false, speed=700, timer;
 const tx=[[1,'Ava Patel',4500,'flagged','TOR','2026-07-01'],[2,'Noah Chen',120,'normal','VAN','2026-07-02'],[3,'Mia Singh',1800,'normal','TOR','2026-07-03'],[4,'Liam Smith',75,'declined','NYC','2026-07-04'],[5,'Emma Garcia',2600,'flagged','VAN','2026-07-05'],[6,'Owen Brown',null,'normal','TOR','2026-07-06'],[7,'Sophia Martin',950,'normal','NYC','2026-07-07'],[8,'Lucas Wilson',3200,'normal','TOR','2026-07-08'],[9,'Isla Taylor',120,'normal',null,'2026-07-09'],[10,'Ethan Moore',7100,'flagged','VAN','2026-07-10']];
 onMount(async()=>{const SQL=await initSqlJs({locateFile:f=>`https://sql.js.org/dist/${f}`}); db=new SQL.Database(); seed(); loading=false; run(); const u=new URL(location); if(u.searchParams.get('q')) query=u.searchParams.get('q'); run();});
 function seed(){db.run('CREATE TABLE bank_transactions(id INTEGER, account_holder TEXT, amount REAL, status TEXT, branch TEXT, timestamp TEXT); CREATE TABLE branches(code TEXT, city TEXT, manager TEXT);'); const s=db.prepare('INSERT INTO bank_transactions VALUES (?,?,?,?,?,?)'); tx.forEach(r=>s.run(r));s.free();db.run("INSERT INTO branches VALUES ('TOR','Toronto','Jordan Lee'),('VAN','Vancouver','Casey Roy'),('NYC','New York','Alex Kim')");}
 function rows(sql){const r=db.exec(sql)[0]; return r? r.values.map(v=>Object.fromEntries(r.columns.map((c,i)=>[c,v[i]]))):[]}
 function clean(q){return q.replace(/--.*$/gm,'').replace(/\/\*[\s\S]*?\*\//g,'').trim()}
 let debounce; function changed(){clearTimeout(debounce);debounce=setTimeout(run,400)}
 function run(){if(!db)return; error='';warning=''; try{let q=clean(query); const parts=q.split(';').filter(Boolean); if(parts.length>1)warning='Only the first SQL statement is visualized.';q=parts[0]||''; if(!/^select\b/i.test(q))throw Error('Only SELECT queries are supported.'); if(/\b(WITH|UNION|OVER\s*\()/i.test(q))throw Error("This construct isn't visualized yet."); const names=['FROM','JOIN','WHERE','GROUP BY','HAVING','SELECT','DISTINCT','ORDER BY','LIMIT']; const present=names.filter(n=> n==='SELECT'||new RegExp('\\b'+n.replace(' ','\\s+')+'\\b','i').test(q)); const result=rows(q); stages=present.map((name,i)=>({name,rows:i===present.length-1?result:preview(q,name,result),color:color(name)})); stages=[...stages,{name:'RESULT',rows:result,color:'#8bf0c9'}]; active=stages.length-1; history.replaceState({},'',`?q=${encodeURIComponent(query)}`)}catch(e){error=e.message;stages=[]}}
 function preview(q,name,fallback){try{const from=q.match(/\bFROM\b[\s\S]*/i)?.[0]; if(!from)return fallback; if(name==='FROM'){const t=from.match(/^FROM\s+([\w]+)/i)?.[1];return rows(`SELECT * FROM ${t}`)} if(name==='JOIN'){const end=from.search(/\b(WHERE|GROUP BY|HAVING|ORDER BY|LIMIT)\b/i);return rows('SELECT * '+(end<0?from:from.slice(0,end)))} if(name==='WHERE'){const end=q.search(/\b(GROUP BY|HAVING|ORDER BY|LIMIT)\b/i);return rows('SELECT * '+q.slice(q.search(/\bFROM\b/i),end<0?q.length:end))}}catch{} return fallback}
 const color=n=>({'FROM':'#7c9cff','JOIN':'#c28cff','WHERE':'#ff718d','GROUP BY':'#ffb45e','HAVING':'#f58bd4','SELECT':'#52d7c7','DISTINCT':'#8bd46e','ORDER BY':'#f6d365','LIMIT':'#5eb6ff'}[n]||'#8bf0c9');
 function play(){playing=!playing;clearInterval(timer);if(playing){active=-1;timer=setInterval(()=>{active++;if(active>=stages.length-1){playing=false;clearInterval(timer)}},speed)}}
 function step(n){playing=false;clearInterval(timer);active=Math.max(-1,Math.min(stages.length-1,active+n))}
 const val=v=>v===null?'NULL':String(v);
</script>
<svelte:head><title>SQL Query Explainer</title><meta name="description" content="See how SQL executes, one clause at a time."/></svelte:head>
<header><nav><span class="logo">SQL<span>FLOW</span></span><a href="#learn">How SQL executes ↓</a></nav><div class="hero"><p class="eyebrow">AN INTERACTIVE SQL VISUALIZER</p><h1>See what your query<br><em>actually</em> does.</h1><p>Type SQL. Watch rows move through the real execution pipeline.</p></div></header>
<main>
 <section class="lab" aria-label="Interactive SQL query explainer">
  <div class="examples">{#each Object.entries(examples) as [k,v]}<button on:click={()=>{query=v;run()}}>{k}</button>{/each}</div>
  <div class="editor"><div class="dots">● ● ●</div><textarea bind:value={query} on:input={changed} spellcheck="false" aria-label="SQL query"></textarea><button class="copy" on:click={()=>navigator.clipboard.writeText(query)}>Copy</button></div>
  {#if loading}<div class="loading"><i></i> Initializing SQLite engine…</div>{:else if error}<div class="error"><b>SQLite couldn’t run this query</b><span>{error}</span></div>{/if}
  {#if warning}<div class="warning">{warning}</div>{/if}
  {#if stages.length}
   <div class="legend"><span>● current</span><span class="pass">● passed</span><span class="fail">● filtered / excluded</span></div>
   <div class="pipeline">
    {#each stages as s,i}<article class:dim={i>active} style={`--accent:${s.color}`} tabindex="0"><div class="stagehead"><b>{s.name}</b><small>{s.rows.length} row{s.rows.length!==1?'s':''}</small></div><div class="rows">{#each s.rows.slice(0,6) as r}<div class="row" title={JSON.stringify(r)}>{#each Object.entries(r).slice(0,3) as [k,v]}<span><small>{k}</small><strong class:null={v===null}>{val(v)}</strong></span>{/each}</div>{/each}{#if s.rows.length===0}<div class="empty">0 rows — pipeline ends here</div>{:else if s.rows.length>6}<div class="more">+{s.rows.length-6} more rows</div>{/if}</div></article>{#if i<stages.length-1}<div class:dim={i>=active} class="arrow">→</div>{/if}{/each}
   </div>
   <div class="controls"><button on:click={()=>step(-1)}>← Step</button><button class="primary" on:click={play}>{playing?'Pause':'Play'}</button><button on:click={()=>step(1)}>Step →</button><label>Speed <input type="range" min="200" max="1600" step="100" bind:value={speed}></label><span>{Math.max(0,active+1)} / {stages.length}</span></div>
  {/if}
 </section>
 <section id="learn" class="article"><p class="eyebrow">THE MENTAL MODEL</p><h2>SQL isn’t executed<br>in the order you write it.</h2><p class="lede">You write <code>SELECT</code> first, but the database begins at <code>FROM</code>. It builds a working set, transforms it clause by clause, and only then returns the result.</p>
  <div class="order"><span>WRITTEN</span><b>SELECT → FROM → WHERE → GROUP BY → ORDER BY</b><span>EXECUTED</span><b>FROM → WHERE → GROUP BY → SELECT → ORDER BY</b></div>
  {#each [['FROM','Find the data','The engine opens the source table and establishes the initial working set.'],['JOIN','Combine related tables','JOIN matches rows using the ON condition, expanding each row with fields from another table.'],['WHERE','Filter individual rows','Each row is tested. TRUE continues; FALSE and NULL are discarded.'],['GROUP BY','Form buckets','Rows sharing group keys become a single group so aggregate functions can summarize them.'],['HAVING','Filter groups','HAVING runs after grouping and can test aggregate values such as SUM(amount).'],['SELECT','Shape the output','Only requested expressions and aliases survive into the output.'],['DISTINCT','Remove duplicates','Identical projected rows collapse into one.'],['ORDER BY','Sort the result','Rows are arranged ascending or descending after projection.'],['LIMIT / OFFSET','Take a window','OFFSET skips rows and LIMIT caps how many remain.']] as x,i}<article class="lesson"><span>{String(i+1).padStart(2,'0')}</span><div><h3>{x[0]} <small>{x[1]}</small></h3><p>{x[2]}</p></div></article>{/each}
 </section>
</main>
<footer><b>Built with sql.js + Svelte + Vite</b><span>SQLite runs entirely in your browser. No query leaves your device.</span></footer>

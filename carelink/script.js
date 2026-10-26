// ---------- Data layer (localStorage with safe fallback) ----------
const KEY = "carelink-v1";
const seed = () => ({
  patients: [
    {id:"p1", name:"Asha Rao", age:54, cond:"Hypertension"},
    {id:"p2", name:"Imran Sheikh", age:67, cond:"Type 2 diabetes"},
    {id:"p3", name:"Meera Nair", age:41, cond:"Asthma"}
  ],
  vitals: {
    p1:[{d:"2026-10-22",hr:78,sys:138,dia:88,spo2:97,temp:36.7},{d:"2026-10-23",hr:82,sys:146,dia:92,spo2:97,temp:36.8},{d:"2026-10-24",hr:80,sys:142,dia:90,spo2:98,temp:36.6},{d:"2026-10-25",hr:88,sys:156,dia:98,spo2:96,temp:36.9}],
    p2:[{d:"2026-10-24",hr:74,sys:128,dia:82,spo2:98,temp:36.6},{d:"2026-10-25",hr:76,sys:130,dia:84,spo2:97,temp:36.7}],
    p3:[{d:"2026-10-25",hr:92,sys:118,dia:76,spo2:93,temp:37.1}]
  },
  appts: [{id:1,pid:"p1",date:"2026-10-29",time:"10:30",reason:"BP review",status:"Confirmed"}],
  msgs: [{pid:"p1",from:"doctor",text:"Please log your blood pressure every morning this week.",t:"2026-10-24 09:00"}]
});
let db;
try { db = JSON.parse(localStorage.getItem(KEY)) || seed(); } catch(e) { db = seed(); }
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch(e) {} };

// ---------- State ----------
let role = "patient", pid = "p1", tab = "overview";
const esc = s => String(s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const $ = s => document.querySelector(s);
const pat = id => db.patients.find(p => p.id === id);
const nowStr = () => new Date().toISOString().slice(0,16).replace("T"," ");

// Alert rules – flag readings outside safe ranges
function flags(v){
  const f = [];
  if (v.sys >= 140 || v.dia >= 90) f.push("High blood pressure");
  if (v.spo2 < 94) f.push("Low oxygen");
  if (v.hr > 100 || v.hr < 50) f.push("Abnormal heart rate");
  if (v.temp >= 38) f.push("Fever");
  return f;
}
const latest = id => (db.vitals[id] || []).slice(-1)[0];

// ---------- Rendering ----------
function chrome(){
  $("#who").style.display = role === "doctor" ? "" : "none";
  $("#who").innerHTML = db.patients.map(p => `<option value="${p.id}" ${p.id===pid?"selected":""}>${esc(p.name)}</option>`).join("");
  document.querySelectorAll("[data-role]").forEach(b => b.setAttribute("aria-pressed", b.dataset.role === role));
  const tabs = [["overview","Overview"],["vitals","Vitals"],["appts","Appointments"],["msgs","Messages"]];
  if (role === "doctor") tabs.unshift(["alerts","Alerts"]);
  if (!tabs.some(t => t[0] === tab)) tab = tabs[0][0];
  $("#tabs").innerHTML = tabs.map(([k,l]) => `<button role="tab" data-tab="${k}" aria-selected="${k===tab}">${l}</button>`).join("");
}

function chart(data, key, lo, hi, label){
  if (data.length < 2) return `<p class="mute">Log at least two readings to see a trend.</p>`;
  const W=300,H=110,pad=24, vals=data.map(d=>d[key]);
  const min=Math.min(...vals,lo)-2, max=Math.max(...vals,hi)+2;
  const x=i=>pad+i*(W-pad*2)/(data.length-1), y=v=>H-pad-(v-min)*(H-pad*2)/(max-min);
  const pts=data.map((d,i)=>`${x(i)},${y(d[key])}`).join(" ");
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="${label} trend">
    <rect x="${pad}" y="${y(hi)}" width="${W-pad*2}" height="${y(lo)-y(hi)}" fill="var(--ok-bg)"/>
    <polyline points="${pts}" fill="none" stroke="var(--brand)" stroke-width="2.5"/>
    ${data.map((d,i)=>`<circle cx="${x(i)}" cy="${y(d[key])}" r="4" fill="${d[key]>hi||d[key]<lo?"var(--alert)":"var(--brand)"}"/>`).join("")}
    <text x="${pad}" y="12">${label} (green = normal range)</text></svg>`;
}

const views = {
  overview(){
    const p = pat(pid), v = latest(pid), f = v ? flags(v) : [];
    const next = db.appts.filter(a => a.pid === pid).sort((a,b)=>a.date.localeCompare(b.date))[0];
    return `<h2>${esc(p.name)}</h2><p class="mute">${p.age} years · ${esc(p.cond)}</p>
    <div class="grid" style="margin-top:14px">
      <div class="panel"><h3>Latest reading</h3>${v ? `<div class="big">${v.sys}/${v.dia}</div><div class="mute">mmHg on ${v.d}</div>
        <p>Heart rate ${v.hr} bpm · SpO₂ ${v.spo2}% · ${v.temp} °C</p>
        ${f.length ? f.map(x=>`<span class="tag bad">${x}</span>`).join(" ") : `<span class="tag ok">All within range</span>`}` : `<p class="mute">No readings yet. Add one in Vitals.</p>`}</div>
      <div class="panel"><h3>Next appointment</h3>${next ? `<div class="big">${next.date}</div><div class="mute">${next.time} · ${esc(next.reason)}</div><p><span class="tag ${next.status==="Confirmed"?"ok":"wait"}">${next.status}</span></p>` : `<p class="mute">Nothing booked. Book one in Appointments.</p>`}</div>
    </div>`;
  },
  vitals(){
    const data = db.vitals[pid] || [];
    const rows = [...data].reverse().map(v => `<tr><td>${v.d}</td><td class="${v.sys>=140||v.dia>=90?"hi":""}">${v.sys}/${v.dia}</td><td class="${v.hr>100||v.hr<50?"hi":""}">${v.hr}</td><td class="${v.spo2<94?"hi":""}">${v.spo2}%</td><td class="${v.temp>=38?"hi":""}">${v.temp}</td></tr>`).join("");
    return `<div class="grid">
      <div class="panel"><h3>Log a reading</h3><form id="vform">
        <div class="row"><div><label for="sys">Systolic</label><input id="sys" type="number" required min="60" max="260"></div><div><label for="dia">Diastolic</label><input id="dia" type="number" required min="40" max="160"></div></div>
        <div class="row"><div><label for="hr">Heart rate</label><input id="hr" type="number" required min="30" max="220"></div><div><label for="spo2">SpO₂ %</label><input id="spo2" type="number" required min="70" max="100"></div><div><label for="temp">Temp °C</label><input id="temp" type="number" step="0.1" required min="34" max="42"></div></div>
        <button class="btn">Save reading</button></form></div>
      <div class="panel"><h3>Trends</h3>${chart(data,"sys",90,139,"Systolic BP")}${chart(data,"spo2",94,100,"SpO₂")}</div>
    </div>
    <div class="panel scroll" style="margin-top:16px"><h3>History</h3><table><tr><th>Date</th><th>BP</th><th>HR</th><th>SpO₂</th><th>Temp</th></tr>${rows || `<tr><td colspan="5" class="mute">No readings yet.</td></tr>`}</table></div>`;
  },
  appts(){
    const list = db.appts.filter(a => role === "doctor" || a.pid === pid).sort((a,b)=>a.date.localeCompare(b.date));
    return `<div class="grid">
      ${role==="patient" ? `<div class="panel"><h3>Book an appointment</h3><form id="aform">
        <label for="adate">Date</label><input id="adate" type="date" required>
        <label for="atime">Time</label><input id="atime" type="time" required>
        <label for="areason">Reason</label><input id="areason" required maxlength="80">
        <button class="btn">Request appointment</button></form></div>` : ""}
      <div class="panel" style="grid-column:1/-1"><h3>${role==="doctor"?"All appointments":"Your appointments"}</h3>
      <ul class="list">${list.map(a => `<li><span><strong>${a.date} ${a.time}</strong> · ${esc(pat(a.pid).name)}<br><span class="mute">${esc(a.reason)}</span></span>
        <span><span class="tag ${a.status==="Confirmed"?"ok":"wait"}">${a.status}</span>
        ${role==="doctor" && a.status!=="Confirmed" ? `<button class="btn ghost" data-confirm="${a.id}">Confirm</button>`:""}</span></li>`).join("") || `<li class="mute">No appointments yet.</li>`}</ul></div></div>`;
  },
  msgs(){
    const m = db.msgs.filter(x => x.pid === pid);
    return `<div class="panel"><h3>Conversation with ${role==="doctor"?esc(pat(pid).name):"your care team"}</h3>
      <div class="chat" id="chat">${m.map(x=>`<div class="msg ${x.from===role?"me":""}"><small>${x.from==="doctor"?"Doctor":"Patient"} · ${x.t}</small>${esc(x.text)}</div>`).join("") || `<p class="mute">No messages yet. Say hello below.</p>`}</div>
      <form id="mform" style="display:flex;gap:8px;margin-top:10px"><input id="mtext" required maxlength="400" aria-label="Message" placeholder="Write a message"><button class="btn" style="margin:0">Send message</button></form></div>`;
  },
  alerts(){
    const items = db.patients.map(p => ({p, v:latest(p.id)})).filter(x => x.v && flags(x.v).length);
    return `<div class="panel"><h3>Patients needing attention</h3><ul class="list">${items.map(({p,v})=>`<li><span><strong>${esc(p.name)}</strong> · ${esc(p.cond)}<br><span class="mute">${v.d} · BP ${v.sys}/${v.dia}, HR ${v.hr}, SpO₂ ${v.spo2}%</span></span>
      <span>${flags(v).map(x=>`<span class="tag bad">${x}</span>`).join(" ")} <button class="btn ghost" data-open="${p.id}">Open</button></span></li>`).join("") || `<li class="mute">No alerts. All latest readings are within range.</li>`}</ul></div>`;
  }
};

function render(){
  chrome();
  $("#view").innerHTML = views[tab]();
  const c = $("#chat"); if (c) c.scrollTop = c.scrollHeight;
}

// ---------- Events ----------
document.addEventListener("click", e => {
  const t = e.target.closest("button"); if (!t) return;
  if (t.dataset.role){ role = t.dataset.role; if (role==="patient") pid="p1"; tab = role==="doctor"?"alerts":"overview"; render(); }
  else if (t.dataset.tab){ tab = t.dataset.tab; render(); }
  else if (t.dataset.confirm){ db.appts.find(a=>a.id==t.dataset.confirm).status="Confirmed"; save(); render(); }
  else if (t.dataset.open){ pid = t.dataset.open; tab="overview"; render(); }
});
$("#who").addEventListener("change", e => { pid = e.target.value; render(); });
document.addEventListener("submit", e => {
  e.preventDefault();
  const g = id => document.getElementById(id).value;
  if (e.target.id === "vform"){
    (db.vitals[pid] = db.vitals[pid] || []).push({d:new Date().toISOString().slice(0,10),sys:+g("sys"),dia:+g("dia"),hr:+g("hr"),spo2:+g("spo2"),temp:+g("temp")});
  } else if (e.target.id === "aform"){
    db.appts.push({id:Date.now(),pid,date:g("adate"),time:g("atime"),reason:g("areason"),status:"Requested"});
  } else if (e.target.id === "mform"){
    db.msgs.push({pid,from:role,text:g("mtext"),t:nowStr()});
  }
  save(); render();
});
render();

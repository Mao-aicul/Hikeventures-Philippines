/* ===== helpers ===== */
const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
const peso=n=>"₱"+n.toLocaleString();
const today=new Date(Date.now()-new Date().getTimezoneOffset()*6e4).toISOString().slice(0,10);
let P="home";
const R={}; // page renderers: route() runs the one for the current page
let STATE={user:null,craters:[],hikes:[],bookings:[]};
const me=()=>STATE.user,books=()=>STATE.bookings;
const api=async(path,options={})=>{
 const response=await fetch(path,{credentials:"same-origin",...options,headers:{"Content-Type":"application/json",...(options.headers||{})}});
 const result=await response.json().catch(()=>({}));
 if(!response.ok)throw new Error(result.error||`Request failed (${response.status}).`);
 return result;
};
const refreshState=async()=>{STATE=await api("/api/state");return STATE};
const escapeHtml=value=>String(value??"").replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));

/* ===== icons for the hike card (icons8, white) ===== */
const icon=id=>`https://img.icons8.com/?size=100&id=${id}&format=png&color=FFFFFF`;
const ICON={date:icon(23),price:icon(119),days:icon(16153),level:icon(25055),slots:icon(85057)};
const ic=(k,emoji)=>`<img class="ic" src="${ICON[k]}" alt="" onerror="this.replaceWith('${emoji}')">`;

/* ===== backend-provided state ===== */
const craters=()=>STATE.craters,listedCraters=()=>craters(),crater=id=>craters().find(c=>c.id==id);
// Mountain photos live in the asset folder as PNG files.
const EXT=".png";
const MT={"Mt. Apo":"mt_apo","Mt. Pulag":"mt_pulag","Mt. Guiting Guiting":"mt_g2","Mt. Sembrano":"mt_sembrano","Mt. Batulao":"mt_batulao","Mt. Pico De Loro":"mt_picoDeLoro","Mt. Pinatubo":"mt_pinatubo"};
const img=n=>MT[n]?"asset/"+MT[n]+EXT:""; // mountains without a photo use the plain green background
const bg=h=>h.img?`style="background-image:url(${h.img})"`:"";
const DEFAULT_DETAILS={
 "Mt. Apo":{included:["Roundtrip transportation","Tourism permit fee","Environmental fee","Accredited guide fee","Climb certificate","5 hosted meals","Personalized bag tag"],excluded:["Personal expenses","Personal travel insurance"]},
 "Mt. Pulag":{included:["Van transport","Registration fee (DENR)","Climbing certificate","3 meals (dinner, breakfast, lunch)","Local tour guide","Entrance fee","Environmental and cultural heritage fee","Personalized bag tag"],excluded:["Personal expenses","Personal hiking gear rental"]},
 "Mt. Guiting Guiting":{included:["Guide fee","Porter fee (food and logistics)","DENR registration fee","Tourism registration fee","Climb certificate","All transportation within Sibuyan","8 hosted meals","Free homestay"],excluded:["Personal porter","Ferry fare"]},
 "Mt. Batulao":{included:["Roundtrip transfer","Expert guides","Registration and environmental fees"],excluded:["Meals","Shower fee","Other personal expenses"]},
 "Mt. Pico De Loro":{included:["Roundtrip van transfer","Parking fee","Registration fee","DENR fee","Guide fee","Trail snacks","Personalized bag tag"],excluded:["Personal expenses","Meals","Personal hiking gear"]},
 "Mt. Pinatubo":{included:["4x4 ride adventure","Tourism and environmental fees","Local tour guide","Entrance fee","Capas tourism permit","Aeta community fee","Coordinator assistance","Basic first aid kit","Free breakfast","Personalized bag tag","Climb certificate"],excluded:["Solo drone shots/videos (optional ₱150)","Lunch (optional ₱250)","Other personal expenses"]},
 "Mt. Sembrano":{included:["Solo and group drone shots","High-roof van transfers","Registration fee","Environmental fee","Guide fee"],excluded:["Meals","Shower fee","Other personal expenses"]}
};
const hikes=()=>STATE.hikes,up=()=>hikes().filter(h=>h.d>=today);

/* ===== small functions ===== */
const hike=id=>hikes().find(h=>h.id==id);
const optionalExtras=h=>(h.excluded||[]).flatMap(item=>{const match=item.match(/^(.*?)\s*\(optional\s*₱\s*([\d,]+)\s*\)$/i);if(!match)return[];const name=match[1].trim(),price=Number(match[2].replaceAll(",",""));return name&&Number.isSafeInteger(price)&&price>0?[{name,price}]:[]});
const lastHikeDay=h=>{const date=new Date(`${h.d}T00:00:00Z`);date.setUTCDate(date.getUTCDate()+h.days-1);return date.toISOString().slice(0,10)};
const hikeCompleted=h=>lastHikeDay(h)<today;
const lvl=h=>h.lv<4?"Beginner":h.lv<7?"Intermediate":"Expert";
const left=h=>h.slots-(h.booked||0);
const fmt=h=>{const a=new Date(h.d+"T00:00"),b=new Date(a.getTime()+(h.days-1)*864e5),m=x=>x.toLocaleString("en",{month:"long"});return m(a)+" "+a.getDate()+(h.days>1?" - "+(m(b)==m(a)?"":m(b)+" ")+b.getDate():"")+", "+a.getFullYear()};
const dur=h=>h.days+" day"+(h.days>1?"s":"")+(h.tr?" · "+h.tr:"");
// star rating = seed ratings + ratings given by users
const avg=c=>c.r[1]?[c.r[0]/c.r[1],c.r[1]]:[0,0];
const stars=c=>{const[a,n]=avg(c);return n?`<span class="stars" style="--p:${a/5*100}%">★★★★★</span> <small>${a.toFixed(1)} (${n})</small>`:"<small>New</small>"};

/* ===== cards ===== */
const card=h=>`<article class="hike" ${bg(h)}><div class="shade"><h3>${escapeHtml(h.n)}</h3><p class="tag">${escapeHtml(h.t)}</p><ul><li>${ic("date","📅")} ${fmt(h)}</li><li>${ic("price","🏷")} ${peso(h.p)}</li><li>${ic("days","🕒")} ${escapeHtml(dur(h))}</li><li>${ic("level","⛰")} ${lvl(h)} (${h.lv}/9)</li><li>${ic("slots","👥")} ${left(h)} slots left</li></ul><div class="btns"><button class="ghost" data-more="${h.id}">Learn More</button><button class="red" data-book="${h.id}">Book Now</button></div></div></article>`;
const cc=c=>{const n=up().filter(h=>h.c==c.id).length;return `<article class="crater"><div class="top"><img src="img/crater-${c.id}.png" alt="" onerror="this.remove()"><span>${escapeHtml(c.name)}<small class="n">${n} hike${n==1?"":"s"}</small></span></div><div class="bar">${stars(c)}<a class="visit" href="#crater?id=${c.id}">VISIT</a></div></article>`};

/* ===== slider: dots = number of slides, max 5. Arrows only show when there is more to scroll ===== */
function fill(box,items,cls,empty){
 const chev=p=>`<svg viewBox="0 0 24 24"><path d="${p}"/></svg>`;
 box.innerHTML=`<button class="arrow prev" aria-label="Previous">${chev("M15.5 5l-7 7 7 7")}</button><div class="track ${cls}">${items.join("")||`<p class="empty">${empty}</p>`}</div><button class="arrow next" aria-label="Next">${chev("M8.5 5l7 7-7 7")}</button><div class="dots"></div>`;
 const t=$(".track",box),d=$(".dots",box),pv=$(".prev",box),nx=$(".next",box);
 const pages=()=>Math.max(1,Math.round(t.scrollWidth/(t.clientWidth||1))),step=()=>t.scrollWidth/pages();
 const draw=()=>{const p=pages(),n=Math.min(p,5),cur=Math.min(p-1,Math.round(t.scrollLeft/step())),on=p>1?Math.round(cur/(p-1)*(n-1)):0;d.innerHTML=Array.from({length:n},(_,i)=>`<i data-i="${i}" class="${i==on?"on":""}"></i>`).join("");
  pv.hidden=t.scrollLeft<4;nx.hidden=t.scrollLeft+t.clientWidth>=t.scrollWidth-4};
 pv.onclick=()=>t.scrollBy({left:-t.clientWidth,behavior:"smooth"});
 nx.onclick=()=>t.scrollBy({left:t.clientWidth,behavior:"smooth"});
 d.onclick=e=>{const i=e.target.dataset.i;if(i===undefined)return;const p=pages(),n=Math.min(p,5);t.scrollTo({left:Math.round(i/Math.max(1,n-1)*(p-1))*step(),behavior:"smooth"})};
 t.onscroll=draw;box._d=draw;draw();
}
addEventListener("resize",()=>$$(".slider").forEach(b=>b._d&&b._d()));

/* ===== single-page navigation ===== */
const renderNav=()=>{$("#nav").innerHTML=`<a class="logo" href="#home"><img src="asset/logo.png" alt="" onerror="this.remove()"><span>Hikeventures<br>Philippines</span></a><nav>${[["home","Home"],["mountain","Mountain"],["crater","Crater Tourist"],["booking","My Booking"]].map(([page,label])=>`<a href="#${page}" class="${P==page?"on":""}">${label}</a>`).join("")}</nav><a class="btn" href="#${me()?"account":"login"}">${me()?"My Account":"Sign-in/Login"}</a>`};
let routeId=0;
const route=async()=>{
 const currentRoute=++routeId;
 const page=location.hash.slice(1).split("?")[0],pages=["home","mountain","crater","login","booking","account"];
 P=pages.includes(page)?page:"home";
 try{
  await refreshState();
  if(currentRoute!=routeId)return;
  if((P=="booking"||P=="account")&&!me()){location.hash="#login";return}
  if(dlg.open)dlg.close(); // any open popup closes when the page changes
  document.body.dataset.page=P;
  $$("[data-view]").forEach(v=>v.hidden=v.dataset.view!=P);
  renderNav();
  const error=$("#server-error");if(error)error.remove();
  if(R[P])await R[P]();
  requestAnimationFrame(()=>$$(".slider").forEach(b=>b._d&&b._d()));
 }catch(error){
  let message=$("#server-error");
  if(!message){message=document.createElement("p");message.id="server-error";message.className="err";$("main").prepend(message)}
  message.textContent=`Could not reach the backend: ${error.message} Start it from the project folder with npm start.`;
 }
};
addEventListener("hashchange",route);

/* ===== popup (Learn More, Book, Filter, Apply, Confirm) ===== */
document.body.insertAdjacentHTML("beforeend",'<dialog id="dlg"></dialog>');
const dlg=$("#dlg"),show=html=>{dlg.innerHTML=html;if(!dlg.open)dlg.showModal()};
dlg.onclick=e=>{if(e.target===dlg)dlg.close()};
document.addEventListener("click",e=>{const t=e.target.closest("[data-more],[data-book],[data-close],[data-message-creator]");if(!t)return;
 if(t.matches("[data-close]"))dlg.close();else if(t.dataset.more)more(t.dataset.more);else if(t.dataset.book)book(t.dataset.book);else messageCreator(t.dataset.messageCreator,t.dataset.messageHike)});
// confirm popup: ask("Title","Message","Yes button text",function to run)
const ask=(title,msg,yes,fn)=>{show(`<div class="pad"><h2>${title}</h2><p>${msg}</p><div class="row2"><button class="ghost" data-close>Cancel</button><button class="red" id="yes">${yes}</button></div></div>`);$("#yes").onclick=()=>{dlg.close();fn()}};

// Learn More works for everyone, logged in or not
function messageCreator(id,hikeId){
 const c=crater(id);
 if(!me()){alert("Please sign in to message this Crater Tourist.");location.hash="#login";return}
 if(!c)return alert("This hike does not have a Crater Tourist account to message.");
 show(`<form id="message-form" class="pad"><h2>Message ${escapeHtml(c.name)}</h2><label>Your message<textarea name="message" rows="5" maxlength="2000" required></textarea></label><p class="err" id="message-error"></p><button class="red wide">Send Message</button></form>`);
 $("#message-form").onsubmit=async e=>{
  e.preventDefault();const button=e.target.querySelector("button");button.disabled=true;
  try{await api("/api/messages",{method:"POST",body:JSON.stringify({craterId:+id,hikeId:+hikeId,message:e.target.elements.message.value})});show(`<div class="pad"><h2>Message sent</h2><p>Your message was sent to ${escapeHtml(c.name)}.</p><button class="red wide" data-close>Done</button></div>`)}
  catch(error){$("#message-error").textContent=error.message;button.disabled=false}
 };
}
function more(id){const h=hike(id),c=crater(h.c),l=left(h);
 const handledBy=c?`Handled by <a href="#crater?id=${c.id}"><b>${escapeHtml(c.name)}</b></a> ${stars(c)}`:"Handled by Hikeventures";
 const included=h.included||DEFAULT_DETAILS[h.n]?.included||[];
 const excluded=h.excluded||DEFAULT_DETAILS[h.n]?.excluded||[];
 show(`<div class="mhead" ${bg(h)}><div class="shade"><button class="x" data-close aria-label="Close">✕</button><h2>${escapeHtml(h.n)}</h2><p>${escapeHtml(h.t)}</p></div></div>
<div class="chips"><span>📅 ${fmt(h)}</span><span>🕒 ${dur(h)}</span><span>⛰ ${lvl(h)} (${h.lv}/9)</span><span>🏷 ${peso(h.p)} per hiker</span></div>
<div class="cols"><div><h4>Included</h4><ul class="yes">${included.map(i=>`<li>${escapeHtml(i)}</li>`).join("")||"<li>Details not provided</li>"}</ul></div><div><h4>Not included</h4><ul class="no">${excluded.map(i=>`<li>${escapeHtml(i)}</li>`).join("")||"<li>Details not provided</li>"}</ul></div></div>
<div class="by">${handledBy}<button class="ghost" data-message-creator="${c?c.id:""}" data-message-hike="${h.id}" ${c?"":"disabled"}>Message Creator</button></div>
<p class="slots">${l} of ${h.slots} slots left</p><div class="meter"><i style="width:${l/h.slots*100}%"></i></div>
<div class="pad"><button class="red wide" data-book="${h.id}">Book Now</button></div>`)}

// No online payment: the hiker reserves a slot, the crater contacts them to settle payment.
function book(id){const u=me();if(!u){location.hash="#login";return} // not logged in: go straight to login
 const h=hike(id),l=left(h);
 if(h.d<today)return alert("This hike has already started.");
 if(l<1)return alert("This hike is fully booked.");
 const extras=optionalExtras(h);
 const extrasOptions=extras.length?`<fieldset class="addon-list"><legend>Optional add-ons</legend>${extras.map(extra=>`<label class="chk"><input type="checkbox" name="extras" value="${escapeHtml(extra.name)}"> ${escapeHtml(extra.name)} (+${peso(extra.price)} per hiker)</label>`).join("")}</fieldset>`:"<p class=\"note\">No paid add-ons for this hike.</p>";
 show(`<form id="bf" class="pad"><h2>Reserve ${escapeHtml(h.n)}</h2><p class="note">${fmt(h)} · ${peso(h.p)} per hiker · ${l} slot${l>1?"s":""} left</p><label>Number of hikers<input type="number" name="n" min="1" max="${l}" value="1" required></label><label>Contact number<input name="tel" placeholder="09XXXXXXXXX" required></label>${extrasOptions}<p>Total: <b id="tot">${peso(h.p)}</b></p><p class="note">No online payment. Your Crater Tourist will contact you to settle the payment before the hike.</p><p class="err" id="err"></p><button class="red wide">Confirm Reservation</button></form>`);
 const f=$("#bf"),E=f.elements,selectedExtras=()=>[...f.querySelectorAll('input[name="extras"]:checked')].map(input=>extras.find(extra=>extra.name===input.value)),total=()=>(h.p+selectedExtras().reduce((sum,extra)=>sum+extra.price,0))*(+E.n.value||0);
 f.oninput=()=>$("#tot").textContent=peso(total());
 f.onsubmit=async e=>{e.preventDefault();const n=+E.n.value;
  if(!Number.isInteger(n)||n<1||n>l)return $("#err").textContent="Hikers must be from 1 to "+l+".";
  if(!/^09\d{9}$/.test(E.tel.value))return $("#err").textContent="Enter a valid mobile number (09XXXXXXXXX).";
  try{await api("/api/bookings",{method:"POST",body:JSON.stringify({hikeId:h.id,hikers:n,extras:selectedExtras().map(extra=>extra.name),tel:E.tel.value})});dlg.close();location.hash="#booking"}
  catch(error){$("#err").textContent=error.message}};
}

/* ===== HOME ===== */
if($("#hikes")){
 const soon=c=>up().filter(h=>h.c==c.id).map(h=>h.d).sort()[0]||"9"; // craters with the nearest schedule
 R.home=()=>{
  const user=me(),greeting=$("#home-greeting");
  greeting.textContent=user?`Hello ${user.name}!`:"";
  greeting.hidden=!user;
  fill($("#hikes"),[...up()].sort((a,b)=>a.d.localeCompare(b.d)).slice(0,6).map(card),"","No hikes yet.");
  fill($("#cr"),listedCraters().filter(c=>soon(c)!="9").sort((a,b)=>soon(a).localeCompare(soon(b))).slice(0,3).map(cc),"c3","");
 };
}

/* ===== MOUNTAIN ===== */
if($("#mountain-list")){
 const F={lv:0,min:0,max:0,m:"",days:0};
 const months=()=>Array.from({length:12},(_,i)=>{const t=new Date(),d=new Date(t.getFullYear(),t.getMonth()+i,1),v=d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0");return [v,d.toLocaleString("en",{month:"long",year:"numeric"})+(up().some(h=>h.d.startsWith(v))?"":" (coming soon)")]});
 const draw=R.mountain=()=>fill($("#mountain-list"),up().filter(h=>(!F.lv||(h.lv<4?1:h.lv<7?2:3)==F.lv)&&(!F.min||h.p>=F.min)&&(!F.max||h.p<=F.max)&&(!F.m||h.d.startsWith(F.m))&&(!F.days||h.days==F.days)).map(card),"",F.m&&!up().some(h=>h.d.startsWith(F.m))?"Coming soon! No hikes are scheduled for this month yet.":"No hikes match your filters.");
 $$("[data-lv]").forEach(b=>b.onclick=()=>{F.lv=F.lv==b.dataset.lv?0:+b.dataset.lv;$$("[data-lv]").forEach(x=>x.classList.toggle("on",+x.dataset.lv==F.lv));draw()});
 $("#more").onclick=()=>{
  show(`<form id="ff" class="pad"><h2>More filter</h2><label>Minimum budget (₱)<input type="number" name="min" min="0" value="${F.min||""}"></label><label>Maximum budget (₱)<input type="number" name="max" min="0" value="${F.max||""}"></label><label>Month<select name="m"><option value="">Any month</option>${months().map(m=>`<option value="${m[0]}" ${F.m==m[0]?"selected":""}>${m[1]}</option>`).join("")}</select></label><label>Number of days<input type="number" name="days" min="1" value="${F.days||""}"></label><p class="err" id="err"></p><div class="row2"><button type="button" class="ghost" id="rs">Reset</button><button class="red">Apply Filters</button></div></form>`);
  $("#rs").onclick=()=>{F.min=F.max=F.days=0;F.m="";dlg.close();draw()};
  $("#ff").onsubmit=e=>{e.preventDefault();const E=e.target.elements,mn=+E.min.value,mx=+E.max.value;
   if(mn&&mx&&mn>mx)return $("#err").textContent="Minimum budget cannot be higher than the maximum.";
   Object.assign(F,{min:mn,max:mx,m:E.m.value,days:+E.days.value});dlg.close();draw()}};
}

/* ===== CRATER TOURIST ===== */
if($("#apply")){
 $("#apply").onclick=()=>{const u=me();if(!u){alert("Please sign in first.");location.hash="#login";return}
  if(u.role=="creator")return alert("You are already a Crater Tourist.");
  show(`<form id="af" class="pad"><h2>Apply to be a Crater</h2><label>Crater / group name<input name="nm" minlength="3" maxlength="80" required></label><label>Contact number<input name="tel" placeholder="09XXXXXXXXX" required></label><p class="note">Applications are auto-approved for now.</p><p class="err" id="err"></p><button class="red wide">Submit Application</button></form>`);
  $("#af").onsubmit=async e=>{e.preventDefault();const E=e.target.elements;
   try{const result=await api("/api/craters",{method:"POST",body:JSON.stringify({name:E.nm.value,tel:E.tel.value})});await refreshState();location.hash="#crater?id="+result.crater.id}
   catch(error){$("#err").textContent=error.message}
  }};
 const profile=c=>{
   $("#prof").innerHTML=`<div class="phead"><img src="img/crater-${c.id}.png" alt="" onerror="this.remove()"><div><h1>${escapeHtml(c.name)}</h1><p>${stars(c)}</p><p class="note">Overall rating includes reviews from customers after completed booked hikes.</p></div></div><h2 class="title">Hikes handled</h2><div class="slider" id="ps"></div><p class="center"><a class="btn" href="#crater">Back to craters</a></p>`;
  fill($("#ps"),up().filter(h=>h.c==c.id).map(card),"","This crater has no hikes posted yet.");
 };
 R.crater=()=>{
  const query=location.hash.includes("?")?location.hash.split("?").slice(1).join("?"):"";
  const c=crater(new URLSearchParams(query).get("id"));
  $("#hero").hidden=$("#crater-list").hidden=!!c;
  $("#prof").hidden=!c;
  if(c)profile(c);else{$("#prof").innerHTML="";fill($("#craters"),listedCraters().map(cc),"c3","No craters yet.")}
 };
}

/* ===== LOGIN / SIGN-UP ===== */
if($("#lf")){
 const lf=$("#lf"),sf=$("#sf"),flip=s=>{lf.hidden=s;sf.hidden=!s};
 $("#toSignup").onclick=()=>flip(true);$("#toLogin").onclick=()=>flip(false);
 lf.onsubmit=async e=>{e.preventDefault();const E=lf.elements;
  try{await api("/api/auth/login",{method:"POST",body:JSON.stringify({email:E.email.value,password:E.pw.value})});location.hash="#home"}
  catch(error){$("#lerr").textContent=error.message}
 };
 sf.onsubmit=async e=>{e.preventDefault();const E=sf.elements;
  if(E.pw.value!=E.pw2.value)return $("#serr").textContent="Passwords do not match.";
  try{await api("/api/auth/signup",{method:"POST",body:JSON.stringify({name:E.fname.value,email:E.email.value,password:E.pw.value})});location.hash="#home"}
  catch(error){$("#serr").textContent=error.message}
 };
}

/* ===== MY BOOKING ===== */
if($("#cur")){
 const row=b=>{const h=hike(b.hike),c=h&&crater(h.c);if(!h)return "";const extras=(b.extras||[]).map(extra=>escapeHtml(`${extra.name} (+${peso(extra.price)})`)).join(", "),rating=hikeCompleted(h)?`<form class="inline hike-rating" data-rating="${b.id}"><label>${b.rating?`Your rating: ${b.rating}/5 · Update`:"Rate this hike"}<select name="value" aria-label="Rating for ${escapeHtml(h.n)}">${[5,4,3,2,1].map(value=>`<option value="${value}" ${b.rating===value?"selected":""}>${value} star${value===1?"":"s"}</option>`).join("")}</select></label><button class="red">${b.rating?"Update rating":"Submit rating"}</button><p class="err" data-rating-error></p></form>`:"";return `<div class="bk"><div><b>${escapeHtml(h.n)}</b><br>${fmt(h)} · ${b.n} hiker${b.n>1?"s":""}${extras?` · Add-ons: ${extras}`:""}<br><small>Crater: ${escapeHtml(c?.name||"Hikeventures")} · Status: ${hikeCompleted(h)?"Completed":"Reserved"}</small>${rating}</div><div><b>${peso(b.total)}</b> ${h.d>=today?`<button class="red" data-cancel="${b.id}">Cancel</button>`:""}</div></div>`};
 const list=a=>a.map(row).join("")||'<p class="empty">Nothing here yet.</p>';
 R.booking=()=>{
  const mine=books().filter(b=>hike(b.hike));
  $("#cur").innerHTML=list(mine.filter(b=>!hikeCompleted(hike(b.hike))));
  $("#past").innerHTML=list(mine.filter(b=>hikeCompleted(hike(b.hike))));
 };
 $("#cur").onclick=async e=>{const id=e.target.dataset.cancel;if(id&&confirm("Cancel this booking?"))try{await api(`/api/bookings/${id}`,{method:"DELETE"});await refreshState();R.booking()}catch(error){alert(error.message)}};
 $("#past").onsubmit=async e=>{const form=e.target.closest("[data-rating]");if(!form)return;e.preventDefault();const error=$("[data-rating-error]",form);
  try{await api(`/api/bookings/${form.dataset.rating}/rating`,{method:"POST",body:JSON.stringify({value:+form.elements.value.value})});await refreshState();R.booking()}
  catch(cause){error.textContent=cause.message}
 };
}

/* ===== MY ACCOUNT ===== */
if($("#acct")){
 const say=(id,text,ok)=>{const e=$(id);e.textContent=text;e.classList.toggle("ok",!!ok)};
 const mine=()=>craters().find(c=>c.owner==me().email);
 $("#hf").elements.mt.innerHTML=Object.keys(MT).map(n=>`<option>${n}</option>`).join(""); // crater tourists can only pick these mountains
 const loadHikeDetails=()=>{const defaults=DEFAULT_DETAILS[$("#hf").elements.mt.value]||{included:[],excluded:[]};$("#hf").elements.includedList.value=defaults.included.join("\n");$("#hf").elements.excludedList.value=defaults.excluded.join("\n")};
 $("#hf").elements.mt.onchange=loadHikeDetails;
 loadHikeDetails();
 const renderInbox=async()=>{
  const {messages}=await api("/api/messages");
  const threads=new Map();
  messages.forEach(message=>{const key=`${message.creatorId}:${message.customerId}:${message.hikeId}`;if(!threads.has(key))threads.set(key,[]);threads.get(key).push(message)});
  const creator=me().role=="creator";
  $("#messages").innerHTML=[...threads.values()].map(thread=>{
   const latest=thread[thread.length-1],first=thread[0];
   return `<article class="message"><h3>${escapeHtml(creator?first.customerName:first.craterName)} · ${escapeHtml(first.hikeName)}</h3><div class="thread">${thread.map(message=>`<p><b>${escapeHtml(message.senderName)}:</b> ${escapeHtml(message.body)}</p><small>${escapeHtml(message.createdAt)}</small>`).join("")}</div><form data-reply="${latest.id}"><label>Reply<textarea name="message" rows="3" maxlength="2000" required></textarea></label><button class="red">Send reply</button></form></article>`;
  }).join("")||(creator?'<p class="empty">No customer messages yet.</p>':'<p class="empty">You have not messaged any Crater Tourists yet.</p>');
  $("#messages").onsubmit=async e=>{const form=e.target.closest("[data-reply]");if(!form)return;e.preventDefault();const button=form.querySelector("button");button.disabled=true;try{await api(`/api/messages/${form.dataset.reply}/reply`,{method:"POST",body:JSON.stringify({message:form.elements.message.value})});await renderInbox()}catch(error){alert(error.message);button.disabled=false}};
 };
 R.account=async()=>{
  const u=me(),c=mine();
  $("#acct").innerHTML=`<div><h2>${escapeHtml(u.name)}</h2><p>${escapeHtml(u.email)} · ${u.role=="creator"?"Crater Tourist":"Customer"}</p></div><button class="btn" id="out">Log out</button>`;
  $("#nf").elements.fname.value=u.name;
  $("#hf").elements.date.min=today;
  ["#nmsg","#pmsg","#hmsg"].forEach(i=>say(i,""));
  $("#crt").hidden=!c;
  if(c){
   $("#cname").textContent=c.name;
   $("#myhikes").innerHTML=hikes().filter(h=>h.c==c.id).map(h=>`<div class="bk"><div><b>${escapeHtml(h.n)}</b><br>${fmt(h)} · ${peso(h.p)} · ${left(h)} of ${h.slots} slots left</div><button class="red" data-rm="${h.id}">Remove</button></div>`).join("")||'<p class="empty">No hikes posted yet.</p>';
  }
  await renderInbox();
 };
 $("#acct").onclick=e=>{if(e.target.id=="out")ask("Log out?","Are you sure you want to log out?","Log out",async()=>{try{await api("/api/auth/logout",{method:"POST"});STATE.user=null;location.hash="#home"}catch(error){alert(error.message)}})};

 $("#nf").onsubmit=async e=>{e.preventDefault();const name=e.target.elements.fname.value.trim();
  try{const result=await api("/api/account/name",{method:"PATCH",body:JSON.stringify({name})});STATE.user=result.user;await refreshState();await R.account();say("#nmsg","Name updated.",1)}
  catch(error){say("#nmsg",error.message)}
 };

 $("#pf").onsubmit=async e=>{e.preventDefault();const E=e.target.elements;
  if(E.pw.value!=E.pw2.value)return say("#pmsg","Passwords do not match.");
  try{await api("/api/account/password",{method:"PATCH",body:JSON.stringify({currentPassword:E.old.value,newPassword:E.pw.value})});e.target.reset();say("#pmsg","Password updated.",1)}
  catch(error){say("#pmsg",error.message)}
 };

 // crater only: add a hike, remove a hike, remove myself as a crater
 $("#hf").onsubmit=async e=>{e.preventDefault();const E=e.target.elements,mt=E.mt.value.trim();
  const lines=value=>value.split(/\r?\n/).map(line=>line.trim()).filter(Boolean);
  try{await api("/api/hikes",{method:"POST",body:JSON.stringify({name:mt,tagline:E.tagline.value,startDate:E.date.value,days:+E.days.value,price:+E.price.value,difficulty:+E.lv.value,slots:+E.slots.value,trail:E.trail.value,included:lines(E.includedList.value),excluded:lines(E.excludedList.value)})});e.target.reset();loadHikeDetails();await refreshState();await R.account();say("#hmsg","Hike added.",1)}
  catch(error){say("#hmsg",error.message)}
 };

 $("#myhikes").onclick=e=>{const id=e.target.dataset.rm;
  if(id)ask("Remove this hike?","Reservations for this hike will be removed too.","Remove",async()=>{
   try{await api(`/api/hikes/${id}`,{method:"DELETE"});await refreshState();await R.account()}catch(error){alert(error.message)}
  })};

 $("#leave").onclick=()=>ask("Remove yourself as a crater?","Your crater and all the hikes you posted will be removed.","Remove",async()=>{
  try{await api("/api/craters/me",{method:"DELETE"});await refreshState();await R.account()}catch(error){alert(error.message)}
 });
}
route();
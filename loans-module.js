(()=>{
  const STORAGE='mi-agenda-loans-v1';
  const load=()=>{try{const x=JSON.parse(localStorage.getItem(STORAGE)||'[]');return Array.isArray(x)?x:[]}catch{return[]}};
  let loans=load();
  const save=()=>localStorage.setItem(STORAGE,JSON.stringify(loans));
  const money=n=>'Bs '+Number(n||0).toLocaleString('es-BO',{minimumFractionDigits:0,maximumFractionDigits:2});
  const iso=d=>{const x=d instanceof Date?d:new Date(d);return x.getFullYear()+'-'+String(x.getMonth()+1).padStart(2,'0')+'-'+String(x.getDate()).padStart(2,'0')};
  const fmt=d=>new Date(d+'T12:00:00').toLocaleDateString('es-BO',{day:'2-digit',month:'short',year:'numeric'});
  const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const parse=d=>new Date(d+'T12:00:00');
  const addMonths=(dateStr,n)=>{const d=parse(dateStr),day=d.getDate();d.setDate(1);d.setMonth(d.getMonth()+n);const last=new Date(d.getFullYear(),d.getMonth()+1,0).getDate();d.setDate(Math.min(day,last));return iso(d)};
  const sum=(arr,key)=>arr.reduce((s,p)=>s+Number(p[key]||0),0);
  const paymentsBefore=(l,date,includeSame=false)=>(l.payments||[]).filter(p=>includeSame?p.date<=date:p.date<date);
  const capitalAt=(l,date,includeSame=false)=>Math.max(0,Number(l.principal)-sum(paymentsBefore(l,date,includeSame),'capital'));

  function accruedInterest(l,through=iso(new Date())){
    const rate=Number(l.rate||0);if(rate<=0)return 0;
    let total=0,period=1,guard=0;
    while(guard++<600){const due=addMonths(l.startDate,period++);if(due>through)break;const cap=capitalAt(l,due,false);if(cap<=0)break;total+=cap*rate/100;}
    return total;
  }
  function projectedInterest(l,through=l.dueDate){
    const rate=Number(l.rate||0);if(rate<=0)return 0;
    let total=0,period=1,guard=0;
    while(guard++<600){const due=addMonths(l.startDate,period++);if(due>through)break;const cap=capitalAt(l,due,false);if(cap<=0)break;total+=cap*rate/100;}
    return total;
  }
  function nextInterestDate(l){
    if(Number(l.rate||0)<=0)return null;let period=1,guard=0,today=iso(new Date());
    while(guard++<600){const due=addMonths(l.startDate,period++);if(due>today)return due;}return null;
  }
  function calc(l){
    const paidInterest=sum(l.payments||[],'interest'),paidCapital=sum(l.payments||[],'capital'),capital=Math.max(0,Number(l.principal)-paidCapital),accrued=accruedInterest(l),interest=Math.max(0,accrued-paidInterest),total=capital+interest,today=iso(new Date());
    let status=total<=0.009?'paid':today>l.dueDate?'overdue':'active';
    return{paidInterest,paidCapital,capital,accruedInterest:accrued,interest,total,status,nextInterestDate:status==='paid'?null:nextInterestDate(l),monthlyEstimate:capital*Number(l.rate||0)/100,projectedInterest:projectedInterest(l)};
  }
  const badge=s=>s==='paid'?'<span class="loan-badge paid">Pagado</span>':s==='overdue'?'<span class="loan-badge overdue">Vencido</span>':'<span class="loan-badge active">Vigente</span>';

  function syncFinance(){
    const api=window.miAgendaFinance;if(!api||typeof api.syncLoanInterestMovements!=='function')return;
    const records=[];loans.forEach(l=>(l.payments||[]).forEach(p=>{if(Number(p.interest)>0)records.push({paymentId:p.id,person:l.person,amount:Number(p.interest),date:p.date})}));
    api.syncLoanInterestMovements(records);
  }

  function inject(){
    if(document.getElementById('loans')){render();syncFinance();return;}
    const css=document.createElement('link');css.rel='stylesheet';css.href='loans-module.css?v=3';document.head.appendChild(css);
    const settings=document.querySelector('[data-screen="settings"]');
    if(settings&&!document.querySelector('[data-screen="loans"]')){const b=document.createElement('button');b.className='navbtn';b.dataset.screen='loans';b.innerHTML='<span class="navicon">$</span>Préstamos';b.addEventListener('click',()=>window.nav('loans'));settings.parentNode.insertBefore(b,settings);}
    const content=document.querySelector('.content');if(!content)return;
    const section=document.createElement('div');section.id='loans';section.className='screen';section.innerHTML=`<div class="pagehead"><div><h2>Préstamos</h2><p>Capital, intereses mensuales, vencimientos y pagos parciales.</p></div><button class="primary" id="newLoan">＋ Nuevo préstamo</button></div>
      <div class="loan-metrics"><div class="metric"><small>Capital pendiente</small><strong id="loanCapital">Bs 0</strong></div><div class="metric"><small>Interés acumulado pendiente</small><strong id="loanInterest">Bs 0</strong></div><div class="metric"><small>Total por cobrar hoy</small><strong id="loanTotal">Bs 0</strong></div><div class="metric"><small>Vencidos</small><strong id="loanOverdue">0</strong></div></div>
      <div class="card loan-list-card"><div class="cardhead"><h3>Mis préstamos</h3><div class="loan-filters"><button class="secondary loan-filter active" data-filter="all">Todos</button><button class="secondary loan-filter" data-filter="active">Vigentes</button><button class="secondary loan-filter" data-filter="overdue">Vencidos</button><button class="secondary loan-filter" data-filter="paid">Pagados</button></div></div><div id="loanList"></div></div>`;
    content.appendChild(section);
    const modal=document.createElement('div');modal.id='loanModal';modal.className='modal';modal.innerHTML='<div class="sheet loan-sheet"><div id="loanFormHost"></div></div>';document.body.appendChild(modal);
    document.getElementById('loanModal').addEventListener('click',e=>{if(e.target.id==='loanModal')closeLoanModal()});
    document.getElementById('newLoan').onclick=()=>openLoan();
    document.querySelectorAll('.loan-filter').forEach(b=>b.onclick=()=>{document.querySelectorAll('.loan-filter').forEach(x=>x.classList.remove('active'));b.classList.add('active');render(b.dataset.filter)});
    render();syncFinance();
  }

  function openLoan(existing){
    const l=existing||{id:'l'+Date.now().toString(36),person:'',phone:'',principal:'',startDate:iso(new Date()),dueDate:addMonths(iso(new Date()),1),rate:'',notes:'',payments:[]};
    const host=document.getElementById('loanFormHost');
    host.innerHTML=`<h2>${existing?'Editar préstamo':'Nuevo préstamo'}</h2><form class="form loan-form" id="loanForm"><div class="loan-form-grid"><label>Persona / prestatario<input id="lpPerson" required value="${esc(l.person)}" placeholder="Nombre completo"></label><label>Teléfono <span class="optional">opcional</span><input id="lpPhone" value="${esc(l.phone||'')}" placeholder="70000000"></label><label>Monto prestado<input id="lpPrincipal" type="number" min="0.01" step="0.01" required value="${l.principal||''}"></label><label>Interés mensual (%) <span class="optional">opcional</span><input id="lpRate" type="number" min="0" step="0.01" value="${l.rate||''}" placeholder="Ej. 5"></label><label>Fecha del préstamo<input id="lpStart" type="date" required value="${l.startDate}"></label><label>Fecha límite de pago<input id="lpDue" type="date" required value="${l.dueDate}"></label></div><label>Observaciones <span class="optional">opcional</span><textarea id="lpNotes" rows="3" placeholder="Condiciones o notas del préstamo...">${esc(l.notes||'')}</textarea><div class="loan-preview" id="loanPreview"></div><div class="formactions"><button type="button" class="secondary" onclick="window.closeLoanModal()">Cancelar</button><button class="primary">Guardar préstamo</button></div></form>`;
    const preview=()=>{const temp={...l,principal:Number(document.getElementById('lpPrincipal').value||0),rate:Number(document.getElementById('lpRate').value||0),startDate:document.getElementById('lpStart').value,dueDate:document.getElementById('lpDue').value,payments:l.payments||[]};const monthly=temp.principal*temp.rate/100,projected=temp.startDate&&temp.dueDate?projectedInterest(temp,temp.dueDate):0;document.getElementById('loanPreview').innerHTML=`<b>Vista previa</b><span>Interés mensual inicial: ${money(monthly)}</span><span>Interés estimado hasta vencimiento: ${money(projected)}</span><span>Total estimado al vencimiento: ${money(temp.principal+projected)}</span>`};
    ['lpPrincipal','lpRate','lpStart','lpDue'].forEach(id=>document.getElementById(id).addEventListener('input',preview));preview();document.getElementById('loanModal').classList.add('show');
    document.getElementById('loanForm').onsubmit=e=>{e.preventDefault();const start=document.getElementById('lpStart').value,due=document.getElementById('lpDue').value;if(due<start){alert('La fecha límite no puede ser anterior a la fecha del préstamo.');return;}l.person=document.getElementById('lpPerson').value.trim();l.phone=document.getElementById('lpPhone').value.trim();l.principal=Number(document.getElementById('lpPrincipal').value);l.rate=Number(document.getElementById('lpRate').value||0);l.startDate=start;l.dueDate=due;l.notes=document.getElementById('lpNotes').value.trim();if(!existing)loans.unshift(l);save();syncFinance();closeLoanModal();render()};
  }

  function closeLoanModal(){document.getElementById('loanModal')?.classList.remove('show')}
  function openPayment(id){
    const l=loans.find(x=>x.id===id);if(!l)return;const host=document.getElementById('loanFormHost'),c=calc(l);
    host.innerHTML=`<h2>Registrar pago</h2><div class="loan-payment-summary"><span>Capital pendiente: <b>${money(c.capital)}</b></span><span>Interés acumulado pendiente: <b>${money(c.interest)}</b></span><span>Próximo interés: <b>${c.nextInterestDate?fmt(c.nextInterestDate):'—'}</b></span></div><form class="form" id="paymentForm"><label>Fecha del pago<input id="payDate" type="date" value="${iso(new Date())}" required></label><label>Tipo de pago<select id="payType"><option value="interest">Solo interés</option><option value="capital">Solo capital</option><option value="mixed">Interés + capital</option></select></label><label>Monto de interés<input id="payInterest" type="number" min="0" step="0.01" value="${c.interest>0?c.interest:c.monthlyEstimate}"></label><label>Monto a capital<input id="payCapital" type="number" min="0" step="0.01" value="0"></label><label>Nota <span class="optional">opcional</span><input id="payNote" placeholder="Ej. Interés de agosto"></label><div class="loan-hint">Los pagos de interés se registran automáticamente como ingreso en Finanzas. Los abonos a capital no se contabilizan como ganancia.</div><div class="formactions"><button type="button" class="secondary" onclick="window.closeLoanModal()">Cancelar</button><button class="primary">Registrar pago</button></div></form>`;
    const type=document.getElementById('payType'),pi=document.getElementById('payInterest'),pc=document.getElementById('payCapital');const sync=()=>{if(type.value==='interest'){pi.disabled=false;pc.value=0;pc.disabled=true}else if(type.value==='capital'){pi.value=0;pi.disabled=true;pc.disabled=false}else{pi.disabled=false;pc.disabled=false}};type.onchange=sync;sync();document.getElementById('loanModal').classList.add('show');
    document.getElementById('paymentForm').onsubmit=e=>{e.preventDefault();const interest=Number(pi.value||0),capital=Number(pc.value||0);if(interest+capital<=0){alert('Ingresa un monto de pago.');return}if(capital>c.capital+0.009){alert('El abono a capital supera el capital pendiente.');return}l.payments=l.payments||[];l.payments.push({id:'p'+Date.now().toString(36)+Math.random().toString(36).slice(2,6),date:document.getElementById('payDate').value,interest,capital,note:document.getElementById('payNote').value.trim()});save();syncFinance();closeLoanModal();render()};
  }

  function editLoan(id){const l=loans.find(x=>x.id===id);if(l)openLoan(l)}
  function deleteLoan(id){const l=loans.find(x=>x.id===id);if(!l||!confirm('¿Eliminar este préstamo y todo su historial de pagos?'))return;loans=loans.filter(x=>x.id!==id);save();syncFinance();render()}
  function deletePayment(loanId,paymentId){const l=loans.find(x=>x.id===loanId);if(!l||!confirm('¿Eliminar este pago del historial?'))return;l.payments=(l.payments||[]).filter(p=>p.id!==paymentId);save();syncFinance();history(loanId);render()}

  function render(filter='all'){
    const list=document.getElementById('loanList');if(!list)return;let capital=0,interest=0,total=0,overdue=0;loans.forEach(l=>{const c=calc(l);if(c.status!=='paid'){capital+=c.capital;interest+=c.interest;total+=c.total}if(c.status==='overdue')overdue++});document.getElementById('loanCapital').textContent=money(capital);document.getElementById('loanInterest').textContent=money(interest);document.getElementById('loanTotal').textContent=money(total);document.getElementById('loanOverdue').textContent=overdue;
    const shown=loans.filter(l=>filter==='all'||calc(l).status===filter);if(!shown.length){list.innerHTML='<div class="empty loan-empty">No hay préstamos en esta categoría.<br>Registra el primero para comenzar.</div>';return}
    list.innerHTML=shown.map(l=>{const c=calc(l);return `<article class="loan-card"><div class="loan-card-top"><div><div class="loan-person">${esc(l.person)}</div><div class="meta">${l.phone?esc(l.phone)+' · ':''}Prestado ${fmt(l.startDate)}</div></div>${badge(c.status)}</div><div class="loan-grid"><div><small>Capital original</small><b>${money(l.principal)}</b></div><div><small>Capital pendiente</small><b>${money(c.capital)}</b></div><div><small>Interés pendiente hoy</small><b>${money(c.interest)}</b></div><div><small>Fecha límite</small><b>${fmt(l.dueDate)}</b></div><div><small>Interés mensual</small><b>${l.rate?esc(String(l.rate))+'%':'Sin interés'}</b></div><div><small>Próximo interés</small><b>${c.nextInterestDate?fmt(c.nextInterestDate):'—'}</b></div><div><small>Interés pagado</small><b>${money(c.paidInterest)}</b></div><div><small>Capital abonado</small><b>${money(c.paidCapital)}</b></div></div><div class="loan-card-footer"><span>Total exigible hoy: <b>${money(c.total)}</b></span><div><button class="secondary loan-small" onclick="window.editLoan('${l.id}')">Editar</button><button class="secondary loan-small" onclick="window.openLoanPayments('${l.id}')">Historial</button>${c.status!=='paid'?'<button class="primary loan-small" onclick="window.openLoanPayment(\''+l.id+'\')">＋ Pago</button>':''}<button class="secondary loan-small danger" onclick="window.deleteLoan('${l.id}')">Eliminar</button></div></div></article>`}).join('');
  }

  function history(id){const l=loans.find(x=>x.id===id);if(!l)return;const c=calc(l);document.getElementById('loanFormHost').innerHTML=`<h2>Historial · ${esc(l.person)}</h2><div class="loan-payment-summary"><span>Capital pendiente: <b>${money(c.capital)}</b></span><span>Interés pendiente: <b>${money(c.interest)}</b></span><span>Total exigible hoy: <b>${money(c.total)}</b></span></div><div class="loan-history">${(l.payments||[]).slice().sort((a,b)=>b.date.localeCompare(a.date)).map(p=>`<div class="item"><div><b>${p.interest&&p.capital?'Pago mixto':p.interest?'Interés':'Capital'}</b><div class="meta">${fmt(p.date)}${p.note?' · '+esc(p.note):''}</div><div class="meta">Interés ${money(p.interest)} · Capital ${money(p.capital)}</div></div><div class="loan-history-right"><strong>${money(Number(p.interest||0)+Number(p.capital||0))}</strong><button class="secondary loan-delete-payment" onclick="window.deleteLoanPayment('${l.id}','${p.id}')">Eliminar</button></div></div>`).join('')||'<div class="empty">Todavía no hay pagos registrados.</div>'}</div><div class="formactions"><button class="secondary" onclick="window.closeLoanModal()">Cerrar</button>${c.status!=='paid'?`<button class="primary" onclick="window.openLoanPayment('${l.id}')">Registrar pago</button>`:''}</div>`;document.getElementById('loanModal').classList.add('show')}

  window.closeLoanModal=closeLoanModal;window.openLoanPayment=openPayment;window.openLoanPayments=history;window.editLoan=editLoan;window.deleteLoan=deleteLoan;window.deleteLoanPayment=deletePayment;
  window.addEventListener('mi-agenda-loans-reset',()=>{loans=[];render();syncFinance()});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',inject,{once:true});else inject();
})();

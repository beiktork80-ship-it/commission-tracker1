(function(){
  const E = id => document.getElementById(id);
  const showErr = (msg, ok=false) => { const d=E('err'); d.textContent=msg; d.className = ok ? 'ok' : ''; d.style.display='block'; setTimeout(()=>d.style.display='none', 2600); };
  const safe = fn => { try{ return fn(); } catch(e){ console.error(e); showErr(e.message); } };

  function todayISO(){ const d=new Date(); return d.toISOString().slice(0,10); }
  function monthStartEnd(ym){
    const [y,m]=ym.split('-').map(Number);
    const start=new Date(y,m-1,1), end=new Date(y,m,0);
    return [start.toISOString().slice(0,10), end.toISOString().slice(0,10), end.getDate()];
  }
  function numberOrZero(v){ const n = parseFloat(String(v||'0').replace(',','.')); return isNaN(n)?0:n; }

  // IndexedDB
  const DB_NAME='commission_db', DB_VERSION=1, STORE='contracts';
  function idbOpen(){
    return new Promise((resolve,reject)=>{
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = e => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(STORE)) {
          const st = db.createObjectStore(STORE, { keyPath:'id', autoIncrement:true });
          st.createIndex('entryDate','entryDate',{unique:false});
        }
      };
      req.onsuccess = e => resolve(e.target.result);
      req.onerror = e => reject(e.target.error || new Error('IndexedDB error'));
    });
  }
  const idb = {
    async add(obj){ const db=await idbOpen(); return new Promise((res,rej)=>{ const r=db.transaction(STORE,'readwrite').objectStore(STORE).add(obj); r.onsuccess=()=>res(r.result); r.onerror=e=>rej(e.target.error); }); },
    async del(id){ const db=await idbOpen(); return new Promise((res,rej)=>{ const r=db.transaction(STORE,'readwrite').objectStore(STORE).delete(id); r.onsuccess=()=>res(true); r.onerror=e=>rej(e.target.error); }); },
    async byDate(d){ const db=await idbOpen(); const st=db.transaction(STORE,'readonly').objectStore(STORE).index('entryDate'); return new Promise((res)=>{ const out=[]; st.openCursor(IDBKeyRange.only(d),'prev').onsuccess=e=>{ const c=e.target.result; if(c){ out.push(c.value); c.continue(); } else res(out); }; }); },
    async between(a,b){ const db=await idbOpen(); const st=db.transaction(STORE,'readonly').objectStore(STORE).index('entryDate'); return new Promise((res)=>{ const out=[]; st.openCursor(IDBKeyRange.bound(a,b)).onsuccess=e=>{ const c=e.target.result; if(c){ out.push(c.value); c.continue(); } else res(out); }; }); },
  };

  function activateTab(id){
    ['add','daily','report'].forEach(t=>{
      E('tab-'+t).classList.toggle('active', t===id);
      E('view-'+t).style.display = (t===id)?'block':'none';
    });
  }
  function setupTabs(){
    [['tab-add','add'],['tab-daily','daily'],['tab-report','report']].forEach(([btn,id])=>{
      E(btn).addEventListener('click', ()=>activateTab(id));
    });
  }

  async function saveContract(){
    const obj = {
      contractNumber: E('contractNumber').value.trim(),
      amount: numberOrZero(E('amount').value),
      customer: E('customer').value.trim(),
      entryDate: todayISO(),
      controlledBy: (E('controlledBy').value.trim() || null),
      controlDate: (E('controlDate').value || null),
      noProblemAfterInstall: (function(v){ if(!v) return null; if(v==='ok') return true; if(v==='change') return false; return null; })(E('installResult').value),
      assemblyTeam: (E('assemblyTeam').value.trim() || null),
      shipDate: (E('shipDate').value || null),
      installDate: (E('installDate').value || null),
      notes: (E('notes').value.trim() || null),
    };
    if(!obj.contractNumber){ showErr('شماره قرارداد را وارد کنید'); return; }
    await idb.add(obj);
    ['contractNumber','amount','customer','controlledBy','controlDate','installResult','assemblyTeam','shipDate','installDate','notes'].forEach(id=>{ const el=E(id); if(el.tagName==='SELECT') el.value=''; else el.value=''; });
    showErr('ثبت شد ✅', true);
    await loadDaily(); await loadReport();
    activateTab('daily');
  }

  async function loadDaily(){
    const d = E('dailyDate').value || todayISO();
    const list = await idb.byDate(d);
    const wrap = E('dailyList'); wrap.innerHTML='';
    let total=0;
    list.forEach(item=>{
      total += numberOrZero(item.amount);
      const div = document.createElement('div');
      div.className='list-item';
      div.innerHTML = `
        <div><b>${item.contractNumber}</b> — €${numberOrZero(item.amount).toFixed(2)}</div>
        <div>مشتری: ${item.customer||'—'}</div>
        <div class="muted">کنترل: ${item.controlledBy||'—'} / ${item.controlDate||'—'}</div>
        <div class="muted">نتیجه نصب: ${
          item.noProblemAfterInstall===true?'بدون مشکل':(item.noProblemAfterInstall===false?'نیاز به تغییر':'نامشخص')
        }</div>
        <div class="muted">تیم: ${item.assemblyTeam||'—'} | ارسال: ${item.shipDate||'—'} | نصب: ${item.installDate||'—'}</div>
        ${item.notes?`<div class="muted">یادداشت: ${item.notes}</div>`:''}
        <div class="row-buttons"><button class="danger" data-id="${item.id}">حذف</button></div>`;
      wrap.appendChild(div);
    });
    E('dailyTotal').value = total.toFixed(2);
    wrap.querySelectorAll('button.danger').forEach(btn=>btn.addEventListener('click', async()=>{
      const id = Number(btn.getAttribute('data-id'));
      if(confirm('حذف شود؟')){ await idb.del(id); await loadDaily(); await loadReport(); }
    }));
  }

  // CSV export for current month
  function toCSV(rows){
    const header = ['id','contractNumber','amount','customer','entryDate','controlledBy','controlDate','noProblemAfterInstall','assemblyTeam','shipDate','installDate','notes'];
    const escape = v => {
      const s = (v===null||v===undefined)?'':String(v);
      if (/[",\n]/.test(s)) return `"${s.replace(/"/g,'""')}"`;
      return s;
    };
    return [header.join(','), ...rows.map(r=>header.map(k=>escape(r[k])).join(','))].join('\n');
  }
  async function exportCSVForMonth(){
    const ym = E('reportMonth').value || todayISO().slice(0,7);
    const [start,end] = monthStartEnd(ym);
    const list = await idb.between(start,end);
    const csv = toCSV(list);
    const blob = new Blob([csv], {type:'text/csv;charset=utf-8;'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `contracts_${ym}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
    showErr('CSV این ماه دانلود شد', true);
  }

  // Excel (XLS via SpreadsheetML 2003)
  function toXLS(rows){
    const esc = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    const cols = ['id','contractNumber','amount','customer','entryDate','controlledBy','controlDate','noProblemAfterInstall','assemblyTeam','shipDate','installDate','notes'];
    const header = cols.map(c=>f"<Cell><Data ss:Type='String'>{esc(c)}</Data></Cell>").join('');
    const body = rows.map(r=>{
      const cells = cols.map(k=>{
        const v = (r[k]===null||r[k]===undefined)?'':r[k];
        const isNum = ['amount'].includes(k) && !isNaN(parseFloat(v));
        const type = isNum ? 'Number' : 'String';
        return f"<Cell><Data ss:Type='{type}'>{esc(v)}</Data></Cell>";
      }).join('');
      return f"<Row>{cells}</Row>";
    }).join('');
    return f\"\"\"\
<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
 <Worksheet ss:Name="Contracts">
  <Table>
   <Row>{header}</Row>
   {body}
  </Table>
 </Worksheet>
</Workbook>
\"\"\";
  }
  async function exportXLSForMonth(){
    const ym = E('reportMonth').value || todayISO().slice(0,7);
    const [start,end] = monthStartEnd(ym);
    const list = await idb.between(start,end);
    const xml = toXLS(list);
    const blob = new Blob([xml], {type:'application/vnd.ms-excel'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `contracts_${ym}.xls`;
    a.click();
    URL.revokeObjectURL(a.href);
    showErr('Excel (XLS) این ماه دانلود شد', true);
  }

  // Simple notification at 22:00 while app is open
  function scheduleDailyNotify(){
    if(!('Notification' in window)) { showErr('مرورگر از اعلان پشتیبانی نمی‌کند'); return; }
    Notification.requestPermission().then(p => {
      if (p !== 'granted') { showErr('مجوز اعلان داده نشد'); return; }
      showErr('یادآور فعال شد (وقتی اپ باز باشد)', true);
      localStorage.setItem('notifyEnabled','1');
    });
  }
  function tickNotify(){
    if(localStorage.getItem('notifyEnabled')!=='1') return;
    if(!('Notification' in window) || Notification.permission!=='granted') return;
    const now = new Date();
    const hour = now.getHours(), min = now.getMinutes();
    const todayKey = now.toISOString().slice(0,10);
    if(hour===22 && min===0 && localStorage.getItem('notifiedAt')!==todayKey){
      new Notification('یادآوری ثبت قرارداد', { body:'لطفاً قراردادهای امروز را ثبت کنید.', icon:'./icons/icon-192.png' });
      localStorage.setItem('notifiedAt', todayKey);
    }
  }
  setInterval(tickNotify, 60000);

  // ICS daily calendar event generator
  function generateICS(){
    const now = new Date();
    const pad = n => String(n).padStart(2,'0');
    const y=now.getFullYear(), m=pad(now.getMonth()+1), d=pad(now.getDate());
    const DTSTART = `${y}${m}${d}T220000`;
    const ics = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//CommissionTracker//PWA//EN",
      "BEGIN:VEVENT",
      `UID:pwa-commission-${y}${m}${d}`,
      `DTSTART:${DTSTART}`,
      "DURATION:PT10M",
      "SUMMARY:یادآوری ثبت قرارداد",
      "RRULE:FREQ=DAILY",
      "END:VEVENT",
      "END:VCALENDAR"
    ].join("\\r\\n");
    const blob = new Blob([ics], {type:'text/calendar;charset=utf-8;'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = "commission_reminder_2200.ics";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function renderChart(labels, data){
    const canvas = E('chart');
    if (window.Chart) {
      if(window.__chart) window.__chart.destroy();
      window.__chart = new Chart(canvas.getContext('2d'), { type:'bar', data:{ labels, datasets:[{label:'فروش روزانه (EUR)', data}] }, options:{ responsive:true, plugins:{legend:{display:false}} } });
      E('chartFallback').style.display='none';
    } else {
      const c = E('chartFallback'); const ctx = c.getContext('2d');
      c.style.display='block';
      const w = c.width, h = c.height;
      ctx.clearRect(0,0,w,h);
      const max = Math.max(1,...data);
      const bw = w/(data.length*1.5+0.5);
      let x = bw;
      data.forEach(v=>{
        const bh = (v/max)* (h*0.9);
        ctx.fillRect(x, h-bh-10, bw, bh);
        x += bw*1.5;
      });
    }
  }

  async function loadReport(){
    const ym = E('reportMonth').value || todayISO().slice(0,7);
    const [start,end,days] = monthStartEnd(ym);
    const list = await idb.between(start,end);
    const totals = Array.from({length:days},()=>0);
    list.forEach(x=>{ const d = Number((x.entryDate||'').split('-')[2]||'0'); if(d>=1&&d<=days) totals[d-1]+=numberOrZero(x.amount); });
    E('monthSum').value = totals.reduce((a,b)=>a+b,0).toFixed(2);
    const labels = totals.map((_,i)=>String(i+1));
    renderChart(labels, totals);
  }

  document.addEventListener('DOMContentLoaded', ()=>{
    safe(setupTabs);
    safe(()=>{ E('dailyDate').value = todayISO(); });
    safe(()=>{ const t = todayISO(); E('reportMonth').value = t.slice(0,7); });

    safe(()=>E('saveBtn').addEventListener('click', ()=>safe(saveContract)));
    safe(()=>E('dailyDate').addEventListener('change', ()=>safe(loadDaily())));
    safe(()=>E('reportMonth').addEventListener('change', ()=>safe(loadReport())));
    safe(()=>E('csvBtn').addEventListener('click', ()=>safe(exportCSVForMonth())));
    safe(()=>E('xlsBtn').addEventListener('click', ()=>safe(exportXLSForMonth())));
    safe(()=>E('enableNotifyBtn').addEventListener('click', ()=>safe(scheduleDailyNotify())));
    safe(()=>E('calendarBtn').addEventListener('click', ()=>safe(generateICS())));

    safe(loadDaily);
    safe(loadReport);
  });
})();
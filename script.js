/* script.js - main UI logic, parser, OCR, IndexedDB tiny wrapper */
(function(){
  // UI refs
  const fileInput = document.getElementById('fileInput');
  const parseBtn = document.getElementById('parseBtn');
  const ocrBtn = document.getElementById('ocrBtn');
  const f_date = document.getElementById('f_date');
  const f_total = document.getElementById('f_total');
  const f_merchant = document.getElementById('f_merchant');
  const f_category = document.getElementById('f_category');
  const f_items = document.getElementById('f_items');
  const saveBtn = document.getElementById('saveBtn');
  const historyList = document.getElementById('historyList');
  const downloadPdfBtn = document.getElementById('downloadPdfBtn');
  const printBtn = document.getElementById('printBtn');
  const exportAllBtn = document.getElementById('exportAllBtn');
  const clearHistoryBtn = document.getElementById('clearHistoryBtn');

  // IndexedDB simple wrapper
  const DB = {
    db: null,
    init: function(){
      return new Promise((res,rej)=>{
        const r = indexedDB.open('anj-invoice-db',1);
        r.onupgradeneeded = e=>{
          const d = e.target.result;
          if(!d.objectStoreNames.contains('bills')) d.createObjectStore('bills',{keyPath:'id'});
        };
        r.onsuccess = e=>{DB.db = e.target.result; res();};
        r.onerror = e=>rej(e);
      });
    },
    save: function(obj){
      return new Promise((res,rej)=>{
        const tx = DB.db.transaction('bills','readwrite');
        const store = tx.objectStore('bills');
        store.put(obj);
        tx.oncomplete = ()=>res();
        tx.onerror = e=>rej(e);
      });
    },
    all: function(){ return new Promise((res,rej)=>{ const tx = DB.db.transaction('bills','readonly'); const store = tx.objectStore('bills'); const req = store.getAll(); req.onsuccess = ()=>res(req.result); req.onerror = rej; }); },
    clear: function(){ return new Promise((res,rej)=>{ const tx = DB.db.transaction('bills','readwrite'); const store = tx.objectStore('bills'); const req = store.clear(); req.onsuccess = ()=>res(); req.onerror = rej; }); }
  };

  // Basic heuristic parser for text -> fields
  function parseText(text){
    const result = { date: null, total: null, merchant: null, items: [], category: 'general' };
    const lines = text.split(/\r?\n/).map(l=>l.trim()).filter(Boolean);

    // merchant: first non-empty line that is not a word like 'invoice'
    for(let i=0;i<3 && i<lines.length;i++){
      const l = lines[i].replace(/\|/g,' ').trim();
      if(!/invoice|bill|tax/i.test(l)) { result.merchant = l; break; }
    }

    // date: try common formats
    const dateRx = /\b((0?[1-9]|[12][0-9]|3[01])[\/\-.](0?[1-9]|1[012])[\/\-.]\d{2,4}|\d{4}[\/\-.](0?[1-9]|1[012])[\/\-.](0?[1-9]|[12][0-9]|3[01])|[A-Za-z]{3,9}\s+\d{1,2},\s*\d{4})\b/;
    for(const l of lines){ const m = l.match(dateRx); if(m){ result.date = m[0]; break; } }

    // total: look for lines containing 'total' or currency symbol
    for(const l of lines.slice(-8)){
      if(/total|grand total|balance due/i.test(l) || /₹|\$|INR|Rs\.?/i.test(l)){
        const num = l.replace(/[^0-9.,]/g,'').replace(/,+/g,'');
        if(num) { result.total = num; break; }
      }
    }
    if(!result.total){
      // fallback scan for largest number
      let max = 0; for(const l of lines){ const num = parseFloat((l.match(/([0-9]+[.,][0-9]{2,})/g)||[]).join('').replace(/,/g,'')); if(num>max) max=num; }
      if(max>0) result.total = String(max);
    }

    // items: best-effort — lines that look like "qty price total"
    const itemRx = /^(.{2,60})\s+(\d+)\s+([0-9.,]+)\s+([0-9.,]+)$/;
    for(const l of lines){
      const m = l.match(itemRx);
      if(m) result.items.push({name:m[1].trim(), qty:m[2], price:m[3], total:m[4]});
    }
    if(result.items.length===0){
      // try a simpler item line with price at end
      for(const l of lines){
        const m = l.match(/^(.{2,60})\s+([0-9.,]+)$/);
        if(m && /[A-Za-z]/.test(m[1])) result.items.push({name:m[1].trim(), price:m[2]});
      }
    }

    // detect category keyword mapping
    const keywordMap = { food: ['restaurant','cafe','grocer','grocery','food','mart'], shopping: ['store','shop','mall','shopping','boutique'], finance: ['bank','payment','upi','transaction','invoice'] };
    for(const [cat,keys] of Object.entries(keywordMap)){
      for(const k of keys) if(text.toLowerCase().includes(k)) { result.category = cat; break; }
    }

    return result;
  }

  // UI utility: show parsed result
  function showParsed(res){
    f_date.textContent = res.date||'-';
    f_total.textContent = res.total? (res.total) : '-';
    f_merchant.textContent = res.merchant||'-';
    f_category.textContent = (res.category||'General');
    f_items.textContent = res.items && res.items.length ? JSON.stringify(res.items,null,2) : 'None detected';

    // show creature badge (if registry present)
    if(window.getCreatureForCategory){
      const c = getCreatureForCategory(res.category);
      if(c){
        // show badge small in merchant area (append)
        f_merchant.parentElement.querySelector('.badge')?.remove();
        const img = document.createElement('img');
        img.src = c.badge;
        img.style.height='32px'; img.style.marginLeft='8px'; img.className='badge';
        f_merchant.parentElement.appendChild(img);
      }
    }
  }

  // read file: PDF or image or txt
  async function extractTextFromFile(file){
    const name = file.name||'file';
    const type = file.type || '';
    if(type === 'text/plain' || name.endsWith('.txt')){
      return file.text();
    }
    if(type.startsWith('image/') || /\.(png|jpg|jpeg)$/i.test(name)){
      // use OCR
      return await ocrFromImageFile(file);
    }
    // assume PDF
    try{
      const arr = new Uint8Array(await file.arrayBuffer());
      const pdf = await pdfjsLib.getDocument({data:arr}).promise;
      let whole = '';
      for(let i=1;i<=Math.min(pdf.numPages,10);i++){
        const page = await pdf.getPage(i);
        const txtContent = await page.getTextContent();
        const pageText = txtContent.items.map(it=>it.str).join(' ');
        whole += pageText + '\n';
      }
      return whole;
    }catch(err){
      // fallback to OCR of first page snapshot
      console.warn('pdf parse failed, fallback to OCR',err);
      return await ocrFromImageFile(file);
    }
  }

  async function ocrFromImageFile(file){
    // Tesseract recognizes images and also PDF pages if converted to image
    try{
      const worker = Tesseract.createWorker({logger:m=>console.debug('tess',m)});
      await worker.load();
      await worker.loadLanguage('eng');
      await worker.initialize('eng');
      const {data: {text}} = await worker.recognize(await file.arrayBuffer());
      await worker.terminate();
      return text;
    }catch(err){
      console.error('OCR failed',err);
      return '';
    }
  }

  // action handlers
  parseBtn.addEventListener('click', async ()=>{
    const f = fileInput.files[0];
    if(!f){ alert('Choose a file first'); return; }
    try{
      const txt = await extractTextFromFile(f);
      const parsed = parseText(txt || '');
      parsed.id = 'bill-' + Date.now();
      parsed.raw = txt.slice(0,10000);
      parsed.fileName = f.name;
      parsed.savedAt = new Date().toISOString();
      window.lastParsed = parsed;
      showParsed(parsed);
    }catch(err){
      alert('Parse failed: ' + (err && err.message || err));
    }
  });

  ocrBtn.addEventListener('click', async ()=>{
    const f = fileInput.files[0];
    if(!f){ alert('Choose a file first'); return; }
    try{
      const txt = await ocrFromImageFile(f);
      const parsed = parseText(txt || '');
      parsed.id = 'bill-' + Date.now();
      parsed.raw = txt.slice(0,10000);
      parsed.fileName = f.name;
      window.lastParsed = parsed;
      showParsed(parsed);
    }catch(err){
      alert('OCR failed: ' + err.message);
    }
  });

  saveBtn.addEventListener('click', async ()=>{
    if(!window.lastParsed) return alert('Nothing to save');
    // save file binary optionally
    const f = fileInput.files[0];
    if(f){
      try{
        const arr = await f.arrayBuffer();
        window.lastParsed.fileData = Array.from(new Uint8Array(arr).slice(0,200000)); // store truncated binary to avoid huge DB
      }catch(e){}
    }
    await DB.save(window.lastParsed);
    refreshHistory();
    alert('Saved to history');
  });

  downloadPdfBtn.addEventListener('click', async ()=>{
    // capture invoice area and create PDF
    const el = document.querySelector('main');
    const canvas = await html2canvas(el, {scale:2});
    const img = canvas.toDataURL('image/jpeg',0.9);
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({orientation:'portrait', unit:'px', format:[canvas.width, canvas.height]});
    pdf.addImage(img, 'JPEG', 0, 0, canvas.width, canvas.height);
    pdf.save('anj-invoice.pdf');
  });

  printBtn.addEventListener('click', ()=> window.print());

  exportAllBtn.addEventListener('click', async ()=>{
    const all = await DB.all();
    const blob = new Blob([JSON.stringify(all,null,2)], {type:'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'anj-history.json'; a.click(); URL.revokeObjectURL(url);
  });

  clearHistoryBtn.addEventListener('click', async ()=>{
    if(!confirm('Clear history?')) return;
    await DB.clear(); refreshHistory();
  });

  async function refreshHistory(){
    const all = await DB.all();
    if(!all.length){ historyList.innerHTML = 'No saved bills yet.'; return; }
    historyList.innerHTML = '';
    all.sort((a,b)=> new Date(b.savedAt)-new Date(a.savedAt));
    all.forEach(item=>{
      const div = document.createElement('div');
      div.className='history-item';
      div.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center">
        <div>
          <strong>${item.merchant||item.fileName||'Bill'}</strong>
          <div style="color:var(--muted);font-size:13px">${item.savedAt}</div>
        </div>
        <div style="text-align:right">
          <div style="font-weight:700">${item.total||'-'}</div>
          <button class="btn" data-id="${item.id}">Load</button>
        </div>
      </div>`;
      historyList.appendChild(div);
      div.querySelector('button').addEventListener('click', ()=>{
        window.lastParsed = item;
        showParsed(item);
      });
    });
  }

  // init db + UI
  (async function init(){
    try{
      await DB.init();
    }catch(e){
      console.warn('IndexedDB init failed',e);
    }
    refreshHistory();
  })();
})();

(() => {
  'use strict';
  const items=window.EXPEDITION_ITEMS;
  const t=key=>(window.INVENTORY_LOCALES[document.documentElement.lang]?.[key]??window.INVENTORY_LOCALES.en[key]??key);
  const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const paths={
    ration:'M16 18h32v34H16z M12 18l4-7h32l4 7 M21 28h22 M21 35h22 M25 44h14',
    cell:'M23 12h18v5h6v37H17V17h6z M35 23l-10 14h9l-5 12 12-17h-9z',
    cutter:'M15 50l24-24 M34 13l9 8 8-3-2 12-9 4-10-10 1-10 M11 48l7 7 7-7-7-7z',
    key:'M34 22a12 12 0 1 1-24 0 12 12 0 0 1 24 0z M31 30l23 23 M44 42l6-6 M49 47l6-6',
    bandage:'M13 20l7-7 34 31-10 10z M20 26l7-8 M37 46l8-9 M26 28l11 10 M23 32l11 10',
    antidote:'M25 10h14v6H25z M27 16v10L15 48q-2 6 6 6h22q8 0 6-6L37 26V16 M22 39h20 M29 43h7 M32 40v9',
    credits:'M12 20q20-14 40 0v8q-20 14-40 0z M12 30v10q20 14 40 0V30 M12 42v10q20 12 40 0V42',
    salvage:'M14 17l14-6 9 9-9 14-14-3z M36 35l13-8 6 19-15 8-10-10z M17 39l9 8-8 9-9-9z',
    relic:'M32 8l20 23-20 25L12 31z M32 8v48 M12 31h40 M32 19l10 12-10 13-10-13z'
  };
  function icon(id){return `<svg class="item-icon" viewBox="0 0 64 64" aria-hidden="true"><path d="${paths[items[id].icon]}"/></svg>`;}
  function btn(text,cmd,disabled=false){return `<button class="btn small" data-inv="${cmd}" ${disabled?'disabled':''}>${esc(text)}</button>`;}
  let storage;try{storage=localStorage;}catch(_){}
  const inventory=new window.ExpeditionInventory(storage);
  let dialog=null,selected=-1,target=null,message='',moving=false,confirmDrop=false,combat=false,onClose=null,mode='bag',eventSpec=null,summary=null,confirmLootClose=false;
  const name=id=>t(id)[0];
  function grid(){return `<div class="inventory-grid" aria-label="16 inventory slots">${inventory.slots.map((s,i)=>`<button class="inventory-slot ${selected===i?'selected':''} ${s?items[s.id].kind:''}" data-inv="slot:${i}" ${s?'draggable="true"':''} title="${s?esc(name(s.id)+' ×'+s.qty):t('empty')}" aria-label="${s?esc(name(s.id)+' ×'+s.qty):t('empty')}">${s?`${icon(s.id)}<span>${esc(name(s.id))}</span><b>${s.qty}</b>`:`<small>${i+1}</small>`}</button>`).join('')}</div>`;}
  function detail(shop=false){const s=inventory.slots[selected];return `<div class="inventory-detail">${s?`${icon(s.id)}<div><h3>${esc(name(s.id))} <small>×${s.qty} / ${items[s.id].stack}</small></h3><p>${esc(t(s.id)[1])}</p><div class="inventory-actions">${shop?btn(t('refund'),'refund'):btn(t('use'),'use',items[s.id].kind!=='supply')}${btn(t('move'),'move')}${btn(t('split'),'split',s.qty<2||!inventory.slots.includes(null))}${!shop?btn(t('discard'),'discard'):''}</div></div>`:`<p>${t('select')}</p>`}${confirmDrop?`<div class="inventory-confirm">${t('discardConfirm')} ${btn(t('confirm'),'confirmDrop')}${btn(t('cancel'),'cancelDrop')}</div>`:''}</div>`;}
  function status(){const run=inventory.run;return `<div class="inventory-status"><span>${t('bank')}: <b>${inventory.state.credits.toLocaleString('en')}</b></span><span><b>${inventory.slots.filter(Boolean).length} / 16</b> ${t('slots')}</span>${run?`<span>${t('energy')}: <b>${Math.ceil(run.energy)} / 100</b></span>`:''}</div>`;}
  function party(){return `<div class="inventory-crew"><label>${t('target')} <select data-crew>${inventory.run.party.filter(u=>u.hp>0).map(u=>`<option value="${esc(u.id)}" ${target===u.id?'selected':''}>${esc(u.name)} · ${u.hp}/${u.maxHp} HP</option>`).join('')}</select></label>${inventory.run.party.map(u=>`<span>${esc(u.name)} · ${u.hp}/${u.maxHp} HP · food ${u.food||0}${u.bleed?' · BLEEDING':''}${u.poison?' · POISONED':''}</span>`).join('')}</div>`;}
  function notice(){return `<p class="inventory-notice" role="status">${esc(message||'')}${inventory.saveFailed?' '+t('saveWarning'):''}</p>`;}
  function shop(host,embark,back,crew=[{food:1,energy:0}],onTrade){
    let purchases={},sales={},quote='',lastQuote=-1,speechTimer=null,screenRef=null;message='';
    function speak(kind){const locale=window.TRADE_LINES[document.documentElement.lang]||window.TRADE_LINES.en;const lines=locale[kind];let n=Math.floor(Math.random()*lines.length);if(n===lastQuote)n=(n+1)%lines.length;lastQuote=n;quote=lines[n];clearTimeout(speechTimer);speechTimer=setTimeout(()=>{quote='';if(screenRef?.isConnected){screenRef.querySelector('.trade-merchant')?.classList.remove('speaking');screenRef.querySelector('.trade-speech')?.classList.remove('visible');}},5000);}
    const total=(list,field)=>Object.entries(list).reduce((n,[id,q])=>n+q*items[id][field],0);
    function render(){
      const cost=total(purchases,'price'),earned=total(sales,'sell'),balance=inventory.state.credits+earned-cost;
      const draft=new window.ExpeditionInventory(null);draft.state=JSON.parse(JSON.stringify(inventory.state));

      let fits=true;for(const [id,q] of Object.entries(purchases)){if(draft.add(id,q)<q)fits=false;}
      const row=(id,q,kind)=>`<div class="trade-row">${icon(id)}<span>${esc(name(id))} ×${q}</span><b>${q*items[id][kind==='buy'?'price':'sell']} ◈</b>${btn('−',`minus:${kind}:${id}`)}${btn('×',`remove:${kind}:${id}`)}</div>`;
      host.innerHTML=`<section class="trade-screen"><header class="trade-top"><span>◈ ${inventory.state.credits.toLocaleString('en')}</span>${btn(t('back'),'back')}</header><div class="trade-columns"><section class="trade-panel"><h2>${t('bag')} <small>${inventory.slots.filter(Boolean).length}/16</small></h2><div class="trade-grid">${inventory.slots.map((stack,i)=>`<button class="trade-slot" data-inv="sell:${i}" title="${stack?esc(name(stack.id)+' · '+items[stack.id].sell+' ◈ / 1'):t('empty')}" ${stack?'':'disabled'}>${stack?`${icon(stack.id)}<b>${stack.qty}</b><small>${items[stack.id].sell} ◈</small>`:''}</button>`).join('')}</div><div class="trade-selection">${Object.entries(sales).map(([id,q])=>row(id,q,'sell')).join('')||`<p>${t('selectToSell')}</p>`}</div><footer><b>${earned} ◈</b>${btn(t('sell'),'sell-confirm',!earned)}</footer></section><section class="trade-panel"><h2>${t('merchantStock')}</h2><div class="trade-grid">${Object.entries(items).filter(([,i])=>i.price).map(([id,item])=>`<button class="trade-slot" data-inv="buy:${id}" title="${esc(name(id)+' · '+t(id)[1])}" ${['bandage','antidote'].includes(id)?'disabled':''}>${icon(id)}<small>${item.price} ◈</small>${purchases[id]?`<b>+${purchases[id]}</b>`:''}</button>`).join('')}</div><div class="trade-selection">${Object.entries(purchases).map(([id,q])=>row(id,q,'buy')).join('')||`<p>${t('selectToBuy')}</p>`}</div><footer><b>${cost} ◈</b>${btn(t('buy'),'buy-confirm',!cost||cost>inventory.state.credits||!fits)}</footer></section></div><aside class="trade-merchant ${quote?'speaking':''}"><img src="npcs/market.png" alt="Merchant"><div class="trade-speech ${quote?'visible':''}" role="status">${esc(quote)}</div></aside><div class="trade-bottom">${btn(t('clearBasket'),'clear',!cost&&!earned)}<span>${esc(message||(!fits?t('full'):cost>inventory.state.credits?t('poor'):t('tradeCompactHint')))}</span></div></section>`;
      screenRef=host.querySelector('.trade-screen');
      host.onclick=e=>{
        const button=e.target.closest('[data-inv]');if(!button||button.disabled)return;e.stopPropagation();message='';const cmd=button.dataset.inv;
        if(cmd==='back'){clearTimeout(speechTimer);back();return;}
        if(cmd.startsWith('buy:')){const id=cmd.slice(4);purchases[id]=(purchases[id]||0)+(e.shiftKey?items[id].stack:1);}
        else if(cmd.startsWith('sell:')){const stack=inventory.slots[Number(cmd.slice(5))];if(stack){const q=Math.min(inventory.count(stack.id)-(sales[stack.id]||0),e.shiftKey?stack.qty:1);if(q>0)sales[stack.id]=(sales[stack.id]||0)+q;}}
        else if(cmd==='clear'){purchases={};sales={};}
        else if(cmd==='buy-confirm'||cmd==='sell-confirm'){const buying=cmd==='buy-confirm';const error=inventory.trade(buying?purchases:{},buying?{}:sales);message=t(error||'tradeComplete');if(!error){if(buying)purchases={};else sales={};speak(buying?'buy':'sell');onTrade?.();}}
        else if(cmd==='loadout'){
          const desired={ration:Math.max(1,Math.ceil(crew.reduce((n,u)=>n+(u.food??1),0)*4)),cell:4+Math.ceil(crew.reduce((n,u)=>n+(u.energy||0),0)/2),cutter:1,key:1};
          for(const [id,q] of Object.entries(desired)){const missing=Math.max(0,q-inventory.count(id)+(sales[id]||0));if(missing)purchases[id]=missing;}
        }else if(cmd.startsWith('minus:')||cmd.startsWith('remove:')){const [op,kind,id]=cmd.split(':');const list=kind==='buy'?purchases:sales;if(op==='remove'||list[id]<=1)delete list[id];else list[id]--;}
        render();
      };
      host.onchange=null;host.ondragstart=null;host.ondragover=null;host.ondrop=null;
    }
    speak('greeting');
    render();
  }
  function wire(host,refresh,extra){
    host.onclick=e=>{const b=e.target.closest('[data-inv]');if(!b||b.disabled)return;e.stopPropagation();const cmd=b.dataset.inv;message='';
      if(extra?.(cmd,e))return;
      if(cmd.startsWith('slot:')){const index=Number(cmd.slice(5));if(moving&&selected>=0){inventory.move(selected,index);moving=false;}selected=index;confirmDrop=false;}
      else if(cmd==='refund'){inventory.refund(selected);selected=-1;}
      else if(cmd==='move'){moving=true;message='Select a destination slot.';}
      else if(cmd==='split'){inventory.split(selected);}
      else if(cmd==='discard'){confirmDrop=true;}
      else if(cmd==='cancelDrop'){confirmDrop=false;}
      else if(cmd==='confirmDrop'){inventory.drop(selected);selected=-1;confirmDrop=false;}
      else if(cmd==='use'){const s=inventory.slots[selected];if(s)message=t(inventory.use(s.id,target,{combat})||'');}
      refresh();
    };
    host.onchange=e=>{if(e.target.matches('[data-crew]'))target=e.target.value;else if(e.target.matches('[data-difficulty]')&&!inventory.run&&window.EXPEDITION_DIFFICULTIES[e.target.value]){inventory.state.difficulty=e.target.value;inventory.save();refresh();}};
    host.ondragstart=e=>{const b=e.target.closest('[data-inv^="slot:"]');if(b)e.dataTransfer.setData('text/plain',b.dataset.inv.slice(5));};
    host.ondragover=e=>{if(e.target.closest('[data-inv^="slot:"]'))e.preventDefault();};
    host.ondrop=e=>{const b=e.target.closest('[data-inv^="slot:"]'),raw=e.dataTransfer.getData('text/plain');if(!b||!/^\d+$/.test(raw))return;e.preventDefault();inventory.move(Number(raw),Number(b.dataset.inv.slice(5)));refresh();};
  }
  function close(){if(!dialog)return;dialog.close();dialog.remove();dialog=null;const cb=onClose;onClose=null;cb?.();}
  function requestClose(){
    if(mode==='loot'&&inventory.run?.pendingLoot.length){confirmLootClose=true;renderDialog();}
    else close();
  }
  function renderDialog(){
    if(!dialog)return;
    if(mode==='summary'){
      dialog.innerHTML=`<header><h2>${t('returnTitle')}</h2></header><p>${t(summary.defeated?'lost':summary.fled?'fled':'returned')}</p><p>${t('difficulty')}: ${t(summary.difficulty||'normal')}</p><div class="debrief-accounting"><p>${t('gross')} <b>${summary.gross} ◈</b></p><p class="debrief-penalty">${t('retreatPenalty')} (${Math.round(summary.lossRate*100)}%) <b>−${summary.penalty} ◈</b></p></div><h3>${t('net')}: +${summary.earned} ${t('bank')}</h3><p>Total: ${summary.balance} ${t('bank')}</p><div class="cargo-summary">${summary.cargo.map(s=>`<p>${esc(name(s.id))} ×${s.qty} <b>${summary.defeated?'Lost':s.value+' ◈'}</b></p>`).join('')}</div>${btn(t('close'),'close')}`;
      wire(dialog,renderDialog,cmd=>{if(cmd==='close'){close();return true;}});return;
    }
    const loot=inventory.run.pendingLoot;
    dialog.innerHTML=`<header><h2>${mode==='loot'?t('loot'):mode==='event'?esc(eventSpec.title):t('bag')}</h2>${['bag','loot'].includes(mode)?btn(t('close'),'close'):''}</header>${status()}${mode==='event'?`<div class="expedition-event"><p>${esc(eventSpec.text)}</p><div class="inventory-actions">${eventSpec.actions.map((a,i)=>btn(a.label,'event:'+i,a.disabled)).join('')}</div></div>`:''}${mode==='loot'?`<div class="loot-pile">${loot.map((s,i)=>`<button class="supply-product" data-inv="take:${i}">${icon(s.id)}<span>${esc(name(s.id))} ×${s.qty}</span><b>${t('take')}</b></button>`).join('')}</div><div class="inventory-actions">${btn(t('takeAll'),'takeAll',!loot.length)}${btn(t('close'),'close')}</div>${confirmLootClose?`<div class="loot-close-confirm" role="alert"><p>${t('leaveConfirm')}</p>${btn(t('leave'),'leaveConfirmed')} ${btn(t('keep'),'keepSorting')}</div>`:''}`:''}${party()}${grid()}${detail()}${notice()}`;
    wire(dialog,renderDialog,cmd=>{
      if(cmd==='close'){requestClose();return true;}
      if(cmd.startsWith('event:')){const action=eventSpec.actions[Number(cmd.slice(6))];if(action.disabled)return false;close();action.run();return true;}
      if(cmd.startsWith('take:')){if(!inventory.take(Number(cmd.slice(5))))message=t('full');}
      if(cmd==='takeAll'){for(let i=inventory.run.pendingLoot.length-1;i>=0;i--)inventory.take(i);if(inventory.run.pendingLoot.length)message=t('full');}
      if(cmd==='keepSorting'){confirmLootClose=false;return false;}
      if(cmd==='leaveConfirmed'){inventory.run.pendingLoot=[];inventory.save();close();return true;}
    });
  }
  function open(options={}){
    if(dialog)return;
    mode=options.mode||'bag';combat=!!options.combat;onClose=options.onClose;eventSpec=options.event;summary=options.summary;
    target=inventory.run?.party.find(u=>u.hp>0)?.id;selected=-1;message='';moving=false;confirmDrop=false;confirmLootClose=false;
    dialog=document.createElement('dialog');dialog.className='inventory-dialog';dialog.setAttribute('aria-label',t('bag'));document.body.append(dialog);
    dialog.addEventListener('cancel',e=>{e.preventDefault();if(['bag','summary','loot'].includes(mode))requestClose();});
    renderDialog();dialog.showModal();
  }
  window.Supplies={inventory,t,icon,shop,open,close,get isOpen(){return !!dialog;}};
})();

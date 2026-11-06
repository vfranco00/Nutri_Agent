/* eslint-disable */
// @ts-nocheck
// Animações da landing (hero com etiquetas, digitação do Agente, faixa de comidas).
// Portado de docs/design/15-landing.html. Devolve a função que para os timers.
export function iniciarLanding(): () => void {

const R=Math.PI/180;
function wedge(cx,cy,ri,ro,a0,a1){const p=(r,a)=>`${(cx+r*Math.cos(a*R)).toFixed(2)} ${(cy+r*Math.sin(a*R)).toFixed(2)}`;return `M${p(ri,a0)} L${p(ro,a0)} A${ro} ${ro} 0 0 1 ${p(ro,a1)} L${p(ri,a1)} A${ri} ${ri} 0 0 0 ${p(ri,a0)} Z`}
function slice(rind,cut,gomo,face){let g='';for(let i=0;i<8;i++){const a=i*45-90;g+=`<path d="${wedge(50,50,6,31,a+5,a+40)}" fill="${gomo}"/>`}
 const f=face?'<circle cx="42" cy="48" r="5.5" fill="#fff"/><circle cx="58" cy="48" r="5.5" fill="#fff"/><circle cx="43.1" cy="48.8" r="2.9" fill="#1C1712"/><circle cx="59.1" cy="48.8" r="2.9" fill="#1C1712"/><path d="M43 60 Q50 66 57 60" fill="none" stroke="#1C1712" stroke-width="3.6" stroke-linecap="round"/>':'';
 return `<svg viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="41" fill="${rind}"/><circle cx="50" cy="50" r="35" fill="${cut}"/>${g}${f}</svg>`}
document.querySelectorAll('.slot-logo').forEach(e=>e.outerHTML=slice('#E8590C','#FFF6EC','#FF9A52').replace('<svg','<svg width="30" height="30"'));
document.querySelectorAll('.slot-logo-dark').forEach(e=>e.outerHTML=slice('#FF6A26','#1A120B','#FFB07A').replace('<svg','<svg width="30" height="30"'));
document.querySelectorAll('.slot-logo-or').forEach(e=>e.outerHTML=slice('#FFF6EC','#E8590C','#FFF6EC').replace('<svg','<svg width="30" height="30"'));
document.querySelectorAll('.slot-masc').forEach(e=>e.outerHTML=slice('#E8590C','#FFF6EC','#FF9A52',1).replace('<svg','<svg width="38" height="38"'));
document.querySelectorAll('.slot-masc-big').forEach(e=>e.outerHTML=slice('#E8590C','#fff','#FF9A52',1).replace('<svg','<svg width="130" height="130"'));
/* logo B: a fatia é o pingo do i */
const PINGO={claro:['#E8590C','#FFF6EC','#FF9A52'],escuro:['#FF6A26','#1C1712','#FFB07A']};
document.querySelectorAll('[data-pingo]').forEach(el=>{const [r,c,g]=PINGO[el.dataset.pingo];el.innerHTML=`nuv<span class="i">ı<svg viewBox="0 0 100 100" aria-hidden="true">${slice(r,c,g).replace(/^<svg[^>]*>|<\/svg>$/g,'')}</svg></span>`;el.setAttribute('aria-label','nuvi')});
const reduce=window.matchMedia('(prefers-reduced-motion: reduce)').matches;



/* A: grãos, feijões, farofa e etiquetas */
(function(){let s='';for(let i=0;i<70;i++){const x=128+Math.random()*130,y=128+Math.random()*92;const dx=(x-190)/70,dy=(y-180)/50;if(dx*dx+dy*dy>1)continue;s+=`<ellipse cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" rx="4.5" ry="2" transform="rotate(${(Math.random()*180).toFixed(0)} ${x.toFixed(1)} ${y.toFixed(1)})"/>`}
 s='';for(let i=0;i<40;i++){const x=270+Math.random()*120,y=118+Math.random()*125;const dx=(x-332)/58,dy=(y-180)/60;if(dx*dx+dy*dy>1)continue;s+=`<ellipse cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" rx="6" ry="4" transform="rotate(${(Math.random()*180).toFixed(0)} ${x.toFixed(1)} ${y.toFixed(1)})"/>`}
 s='';for(let i=0;i<60;i++){const x=170+Math.random()*90,y=384+Math.random()*52;const dx=(x-218)/46,dy=(y-410)/24;if(dx*dx+dy*dy>1)continue;s+=`<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="1.6"/>`}
 const foods=[['Pão de queijo','99 kcal'],['Tapioca com queijo','214 kcal'],['Açaí 300 ml','262 kcal'],['Feijoada','346 kcal'],['Cuscuz nordestino','113 kcal'],['Coxinha','283 kcal'],['Banana-prata','98 kcal'],['Café com leite','86 kcal'],['Moqueca de peixe','188 kcal'],['Pamonha','171 kcal'],['Brigadeiro','71 kcal'],['Mandioca cozida','125 kcal']];
 const h=foods.map(([n,k])=>`<span>${n}<i>${k}</i></span>`).join('');document.getElementById('mq').innerHTML=h+h;})();
let timers=[];const T=(f,ms)=>timers.push(setTimeout(f,ms));
function clear(){timers.forEach(clearTimeout);timers=[]}
function startA(){const tags=[...document.querySelectorAll('#A .tag')],tot=document.getElementById('totalA'),arc=document.querySelector('.arcA');
 tags.forEach(t=>t.classList.remove('show'));tot.classList.remove('show');arc.style.strokeDashoffset=100;
 tags.forEach(t=>t.parentElement.classList.remove('show'));tags.forEach((t,i)=>T(()=>{t.classList.add('show');t.parentElement.classList.add('show')},reduce?0:500+i*420));T(()=>{tot.classList.add('show');T(()=>arc.style.strokeDashoffset=100-41,60)},reduce?0:500+tags.length*420+200)}

/* B: digitação e resposta */
const DB={arroz:['Arroz branco cozido','4 col. de sopa',164],feij:['Feijão carioca','1 concha',76],bife:['Bife grelhado','100 g',219],salad:['Salada de alface e tomate','1 prato',22],ovo:['Ovo mexido','2 unidades',190],'pão':['Pão francês','1 unidade',150],pao:['Pão francês','1 unidade',150],tapioca:['Tapioca','1 média',142],queijo:['Queijo minas','1 fatia',72],'café':['Café com leite','1 xícara',86],cafe:['Café com leite','1 xícara',86],'açaí':['Açaí','300 ml',262],acai:['Açaí','300 ml',262],banana:['Banana-prata','1 unidade',98],frango:['Peito de frango grelhado','100 g',159],farofa:['Farofa','2 col. de sopa',81],cuscuz:['Cuscuz','1 pedaço',113],iogurte:['Iogurte natural','1 pote',105]};
const LINES=['arroz, feijão, bife e salada','2 ovos mexidos e um pão francês','tapioca com queijo e café','um açaí com banana'];
function parse(t){t=t.toLowerCase();const out=[],seen=new Set();Object.keys(DB).forEach(k=>{if(t.includes(k)&&!seen.has(DB[k][0])){seen.add(DB[k][0]);out.push(DB[k])}});return out}
function showItems(list){const box=document.getElementById('itemsB'),fl=document.getElementById('flB'),kB=document.getElementById('kB');box.innerHTML='';fl.style.width='0%';let tot=0;
 if(!list.length){box.innerHTML='<div class="it show">Não achei na TACO.<span>No app, você busca o item ou cria o seu.</span></div>';kB.textContent='0 / 2.000 kcal';return}
 list.forEach((d,i)=>{const el=document.createElement('div');el.className='it';el.innerHTML=`<div>${d[0]}<span>${d[1]} · TACO</span></div><b>${d[2]} kcal</b>`;box.appendChild(el);T(()=>{el.classList.add('show');tot+=d[2];kB.textContent=`${tot.toLocaleString('pt-BR')} / 2.000 kcal`;fl.style.width=Math.min(100,tot/20)+'%'},reduce?0:i*260)})}
let li=0;
function typeLine(){const s=LINES[li%LINES.length],el=document.getElementById('typed');el.textContent='';showItems([]);document.getElementById('itemsB').innerHTML='';
 let i=0;const step=()=>{el.textContent=s.slice(0,++i);if(i<s.length)T(step,reduce?0:45);else{T(()=>showItems(parse(s)),250);T(()=>{li++;typeLine()},4200)}};T(step,400)}
function startB(){typeLine()}
document.getElementById('tryB').onsubmit=e=>{e.preventDefault();clear();const v=document.getElementById('tryIn').value.replace(/^comi\s*/i,'');document.getElementById('typed').textContent=v;showItems(parse(v))};



startA();startB();
return ()=>clear();

}

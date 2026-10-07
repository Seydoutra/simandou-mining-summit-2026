export function createHeaderBrandLockup(React) {
 const h=React.createElement;
 return function HeaderBrandLockup({lang='fr',href='/',solid=false}) {
  const [fallback,setFallback]=React.useState(false);
  const [unavailable,setUnavailable]=React.useState(false);
  return h('div',{className:'header-brand-lockup'},
   h('a',{className:'header-brand',href,'aria-label':'SIMANDOU MINING SUMMIT 2026'},
    unavailable?h('span',{role:'img','aria-label':'Simandou Mining Summit 2026'},(lang==='zh'?'标志暂不可用 — ':lang==='en'?'Logo unavailable — ':'Logo indisponible — ')+'SIMANDOU MINING SUMMIT 2026'):
    h('img',{src:fallback?'/simandou-mining-summit-2026/assets/logos/summit.webp':'/simandou-mining-summit-2026/assets/brand/simandou-summit-light.svg',alt:'Simandou Mining Summit 2026',onError:()=>fallback?setUnavailable(true):setFallback(true),className:fallback?'raster-fallback':''})),
   h('img',{className:'header-destination',src:'/simandou-mining-summit-2026/assets/logos/guinea.webp',alt:lang==='zh'?'目的地：几内亚':lang==='en'?'Destination Guinea':'Destination Guinée',onError:e=>{e.currentTarget.style.display='none';}}));
 };
}

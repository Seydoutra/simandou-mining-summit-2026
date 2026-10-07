// Source: https://www.simandouminingsummit.com/welcome/register-now
// Checked 2026-09-15. No unpublished Standard rates are inferred.
export const pricing = Object.freeze({phase:'Early Bird', expiresOn:'2026-10-01', taxRate:0.18,
 national:[999,899,799,699], international:[2299,2099,1599,null],
 officialUrl:'https://www.simandouminingsummit.com/welcome/register-now'});
export function ratesCurrent(now = new Date()) {return now.toISOString().slice(0,10) < pricing.expiresOn;}
export function calculatePass(kind, quantity, taxRate=pricing.taxRate, now=new Date()) {
 const count=Math.max(1,Math.min(999,Math.trunc(Number.isFinite(quantity)?quantity:1)));
 const unit=ratesCurrent(now)?pricing[kind][Math.min(count,4)-1]:null;
 const subtotal=unit===null?null:unit*count;
 const taxes=subtotal===null?null:Math.round(subtotal*taxRate*100)/100;
 return {quantity:count,unit,quote:unit===null,subtotal,taxes,total:subtotal===null?null:Math.round((subtotal+taxes)*100)/100,saving:subtotal===null?null:pricing[kind][0]*count-subtotal};
}
export const priceCopy={
 fr:{active:'Early Bird · échéance annoncée : 1er octobre 2026',lead:'Tarifs Early Bird, hors taxes. TVA de 18 %. Réservation sur la plateforme officielle.',expired:'Tarifs à actualiser · consulter la billetterie officielle',pending:'Les tarifs de la nouvelle phase ne sont pas encore intégrés. Consultez la billetterie officielle pour obtenir le prix en vigueur.',cta:'Réserver sur la billetterie officielle',quote:'Demander un devis à l’équipe'},
 en:{active:'Early Bird · announced deadline: 1 October 2026',lead:'Early Bird rates, excluding 18% VAT. Book through the official platform.',expired:'Rates awaiting update · check official ticketing',pending:'The new pricing phase has not yet been integrated. Check the official ticketing platform for current rates.',cta:'Book on the official ticketing platform',quote:'Request a group quote'},
 zh:{active:'早鸟价 · 公布截止日期：2026年10月1日',lead:'早鸟价格未含18%增值税。请通过官方平台预订。',expired:'票价待更新 · 请查看官方售票平台',pending:'新阶段价格尚未更新。请前往官方售票平台查询当前价格。',cta:'前往官方售票平台预订',quote:'向团队申请团体报价'}
};

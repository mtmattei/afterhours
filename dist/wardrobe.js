(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.AfterhoursWardrobe=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const hair=[['crop','Tousled crop'],['curls','Cloud curls'],['bob','Blunt bob'],['braids','Long braids'],['shag','Side-part shag'],['bun','High bun']];
 const tops=[['tee','Pocket tee'],['hoodie','Zip hoodie'],['varsity','Varsity jacket'],['overshirt','Open overshirt']];
 const bottoms=[['jeans','Straight jeans'],['cargo','Cargo trousers'],['wide','Wide-leg trousers'],['shorts','Utility shorts']];
 const colors=[['ink','Ink','#34313d'],['cream','Oat','#ded3bd'],['moss','Moss','#899866'],['cobalt','Cobalt','#4a69a8'],['rose','Rose','#c88298'],['lilac','Lilac','#a28ac5'],['clay','Clay','#c87850'],['teal','Teal','#539c98'],['cherry','Cherry','#ba485c'],['gold','Honey','#d4ae5c'],['snow','Cloud','#e5e8e7'],['plum','Plum','#79577d']];
 const hairColors=[['espresso','Espresso','#43322c'],['black','Soft black','#292733'],['chestnut','Chestnut','#8a4f33'],['copper','Copper','#ba693e'],['blonde','Honey blonde','#d3b16f'],['silver','Silver','#b6bac5'],['lilac','Lilac','#a28ac5'],['rose','Rose','#c88298'],['teal','Teal','#539c98']];
 const skinColors=[['porcelain','Porcelain','#f1c8aa'],['sand','Sand','#dcaa83'],['warm','Warm','#c88c66'],['bronze','Bronze','#ac704e'],['umber','Umber','#825138'],['deep','Deep','#57392e']];
 const defaults={version:1,hair:'crop',top:'hoodie',bottom:'cargo',hairColor:'chestnut',topColor:'moss',bottomColor:'ink',skin:'sand'};
 const groups={hair,tops,bottoms,colors,hairColors,skinColors};
 const choices={hair,top:tops,bottom:bottoms,hairColor:hairColors,topColor:colors,bottomColor:colors,skin:skinColors};
 function normalize(raw){if(!raw||typeof raw!=='object'||Array.isArray(raw))return null;const result={version:1};for(const [field,options] of Object.entries(choices))result[field]=options.some(([id])=>id===raw[field])?raw[field]:defaults[field];return result;}
 function validate(raw){if(!raw||typeof raw!=='object'||Array.isArray(raw)||raw.version!==1)throw Error('Choose a valid outfit.');for(const [field,options] of Object.entries(choices))if(!options.some(([id])=>id===raw[field]))throw Error('Choose a valid '+field+'.');return normalize(raw);}
 function fromLegacy(index=0){return normalize([
  defaults,{hair:'curls',top:'tee',bottom:'wide',hairColor:'espresso',topColor:'clay',bottomColor:'cream',skin:'bronze'},
  {hair:'bob',top:'hoodie',bottom:'cargo',hairColor:'lilac',topColor:'plum',bottomColor:'cobalt',skin:'porcelain'},
  {hair:'crop',top:'varsity',bottom:'jeans',hairColor:'black',topColor:'cobalt',bottomColor:'ink',skin:'sand'},
  {hair:'braids',top:'tee',bottom:'cargo',hairColor:'espresso',topColor:'cherry',bottomColor:'ink',skin:'umber'},
  {hair:'shag',top:'overshirt',bottom:'wide',hairColor:'black',topColor:'ink',bottomColor:'moss',skin:'porcelain'}
 ][index]||defaults);}
 const key=outfit=>JSON.stringify(normalize(outfit));
 function colour(group,id){return groups[group].find(x=>x[0]===id)?.[2]||'#888888';}
 return {hair,tops,bottoms,colors,hairColors,skinColors,defaults,choices,normalize,validate,fromLegacy,key,colour};
});

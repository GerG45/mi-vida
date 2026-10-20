export type GroceryCategory = 'verduleria' | 'almacen' | 'lacteos' | 'carnes' | 'limpieza' | 'otros';
export type GroceryFilter = 'pending' | 'all' | 'checked';
export interface GroceryItem {
  id: string;
  name: string;
  quantity: string;
  category: GroceryCategory;
  checked: boolean;
  createdAt: number;
}
export const groceryCategories: readonly {id:GroceryCategory;label:string}[] = [
  {id:'verduleria',label:'Verdulería'}, {id:'almacen',label:'Almacén'},
  {id:'lacteos',label:'Lácteos y huevos'}, {id:'carnes',label:'Carnes'},
  {id:'limpieza',label:'Limpieza'}, {id:'otros',label:'Otros'},
];
const fields=['id','name','quantity','category','checked','createdAt'];
const object=(value:unknown):value is Record<string,unknown> => !!value&&typeof value==='object'&&!Array.isArray(value);
const text=(value:unknown,max:number):value is string => typeof value==='string'&&value.length<=max&&!/[\u0000-\u001f\u007f]/.test(value);
export function normalizeGroceryItem(value:unknown,key?:string):GroceryItem|undefined {
  if(!object(value)||Object.keys(value).length!==fields.length||!Object.keys(value).every(field=>fields.includes(field)))return;
  if(typeof value.id!=='string'||!/^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,159}$/.test(value.id)||['__proto__','constructor','prototype'].includes(value.id)||key!==undefined&&key!==value.id)return;
  if(!text(value.name,160)||!value.name.trim()||!text(value.quantity,60)||!groceryCategories.some(category=>category.id===value.category)||typeof value.checked!=='boolean')return;
  if(typeof value.createdAt!=='number'||!Number.isSafeInteger(value.createdAt)||value.createdAt<0||value.createdAt>8_640_000_000_000_000)return;
  return {id:value.id,name:value.name,quantity:value.quantity,category:value.category as GroceryCategory,checked:value.checked,createdAt:value.createdAt};
}
export function createGroceryItem(input:{id:string;name:string;quantity?:string;category?:GroceryCategory;now?:number}):GroceryItem {
  const item=normalizeGroceryItem({id:input.id,name:input.name.trim(),quantity:(input.quantity||'').trim(),category:input.category||'otros',checked:false,createdAt:input.now??Date.now()});
  if(!item)throw new Error('Revisá el nombre y la cantidad del producto.');
  return item;
}
export function getGrocerySummary(items:Record<string,GroceryItem>):{total:number;pending:number;checked:number} {
  const values=Object.values(items),checked=values.filter(item=>item.checked).length;
  return {total:values.length,pending:values.length-checked,checked};
}
export function getGroceryGroups(items:Record<string,GroceryItem>,filter:GroceryFilter='pending'):{category:GroceryCategory;label:string;items:GroceryItem[]}[] {
  const values=Object.values(items).filter(item=>filter==='all'||item.checked===(filter==='checked'));
  return groceryCategories.map(category=>({category:category.id,label:category.label,items:values.filter(item=>item.category===category.id).sort((a,b)=>Number(a.checked)-Number(b.checked)||a.createdAt-b.createdAt||a.id.localeCompare(b.id))})).filter(group=>group.items.length>0);
}

import { useEffect, useMemo, useRef, useState, type Dispatch, type FormEvent, type ReactNode, type SetStateAction } from 'react';
import { createGroceryItem, getGroceryGroups, getGrocerySummary, groceryCategories, normalizeGroceryItem, type GroceryCategory, type GroceryFilter, type GroceryItem } from '../lib/groceryList';
import './groceryList.css';

export type GroceryListProps={items:Record<string,GroceryItem>;setItems:Dispatch<SetStateAction<Record<string,GroceryItem>>>;cloudMode?:string;scope?:string|null};
type GlyphName=GroceryCategory|'basket'|'plus'|'check'|'edit'|'delete'|'restore';
function Glyph({name,size=20}:{name:GlyphName;size?:number}) {
  const paths:Record<GlyphName,ReactNode>={
    basket:<><path d="m5 9 4-6m10 6-4-6M3 9h18l-2 12H5L3 9ZM9 13v4m6-4v4"/></>,
    verduleria:<><path d="M20 3C9 2 3 8 6 15s15 4 14-12ZM4 21 15 9"/></>,
    almacen:<><path d="M6 3h12l-1 5 3 5v8H4v-8l3-5-1-5ZM7 8h10M8 14h8m-8 3h5"/></>,
    lacteos:<><path d="M6 9 9 3h7l3 6v12H6V9Zm0 0h13M9 3l3 6v12M12 13h4"/></>,
    carnes:<><path d="M15 4c5-1 8 4 5 8-2 3-5 2-7 4-2 3-5 6-8 3s-1-7 2-8c3-1 5-6 8-7Z"/><circle cx="15" cy="9" r="2"/></>,
    limpieza:<><path d="M9 3h9v4h-4v4c4 2 5 5 5 10H6c0-5 1-8 4-10V7H9V3Zm5 4h5m-9 8h5"/></>,
    otros:<><path d="m3 7 9-4 9 4v12l-9 3-9-3V7Zm0 0 9 4 9-4m-9 4v11M7 5l9 4"/></>,
    plus:<path d="M12 5v14M5 12h14"/>,check:<path d="m5 12 4 4L19 6"/>,
    edit:<><path d="m4 16-1 5 5-1L21 7l-4-4zM14 6l4 4"/></>,delete:<><path d="M4 6h16M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7m4-7v7"/></>,
    restore:<><path d="M3 10a9 9 0 1 1 1 8M3 4v6h6"/></>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}
function CategorySelect({value,onChange,id}:{value:GroceryCategory;onChange:(value:GroceryCategory)=>void;id:string}) {
  return <label className="grocery-field" htmlFor={id}><span>Sector</span><select id={id} value={value} onChange={event=>onChange(event.target.value as GroceryCategory)}>{groceryCategories.map(category=><option key={category.id} value={category.id}>{category.label}</option>)}</select></label>;
}

export function GroceryList({items,setItems,cloudMode,scope}:GroceryListProps) {
  const [name,setName]=useState(''),[quantity,setQuantity]=useState(''),[category,setCategory]=useState<GroceryCategory>('otros');
  const [filter,setFilter]=useState<GroceryFilter>('pending'),[editing,setEditing]=useState<string|null>(null);
  const [undo,setUndo]=useState<{items:Record<string,GroceryItem>;message:string;scope:string|null|undefined}|null>(null),[error,setError]=useState(''),[announcement,setAnnouncement]=useState('');
  const nameInput=useRef<HTMLInputElement>(null),editButton=useRef<HTMLButtonElement|null>(null);
  const summary=useMemo(()=>getGrocerySummary(items),[items]),groups=useMemo(()=>getGroceryGroups(items,filter),[items,filter]);
  useEffect(()=>{setUndo(null);setEditing(null);setName('');setQuantity('');setError('');setAnnouncement('');},[scope]);
  useEffect(()=>{if(!undo)return;const timer=window.setTimeout(()=>setUndo(null),20000);return()=>window.clearTimeout(timer);},[undo]);
  useEffect(()=>{if(editing&&!items[editing])setEditing(null);},[items,editing]);
  function add(event:FormEvent) {
    event.preventDefault();setError('');
    try {const item=createGroceryItem({id:crypto.randomUUID(),name,quantity,category});setItems(current=>({...current,[item.id]:item}));setName('');setQuantity('');setFilter('pending');setAnnouncement(`${item.name} agregado a la lista.`);nameInput.current?.focus();}
    catch(caught){setError(caught instanceof Error?caught.message:'No se pudo agregar el producto.');}
  }
  function toggle(item:GroceryItem) {
    setItems(current=>current[item.id]?{...current,[item.id]:{...current[item.id],checked:!current[item.id].checked}}:current);
    setAnnouncement(item.checked?`${item.name} vuelve a pendientes.`:`${item.name}, comprado.`);
  }
  function remove(ids:string[]) {
    const removed=Object.fromEntries(ids.filter(id=>items[id]).map(id=>[id,items[id]]));if(!Object.keys(removed).length)return;
    setItems(current=>Object.fromEntries(Object.entries(current).filter(([id])=>!ids.includes(id))));
    setUndo({items:removed,message:ids.length===1?`${Object.values(removed)[0].name} se quitó de la lista.`:`Se quitaron ${Object.keys(removed).length} productos comprados.`,scope});setAnnouncement('');
  }
  function restore() {
    if(!undo||undo.scope!==scope)return;
    setItems(current=>({...undo.items,...current}));setAnnouncement('Productos recuperados.');setUndo(null);
  }
  function saveEdit(event:FormEvent<HTMLFormElement>,item:GroceryItem) {
    event.preventDefault();const data=new FormData(event.currentTarget),updated=normalizeGroceryItem({...item,name:String(data.get('name')||'').trim(),quantity:String(data.get('quantity')||'').trim(),category:String(data.get('category')||'otros')},item.id);
    if(!updated){setError('Revisá el nombre y la cantidad del producto.');return;}
    setItems(current=>current[item.id]?{...current,[item.id]:{...current[item.id],name:updated.name,quantity:updated.quantity,category:updated.category}}:current);setEditing(null);setError('');setAnnouncement(`${updated.name} actualizado.`);editButton.current?.focus();
  }

  return <div className="grocery-page">
    <section className="grocery-hero"><div><p className="eyebrow">LO COTIDIANO, MÁS LIVIANO</p><h1>Una lista, menos vueltas.</h1><p>Anotá lo que falta y llevalo a mano cuando pases por el súper.</p></div><div className="grocery-hero-art"><span/><Glyph name="basket" size={72}/><svg className="grocery-sprig" viewBox="0 0 80 100" fill="none" aria-hidden="true"><path d="M39 96C43 65 43 36 56 10" stroke="currentColor" strokeWidth="2"/><path d="M43 70C13 75 8 55 8 43c21 1 34 9 35 27ZM44 55C68 58 77 38 76 28 58 29 46 38 44 55ZM50 30C29 30 26 14 28 4c15 2 22 11 22 26Z" fill="currentColor"/></svg></div></section>
    <section className="panel grocery-capture" aria-labelledby="grocery-add-heading"><div className="section-title"><div><p className="eyebrow">PARA LA PRÓXIMA COMPRA</p><h3 id="grocery-add-heading">¿Qué está faltando?</h3></div><span className="grocery-total">{summary.pending} pendiente{summary.pending===1?'':'s'}</span></div><form onSubmit={add}><div className="grocery-quick-row"><label className="grocery-field grocery-name"><span>Producto</span><input ref={nameInput} value={name} onChange={event=>setName(event.target.value)} placeholder="Por ejemplo, bananas" maxLength={160} required autoComplete="off"/></label><label className="grocery-field grocery-quantity"><span>Cantidad <small>opcional</small></span><input value={quantity} onChange={event=>setQuantity(event.target.value)} placeholder="1 kg, 2 paquetes…" maxLength={60} autoComplete="off"/></label><button type="submit" className="button primary grocery-add"><Glyph name="plus"/>Agregar</button></div><CategorySelect id="grocery-add-category" value={category} onChange={setCategory}/></form>{error&&<p className="grocery-error" role="alert">{error}</p>}</section>
    <section className="panel grocery-list-panel" aria-labelledby="grocery-list-heading"><div className="grocery-list-heading"><div><p className="eyebrow">TU LISTA DEL SÚPER</p><h3 id="grocery-list-heading">Lo que vas a llevar</h3></div><div className="grocery-progress"><strong>{summary.checked}<span> / {summary.total}</span></strong><small>comprados</small></div></div><div className="grocery-toolbar"><div className="grocery-filters" role="group" aria-label="Mostrar productos">{([{id:'pending',label:'Pendientes',count:summary.pending},{id:'all',label:'Todo',count:summary.total},{id:'checked',label:'Comprado',count:summary.checked}] as const).map(choice=><button key={choice.id} type="button" aria-pressed={filter===choice.id} onClick={()=>{setFilter(choice.id);setEditing(null);setError('');}}>{choice.label}<span>{choice.count}</span></button>)}</div>{summary.checked>0&&<button type="button" className="text-button grocery-clear" onClick={()=>remove(Object.values(items).filter(item=>item.checked).map(item=>item.id))}><Glyph name="delete" size={16}/>Limpiar comprados</button>}</div>
      {groups.length?groups.map(group=><section key={group.category} className={'grocery-group category-'+group.category} aria-labelledby={'grocery-category-'+group.category}><div className="grocery-group-heading"><span className="grocery-category-icon"><Glyph name={group.category}/></span><h4 id={'grocery-category-'+group.category}>{group.label}</h4><span>{group.items.length}</span></div><ul>{group.items.map(item=><li key={item.id} className={item.checked?'is-checked':''}><div className="grocery-product-row"><label className="grocery-check"><input type="checkbox" checked={item.checked} onChange={()=>toggle(item)} aria-label={`Comprado: ${item.name}`}/><span><Glyph name="check" size={17}/></span></label><div className="grocery-product-copy"><strong>{item.name}</strong>{item.quantity&&<span>{item.quantity}</span>}</div><div className="grocery-product-actions"><button type="button" className="icon-button" aria-label={`Editar ${item.name}`} aria-expanded={editing===item.id} onClick={event=>{editButton.current=event.currentTarget;setEditing(editing===item.id?null:item.id);setError('');}}><Glyph name="edit" size={17}/></button><button type="button" className="icon-button" aria-label={`Quitar ${item.name}`} onClick={()=>remove([item.id])}><Glyph name="delete" size={17}/></button></div></div>{editing===item.id&&<form className="grocery-edit-form" onSubmit={event=>saveEdit(event,item)}><label className="grocery-field"><span>Producto</span><input name="name" defaultValue={item.name} maxLength={160} required autoFocus/></label><label className="grocery-field"><span>Cantidad</span><input name="quantity" defaultValue={item.quantity} maxLength={60}/></label><label className="grocery-field"><span>Sector</span><select name="category" defaultValue={item.category}>{groceryCategories.map(value=><option key={value.id} value={value.id}>{value.label}</option>)}</select></label><div className="grocery-edit-actions"><button type="submit" className="button primary">Guardar</button><button type="button" className="button secondary" onClick={()=>{setEditing(null);setError('');editButton.current?.focus();}}>Cancelar</button></div></form>}</li>)}</ul></section>):<div className="grocery-empty"><span><Glyph name={filter==='checked'?'check':'basket'} size={36}/></span><h4>{summary.total===0?'Una cosa menos en tu cabeza.':filter==='pending'?'Ya tenés todo lo de la lista.':'Todavía no marcaste compras.'}</h4><p>{summary.total===0?'Agregá lo que necesites reponer. La lista te acompaña hasta el súper.':filter==='pending'?'Tus productos comprados siguen guardados en «Comprado».':'Cuando lleves un producto, tocá su círculo para marcarlo.'}</p></div>}
    </section><p className="grocery-footer"><Glyph name="verduleria" size={18}/>{cloudMode==='synced'?'Tu lista se guarda con tu cuenta para tenerla en la compu y en el celular.':'Esta lista queda guardada con tus datos de Mi Vida.'}</p><span className="grocery-sr-only" role="status" aria-live="polite">{announcement}</span>{undo&&undo.scope===scope&&<div className="grocery-notice" role="status"><span>{undo.message}</span><button type="button" onClick={restore}><Glyph name="restore" size={16}/>Deshacer</button></div>}
  </div>;
}
export default GroceryList;

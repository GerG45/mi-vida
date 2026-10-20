import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import ts from 'typescript';

const compiled=ts.transpileModule(await fs.readFile(new URL('../src/lib/groceryList.ts',import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;
const {createGroceryItem,normalizeGroceryItem,getGroceryGroups,getGrocerySummary}=await import('data:text/javascript;base64,'+Buffer.from(compiled).toString('base64'));
const item=(patch={})=>createGroceryItem({id:'product-1',name:'Bananas',now:100,...patch});

test('a quick grocery capture needs only a name and has no assigned calendar date',()=> {
  const result=item({name:'  Bananas  '});
  assert.deepEqual(result,{id:'product-1',name:'Bananas',quantity:'',category:'otros',checked:false,createdAt:100});
  assert.deepEqual(item({quantity:'  1,5 kg  ',category:'verduleria'}).quantity,'1,5 kg');
  assert.equal('date' in result,false);
});

test('stored groceries reject unknown fields, invalid keys and malformed imported data',()=> {
  const valid=item();assert.deepEqual(normalizeGroceryItem(valid,valid.id),valid);
  for(const invalid of [{...valid,id:'__proto__'},{...valid,name:' '},{...valid,name:'A'.repeat(161)},{...valid,name:'Leche\nBorrar'},{...valid,quantity:'A'.repeat(61)},{...valid,category:'unknown'},{...valid,checked:1},{...valid,createdAt:-1},{...valid,createdAt:Infinity},{...valid,createdAt:.5},{...valid,date:'2030-01-01'},{...valid,accessToken:'never'}])assert.equal(normalizeGroceryItem(invalid),undefined);
  assert.equal(normalizeGroceryItem(valid,'different-key'),undefined);
  assert.equal(normalizeGroceryItem(null),undefined);
  assert.throws(()=>item({name:' '}));
});

test('the shop view groups by sector and keeps pending products before purchased ones',()=> {
  const banana={...item({id:'banana',category:'verduleria',now:10}),checked:true};
  const apple=item({id:'apple',name:'Manzanas',category:'verduleria',now:20});
  const milk=item({id:'milk',name:'Leche',category:'lacteos',now:1});
  const rice=item({id:'rice',name:'Arroz',category:'almacen',now:1});
  const items={milk,banana,rice,apple},before=JSON.stringify(items);
  const groups=getGroceryGroups(items,'all');
  assert.deepEqual(groups.map(group=>group.category),['verduleria','almacen','lacteos']);
  assert.deepEqual(groups[0].items.map(product=>product.id),['apple','banana']);
  assert.deepEqual(getGroceryGroups(items,'checked').flatMap(group=>group.items.map(product=>product.id)),['banana']);
  assert.equal(getGroceryGroups(items,'pending').flatMap(group=>group.items).length,3);
  assert.equal(JSON.stringify(items),before);
});

test('purchased products remain in the list and can return to pending without losing quantities',()=> {
  const product=item({quantity:'2 paquetes'}),items={[product.id]:{...product,checked:true}};
  assert.deepEqual(getGrocerySummary(items),{total:1,pending:0,checked:1});
  assert.equal(getGroceryGroups(items,'pending').length,0);
  assert.equal(getGroceryGroups(items,'all')[0].items[0].quantity,'2 paquetes');
  items[product.id]={...items[product.id],checked:false};
  assert.deepEqual(getGrocerySummary(items),{total:1,pending:1,checked:0});
  assert.deepEqual(getGrocerySummary({}),{total:0,pending:0,checked:0});
});

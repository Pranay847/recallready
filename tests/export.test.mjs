import test from 'node:test';
import assert from 'node:assert/strict';
import { exportReport, exportManifest, customerGroups } from '../src/exports.mjs';

const caseData = { id:'RR-TEST', mode:'sample', provenance:{notice:'sample',inventory:'sample',shipments:'sample'}, organization:'Test warehouse', title:'Test drill', notice:{product:'<script>alert(1)</script>',brand:'Brand',lotCodes:['LOT-1'],source:{name:'notice.txt',text:'A & B'},instructions:'Hold affected lots',reason:'Test recall'},records:[{id:'R1',product:'=HYPERLINK("bad")',lot:'',quantity:12,location:'A, 12',source:{name:'inventory.csv',text:'original'}}],shipments:[{id:'S1',recordId:'R1',customer:'Customer',quantity:8,source:{name:'shipments.csv',text:'R1, 8'}}],resolutions:{},actions:{R1:true},activity:[] };
const analysis = {summary:{warehouseQuantity:0,shippedQuantity:0,affectedCustomers:0,reviewLots:1},results:[{id:'R1',status:'review',reason:'Missing lot',evidence:[{name:'notice.txt',text:'A & B'}],shipments:caseData.shipments}]};

test('report escapes uploaded markup and always includes unresolved shipments',()=>{
  const html = exportReport(caseData,analysis,true);
  assert.ok(!html.includes('<script>alert(1)</script>'));
  assert.ok(html.includes('&lt;script&gt;'));
  assert.ok(html.includes('Customer'));
  assert.ok(html.includes('Needs verification'));
  assert.ok(html.includes('Synthetic'));
  assert.ok(!html.includes('Hold confirmed'));
});
test('manifest prevents formula execution and quotes commas',()=>{
  const csv=exportManifest(caseData,analysis);
  assert.ok(csv.includes("'=HYPERLINK"));
  assert.ok(csv.includes('"A, 12"'));
  assert.ok(csv.includes('Needs verification'));
});
test('resolved lot replaces empty raw lot in the manifest',()=>{
  const csv=exportManifest({...caseData,resolutions:{R1:{lot:'LOT-1',source:'Receiving note'}}},analysis);
  assert.ok(csv.includes('LOT-1'));
});

test('mixed provenance survives the exported report and manifest',()=>{
  const mixed={...caseData,mode:'uploaded',provenance:{notice:'uploaded',inventory:'sample',shipments:'sample'}};
  const html=exportReport(mixed,analysis);
  assert.ok(html.includes('Mixed: includes synthetic data'));
  assert.ok(html.includes('Inventory: sample'));
  assert.ok(exportManifest(mixed,analysis).includes('source_provenance'));
});

test('customer drafts group case and whitespace variants but exclude unresolved shipments',()=>{
  const groups=customerGroups([{id:'R1',status:'affected',shipments:[{customer:'Lakeview Market',quantity:16},{customer:' lakeview  market ',quantity:8}]},{id:'R2',status:'review',shipments:[{customer:'Lakeview Market',quantity:10}]}]);
  assert.equal(groups.length,1);
  assert.equal(groups[0].quantity,24);
  assert.equal(groups[0].name,'Lakeview Market');
});

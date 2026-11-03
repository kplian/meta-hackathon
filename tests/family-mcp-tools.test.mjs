import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const sdk=readFileSync(new URL('../n8n/mcp/server.sdk.ts',import.meta.url),'utf8');
const httpTools=sdk.split('\n').filter(line=>line.includes('n8n-nodes-base.httpRequestTool'))
  .map(line=>JSON.parse(line.match(/parameters:(\{.*\}),credentials:/)[1])).filter(params=>params.url.endsWith('/rpc/f_family_mcp'));
function body(params,payload='{}',headers={'x-family-channel':'telegram','x-family-sender':'fixture-a'}) {
  return vm.runInNewContext(params.jsonBody.slice(3,-2),{
    $json:{headers,mcpMessageId:'request-1'},
    $fromAI:(key,description,type)=>{
      assert.equal(type,'string');
      return key==='operation'?'list':payload;
    },
  });
}
test('all seven business HTTP area tools accept the empty JSON string required by n8n',()=>{
  assert.equal(httpTools.length,7);
  for(const params of httpTools) {
    const b=body(params);
    assert.equal(JSON.stringify(b.p_payload),'{}');
    assert.equal(b.p_operation,'list');
    assert.equal(b.p_channel_type,'telegram');
    assert.equal(b.p_channel_code,'fixture-a');
  }
});
test('business JSON preserves amounts and unicode but cannot replace transport identity',()=>{
  const b=body(httpTools[0],JSON.stringify({name:'Família 🌎',estimated_amount:123.45,p_channel_code:'attacker'}));
  assert.equal(b.p_payload.name,'Família 🌎');
  assert.equal(b.p_payload.estimated_amount,123.45);
  assert.equal(b.p_channel_code,'fixture-a');
  assert.equal(body(httpTools[0],'{}',{}).p_channel_code,'');
});
test('invalid JSON rejects before constructing a backend write',()=>{
  assert.throws(()=>body(httpTools[0],'{oops'),/JSON/);
});
test('each sender is resolved per call rather than cached in the server expression',()=>{
  const a=body(httpTools[0],'{}',{'x-family-channel':'telegram','x-family-sender':'fixture-a'});
  const b=body(httpTools[0],'{}',{'x-family-channel':'whatsapp','x-family-sender':'fixture-b'});
  assert.equal(a.p_channel_code,'fixture-a');
  assert.equal(b.p_channel_code,'fixture-b');
  assert.equal(b.p_channel_type,'whatsapp');
});
test('health workflow mapping also parses string payloads rather than rejecting empty objects',()=>{
  const line=sdk.split('\n').find(line=>line.includes('nodes-langchain.toolWorkflow'));
  const params=JSON.parse(line.match(/parameters:(\{.*\})\}\}\);$/)[1]);
  const expression=params.workflowInputs.value.payload;
  const value=vm.runInNewContext(expression.slice(3,-2),{$fromAI:()=> '{}'});
  assert.equal(JSON.stringify(value),'{}');
});

test('market reads keep channel identity outside AI payload and use the dedicated endpoint',()=>{
  const line=sdk.split('\n').find(line=>line.includes('name:"market"'));
  const params=JSON.parse(line.match(/parameters:(\{.*\}),credentials:/)[1]);
  assert.ok(params.url.endsWith('/functions/v1/asset-market-mcp'));
  const b=body(params,JSON.stringify({symbol:'BTC/USD',p_channel_code:'attacker'}));
  assert.equal(b.p_channel_type,'telegram');
  assert.equal(b.p_channel_code,'fixture-a');
  assert.equal(b.payload.symbol,'BTC/USD');
  assert.equal(b.operation,'list'); // The backend rejects unsupported operations.
  assert.equal(params.authentication,'predefinedCredentialType');
  assert.equal(params.nodeCredentialType,'supabaseApi');
});

// Isolated model evaluations: every tool is an in-memory fixture. No DB, HTTP or channel sends.
import {readFileSync,writeFileSync} from 'node:fs';
import {catalog} from '../mcp/catalog.mjs';

const base=new URL('../',import.meta.url);
const cases=JSON.parse(readFileSync(new URL('tests/prompt-evaluation-cases.json',base),'utf8'));
const selected=cases.find(c=>c.id===process.argv[2])||cases[0];
const system=readFileSync(new URL('prompts/tool_error_policy.md',base),'utf8')+'\n\n'+readFileSync(new URL('mcp/assistant-prompt.md',base),'utf8');
const home={id:'00000000-0000-4000-8000-000000000001',name:'Familia Test',currency:'BOB',role:'admin'};
export function scenarioCode(c) {
  const fixture={caseId:c.id,failure:c.failure||null,assistant:{message:{text:c.text,kind:'text',attachments:[]},user:{name:'Alex',households:[home]},locale:c.locale}};
  return 'return [{json:'+JSON.stringify(fixture)+'}];';
}
const stub=`const args=typeof query==='string'?JSON.parse(query):query;
const payload=JSON.parse(args.payload); const op=args.operation; const fixture=$('Scenario').item.json;
const wealth={total:107,currency:'USD',assets:[{id:'00000000-0000-4000-8000-000000000003',name:'Bitcoin',symbol:'BTC/USD',value_usd:107,current_quantity:1.07,current_unit_price_usd:100,valuation_basis:'latest_quote',valuation_as_of:'2026-11-02T12:00:00Z'}]};
const overview={available:fixture.failure==='zero_funds'?0:fixture.failure==='fx_validation'?9900:500,currency:'BOB',wealth,accounts:[{id:'00000000-0000-4000-8000-000000000002',name:'Cash',currency:'BOB',balance:fixture.failure==='zero_funds'?0:fixture.failure==='fx_validation'?9900:500}],can_manage:true};
if(fixture.failure==='permission' && area==='reports') return JSON.stringify({success:false,error:'P0001',message:'Household access denied'});
if(fixture.failure==='write_timeout' && area==='transactions' && op==='register') return JSON.stringify({statusCode:504,body:{error:'gateway_timeout'}});
const responses={
 household:{list:fixture.assistant.user.households,get:{...fixture.assistant.user.households[0],members:[{id:'00000000-0000-4000-8000-000000000004',name:'Alex',member_type:'dad',role:'admin'}]}},
 income:{list:[{name:'Salary',estimated_amount:10000,currency:'BOB',frequency:'monthly'}]},
 transactions:{categories:{income:[{category_key:'income_general',name:'Income'}],expense:[{category_key:'supermarket_groceries',name:'Supermercado'}]},list:[],register:{success:true,transaction:{id:'00000000-0000-4000-8000-000000000005',type:payload.type,concept:payload.concept,amount:payload.amount,currency:'BOB',transaction_date:'2026-11-02T12:00:00Z'}}},
 assets:{list:overview,types:[{code:'crypto',name:'Criptomonedas',market_priced:true}]},
 vaults:{list:{totals:[],vaults:[],history:[]}},
 reports:{available:overview,wealth,monthly_savings:{month:'2026-11',currency:'BOB',estimated_income:10000,income:6000,expenses:4000,savings:{target:2000,generated:2000,gap:0,achieved:true,vault_contributions:1000,investment_contributions:500}},member_expenses:{total:4000,currency:'BOB',groups:[]},savings_history:{currency:'BOB',months:[]}},
};
if(area==='health') return JSON.stringify({success:false,error:'P0001',message:'Health is not enabled for this household'});
if(area==='market') { if(fixture.failure==='market_unavailable') return JSON.stringify({success:false,error:'market_plan_unavailable'}); const price=80000; if(['quote','estimate_purchase'].includes(op)&&payload.symbol!=='BTC/USD') return JSON.stringify({success:false,error:'invalid_quote'}); if(op==='search') return JSON.stringify({success:true,data:{instruments:[{symbol:'BTC/USD',name:'Bitcoin',exchange:'',currency:'USD',type:'Digital Currency'}]}}); if(op==='quote') return JSON.stringify({success:true,data:{quote:{symbol:'BTC/USD',currency:'USD',price,asOf:'2026-11-02T00:00:00Z',provider:'twelve_data'}}}); if(op==='fx') return JSON.stringify({success:true,data:{fx:{currency:'BOB',quoteCurrency:'USD',symbol:'BOB/USD',rate:0.125,asOf:'2026-11-02T12:00:00Z',provider:'twelve_data'}}}); if(op==='estimate_purchase') {const rate=payload.household_per_usd??8;return JSON.stringify({success:true,data:{estimate:{symbol:'BTC/USD',usd_amount:payload.usd_amount,quantity:payload.usd_amount/price,household_currency:payload.household_currency,household_amount:payload.usd_amount*rate,household_per_usd:rate,usd_per_household_unit:1/rate,rate_source:payload.household_per_usd?'user':'twelve_data',rate_as_of:null,quote:{symbol:'BTC/USD',currency:'USD',price,asOf:'2026-11-02T00:00:00Z',provider:'twelve_data'},indicative_only:true,executed:false}}});}}
if(area==='assets'&&op==='move'&&fixture.failure==='fx_validation') return JSON.stringify({success:false,error:'P0001',message:'USD settlement must match actual household amount and exchange rate'});
const data=responses[area]?.[op]; if(data===undefined) return JSON.stringify({success:false,error:'TEST_UNSUPPORTED_OPERATION'});
return JSON.stringify({success:true,data});`;
const q=JSON.stringify;
const inputSchema={type:'object',properties:{operation:{type:'string'},payload:{type:'string'}},required:['operation','payload'],additionalProperties:true};
let sdk="import {workflow,node,trigger,tool,languageModel,outputParser,expr} from '@n8n/workflow-sdk';\n";
const names=[];
for(const [i,c] of catalog.entries()){
  names.push('mock'+i);
  sdk+=`const mock${i}=tool({type:'@n8n/n8n-nodes-langchain.toolCode',version:1.3,config:{name:${q(c.name)},parameters:${q({description:c.description,language:'javaScript',specifyInputSchema:true,schemaType:'manual',inputSchema:JSON.stringify(inputSchema),jsCode:'const area='+q(c.area)+';\n'+stub})}}});\n`;
}
sdk+=`const start=trigger({type:'n8n-nodes-base.manualTrigger',version:1,config:{name:'Prompt test start',parameters:{}}});\n`;
sdk+=`const fixture=node({type:'n8n-nodes-base.code',version:2,config:{name:'Scenario',parameters:${q({mode:'runOnceForAllItems',jsCode:scenarioCode(selected)})}}});\n`;
sdk+=`const model=languageModel({type:'@n8n/n8n-nodes-langchain.lmChatDeepSeek',version:1,config:{name:'Evaluation model',parameters:{model:'deepseek-v4-pro',options:{}},credentials:{deepSeekApi:{id:'uCJO9GczlSRStYBf',name:'DeepSeek account'}}}});\n`;
sdk+=`const parser=outputParser({type:'@n8n/n8n-nodes-langchain.outputParserStructured',version:1.3,config:{name:'Reply schema',parameters:${q({schemaType:'manual',inputSchema:JSON.stringify({type:'object',properties:{text:{type:'string',minLength:1}},required:['text'],additionalProperties:false}),autoFix:false})}}});\n`;
sdk+=`const agent=node({type:'@n8n/n8n-nodes-langchain.agent',version:3.1,config:{name:'Evaluated assistant',parameters:{promptType:'define',text:expr('={{ JSON.stringify($json.assistant) }}'),hasOutputParser:true,options:{systemMessage:${q(system)},maxIterations:6,enableStreaming:false,returnIntermediateSteps:true}},subnodes:{model,outputParser:parser,tools:[${names.join(',')}]}}});\n`;
sdk+=`export default workflow('family-prompt-evaluation','Family prompt evaluation - fixtures only').add(start).to(fixture).to(agent).group('Isolated prompt checks',[fixture,agent,model,parser,${names.join(',')}]);\n`;
writeFileSync(new URL('tests/prompt-evaluation.sdk.ts',base),sdk);
writeFileSync(new URL('tests/prompt-evaluation.scenario.json',base),JSON.stringify({jsCode:scenarioCode(selected)},null,2)+'\n');
console.log('Generated isolated prompt evaluation: '+selected.id);

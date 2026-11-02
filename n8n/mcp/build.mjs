import {readFileSync,writeFileSync} from 'node:fs';
import ts from 'typescript';
import {catalog} from './catalog.mjs';

const base='https://ywibmualqaipmygmrojz.supabase.co/rest/v1/rpc/f_family_mcp';
const q=JSON.stringify;
const db={supabaseApi:{id:'D7CKuo645oY8I6Dc',name:'Supabase account 2'}};
const helpers=ts.transpileModule(readFileSync(new URL('../../supabase/functions/_shared/meal-plan.ts',import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText.replace(/^export /gm,'');
const expr=s=>`expr(${q(s)})`;
function nodeCode(variable,type,version,name,parameters,credentials,kind='node',extra='') {
 return `const ${variable} = ${kind}({type:${q(type)},version:${version},config:{name:${q(name)},parameters:${parameters}${credentials?`,credentials:${q(credentials)}`:''}${extra}}});\n`;
}
const rpcParams=(body,toolDescription)=>({method:'POST',url:base,authentication:'predefinedCredentialType',nodeCredentialType:'supabaseApi',sendHeaders:true,headerParameters:{parameters:[{name:'Content-Profile',value:'budget'},{name:'Accept-Profile',value:'budget'}]},sendBody:true,contentType:'json',specifyBody:'json',jsonBody:body,options:{timeout:60000},...(toolDescription?{toolDescription}: {})});
const fields=['channel_type','channel_code','operation','payload','request_key'];
const childBody="={{ ({p_channel_type:$json.channel_type,p_channel_code:$json.channel_code,p_area:'health',p_operation:$json.operation,p_payload:$json.payload,p_request_key:$json.request_key}) }}";
const commonInput="const input=$input.item.json; const p=input.payload||{}; if(!p||typeof p!=='object'||Array.isArray(p)) throw new Error('Invalid payload'); return {json:{...input,payload:p}};";
const prepare=helpers+`\nconst response=$input.item.json; const input=$('Health input').item.json; if(response.success!==true) return {json:{ready:false,result:response}}; const context=response.data; const p=input.payload; const language=['es','en','pt'].includes(p.language)?p.language:'es'; const days=Math.max(1,Math.min(7,Math.floor(Number(p.days)||7))); const budget=weeklyBudget(context,p.budget); return {json:{ready:true,input,context,language,days,budget,week_start:p.week_start||weekStart(),messages:buildMessages(context,{language,days,budget,request:typeof p.request==='string'?p.request.slice(0,2000):''})}};`;
const review=helpers+`\nconst prepared=$('Prepare meal plan').item.json; const response=$input.item.json; try {const plan=parsePlan(response.choices?.[0]?.message?.content||'',prepared.days); const review=reviewPlan(plan,prepared.context,prepared.budget,prepared.language); if(review.allergens.length) return {json:{valid:false,result:{success:false,error:'ALLERGEN_CONFLICT',message:'Plan was rejected; no plan was saved.'}}}; return {json:{valid:true,input:prepared.input,payload:{...prepared.input.payload,week_start:prepared.week_start,plan,budget:prepared.budget,user_request:prepared.input.payload.request||null,source:'ai',model:response.model||'qwen/qwen3.8-27b'},warnings:review.overBudget?['over_budget']:[]}};} catch(error) {return {json:{valid:false,result:{success:false,error:'INVALID_MEAL_PLAN',message:'The provider did not return a valid plan; nothing was saved.'}}};}`;
const header="import {workflow,node,trigger,tool,expr,newCredential} from '@n8n/workflow-sdk';\n";
let health=header;
health+=nodeCode('entry','n8n-nodes-base.executeWorkflowTrigger',1.2,'Health request',q({inputSource:'passthrough'}),null,'trigger');
health+=nodeCode('input','n8n-nodes-base.code',2,'Health input',q({mode:'runOnceForEachItem',jsCode:commonInput}));
health+=nodeCode('route','n8n-nodes-base.switch',3.4,'Health operation',`{mode:'expression',output:${expr("={{ $json.operation === 'generate_plan' ? 0 : 1 }}")},numberOutputs:2}`);
health+=nodeCode('direct','n8n-nodes-base.httpRequest',4.5,'Health action',q(rpcParams(childBody)),db);
health+=nodeCode('context','n8n-nodes-base.httpRequest',4.5,'Load health context',q(rpcParams(childBody.replace('p_operation:$json.operation',"p_operation:'get'"))),db);
health+=nodeCode('prepare','n8n-nodes-base.code',2,'Prepare meal plan',q({mode:'runOnceForEachItem',jsCode:prepare}));
health+=nodeCode('gate','n8n-nodes-base.switch',3.4,'Context authorized',`{mode:'expression',output:${expr('={{ $json.ready ? 0 : 1 }}')},numberOutputs:2}`);
health+=nodeCode('generate','n8n-nodes-base.httpRequest',4.5,'Generate meal plan',q({method:'POST',url:'https://api.groq.com/openai/v1/chat/completions',authentication:'predefinedCredentialType',nodeCredentialType:'groqApi',sendBody:true,contentType:'json',specifyBody:'json',jsonBody:'={{ ({model:"qwen/qwen3.8-27b",messages:$json.messages,temperature:0.3,max_tokens:5000,response_format:{type:"json_object"}}) }}',options:{timeout:90000}}),{groqApi:{id:'3j3emt2oYaVfvbZA',name:'Groq account'}});
health+=nodeCode('review','n8n-nodes-base.code',2,'Review meal plan',q({mode:'runOnceForEachItem',jsCode:review}));
health+=nodeCode('valid','n8n-nodes-base.switch',3.4,'Plan safe',`{mode:'expression',output:${expr('={{ $json.valid ? 0 : 1 }}')},numberOutputs:2}`);
health+=nodeCode('save','n8n-nodes-base.httpRequest',4.5,'Save meal plan',q(rpcParams("={{ ({p_channel_type:$json.input.channel_type,p_channel_code:$json.input.channel_code,p_area:'health',p_operation:'save_meal_plan',p_payload:$json.payload,p_request_key:$json.input.request_key}) }}")),db);
health+=nodeCode('failure','n8n-nodes-base.code',2,'Health rejected',q({mode:'runOnceForEachItem',jsCode:'return {json:$input.item.json.result};'}));
health+=nodeCode('finish','n8n-nodes-base.code',2,'Health result',q({mode:'runOnceForEachItem',jsCode:'return $input.item;'}));
health+="export default workflow('family-mcp-health','Family MCP - Health - Laboratorio').add(entry).to(input).to(route).add(route.output(0).to(context).to(prepare).to(gate)).add(route.output(1).to(direct)).add(gate.output(0).to(generate).to(review).to(valid)).add(gate.output(1).to(failure)).add(valid.output(0).to(save)).add(valid.output(1).to(failure)).add(direct.to(finish)).add(save.to(finish)).add(failure.to(finish)).group('Health and meal plans',[input,route,direct,context,prepare,gate,generate,review,valid,save,failure,finish]);\n";
writeFileSync(new URL('health.sdk.ts',import.meta.url),health);

const childId=process.argv[2];
if(childId){
 let server=header;
 const toolNames=[];
 for(const [i,def] of catalog.entries()){
   const variable=`area${i}`;toolNames.push(variable);
   const operation=`$fromAI('operation',${q(def.name+' operation; see the tool description for allowed operations and fields.')},'string')`;
   const payload="JSON.parse($fromAI('payload','Business arguments serialized as a JSON string. Use the string {} when empty. No identity or channel fields.','string'))";
   const requestKey="String($json.headers?.['mcp-session-id']||'')+':'+String($json.body?.id||$json.mcpMessageId||'')";
   const values={channel_type:"={{ $json.headers?.['x-family-channel'] || '' }}",channel_code:"={{ $json.headers?.['x-family-sender'] || '' }}",operation:`={{ ${operation} }}`,payload:`={{ ${payload} }}`,request_key:`={{ ${requestKey} }}`};
   if(def.area==='health'){
     const params={description:def.description,source:'database',workflowId:{__rl:true,mode:'id',value:childId},workflowInputs:{mappingMode:'defineBelow',value:values,schema:fields.map(id=>({id,displayName:id,type:id==='payload'?'object':'string',required:true,display:true,canBeUsedToMatch:false})),matchingColumns:[]}};
     server+=nodeCode(variable,'@n8n/n8n-nodes-langchain.toolWorkflow',2.2,def.name,q(params),null,'tool');
   }else{
     const body=`={{ ({p_channel_type:$json.headers?.['x-family-channel']||'',p_channel_code:$json.headers?.['x-family-sender']||'',p_area:${q(def.area)},p_operation:${operation},p_payload:${payload},p_request_key:${requestKey}}) }}`;
     server+=nodeCode(variable,'n8n-nodes-base.httpRequestTool',4.5,def.name,q(rpcParams(body,def.description)),db,'tool');
   }
 }
 server+=`const entry=trigger({type:'@n8n/n8n-nodes-langchain.mcpTrigger',version:2.1,config:{name:'Family MCP',parameters:{path:'family-finance-lab',authentication:'bearerAuth',instructions:'Family assistant tools. Identity is fixed by authenticated transport headers and cannot be selected by the model. Read IDs before writes. Ask confirmation before moving money. Never retry a failed write automatically. A success:false result is a failure, never claim success. Use household list when household is ambiguous. Dates come from server.'},credentials:{httpBearerAuth:{id:'KeI3AmnpkQ4ExZaT',name:'Bearer Auth account'}},subnodes:{tools:[${toolNames.join(',')}]}}});\nexport default workflow('family-finance-mcp-lab','Family MCP - Laboratorio').add(entry);\n`;
 writeFileSync(new URL('server.sdk.ts',import.meta.url),server);
}

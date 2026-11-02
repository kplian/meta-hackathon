import {execFileSync} from 'node:child_process';
import {writeFileSync} from 'node:fs';
const generated=execFileSync('supabase',['gen','types','typescript','--local','--schema','budget,public,storage'],{encoding:'utf8',stdio:['ignore','pipe','inherit']});
// PostgreSQL NUMERIC accepts decimal strings. Keep asset input precision intact
// instead of coercing 12-decimal quantities through JavaScript Number.
const types=generated.replace(/("?(?:p_quantity|p_unit_price_usd|p_source_quantity|p_destination_quantity|p_settlement_usd|p_usd_per_household_unit|p_source_amount|p_destination_amount|p_household_per_usd|p_goal)"?\??): number/g,'$1: number | string');
if(!types.includes('tasset_valuation'))throw Error('Unexpected database schema');
writeFileSync('packages/database-types/src/database.types.ts',types.split('\n').map(line=>line.trimEnd()).join('\n'));

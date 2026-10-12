import test from 'node:test';
import assert from 'node:assert/strict';
import {parsePilotSession,mergePilotSessions,summarizePilot,buildPilotReport} from '../src/lib/pilotEvaluation';
const session=(id='10000000-0000-4000-8000-000000000001')=>({schemaVersion:2,pilot:'san-antonio-a-b',sessionId:id,catalogVersion:1,context:'field',phase:'baseline',observations:[{stage:'connection',kind:'help-needed'}]});
const parse=(value:unknown)=>parsePilotSession(JSON.stringify(value));
test('accepts the exact anonymous v2 schema and rejects unknown/private fields',()=>{
  assert.equal(parse(session()).sessionId,session().sessionId);
  for(const patch of [{schemaVersion:1},{pilot:'other'},{catalogVersion:2},{sessionId:'some-user'},{context:'live'},{phase:'after'},{phase:['baseline']},{context:['field']}, {photo:'data:image/'}, {observations:[{stage:'connection',kind:'help-needed',name:'private'}]}, {observations:[{stage:['sign'],kind:'useful'}]}, {observations:[{stage:'unknown',kind:'useful'}]}]) {
    assert.throws(()=>parse({...session(),...patch}));
  }
  assert.throws(()=>parsePilotSession('x'.repeat(128*1024+1)));
  assert.throws(()=>parsePilotSession('{invalid'));
  assert.throws(()=>parse({...session(),observations:[...session().observations,...session().observations]}));
});
test('deduplicates same session and rejects conflicting exports without overwriting',()=>{
  const a=parse(session());
  const merged=mergePilotSessions([a],[a,parse({...session(),phase:'assisted'})]);
  assert.equal(merged.sessions.length,1);assert.equal(merged.added,0);assert.equal(merged.duplicates,1);assert.equal(merged.conflicts,1);
  assert.equal(merged.sessions[0].phase,'baseline');
});
test('denominators count responding sessions per stage, not events or unique people',()=>{
  const a=parse({...session(),observations:[{stage:'connection',kind:'help-needed'},{stage:'connection',kind:'unclear'}]});
  const b=parse({...session('10000000-0000-4000-8000-000000000002'),context:'practice',phase:'unassigned',observations:[{stage:'sign',kind:'useful'}]});
  const summary=summarizePilot([a,b]);
  assert.equal(summary.sessions,2);assert.equal(summary.field,1);assert.equal(summary.practice,1);
  assert.deepEqual(summary.stages.connection,{answered:1,unclear:1,helpNeeded:1,useful:0});
  assert.deepEqual(summary.stages.sign,{answered:1,unclear:0,helpNeeded:0,useful:1});
  assert.equal(summarizePilot([]).stages.connection.answered,0);
});
test('report compares declared field groups only and exports aggregates without identifiers',()=>{
  const sessions=[parse(session()),parse({...session('10000000-0000-4000-8000-000000000002'),context:'practice',phase:'assisted'})];
  const report=buildPilotReport(sessions,'imported');
  assert.equal(report.mode,'imported');assert.equal(report.baseline.sessions,1);assert.equal(report.assisted.sessions,0);
  assert.doesNotMatch(JSON.stringify(report),/sessionId|00000000|observations|latitude|longitude/);
  assert.equal(buildPilotReport(sessions,'demo').mode,'demo');
  assert.match(report.limitations.join(' '),/causal|causalidad/);
});

test('caps sessions at 100, accepts category order changes and rejects demo provenance on import',()=>{
  const items=Array.from({length:101},(_,i)=>parse(session(`10000000-0000-4000-8000-${String(i).padStart(12,'0')}`)));
  const merged=mergePilotSessions([],items);
  assert.equal(merged.sessions.length,100);assert.equal(merged.overflow,1);
  const a=parse({...session(),observations:[{stage:'sign',kind:'useful'},{stage:'connection',kind:'unclear'}]});
  assert.equal(mergePilotSessions([a],[{...a,observations:[...a.observations].reverse()}]).duplicates,1);
  const synthetic=JSON.stringify(session('00000000-0000-4000-8000-000000000001'));
  assert.throws(()=>parsePilotSession(synthetic),/sintética/);
  assert.equal(parsePilotSession(synthetic,'demo').context,'field');
  assert.throws(()=>parsePilotSession(JSON.stringify(session()),'demo'),/reservados/);
});

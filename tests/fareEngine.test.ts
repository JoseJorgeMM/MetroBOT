import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateFare } from '../src/lib/fares/engine';
import { fareCatalog, fareConfig } from '../src/lib/fares/config';

const profile = { id: 'frecuente', payment: 'civica' as const };
const at = (minutes: number) => new Date(Date.UTC(2026, 9, 1, 12, minutes)).toISOString();
const chain = (...modes: string[]) => modes.map((mode, i) => ({ mode, validationTime: at(i * 20), basin: mode === 'ALIMENTADOR' ? '3' : undefined }));

test('distinct internal categories explicitly select the approved tariff groups', () => {
  for (const [modes, category, group, amount] of [
    [['METRO'], 'integracion_1', 'integraciones_1_4', 3820],
    [['METRO', 'METROPLUS'], 'integracion_2', 'integraciones_1_4', 3820],
    [['METRO', 'TRANVIA'], 'integracion_2', 'integraciones_1_4', 3820],
    [['ALIMENTADOR', 'METRO'], 'integracion_3', 'integraciones_5_7', 4570],
    [['ALIMENTADOR', 'METROPLUS', 'ALIMENTADOR'], 'integracion_4', 'integracion_8', 5320],
    [['ALIMENTADOR', 'METRO', 'ALIMENTADOR'], 'integracion_5', 'integraciones_9_10', 6070],
  ] as const) {
    const result = calculateFare(chain(...modes), profile);
    assert.equal(result.total, amount);
    assert.equal(result.chains[0].rule, category);
    assert.equal(result.chains[0].group, group);
    assert.equal(result.breakdown.reduce((sum, item) => sum + (item.charge ?? 0), 0), amount);
  }
});
test('shared group never merges category identities or deduces a missing mapping', () => {
  const config = structuredClone(fareConfig);
  delete config.categoryGroups.integracion_2;
  assert.equal(calculateFare(chain('METRO', 'METROPLUS'), profile, fareCatalog, config).status, 'NO_DETERMINADA');
  assert.equal(calculateFare(chain('METRO'), profile, fareCatalog, config).total, 3820);
});
test('tariff group/profile values are read from configuration, not name numbers or copied prices', () => {
  const catalog = structuredClone(fareCatalog);
  catalog.equivalencia_integraciones_oficiales.integraciones_5_7.estudiantil = 2401;
  assert.equal(calculateFare(chain('ALIMENTADOR', 'METRO'), { ...profile, id: 'estudiantil' }, catalog).total, 2401);
  for (const id of ['adulto_mayor', 'pcd', 'al_portador', 'eventual']) {
    assert.equal(calculateFare(chain('METRO', 'METROPLUS'), { ...profile, id }).total, catalog.equivalencia_integraciones_oficiales.integraciones_1_4[id]);
  }
});
test('zero additional transfer is not a free journey and savings require standalone fares', () => {
  const result = calculateFare(chain('METRO', 'METROPLUS'), profile);
  assert.equal(result.breakdown[1].charge, 0);
  assert.equal(result.total, 3820);
  assert.equal(result.withoutIntegration, 7640);
  assert.equal(result.savings, 3820);
});
test('EnCicla is zero before or after Metro and does not reset the paid clock', () => {
  assert.equal(calculateFare(chain('ENCICLA', 'METRO'), profile).total, 3820);
  assert.equal(calculateFare(chain('METRO', 'ENCICLA'), profile).total, 3820);
  assert.equal(calculateFare(chain('ENCICLA'), profile).total, 0);
  assert.equal(calculateFare([{mode:'METRO',validationTime:at(0)}, {mode:'ENCICLA'}, {mode:'METROPLUS',validationTime:at(91)}],profile).total,7640);
});
test('massive window uses first payment: 90 inclusive, 91 starts a new journey', () => {
  for (const [minutes, expected] of [[90,3820],[91,7640]]) {
    assert.equal(calculateFare([{mode:'METRO',validationTime:at(0)},{mode:'METROPLUS',validationTime:at(minutes)}],profile).total,expected);
  }
  const result = calculateFare([{mode:'METRO',validationTime:at(0)},{mode:'TRANVIA',validationTime:at(60)},{mode:'METROPLUS',validationTime:at(100)}],profile);
  assert.equal(result.total,7640);
  assert.equal(result.chains.length,2);
});
test('unknown modes, unsupported chains, missing times and paid-area continuity are not invented', () => {
  for (const modes of [['BUS'], ['METRO','METRO'], ['METRO','CABLE']]) assert.equal(calculateFare(chain(...modes),profile).total,null);
  assert.equal(calculateFare([{mode:'METRO'},{mode:'METROPLUS'}],profile).total,null);
  assert.equal(calculateFare([{mode:'METRO'}, {mode:'CABLE',paidArea:true}],profile).total,3820);
});
test('scheduled departures yield a conditional fare, not confirmed validations', () => {
  const result = calculateFare([{mode:'METRO',scheduledTime:at(0)},{mode:'METROPLUS',scheduledTime:at(20)}],profile);
  assert.equal(result.status,'CONDICIONAL');
  assert.equal(result.total,3820);
});
test('collective tariff uses municipality/zone and no preferential discounts', () => {
  for (const id of ['frecuente','estudiantil','pcd']) {
    const result = calculateFare([{mode:'BUS_INTEGRADO',zone:'bello',basin:'1',validationTime:at(0)}, {mode:'METRO',validationTime:at(20)}],{...profile,id});
    assert.equal(result.total,4715);
    assert.equal(result.withoutIntegration,null);
  }
});
test('double collective integration charges one rail portion and requires distinct basins', () => {
  const segments = [{mode:'BUS_INTEGRADO',zone:'bello',basin:'1',validationTime:at(0)}, {mode:'METRO',validationTime:at(20)}, {mode:'BUS_INTEGRADO',zone:'cuenca_5_envigado_sabaneta',basin:'5',validationTime:at(60)}];
  assert.equal(calculateFare(segments,profile).total,7250);
  segments[2].basin='1';
  assert.equal(calculateFare(segments,profile).total,null);
  segments[2].basin='5'; segments[2].validationTime=at(90);
  assert.equal(calculateFare(segments,profile).total,null); // standalone bus price is not in the JSON
});
test('bank profile does not inherit Civica integrations; Arvi requires its own category', () => {
  assert.equal(calculateFare(chain('METRO'),{id:'bancarizado',payment:'bank'}).total,4570);
  assert.equal(calculateFare(chain('METRO','METROPLUS'),{id:'bancarizado',payment:'bank'}).total,null);
  assert.equal(calculateFare(chain('CABLE_ARVI'),profile).total,null);
  assert.equal(calculateFare(chain('CABLE_ARVI'),{...profile,arviCategory:'estratos_1_2_3'}).total,3900);
});
test('invalid dates, reverse validation times, unsupported micro rates never become zero', () => {
  assert.equal(calculateFare([{mode:'METRO',validationTime:'bad'},{mode:'METROPLUS',validationTime:at(0)}],profile).total,null);
  assert.equal(calculateFare([{mode:'METRO',validationTime:at(20)},{mode:'METROPLUS',validationTime:at(0)}],profile).total,null);
  assert.equal(calculateFare([{mode:'MICRO_INTEGRADO',zone:'bello',validationTime:at(0)},{mode:'METRO',validationTime:at(20)}],profile).total,null);
});
test('paid-area continuity takes precedence over elapsed planned time', () => {
  assert.equal(calculateFare([{mode:'METRO',scheduledTime:at(0)},{mode:'CABLE',paidArea:true,scheduledTime:at(91)}],profile).total,3820);
});
test('scheduled expiry remains conditional after splitting into singleton journeys', () => {
  const result=calculateFare([{mode:'METRO',scheduledTime:at(0)},{mode:'METROPLUS',scheduledTime:at(91)}],profile);
  assert.equal(result.total,7640); assert.equal(result.status,'CONDICIONAL');
});
test('directional transfer rules cannot bypass the explicit category-group mapping', () => {
  const config=structuredClone(fareConfig); config.categoryGroups={};
  assert.equal(calculateFare(chain('METROPLUS','METRO'),profile,fareCatalog,config).total,null);
  assert.equal(calculateFare(chain('METROPLUS','METRO'),profile).chains[0].category,'integracion_2');
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { addressKey, buildOpportunities, businessSignal, classifyVertical, daysAheadDate, normalizeAddress, permitSignal } from '../src/core.js';

test('normalizes common LA street suffixes and suite noise', () => {
  assert.equal(normalizeAddress('123 N Main Street Suite #400'), '123 N MAIN ST');
  assert.equal(addressKey('123 N Main St.', '90012-1234'), '90012|123 N MAIN ST');
});

test('classifies restaurant language', () => {
  assert.equal(classifyVertical('Full-service restaurants and cafe'), 'restaurant_food');
});

test('merges business and permit signals at same normalized address as independent evidence', () => {
  const now = new Date('2026-09-11T12:00:00Z');
  const business = businessSignal({ business_name:'Example Foods LLC', dba_name:'Example Cafe', street_address:'100 Main Street', zip_code:'90012', primary_naics_description:'Full-service restaurants', location_start_date:'2026-09-08T00:00:00.000' });
  const permit = permitSignal({ permit_nbr:'P1', primary_address:'100 MAIN ST', zip_code:'90012', use_desc:'Restaurant', submitted_date:'2026-09-09', valuation:'65000', work_desc:'Tenant improvement for restaurant' }, 'submitted');
  const results = buildOpportunities([business, permit], { minScore:0, now });
  assert.equal(results.length, 1);
  assert.deepEqual(new Set(results[0].sourceFamilies), new Set(['business_registry', 'building_permit']));
  assert.equal(results[0].confidence, 'high');
  assert.ok(results[0].opportunityScore >= 70);
});

test('submitted plus issued permit stages are not treated as independent sources', () => {
  const now = new Date('2026-09-11T12:00:00Z');
  const submitted = permitSignal({ permit_nbr:'P9', primary_address:'200 Market Street', zip_code:'90013', use_desc:'Retail', submitted_date:'2026-09-08', work_desc:'Tenant improvement' }, 'submitted');
  const issued = permitSignal({ permit_nbr:'P9', primary_address:'200 MARKET ST', zip_code:'90013', use_desc:'Retail', issue_date:'2026-09-10', work_desc:'Tenant improvement' }, 'issued');
  const results = buildOpportunities([submitted, issued], { minScore:0, now });
  assert.equal(results.length, 1);
  assert.deepEqual(results[0].sourceFamilies, ['building_permit']);
  assert.notEqual(results[0].confidence, 'high');
  assert.equal(buildOpportunities([submitted, issued], { minScore:0, now, onlyMultiSignal:true }).length, 0);
});

test('future registered business start is preserved as a pre-opening signal', () => {
  const now = new Date('2026-09-11T12:00:00Z');
  const business = businessSignal({ business_name:'Future Cafe LLC', street_address:'300 Spring Street', zip_code:'90013', primary_naics_description:'Cafe', location_start_date:'2026-10-15T00:00:00.000' });
  const [result] = buildOpportunities([business], { minScore:0, now });
  assert.equal(result.futureBusinessStart, true);
  assert.match(result.scoreReasons.join(' '), /future business start/i);
  assert.equal(daysAheadDate(90, now), '2026-12-10');
});

test('filters clearly residential permit noise by default', () => {
  const permit = permitSignal({ permit_nbr:'P2', primary_address:'55 Home Ave', zip_code:'90026', issue_date:'2026-09-10', use_desc:'Single family dwelling', work_desc:'New ADU' }, 'issued');
  assert.equal(buildOpportunities([permit], { minScore:0 }).length, 0);
  assert.equal(buildOpportunities([permit], { minScore:0, includeResidential:true }).length, 1);
});

test('onlyMultiSignal suppresses one-family leads', () => {
  const b = businessSignal({ business_name:'Shop LLC', street_address:'10 Sunset Boulevard', zip_code:'90028', primary_naics_description:'Retail store', location_start_date:'2026-09-10T00:00:00.000' });
  assert.equal(buildOpportunities([b], { minScore:0, onlyMultiSignal:true }).length, 0);
});

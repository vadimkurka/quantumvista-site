const STREET_TYPES = new Map([
  ['STREET','ST'],['AVENUE','AVE'],['BOULEVARD','BLVD'],['ROAD','RD'],['DRIVE','DR'],['LANE','LN'],['COURT','CT'],['PLACE','PL'],['PARKWAY','PKWY'],['HIGHWAY','HWY'],['TERRACE','TER'],['CIRCLE','CIR'],
]);

const VERTICAL_RULES = [
  ['restaurant_food', /\b(RESTAURANT|CAFE|COFFEE|BAR\b|TAVERN|BAKERY|FOOD|KITCHEN|DINING|PIZZA|SUSHI|GRILL|CATER|DELI|JUICE|TEA HOUSE)\b/i],
  ['beauty_wellness', /\b(SALON|BARBER|SPA\b|MASSAGE|NAIL|BEAUTY|ESTHETIC|SKIN CARE|HAIR)\b/i],
  ['fitness', /\b(GYM|FITNESS|YOGA|PILATES|MARTIAL|DANCE STUDIO|HEALTH CLUB)\b/i],
  ['medical_dental', /\b(MEDICAL|CLINIC|DENTAL|DENTIST|ORTHODONT|PHARMACY|CHIROPRACT|OPTOMET|THERAPY)\b/i],
  ['retail', /\b(RETAIL|STORE|MARKET|GROCERY|SHOP\b|BOUTIQUE|SHOWROOM|MERCHANDISE)\b/i],
  ['hospitality', /\b(HOTEL|MOTEL|HOSTEL|LODGING|INN\b)\b/i],
  ['office_professional', /\b(OFFICE|ATTORNEY|LAW OFFICE|ACCOUNT|CONSULT|REAL ESTATE|PROFESSIONAL SERVICE)\b/i],
];

const RESIDENTIAL_RE = /\b(SINGLE[ -]?FAMILY|1[ -]?FAMILY|2[ -]?FAMILY|DUPLEX|DWELLING|RESIDENTIAL|APARTMENT|ADU\b|ACCESSORY DWELLING|JUNIOR ADU|SFD\b)\b/i;
const COMMERCIAL_RE = /\b(COMMERCIAL|RESTAURANT|RETAIL|STORE|OFFICE|HOTEL|MOTEL|WAREHOUSE|SCHOOL|CHURCH|CLINIC|HOSPITAL|GYM|SALON|MARKET|SHOP|TENANT IMPROVEMENT|T\.I\.|CHANGE OF USE)\b/i;

export function daysAgoDate(daysBack, now = new Date()) {
  const date = new Date(now);
  date.setUTCDate(date.getUTCDate() - Math.max(0, Number(daysBack) || 0));
  return date.toISOString().slice(0,10);
}

export function parseZip5(value) {
  const m = String(value || '').match(/\b(\d{5})\b/);
  return m ? m[1] : null;
}

export function normalizeAddress(value) {
  if (!value) return '';
  let text = String(value).toUpperCase().replace(/[.,]/g,' ')
    .replace(/\b(SUITE|STE|UNIT|APT|APARTMENT|ROOM|RM|FLOOR)\b\s*#?\s*[A-Z0-9-]+.*$/i,'')
    .replace(/\s+#\s*[A-Z0-9-]+.*$/i,'').replace(/\s+/g,' ').trim();
  for (const [long, short] of STREET_TYPES) text = text.replace(new RegExp(`\\b${long}\\b`,'g'), short);
  return text;
}

export function addressKey(address, zipCode) {
  const normalized = normalizeAddress(address);
  const zip = parseZip5(zipCode) || '';
  return normalized ? `${zip}|${normalized}` : '';
}

export function classifyVertical(text='') {
  for (const [vertical, regex] of VERTICAL_RULES) if (regex.test(text)) return vertical;
  return 'general_commercial';
}

export function vendorNeeds(vertical) {
  const common = ['website/local SEO','AI receptionist/phone automation','business insurance','signage'];
  const map = {
    restaurant_food:['POS/payments','online ordering','payroll','commercial cleaning','pest control','security','restaurant suppliers'],
    beauty_wellness:['booking/CRM','payments','local SEO','laundry/cleaning','insurance'],
    fitness:['membership/booking software','payments','access control','cleaning','local SEO'],
    medical_dental:['appointment automation','phone answering','local SEO','IT/security','signage'],
    retail:['POS/payments','inventory software','security','signage','local SEO'],
    hospitality:['booking software','Wi-Fi/IT','security','cleaning','local SEO'],
    office_professional:['website/local SEO','AI receptionist','CRM','business insurance'],
    general_commercial:common,
  };
  return [...new Set(map[vertical] || common)];
}

function asNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(String(value).replace(/[$,]/g,''));
  return Number.isFinite(n) ? n : null;
}

function get(row, candidates) {
  for (const key of candidates) if (row?.[key] !== undefined && row?.[key] !== null && row?.[key] !== '') return row[key];
  return null;
}

function point(row) {
  const latitude = asNumber(get(row,['lat','latitude']));
  const longitude = asNumber(get(row,['lon','longitude']));
  if (latitude !== null && longitude !== null) return { latitude, longitude };
  const loc = get(row,['location_1','geolocation','location']);
  if (loc && typeof loc === 'object') {
    const lat = asNumber(loc.latitude), lon = asNumber(loc.longitude);
    if (lat !== null && lon !== null) return { latitude:lat, longitude:lon };
  }
  return null;
}

export function businessSignal(row) {
  const address = get(row,['street_address','address']);
  const zipCode = parseZip5(get(row,['zip_code','zipcode']));
  const businessName = get(row,['business_name','legal_name']);
  const dbaName = get(row,['dba_name','doing_business_as']);
  const industry = get(row,['primary_naics_description','naics_description']);
  const naics = get(row,['naics','naics_code']);
  const eventDate = get(row,['location_start_date','start_date']);
  const text = [businessName,dbaName,industry,naics].filter(Boolean).join(' ');
  return {
    type:'new_business_registration', sourceId:get(row,['location_account']) || `${businessName || 'unknown'}:${address || ''}`,
    eventDate,businessName,dbaName,address,city:get(row,['city']) || 'LOS ANGELES',zipCode,
    vertical:classifyVertical(text),industry,naics,valuation:null,permitNumber:null,permitStatus:null,workDescription:null,
    location:point(row),addressKey:addressKey(address,zipCode),sourceUrl:'https://data.lacity.org/d/6rrh-rzua',raw:row,
  };
}

export function permitSignal(row, stage='issued') {
  const address = get(row,['primary_address','address']);
  const zipCode = parseZip5(get(row,['zip_code','zipcode']));
  const useDescription = get(row,['use_desc','use_description']);
  const workDescription = get(row,['work_desc','work_description']);
  const permitType = get(row,['permit_type','permit_group','permit_sub_type']);
  const status = get(row,['status_desc','status']);
  const eventDate = stage === 'submitted' ? get(row,['submitted_date','submit_date','application_date']) : get(row,['issue_date','issued_date']);
  const text = [useDescription,workDescription,permitType,status].filter(Boolean).join(' ');
  return {
    type:stage === 'submitted' ? 'building_permit_submitted' : 'building_permit_issued',
    sourceId:get(row,['permit_nbr','permit_number']) || `${stage}:${address || ''}:${eventDate || ''}`,
    eventDate,businessName:null,dbaName:null,address,city:'LOS ANGELES',zipCode,vertical:classifyVertical(text),industry:useDescription,naics:null,
    valuation:asNumber(get(row,['valuation','job_value','declared_value'])), permitNumber:get(row,['permit_nbr','permit_number']), permitStatus:status,
    workDescription,useDescription,permitType,location:point(row),addressKey:addressKey(address,zipCode),
    isResidential:RESIDENTIAL_RE.test(text) && !COMMERCIAL_RE.test(text), isCommercialHint:COMMERCIAL_RE.test(text),
    sourceUrl:stage === 'submitted' ? 'https://data.lacity.org/d/gwh9-jnip' : 'https://data.lacity.org/d/pi9x-tg5x', raw:row,
  };
}

function recencyPoints(dateValue, now=new Date()) {
  if (!dateValue) return 0;
  const d = new Date(dateValue); if (Number.isNaN(d.getTime())) return 0;
  const days = Math.max(0,(now-d)/86400000);
  if (days <= 7) return 25; if (days <= 30) return 18; if (days <= 60) return 10; if (days <= 90) return 5; return 0;
}

export function scoreOpportunity(signals, now=new Date()) {
  const types = new Set(signals.map(s=>s.type));
  const valuation = Math.max(0,...signals.map(s=>s.valuation || 0));
  const newestDate = signals.map(s=>s.eventDate).filter(Boolean).sort().at(-1);
  let score = recencyPoints(newestDate,now); const reasons=[];
  if (types.has('new_business_registration')) { score += 18; reasons.push('recent business registration'); }
  if (types.has('building_permit_submitted')) { score += 18; reasons.push('recent permit application'); }
  if (types.has('building_permit_issued')) { score += 15; reasons.push('recent issued permit'); }
  if (types.size >= 2) { score += 28; reasons.push('multiple independent signals at the same address'); }
  if (valuation >= 100000) { score += 10; reasons.push('high-value project'); }
  else if (valuation >= 25000) { score += 6; reasons.push('meaningful project valuation'); }
  else if (valuation >= 5000) score += 3;
  const vertical = signals.find(s=>s.vertical !== 'general_commercial')?.vertical || 'general_commercial';
  if (vertical !== 'general_commercial') { score += 4; reasons.push('commercial vertical identified'); }
  score = Math.min(100,Math.round(score));
  return { score, confidence:types.size >= 2 && score >= 70 ? 'high' : score >= 50 ? 'medium' : 'low', reasons, newestDate, valuation, vertical };
}

export function buildOpportunities(signals,{includeResidential=false,minScore=35,verticals=[],zipCodes=[],keywords=[],onlyMultiSignal=false,includeRaw=false,now=new Date()}={}) {
  const zipSet = new Set(zipCodes.map(parseZip5).filter(Boolean));
  const verticalSet = new Set(verticals.filter(Boolean));
  const keywordList = keywords.map(x=>String(x).trim().toLowerCase()).filter(Boolean);
  const filtered = signals.filter(signal => signal.addressKey && (includeResidential || !signal.type.startsWith('building_permit') || !signal.isResidential) && (!zipSet.size || zipSet.has(parseZip5(signal.zipCode))));
  const groups = new Map();
  for (const signal of filtered) { if (!groups.has(signal.addressKey)) groups.set(signal.addressKey,[]); groups.get(signal.addressKey).push(signal); }
  const results=[];
  for (const [key,group] of groups) {
    const scored=scoreOpportunity(group,now); const types=[...new Set(group.map(s=>s.type))];
    if (onlyMultiSignal && types.length < 2) continue;
    if (scored.score < minScore || (verticalSet.size && !verticalSet.has(scored.vertical))) continue;
    const bestBusiness=group.find(s=>s.businessName || s.dbaName); const bestPermit=group.find(s=>s.type.startsWith('building_permit')); const primary=bestBusiness || bestPermit || group[0];
    const haystack=group.map(s=>[s.businessName,s.dbaName,s.industry,s.workDescription,s.permitType,s.useDescription,s.address,s.zipCode].filter(Boolean).join(' ')).join(' ').toLowerCase();
    if (keywordList.length && !keywordList.some(k=>haystack.includes(k))) continue;
    const evidence=[...group].sort((a,b)=>String(b.eventDate||'').localeCompare(String(a.eventDate||''))).map(s=>({type:s.type,eventDate:s.eventDate,sourceId:s.sourceId,sourceUrl:s.sourceUrl,permitNumber:s.permitNumber,permitStatus:s.permitStatus,valuation:s.valuation,workDescription:s.workDescription,...(includeRaw?{raw:s.raw}:{})}));
    results.push({
      opportunityId:`la:${key.replace(/[^A-Z0-9|]/gi,'').slice(0,80)}`, opportunityScore:scored.score, confidence:scored.confidence, scoreReasons:scored.reasons,
      signalCount:group.length,signalTypes:types,latestSignalDate:scored.newestDate,businessName:bestBusiness?.businessName || null,dbaName:bestBusiness?.dbaName || null,
      vertical:scored.vertical,vendorNeeds:vendorNeeds(scored.vertical),address:primary.address,city:primary.city || 'LOS ANGELES',zipCode:primary.zipCode,
      latitude:primary.location?.latitude ?? bestPermit?.location?.latitude ?? null,longitude:primary.location?.longitude ?? bestPermit?.location?.longitude ?? null,
      industry:bestBusiness?.industry || bestPermit?.industry || null,naics:bestBusiness?.naics || null,maxPermitValuation:scored.valuation || null,evidence,
      caveat:'Opportunity signal from public records; not proof that a business will open or buy services.',
    });
  }
  return results.sort((a,b)=>b.opportunityScore-a.opportunityScore || String(b.latestSignalDate||'').localeCompare(String(a.latestSignalDate||'')));
}

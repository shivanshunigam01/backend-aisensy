/** Keep in sync with frontend ASD location matrix. */
const ASD_LOCATION_MATRIX = {
  Bihar: {
    Chapra: ['Dighwara', 'Garkha', 'Parsa', 'Taraiya'],
    Darbhanga: ['Chhatwan', 'Jale', 'Kiratpur', 'Manigachhi'],
    Siwan: ['Goriakothi', 'Hasanpura', 'Hussainganj', 'Nautan', 'Mairwa'],
    Katihar: ['Azamnagar', 'Kajitola', 'Manihari'],
    Gaya: ['Barachatti', 'Gurua'],
    Motihari: ['Chiraiya', 'Tetaria'],
    Samastipur: ['Musrigarari', 'Sarairanjan'],
    Begusarai: ['Sahibpur Kamal'],
    Buxar: ['Sonbersa'],
    Madhepura: ['Singheswar'],
    Madhubani: ['Basopatti'],
    Nawada: ['Akbarpur'],
    Purnea: ['Jankinagar']
  },
  Jharkhand: {
    Jamshedpur: ['Musabani', 'Chowka', 'Jadugoda', 'Baraghora', 'Patambda'],
    Bokaro: ['Katahara', 'Manpur', 'Tupkadih'],
    Daltangunj: ['Mahuadand', 'Ramna', 'Tarhasi'],
    Chatra: ['Katkamsandi', 'Keredari'],
    Sahebganj: ['Bhagaiya', 'Tinpahar']
  }
};

const STATE_CODES = { Bihar: 'BH', Jharkhand: 'JH' };

const STATES = ['Bihar', 'Jharkhand'];

const CONSENT_POLICY_VERSION = 'bajaj-asd-v2';

function parseLocationId(id) {
  const parts = String(id).split('|');
  if (parts.length !== 3) return null;
  const [state, district, location] = parts;
  if (!ASD_LOCATION_MATRIX[state]?.[district]?.includes(location)) return null;
  return { state, district, location };
}

function formatLocationSummary(state, districts, locationIds) {
  const byDistrict = new Map();
  for (const id of locationIds) {
    const parsed = parseLocationId(id);
    if (!parsed) continue;
    const list = byDistrict.get(parsed.district) ?? [];
    list.push(parsed.location);
    byDistrict.set(parsed.district, list);
  }
  const code = STATE_CODES[state] ?? state;
  const parts = districts
    .filter((d) => byDistrict.has(d))
    .map((d) => `${d}: ${(byDistrict.get(d) ?? []).join(', ')}`);
  return `[${code}] ${parts.join(' · ')}`;
}

function validateLocationSelection(state, districts, locationIds) {
  if (!state || !STATES.includes(state)) {
    return { ok: false, error: 'Please select a state.' };
  }
  if (!Array.isArray(districts) || districts.length === 0) {
    return { ok: false, error: 'Select at least one district.' };
  }
  const allowedDistricts = new Set(Object.keys(ASD_LOCATION_MATRIX[state] ?? {}));
  for (const district of districts) {
    if (!allowedDistricts.has(district)) {
      return { ok: false, error: `District "${district}" is not available for ${state}.` };
    }
  }
  if (!Array.isArray(locationIds) || locationIds.length === 0) {
    return { ok: false, error: 'Select at least one location.' };
  }
  const districtSet = new Set(districts);
  for (const id of locationIds) {
    const parsed = parseLocationId(id);
    if (!parsed || parsed.state !== state || !districtSet.has(parsed.district)) {
      return { ok: false, error: 'One or more selected locations are invalid.' };
    }
  }
  return { ok: true };
}

module.exports = {
  ASD_LOCATION_MATRIX,
  STATES,
  CONSENT_POLICY_VERSION,
  parseLocationId,
  formatLocationSummary,
  validateLocationSelection
};

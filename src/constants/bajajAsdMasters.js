/** Admin-configurable ASD location master (keep in sync with frontend masters). */
const ASD_LOCATIONS = [
  { id: 'patna-sd', label: 'Patna Sub-Dealership', district: 'Patna', state: 'Bihar' },
  { id: 'gaya-sd', label: 'Gaya Sub-Dealership', district: 'Gaya', state: 'Bihar' },
  { id: 'muzaffarpur-sd', label: 'Muzaffarpur Sub-Dealership', district: 'Muzaffarpur', state: 'Bihar' },
  { id: 'bhagalpur-sd', label: 'Bhagalpur Sub-Dealership', district: 'Bhagalpur', state: 'Bihar' },
  { id: 'darbhanga-sd', label: 'Darbhanga Sub-Dealership', district: 'Darbhanga', state: 'Bihar' },
  { id: 'purnia-sd', label: 'Purnia Sub-Dealership', district: 'Purnia', state: 'Bihar' },
  { id: 'arrah-sd', label: 'Arrah Sub-Dealership', district: 'Bhojpur', state: 'Bihar' },
  { id: 'begusarai-sd', label: 'Begusarai Sub-Dealership', district: 'Begusarai', state: 'Bihar' },
  { id: 'ranchi-sd', label: 'Ranchi Sub-Dealership', district: 'Ranchi', state: 'Jharkhand' },
  { id: 'jamshedpur-sd', label: 'Jamshedpur Sub-Dealership', district: 'East Singhbhum', state: 'Jharkhand' },
  { id: 'dhanbad-sd', label: 'Dhanbad Sub-Dealership', district: 'Dhanbad', state: 'Jharkhand' },
  { id: 'bokaro-sd', label: 'Bokaro Sub-Dealership', district: 'Bokaro', state: 'Jharkhand' },
  { id: 'deoghar-sd', label: 'Deoghar Sub-Dealership', district: 'Deoghar', state: 'Jharkhand' },
  { id: 'hazaribagh-sd', label: 'Hazaribagh Sub-Dealership', district: 'Hazaribagh', state: 'Jharkhand' }
];

const STATES = ['Bihar', 'Jharkhand'];

const CONSENT_POLICY_VERSION = 'bajaj-asd-v1';

function findAsdLocation(id) {
  return ASD_LOCATIONS.find((l) => l.id === id);
}

module.exports = {
  ASD_LOCATIONS,
  STATES,
  CONSENT_POLICY_VERSION,
  findAsdLocation
};

// More of the territory: accounts and doctors across New York and New Jersey
// that aren't on the team's list, so Targets has more to look through than the
// rep's own book, and the territories next door, Connecticut and Pennsylvania,
// to look around in. Every account and person here is made up. The doctors are
// generated from a fixed seed, so they're the same on every phone and in every
// test, and next door is made after the rep's own, so adding it left those as
// they were. Phone numbers use 555 and emails example.org. An account's figures
// are the sum of its doctors', scaled up for the staff the sample leaves out.

import { sum, yoy } from '../format';
import type { Affiliation, Confirms, DiagnosisRow, HcpData, LonLat, OrgData, ProcedureRow, TimeWindow } from '../types';
import { WEB_SECTIONS } from './hcps';
import { addSeries, isTest, series } from './series';

/** A small random number generator with a fixed seed (mulberry32), so the sample never changes. */
function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const random = seeded(20261022);
const between = (lo: number, hi: number): number => Math.round(lo + random() * (hi - lo));
const chance = (p: number): boolean => random() < p;

function pick<T>(list: readonly T[]): T {
  return list[Math.floor(random() * list.length)];
}

function weighted<T extends { weight: number }>(list: readonly T[]): T {
  let r = random() * sum(list.map((item) => item.weight));
  for (const item of list) if ((r -= item.weight) < 0) return item;
  return list[list.length - 1];
}

function shuffled<T>(list: readonly T[]): T[] {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

const slug = (s: string): string => s.toLowerCase().replace(/[^a-z]/g, '');
const last4 = (s: number[]): number => sum(s.slice(-4));

/** A hospital, a heart and vascular centre, a cardiology practice or a surgery centre. */
type Kind = 'hospital' | 'heart' | 'practice' | 'surgery';

const DETAIL: Record<Kind, string> = {
  hospital: 'Community hospital',
  heart: 'Heart and vascular centre',
  practice: 'Cardiology practice',
  surgery: 'Ambulatory surgery centre',
};

// id, name, kind, address, city, where it is, beds, phone area code
type PlaceRow = [string, string, Kind, string, string, LonLat, number | null, string];

const PLACES: PlaceRow[] = [
  ['alderbrook', 'Alderbrook Medical Center', 'hospital', '600 East Fordham Road', 'Bronx, NY 10458', [-73.889, 40.861], 310, '718'],
  ['cedarline', 'Cedarline Heart Institute', 'heart', '3400 White Plains Road', 'Bronx, NY 10467', [-73.871, 40.88], null, '718'],
  ['bridgemoor', 'Bridgemoor Hospital', 'hospital', '120 Court Street', 'Brooklyn, NY 11201', [-73.99, 40.693], 450, '718'],
  ['driftmoor', 'Driftmoor Cardiology Group', 'practice', '310 Seventh Avenue', 'Brooklyn, NY 11215', [-73.98, 40.668], null, '718'],
  ['elmstone', 'Elmstone Medical Center', 'hospital', '9200 Fourth Avenue', 'Brooklyn, NY 11209', [-74.029, 40.625], 260, '718'],
  ['fernhollow', 'Fernhollow Hospital', 'hospital', '41-20 Main Street', 'Flushing, NY 11355', [-73.827, 40.752], 340, '718'],
  ['glenvarra', 'Glenvarra Vascular Center', 'surgery', '107-40 Queens Boulevard', 'Forest Hills, NY 11375', [-73.845, 40.721], null, '718'],
  ['harrowgate', 'Harrowgate Medical Center', 'hospital', '89-00 Hillside Avenue', 'Jamaica, NY 11432', [-73.799, 40.709], 420, '718'],
  ['islecrest', 'Islecrest Hospital', 'hospital', '1450 Hylan Boulevard', 'Staten Island, NY 10305', [-74.077, 40.604], 380, '718'],
  ['juniper', 'Juniper Point Heart Center', 'heart', '200 Mamaroneck Avenue', 'White Plains, NY 10601', [-73.763, 41.034], null, '914'],
  ['kestrel', 'Kestrel Hill Hospital', 'hospital', '900 North Broadway', 'Yonkers, NY 10701', [-73.899, 40.931], 240, '914'],
  ['larkwood', 'Larkwood Cardiology Associates', 'practice', '150 Lockwood Avenue', 'New Rochelle, NY 10801', [-73.782, 40.911], null, '914'],
  ['mossgate', 'Mossgate Medical Center', 'hospital', '250 Old Country Road', 'Mineola, NY 11501', [-73.641, 40.747], 500, '516'],
  ['northgrove', 'Northgrove Heart and Vascular', 'heart', '1500 Northern Boulevard', 'Manhasset, NY 11030', [-73.699, 40.798], null, '516'],
  ['orchard', 'Orchard Row Cardiology', 'practice', '75 Essex Street', 'New York, NY 10002', [-73.989, 40.718], null, '212'],
  ['pierhaven', 'Pierhaven Medical Center', 'hospital', '160 Water Street', 'New York, NY 10038', [-74.004, 40.709], 210, '212'],
  ['quarry', 'Quarry Ridge Medical Center', 'hospital', '410 Central Avenue', 'Newark, NJ 07103', [-74.172, 40.736], 520, '973'],
  ['riverwick', 'Riverwick Heart Institute', 'heart', '1000 South Orange Avenue', 'Newark, NJ 07106', [-74.225, 40.742], null, '973'],
  ['saltmarsh', 'Saltmarsh Hospital', 'hospital', '90 Columbus Drive', 'Jersey City, NJ 07302', [-74.04, 40.718], 300, '201'],
  ['tidemark', 'Tidemark Cardiology Group', 'practice', '600 Washington Street', 'Hoboken, NJ 07030', [-74.032, 40.744], null, '201'],
  ['upton', 'Upton Ridge Medical Center', 'hospital', '400 Essex Street', 'Hackensack, NJ 07601', [-74.043, 40.886], 610, '201'],
  ['valemont', 'Valemont Vascular Center', 'surgery', '45 Grand Avenue', 'Englewood, NJ 07631', [-73.973, 40.893], null, '201'],
  ['westholme', 'Westholme Hospital', 'hospital', '210 Market Street', 'Paterson, NJ 07505', [-74.17, 40.914], 360, '973'],
  ['willowmere', 'Willowmere Heart Center', 'heart', '650 From Road', 'Paramus, NJ 07652', [-74.075, 40.945], null, '201'],
  ['yarrow', 'Yarrow Hill Medical Center', 'hospital', '60 Speedwell Avenue', 'Morristown, NJ 07960', [-74.481, 40.797], 450, '973'],
  ['zephyr', 'Zephyr Cardiology Associates', 'practice', '315 East Northfield Road', 'Livingston, NJ 07039', [-74.315, 40.796], null, '973'],
  ['amberfield', 'Amberfield Hospital', 'hospital', '40 Morris Avenue', 'Summit, NJ 07901', [-74.359, 40.716], 280, '908'],
  ['bramblewood', 'Bramblewood Medical Center', 'hospital', '350 George Street', 'New Brunswick, NJ 08901', [-74.452, 40.496], 580, '732'],
  ['clearholt', 'Clearholt Heart and Vascular', 'heart', '1500 Oak Tree Road', 'Edison, NJ 08820', [-74.345, 40.572], null, '732'],
  ['dunraven', 'Dunraven Cardiology Group', 'practice', '600 North Broad Street', 'Elizabeth, NJ 07208', [-74.22, 40.672], null, '908'],
];

// Next door, in Connecticut and Pennsylvania.
const NEXT_DOOR_PLACES: PlaceRow[] = [
  ['ashcombe', 'Ashcombe Medical Center', 'hospital', '210 Atlantic Street', 'Stamford, CT 06901', [-73.539, 41.053], 305, '203'],
  ['briarvale', 'Briarvale Heart Center', 'heart', '1250 Post Road', 'Fairfield, CT 06824', [-73.264, 41.141], null, '203'],
  ['copperbeech', 'Copperbeech Cardiology Group', 'practice', '40 Wall Street', 'Norwalk, CT 06850', [-73.414, 41.117], null, '203'],
  ['dovecote', 'Dovecote Medical Center', 'hospital', '415 Whitney Avenue', 'New Haven, CT 06511', [-72.918, 41.322], 480, '203'],
  ['emberline', 'Emberline Vascular Center', 'surgery', '330 Boston Post Road', 'Orange, CT 06477', [-73.026, 41.27], null, '203'],
  ['foxmere', 'Foxmere Hospital', 'hospital', '85 Farmington Avenue', 'Hartford, CT 06105', [-72.697, 41.766], 390, '860'],
  ['galewood', 'Galewood Cardiology Associates', 'practice', '20 South Main Street', 'West Hartford, CT 06107', [-72.744, 41.762], null, '860'],
  ['hollowmere', 'Hollowmere Hospital', 'hospital', '1800 Fairmount Avenue', 'Philadelphia, PA 19130', [-75.169, 39.967], 520, '215'],
  ['ironvale', 'Ironvale Heart Institute', 'heart', '3300 Ridge Avenue', 'Philadelphia, PA 19129', [-75.187, 40.008], null, '215'],
  ['kettlewood', 'Kettlewood Cardiology Group', 'practice', '150 East Lancaster Avenue', 'Wayne, PA 19087', [-75.387, 40.044], null, '610'],
  ['nettlebrook', 'Nettlebrook Medical Center', 'hospital', '1200 Hamilton Street', 'Allentown, PA 18102', [-75.471, 40.602], 350, '610'],
  ['oakhallow', 'Oakhallow Vascular Center', 'surgery', '600 West DeKalb Pike', 'King of Prussia, PA 19406', [-75.396, 40.089], null, '610'],
  ['rookhaven', 'Rookhaven Hospital', 'hospital', '250 East King Street', 'Lancaster, PA 17602', [-76.301, 40.039], 290, '717'],
];

const TEACHING = new Set(['bridgemoor', 'harrowgate', 'mossgate', 'quarry', 'upton', 'bramblewood', 'dovecote', 'hollowmere']);

const toPlace = ([id, name, kind, address, city, coords, beds, area]: PlaceRow) => ({
  id,
  name,
  kind,
  address,
  city,
  coords,
  beds,
  area,
  state: /, ([A-Z]{2}) \d{5}$/.exec(city)?.[1] ?? '',
});
type Place = ReturnType<typeof toPlace>;

interface Specialty {
  name: string;
  count: number;
  role: string;
  boards: string[];
  residency: string;
  fellowship: string | null;
  /** The kinds of place they work at. */
  where: Kind[];
  /** A quarter's volume, from lo to hi; below 2 they don't do it. */
  procedures: [family: string, code: string, lo: number, hi: number][];
  diagnoses: [name: string, code: string, lo: number, hi: number][];
  /** Why they matter, for those who do none of the sample's procedures. */
  note?: string;
}

const SPECIALTIES: Specialty[] = [
  {
    name: 'Interventional Cardiology',
    count: 25,
    role: 'Interventional cardiologist',
    boards: ['Cardiovascular Disease', 'Interventional Cardiology'],
    residency: 'Internal Medicine',
    fellowship: 'Interventional Cardiology',
    where: ['hospital', 'heart', 'practice', 'surgery'],
    procedures: [
      ['Diagnostic cardiac cath', 'CPT 93458', 30, 110],
      ['PCI', 'CPT 92928', 20, 80],
      ['TAVR (co-operator)', 'CPT 33361', -10, 15],
      ['Peripheral intervention', 'CPT 37225', -8, 10],
    ],
    diagnoses: [
      ['Coronary artery disease', 'I25.10', 200, 450],
      ['Stable angina', 'I20.9', 80, 180],
      ['NSTEMI', 'I21.4', 40, 90],
    ],
  },
  {
    name: 'Cardiology',
    count: 30,
    role: 'Cardiologist',
    boards: ['Cardiovascular Disease'],
    residency: 'Internal Medicine',
    fellowship: 'Cardiovascular Disease',
    where: ['hospital', 'heart', 'practice'],
    procedures: [
      ['Echocardiography', 'CPT 93306', 80, 260],
      ['Stress testing', 'CPT 93015', 40, 120],
      ['Diagnostic cardiac cath', 'CPT 93458', -20, 30],
    ],
    diagnoses: [
      ['Hypertension', 'I10', 400, 900],
      ['Coronary artery disease', 'I25.10', 150, 350],
      ['Atrial fibrillation', 'I48.91', 100, 220],
      ['Heart failure', 'I50.9', 80, 180],
    ],
  },
  {
    name: 'Cardiac Electrophysiology',
    count: 15,
    role: 'Electrophysiologist',
    boards: ['Cardiovascular Disease', 'Clinical Cardiac Electrophysiology'],
    residency: 'Internal Medicine',
    fellowship: 'Clinical Cardiac Electrophysiology',
    where: ['hospital', 'heart', 'practice'],
    procedures: [
      ['AF ablation', 'CPT 93656', 10, 35],
      ['Pacemaker implant', 'CPT 33208', 8, 22],
      ['ICD implant', 'CPT 33249', 4, 12],
      ['Loop recorder', 'CPT 33285', 5, 18],
    ],
    diagnoses: [
      ['Atrial fibrillation', 'I48.91', 250, 550],
      ['Supraventricular tachycardia', 'I47.1', 40, 90],
      ['Bradycardia', 'R00.1', 30, 70],
    ],
  },
  {
    name: 'Cardiothoracic Surgery',
    count: 12,
    role: 'Cardiac surgeon',
    boards: ['Thoracic and Cardiac Surgery'],
    residency: 'General Surgery',
    fellowship: 'Cardiothoracic Surgery',
    where: ['hospital'],
    procedures: [
      ['TAVR', 'CPT 33361', 8, 30],
      ['CABG', 'CPT 33533', 8, 24],
      ['SAVR', 'CPT 33405', 3, 12],
      ['Mitral repair', 'CPT 33426', 2, 8],
    ],
    diagnoses: [
      ['Aortic stenosis', 'I35.0', 60, 150],
      ['Coronary artery disease', 'I25.10', 60, 130],
      ['Mitral regurgitation', 'I34.0', 20, 50],
    ],
  },
  {
    name: 'Vascular Surgery',
    count: 15,
    role: 'Vascular surgeon',
    boards: ['Vascular Surgery'],
    residency: 'General Surgery',
    fellowship: 'Vascular Surgery',
    where: ['hospital', 'heart', 'surgery'],
    procedures: [
      ['Peripheral intervention', 'CPT 37225', 12, 42],
      ['Carotid stenting', 'CPT 37215', 2, 10],
      ['EVAR', 'CPT 34702', 2, 9],
    ],
    diagnoses: [
      ['Peripheral artery disease', 'I73.9', 120, 280],
      ['Abdominal aortic aneurysm', 'I71.4', 20, 50],
    ],
  },
  {
    name: 'Advanced Heart Failure Cardiology',
    count: 8,
    role: 'Heart failure cardiologist',
    boards: ['Cardiovascular Disease', 'Advanced Heart Failure and Transplant Cardiology'],
    residency: 'Internal Medicine',
    fellowship: 'Advanced Heart Failure and Transplant Cardiology',
    where: ['hospital', 'heart'],
    procedures: [
      ['Right heart cath', 'CPT 93451', 10, 32],
      ['LVAD implant (co-managed)', 'CPT 33979', -3, 4],
    ],
    diagnoses: [
      ['Heart failure', 'I50.9', 300, 650],
      ['Cardiomyopathy', 'I42.9', 60, 130],
    ],
  },
  {
    name: 'Internal Medicine',
    count: 10,
    role: 'Internist',
    boards: ['Internal Medicine'],
    residency: 'Internal Medicine',
    fellowship: null,
    where: ['hospital'],
    procedures: [],
    diagnoses: [
      ['Hypertension', 'I10', 700, 1400],
      ['Coronary artery disease', 'I25.10', 120, 260],
      ['Atrial fibrillation', 'I48.91', 60, 140],
    ],
    note: 'Primary care. Sends heart patients to cardiologists nearby.',
  },
  {
    name: 'Nephrology',
    count: 5,
    role: 'Nephrologist',
    boards: ['Nephrology'],
    residency: 'Internal Medicine',
    fellowship: 'Nephrology',
    where: ['hospital'],
    procedures: [],
    diagnoses: [
      ['Chronic kidney disease, stage 3–5', 'N18.3–N18.5', 150, 300],
      ['Cardiorenal syndrome', 'I13.0', 10, 25],
    ],
    note: 'Sees kidney patients with heart disease, and refers them to cardiology nearby.',
  },
];

// The days someone is in and the times they see people, which always fall on days they're in.
const PATTERNS: { days: string; windows: TimeWindow[]; preferred: string | null; weight: number }[] = [
  { days: 'Mon–Fri', windows: [{ days: 'Tue, Thu', from: '07:30', to: '08:30' }], preferred: 'Tue & Thu, 7:30–8:30 before clinic', weight: 15 },
  { days: 'Mon–Fri', windows: [{ days: 'Mon–Fri', from: '16:00', to: '17:30' }], preferred: 'After 4 pm, once clinic is done', weight: 12 },
  { days: 'Mon–Fri', windows: [], preferred: null, weight: 15 },
  { days: 'Mon–Thu', windows: [{ days: 'Wed', from: '13:00', to: '16:00' }], preferred: 'Wednesday afternoons', weight: 10 },
  { days: 'Mon–Thu', windows: [], preferred: null, weight: 8 },
  { days: 'Mon, Wed, Fri', windows: [{ days: 'Mon, Wed', from: '12:00', to: '13:00' }], preferred: 'Lunch on Mondays and Wednesdays', weight: 10 },
  { days: 'Tue–Fri', windows: [{ days: 'Fri', from: '09:00', to: '11:00' }], preferred: 'Friday mornings', weight: 10 },
  { days: 'Tue–Fri', windows: [], preferred: null, weight: 8 },
  { days: 'Mon–Fri', windows: [{ days: 'Mon–Fri', from: '12:00', to: '13:00' }], preferred: 'Lunch hour, 12–1', weight: 12 },
];

// First and last names are each used once, and none is an everyday word, so
// Ask can tell who a question means.
const FIRST_NAMES = [
  'Adaeze', 'Aditi', 'Ahmed', 'Aiko', 'Alejandro', 'Amara', 'Anders', 'Anika', 'Arjun', 'Astrid',
  'Ayesha', 'Bao', 'Beatriz', 'Bilal', 'Camila', 'Chidi', 'Chiara', 'Dmitri', 'Dalia', 'Darius',
  'Delphine', 'Desmond', 'Divya', 'Emeka', 'Esther', 'Farah', 'Fatima', 'Felipe', 'Freya', 'Gabriela',
  'Goran', 'Hamza', 'Hana', 'Haruto', 'Ines', 'Ingrid', 'Isaac', 'Ivana', 'Jamal', 'Jasmin',
  'Javier', 'Junaid', 'Karim', 'Keiko', 'Kofi', 'Lars', 'Leila', 'Lorenzo', 'Lucia', 'Mateo',
  'Mei', 'Mirela', 'Nadia', 'Naveen', 'Nikolai', 'Nkechi', 'Noor', 'Oksana', 'Omar', 'Paolo',
  'Pilar', 'Quentin', 'Rahul', 'Rania', 'Renata', 'Rohan', 'Saanvi', 'Salma', 'Santiago', 'Selin',
  'Soren', 'Sunil', 'Tamar', 'Tariq', 'Thandiwe', 'Tobias', 'Ulla', 'Valentina', 'Vikram', 'Wen',
  'Ximena', 'Yara', 'Yusuf', 'Zainab', 'Zoltan', 'Abigail', 'Benjamin', 'Caroline', 'Dorothy', 'Edward',
  'Fiona', 'Gregory', 'Harriet', 'Ian', 'Julia', 'Kevin', 'Laura', 'Michael', 'Nathan', 'Olivia',
  'Patrick', 'Rachel', 'Simon', 'Vincent', 'Wendy', 'Zachary', 'Andrea', 'Brian', 'Claire', 'Derek',
  'Eleanor', 'Graham', 'Joanna', 'Kristen', 'Linda', 'Martin', 'Nora', 'Owen', 'Peter', 'Yvonne',
];

const LAST_NAMES = [
  'Abara', 'Adeyemi', 'Agarwal', 'Albrecht', 'Alvarado', 'Amsel', 'Andersen', 'Arroyo', 'Asante', 'Baptiste',
  'Bergstrom', 'Bhatt', 'Bianchi', 'Brandt', 'Castellano', 'Chakraborty', 'Chaudhry', 'Dalca', 'Dasgupta', 'Desai',
  'Dimitrov', 'Duarte', 'Ebner', 'Eriksen', 'Esposito', 'Farouk', 'Ferreira', 'Fontaine', 'Fujita', 'Gallardo',
  'Ghosh', 'Goldberg', 'Grigorian', 'Guzman', 'Haddad', 'Halvorsen', 'Hashemi', 'Hoffmann', 'Horvath', 'Ibarra',
  'Ilic', 'Iyer', 'Jablonski', 'Janssen', 'Jovanovic', 'Kaczmarek', 'Kapoor', 'Karlsson', 'Kaur', 'Kimura',
  'Kowalski', 'Krishnan', 'Lachance', 'Lindqvist', 'Lombardi', 'Lucero', 'Madsen', 'Mahmoud', 'Malik', 'Marchetti',
  'Mendoza', 'Mishra', 'Moreau', 'Mukherjee', 'Nakamura', 'Navarro', 'Novak', 'Nwosu', 'Obi', 'Ogunleye',
  'Oliveira', 'Ortega', 'Osei', 'Ozturk', 'Pacheco', 'Pereira', 'Petrov', 'Pham', 'Quintero', 'Rasmussen',
  'Ramos', 'Romano', 'Rosen', 'Saito', 'Salazar', 'Santoro', 'Schreiber', 'Sepulveda', 'Shapiro', 'Sharma',
  'Sokolov', 'Suarez', 'Takahashi', 'Tanaka', 'Thakur', 'Torres', 'Tran', 'Ueda', 'Valdez', 'Varga',
  'Vasquez', 'Venkatesan', 'Vogel', 'Volkov', 'Wojcik', 'Yamamoto', 'Yilmaz', 'Zamora', 'Zielinski', 'Zhou',
  'Abiodun', 'Bakshi', 'Castillo', 'Demir', 'Fiore', 'Kovacs', 'Mensah', 'Okonkwo', 'Rinaldi', 'Szabo',
];

// One person at each account to ask for, in the same order as the accounts.
const CONTACT_FIRST = [
  'Abena', 'Bruno', 'Celeste', 'Dario', 'Elif', 'Fabian', 'Gita', 'Henrik', 'Imani', 'Jonas',
  'Kalani', 'Lucien', 'Marisol', 'Nils', 'Odette', 'Piero', 'Rafaela', 'Sebastian', 'Talia', 'Umar',
  'Viviane', 'Wiktor', 'Yasmin', 'Zeynep', 'Anouk', 'Bastien', 'Cosima', 'Duc', 'Esme', 'Florin',
];
const CONTACT_LAST = [
  'Achterberg', 'Balogun', 'Calloway', 'Dunleavy', 'Eckhardt', 'Ferraro', 'Gunnarsson', 'Holloway', 'Ikeda', 'Jaramillo',
  'Kessler', 'Lindgren', 'Moreno', 'Nakashima', 'Oyelaran', 'Pruitt', 'Quiroga', 'Rademacher', 'Sorensen', 'Tsai',
  'Vandermeer', 'Whitlock', 'Yoshida', 'Zeller', 'Abernathy', 'Bianco', 'Cruz', 'Dlamini', 'Esteves', 'Kowal',
];

// Next door's, none of them used above either.
const NEXT_DOOR_FIRST = [
  'Adebayo', 'Agnieszka', 'Akira', 'Alessandra', 'Amina', 'Anselm', 'Bahar', 'Bettina', 'Cyrus', 'Dagny',
  'Dhruv', 'Efua', 'Emil', 'Eszter', 'Folasade', 'Giorgio', 'Gwendolyn', 'Hiroshi', 'Ilse', 'Ishaan',
  'Jelena', 'Joaquin', 'Kaveh', 'Brigitte', 'Leandro', 'Lucinda', 'Mariam', 'Matthias', 'Nadim', 'Nobuko',
  'Olumide', 'Orla', 'Ananya', 'Radek', 'Rosalind', 'Sakura', 'Sergio', 'Siobhan', 'Teodor', 'Thuy',
  'Uchenna', 'Valeria', 'Wanjiru', 'Xavier', 'Yolanda', 'Yuki', 'Zara', 'Elliot', 'Gideon', 'Margot',
  'Ronan', 'Philippa',
];
const NEXT_DOOR_LAST = [
  'Adewale', 'Aguilar', 'Andrade', 'Bachmann', 'Barbosa', 'Bjornsson', 'Bondarenko', 'Cardenas', 'Ceylan', 'Christensen',
  'Devereux', 'Dobrev', 'Eklund', 'Espinoza', 'Fernandes', 'Forsberg', 'Gallagher', 'Gerhardt', 'Hosseini', 'Holmberg',
  'Ishikawa', 'Jankowski', 'Kalinowski', 'Kariuki', 'Kobayashi', 'Lemaire', 'Lindahl', 'Marino', 'Matsumoto', 'Nascimento',
  'Nieminen', 'Nyberg', 'Okeke', 'Olsen', 'Pellegrini', 'Popescu', 'Rahman', 'Reinholt', 'Sandoval', 'Sato',
  'Siddiqui', 'Sundberg', 'Tavares', 'Umeh', 'Vaccaro', 'Vidal', 'Weidemann', 'Yoon', 'Zubiri', 'Kuznetsov',
  'Abdullah', 'Mwangi',
];
const NEXT_DOOR_CONTACT_FIRST = ['Agathe', 'Benedikt', 'Clementine', 'Dorian', 'Eamon', 'Femi', 'Gaspard', 'Hedda', 'Ilaria', 'Jules', 'Katarina', 'Leopold', 'Mireille'];
const NEXT_DOOR_CONTACT_LAST = ['Arceneaux', 'Blomqvist', 'Corrigan', 'Dufresne', 'Etxeberria', 'Fairbanks', 'Galloway', 'Hargreaves', 'Iwasaki', 'Jorgensen', 'Kavanagh', 'Lindvall', 'Marchand'];

const CONTACT_TITLES: Record<Kind, [title: string, role: string, doctor: boolean][]> = {
  hospital: [
    ['Director, Cardiovascular Services', 'Decision maker', false],
    ['Cath Lab Manager', 'Gatekeeper', false],
    ['Chief of Cardiology', 'Clinical champion', true],
  ],
  heart: [
    ['Practice Administrator', 'Gatekeeper', false],
    ['Medical Director', 'Clinical champion', true],
  ],
  practice: [
    ['Practice Manager', 'Gatekeeper', false],
    ['Managing Partner', 'Decision maker', true],
  ],
  surgery: [
    ['Center Administrator', 'Gatekeeper', false],
    ['Medical Director', 'Clinical champion', true],
  ],
};

const SCHOOLS = [
  'Rutgers New Jersey Medical School',
  'Rutgers Robert Wood Johnson Medical School',
  'SUNY Downstate College of Medicine',
  'Albert Einstein College of Medicine',
  'Stony Brook University School of Medicine',
  'NYU Grossman School of Medicine',
  'Weill Cornell Medicine',
  'Boston University School of Medicine',
  'Perelman School of Medicine at the University of Pennsylvania',
  'Georgetown University School of Medicine',
  'University of Michigan Medical School',
  'St. George’s University School of Medicine',
  'University of Toronto Faculty of Medicine',
  'University of Lagos College of Medicine',
];

const TRAINING = [
  'Montefiore Medical Center',
  'NYU Langone',
  'Stony Brook University Hospital',
  'Westchester Medical Center',
  'Mount Sinai Hospital',
  'NewYork-Presbyterian',
  'Maimonides Medical Center',
  'Lenox Hill Hospital',
  'Robert Wood Johnson University Hospital',
];

const LANGUAGES = ['Spanish', 'Mandarin', 'Hindi', 'French', 'Arabic', 'Russian', 'Portuguese', 'Korean', 'Polish', 'Tagalog', 'Bengali', 'Yoruba', 'Italian', 'Haitian Creole'];

const REACH = [
  'Call the office a week ahead.',
  'Email first. Replies within a day or two.',
  'Ask at the front desk; the scheduler keeps the diary.',
  'Text the office manager the day before.',
  'Book through the practice’s scheduling line.',
];
const ACCOUNT_REACH = [
  'Call the main line and ask for the cardiology office.',
  'Email the practice manager with a short agenda.',
  'Book through the cath lab coordinator, two weeks ahead.',
  'The front desk takes messages. Call before ten.',
];
const CONFIRMS: Confirms[] = ['usually', 'sometimes', 'rarely'];

const COMPETITORS = ['Competitor A', 'Competitor B'];

// How many doctors each kind of place takes, roughly, as they're shared out.
const ROOM: Record<Kind, number> = { hospital: 5.5, heart: 3.5, practice: 3, surgery: 2.5 };

/** Their main place: the least full of the region's places their specialty works at. */
function homeFor(s: Specialty, places: Place[], staffed: Map<string, number>): Place {
  const options = places.filter((p) => s.where.includes(p.kind));
  const fullness = (p: Place) => (staffed.get(p.id)! + 1) / ROOM[p.kind];
  const least = Math.min(...options.map(fullness));
  const home = pick(options.filter((p) => fullness(p) === least));
  staffed.set(home.id, staffed.get(home.id)! + 1);
  return home;
}

/** Somewhere else nearby in the same state, for a Friday elsewhere. */
function secondSite(home: Place, s: Specialty, places: Place[]): Place | null {
  const apart = (p: Place) => Math.hypot(p.coords[0] - home.coords[0], p.coords[1] - home.coords[1]);
  return places.filter((p) => p.id !== home.id && p.state === home.state && s.where.includes(p.kind)).sort((a, b) => apart(a) - apart(b))[0] ?? null;
}

/** Their name for a procedure without "(co-operator)", and lower case unless it's an abbreviation. */
const plainFamily = (family: string): string => family.replace(/ \((co-operator|co-managed)\)$/, '');
const midSentence = (family: string): string => (/^[A-Z][a-z]/.test(family) ? family[0].toLowerCase() + family.slice(1) : family);

function insightFor(s: Specialty, rows: ProcedureRow[], competitor: string | null): string {
  if (!rows.length) return s.note ?? '';
  // Echo and stress tests aren't procedures, so someone doing only those is said to.
  const procedures = rows.filter((r) => !isTest(r));
  const counted = procedures.length ? procedures : rows;
  const change = Math.round(yoy(addSeries(counted.map((r) => r.series))));
  const how = change >= 5 ? `up about ${change}% on last year` : change <= -5 ? `down about ${-change}% on last year` : '';
  let trend = `Does echo and stress tests rather than procedures${how ? `, ${how}` : ''}.`;
  if (procedures.length) {
    const top = midSentence(plainFamily([...procedures].sort((a, b) => last4(b.series) - last4(a.series))[0].family));
    trend = how ? `Procedures ${how}, mostly ${top}.` : `Steady procedure numbers, mostly ${top}.`;
  }
  return competitor ? `${trend} Uses ${competitor} for most cases.` : trend;
}

/** Rows from several doctors added up by code (or name), each scaled by its weight. */
function addUp<T extends { code: string; series: number[] }>(rows: { row: T; weight: number }[], key: (row: T) => string, name: (row: T) => T): T[] {
  const groups = new Map<string, T>();
  for (const { row, weight } of rows) {
    const scaled = row.series.map((v) => v * weight);
    const have = groups.get(key(row));
    groups.set(key(row), have ? { ...have, series: addSeries([have.series, scaled]) } : { ...name(row), series: scaled });
  }
  return [...groups.values()].map((r) => ({ ...r, series: r.series.map((v) => Math.round(v)) })).sort((a, b) => last4(b.series) - last4(a.series));
}

// The staff the sample leaves out: a hospital has about three times the volume of its doctors here.
const SCALE: Record<Kind, [number, number]> = { hospital: [2.5, 3.5], heart: [1.4, 1.8], practice: [1.2, 1.5], surgery: [1.5, 2] };

interface Region {
  places: PlaceRow[];
  /** A doctor for each first name, and at each account a person to ask for, in the same order as the places. */
  firstNames: string[];
  lastNames: string[];
  contactFirst: string[];
  contactLast: string[];
  /** Where its numbers start, so no two are the same: NPIs, then the 555 numbers of its doctors, accounts and the people to ask for. */
  from: { npi: number; doctor: number; account: number; contact: number };
}

/** A region's doctors, then its accounts, from the seed where the region before left off. */
function generate(region: Region): { hcps: HcpData[]; orgs: OrgData[] } {
  const places = region.places.map(toPlace);
  const staffed = new Map(places.map((p) => [p.id, 0]));
  const specialties = shuffled(SPECIALTIES.flatMap((s) => Array.from({ length: s.count }, () => s)));
  const lastNames = shuffled(region.lastNames);

  const hcps: HcpData[] = region.firstNames.map((first, i) => {
    const last = lastNames[i];
    const s = specialties[i];
    const pattern = weighted(PATTERNS);
    const home = homeFor(s, places, staffed);
    const affiliations: Affiliation[] = [{ orgId: home.id, role: s.role, share: 100, days: pattern.days }];
    // Some who are in Monday to Thursday spend Friday at another place nearby.
    const away = pattern.days === 'Mon–Thu' && chance(0.6) ? secondSite(home, s, places) : null;
    if (away) {
      const share = between(20, 35);
      affiliations[0].share = 100 - share;
      affiliations.push({ orgId: away.id, role: `Visiting ${s.role.toLowerCase()}`, share, days: 'Fri' });
    }
    const trend = -0.12 + random() * 0.34;
    const procedures: ProcedureRow[] = s.procedures.flatMap(([family, code, lo, hi]) => {
      const base = between(lo, hi);
      return base < 2 ? [] : [{ family, code, series: series(base, trend + (random() - 0.5) * 0.1) }];
    });
    const diagnoses: DiagnosisRow[] = s.diagnoses.map(([name, code, lo, hi]) => ({ name, code, series: series(between(lo, hi), 0.02 + random() * 0.08) }));
    const competitor = procedures.length && chance(0.35) ? pick(COMPETITORS) : null;
    const education: [string, string][] = [
      ['Medical school', pick(SCHOOLS)],
      ['Residency', `${s.residency}, ${pick(TRAINING)}`],
    ];
    if (s.fellowship) education.push(['Fellowship', `${s.fellowship}, ${pick(TRAINING)}`]);
    return {
      id: `${slug(first)}-${slug(last)}`,
      name: `Dr. ${first} ${last}`,
      credentials: chance(0.12) ? 'DO' : 'MD',
      npi: String(region.from.npi + i),
      specialty: s.name,
      yearsInPractice: between(3, 30),
      languages: chance(0.45) ? ['English', pick(LANGUAGES)] : ['English'],
      education,
      boards: s.boards,
      contact: {
        phone: `(${home.area}) 555-${region.from.doctor + i}`,
        email: `${slug(first)}.${slug(last)}@example.org`,
        preferred: pattern.preferred,
        assistant: null,
        ...(pattern.windows.length ? { windows: pattern.windows } : {}),
      },
      access: { reach: pick(REACH), confirms: pick(CONFIRMS) },
      affiliations,
      procedures: procedures.length ? procedures : null,
      ...(procedures.length ? {} : { proceduresUnavailable: 'This specialty doesn’t do the cardiovascular procedures in this sample.' }),
      diagnoses,
      referrals: { inbound: [], outbound: [] },
      relationships: [],
      leakageRisk: false,
      insight: insightFor(s, procedures, competitor),
      webSections: WEB_SECTIONS,
      ...(competitor ? { competitors: [competitor] } : {}),
    };
  });

  const orgs: OrgData[] = places.map((p, i) => {
    const [lo, hi] = SCALE[p.kind];
    const scale = lo + random() * (hi - lo);
    const staff = hcps.flatMap((h) => h.affiliations.filter((a) => a.orgId === p.id).map((a) => ({ h, weight: (a.share / 100) * scale })));
    const procedures = addUp(
      staff.flatMap(({ h, weight }) => (h.procedures ?? []).map((row) => ({ row, weight }))),
      (r) => r.code,
      (r) => ({ ...r, family: plainFamily(r.family) }),
    );
    const diagnoses = addUp(
      staff.flatMap(({ h, weight }) => h.diagnoses.map((row) => ({ row, weight }))),
      (r) => r.name,
      (r) => r,
    );
    const [title, role, doctor] = pick(CONTACT_TITLES[p.kind]);
    const first = region.contactFirst[i];
    const last = region.contactLast[i];
    return {
      id: p.id,
      name: p.name,
      type: p.kind === 'hospital' ? 'Hospital' : 'Clinic',
      typeDetail: TEACHING.has(p.id) ? 'Teaching hospital' : DETAIL[p.kind],
      parentId: null,
      address: p.address,
      city: p.city,
      coords: p.coords,
      onMap: true,
      ownership: p.kind === 'hospital' ? 'Not-for-profit' : 'Physician-owned',
      phone: `(${p.area}) 555-${region.from.account + i}`,
      beds: p.beds,
      founded: null,
      assigned: false,
      access: { reach: pick(ACCOUNT_REACH), confirms: pick(CONFIRMS) },
      executives: [
        {
          id: slug(last),
          name: `${doctor ? 'Dr. ' : ''}${first} ${last}`,
          title,
          role,
          phone: `(${p.area}) 555-${region.from.contact + i}`,
          email: `${slug(first)}.${slug(last)}@example.org`,
        },
      ],
      procedures: procedures.length ? procedures : null,
      ...(procedures.length ? {} : { proceduresUnavailable: 'This clinic doesn’t do the cardiovascular procedures in this sample.' }),
      diagnoses,
      leakage: null,
      leakageUnavailable: 'Where patients go is counted only for your team’s accounts in this sample.',
      ...(chance(0.4) ? { competitors: [pick(COMPETITORS)] } : {}),
    };
  });
  return { hcps, orgs };
}

const yours = generate({
  places: PLACES,
  firstNames: FIRST_NAMES,
  lastNames: LAST_NAMES,
  contactFirst: CONTACT_FIRST,
  contactLast: CONTACT_LAST,
  from: { npi: 1000020001, doctor: 2200, account: 2100, contact: 2400 },
});
const nextDoor = generate({
  places: NEXT_DOOR_PLACES,
  firstNames: NEXT_DOOR_FIRST,
  lastNames: NEXT_DOOR_LAST,
  contactFirst: NEXT_DOOR_CONTACT_FIRST,
  contactLast: NEXT_DOOR_CONTACT_LAST,
  from: { npi: 1000020121, doctor: 2320, account: 2130, contact: 2430 },
});

// A practice near the team's hospitals in Manhattan North, written out rather
// than generated so the seeded ones stay as they were. It's across Morningside
// Park from Mount Sinai Morningside, so the daily brief has someone not in My
// targets to see on the way.
const adelekeProcedures: ProcedureRow[] = [
  { family: 'Diagnostic cardiac cath', code: 'CPT 93458', series: series(70, 0.1) },
  { family: 'PCI', code: 'CPT 92928', series: series(58, 0.14) },
  { family: 'Peripheral intervention', code: 'CPT 37225', series: series(6, 0.04) },
];
const ADELEKE: HcpData = {
  id: 'callum-adeleke',
  name: 'Dr. Callum Adeleke',
  credentials: 'MD',
  npi: '1000020180',
  specialty: 'Interventional Cardiology',
  yearsInPractice: 11,
  languages: ['English'],
  education: [
    ['Medical school', 'SUNY Downstate College of Medicine'],
    ['Residency', 'Internal Medicine, NYU Langone'],
    ['Fellowship', 'Interventional Cardiology, Lenox Hill Hospital'],
  ],
  boards: ['Cardiovascular Disease', 'Interventional Cardiology'],
  contact: { phone: '(212) 555-2380', email: 'callum.adeleke@example.org', preferred: null, assistant: null },
  access: { reach: 'Ask at the front desk; the scheduler keeps the diary.', confirms: 'usually' },
  affiliations: [{ orgId: 'wrenfield', role: 'Interventional cardiologist', share: 100, days: 'Mon–Fri' }],
  procedures: adelekeProcedures,
  diagnoses: [
    { name: 'Coronary artery disease', code: 'I25.10', series: series(330, 0.05) },
    { name: 'Stable angina', code: 'I20.9', series: series(130, 0.03) },
    { name: 'NSTEMI', code: 'I21.4', series: series(60, 0.04) },
  ],
  referrals: { inbound: [], outbound: [] },
  relationships: [],
  leakageRisk: false,
  insight: insightFor(SPECIALTIES[0], adelekeProcedures, 'Competitor B'),
  webSections: WEB_SECTIONS,
  competitors: ['Competitor B'],
};
const WRENFIELD: OrgData = {
  id: 'wrenfield',
  name: 'Wrenfield Cardiology Group',
  type: 'Clinic',
  typeDetail: DETAIL.practice,
  parentId: null,
  address: '2150 Frederick Douglass Boulevard',
  city: 'New York, NY 10026',
  coords: [-73.954, 40.804],
  onMap: true,
  ownership: 'Physician-owned',
  phone: '(212) 555-2150',
  beds: null,
  founded: null,
  assigned: false,
  access: { reach: 'Email the practice manager with a short agenda.', confirms: 'usually' },
  executives: [
    { id: 'thornquist', name: 'Saskia Thornquist', title: 'Practice Manager', role: 'Gatekeeper', phone: '(212) 555-2450', email: 'saskia.thornquist@example.org' },
  ],
  procedures: addUp(
    adelekeProcedures.map((row) => ({ row, weight: 1.3 })),
    (r) => r.code,
    (r) => ({ ...r, family: plainFamily(r.family) }),
  ),
  diagnoses: addUp(
    ADELEKE.diagnoses.map((row) => ({ row, weight: 1.3 })),
    (r) => r.name,
    (r) => r,
  ),
  leakage: null,
  leakageUnavailable: 'Where patients go is counted only for your team’s accounts in this sample.',
  competitors: ['Competitor B'],
};

/** The rest of the rep's own territory, in New York and New Jersey. */
export const TERRITORY_HCPS = [...yours.hcps, ADELEKE];
export const TERRITORY_ORGS = [...yours.orgs, WRENFIELD];
/** The territories next door, Connecticut and Pennsylvania. */
export const NEXT_DOOR_HCPS = nextDoor.hcps;
export const NEXT_DOOR_ORGS = nextDoor.orgs;

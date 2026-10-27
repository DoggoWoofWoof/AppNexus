// Specialties as reps say them: short beside a name, counted in a state, and
// in a sentence about someone.

/** Short enough to go beside a name: "Dr. Adeleke · Interventional". Others as they are. */
export const SHORT_SPECIALTY: Record<string, string> = {
  'Interventional Cardiology': 'Interventional',
  'Cardiac Electrophysiology': 'EP',
  'Cardiothoracic Surgery': 'Cardiothoracic',
  'Vascular Surgery': 'Vascular surgery',
  'Advanced Heart Failure Cardiology': 'Heart failure',
  'Internal Medicine': 'Internal medicine',
};

/** Who does it, one of them: "an interventional cardiologist" takes "an" from the first letter. */
export const SPECIALIST: Record<string, string> = {
  'Interventional Cardiology': 'interventional cardiologist',
  Cardiology: 'cardiologist',
  'Cardiac Electrophysiology': 'electrophysiologist',
  'Cardiothoracic Surgery': 'cardiothoracic surgeon',
  'Vascular Surgery': 'vascular surgeon',
  'Advanced Heart Failure Cardiology': 'heart failure cardiologist',
  Nephrology: 'nephrologist',
  'Internal Medicine': 'internist',
};

/** Several of them, as counted in a state: "4 of 9 cardiologists". */
export const SPECIALISTS: Record<string, string> = {
  ...Object.fromEntries(Object.entries(SPECIALIST).map(([specialty, one]) => [specialty, `${one}s`])),
  'Interventional Cardiology': 'interventionalists',
};

/** One who does a specialty, "interventional cardiologist", or "Pulmonology doctor" for one without a word of its own. */
export const specialist = (specialty: string): string => SPECIALIST[specialty] ?? `${specialty} doctor`;

/** Several, "interventionalists", or "Pulmonology doctors"; "doctors" for no specialty. */
export const specialists = (specialty: string): string => (specialty ? (SPECIALISTS[specialty] ?? `${specialty} doctors`) : 'doctors');

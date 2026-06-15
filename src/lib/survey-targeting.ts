export interface UserProfile {
  gender: string | null;
  age: number | null;
  job: string | null;
}

export interface SurveyTargeting {
  gender: string | null;
  age_min: number | null;
  age_max: number | null;
  jobs: string[] | null;
}

export const FIXED_JOBS = [
  'Mahasiswa',
  'Pelajar',
  'Karyawan',
  'Freelancer',
  'Wirausaha',
  'Ibu rumah tangga',
  'PNS',
  'Profesional',
  'Tidak bekerja',
];

export function isUserTargeted(
  userProfile: UserProfile | null,
  targeting: SurveyTargeting | null
): boolean {
  // Survey tanpa targeting = semua boleh mengisi
  if (!targeting) return true;

  const { gender: tGender, age_min, age_max, jobs } = targeting;

  // Filter gender: null = semua
  if (tGender !== null && tGender !== undefined) {
    const userGender = userProfile?.gender ?? null;
    if (!userGender || userGender !== tGender) return false;
  }

  // Filter usia: null = tidak ada batas
  if (age_min !== null && age_min !== undefined) {
    const userAge = userProfile?.age ?? null;
    if (userAge === null || userAge < age_min) return false;
  }
  if (age_max !== null && age_max !== undefined) {
    const userAge = userProfile?.age ?? null;
    if (userAge === null || userAge > age_max) return false;
  }

  // Filter pekerjaan: null/kosong = semua
  if (jobs && Array.isArray(jobs) && jobs.length > 0) {
    const userJob = userProfile?.job ?? null;
    if (!userJob) return false;
    // "Lainnya" di targeting cocok dengan semua job di luar daftar tetap
    const jobMatch =
      jobs.includes(userJob) ||
      (jobs.includes('Lainnya') && !FIXED_JOBS.includes(userJob));
    if (!jobMatch) return false;
  }

  return true;
}

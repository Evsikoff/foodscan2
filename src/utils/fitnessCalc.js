// Mifflin-St Jeor BMR formula
export function calcBMR({ weight, height, age, gender }) {
  const base = 10 * weight + 6.25 * height - 5 * age;
  return gender === 'male' ? base + 5 : base - 161;
}

// Activity multipliers
const ACTIVITY_MULTIPLIERS = {
  sedentary: 1.2,       // сидячий образ жизни
  light: 1.375,         // лёгкая активность 1-3 дня/нед
  moderate: 1.55,       // умеренная 3-5 дней/нед
  active: 1.725,        // высокая 6-7 дней/нед
  very_active: 1.9,     // очень высокая / физ. работа
};

export const ACTIVITY_OPTIONS = [
  { value: 'sedentary', label: 'Сидячий образ жизни' },
  { value: 'light', label: 'Лёгкая активность (1-3 дня/нед)' },
  { value: 'moderate', label: 'Умеренная (3-5 дней/нед)' },
  { value: 'active', label: 'Высокая (6-7 дней/нед)' },
  { value: 'very_active', label: 'Очень высокая / физ. работа' },
];

export const GOAL_OPTIONS = [
  { value: 'lose', label: 'Похудение' },
  { value: 'maintain', label: 'Поддержание веса' },
  { value: 'gain', label: 'Набор массы' },
];

// Total Daily Energy Expenditure
export function calcTDEE(bmr, activity) {
  return Math.round(bmr * (ACTIVITY_MULTIPLIERS[activity] || 1.2));
}

// Target calories based on goal
export function calcTargetCalories(tdee, goal) {
  if (goal === 'lose') return Math.round(tdee * 0.8);
  if (goal === 'gain') return Math.round(tdee * 1.15);
  return tdee;
}

// BMI
export function calcBMI(weight, height) {
  const h = height / 100;
  return +(weight / (h * h)).toFixed(1);
}

export function getBMICategory(bmi) {
  if (bmi < 16) return { label: 'Выраженный дефицит', color: '#E53935' };
  if (bmi < 18.5) return { label: 'Недостаточный вес', color: '#FFA94D' };
  if (bmi < 25) return { label: 'Норма', color: '#51CF66' };
  if (bmi < 30) return { label: 'Избыточный вес', color: '#FFA94D' };
  if (bmi < 35) return { label: 'Ожирение I степени', color: '#E53935' };
  if (bmi < 40) return { label: 'Ожирение II степени', color: '#E53935' };
  return { label: 'Ожирение III степени', color: '#E53935' };
}

// Ideal weight range (BMI 18.5-24.9)
export function calcIdealWeightRange(height) {
  const h = height / 100;
  return {
    min: Math.round(18.5 * h * h),
    max: Math.round(24.9 * h * h),
  };
}

// Body fat percentage estimate (US Navy method approximation using BMI)
export function calcBodyFatEstimate(bmi, age, gender) {
  if (gender === 'male') {
    return +((1.20 * bmi) + (0.23 * age) - 16.2).toFixed(1);
  }
  return +((1.20 * bmi) + (0.23 * age) - 5.4).toFixed(1);
}

// Daily water intake recommendation (ml)
export function calcWaterIntake(weight, activity) {
  const base = weight * 30;
  const mult = ACTIVITY_MULTIPLIERS[activity] || 1.2;
  return Math.round(base * (mult / 1.2));
}

// Macro split recommendations (grams)
export function calcMacroSplit(targetCalories, goal) {
  let proteinPct, fatPct, carbPct;
  if (goal === 'lose') {
    proteinPct = 0.35; fatPct = 0.30; carbPct = 0.35;
  } else if (goal === 'gain') {
    proteinPct = 0.30; fatPct = 0.25; carbPct = 0.45;
  } else {
    proteinPct = 0.30; fatPct = 0.30; carbPct = 0.40;
  }
  return {
    proteins: Math.round((targetCalories * proteinPct) / 4),
    fats: Math.round((targetCalories * fatPct) / 9),
    carbs: Math.round((targetCalories * carbPct) / 4),
  };
}

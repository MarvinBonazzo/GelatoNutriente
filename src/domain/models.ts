export type ID = string
/** YYYY-MM-DD, no timezone conversion. */
export type LocalDate = string
/** ISO 8601 UTC timestamp. */
export type Instant = string
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6

export interface Entity {
  id: ID
  createdAt: Instant
  updatedAt: Instant
}

export interface Nutrients {
  kcal: number
  protein: number
  carbs: number
  fat: number
}

export interface Patient extends Entity {
  name: string
  goals: string
  notes: string
  assignedDietId?: ID
  birthDate?: LocalDate
  heightCm?: number
  initialAssessment?: { date: LocalDate; weightKg: number; heightCm: number; waistCm?: number }
  anthropometryContext?: 'standard' | 'pregnancy' | 'altered-composition'
  sexForFormula?: 'female' | 'male'
  targetWeight?: { kg: number; method: 'manual' | 'devine' | 'robinson' | 'miller' | 'bmi'; confirmedAt: Instant }
  energyProfile?: {
    activityLevel?: 'low' | 'moderate' | 'active' | 'very-active'
    goal?: 'lose' | 'maintain' | 'gain'
    targetKcal?: number
    macroTargets?: { carbsPercent: number; proteinPercent: number; fatPercent: number }
  }
  intake?: {
    preferences: string
    exclusions: string
    allergies: string
    habits: string
    mealsAndSchedule?: string
    workAndActivity?: string
    cookingAndBudget?: string
    hydration?: string
    sleepAndStress?: string
    digestion?: string
    conditions?: string
    supplements?: string
    alcoholAndSmoking?: string
    dietHistory?: string
    preferredFoodIds: ID[]
    excludedFoodIds: ID[]
  }
  medications?: { id: ID; activeIngredient: string; product: string; notes: string; active: boolean }[]
}

export type FoodCategory = 'Cereali' | 'Proteine' | 'Latticini' | 'Legumi' | 'Verdura' | 'Frutta' | 'Grassi e frutta secca' | 'Altro'
export interface Food extends Entity {
  name: string
  category: FoodCategory
  per100g: Nutrients
  /** E.g. "crudo", "cotto e scolato", "parte edibile". */
  preparation: string
  source: string
  isCustom: boolean
}

export interface FoodPortion {
  id: ID
  foodId: ID
  grams: number
  /** Immutable nutritional snapshot at insertion time. */
  foodSnapshot: Pick<Food, 'name' | 'per100g' | 'preparation' | 'category' | 'source'>
}
export interface Portion extends FoodPortion { alternatives?: FoodPortion[] }

export interface Meal {
  id: ID
  name: string
  time?: string
  portions: Portion[]
}

export interface DayVariant {
  id: ID
  name: string
  meals: Meal[]
}

export interface DietDay {
  id: ID
  weekday: Weekday
  defaultVariantId: ID
  variants: DayVariant[]
}

export interface Diet extends Entity {
  schemaVersion: 1
  revision: number
  name: string
  patientId?: ID
  status: 'draft' | 'assigned'
  startsOn: LocalDate
  endsOn?: LocalDate
  notes: string
  days: DietDay[]
  patientVisible?: boolean
  assignedAt?: Instant
}

export interface Measurement extends Entity {
  patientId: ID
  date: LocalDate
  weightKg?: number
  heightCm?: number
  circumferencesCm: {
    waist?: number
    hips?: number
    chest?: number
    arm?: number
    thigh?: number
  }
  notes: string
  enteredBy: 'nutritionist' | 'patient'
}

export interface Appointment extends Entity {
  patientId: ID
  title: string
  startsAt: Instant
  durationMinutes: number
  timeZone: string
  location: string
  notes: string
  status: 'scheduled' | 'completed' | 'cancelled'
  reminderMinutesBefore: number
  reminderAcknowledgedAt?: Instant
}

export interface ShoppingList extends Entity {
  /** Changes on regeneration, allowing checkbox updates to reject stale lists. */
  generationId: ID
  dietId: ID
  dietRevision: number
  patientId?: ID
  from: LocalDate
  to: LocalDate
  /** One selected alternative for each calendar date. */
  variantByDate: Record<LocalDate, ID>
  checkedFoodIds: ID[]
  portionChoices?: Record<LocalDate, Record<ID, ID>>
}

export interface Backup {
  format: 'gelatonutriente'
  schemaVersion: 1
  exportedAt: Instant
  patients: Patient[]
  diets: Diet[]
  foods: Food[]
  measurements: Measurement[]
  appointments: Appointment[]
  shoppingLists: ShoppingList[]
  studio?: StudioProfile
}

export interface StudioProfile {
  id: 'studio'
  name: string
  professional: string
  address: string
  contact: string
  footer: string
  logoDataUrl?: string
}

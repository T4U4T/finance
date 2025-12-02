import { AppState, FamilyMember, TransactionType, CategoryItem } from '../types';

const STORAGE_KEY = 't4u4t_finance_data_v3'; // Bumped version

const DEFAULT_MEMBERS: FamilyMember[] = [
  { id: '1', name: 'Você', role: 'Admin', salary: 0 },
];

const DEFAULT_CATEGORIES: CategoryItem[] = [
  { id: 'cat_1', name: 'Moradia', color: '#3b82f6' }, // Blue
  { id: 'cat_2', name: 'Alimentação', color: '#10b981' }, // Emerald
  { id: 'cat_3', name: 'Transporte', color: '#f59e0b' }, // Amber
  { id: 'cat_4', name: 'Lazer', color: '#8b5cf6' }, // Violet
  { id: 'cat_5', name: 'Saúde', color: '#ef4444' }, // Red
  { id: 'cat_6', name: 'Educação', color: '#06b6d4' }, // Cyan
  { id: 'cat_7', name: 'Salário', color: '#22c55e' }, // Green
  { id: 'cat_8', name: 'Investimento', color: '#ec4899' }, // Pink
  { id: 'cat_9', name: 'Outros', color: '#64748b' }, // Slate
];

const DEFAULT_STATE: AppState = {
  transactions: [],
  cards: [],
  members: DEFAULT_MEMBERS,
  fixedItems: [],
  categories: DEFAULT_CATEGORIES,
  goals: [],
  appSettings: {
    appName: 'T4U4T',
    appInitials: 'T4',
    profileName: 'Família',
    profileSubtitle: 't4u4t.xyz'
  }
};

export const loadState = (): AppState => {
  try {
    const serializedState = localStorage.getItem(STORAGE_KEY);
    if (serializedState === null) {
      return DEFAULT_STATE;
    }
    const data = JSON.parse(serializedState);
    
    // Migration: If loading old data without categories/goals/salary
    if (!data.categories) data.categories = DEFAULT_CATEGORIES;
    if (!data.goals) data.goals = [];
    
    // Migration for Members salary
    if (data.members) {
      data.members = data.members.map((m: any) => ({
        ...m,
        salary: m.salary !== undefined ? m.salary : 0
      }));
    }

    // Migration for Card Limit History
    if (data.cards) {
      data.cards = data.cards.map((c: any) => ({
        ...c,
        limitHistory: c.limitHistory || [{ date: new Date().toISOString().split('T')[0], amount: c.limit }]
      }));
    }

    // Migration for Goals Owner
    if (data.goals) {
      data.goals = data.goals.map((g: any) => ({
        ...g,
        ownerId: g.ownerId || 'family'
      }));
    }

    // Migration for App Settings
    if (!data.appSettings) {
      data.appSettings = DEFAULT_STATE.appSettings;
    }

    return { ...DEFAULT_STATE, ...data };
  } catch (err) {
    console.error("Failed to load state", err);
    return DEFAULT_STATE;
  }
};

export const saveState = (state: AppState): void => {
  try {
    const serializedState = JSON.stringify(state);
    localStorage.setItem(STORAGE_KEY, serializedState);
  } catch (err) {
    console.error("Failed to save state", err);
  }
};

export const generateId = (): string => {
  return Math.random().toString(36).substring(2, 9);
};
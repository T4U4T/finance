export enum TransactionType {
  INCOME = 'INCOME',
  EXPENSE = 'EXPENSE',
}

// Category is now dynamic, removed Enum
export interface CategoryItem {
  id: string;
  name: string;
  color: string;
}

export enum PaymentMethod {
  CREDIT_CARD = 'Cartão de Crédito',
  DEBIT = 'Débito',
  CASH = 'Dinheiro/PIX',
}

export interface LimitHistoryItem {
  date: string;
  amount: number;
}

export interface CreditCard {
  id: string;
  name: string;
  limit: number;
  limitHistory: LimitHistoryItem[]; // Added history tracking
  closingDay: number;
  dueDay: number;
  color: string;
  memberId?: string; // Owner of the card
}

export interface FamilyMember {
  id: string;
  name: string;
  role: string;
  salary: number; // Added salary field
}

export interface TransactionSplit {
  memberId: string;
  amount: number;
}

export interface Transaction {
  id: string;
  description: string;
  amount: number;
  date: string; // ISO String
  type: TransactionType;
  category: string; // ID of the category or name
  paymentMethod: PaymentMethod;
  cardId?: string;
  memberId: string; // Used for "payer" or primary owner if not split
  split?: TransactionSplit[]; // If present, overrides memberId for cost calculation
  isFixed: boolean;
  installment?: {
    current: number;
    total: number;
  };
}

export interface FixedItem {
  id: string;
  description: string;
  amount: number;
  dayOfMonth: number;
  type: TransactionType;
  category: string;
  memberId: string;
  split?: TransactionSplit[];
}

export interface FinancialGoal {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  deadline: string;
  color: string;
  ownerId: string; // 'family' or memberId
}

export interface AppSettings {
  appName: string;
  appInitials: string;
  profileName: string;
  profileSubtitle: string;
}

export interface AppState {
  transactions: Transaction[];
  cards: CreditCard[];
  members: FamilyMember[];
  fixedItems: FixedItem[];
  categories: CategoryItem[];
  goals: FinancialGoal[];
  appSettings: AppSettings;
}
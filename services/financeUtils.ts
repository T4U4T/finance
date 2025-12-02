import { Transaction, CreditCard, PaymentMethod } from '../types';

// Calculate the actual cash flow date for a credit card transaction
export const getPaymentDate = (t: Transaction, cards: CreditCard[]): Date => {
  const date = new Date(t.date);
  if(t.paymentMethod !== PaymentMethod.CREDIT_CARD || !t.cardId) return date;

  const card = cards.find(c => c.id === t.cardId);
  if(!card) return date;

  // Since t.date is stored as an ISO UTC string (e.g. 2023-10-27T00:00:00.000Z),
  // we must use UTC methods to avoid timezone shifts in Western hemispheres.

  // Base Payment Date matches the Month/Year of transaction initially
  // We use UTC components for logic, but construct Local Date for return value to preserve "Day" semantic.
  let targetYear = date.getUTCFullYear();
  let targetMonth = date.getUTCMonth();

  // If the purchase was AFTER closing day, the invoice is for the NEXT month.
  // Compare UTC Date Day vs Closing Day
  if (date.getUTCDate() > card.closingDay) {
     targetMonth += 1;
  }

  if (card.dueDay < card.closingDay) {
    targetMonth += 1;
  }

  return new Date(targetYear, targetMonth, card.dueDay);
};

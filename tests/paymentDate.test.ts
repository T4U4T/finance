
import { Transaction, TransactionType, PaymentMethod, CreditCard } from '../types';
import { getPaymentDate } from '../services/financeUtils';

// TESTS
function runTest() {
  console.log("Running getPaymentDate tests...");

  // Scenario 1: Western Timezone (UTC-5)
  // Transaction: Oct 27 (UTC). Closing: 26.
  // Logic: 27 > 26. Next Month (Nov).
  // Due Day: 5. Closing: 26. (5 < 26) -> Add another month (Dec).
  // Result should be Dec 5th.

  const card: CreditCard = {
    id: 'card1',
    name: 'Test Card',
    limit: 1000,
    limitHistory: [],
    closingDay: 26,
    dueDay: 5,
    color: 'red',
    memberId: '1'
  };

  const transaction: Transaction = {
    id: 't1',
    description: 'Test',
    amount: 100,
    date: '2023-10-27T00:00:00.000Z', // Oct 27
    type: TransactionType.EXPENSE,
    category: 'Food',
    paymentMethod: PaymentMethod.CREDIT_CARD,
    cardId: 'card1',
    memberId: '1',
    isFixed: false
  };

  const result = getPaymentDate(transaction, [card]);

  // Check 1: Month Calculation
  // We expect Dec 5th.
  // result is Local Date. result.getMonth() should be 11 (Dec).
  if (result.getMonth() !== 11) {
    console.error(`[FAIL] Month Calculation: Expected 11 (Dec), got ${result.getMonth()}`);
    process.exit(1);
  } else {
    console.log("[PASS] Month Calculation Correct (Dec).");
  }

  // Check 2: Day Semantic Preservation
  // We expect "The 5th".
  // result.getDate() should be 5.
  if (result.getDate() !== 5) {
     console.error(`[FAIL] Day Preservation: Expected 5, got ${result.getDate()}`);
     process.exit(1);
  } else {
     console.log("[PASS] Day Preservation Correct (5th).");
  }

  console.log("All tests passed!");
}

runTest();

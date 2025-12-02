import { GoogleGenAI } from "@google/genai";
import { AppState, TransactionType } from "../types";

const getApiKey = (): string | undefined => {
  return process.env.API_KEY;
};

export const getFinancialInsights = async (state: AppState): Promise<string> => {
  const apiKey = getApiKey();
  if (!apiKey) {
    return "API Key não configurada. Configure process.env.API_KEY para receber insights.";
  }

  const ai = new GoogleGenAI({ apiKey });

  // Summarize data to reduce token count
  const today = new Date();
  const currentMonth = today.getMonth();
  const currentYear = today.getFullYear();

  const currentMonthTransactions = state.transactions.filter(t => {
    const d = new Date(t.date);
    return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
  });

  const totalIncome = currentMonthTransactions
    .filter(t => t.type === TransactionType.INCOME)
    .reduce((acc, t) => acc + t.amount, 0);

  const totalExpense = currentMonthTransactions
    .filter(t => t.type === TransactionType.EXPENSE)
    .reduce((acc, t) => acc + t.amount, 0);

  const topCategories = Object.entries(
    currentMonthTransactions
      .filter(t => t.type === TransactionType.EXPENSE)
      .reduce((acc, t) => {
        acc[t.category] = (acc[t.category] || 0) + t.amount;
        return acc;
      }, {} as Record<string, number>)
  ).sort((a, b) => b[1] - a[1]).slice(0, 3);

  const summary = {
    period: `${currentMonth + 1}/${currentYear}`,
    financialStatus: {
      totalIncome,
      totalExpense,
      netBalance: totalIncome - totalExpense,
    },
    topExpenses: topCategories,
    goalsStatus: state.goals.map(g => ({
      name: g.name,
      progress: `${(g.currentAmount / g.targetAmount * 100).toFixed(1)}%`,
      deadline: g.deadline
    })),
    fixedExpensesCount: state.fixedItems.length,
  };

  const prompt = `
    Atue como um consultor financeiro "T4U4T" para uma família.
    Analise este resumo financeiro (JSON):
    ${JSON.stringify(summary)}

    Tarefas:
    1. Analise o saldo do mês e as maiores categorias de gasto.
    2. Comente sobre o progresso das metas financeiras (se houver). Se estiverem atrasadas, dê uma sugestão específica.
    3. Dê uma previsão curta se eles continuarão no azul considerando os gastos fixos.
    
    Estilo: Profissional, motivador e conciso. Use Markdown (negrito em valores importantes).
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });
    return response.text || "Sem insights no momento.";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "Erro de conexão com a IA. Tente novamente.";
  }
};
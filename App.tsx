import React, { useState, useEffect, useMemo } from 'react';
import { 
  LayoutDashboard, 
  CreditCard, 
  Wallet, 
  Calendar, 
  Settings, 
  Plus, 
  TrendingUp, 
  TrendingDown, 
  Target,
  Sparkles,
  PieChart as PieChartIcon,
  Trash2,
  Save,
  Tag,
  Moon,
  Sun,
  Edit2,
  User,
  X,
  Layers,
  ArrowRight,
  History,
  Download,
  Printer,
  FileText,
  Users,
  Home,
  Split,
  Coins,
  Repeat
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell,
  Legend,
  LineChart,
  Line,
  CartesianGrid,
  ComposedChart,
  Area
} from 'recharts';
import ReactMarkdown from 'react-markdown';

import { AppState, Transaction, CreditCard as CardType, FamilyMember, FixedItem, TransactionType, PaymentMethod, CategoryItem, FinancialGoal, TransactionSplit } from './types';
import { loadState, saveState, generateId } from './services/storage';
import { getFinancialInsights } from './services/geminiService';
import { getPaymentDate } from './services/financeUtils';
import TransactionModal from './components/TransactionModal';

// --- Constants & Styles ---
const INPUT_STYLE = "w-full border rounded-lg p-2 outline-none transition-colors bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 border-slate-300 dark:border-slate-700 focus:ring-2 focus:ring-blue-500 placeholder-slate-400";
const BUTTON_PRIMARY = "bg-slate-900 dark:bg-blue-600 text-white hover:bg-slate-800 dark:hover:bg-blue-500 transition-colors";

// --- Helper Components ---
const StatCard = ({ title, value, icon, colorClass, subValue }: { title: string, value: string, icon: any, colorClass: string, subValue?: string }) => (
  <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-sm border border-slate-100 dark:border-slate-700 hover:shadow-md transition-all duration-300">
    <div className="flex justify-between items-start">
      <div>
        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{title}</p>
        <h3 className="text-2xl font-bold text-slate-900 dark:text-white mt-2">{value}</h3>
        {subValue && <p className="text-xs text-slate-400 mt-1">{subValue}</p>}
      </div>
      <div className={`p-3 rounded-lg ${colorClass} bg-opacity-10`}>
        {React.cloneElement(icon, { className: `w-6 h-6 ${colorClass.replace('bg-', 'text-')}` })}
      </div>
    </div>
  </div>
);

const ProgressBar = ({ current, max, color }: { current: number, max: number, color: string }) => {
  const percentage = Math.min(100, Math.max(0, (current / max) * 100));
  return (
    <div className="w-full bg-slate-100 dark:bg-slate-700 rounded-full h-2.5 overflow-hidden">
      <div 
        className="h-2.5 rounded-full transition-all duration-1000 ease-out" 
        style={{ width: `${percentage}%`, backgroundColor: color }}
      />
    </div>
  );
};

// --- Main App ---

export default function App() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'transactions' | 'reports' | 'goals' | 'settings' | 'cards'>('dashboard');
  const [state, setState] = useState<AppState>(loadState());
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [aiInsight, setAiInsight] = useState<string>('');
  const [loadingAi, setLoadingAi] = useState(false);
  
  // Edit States
  const [editingMember, setEditingMember] = useState<FamilyMember | null>(null);
  const [editingCardLimit, setEditingCardLimit] = useState<{cardId: string, currentLimit: number} | null>(null);
  const [editingSettings, setEditingSettings] = useState<'app' | 'profile' | null>(null);
  const [editingCategory, setEditingCategory] = useState<CategoryItem | null>(null);

  // State for Fixed Item Splits (in Settings)
  const [fixedItemSplitMode, setFixedItemSplitMode] = useState<'individual' | 'shared'>('individual');
  const [fixedItemIndividualId, setFixedItemIndividualId] = useState<string>('');
  const [fixedItemSplits, setFixedItemSplits] = useState<TransactionSplit[]>([]);

  // Report filters state
  const [reportFilters, setReportFilters] = useState({
    startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    endDate: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().split('T')[0],
    memberId: 'all'
  });
  
  // Theme State
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('theme') as 'light' | 'dark' || 'dark';
    }
    return 'dark';
  });

  // Apply Theme to DOM
  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  // Persist state changes
  useEffect(() => {
    saveState(state);
  }, [state]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  const handleAddTransaction = (newTransactions: Transaction[]) => {
    setState(prev => ({ ...prev, transactions: [...newTransactions, ...prev.transactions] }));
  };

  const deleteTransaction = (id: string) => {
    if(window.confirm('Excluir transação?')) {
      setState(prev => ({ ...prev, transactions: prev.transactions.filter(t => t.id !== id) }));
    }
  };

  const generateInsights = async () => {
    setLoadingAi(true);
    const insight = await getFinancialInsights(state);
    setAiInsight(insight);
    setLoadingAi(false);
  };

  const handleUpdateCardLimit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingCardLimit) return;
    const fd = new FormData(e.currentTarget);
    const newLimit = parseFloat(fd.get('newLimit') as string);
    const changeDate = fd.get('changeDate') as string;

    setState(prev => ({
      ...prev,
      cards: prev.cards.map(c => {
        if(c.id === editingCardLimit.cardId) {
          const history = c.limitHistory ? [...c.limitHistory] : [{ date: new Date().toISOString().split('T')[0], amount: c.limit }];
          history.push({ date: changeDate, amount: newLimit });
          return { ...c, limit: newLimit, limitHistory: history };
        }
        return c;
      })
    }));
    setEditingCardLimit(null);
  };

  const handleUpdateAppSettings = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    
    if (editingSettings === 'app') {
      setState(prev => ({
        ...prev,
        appSettings: {
          ...prev.appSettings,
          appName: fd.get('appName') as string,
          appInitials: fd.get('appInitials') as string,
        }
      }));
    } else if (editingSettings === 'profile') {
      setState(prev => ({
        ...prev,
        appSettings: {
          ...prev.appSettings,
          profileName: fd.get('profileName') as string,
          profileSubtitle: fd.get('profileSubtitle') as string,
        }
      }));
    }
    setEditingSettings(null);
  };

  // --- Category Management Functions ---
  const addCategory = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const newCat: CategoryItem = {
      id: generateId(),
      name: formData.get('name') as string,
      color: `hsl(${Math.random() * 360}, 70%, 50%)`
    };
    setState(prev => ({ ...prev, categories: [...prev.categories, newCat] }));
    e.currentTarget.reset();
  };

  const deleteCategory = (id: string) => {
    if (window.confirm('Tem certeza? Gastos com esta categoria ficarão sem categoria.')) {
      // Use functional update to ensure we have latest state
      setState(prevState => {
        const newCategories = prevState.categories.filter(c => c.id !== id);
        return { ...prevState, categories: newCategories };
      });
    }
  };

  const handleUpdateCategory = (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if(!editingCategory) return;
      const fd = new FormData(e.currentTarget);
      const updated: CategoryItem = {
        ...editingCategory,
        name: fd.get('name') as string,
        color: fd.get('color') as string
      };
      setState(prev => ({
        ...prev,
        categories: prev.categories.map(c => c.id === updated.id ? updated : c)
      }));
      setEditingCategory(null);
  };

  // --- Export Functions ---
  
  const getFilteredReportData = (): Transaction[] => {
    const start = new Date(reportFilters.startDate);
    const end = new Date(reportFilters.endDate);
    
    return state.transactions.filter(t => {
      const d = new Date(t.date);
      const isDateInRange = d >= start && d <= end;
      // Member logic: If specific member, check if they are the main member OR if they are part of the split
      const isMemberMatch = reportFilters.memberId === 'all' || 
          t.memberId === reportFilters.memberId || 
          (t.split && t.split.some(s => s.memberId === reportFilters.memberId));
      return isDateInRange && isMemberMatch;
    });
  };

  const exportMarkdownReport = () => {
    const data = getFilteredReportData();
    const income = data.filter(t => t.type === TransactionType.INCOME).reduce<number>((acc, t) => acc + t.amount, 0);
    const expense = data.filter(t => t.type === TransactionType.EXPENSE).reduce<number>((acc, t) => acc + t.amount, 0);
    const memberName = reportFilters.memberId === 'all' 
      ? state.appSettings.profileName 
      : state.members.find(m => m.id === reportFilters.memberId)?.name || 'Membro';

    let md = `# Relatório Financeiro: ${memberName}\n`;
    md += `**Período:** ${new Date(reportFilters.startDate).toLocaleDateString()} a ${new Date(reportFilters.endDate).toLocaleDateString()}\n\n`;
    md += `## Resumo\n`;
    md += `- **Receitas Totais:** R$ ${income.toFixed(2)}\n`;
    md += `- **Despesas Totais:** R$ ${expense.toFixed(2)}\n`;
    md += `- **Saldo do Período:** R$ ${(income - expense).toFixed(2)}\n\n`;
    
    md += `## Gastos por Categoria\n`;
    const cats = data.filter(t => t.type === TransactionType.EXPENSE).reduce((acc: Record<string, number>, t) => {
      acc[t.category] = (acc[t.category] || 0) + t.amount;
      return acc;
    }, {} as Record<string, number>);
    
    Object.entries(cats).sort((a,b) => b[1] - a[1]).forEach(([cat, val]) => {
      md += `- **${cat}:** R$ ${val.toFixed(2)}\n`;
    });

    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Relatorio_${memberName}_${reportFilters.startDate}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const printReport = () => {
    const data = getFilteredReportData();
    const income = data.filter(t => t.type === TransactionType.INCOME).reduce<number>((acc, t) => acc + t.amount, 0);
    const expense = data.filter(t => t.type === TransactionType.EXPENSE).reduce<number>((acc, t) => acc + t.amount, 0);
    const memberName = reportFilters.memberId === 'all' 
      ? state.appSettings.profileName 
      : state.members.find(m => m.id === reportFilters.memberId)?.name || 'Membro';
    
    const cats = data.filter(t => t.type === TransactionType.EXPENSE).reduce<Record<string, number>>((acc, t) => {
      acc[t.category] = (acc[t.category] || 0) + t.amount;
      return acc;
    }, {});

    const printWindow = window.open('', '', 'height=600,width=800');
    if(printWindow) {
      printWindow.document.write('<html><head><title>Relatório Financeiro</title>');
      printWindow.document.write('<style>');
      printWindow.document.write(`
        body { font-family: 'Helvetica', sans-serif; color: #333; padding: 40px; }
        h1 { color: #0f172a; border-bottom: 2px solid #0f172a; padding-bottom: 10px; }
        .header { display: flex; justify-content: space-between; margin-bottom: 40px; }
        .summary-card { background: #f8fafc; padding: 20px; border-radius: 8px; border: 1px solid #e2e8f0; margin-bottom: 30px; }
        .grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 20px; }
        .stat label { font-size: 12px; color: #64748b; display: block; }
        .stat val { font-size: 24px; font-weight: bold; display: block; }
        .green { color: #10b981; } .red { color: #ef4444; }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
        th { text-align: left; border-bottom: 1px solid #cbd5e1; padding: 8px; color: #64748b; font-size: 12px; uppercase; }
        td { border-bottom: 1px solid #f1f5f9; padding: 8px; font-size: 14px; }
        @media print { body { padding: 0; } }
      `);
      printWindow.document.write('</style></head><body>');
      
      printWindow.document.write(`
        <div class="header">
          <div>
            <h1>${state.appSettings.appName}</h1>
            <p>Relatório Financeiro</p>
          </div>
          <div style="text-align: right;">
            <p><strong>${memberName}</strong></p>
            <p>${new Date(reportFilters.startDate).toLocaleDateString()} até ${new Date(reportFilters.endDate).toLocaleDateString()}</p>
          </div>
        </div>

        <div class="summary-card">
          <div class="grid">
            <div class="stat"><label>Receitas</label><val class="green">R$ ${income.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</val></div>
            <div class="stat"><label>Despesas</label><val class="red">R$ ${expense.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</val></div>
            <div class="stat"><label>Saldo</label><val>R$ ${(income-expense).toLocaleString('pt-BR', {minimumFractionDigits: 2})}</val></div>
          </div>
        </div>

        <h3>Detalhamento por Categoria</h3>
        <table>
          <thead><tr><th>Categoria</th><th>Valor</th><th>%</th></tr></thead>
          <tbody>
            ${Object.entries(cats).sort((a,b) => b[1] - a[1]).map(([c, v]) => `
              <tr>
                <td>${c}</td>
                <td>R$ ${v.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</td>
                <td>${expense > 0 ? ((v/expense)*100).toFixed(1) : '0.0'}%</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        
        <div style="margin-top: 50px; text-align: center; font-size: 12px; color: #94a3b8;">
          Gerado em ${new Date().toLocaleString()}
        </div>
      `);

      printWindow.document.write('</body></html>');
      printWindow.document.close();
      printWindow.print();
    }
  };

  // --- Calculations ---
  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();
  
  // GENERATE VIRTUAL TRANSACTIONS FROM FIXED ITEMS FOR CURRENT MONTH
  // This allows the main list and dashboard to reflect fixed expenses naturally
  const virtualFixedTransactions = useMemo(() => {
    return state.fixedItems.map(item => {
      // Determine date in current month
      let date = new Date(currentYear, currentMonth, item.dayOfMonth);
      // Correction if day doesn't exist (e.g., 31st in Feb)
      if (date.getMonth() !== currentMonth) {
        date = new Date(currentYear, currentMonth + 1, 0); // Last day of current month
      }

      return {
        id: `fixed_${item.id}_${currentMonth}_${currentYear}`, // Unique virtual ID
        description: item.description,
        amount: item.amount,
        date: date.toISOString(),
        type: item.type,
        category: item.category,
        paymentMethod: PaymentMethod.DEBIT, // Assumed for fixed items unless tracked otherwise
        memberId: item.memberId,
        split: item.split,
        isFixed: true, // Marker to show badge
      } as Transaction;
    });
  }, [state.fixedItems, currentMonth, currentYear]);

  // Merge Real + Virtual for Dashboard/List calculations
  // We sort them so they appear in order
  const combinedTransactions = useMemo(() => {
    const all = [...state.transactions, ...virtualFixedTransactions];
    return all.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [state.transactions, virtualFixedTransactions]);

  const monthlyTransactions = useMemo(() => combinedTransactions.filter(t => {
    const d = new Date(t.date);
    return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
  }), [combinedTransactions, currentMonth, currentYear]);

  const totalIncome = monthlyTransactions
    .filter(t => t.type === TransactionType.INCOME)
    .reduce<number>((acc, t) => acc + t.amount, 0);

  const totalExpense = monthlyTransactions
    .filter(t => t.type === TransactionType.EXPENSE)
    .reduce<number>((acc, t) => acc + t.amount, 0);

  const balance = totalIncome - totalExpense;

  // MEMBER CALCULATIONS (Smart Split)
  const memberBalances = useMemo(() => {
    return state.members.map(member => {
      const salary = member.salary || 0;
      
      const myExpenses = monthlyTransactions
        .filter(t => t.type === TransactionType.EXPENSE)
        .reduce((acc, t) => {
          if (t.split && t.split.length > 0) {
            const myPart = t.split.find(s => s.memberId === member.id)?.amount || 0;
            return acc + myPart;
          } else if (t.memberId === member.id) {
            return acc + t.amount;
          }
          return acc;
        }, 0);
        
        return {
          ...member,
          myExpenses,
          remaining: salary - myExpenses
        };
    });
  }, [state.members, monthlyTransactions]);

  // Chart Colors based on Theme
  const chartTextColor = theme === 'dark' ? '#94a3b8' : '#64748b';
  const chartGridColor = theme === 'dark' ? '#334155' : '#e2e8f0';
  const chartTooltipBg = theme === 'dark' ? '#1e293b' : '#ffffff';
  const chartTooltipBorder = theme === 'dark' ? '#334155' : '#e2e8f0';

  // --- Render Functions ---

  const renderDashboard = () => (
    <div className="space-y-6 animate-fade-in">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard 
          title="Saldo (Mês)" 
          value={`R$ ${balance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} 
          icon={<Wallet />}
          colorClass={balance >= 0 ? "text-emerald-500 bg-emerald-500" : "text-red-500 bg-red-500"}
        />
        <StatCard 
          title="Receitas" 
          value={`R$ ${totalIncome.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} 
          icon={<TrendingUp />}
          colorClass="text-green-500 bg-green-500"
        />
        <StatCard 
          title="Despesas" 
          value={`R$ ${totalExpense.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} 
          icon={<TrendingDown />}
          colorClass="text-red-500 bg-red-500"
        />
        <StatCard 
          title="Metas Ativas" 
          value={`${state.goals.filter(g => g.currentAmount < g.targetAmount).length}`}
          icon={<Target />}
          colorClass="text-purple-500 bg-purple-500"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* NEW: Member Savings Breakdown */}
        <div className="lg:col-span-1 bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 flex flex-col">
            <h3 className="font-bold text-slate-800 dark:text-white mb-4 flex items-center gap-2">
              <Coins size={18} className="text-yellow-500"/> Economia por Membro
            </h3>
            <div className="space-y-4 flex-1 overflow-y-auto">
               {memberBalances.map(m => (
                 <div key={m.id} className="p-3 rounded-lg bg-slate-50 dark:bg-slate-700/30 border border-slate-100 dark:border-slate-700">
                    <div className="flex justify-between items-center mb-1">
                       <span className="font-semibold text-slate-700 dark:text-slate-200">{m.name}</span>
                       <span className="text-xs text-slate-400">Salário: R$ {m.salary.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-end">
                       <div className="text-xs text-red-500">
                          Gastos: R$ {m.myExpenses.toLocaleString(undefined, {minimumFractionDigits: 2})}
                       </div>
                       <div className={`font-bold ${m.remaining >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                          R$ {m.remaining.toLocaleString(undefined, {minimumFractionDigits: 2})}
                       </div>
                    </div>
                    <div className="w-full bg-slate-200 dark:bg-slate-600 rounded-full h-1.5 mt-2">
                       <div 
                         className="h-1.5 rounded-full bg-green-500 transition-all" 
                         style={{ width: `${Math.max(0, Math.min(100, (m.remaining / (m.salary || 1)) * 100))}%` }}
                       ></div>
                    </div>
                 </div>
               ))}
            </div>
        </div>

        {/* Recent Transactions Snippet */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700">
           <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-slate-800 dark:text-white">Últimas Transações</h3>
              <button onClick={() => setActiveTab('transactions')} className="text-blue-600 dark:text-blue-400 text-sm hover:underline">Ver todas</button>
           </div>
           <div className="space-y-3">
             {combinedTransactions.slice(0, 5).map(t => (
               <div key={t.id} className="flex justify-between items-center text-sm p-3 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg transition-colors">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-full ${t.type === TransactionType.INCOME ? 'bg-green-100 dark:bg-green-900 text-green-600 dark:text-green-400' : 'bg-red-100 dark:bg-red-900 text-red-600 dark:text-red-400'}`}>
                       {t.type === TransactionType.INCOME ? <TrendingUp size={16}/> : <TrendingDown size={16}/>}
                    </div>
                    <div>
                      <p className="font-medium text-slate-700 dark:text-slate-200 flex items-center gap-2">
                        {t.description} 
                        {t.isFixed && <span className="text-[9px] bg-slate-200 dark:bg-slate-600 text-slate-600 dark:text-slate-200 px-1 rounded uppercase tracking-wider">Fixo</span>}
                        {t.installment && <span className="ml-1 text-xs opacity-70">({t.installment.current}/${t.installment.total})</span>}
                        {t.split && <span className="ml-1 text-[10px] bg-blue-100 text-blue-800 px-1 rounded border border-blue-200">Compartilhado</span>}
                      </p>
                      <p className="text-xs text-slate-400">{t.category} • {new Date(t.date).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <span className={`font-semibold ${t.type === TransactionType.INCOME ? 'text-green-600 dark:text-green-400' : 'text-slate-700 dark:text-slate-300'}`}>
                    {t.type === TransactionType.EXPENSE && '- '}R$ {t.amount.toLocaleString('pt-BR', {minimumFractionDigits: 2})}
                  </span>
               </div>
             ))}
             {combinedTransactions.length === 0 && <p className="text-center text-slate-400 py-4">Sem dados recentes.</p>}
           </div>
        </div>

        {/* AI Insight */}
        <div className="lg:col-span-3 bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 p-6 rounded-xl shadow-sm border border-indigo-100 dark:border-indigo-800 flex flex-col">
          <div className="flex justify-between items-center mb-4">
             <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                <h3 className="text-lg font-bold text-indigo-900 dark:text-indigo-100">IA Advisor</h3>
             </div>
             <button 
                onClick={generateInsights}
                disabled={loadingAi}
                className="text-xs font-semibold bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 px-3 py-1 rounded-full border border-indigo-200 dark:border-indigo-700 hover:bg-indigo-50 dark:hover:bg-indigo-900 transition-colors disabled:opacity-50"
             >
               {loadingAi ? '...' : 'Atualizar'}
             </button>
          </div>
          <div className="flex-1 text-sm text-slate-700 dark:text-slate-300 overflow-y-auto max-h-64 scrollbar-thin">
            {aiInsight ? (
              <div className="prose prose-sm prose-indigo dark:prose-invert">
                <ReactMarkdown>
                  {aiInsight}
                </ReactMarkdown>
              </div>
            ) : (
              <p className="text-center text-slate-400 mt-8">Toque em Atualizar para receber dicas sobre suas finanças.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  const renderReports = () => {
    // 1. Pie Chart Data
    const categoryData = Object.entries(monthlyTransactions
      .filter(t => t.type === TransactionType.EXPENSE)
      .reduce((acc, t) => {
        acc[t.category] = (acc[t.category] || 0) + t.amount;
        return acc;
      }, {} as Record<string, number>))
      .map(([name, value]) => {
         const cat = state.categories.find(c => c.name === name);
         return { name, value, color: cat?.color || '#cbd5e1' };
      });

    // 2. Bar Chart Data
    const barData = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const monthLabel = d.toLocaleDateString('pt-BR', { month: 'short' });
      // Calculate totals for months (here we use raw transactions, not mixed with virtuals unless persisted, but for now we stick to persisted)
      // NOTE: For reports to be accurate with fixed expenses, we should arguably inject them here too.
      // But let's keep it simple: Reports show historical data (Transactions).
      const txs = state.transactions.filter(t => {
         const td = new Date(t.date);
         return td.getMonth() === d.getMonth() && td.getFullYear() === d.getFullYear();
      });
      barData.push({
        name: monthLabel,
        receita: txs.filter(t => t.type === TransactionType.INCOME).reduce((s, t) => s + t.amount, 0),
        despesa: txs.filter(t => t.type === TransactionType.EXPENSE).reduce((s, t) => s + t.amount, 0),
      });
    }

    // 3. Advanced Projection Logic with Splitting
    const totalSalary = state.members.reduce((acc, m) => acc + (m.salary || 0), 0);
    const fixedExpenseSum = state.fixedItems.filter(f => f.type === TransactionType.EXPENSE).reduce((s, f) => s + f.amount, 0);
    const fixedIncomeSum = state.fixedItems.filter(f => f.type === TransactionType.INCOME).reduce((s, f) => s + f.amount, 0);

    const historicVariableExpenses = state.transactions.filter(t => 
       t.type === TransactionType.EXPENSE && 
       !t.isFixed && 
       new Date(t.date) <= new Date()
    );
    let avgVariableExpense = 0;
    if (historicVariableExpenses.length > 0) {
       const totalHistoric = historicVariableExpenses.reduce((acc, t) => acc + t.amount, 0);
       const distinctMonths = new Set(historicVariableExpenses.map(t => t.date.substring(0, 7))).size;
       avgVariableExpense = totalHistoric / (distinctMonths || 1);
    }

    const monthlyGoalNeeds = state.goals.reduce((acc, goal) => {
       if (goal.currentAmount >= goal.targetAmount) return acc;
       const deadline = new Date(goal.deadline);
       const now = new Date();
       const monthsLeft = (deadline.getFullYear() - now.getFullYear()) * 12 + (deadline.getMonth() - now.getMonth());
       if (monthsLeft <= 0) return acc;
       const remaining = goal.targetAmount - goal.currentAmount;
       return acc + (remaining / monthsLeft);
    }, 0);

    const projectionData = []; 
    
    // Project next 6 months
    for(let i=0; i<=6; i++) {
       const d = new Date();
       d.setMonth(d.getMonth() + i);
       const label = d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });

       const monthlyCashFlowTransactions = state.transactions.filter(t => {
          const payDate = getPaymentDate(t, state.cards);
          return payDate.getMonth() === d.getMonth() && d.getFullYear() === d.getFullYear();
       });

       const knownExpense = monthlyCashFlowTransactions
          .filter(t => t.type === TransactionType.EXPENSE)
          .reduce((s, t) => s + t.amount, 0);

       const knownIncome = monthlyCashFlowTransactions
          .filter(t => t.type === TransactionType.INCOME)
          .reduce((s, t) => s + t.amount, 0);

       const projectedTotalIncome = totalSalary + fixedIncomeSum + (i === 0 ? Math.max(0, knownIncome) : knownIncome);
       const projectedTotalExpense = fixedExpenseSum + knownExpense + avgVariableExpense;
       const projectedBalance = projectedTotalIncome - projectedTotalExpense;
       const freeBalance = projectedBalance - monthlyGoalNeeds;
       
       projectionData.push({
          name: label,
          Entradas: projectedTotalIncome,
          Saídas: projectedTotalExpense,
          Saldo: projectedBalance,
          'Saldo Livre': freeBalance
       });
    }

    return (
      <div className="space-y-6 animate-fade-in">
         {/* Export Section ... */}
         {/* ... (Kept existing) ... */}
         
         <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700">
               <h3 className="font-bold text-slate-800 dark:text-white mb-6 flex items-center gap-2"><PieChartIcon size={20}/> Gastos por Categoria (Mês Atual)</h3>
               <div className="h-72 w-full min-w-0">
                 <ResponsiveContainer width="100%" height="100%">
                   <PieChart>
                     <Pie
                       data={categoryData}
                       cx="50%"
                       cy="50%"
                       innerRadius={60}
                       outerRadius={80}
                       paddingAngle={5}
                       dataKey="value"
                     >
                       {categoryData.map((entry, index) => (
                         <Cell key={`cell-${index}`} fill={entry.color} stroke={theme === 'dark' ? '#1e293b' : '#fff'} />
                       ))}
                     </Pie>
                     <Tooltip 
                        contentStyle={{backgroundColor: chartTooltipBg, borderColor: chartTooltipBorder, color: chartTextColor, borderRadius: '8px'}}
                        formatter={(value: number) => `R$ ${value.toFixed(2)}`} 
                      />
                     <Legend wrapperStyle={{ color: chartTextColor }} />
                   </PieChart>
                 </ResponsiveContainer>
               </div>
            </div>

            <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700">
               <h3 className="font-bold text-slate-800 dark:text-white mb-6 flex items-center gap-2"><LayoutDashboard size={20}/> Fluxo de Caixa (Realizado)</h3>
               <div className="h-72 w-full min-w-0">
                 <ResponsiveContainer width="100%" height="100%">
                   <BarChart data={barData}>
                     <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={chartGridColor} />
                     <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} tick={{fill: chartTextColor}} />
                     <YAxis fontSize={12} tickLine={false} axisLine={false} tickFormatter={(val) => `R$${val/1000}k`} tick={{fill: chartTextColor}} />
                     <Tooltip 
                        contentStyle={{backgroundColor: chartTooltipBg, borderColor: chartTooltipBorder, borderRadius: '8px'}}
                        itemStyle={{ color: chartTextColor }}
                        cursor={{fill: theme === 'dark' ? '#334155' : '#f1f5f9'}}
                        formatter={(value: number) => `R$ ${value.toFixed(2)}`}
                     />
                     <Legend wrapperStyle={{ color: chartTextColor }}/>
                     <Bar dataKey="receita" fill="#10b981" radius={[4, 4, 0, 0]} name="Receitas" />
                     <Bar dataKey="despesa" fill="#ef4444" radius={[4, 4, 0, 0]} name="Despesas" />
                   </BarChart>
                 </ResponsiveContainer>
               </div>
            </div>

            <div className="col-span-1 lg:col-span-2 bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700">
               <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="font-bold text-slate-800 dark:text-white mb-1 flex items-center gap-2"><TrendingUp size={20}/> Projeção de Fluxo de Caixa</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Considera: Salários, Fixos, Faturas, Parcelas e Economia p/ Metas.</p>
                  </div>
                  <div className="text-right">
                     <p className="text-xs text-slate-400">Necessidade Mensal p/ Metas</p>
                     <p className="font-bold text-indigo-500">R$ {monthlyGoalNeeds.toFixed(2)}</p>
                  </div>
               </div>
               
               <div className="h-80 w-full min-w-0">
                 <ResponsiveContainer width="100%" height="100%">
                   <ComposedChart data={projectionData}>
                     <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={chartGridColor} />
                     <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} tick={{fill: chartTextColor}} />
                     <YAxis fontSize={12} tickLine={false} axisLine={false} tick={{fill: chartTextColor}} />
                     <Tooltip 
                        contentStyle={{backgroundColor: chartTooltipBg, borderColor: chartTooltipBorder, borderRadius: '8px'}}
                        itemStyle={{ color: chartTextColor }}
                        formatter={(value: number) => `R$ ${value.toFixed(2)}`} 
                     />
                     <Legend />
                     <Bar dataKey="Entradas" fill="#10b981" barSize={20} radius={[4, 4, 0, 0]} stackId="a" />
                     <Bar dataKey="Saídas" fill="#ef4444" barSize={20} radius={[4, 4, 0, 0]} stackId="b" />
                     <Line type="monotone" dataKey="Saldo" stroke="#3b82f6" strokeWidth={2} dot={{r: 3}} name="Saldo Previsto" />
                     <Line type="monotone" dataKey="Saldo Livre" stroke="#8b5cf6" strokeWidth={2} strokeDasharray="5 5" dot={{r: 3}} name="Saldo Livre (Pós-Metas)" />
                   </ComposedChart>
                 </ResponsiveContainer>
               </div>
            </div>
         </div>
      </div>
    );
  };

  const renderGoals = () => {
    // ... existing goals logic ...
    const addGoal = (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const fd = new FormData(e.currentTarget);
      const newGoal: FinancialGoal = {
        id: generateId(),
        name: fd.get('name') as string,
        targetAmount: parseFloat(fd.get('target') as string),
        currentAmount: 0,
        deadline: fd.get('deadline') as string,
        color: `hsl(${Math.random() * 360}, 70%, 50%)`,
        ownerId: fd.get('ownerId') as string
      };
      setState(prev => ({ ...prev, goals: [...prev.goals, newGoal] }));
      e.currentTarget.reset();
    };

    const updateGoalAmount = (id: string, amount: number) => {
       setState(prev => ({
          ...prev,
          goals: prev.goals.map(g => g.id === id ? { ...g, currentAmount: g.currentAmount + amount } : g)
       }));
    };

    const deleteGoal = (id: string) => {
      if(confirm('Excluir esta meta?')) {
        setState(prev => ({ ...prev, goals: prev.goals.filter(g => g.id !== id) }));
      }
    };

    return (
      <div className="space-y-6 animate-fade-in">
        <div className="bg-slate-900 dark:bg-slate-800 rounded-xl p-8 text-white flex flex-col md:flex-row justify-between items-center gap-6 shadow-lg">
           {/* ... existing goal header ... */}
           <div>
              <h2 className="text-2xl font-bold">Metas Financeiras</h2>
              <p className="text-slate-300 mt-2">Defina objetivos e acompanhe seu progresso.</p>
           </div>
           <form onSubmit={addGoal} className="bg-white/10 p-4 rounded-lg flex flex-wrap gap-3 items-end border border-white/10">
              <div>
                <label className="block text-xs mb-1 text-slate-300">Objetivo</label>
                <input name="name" required className="bg-slate-800/50 border border-slate-600 rounded px-3 py-1 text-sm w-32 focus:ring-1 text-white outline-none" placeholder="Ex: Viagem" />
              </div>
              <div>
                <label className="block text-xs mb-1 text-slate-300">Responsável</label>
                <select name="ownerId" className="bg-slate-800/50 border border-slate-600 rounded px-3 py-1.5 text-sm w-32 focus:ring-1 text-white outline-none">
                  <option value="family">Família (Todos)</option>
                  {state.members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs mb-1 text-slate-300">Valor (R$)</label>
                <input name="target" type="number" required className="bg-slate-800/50 border border-slate-600 rounded px-3 py-1 text-sm w-24 outline-none text-white" placeholder="5000" />
              </div>
              <div>
                <label className="block text-xs mb-1 text-slate-300">Prazo</label>
                <input name="deadline" type="date" required className="bg-slate-800/50 border border-slate-600 rounded px-3 py-1 text-sm w-32 outline-none text-white invert-calendar" />
              </div>
              <button type="submit" className="bg-green-600 hover:bg-green-700 text-white px-4 py-1.5 rounded text-sm font-medium transition-colors">
                Criar Meta
              </button>
           </form>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
           {state.goals.map(goal => {
             const progress = (goal.currentAmount / goal.targetAmount) * 100;
             const ownerName = goal.ownerId === 'family' ? 'Família' : state.members.find(m => m.id === goal.ownerId)?.name || 'Desconhecido';
             const isFamily = goal.ownerId === 'family';

             return (
               <div key={goal.id} className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-sm border border-slate-100 dark:border-slate-700 flex flex-col justify-between relative group">
                  <button onClick={() => deleteGoal(goal.id)} className="absolute top-2 right-2 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                    <Trash2 size={16} />
                  </button>
                  
                  <div className="absolute top-3 left-3 opacity-50">
                     {isFamily ? <Home size={16} className="text-slate-400"/> : <User size={16} className="text-slate-400"/>}
                  </div>

                  <div className="mt-4">
                    <div className="flex justify-between items-start mb-2 pr-4">
                       <div>
                         <span className="text-xs text-slate-400 uppercase font-bold tracking-wider">{ownerName}</span>
                         <h3 className="font-bold text-lg text-slate-800 dark:text-white">{goal.name}</h3>
                       </div>
                       <span className="text-xs bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded text-slate-500 dark:text-slate-300 whitespace-nowrap">{new Date(goal.deadline).toLocaleDateString()}</span>
                    </div>
                    <div className="flex items-end gap-1 mb-4">
                       <span className="text-2xl font-bold text-slate-700 dark:text-slate-200">R$ {goal.currentAmount.toLocaleString()}</span>
                       <span className="text-sm text-slate-400 mb-1"> / {goal.targetAmount.toLocaleString()}</span>
                    </div>
                    <ProgressBar current={goal.currentAmount} max={goal.targetAmount} color={goal.color} />
                    <p className="text-right text-xs font-bold mt-1 text-slate-500 dark:text-slate-400">{progress.toFixed(1)}%</p>
                  </div>

                  <div className="mt-6 pt-4 border-t border-slate-50 dark:border-slate-700 flex gap-2">
                     <button 
                       onClick={() => updateGoalAmount(goal.id, 100)}
                       className="flex-1 bg-slate-50 dark:bg-slate-700 hover:bg-slate-100 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-200 text-xs py-2 rounded transition-colors"
                     >
                       + R$ 100
                     </button>
                     <button 
                       onClick={() => {
                          const val = prompt("Valor para adicionar:");
                          if(val) updateGoalAmount(goal.id, parseFloat(val));
                       }}
                       className="flex-1 bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/50 text-blue-600 dark:text-blue-400 text-xs py-2 rounded transition-colors"
                     >
                       Outro valor
                     </button>
                  </div>
               </div>
             );
           })}
        </div>
      </div>
    );
  };

  const renderSettings = () => {
    // Fixed Items Logic
    const addFixedItem = (e: React.FormEvent<HTMLFormElement>) => {
       e.preventDefault();
       const fd = new FormData(e.currentTarget);
       const totalAmount = parseFloat(fd.get('amount') as string);
       
       let finalMemberId = fixedItemSplitMode === 'individual' ? fixedItemIndividualId : state.members[0].id; // Fallback
       if (fixedItemSplitMode === 'individual' && !finalMemberId) {
          alert('Selecione um responsável.');
          return;
       }

       let finalSplits: TransactionSplit[] | undefined = undefined;
       if (fixedItemSplitMode === 'shared') {
          finalSplits = fixedItemSplits.filter(s => s.amount > 0);
          const totalSplit = finalSplits.reduce((acc, s) => acc + s.amount, 0);
          
          if (Math.abs(totalSplit - totalAmount) > 0.1) {
             alert(`A soma das divisões (${totalSplit}) deve ser igual ao valor total (${totalAmount})`);
             return;
          }
       }

       const newItem: FixedItem = {
          id: generateId(),
          description: fd.get('desc') as string,
          amount: totalAmount,
          dayOfMonth: parseInt(fd.get('day') as string),
          type: TransactionType.EXPENSE,
          category: fd.get('category') as string,
          memberId: finalMemberId,
          split: finalSplits
       };
       
       setState(prev => ({ ...prev, fixedItems: [...prev.fixedItems, newItem] }));
       e.currentTarget.reset();
       // Reset local state
       setFixedItemSplitMode('individual');
       setFixedItemSplits([]);
       setFixedItemIndividualId('');
    };

    const deleteFixedItem = (id: string) => {
      if(confirm('Remover esta despesa fixa?')) {
        setState(prev => ({ ...prev, fixedItems: prev.fixedItems.filter(i => i.id !== id)}));
      }
    };

    const distributeFixedEqually = (total: number) => {
        if (!total) return;
        const share = Math.floor((total / state.members.length) * 100) / 100;
        const newSplits = state.members.map(m => ({ memberId: m.id, amount: share }));
        const totalDistributed = share * state.members.length;
        const remainder = total - totalDistributed;
        newSplits[0].amount += remainder;
        setFixedItemSplits(newSplits);
    };

    // Members Logic ... (same as before)
    const handleAddMember = (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const fd = new FormData(e.currentTarget);
      const newM = { 
        id: generateId(), 
        name: fd.get('name') as string, 
        role: fd.get('role') as string,
        salary: parseFloat(fd.get('salary') as string) || 0
      };
      setState(prev => ({...prev, members: [...prev.members, newM]}));
      e.currentTarget.reset();
    };

    const handleUpdateMember = (e: React.FormEvent<HTMLFormElement>) => {
       e.preventDefault();
       if(!editingMember) return;
       const fd = new FormData(e.currentTarget);
       const updated: FamilyMember = { 
         ...editingMember, 
         name: fd.get('name') as string, 
         role: fd.get('role') as string,
         salary: parseFloat(fd.get('salary') as string) || 0
      };
       setState(prev => ({
         ...prev,
         members: prev.members.map(m => m.id === updated.id ? updated : m)
       }));
       setEditingMember(null);
    };

    const deleteMember = (id: string) => {
      if(state.members.length <= 1) {
        alert("Você precisa de pelo menos um membro.");
        return;
      }
      if(confirm("Excluir membro e seus dados associados?")) {
        setState(prev => ({...prev, members: prev.members.filter(m => m.id !== id)}));
      }
    };

    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-fade-in">
        
        {/* Categories Management */}
        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700">
           <h3 className="font-bold text-lg mb-4 flex items-center gap-2 text-slate-800 dark:text-white"><Tag size={18}/> Categorias de Gastos</h3>
           <div className="max-h-64 overflow-y-auto space-y-2 mb-4 pr-2">
             {state.categories.map(cat => (
               <div key={cat.id} className="flex justify-between items-center p-2 bg-slate-50 dark:bg-slate-700/50 rounded border border-slate-100 dark:border-slate-700 group">
                  <div className="flex items-center gap-2">
                     <div className="w-4 h-4 rounded-full shadow-sm border border-black/10" style={{backgroundColor: cat.color}}></div>
                     <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{cat.name}</span>
                  </div>
                  <div className="flex gap-1 opacity-100 transition-opacity">
                     <button type="button" onClick={() => setEditingCategory(cat)} className="p-1.5 text-slate-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-slate-600 rounded transition-colors">
                       <Edit2 size={14} />
                     </button>
                     <button 
                        type="button" 
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          deleteCategory(cat.id);
                        }} 
                        className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-slate-600 rounded transition-colors"
                      >
                       <Trash2 size={14} />
                     </button>
                  </div>
               </div>
             ))}
           </div>
           <form onSubmit={addCategory} className="flex gap-2 pt-4 border-t border-slate-100 dark:border-slate-700">
              <input name="name" required placeholder="Nova categoria..." className={INPUT_STYLE} />
              <button type="submit" className={`${BUTTON_PRIMARY} px-3 py-2 rounded-lg text-sm font-medium`}>Adicionar</button>
           </form>
           {/* Edit Category Modal ... */}
           {editingCategory && (
             <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
               <div className="bg-white dark:bg-slate-800 p-6 rounded-lg w-80 shadow-xl border border-slate-200 dark:border-slate-700">
                 <h3 className="font-bold mb-4 text-slate-800 dark:text-white">Editar Categoria</h3>
                 <form onSubmit={handleUpdateCategory} className="space-y-3">
                   <div>
                     <label className="text-xs text-slate-500 dark:text-slate-400">Nome</label>
                     <input name="name" defaultValue={editingCategory.name} className={INPUT_STYLE} required />
                   </div>
                   <div>
                     <label className="text-xs text-slate-500 dark:text-slate-400">Cor</label>
                     <input name="color" type="color" defaultValue={editingCategory.color} className="w-full h-10 rounded cursor-pointer" />
                   </div>
                   <div className="flex gap-2 mt-4">
                     <button type="button" onClick={() => setEditingCategory(null)} className="flex-1 py-2 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded">Cancelar</button>
                     <button type="submit" className={`flex-1 ${BUTTON_PRIMARY} py-2 rounded text-sm`}>Salvar</button>
                   </div>
                 </form>
               </div>
             </div>
           )}
        </div>

        {/* Fixed Expenses Management (Updated for Split) */}
        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700">
           <h3 className="font-bold text-lg mb-4 flex items-center gap-2 text-slate-800 dark:text-white"><Calendar size={18}/> Despesas Fixas</h3>
           <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">Itens cadastrados aqui são usados para projetar gastos futuros.</p>
           
           <div className="space-y-2 mb-4 max-h-48 overflow-y-auto">
              {state.fixedItems.map(item => (
                 <div key={item.id} className="flex justify-between items-center p-2 bg-slate-50 dark:bg-slate-700/50 rounded text-sm group">
                    <div>
                      <span className="text-slate-700 dark:text-slate-200 block font-medium">{item.description} (Dia {item.dayOfMonth})</span>
                      <span className="text-xs text-slate-500 dark:text-slate-400">{item.category} • </span>
                      {item.split ? (
                        <span className="text-[10px] text-blue-500 font-medium">Compartilhado ({item.split.length})</span>
                      ) : (
                        <span className="text-[10px] text-slate-500">Individual: {state.members.find(m => m.id === item.memberId)?.name}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                       <span className="font-bold text-slate-700 dark:text-slate-200">R$ {item.amount}</span>
                       <button type="button" onClick={() => deleteFixedItem(item.id)} className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all">
                          <Trash2 size={14} />
                       </button>
                    </div>
                 </div>
              ))}
              {state.fixedItems.length === 0 && <p className="text-center text-slate-400 text-sm">Nenhuma despesa fixa.</p>}
           </div>

           <form onSubmit={addFixedItem} className="pt-4 border-t border-slate-100 dark:border-slate-700 space-y-3">
              <div className="grid grid-cols-3 gap-2">
                <input name="desc" required placeholder="Descrição (Ex: Aluguel)" className={`${INPUT_STYLE} col-span-2`} />
                <input name="day" type="number" required placeholder="Dia" max="31" className={INPUT_STYLE} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input 
                   name="amount" 
                   type="number" 
                   required 
                   placeholder="Valor Total (R$)" 
                   className={INPUT_STYLE}
                   onChange={(e) => {
                     const val = parseFloat(e.target.value);
                     if (fixedItemSplitMode === 'shared' && val > 0) {
                         distributeFixedEqually(val);
                     }
                   }}
                />
                <select name="category" className={INPUT_STYLE}>
                    {state.categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                </select>
              </div>
              
              <div className="bg-slate-50 dark:bg-slate-900 rounded border border-slate-200 dark:border-slate-600 p-3">
                 <div className="flex gap-4 mb-2">
                    <label className="flex items-center gap-2 text-xs cursor-pointer">
                       <input 
                         type="radio" 
                         checked={fixedItemSplitMode === 'individual'} 
                         onChange={() => {
                            setFixedItemSplitMode('individual');
                            setFixedItemSplits([]);
                         }}
                       /> Individual
                    </label>
                    <label className="flex items-center gap-2 text-xs cursor-pointer">
                       <input 
                         type="radio" 
                         checked={fixedItemSplitMode === 'shared'} 
                         onChange={() => {
                            setFixedItemSplitMode('shared');
                            const currentAmountInput = document.querySelector('input[name="amount"]') as HTMLInputElement;
                            const val = parseFloat(currentAmountInput?.value) || 0;
                            if (val > 0) distributeFixedEqually(val);
                            else setFixedItemSplits(state.members.map(m => ({ memberId: m.id, amount: 0 })));
                         }}
                       /> Compartilhado
                    </label>
                 </div>

                 {fixedItemSplitMode === 'individual' ? (
                    <select 
                       value={fixedItemIndividualId} 
                       onChange={e => setFixedItemIndividualId(e.target.value)}
                       className={INPUT_STYLE}
                    >
                       <option value="" disabled>Selecione o Responsável</option>
                       {state.members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                    </select>
                 ) : (
                    <div className="space-y-2">
                       {state.members.map(m => {
                          const mySplit = fixedItemSplits.find(s => s.memberId === m.id)?.amount || 0;
                          const totalVal = fixedItemSplits.reduce((acc, s) => acc + s.amount, 0);
                          const pct = totalVal > 0 ? ((mySplit / totalVal) * 100).toFixed(0) : 0;
                          
                          return (
                            <div key={m.id} className="flex items-center gap-2">
                               <span className="text-xs w-20 truncate text-slate-600 dark:text-slate-300">{m.name}</span>
                               <input 
                                  type="number"
                                  step="0.01"
                                  className="flex-1 text-xs p-1 border rounded dark:bg-slate-800 dark:border-slate-700"
                                  value={mySplit}
                                  onChange={e => {
                                     const val = parseFloat(e.target.value) || 0;
                                     setFixedItemSplits(prev => prev.map(s => s.memberId === m.id ? { ...s, amount: val } : s));
                                  }}
                               />
                               <span className="text-xs text-slate-400 w-10 text-right">{pct}%</span>
                            </div>
                          );
                       })}
                       <button 
                         type="button" 
                         onClick={() => {
                            const currentAmountInput = document.querySelector('input[name="amount"]') as HTMLInputElement;
                            distributeFixedEqually(parseFloat(currentAmountInput?.value) || 0);
                         }}
                         className="text-xs text-blue-500 hover:underline w-full text-right"
                       >
                          Dividir Igualmente
                       </button>
                    </div>
                 )}
              </div>

              <button type="submit" className={`${BUTTON_PRIMARY} w-full py-2 rounded-lg text-sm font-medium`}>Salvar Despesa Fixa</button>
           </form>
        </div>

        {/* Members Management (No changes needed, kept for context in grid) */}
        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 lg:col-span-2">
            <h3 className="font-bold text-lg mb-4 text-slate-800 dark:text-white">Membros da Família</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-6">
               {state.members.map(m => (
                 <div key={m.id} className="relative p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg border border-slate-100 dark:border-slate-600 group hover:shadow-md transition-all">
                    <div className="flex justify-end gap-2 mb-2 opacity-100 absolute top-2 right-2">
                        <button type="button" onClick={() => setEditingMember(m)} className="text-slate-400 hover:text-blue-500 hover:bg-blue-100 dark:hover:bg-slate-600 p-1.5 rounded transition-colors">
                           <Edit2 size={14} />
                        </button>
                        <button type="button" onClick={() => deleteMember(m.id)} className="text-slate-400 hover:text-red-500 hover:bg-red-100 dark:hover:bg-slate-600 p-1.5 rounded transition-colors">
                           <Trash2 size={14} />
                        </button>
                    </div>

                    <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300 rounded-full flex items-center justify-center mx-auto mb-3 font-bold text-lg shadow-inner">
                       {m.name.charAt(0)}
                    </div>
                    <p className="font-medium text-sm text-center text-slate-800 dark:text-slate-100">{m.name}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 text-center">{m.role}</p>
                    <p className="text-xs text-green-600 dark:text-green-400 text-center mt-1 font-semibold">
                      Salário: R$ {m.salary ? m.salary.toLocaleString() : '0'}
                    </p>
                 </div>
               ))}
               {/* Add Member Form ... */}
               <form onSubmit={handleAddMember} className="flex flex-col gap-2 justify-center p-4 border border-dashed border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                  <div className="text-center text-xs text-slate-400 mb-2">Novo Membro</div>
                  <input name="name" placeholder="Nome" required className="bg-transparent border-b border-slate-300 dark:border-slate-600 text-sm p-1 text-slate-700 dark:text-slate-200 outline-none focus:border-blue-500" />
                  <input name="role" placeholder="Vínculo" required className="bg-transparent border-b border-slate-300 dark:border-slate-600 text-sm p-1 text-slate-700 dark:text-slate-200 outline-none focus:border-blue-500" />
                  <input name="salary" type="number" placeholder="Salário Base" className="bg-transparent border-b border-slate-300 dark:border-slate-600 text-sm p-1 text-slate-700 dark:text-slate-200 outline-none focus:border-blue-500" />
                  <button type="submit" className="bg-slate-900 dark:bg-slate-700 text-white text-xs py-1.5 rounded mt-2 hover:bg-slate-700 dark:hover:bg-slate-600">Adicionar</button>
               </form>
            </div>
            {/* Edit Member Modal ... */}
            {editingMember && (
               <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                  <div className="bg-white dark:bg-slate-800 p-6 rounded-lg w-80 shadow-xl border border-slate-200 dark:border-slate-700">
                     <h3 className="font-bold mb-4 text-slate-800 dark:text-white">Editar Membro</h3>
                     <form onSubmit={handleUpdateMember} className="space-y-3">
                        <div>
                           <label className="text-xs text-slate-500 dark:text-slate-400">Nome</label>
                           <input name="name" defaultValue={editingMember.name} className={INPUT_STYLE} />
                        </div>
                        <div>
                           <label className="text-xs text-slate-500 dark:text-slate-400">Vínculo</label>
                           <input name="role" defaultValue={editingMember.role} className={INPUT_STYLE} />
                        </div>
                        <div>
                           <label className="text-xs text-slate-500 dark:text-slate-400">Salário Base (Mensal)</label>
                           <input name="salary" type="number" defaultValue={editingMember.salary} className={INPUT_STYLE} />
                        </div>
                        <div className="flex gap-2 mt-4">
                           <button type="button" onClick={() => setEditingMember(null)} className="flex-1 py-2 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded">Cancelar</button>
                           <button type="submit" className={`flex-1 ${BUTTON_PRIMARY} py-2 rounded text-sm`}>Salvar</button>
                        </div>
                     </form>
                  </div>
               </div>
            )}
        </div>
      </div>
    );
  };

  const renderTransactions = () => {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden">
          <div className="p-6 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center">
            <h3 className="font-bold text-lg text-slate-800 dark:text-white">Histórico de Transações</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600 dark:text-slate-300">
              <thead className="bg-slate-50 dark:bg-slate-900 text-slate-500 dark:text-slate-400 font-medium border-b border-slate-100 dark:border-slate-700">
                <tr>
                  <th className="px-6 py-4">Data</th>
                  <th className="px-6 py-4">Descrição</th>
                  <th className="px-6 py-4">Categoria</th>
                  <th className="px-6 py-4">Membro</th>
                  <th className="px-6 py-4">Valor</th>
                  <th className="px-6 py-4">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {combinedTransactions.map((t) => (
                  <tr key={t.id} className={`hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors ${t.isFixed ? 'bg-slate-50/50 dark:bg-slate-800/20' : ''}`}>
                    <td className="px-6 py-4 whitespace-nowrap">{new Date(t.date).toLocaleDateString()}</td>
                    <td className="px-6 py-4">
                      <div className="font-medium text-slate-900 dark:text-white flex items-center gap-2">
                         {t.description}
                         {t.isFixed && (
                           <span className="flex items-center gap-1 text-[10px] bg-slate-200 dark:bg-slate-700 text-slate-500 px-1.5 py-0.5 rounded font-bold uppercase tracking-wide">
                             <Repeat size={10} /> Fixo
                           </span>
                         )}
                      </div>
                      <div className="text-xs text-slate-400">
                        {t.paymentMethod} {t.installment ? `(${t.installment.current}/${t.installment.total})` : ''}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-2 py-1 rounded-full text-xs font-medium bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                        {t.category}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {t.split ? (
                        <span className="text-xs text-blue-500 font-medium bg-blue-50 dark:bg-blue-900/20 px-2 py-1 rounded" title="Dividido">
                           Compartilhado
                        </span>
                      ) : (
                        state.members.find(m => m.id === t.memberId)?.name || 'N/A'
                      )}
                    </td>
                    <td className={`px-6 py-4 font-bold ${t.type === TransactionType.INCOME ? 'text-green-600' : 'text-slate-700 dark:text-slate-300'}`}>
                      {t.type === TransactionType.EXPENSE && '- '}R$ {t.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-6 py-4">
                      {!t.isFixed ? (
                        <button 
                          onClick={() => deleteTransaction(t.id)}
                          className="text-slate-400 hover:text-red-500 transition-colors"
                        >
                          <Trash2 size={16} />
                        </button>
                      ) : (
                         <span className="text-xs text-slate-400 italic">Gestão</span>
                      )}
                    </td>
                  </tr>
                ))}
                {combinedTransactions.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-slate-400">
                      Nenhuma transação registrada.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  const renderCards = () => {
    const addCard = (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const fd = new FormData(e.currentTarget);
      const newCard: CardType = {
        id: generateId(),
        name: fd.get('name') as string,
        limit: parseFloat(fd.get('limit') as string),
        limitHistory: [{ date: new Date().toISOString().split('T')[0], amount: parseFloat(fd.get('limit') as string) }],
        closingDay: parseInt(fd.get('closing') as string),
        dueDay: parseInt(fd.get('due') as string),
        color: `hsl(${Math.random() * 360}, 70%, 20%)`,
        memberId: fd.get('memberId') as string
      };
      setState(prev => ({ ...prev, cards: [...prev.cards, newCard] }));
      e.currentTarget.reset();
    };

    const deleteCard = (id: string) => {
      if(window.confirm('Excluir cartão? Transações vinculadas permanecerão, mas sem vínculo com o cartão.')) {
        setState(prev => ({ ...prev, cards: prev.cards.filter(c => c.id !== id) }));
      }
    };

    return (
      <div className="space-y-6 animate-fade-in">
        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700">
          <h3 className="font-bold text-lg mb-4 text-slate-800 dark:text-white flex items-center gap-2"><CreditCard size={20}/> Cadastrar Cartão</h3>
          <form onSubmit={addCard} className="flex flex-wrap gap-4 items-end">
             <div className="flex-1 min-w-[200px]">
               <label className="text-xs text-slate-500 dark:text-slate-400 mb-1 block">Nome do Cartão</label>
               <input name="name" required placeholder="Ex: Nubank" className={INPUT_STYLE} />
             </div>
             <div className="w-32">
               <label className="text-xs text-slate-500 dark:text-slate-400 mb-1 block">Limite (R$)</label>
               <input name="limit" type="number" required placeholder="5000" className={INPUT_STYLE} />
             </div>
             <div className="w-24">
               <label className="text-xs text-slate-500 dark:text-slate-400 mb-1 block">Dia Fech.</label>
               <input name="closing" type="number" max="31" required placeholder="01" className={INPUT_STYLE} />
             </div>
             <div className="w-24">
               <label className="text-xs text-slate-500 dark:text-slate-400 mb-1 block">Dia Venc.</label>
               <input name="due" type="number" max="31" required placeholder="10" className={INPUT_STYLE} />
             </div>
             <div className="w-40">
               <label className="text-xs text-slate-500 dark:text-slate-400 mb-1 block">Titular</label>
               <select name="memberId" className={INPUT_STYLE}>
                 {state.members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
               </select>
             </div>
             <button type="submit" className={`${BUTTON_PRIMARY} px-6 py-2 rounded-lg`}>Adicionar</button>
          </form>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
           {state.cards.map(card => {
             const today = new Date();
             const currentInvoiceTotal = state.transactions
               .filter(t => t.cardId === card.id && t.type === TransactionType.EXPENSE)
               .filter(t => {
                  const payDate = getPaymentDate(t, state.cards);
                  return payDate.getMonth() === today.getMonth() && payDate.getFullYear() === today.getFullYear();
               })
               .reduce((acc, t) => acc + t.amount, 0);

             const available = card.limit - currentInvoiceTotal;
             const usedPercentage = Math.min(100, (currentInvoiceTotal / card.limit) * 100);

             return (
               <div key={card.id} className="bg-gradient-to-br from-slate-800 to-slate-900 text-white rounded-xl p-6 shadow-xl relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                     <CreditCard size={100} />
                  </div>
                  
                  <div className="relative z-10 flex flex-col h-full justify-between gap-6">
                    <div className="flex justify-between items-start">
                       <div>
                         <p className="text-slate-400 text-xs uppercase tracking-wider font-semibold">Cartão de Crédito</p>
                         <h3 className="text-xl font-bold mt-1">{card.name}</h3>
                       </div>
                       <button onClick={() => deleteCard(card.id)} className="text-slate-500 hover:text-red-400 transition-colors">
                         <Trash2 size={16} />
                       </button>
                    </div>

                    <div className="space-y-4">
                       <div>
                         <div className="flex justify-between text-xs text-slate-300 mb-1">
                           <span>Fatura Atual (Est.)</span>
                           <span>{usedPercentage.toFixed(0)}%</span>
                         </div>
                         <div className="w-full bg-white/10 rounded-full h-1.5 overflow-hidden">
                           <div className={`h-full rounded-full ${usedPercentage > 90 ? 'bg-red-500' : 'bg-blue-500'}`} style={{width: `${usedPercentage}%`}}></div>
                         </div>
                         <div className="flex justify-between mt-1">
                           <span className="text-sm font-semibold">R$ {currentInvoiceTotal.toLocaleString()}</span>
                           <span className="text-xs text-slate-400">Disp: R$ {available.toLocaleString()}</span>
                         </div>
                       </div>

                       <div className="flex justify-between items-center pt-4 border-t border-white/10">
                          <div>
                            <p className="text-xs text-slate-400">Limite Total</p>
                            <p className="font-bold">R$ {card.limit.toLocaleString()}</p>
                          </div>
                          <button 
                             onClick={() => setEditingCardLimit({ cardId: card.id, currentLimit: card.limit })}
                             className="text-xs bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded transition-colors"
                          >
                             Alterar
                          </button>
                       </div>
                    </div>
                  </div>
               </div>
             );
           })}
        </div>
      </div>
    );
  };

  return (
    <div className={`flex h-screen bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-sans transition-colors duration-300`}>
      {/* Sidebar ... */}
      <aside className="w-20 lg:w-64 bg-slate-900 dark:bg-slate-950 text-white flex-shrink-0 flex flex-col transition-all duration-300 shadow-xl z-20 border-r border-slate-800">
        <button 
           onClick={() => setEditingSettings('app')}
           className="p-4 lg:p-6 flex items-center justify-center lg:justify-start gap-3 border-b border-slate-800 hover:bg-slate-800 transition-colors w-full text-left"
        >
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center font-bold shadow-lg shadow-blue-900/50">
             {state.appSettings.appInitials}
          </div>
          <span className="hidden lg:block font-bold text-xl tracking-tight truncate">{state.appSettings.appName}</span>
        </button>
        
        <nav className="flex-1 py-6 px-3 space-y-2 overflow-y-auto">
          {[
            { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
            { id: 'transactions', label: 'Transações', icon: CreditCard },
            { id: 'reports', label: 'Relatórios', icon: PieChartIcon },
            { id: 'goals', label: 'Metas', icon: Target },
            { id: 'cards', label: 'Cartões', icon: Wallet },
            { id: 'settings', label: 'Gestão', icon: Settings },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id as any)}
              className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all duration-200 group ${
                activeTab === item.id 
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/50 scale-105' 
                  : 'text-slate-400 hover:bg-slate-800 hover:text-white hover:pl-4'
              }`}
            >
              <item.icon className="w-5 h-5 transition-transform" />
              <span className="hidden lg:block font-medium">{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-800">
           <button 
              onClick={() => setEditingSettings('profile')}
              className="flex items-center gap-3 p-2 rounded-lg bg-slate-800/50 border border-slate-800 hover:bg-slate-700 w-full text-left transition-colors"
           >
              <div className="w-8 h-8 rounded-full bg-slate-600 flex items-center justify-center text-xs border-2 border-slate-500">
                 {state.appSettings.profileName.charAt(0)}
              </div>
              <div className="hidden lg:block overflow-hidden">
                 <p className="text-sm font-medium truncate">{state.appSettings.profileName}</p>
                 <p className="text-xs text-slate-400 truncate">{state.appSettings.profileSubtitle}</p>
              </div>
           </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden relative">
        <header className="h-16 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-6 lg:px-8 sticky top-0 z-10 transition-colors">
           <div className="flex items-center gap-2">
             <h1 className="text-xl font-bold capitalize text-slate-800 dark:text-white">
               {activeTab === 'settings' ? 'Gestão & Categorias' : activeTab === 'reports' ? 'Relatórios & Gráficos' : activeTab === 'cards' ? 'Meus Cartões' : activeTab}
             </h1>
           </div>
           
           <div className="flex items-center gap-4">
             <button onClick={toggleTheme} className="p-2 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors lg:hidden">
               {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
             </button>

             <button 
              onClick={() => setIsModalOpen(true)}
              className="bg-slate-900 hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-500 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium transition-all shadow-lg shadow-slate-200 dark:shadow-blue-900/20 transform hover:-translate-y-0.5"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Nova Transação</span>
            </button>
           </div>
        </header>

        <div className="flex-1 overflow-auto p-4 lg:p-8 bg-slate-50/50 dark:bg-slate-900">
          <div className="max-w-7xl mx-auto pb-10">
            {activeTab === 'dashboard' && renderDashboard()}
            {activeTab === 'transactions' && renderTransactions()}
            {activeTab === 'cards' && renderCards()}
            {activeTab === 'goals' && renderGoals()}
            {activeTab === 'reports' && renderReports()}
            {activeTab === 'settings' && renderSettings()}
          </div>
        </div>
      </main>

      <TransactionModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        onSave={handleAddTransaction}
        appState={state}
      />

      {editingSettings && (
         <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-slate-800 p-6 rounded-lg w-80 shadow-xl border border-slate-200 dark:border-slate-700">
               <h3 className="font-bold mb-4 text-slate-800 dark:text-white">
                 {editingSettings === 'app' ? 'Editar Identidade do App' : 'Editar Perfil da Família'}
               </h3>
               <form onSubmit={handleUpdateAppSettings} className="space-y-3">
                  {editingSettings === 'app' ? (
                    <>
                      <div>
                        <label className="text-xs text-slate-500 dark:text-slate-400">Nome do App</label>
                        <input name="appName" defaultValue={state.appSettings.appName} className={INPUT_STYLE} required />
                      </div>
                      <div>
                        <label className="text-xs text-slate-500 dark:text-slate-400">Iniciais (Logo)</label>
                        <input name="appInitials" defaultValue={state.appSettings.appInitials} className={INPUT_STYLE} required maxLength={2} />
                      </div>
                    </>
                  ) : (
                    <>
                      <div>
                        <label className="text-xs text-slate-500 dark:text-slate-400">Nome de Exibição</label>
                        <input name="profileName" defaultValue={state.appSettings.profileName} className={INPUT_STYLE} required />
                      </div>
                      <div>
                        <label className="text-xs text-slate-500 dark:text-slate-400">Subtítulo / Email</label>
                        <input name="profileSubtitle" defaultValue={state.appSettings.profileSubtitle} className={INPUT_STYLE} required />
                      </div>
                    </>
                  )}
                  
                  <div className="flex gap-2 mt-4">
                     <button type="button" onClick={() => setEditingSettings(null)} className="flex-1 py-2 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded">Cancelar</button>
                     <button type="submit" className={`flex-1 ${BUTTON_PRIMARY} py-2 rounded text-sm`}>Salvar</button>
                  </div>
               </form>
            </div>
         </div>
      )}

      {/* Edit Limit Modal ... */}
      {editingCardLimit && (
         <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-slate-800 p-6 rounded-lg w-80 shadow-xl border border-slate-200 dark:border-slate-700">
               <h3 className="font-bold mb-4 text-slate-800 dark:text-white">Alterar Limite</h3>
               <form onSubmit={handleUpdateCardLimit} className="space-y-3">
                  <div>
                     <label className="text-xs text-slate-500 dark:text-slate-400">Novo Limite (R$)</label>
                     <input name="newLimit" type="number" defaultValue={editingCardLimit.currentLimit} className={INPUT_STYLE} required />
                  </div>
                  <div>
                     <label className="text-xs text-slate-500 dark:text-slate-400">Data da Alteração</label>
                     <input name="changeDate" type="date" className={`${INPUT_STYLE} invert-calendar`} required />
                  </div>
                  <div className="flex gap-2 mt-4">
                     <button type="button" onClick={() => setEditingCardLimit(null)} className="flex-1 py-2 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded">Cancelar</button>
                     <button type="submit" className={`flex-1 ${BUTTON_PRIMARY} py-2 rounded text-sm`}>Salvar</button>
                  </div>
               </form>
            </div>
         </div>
      )}
    </div>
  );
}
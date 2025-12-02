import React, { useState, useEffect } from 'react';
import { AppState, Transaction, TransactionType, PaymentMethod, TransactionSplit } from '../types';
import { generateId as genId } from '../services/storage';

interface TransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (transactions: Transaction[]) => void;
  appState: AppState;
}

const INPUT_STYLE = "w-full border rounded-lg p-2 outline-none transition-colors bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 border-slate-300 dark:border-slate-700 focus:ring-2 focus:ring-blue-500 placeholder-slate-400";
const DISABLED_INPUT_STYLE = "w-full border rounded-lg p-2 outline-none transition-colors bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 border-slate-300 dark:border-slate-600 cursor-not-allowed";

const TransactionModal: React.FC<TransactionModalProps> = ({ isOpen, onClose, onSave, appState }) => {
  const [formData, setFormData] = useState<Partial<Transaction> & { isInstallment: boolean; installments: number }>({
    type: TransactionType.EXPENSE,
    date: new Date().toISOString().split('T')[0],
    amount: 0,
    description: '',
    category: appState.categories[0]?.name || 'Outros',
    paymentMethod: PaymentMethod.DEBIT,
    memberId: appState.members[0]?.id,
    isFixed: false, // Legacy, kept for typing but unused in UI
    isInstallment: false,
    installments: 2
  });

  const [isShared, setIsShared] = useState(false);
  const [splits, setSplits] = useState<TransactionSplit[]>([]);

  // Initialize splits when shared is toggled
  useEffect(() => {
    if (isShared && splits.length === 0) {
      const initialSplit = appState.members.map(m => ({ memberId: m.id, amount: 0 }));
      // Distribute equally initially if amount exists
      if (formData.amount && formData.amount > 0) {
        const share = parseFloat((formData.amount / appState.members.length).toFixed(2));
        initialSplit.forEach(s => s.amount = share);
        // Fix rounding error on last item
        const currentSum = share * appState.members.length;
        const diff = formData.amount - currentSum;
        if (diff !== 0) initialSplit[0].amount += diff;
      }
      setSplits(initialSplit);
    }
  }, [isShared, appState.members, formData.amount]);

  if (!isOpen) return null;

  const handleSplitChange = (memberId: string, value: string) => {
    const val = parseFloat(value) || 0;
    setSplits(prev => prev.map(s => s.memberId === memberId ? { ...s, amount: val } : s));
  };

  const distributeEqually = () => {
    if (!formData.amount) return;
    const share = Math.floor((formData.amount / appState.members.length) * 100) / 100;
    const newSplits = appState.members.map(m => ({ memberId: m.id, amount: share }));
    // Adjust remainder to first person
    const totalDistributed = share * appState.members.length;
    const remainder = formData.amount - totalDistributed;
    newSplits[0].amount += remainder;
    setSplits(newSplits);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.amount || !formData.description) return;
    if (!isShared && !formData.memberId) return;

    // Validate splits match total
    if (isShared) {
      const totalSplit = splits.reduce((acc, s) => acc + s.amount, 0);
      if (Math.abs(totalSplit - formData.amount) > 0.1) {
        alert(`A soma das divisões (R$ ${totalSplit.toFixed(2)}) deve ser igual ao valor total (R$ ${formData.amount.toFixed(2)})`);
        return;
      }
    }

    const transactionsToSave: Transaction[] = [];
    const baseDate = new Date(formData.date || new Date().toISOString());
    const isInstallment = formData.type === TransactionType.EXPENSE && formData.isInstallment;
    const loopCount = isInstallment ? (formData.installments || 1) : 1;
    
    // Installment Logic: Divide Total Amount by Count
    const amountPerTransaction = isInstallment 
      ? formData.amount / loopCount 
      : formData.amount;

    for (let i = 0; i < loopCount; i++) {
      const tDate = new Date(baseDate);
      tDate.setMonth(baseDate.getMonth() + i);
      
      const description = isInstallment 
        ? `${formData.description} (${i + 1}/${loopCount})`
        : formData.description;

      // Logic for Split in Installments:
      // If it's shared, we must divide the split amounts by the loop count as well, 
      // or simply copy the percentage structure. 
      // Current implementation: Divides the specific split amounts.
      const installmentSplits = isShared 
        ? splits.map(s => ({ memberId: s.memberId, amount: s.amount / loopCount }))
        : undefined;

      const newTransaction: Transaction = {
        id: genId(),
        description: description || '',
        amount: parseFloat(amountPerTransaction.toFixed(2)),
        date: tDate.toISOString(),
        type: formData.type as TransactionType,
        category: formData.type === TransactionType.INCOME ? 'Receita' : (formData.category || 'Outros'),
        paymentMethod: formData.paymentMethod as PaymentMethod,
        memberId: formData.memberId || '', // Primary payer or owner
        cardId: formData.paymentMethod === PaymentMethod.CREDIT_CARD ? formData.cardId : undefined,
        isFixed: false, // Fixed expenses are now handled strictly in Management tab
        installment: isInstallment ? { current: i + 1, total: loopCount } : undefined,
        split: installmentSplits
      };
      
      transactionsToSave.push(newTransaction);
    }

    onSave(transactionsToSave);
    onClose();
    // Reset form
    setFormData({
       ...formData,
       description: '',
       amount: 0,
       isInstallment: false,
       installments: 2
    });
    setIsShared(false);
    setSplits([]);
  };

  const handleTypeChange = (type: TransactionType) => {
    if (type === TransactionType.INCOME) {
      setFormData({
        ...formData,
        type: TransactionType.INCOME,
        isInstallment: false,
        isFixed: false,
        category: 'Receita'
      });
      setIsShared(false);
    } else {
      setFormData({
        ...formData,
        type: TransactionType.EXPENSE,
        isInstallment: false,
        category: appState.categories[0]?.name || 'Outros'
      });
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-fade-in border border-slate-200 dark:border-slate-700 max-h-[90vh] overflow-y-auto">
        <div className="bg-slate-900 dark:bg-slate-950 text-white p-4 flex justify-between items-center border-b border-slate-800">
          <h2 className="text-xl font-bold">Nova Transação</h2>
          <button onClick={onClose} className="text-gray-300 hover:text-white transition-colors">&times;</button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          
          {/* Type Selector */}
          <div className="flex gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input 
                type="radio" 
                name="type" 
                checked={formData.type === TransactionType.EXPENSE} 
                onChange={() => handleTypeChange(TransactionType.EXPENSE)}
                className="w-4 h-4 text-red-600 accent-red-600"
              />
              <span className="text-slate-700 dark:text-slate-200 font-medium">Despesa</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input 
                type="radio" 
                name="type" 
                checked={formData.type === TransactionType.INCOME} 
                onChange={() => handleTypeChange(TransactionType.INCOME)}
                className="w-4 h-4 text-green-600 accent-green-600"
              />
              <span className="text-slate-700 dark:text-slate-200 font-medium">Receita</span>
            </label>
          </div>

          {/* Amount & Date */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-slate-600 dark:text-slate-400 mb-1">
                 Valor Total (R$)
              </label>
              <input 
                type="number" 
                step="0.01" 
                required
                className={INPUT_STYLE}
                value={formData.amount || ''}
                onChange={e => setFormData({...formData, amount: parseFloat(e.target.value)})}
              />
            </div>
            <div>
              <label className="block text-sm text-slate-600 dark:text-slate-400 mb-1">Data</label>
              <input 
                type="date" 
                required
                className={`${INPUT_STYLE} invert-calendar`}
                value={formData.date}
                onChange={e => setFormData({...formData, date: e.target.value})}
              />
            </div>
          </div>

          {/* Payment Method - MOVED UP */}
          {formData.type === TransactionType.EXPENSE && (
            <div>
              <label className="block text-sm text-slate-600 dark:text-slate-400 mb-1">Forma de Pagamento</label>
              <select 
                className={INPUT_STYLE}
                value={formData.paymentMethod}
                onChange={e => setFormData({...formData, paymentMethod: e.target.value as PaymentMethod})}
              >
                {Object.values(PaymentMethod).map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
          )}

          {/* Credit Card Specific - MOVED UP */}
          {formData.type === TransactionType.EXPENSE && formData.paymentMethod === PaymentMethod.CREDIT_CARD && (
             <div>
              <label className="block text-sm text-slate-600 dark:text-slate-400 mb-1">Cartão</label>
              {appState.cards.length > 0 ? (
                <select 
                  className={INPUT_STYLE}
                  value={formData.cardId || ''}
                  onChange={e => setFormData({...formData, cardId: e.target.value})}
                  required
                >
                  <option value="" disabled>Selecione um cartão</option>
                  {appState.cards.map(c => {
                    const ownerName = appState.members.find(m => m.id === c.memberId)?.name || 'N/A';
                    return (
                       <option key={c.id} value={c.id}>{c.name} ({ownerName})</option>
                    );
                  })}
                </select>
              ) : (
                <p className="text-sm text-red-500">Cadastre um cartão primeiro na aba "Cartões".</p>
              )}
            </div>
          )}

          {/* Description - MOVED DOWN */}
          <div>
            <label className="block text-sm text-slate-600 dark:text-slate-400 mb-1">Descrição</label>
            <input 
              type="text" 
              required
              placeholder={formData.type === TransactionType.INCOME ? "Ex: Salário, Bônus..." : "Ex: Supermercado Semanal"}
              className={INPUT_STYLE}
              value={formData.description}
              onChange={e => setFormData({...formData, description: e.target.value})}
              list={formData.type === TransactionType.INCOME ? "income-suggestions" : undefined}
            />
            {formData.type === TransactionType.INCOME && (
              <datalist id="income-suggestions">
                <option value="Salário" />
                <option value="Décimo Terceiro" />
                <option value="Férias" />
                <option value="Comissão" />
                <option value="Bônus" />
                <option value="Restituição IR" />
                <option value="Rendimento Investimento" />
                <option value="Venda" />
              </datalist>
            )}
          </div>

          {/* Ownership / Splitting Logic */}
          <div className="bg-slate-50 dark:bg-slate-700/30 p-4 rounded-lg border border-slate-100 dark:border-slate-700">
             <div className="flex gap-4 mb-3 border-b border-slate-200 dark:border-slate-600 pb-2">
                <button 
                  type="button" 
                  onClick={() => setIsShared(false)}
                  className={`text-sm font-medium pb-1 ${!isShared ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-500'}`}
                >
                  Individual
                </button>
                <button 
                  type="button" 
                  onClick={() => setIsShared(true)}
                  className={`text-sm font-medium pb-1 ${isShared ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-500'}`}
                >
                  Compartilhado (Dividir)
                </button>
             </div>

             {!isShared ? (
                <div>
                  <label className="block text-sm text-slate-600 dark:text-slate-400 mb-1">Responsável</label>
                  <select 
                    className={INPUT_STYLE}
                    value={formData.memberId}
                    onChange={e => setFormData({...formData, memberId: e.target.value})}
                  >
                    {appState.members.map(m => (
                      <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                  </select>
                </div>
             ) : (
               <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-slate-500">Defina o valor para cada membro:</span>
                    <button type="button" onClick={distributeEqually} className="text-xs text-blue-500 hover:underline">Dividir Igualmente</button>
                  </div>
                  {appState.members.map(m => {
                    const mySplit = splits.find(s => s.memberId === m.id)?.amount || 0;
                    return (
                      <div key={m.id} className="flex items-center gap-2">
                        <span className="text-sm text-slate-700 dark:text-slate-300 w-24 truncate">{m.name}</span>
                        <div className="flex-1 relative">
                          <span className="absolute left-2 top-2 text-xs text-slate-400">R$</span>
                          <input 
                             type="number"
                             step="0.01"
                             className={`${INPUT_STYLE} pl-6 py-1`}
                             value={mySplit}
                             onChange={e => handleSplitChange(m.id, e.target.value)}
                          />
                        </div>
                      </div>
                    );
                  })}
                  <div className="text-right text-xs">
                     Total Alocado: <span className={`${Math.abs(splits.reduce((a,b)=>a+b.amount,0) - (formData.amount||0)) < 0.1 ? 'text-green-500' : 'text-red-500'} font-bold`}>
                       R$ {splits.reduce((a,b)=>a+b.amount,0).toFixed(2)}
                     </span> / {formData.amount?.toFixed(2)}
                  </div>
               </div>
             )}
          </div>

          {/* Category */}
          <div>
            <label className="block text-sm text-slate-600 dark:text-slate-400 mb-1">Categoria</label>
            {formData.type === TransactionType.INCOME ? (
              <input 
                type="text" 
                value="Receita" 
                disabled 
                className={DISABLED_INPUT_STYLE}
                title="Categoria fixada para Receitas"
              />
            ) : (
              <select 
                className={INPUT_STYLE}
                value={formData.category}
                onChange={e => setFormData({...formData, category: e.target.value})}
              >
                {appState.categories.map(c => (
                  <option key={c.id} value={c.name}>{c.name}</option>
                ))}
              </select>
            )}
          </div>

          {/* Installment Options - FIXED REMOVED */}
          {formData.type === TransactionType.EXPENSE && (
            <div className="flex flex-col gap-3 p-3 bg-slate-50 dark:bg-slate-700/30 rounded-lg border border-slate-100 dark:border-slate-700">
                 <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={formData.isInstallment} 
                        onChange={e => setFormData({...formData, isInstallment: e.target.checked})}
                        className="w-4 h-4 rounded text-blue-600"
                      />
                      <span className="text-sm text-slate-700 dark:text-slate-300">Parcelado</span>
                    </label>
                    
                    {formData.isInstallment && (
                      <div className="flex items-center gap-2">
                         <span className="text-xs text-slate-500">Qtd:</span>
                         <input 
                            type="number" 
                            min="2" 
                            max="48"
                            value={formData.installments}
                            onChange={e => setFormData({...formData, installments: parseInt(e.target.value)})}
                            className="w-16 p-1 text-sm border rounded bg-white dark:bg-slate-800 text-slate-900 dark:text-white border-slate-300 dark:border-slate-600 outline-none focus:border-blue-500"
                         />
                         <span className="text-xs text-slate-500">x</span>
                      </div>
                    )}
                 </div>
                 {formData.isInstallment && formData.amount && formData.amount > 0 && (
                   <p className="text-xs text-slate-500 text-right">
                      {formData.installments}x de R$ {(formData.amount / formData.installments).toFixed(2)}
                   </p>
                 )}
            </div>
          )}
          
          <div className="pt-4 flex justify-end gap-2 border-t border-slate-100 dark:border-slate-700 mt-2">
            <button 
              type="button" 
              onClick={onClose}
              className="px-4 py-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
            >
              Cancelar
            </button>
            <button 
              type="submit"
              className="px-6 py-2 bg-slate-900 dark:bg-blue-600 text-white rounded-lg hover:bg-slate-800 dark:hover:bg-blue-500 transition-colors"
            >
              Salvar
            </button>
          </div>

        </form>
      </div>
    </div>
  );
};

export default TransactionModal;
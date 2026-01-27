import { useState } from 'react';
import { Plus, Search, Filter, Edit, Trash2, Check, X, Upload, FileText } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { transactions, incomeCategories, expenseCategories, users } from '@/data/mockData';
import { formatCurrency, formatDate } from '@/lib/utils';
import type { Transaction, TransactionType, TransactionStatus, User } from '@/types';

interface FinancePageProps {
    currentUser: User;
}

const statusLabels: Record<TransactionStatus, { label: string; variant: 'warning' | 'success' | 'danger' }> = {
    pending: { label: 'Chờ duyệt', variant: 'warning' },
    approved: { label: 'Đã duyệt', variant: 'success' },
    cancelled: { label: 'Đã huỷ', variant: 'danger' }
};

const paymentMethodLabels = {
    cash: 'Tiền mặt',
    transfer: 'Chuyển khoản',
    card: 'Thẻ'
};

interface TransactionFormProps {
    type: TransactionType;
    onClose: () => void;
    onSubmit: (data: Partial<Transaction>) => void;
}

function TransactionForm({ type, onClose, onSubmit }: TransactionFormProps) {
    const [category, setCategory] = useState('');
    const [amount, setAmount] = useState<number>(0);
    const [paymentMethod, setPaymentMethod] = useState<'cash' | 'transfer' | 'card'>('cash');
    const [notes, setNotes] = useState('');
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);

    const categories = type === 'income' ? incomeCategories : expenseCategories;

    const handleSubmit = () => {
        if (!category || amount <= 0) {
            alert('Vui lòng điền đầy đủ thông tin');
            return;
        }

        onSubmit({
            type,
            category,
            amount,
            paymentMethod,
            notes,
            date,
            status: 'pending'
        });

        onClose();
    };

    return (
        <DialogContent className="max-w-md">
            <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                    {type === 'income' ? (
                        <div className="h-8 w-8 rounded-full bg-success/10 flex items-center justify-center">
                            <Plus className="h-4 w-4 text-success" />
                        </div>
                    ) : (
                        <div className="h-8 w-8 rounded-full bg-danger/10 flex items-center justify-center">
                            <FileText className="h-4 w-4 text-danger" />
                        </div>
                    )}
                    Tạo phiếu {type === 'income' ? 'thu' : 'chi'}
                </DialogTitle>
                <DialogDescription>
                    Nhập thông tin phiếu {type === 'income' ? 'thu' : 'chi'} mới
                </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
                {/* Date */}
                <div className="space-y-2">
                    <Label>Ngày</Label>
                    <Input
                        type="date"
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                    />
                </div>

                {/* Category */}
                <div className="space-y-2">
                    <Label>Loại {type === 'income' ? 'thu' : 'chi'} *</Label>
                    <Select value={category} onValueChange={setCategory}>
                        <SelectTrigger>
                            <SelectValue placeholder="Chọn loại" />
                        </SelectTrigger>
                        <SelectContent>
                            {categories.map(cat => (
                                <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                {/* Amount */}
                <div className="space-y-2">
                    <Label>Số tiền *</Label>
                    <div className="relative">
                        <Input
                            type="number"
                            min="0"
                            value={amount}
                            onChange={(e) => setAmount(parseInt(e.target.value) || 0)}
                            className="pr-16"
                            placeholder="0"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                            VNĐ
                        </span>
                    </div>
                    {amount > 0 && (
                        <p className="text-sm text-muted-foreground">{formatCurrency(amount)}</p>
                    )}
                </div>

                {/* Payment Method */}
                <div className="space-y-2">
                    <Label>Phương thức</Label>
                    <Select value={paymentMethod} onValueChange={(v: typeof paymentMethod) => setPaymentMethod(v)}>
                        <SelectTrigger>
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="cash">Tiền mặt</SelectItem>
                            <SelectItem value="transfer">Chuyển khoản</SelectItem>
                            <SelectItem value="card">Thẻ</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                {/* Notes */}
                <div className="space-y-2">
                    <Label>Ghi chú</Label>
                    <textarea
                        className="w-full min-h-[80px] px-3 py-2 text-sm rounded-lg border border-input focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                        placeholder="Nhập ghi chú..."
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                    />
                </div>

                {/* File Upload */}
                <div className="space-y-2">
                    <Label>File đính kèm</Label>
                    <div className="border-2 border-dashed rounded-lg p-4 text-center hover:bg-muted/50 transition-colors cursor-pointer">
                        <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                        <p className="text-sm text-muted-foreground">Click để upload file</p>
                    </div>
                </div>
            </div>

            <DialogFooter>
                <Button variant="outline" onClick={onClose}>Huỷ</Button>
                <Button onClick={handleSubmit} variant={type === 'income' ? 'success' : 'destructive'}>
                    Tạo phiếu
                </Button>
            </DialogFooter>
        </DialogContent>
    );
}

function TransactionTable({
    transactions,
    userRole
}: {
    transactions: Transaction[];
    userRole: string;
}) {
    const canEdit = userRole === 'accountant' || userRole === 'manager' || userRole === 'admin';

    return (
        <>
            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
                <table className="w-full">
                    <thead className="bg-muted/50 border-y">
                        <tr>
                            <th className="p-3 text-left text-sm font-medium text-muted-foreground">Mã phiếu</th>
                            <th className="p-3 text-left text-sm font-medium text-muted-foreground">Ngày</th>
                            <th className="p-3 text-left text-sm font-medium text-muted-foreground">Loại</th>
                            <th className="p-3 text-right text-sm font-medium text-muted-foreground">Số tiền</th>
                            <th className="p-3 text-left text-sm font-medium text-muted-foreground">Người tạo</th>
                            <th className="p-3 text-left text-sm font-medium text-muted-foreground">Trạng thái</th>
                            {canEdit && (
                                <th className="p-3 text-right text-sm font-medium text-muted-foreground">Thao tác</th>
                            )}
                        </tr>
                    </thead>
                    <tbody>
                        {transactions.map((trans) => (
                            <tr key={trans.id} className="border-b hover:bg-muted/30 transition-colors">
                                <td className="p-3 font-medium">{trans.code}</td>
                                <td className="p-3 text-sm">{formatDate(trans.date)}</td>
                                <td className="p-3">
                                    <Badge variant="outline">{trans.category}</Badge>
                                </td>
                                <td className={`p-3 text-right font-semibold ${trans.type === 'income' ? 'text-success' : 'text-danger'}`}>
                                    {trans.type === 'income' ? '+' : '-'}{formatCurrency(trans.amount)}
                                </td>
                                <td className="p-3">
                                    <div className="flex items-center gap-2">
                                        <Avatar className="h-7 w-7">
                                            <AvatarImage src={trans.createdBy.avatar} />
                                            <AvatarFallback className="text-xs">{trans.createdBy.name.charAt(0)}</AvatarFallback>
                                        </Avatar>
                                        <span className="text-sm">{trans.createdBy.name}</span>
                                    </div>
                                </td>
                                <td className="p-3">
                                    <Badge variant={statusLabels[trans.status].variant}>
                                        {statusLabels[trans.status].label}
                                    </Badge>
                                </td>
                                {canEdit && (
                                    <td className="p-3 text-right">
                                        <div className="flex items-center justify-end gap-1">
                                            {trans.status === 'pending' && (
                                                <>
                                                    <Button variant="ghost" size="icon" className="text-success hover:bg-success/10">
                                                        <Check className="h-4 w-4" />
                                                    </Button>
                                                    <Button variant="ghost" size="icon" className="text-danger hover:bg-danger/10">
                                                        <X className="h-4 w-4" />
                                                    </Button>
                                                </>
                                            )}
                                            <Button variant="ghost" size="icon">
                                                <Edit className="h-4 w-4" />
                                            </Button>
                                            <Button variant="ghost" size="icon" className="text-danger hover:bg-danger/10">
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </td>
                                )}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden space-y-3 p-4">
                {transactions.map((trans) => (
                    <div key={trans.id} className="p-4 rounded-lg border bg-card">
                        <div className="flex items-start justify-between mb-3">
                            <div>
                                <p className="font-semibold">{trans.code}</p>
                                <p className="text-sm text-muted-foreground">{formatDate(trans.date)}</p>
                            </div>
                            <Badge variant={statusLabels[trans.status].variant}>
                                {statusLabels[trans.status].label}
                            </Badge>
                        </div>

                        <div className="flex items-center justify-between mb-3">
                            <Badge variant="outline">{trans.category}</Badge>
                            <span className={`text-lg font-bold ${trans.type === 'income' ? 'text-success' : 'text-danger'}`}>
                                {trans.type === 'income' ? '+' : '-'}{formatCurrency(trans.amount)}
                            </span>
                        </div>

                        <div className="flex items-center justify-between pt-3 border-t">
                            <div className="flex items-center gap-2">
                                <Avatar className="h-6 w-6">
                                    <AvatarImage src={trans.createdBy.avatar} />
                                    <AvatarFallback className="text-xs">{trans.createdBy.name.charAt(0)}</AvatarFallback>
                                </Avatar>
                                <span className="text-sm text-muted-foreground">{trans.createdBy.name}</span>
                            </div>

                            {canEdit && (
                                <div className="flex gap-1">
                                    <Button variant="ghost" size="icon" className="h-8 w-8">
                                        <Edit className="h-4 w-4" />
                                    </Button>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-danger">
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </>
    );
}

export function FinancePage({ currentUser }: FinancePageProps) {
    const [activeTab, setActiveTab] = useState<'income' | 'expense'>('income');
    const [showForm, setShowForm] = useState<TransactionType | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('all');

    const incomeTransactions = transactions.filter(t => t.type === 'income');
    const expenseTransactions = transactions.filter(t => t.type === 'expense');

    const totalIncome = incomeTransactions
        .filter(t => t.status === 'approved')
        .reduce((sum, t) => sum + t.amount, 0);

    const totalExpense = expenseTransactions
        .filter(t => t.status === 'approved')
        .reduce((sum, t) => sum + t.amount, 0);

    const filteredTransactions = (activeTab === 'income' ? incomeTransactions : expenseTransactions)
        .filter(t => {
            const matchesSearch = t.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
                t.category.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesStatus = statusFilter === 'all' || t.status === statusFilter;
            return matchesSearch && matchesStatus;
        });

    const handleCreateTransaction = (data: Partial<Transaction>) => {
        console.log('Creating transaction:', data);
        alert('Đã tạo phiếu thành công!');
    };

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Page Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-foreground">Thu Chi</h1>
                    <p className="text-muted-foreground">Quản lý phiếu thu và phiếu chi</p>
                </div>
                <div className="flex gap-2">
                    <Button onClick={() => setShowForm('income')} variant="success">
                        <Plus className="h-4 w-4 mr-2" />
                        Phiếu thu
                    </Button>
                    <Button onClick={() => setShowForm('expense')} variant="destructive">
                        <Plus className="h-4 w-4 mr-2" />
                        Phiếu chi
                    </Button>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Card className="bg-success-light border-0">
                    <CardContent className="p-5">
                        <p className="text-sm font-medium text-muted-foreground mb-1">Tổng thu (đã duyệt)</p>
                        <p className="text-2xl font-bold text-success">{formatCurrency(totalIncome)}</p>
                    </CardContent>
                </Card>
                <Card className="bg-danger-light border-0">
                    <CardContent className="p-5">
                        <p className="text-sm font-medium text-muted-foreground mb-1">Tổng chi (đã duyệt)</p>
                        <p className="text-2xl font-bold text-danger">{formatCurrency(totalExpense)}</p>
                    </CardContent>
                </Card>
                <Card className="bg-purple-light border-0">
                    <CardContent className="p-5">
                        <p className="text-sm font-medium text-muted-foreground mb-1">Chênh lệch</p>
                        <p className={`text-2xl font-bold ${totalIncome - totalExpense >= 0 ? 'text-success' : 'text-danger'}`}>
                            {formatCurrency(totalIncome - totalExpense)}
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Tabs */}
            <Card>
                <CardContent className="p-0">
                    <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
                        <div className="border-b px-4 pt-4">
                            <TabsList className="mb-4">
                                <TabsTrigger value="income" className="gap-2">
                                    <div className="h-2 w-2 rounded-full bg-success" />
                                    Phiếu thu
                                    <Badge variant="secondary" className="ml-1">{incomeTransactions.length}</Badge>
                                </TabsTrigger>
                                <TabsTrigger value="expense" className="gap-2">
                                    <div className="h-2 w-2 rounded-full bg-danger" />
                                    Phiếu chi
                                    <Badge variant="secondary" className="ml-1">{expenseTransactions.length}</Badge>
                                </TabsTrigger>
                            </TabsList>

                            {/* Filters */}
                            <div className="flex flex-col sm:flex-row gap-3 pb-4">
                                <div className="relative flex-1">
                                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                    <Input
                                        placeholder="Tìm theo mã, loại..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="pl-9"
                                    />
                                </div>
                                <Select value={statusFilter} onValueChange={setStatusFilter}>
                                    <SelectTrigger className="w-full sm:w-40">
                                        <SelectValue placeholder="Trạng thái" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">Tất cả</SelectItem>
                                        <SelectItem value="pending">Chờ duyệt</SelectItem>
                                        <SelectItem value="approved">Đã duyệt</SelectItem>
                                        <SelectItem value="cancelled">Đã huỷ</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <TabsContent value="income" className="m-0">
                            <TransactionTable transactions={filteredTransactions} userRole={currentUser.role} />
                        </TabsContent>

                        <TabsContent value="expense" className="m-0">
                            <TransactionTable transactions={filteredTransactions} userRole={currentUser.role} />
                        </TabsContent>
                    </Tabs>
                </CardContent>
            </Card>

            {/* Create Transaction Dialog */}
            <Dialog open={!!showForm} onOpenChange={() => setShowForm(null)}>
                {showForm && (
                    <TransactionForm
                        type={showForm}
                        onClose={() => setShowForm(null)}
                        onSubmit={handleCreateTransaction}
                    />
                )}
            </Dialog>
        </div>
    );
}

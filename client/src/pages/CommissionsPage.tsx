import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Search, Plus, Download, Upload, ChevronRight, ChevronDown, Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';

import { useProducts } from '@/hooks/useProducts';
import { useProductTypes } from '@/hooks/useProductTypes';
import { useUsers } from '@/hooks/useUsers';
import { formatNumber } from '@/lib/utils';
import { toast } from 'sonner';

// Commission table types
interface CommissionTable {
    id: string;
    name: string;
    type: 'common' | 'management' | 'ktv_weekly' | 'sale';
    checked: boolean;
}

const defaultCommissionTables: CommissionTable[] = [
    { id: 'common', name: 'Bảng hoa hồng chung', type: 'common', checked: true },
    { id: 'management', name: 'Hoa Hồng Quản Lý', type: 'management', checked: false },
    { id: 'ktv_weekly', name: 'HOA HỒNG KTV TUẦN', type: 'ktv_weekly', checked: false },
    { id: 'sale', name: 'HOA HỒNG SALE', type: 'sale', checked: false },
];

// Product group tree structure
// Services are parent nodes, their applicable_product_types are children
interface ProductGroup {
    id: string;
    name: string;
    children?: ProductGroup[];
    expanded?: boolean;
    // For service nodes: list of product type IDs this service applies to
    applicableProductTypeIds?: string[];
}

type DisplayMode = 'products' | 'employees';

export function CommissionsPage() {
    const { products, services, loading, fetchProducts, fetchServices, updateProduct, updateService } = useProducts();
    const { productTypes, fetchProductTypes } = useProductTypes();
    const { users, fetchUsers, updateUser } = useUsers();

    // Inline editing state: { id, value } of the cell currently being edited
    const [editingCommission, setEditingCommission] = useState<{ id: string; value: string } | null>(null);

    const [displayMode, setDisplayMode] = useState<DisplayMode>('products');
    const [searchTerm, setSearchTerm] = useState('');
    const [searchCodeTerm, setSearchCodeTerm] = useState('');
    const [searchNameTerm, setSearchNameTerm] = useState('');
    const [commissionTables, setCommissionTables] = useState(defaultCommissionTables);
    const [commissionTableSearch, setCommissionTableSearch] = useState('');
    const [productGroups, setProductGroups] = useState<ProductGroup[]>([{ id: 'all', name: 'Tất cả' }]);
    const [selectedGroup, setSelectedGroup] = useState('all');
    const [groupSearch, setGroupSearch] = useState('');
    const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
    const [selectAll, setSelectAll] = useState(false);
    const [addTableName, setAddTableName] = useState('');
    const [showAddTable, setShowAddTable] = useState(false);

    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 15;

    useEffect(() => {
        fetchProducts();
        fetchServices();
        fetchProductTypes();
        fetchUsers();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Build product groups from services → each service shows its applicable product types as children
    useEffect(() => {
        if (services.length > 0 || productTypes.length > 0) {
            // Services as flat items (no children)
            const serviceItems: ProductGroup[] = services.map(svc => ({
                id: `svc:${svc.id}`,
                name: svc.name,
                applicableProductTypeIds: svc.applicable_product_types || [],
            }));

            // Product types not linked to any service
            const linkedPtIds = new Set(services.flatMap(s => s.applicable_product_types || []));
            const unlinkedTypes: ProductGroup[] = productTypes
                .filter(pt => !linkedPtIds.has(pt.id))
                .map(pt => ({ id: `pt:${pt.id}`, name: pt.name }));

            const groups: ProductGroup[] = [
                { id: 'all', name: 'Tất cả' },
                ...serviceItems,
                ...(unlinkedTypes.length > 0 ? [{ id: '__divider__', name: '── Loại sản phẩm khác ──' }] : []),
                ...unlinkedTypes,
            ];
            setProductGroups(groups);
        }
    }, [services, productTypes]);

    // Build a lookup: product_type_id → list of service IDs that apply to it
    const ptToServiceIds = useMemo(() => {
        const map = new Map<string, string[]>();
        services.forEach(svc => {
            (svc.applicable_product_types || []).forEach(ptId => {
                if (!map.has(ptId)) map.set(ptId, []);
                map.get(ptId)!.push(svc.id);
            });
        });
        return map;
    }, [services]);

    // Combine products and services for display
    const allItems = useMemo(() => {
        const items = [
            ...products.map(p => ({
                id: p.id,
                code: p.code,
                name: p.name,
                unit: p.unit || '',
                price: p.price || 0,
                cost: p.cost || 0,
                category: p.category || '',
                commissionRate: 1, // Default commission rate
                // Which service IDs this product belongs to (through its category/product type)
                serviceIds: p.category ? (ptToServiceIds.get(p.category) || []) : [],
            })),
            ...services.map(s => ({
                id: s.id,
                code: s.code,
                name: s.name,
                unit: '',
                price: s.price || 0,
                cost: 0,
                category: s.category || '',
                commissionRate: s.commission_rate || 1,
                serviceIds: [s.id], // A service item matches itself
            })),
        ];
        return items;
    }, [products, services, ptToServiceIds]);

    // Filter items
    const filteredItems = useMemo(() => {
        let items = allItems;

        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            items = items.filter(item =>
                item.code.toLowerCase().includes(term) ||
                item.name.toLowerCase().includes(term)
            );
        }

        if (searchCodeTerm) {
            items = items.filter(item =>
                item.code.toLowerCase().includes(searchCodeTerm.toLowerCase())
            );
        }

        if (searchNameTerm) {
            items = items.filter(item =>
                item.name.toLowerCase().includes(searchNameTerm.toLowerCase())
            );
        }

        if (selectedGroup && selectedGroup !== 'all') {
            if (selectedGroup.startsWith('svc:')) {
                // Filter by service: show items whose category is in this service's applicable product types
                const svcId = selectedGroup.replace('svc:', '');
                const svc = services.find(s => s.id === svcId);
                const applicablePtIds = svc?.applicable_product_types || [];
                if (applicablePtIds.length > 0) {
                    items = items.filter(item =>
                        applicablePtIds.includes(item.category) || item.serviceIds.includes(svcId)
                    );
                } else {
                    // Service with no applicable types, only show the service itself
                    items = items.filter(item => item.serviceIds.includes(svcId));
                }
            } else if (selectedGroup.startsWith('pt:')) {
                // Filter by product type
                const ptId = selectedGroup.replace('pt:', '');
                items = items.filter(item => item.category === ptId);
            }
        }

        return items;
    }, [allItems, searchTerm, searchCodeTerm, searchNameTerm, selectedGroup, services]);

    // Pagination
    const totalPages = Math.ceil(filteredItems.length / itemsPerPage);
    const paginatedItems = filteredItems.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    );

    const toggleCommissionTable = (id: string) => {
        setCommissionTables(prev =>
            prev.map(t => t.id === id ? { ...t, checked: !t.checked } : t)
        );
    };

    const toggleGroupExpand = (id: string) => {
        setProductGroups(prev =>
            prev.map(g => g.id === id ? { ...g, expanded: !g.expanded } : g)
        );
    };

    const toggleSelectItem = (id: string) => {
        setSelectedItems(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const toggleSelectAll = () => {
        if (selectAll) {
            setSelectedItems(new Set());
        } else {
            setSelectedItems(new Set(paginatedItems.map(i => i.id)));
        }
        setSelectAll(!selectAll);
    };

    const handleAddTable = () => {
        if (!addTableName.trim()) return;
        const newTable: CommissionTable = {
            id: `custom-${Date.now()}`,
            name: addTableName,
            type: 'common',
            checked: false,
        };
        setCommissionTables(prev => [...prev, newTable]);
        setAddTableName('');
        setShowAddTable(false);
    };

    // Save commission rate for a product or service
    const handleSaveProductCommission = async (itemId: string, value: string) => {
        const rate = parseFloat(value);
        if (isNaN(rate) || rate < 0) {
            setEditingCommission(null);
            return;
        }

        try {
            // Check if item is a service or product
            const isService = services.some(s => s.id === itemId);
            if (isService) {
                await updateService(itemId, { commission_rate: rate });
            } else {
                await updateProduct(itemId, { commission_sale: rate });
            }
            toast.success('Đã cập nhật hoa hồng');
        } catch {
            toast.error('Lỗi khi cập nhật hoa hồng');
        }
        setEditingCommission(null);
    };

    // Save commission rate for an employee
    const handleSaveEmployeeCommission = async (userId: string, value: string) => {
        const rate = parseFloat(value);
        if (isNaN(rate) || rate < 0) {
            setEditingCommission(null);
            return;
        }

        try {
            await updateUser(userId, { commission: rate });
            toast.success('Đã cập nhật hoa hồng nhân viên');
        } catch {
            toast.error('Lỗi khi cập nhật hoa hồng');
        }
        setEditingCommission(null);
    };

    if (loading && allItems.length === 0) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="flex h-[calc(100vh-6rem)] bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
            {/* Left Sidebar */}
            <div className="w-[220px] border-r border-gray-200 bg-[#fbfcfd] flex flex-col flex-shrink-0 overflow-hidden">
                <div className="p-4 pb-2">
                    <h1 className="text-[16px] font-bold text-gray-900 tracking-tight">Bảng hoa hồng</h1>
                </div>

                <div className="flex-1 overflow-y-auto px-4 pb-4">
                    {/* Display Mode */}
                    <div className="mb-5">
                        <h3 className="text-[12px] font-semibold text-gray-500 uppercase tracking-wide mb-2.5">Kiểu hiển thị</h3>
                        <div className="space-y-2">
                            <label className="flex items-center gap-2.5 cursor-pointer">
                                <input
                                    type="radio"
                                    className="w-[15px] h-[15px] text-blue-600 border-gray-300 focus:ring-blue-500 cursor-pointer"
                                    name="displayMode"
                                    value="products"
                                    checked={displayMode === 'products'}
                                    onChange={() => setDisplayMode('products')}
                                />
                                <span className={displayMode === 'products' ? "text-[13px] text-blue-600 font-medium" : "text-[13px] text-gray-700"}>
                                    Hàng hóa
                                </span>
                            </label>
                            <label className="flex items-center gap-2.5 cursor-pointer">
                                <input
                                    type="radio"
                                    className="w-[15px] h-[15px] text-blue-600 border-gray-300 focus:ring-blue-500 cursor-pointer"
                                    name="displayMode"
                                    value="employees"
                                    checked={displayMode === 'employees'}
                                    onChange={() => setDisplayMode('employees')}
                                />
                                <span className={displayMode === 'employees' ? "text-[13px] text-blue-600 font-medium" : "text-[13px] text-gray-700"}>
                                    Nhân viên áp dụng
                                </span>
                            </label>
                        </div>
                    </div>

                    {/* Commission Tables */}
                    <div className="mb-5">
                        <h3 className="text-[12px] font-semibold text-gray-500 uppercase tracking-wide mb-2.5">Bảng hoa hồng</h3>
                        <div className="relative mb-2">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-[13px] w-[13px] text-gray-400" />
                            <input
                                type="text"
                                className="w-full pl-7 pr-3 h-[30px] text-[12px] border border-gray-200 rounded-md bg-white placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                placeholder="Tìm kiếm bảng hoa hồng"
                                value={commissionTableSearch}
                                onChange={(e) => setCommissionTableSearch(e.target.value)}
                            />
                        </div>
                        <div className="space-y-1.5">
                            {commissionTables
                                .filter(t => !commissionTableSearch || t.name.toLowerCase().includes(commissionTableSearch.toLowerCase()))
                                .map(table => (
                                    <label key={table.id} className="flex items-center gap-2 cursor-pointer group">
                                        <Checkbox
                                            checked={table.checked}
                                            onCheckedChange={() => toggleCommissionTable(table.id)}
                                            className="h-[15px] w-[15px] rounded border-gray-300"
                                        />
                                        <span className="text-[12px] text-gray-700 group-hover:text-gray-900 truncate">{table.name}</span>
                                    </label>
                                ))
                            }
                        </div>
                        <button
                            onClick={() => setShowAddTable(true)}
                            className="flex items-center gap-1.5 mt-2.5 text-[12px] text-gray-500 hover:text-blue-600 transition-colors cursor-pointer"
                        >
                            <Plus className="h-3.5 w-3.5" />
                            Thêm bảng
                        </button>
                        {showAddTable && (
                            <div className="mt-2 flex gap-1">
                                <input
                                    type="text"
                                    className="flex-1 h-[28px] px-2 text-[11px] border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                                    placeholder="Tên bảng..."
                                    value={addTableName}
                                    onChange={(e) => setAddTableName(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleAddTable()}
                                    autoFocus
                                />
                                <button onClick={handleAddTable} className="px-2 h-[28px] text-[11px] bg-blue-600 text-white rounded hover:bg-blue-700">
                                    Lưu
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Product Groups */}
                    <div>
                        <h3 className="text-[12px] font-semibold text-gray-500 uppercase tracking-wide mb-2.5">Nhóm hàng</h3>
                        <div className="relative mb-2">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-[13px] w-[13px] text-gray-400" />
                            <input
                                type="text"
                                className="w-full pl-7 pr-3 h-[30px] text-[12px] border border-gray-200 rounded-md bg-white placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                placeholder="Tìm kiếm nhóm hàng"
                                value={groupSearch}
                                onChange={(e) => setGroupSearch(e.target.value)}
                            />
                        </div>
                        <div className="space-y-0.5">
                            {productGroups
                                .filter(g => g.id === '__divider__' || !groupSearch || g.name.toLowerCase().includes(groupSearch.toLowerCase()))
                                .map(group => (
                                    <div key={group.id}>
                                        {group.id === '__divider__' ? (
                                            <div className="text-[10px] text-gray-400 uppercase tracking-wider py-2 px-1.5 select-none">
                                                {group.name}
                                            </div>
                                        ) : (
                                        <button
                                            className={`w-full flex items-center gap-1.5 px-1.5 py-[5px] rounded text-left cursor-pointer transition-colors ${
                                                selectedGroup === group.id
                                                    ? 'text-blue-600 bg-blue-50 font-medium'
                                                    : 'text-gray-700 hover:bg-gray-100'
                                            }`}
                                            onClick={() => {
                                                setSelectedGroup(group.id);
                                                if (group.children && group.children.length > 0) toggleGroupExpand(group.id);
                                            }}
                                        >
                                            {group.children && group.children.length > 0 ? (
                                                group.expanded ? (
                                                    <ChevronDown className="h-3.5 w-3.5 flex-shrink-0 text-gray-400" />
                                                ) : (
                                                    <ChevronRight className="h-3.5 w-3.5 flex-shrink-0 text-gray-400" />
                                                )
                                            ) : (
                                                <span className="w-3.5" />
                                            )}
                                            <span className="text-[12px] truncate">{group.name}</span>
                                        </button>
                                        )}
                                        {group.expanded && group.children && group.children.length > 0 && (
                                            <div className="ml-5 space-y-0.5">
                                                {group.children.map(child => (
                                                    <button
                                                        key={child.id}
                                                        className={`w-full text-left px-1.5 py-[4px] rounded text-[11px] cursor-pointer transition-colors ${
                                                            selectedGroup === child.id
                                                                ? 'text-blue-600 bg-blue-50 font-medium'
                                                                : 'text-gray-600 hover:bg-gray-50'
                                                        }`}
                                                        onClick={() => setSelectedGroup(child.id)}
                                                    >
                                                        {child.name}
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                ))
                            }
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 flex flex-col min-w-0 bg-white">
                {/* Top Bar */}
                <div className="flex items-center justify-between p-3 border-b border-gray-100 bg-[#fbfcfd] gap-3">
                    <div className="flex-1 relative max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-[45%] h-[15px] w-[15px] text-gray-400" />
                        <Input
                            className="w-full pl-[34px] h-[36px] border-gray-200 text-[13px] placeholder:text-gray-400 bg-white shadow-sm rounded-lg focus-visible:ring-1 focus-visible:ring-blue-500"
                            placeholder="Thêm hàng hóa vào bảng hoa hồng"
                            value={searchTerm}
                            onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                        />
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            className="h-[36px] px-3.5 border-gray-200 bg-white text-gray-700 text-[13px] font-semibold rounded-lg shadow-sm hover:bg-gray-50 flex items-center gap-1.5"
                        >
                            <Download className="h-[15px] w-[15px] text-gray-500" />
                            Import
                        </Button>
                        <Button
                            variant="outline"
                            className="h-[36px] px-3.5 text-blue-600 border border-blue-200 bg-white hover:bg-blue-50 text-[13px] font-semibold rounded-lg shadow-sm flex items-center gap-1.5"
                        >
                            <Upload className="h-[15px] w-[15px]" />
                            Xuất file
                        </Button>
                    </div>
                </div>

                {/* Table */}
                <div className="flex-1 overflow-auto">
                    {displayMode === 'products' ? (
                        <table className="w-full text-left border-collapse whitespace-nowrap">
                            <thead className="bg-[#f2f6ff] sticky top-0 z-10">
                                <tr>
                                    <th className="px-4 py-3 font-semibold text-gray-700 w-10 border-b border-gray-100">
                                        <input
                                            type="checkbox"
                                            className="w-[14px] h-[14px] rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                            checked={selectAll}
                                            onChange={toggleSelectAll}
                                        />
                                    </th>
                                    <th className="px-4 py-3 font-bold text-[11px] text-gray-900 border-b border-gray-100 tracking-wide min-w-[120px]">
                                        MÃ HÀNG
                                    </th>
                                    <th className="px-4 py-3 font-bold text-[11px] text-gray-900 border-b border-gray-100 tracking-wide min-w-[300px]">
                                        TÊN HÀNG
                                    </th>
                                    <th className="px-4 py-3 font-bold text-[11px] text-gray-900 border-b border-gray-100 tracking-wide text-center">
                                        ĐƠN VỊ TÍNH
                                    </th>
                                    <th className="px-4 py-3 font-bold text-[11px] text-gray-900 border-b border-gray-100 tracking-wide text-right">
                                        GIÁ BÁN CHUNG
                                    </th>
                                    <th className="px-4 py-3 font-bold text-[11px] text-gray-900 border-b border-gray-100 tracking-wide text-right">
                                        GIÁ VỐN
                                    </th>
                                    <th className="px-4 py-3 font-bold text-[11px] text-gray-900 border-b border-gray-100 tracking-wide text-right">
                                        LỢI NHUẬN TẠM TÍNH
                                    </th>
                                    <th className="px-4 py-3 font-bold text-[11px] text-gray-900 border-b border-gray-100 tracking-wide text-right">
                                        BẢNG HOA HỒNG CHUNG
                                    </th>
                                </tr>
                                {/* Sub-header filters */}
                                <tr className="bg-white">
                                    <th className="px-4 py-1.5 border-b border-gray-100"></th>
                                    <th className="px-4 py-1.5 border-b border-gray-100">
                                        <input
                                            type="text"
                                            className="w-full h-[28px] px-2 text-[12px] border border-gray-200 rounded bg-white placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                            placeholder="Tìm kiếm mã hàng"
                                            value={searchCodeTerm}
                                            onChange={(e) => { setSearchCodeTerm(e.target.value); setCurrentPage(1); }}
                                        />
                                    </th>
                                    <th className="px-4 py-1.5 border-b border-gray-100">
                                        <input
                                            type="text"
                                            className="w-full h-[28px] px-2 text-[12px] border border-gray-200 rounded bg-white placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                            placeholder="Tìm kiếm tên hàng"
                                            value={searchNameTerm}
                                            onChange={(e) => { setSearchNameTerm(e.target.value); setCurrentPage(1); }}
                                        />
                                    </th>
                                    <th className="px-4 py-1.5 border-b border-gray-100"></th>
                                    <th className="px-4 py-1.5 border-b border-gray-100"></th>
                                    <th className="px-4 py-1.5 border-b border-gray-100"></th>
                                    <th className="px-4 py-1.5 border-b border-gray-100"></th>
                                    <th className="px-4 py-1.5 border-b border-gray-100"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {paginatedItems.map((item) => {
                                    const profit = item.price - item.cost;
                                    return (
                                        <tr
                                            key={item.id}
                                            className="hover:bg-blue-50/30 cursor-pointer transition-colors"
                                        >
                                            <td className="px-4 py-[11px]">
                                                <input
                                                    type="checkbox"
                                                    className="w-[14px] h-[14px] rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                                    checked={selectedItems.has(item.id)}
                                                    onChange={() => toggleSelectItem(item.id)}
                                                />
                                            </td>
                                            <td className="px-4 py-[11px] text-gray-800 font-medium text-[13px]">
                                                {item.code}
                                            </td>
                                            <td className="px-4 py-[11px] text-blue-600 font-medium text-[13px] uppercase">
                                                {item.name}
                                            </td>
                                            <td className="px-4 py-[11px] text-gray-600 text-[13px] text-center">
                                                {item.unit || ''}
                                            </td>
                                            <td className="px-4 py-[11px] text-gray-800 text-[13px] font-medium text-right">
                                                {item.price > 0 ? formatNumber(item.price) : ''}
                                            </td>
                                            <td className="px-4 py-[11px] text-gray-800 text-[13px] text-right">
                                                {item.cost > 0 ? formatNumber(item.cost) : '0'}
                                            </td>
                                            <td className="px-4 py-[11px] text-gray-800 text-[13px] font-medium text-right">
                                                {item.price > 0 ? formatNumber(profit) : ''}
                                            </td>
                                            <td className="px-4 py-[11px] text-right">
                                                {editingCommission?.id === item.id ? (
                                                    <input
                                                        type="number"
                                                        className="w-[60px] h-[26px] px-2 text-[13px] text-right border border-blue-400 rounded bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium text-blue-600"
                                                        value={editingCommission.value}
                                                        onChange={(e) => setEditingCommission({ id: item.id, value: e.target.value })}
                                                        onBlur={() => handleSaveProductCommission(item.id, editingCommission.value)}
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter') handleSaveProductCommission(item.id, editingCommission.value);
                                                            if (e.key === 'Escape') setEditingCommission(null);
                                                        }}
                                                        autoFocus
                                                        min={0}
                                                        step={0.1}
                                                    />
                                                ) : (
                                                    <span
                                                        className="inline-flex items-center gap-1 text-[13px] text-blue-600 font-medium cursor-pointer hover:bg-blue-50 px-2 py-0.5 rounded transition-colors"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setEditingCommission({ id: item.id, value: String(item.commissionRate) });
                                                        }}
                                                    >
                                                        {item.commissionRate}
                                                        <span className="text-gray-500">%</span>
                                                    </span>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                                {paginatedItems.length === 0 && (
                                    <tr>
                                        <td colSpan={8} className="px-4 py-8 text-center text-[13px] text-gray-500">
                                            Không tìm thấy hàng hóa nào
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    ) : (
                        /* Employee display mode */
                        <table className="w-full text-left border-collapse whitespace-nowrap">
                            <thead className="bg-[#f2f6ff] sticky top-0 z-10">
                                <tr>
                                    <th className="px-4 py-3 font-semibold text-gray-700 w-10 border-b border-gray-100">
                                        <input
                                            type="checkbox"
                                            className="w-[14px] h-[14px] rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                        />
                                    </th>
                                    <th className="px-4 py-3 font-bold text-[11px] text-gray-900 border-b border-gray-100 tracking-wide">
                                        MÃ NHÂN VIÊN
                                    </th>
                                    <th className="px-4 py-3 font-bold text-[11px] text-gray-900 border-b border-gray-100 tracking-wide">
                                        TÊN NHÂN VIÊN
                                    </th>
                                    <th className="px-4 py-3 font-bold text-[11px] text-gray-900 border-b border-gray-100 tracking-wide">
                                        CHỨC DANH
                                    </th>
                                    <th className="px-4 py-3 font-bold text-[11px] text-gray-900 border-b border-gray-100 tracking-wide text-right">
                                        BẢNG HOA HỒNG ÁP DỤNG
                                    </th>
                                    <th className="px-4 py-3 font-bold text-[11px] text-gray-900 border-b border-gray-100 tracking-wide text-right">
                                        % HOA HỒNG
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {users
                                    .filter(u => u.status === 'active')
                                    .map((user, idx) => (
                                        <tr key={user.id} className="hover:bg-blue-50/30 cursor-pointer transition-colors">
                                            <td className="px-4 py-[11px]">
                                                <input
                                                    type="checkbox"
                                                    className="w-[14px] h-[14px] rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                                />
                                            </td>
                                            <td className="px-4 py-[11px] text-gray-800 font-medium text-[13px]">
                                                {(user as any).employee_code || `NV${String(idx + 1).padStart(3, '0')}`}
                                            </td>
                                            <td className="px-4 py-[11px] text-gray-800 font-medium text-[13px] uppercase">
                                                {user.name}
                                            </td>
                                            <td className="px-4 py-[11px] text-gray-600 text-[13px]">
                                                {user.role === 'sale' ? 'Nhân viên bán hàng' :
                                                    user.role === 'technician' ? 'Kỹ thuật viên' :
                                                        user.role === 'manager' ? 'Quản lý' :
                                                            user.role === 'accountant' ? 'Kế toán' :
                                                                user.role === 'admin' ? 'Admin' : user.role}
                                            </td>
                                            <td className="px-4 py-[11px] text-gray-600 text-[13px] text-right">
                                                Bảng hoa hồng chung
                                            </td>
                                            <td className="px-4 py-[11px] text-right">
                                                {editingCommission?.id === user.id ? (
                                                    <input
                                                        type="number"
                                                        className="w-[60px] h-[26px] px-2 text-[13px] text-right border border-blue-400 rounded bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium text-blue-600"
                                                        value={editingCommission.value}
                                                        onChange={(e) => setEditingCommission({ id: user.id, value: e.target.value })}
                                                        onBlur={() => handleSaveEmployeeCommission(user.id, editingCommission.value)}
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter') handleSaveEmployeeCommission(user.id, editingCommission.value);
                                                            if (e.key === 'Escape') setEditingCommission(null);
                                                        }}
                                                        autoFocus
                                                        min={0}
                                                        step={0.1}
                                                    />
                                                ) : (
                                                    <span
                                                        className="inline-flex items-center gap-1 text-[13px] text-blue-600 font-medium cursor-pointer hover:bg-blue-50 px-2 py-0.5 rounded transition-colors"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setEditingCommission({ id: user.id, value: String((user as any).commission || 1) });
                                                        }}
                                                    >
                                                        {(user as any).commission || 1}
                                                        <span className="text-gray-500">%</span>
                                                    </span>
                                                )}
                                            </td>
                                        </tr>
                                    ))
                                }
                                {users.filter(u => u.status === 'active').length === 0 && (
                                    <tr>
                                        <td colSpan={6} className="px-4 py-8 text-center text-[13px] text-gray-500">
                                            Không tìm thấy nhân viên nào
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    )}
                </div>

                {/* Pagination */}
                {displayMode === 'products' && (
                    <div className="flex items-center justify-between px-4 py-2.5 border-t border-gray-100 bg-[#fbfcfd] text-[12px] text-gray-600">
                        <div className="flex items-center gap-1.5">
                            <button
                                className="px-2 py-1 rounded hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                onClick={() => setCurrentPage(1)}
                                disabled={currentPage === 1}
                            >
                                ⏮
                            </button>
                            <button
                                className="px-2 py-1 rounded hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                disabled={currentPage === 1}
                            >
                                ◀
                            </button>
                            <span className="px-3 py-1 bg-white border border-gray-200 rounded text-[12px] font-medium min-w-[32px] text-center">
                                {currentPage}
                            </span>
                            <button
                                className="px-2 py-1 rounded hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                disabled={currentPage === totalPages || totalPages === 0}
                            >
                                ▶
                            </button>
                            <button
                                className="px-2 py-1 rounded hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                onClick={() => setCurrentPage(totalPages)}
                                disabled={currentPage === totalPages || totalPages === 0}
                            >
                                ⏭
                            </button>
                        </div>
                        <span className="text-gray-500">
                            {filteredItems.length > 0
                                ? `${(currentPage - 1) * itemsPerPage + 1} - ${Math.min(currentPage * itemsPerPage, filteredItems.length)} trong ${filteredItems.length} hàng hóa`
                                : '0 hàng hóa'
                            }
                        </span>
                    </div>
                )}
            </div>
        </div>
    );
}

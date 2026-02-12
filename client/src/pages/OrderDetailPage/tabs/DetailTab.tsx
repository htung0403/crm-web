import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Package, Gift, ShoppingBag, CreditCard, Printer,
    Wrench, User as UserIcon, FileText, Clock, CheckCircle,
    Sparkles, X, Calendar
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TabsContent } from '@/components/ui/tabs';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { formatCurrency, formatDateTime, cn } from '@/lib/utils';
import { ProductStatusCard } from '@/components/orders/ProductStatusCard';
import { columns } from '@/components/orders/constants';
import type { Order, OrderItem } from '@/hooks/useOrders';
import {
    getItemTypeLabel,
    getItemTypeColor,
    getCustomerProductTypeLabel,
    getStatusVariant,
} from '../utils';

interface DetailTabProps {
    order: Order;
    productStatusSummary: any;
    onShowPrintDialog: () => void;
    onShowPaymentDialog: () => void;
}

export function DetailTab({ order, productStatusSummary, onShowPrintDialog, onShowPaymentDialog }: DetailTabProps) {
    const navigate = useNavigate();
    const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);

    return (
        <TabsContent value="detail">
            {/* Main Content - 2 Column Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left Column - Order Items (2/3) */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Customer Info */}
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base flex items-center gap-2">
                                <UserIcon className="h-4 w-4 text-primary" />
                                Thông tin khách hàng
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="flex items-center gap-4">
                                <Avatar className="h-14 w-14">
                                    <AvatarFallback className="bg-primary text-white text-lg">
                                        {order.customer?.name?.charAt(0) || 'C'}
                                    </AvatarFallback>
                                </Avatar>
                                <div className="flex-1">
                                    <p className="font-semibold text-lg">{order.customer?.name || 'N/A'}</p>
                                    <p className="text-muted-foreground">{order.customer?.phone || 'Không có SĐT'}</p>
                                </div>
                                {order.customer && (
                                    <Button variant="outline" size="sm" onClick={() => navigate(`/customers?id=${order.customer?.id}`)}>
                                        Xem hồ sơ
                                    </Button>
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Items Table */}
                    {order.items && order.items.length > 0 && (() => {
                        type ItemGroup = { product: OrderItem | null; services: OrderItem[] };
                        const groups: ItemGroup[] = [];
                        let i = 0;
                        while (i < order.items!.length) {
                            const item = order.items![i] as OrderItem & { is_customer_item?: boolean };
                            if (item.is_customer_item && item.item_type === 'product') {
                                const services: OrderItem[] = [];
                                let j = i + 1;
                                while (j < order.items!.length) {
                                    const next = order.items![j] as OrderItem & { is_customer_item?: boolean };
                                    if (next.is_customer_item && next.item_type === 'product') break;
                                    services.push(order.items![j]);
                                    j++;
                                }
                                groups.push({ product: item, services });
                                i = j;
                            } else {
                                groups.push({ product: null, services: [item] });
                                i++;
                            }
                        }
                        if (groups.length === 0) return null;
                        return (
                            <Card>
                                <CardHeader className="pb-3">
                                    <CardTitle className="text-base flex items-center gap-2">
                                        <Package className="h-4 w-4 text-primary" />
                                        Chi tiết sản phẩm/dịch vụ
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="p-0">
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm table-fixed">
                                            <thead className="bg-muted/50">
                                                <tr>
                                                    <th className="text-left p-4 font-medium w-[72px] min-w-[72px]">Ảnh</th>
                                                    <th className="text-left p-4 font-medium">Loại</th>
                                                    <th className="text-left p-4 font-medium">Tên</th>
                                                    <th className="text-center p-4 font-medium">SL</th>
                                                    <th className="text-right p-4 font-medium">Đơn giá</th>
                                                    <th className="text-right p-4 font-medium">Thành tiền</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y">
                                                {groups.map((group, gi) => {
                                                    if (group.product) {
                                                        const product = group.product;
                                                        const servicesTotal = group.services.reduce((sum, s) => sum + (s.total_price || 0), 0);
                                                        return (
                                                            <React.Fragment key={gi}>
                                                                <tr className="bg-muted/20 hover:bg-muted/30 border-l-2 border-l-primary">
                                                                    <td className="p-4 align-top w-[72px]">
                                                                        {(product.product?.image || (product as any).product?.image) ? (
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => setImagePreviewUrl((product.product?.image || (product as any).product?.image) as string)}
                                                                                className="w-12 h-12 shrink-0 rounded-lg overflow-hidden border bg-muted flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1"
                                                                            >
                                                                                <img src={(product.product?.image || (product as any).product?.image) as string} alt={product.item_name} className="w-full h-full object-contain" />
                                                                            </button>
                                                                        ) : (
                                                                            <div className="w-12 h-12 shrink-0 rounded-lg bg-muted flex items-center justify-center">
                                                                                <ShoppingBag className="h-5 w-5 text-muted-foreground" />
                                                                            </div>
                                                                        )}
                                                                    </td>
                                                                    <td className="p-4 align-top">
                                                                        <Badge className={getItemTypeColor('product')}>
                                                                            {getCustomerProductTypeLabel((product as any).product_type)}
                                                                        </Badge>
                                                                    </td>
                                                                    <td className="p-4 font-medium align-top">
                                                                        <div>{product.item_name}</div>
                                                                        {(product as any).sales?.length > 0 && (
                                                                            <div className="flex flex-wrap gap-1 mt-1">
                                                                                {(product as any).sales.map((s: any, idx: number) => (
                                                                                    <Badge key={idx} variant="outline" className="text-[10px] py-0 h-4 bg-amber-50 text-amber-700 border-amber-200">
                                                                                        Sale: {s.sale?.name || s.name} ({s.commission}%)
                                                                                    </Badge>
                                                                                ))}
                                                                            </div>
                                                                        )}
                                                                    </td>
                                                                    <td className="p-4 text-center align-top">{product.quantity}</td>
                                                                    <td className="p-4 text-right text-muted-foreground align-top">—</td>
                                                                    <td className="p-4 text-right font-semibold align-top">
                                                                        {group.services.length > 0 ? formatCurrency(servicesTotal) : '—'}
                                                                    </td>
                                                                </tr>
                                                                {group.services.map((svc, si) => (
                                                                    <tr key={`${gi}-s-${si}`} className="hover:bg-muted/30">
                                                                        <td className="p-4 pl-8 w-[72px]">
                                                                            {(svc.service?.image || svc.product?.image || (svc as any).product?.image) ? (
                                                                                <button
                                                                                    type="button"
                                                                                    onClick={() => setImagePreviewUrl((svc.service?.image || svc.product?.image || (svc as any).product?.image) as string)}
                                                                                    className="w-10 h-10 shrink-0 rounded-lg overflow-hidden border bg-muted flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1"
                                                                                >
                                                                                    <img src={(svc.service?.image || svc.product?.image || (svc as any).product?.image) as string} alt={svc.item_name} className="w-full h-full object-contain" />
                                                                                </button>
                                                                            ) : (
                                                                                <div className="w-10 h-10 shrink-0 rounded-lg bg-muted flex items-center justify-center">
                                                                                    <Wrench className="h-4 w-4 text-muted-foreground" />
                                                                                </div>
                                                                            )}
                                                                        </td>
                                                                        <td className="p-4 pl-8">
                                                                            <Badge className={getItemTypeColor(svc.item_type)}>
                                                                                {getItemTypeLabel(svc.item_type)}
                                                                            </Badge>
                                                                        </td>
                                                                        <td className="p-4 pl-8 text-muted-foreground">
                                                                            <div>{svc.item_name}</div>
                                                                            {((svc as any).technicians?.length > 0 || (svc as any).technician) && (
                                                                                <div className="flex flex-wrap gap-1 mt-1">
                                                                                    {(svc as any).technicians?.length > 0 ? (svc as any).technicians.map((t: any, idx: number) => (
                                                                                        <Badge key={idx} variant="outline" className="text-[10px] py-0 h-4 bg-blue-50 text-blue-700 border-blue-200">
                                                                                            KT: {t.technician?.name || t.name} ({t.commission}%)
                                                                                        </Badge>
                                                                                    )) : (svc as any).technician && (
                                                                                        <Badge variant="outline" className="text-[10px] py-0 h-4 bg-blue-50 text-blue-700 border-blue-200">
                                                                                            KT: {(svc as any).technician.name} ({(svc as any).commission || 0}%)
                                                                                        </Badge>
                                                                                    )}
                                                                                </div>
                                                                            )}
                                                                            {(svc as any).sales?.length > 0 && (
                                                                                <div className="flex flex-wrap gap-1 mt-0.5">
                                                                                    {(svc as any).sales.map((s: any, idx: number) => (
                                                                                        <Badge key={idx} variant="outline" className="text-[10px] py-0 h-4 bg-amber-50 text-amber-700 border-amber-200">
                                                                                            Sale: {s.sale?.name || s.name} ({s.commission}%)
                                                                                        </Badge>
                                                                                    ))}
                                                                                </div>
                                                                            )}
                                                                        </td>
                                                                        <td className="p-4 text-center">{svc.quantity}</td>
                                                                        <td className="p-4 text-right text-muted-foreground">{formatCurrency(svc.unit_price)}</td>
                                                                        <td className="p-4 text-right font-semibold">{formatCurrency(svc.total_price)}</td>
                                                                    </tr>
                                                                ))}
                                                            </React.Fragment>
                                                        );
                                                    }
                                                    const item = group.services[0];
                                                    return (
                                                        <tr key={gi} className="hover:bg-muted/30">
                                                            <td className="p-4 w-[72px]">
                                                                {(item.product?.image || item.service?.image) ? (
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => setImagePreviewUrl((item.product?.image || item.service?.image) as string)}
                                                                        className="w-12 h-12 shrink-0 rounded-lg overflow-hidden border bg-muted flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1"
                                                                    >
                                                                        <img src={item.product?.image || item.service?.image as string} alt={item.item_name} className="w-full h-full object-contain" />
                                                                    </button>
                                                                ) : (
                                                                    <div className="w-12 h-12 shrink-0 rounded-lg bg-muted flex items-center justify-center">
                                                                        {item.item_type === 'product' ? <ShoppingBag className="h-5 w-5 text-muted-foreground" /> :
                                                                            item.item_type === 'service' ? <Wrench className="h-5 w-5 text-muted-foreground" /> :
                                                                                item.item_type === 'package' ? <Gift className="h-5 w-5 text-muted-foreground" /> :
                                                                                    <CreditCard className="h-5 w-5 text-muted-foreground" />}
                                                                    </div>
                                                                )}
                                                            </td>
                                                            <td className="p-4">
                                                                <Badge className={getItemTypeColor(item.item_type)}>
                                                                    {getItemTypeLabel(item.item_type)}
                                                                </Badge>
                                                            </td>
                                                            <td className="p-4 font-medium">
                                                                <div>{item.item_name}</div>
                                                                {((item as any).technicians?.length > 0 || (item as any).technician) && (
                                                                    <div className="flex flex-wrap gap-1 mt-1">
                                                                        {(item as any).technicians?.length > 0 ? (item as any).technicians.map((t: any, idx: number) => (
                                                                            <Badge key={idx} variant="outline" className="text-[10px] py-0 h-4 bg-blue-50 text-blue-700 border-blue-200">
                                                                                KT: {t.technician?.name || t.name} ({t.commission}%)
                                                                            </Badge>
                                                                        )) : (item as any).technician && (
                                                                            <Badge variant="outline" className="text-[10px] py-0 h-4 bg-blue-50 text-blue-700 border-blue-200">
                                                                                KT: {(item as any).technician.name} ({(item as any).commission || 0}%)
                                                                            </Badge>
                                                                        )}
                                                                    </div>
                                                                )}
                                                                {(item as any).sales?.length > 0 && (
                                                                    <div className="flex flex-wrap gap-1 mt-0.5">
                                                                        {(item as any).sales.map((s: any, idx: number) => (
                                                                            <Badge key={idx} variant="outline" className="text-[10px] py-0 h-4 bg-amber-50 text-amber-700 border-amber-200">
                                                                                Sale: {s.sale?.name || s.name} ({s.commission}%)
                                                                            </Badge>
                                                                        ))}
                                                                    </div>
                                                                )}
                                                            </td>
                                                            <td className="p-4 text-center">{item.quantity}</td>
                                                            <td className="p-4 text-right text-muted-foreground">{formatCurrency(item.unit_price)}</td>
                                                            <td className="p-4 text-right font-semibold">{formatCurrency(item.total_price)}</td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                </CardContent>
                            </Card>
                        );
                    })()}

                    {/* Dialog xem ảnh sản phẩm/dịch vụ */}
                    <Dialog open={!!imagePreviewUrl} onOpenChange={(open) => !open && setImagePreviewUrl(null)}>
                        <DialogContent className="max-w-4xl p-0 overflow-hidden">
                            <div className="relative">
                                {imagePreviewUrl && (
                                    <img src={imagePreviewUrl} alt="Xem ảnh" className="w-full h-auto max-h-[85vh] object-contain" />
                                )}
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="absolute top-2 right-2 rounded-full bg-black/50 hover:bg-black/70 text-white"
                                    onClick={() => setImagePreviewUrl(null)}
                                >
                                    <X className="h-5 w-5" />
                                </Button>
                            </div>
                        </DialogContent>
                    </Dialog>

                    {/* Notes */}
                    {order.notes && (
                        <Card>
                            <CardHeader className="pb-3">
                                <CardTitle className="text-base flex items-center gap-2">
                                    <FileText className="h-4 w-4 text-primary" />
                                    Ghi chú
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="text-sm bg-muted/50 p-4 rounded-lg">{order.notes}</p>
                            </CardContent>
                        </Card>
                    )}
                </div>

                {/* Right Column - Summary (1/3) */}
                <div className="lg:col-span-1 space-y-4">
                    {/* Order Summary */}
                    <Card className="border-primary/20">
                        <CardHeader className="pb-3 bg-gradient-to-r from-primary/5 to-primary/10">
                            <CardTitle className="text-base">Tổng đơn hàng</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3 pt-4">
                            <div className="flex justify-between text-sm">
                                <span>Tạm tính:</span>
                                <span className="font-medium">{formatCurrency(order.subtotal)}</span>
                            </div>
                            {order.discount > 0 && (
                                <div className="flex justify-between text-sm text-red-600">
                                    <span className="flex items-center gap-1">
                                        <Gift className="h-3.5 w-3.5" />
                                        Giảm giá{order.discount_type === 'percent' && order.discount_value ? ` (${order.discount_value}%)` : ''}:
                                    </span>
                                    <span className="font-medium">-{formatCurrency(order.discount)}</span>
                                </div>
                            )}
                            {/* Surcharges */}
                            {order.surcharges && Array.isArray(order.surcharges) && order.surcharges.length > 0 && (
                                <>
                                    {order.surcharges.map((surcharge: any, i: number) => (
                                        <div key={i} className="flex justify-between text-sm text-orange-600">
                                            <span className="flex items-center gap-1">
                                                {surcharge.label}{surcharge.is_percent ? ` (${surcharge.value}%)` : ''}:
                                            </span>
                                            <span className="font-medium">+{formatCurrency(surcharge.amount || 0)}</span>
                                        </div>
                                    ))}
                                </>
                            )}
                            {(order.surcharges_amount ?? 0) > 0 && (
                                <div className="flex justify-between text-sm text-orange-600 pt-1 border-t border-dashed">
                                    <span>Tổng phụ phí:</span>
                                    <span className="font-medium">+{formatCurrency(order.surcharges_amount ?? 0)}</span>
                                </div>
                            )}
                            <div className="flex justify-between text-xl font-bold pt-3 border-t">
                                <span>Tổng:</span>
                                <span className="text-primary">{formatCurrency(order.total_amount)}</span>
                            </div>

                            {/* Payment Info */}
                            <div className="pt-3 border-t space-y-2">
                                <div className="flex justify-between text-sm">
                                    <span>Đã thanh toán:</span>
                                    <span className={`font-medium ${(order.paid_amount || 0) >= order.total_amount ? 'text-green-600' : 'text-blue-600'}`}>
                                        {formatCurrency(order.paid_amount || 0)}
                                    </span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span>Còn nợ:</span>
                                    <span className={`font-medium ${(order.remaining_debt || 0) > 0 ? 'text-red-600' : 'text-green-600'}`}>
                                        {formatCurrency(order.remaining_debt || (order.total_amount - (order.paid_amount || 0)))}
                                    </span>
                                </div>
                                <div className="flex justify-between items-center text-sm">
                                    <span>Trạng thái TT:</span>
                                    <Badge
                                        className={
                                            order.payment_status === 'paid' ? 'bg-green-500' :
                                                order.payment_status === 'partial' ? 'bg-yellow-500' :
                                                    'bg-red-500'
                                        }
                                    >
                                        {order.payment_status === 'paid' ? 'Đã thanh toán' :
                                            order.payment_status === 'partial' ? 'Thanh toán một phần' :
                                                'Chưa thanh toán'}
                                    </Badge>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Order Status */}
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base flex items-center gap-2">
                                <CheckCircle className="h-4 w-4 text-primary" />
                                Trạng thái
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex items-center justify-center py-4">
                                <Badge
                                    variant={getStatusVariant(order.status) as 'success' | 'danger' | 'warning' | 'info' | 'purple'}
                                    className="text-base px-4 py-2"
                                >
                                    {columns.find(c => c.id === order.status)?.title}
                                </Badge>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Order Details */}
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base flex items-center gap-2">
                                <Calendar className="h-4 w-4 text-primary" />
                                Thông tin đơn hàng
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div>
                                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Ngày tạo</p>
                                <p className="font-medium flex items-center gap-2">
                                    <Clock className="h-4 w-4 text-muted-foreground" />
                                    {formatDateTime(order.created_at)}
                                </p>
                            </div>
                            <div>
                                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Hoàn thành</p>
                                <p className="font-medium">
                                    {order.completed_at ? formatDateTime(order.completed_at) : 'Chưa hoàn thành'}
                                </p>
                            </div>
                            <div>
                                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Nhân viên phụ trách</p>
                                <div className="flex items-center gap-2 mt-1">
                                    <Avatar className="h-8 w-8">
                                        <AvatarFallback className="text-xs">{order.sales_user?.name?.charAt(0) || 'N'}</AvatarFallback>
                                    </Avatar>
                                    <span className="font-medium">{order.sales_user?.name || 'N/A'}</span>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Product Status Summary for Customer Items */}
                    {productStatusSummary && (
                        <>
                            <ProductStatusCard
                                completionPercentage={productStatusSummary.completion_percentage || 0}
                                overallStatus={productStatusSummary.overall_status || 'pending'}
                                totalSteps={productStatusSummary.total_steps || 0}
                                completedSteps={productStatusSummary.completed_steps || 0}
                                totalDurationMinutes={productStatusSummary.total_duration_minutes}
                                estimatedDurationMinutes={productStatusSummary.estimated_duration_minutes}
                                earliestStartedAt={productStatusSummary.earliest_started_at}
                                latestCompletedAt={productStatusSummary.latest_completed_at}
                            />
                        </>
                    )}

                    {/* Quick Actions */}
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base">Thao tác nhanh</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2">
                            <Button
                                variant="outline"
                                className="w-full justify-start"
                                onClick={onShowPrintDialog}
                            >
                                <Printer className="h-4 w-4 mr-2" />
                                In phiếu QR
                            </Button>
                            {order.status !== 'after_sale' && order.status !== 'cancelled' && (
                                <Button
                                    variant="outline"
                                    className="w-full justify-start"
                                    onClick={() => navigate(`/orders/${order.id}/edit`)}
                                >
                                    <Sparkles className="h-4 w-4 mr-2" />
                                    Chỉnh sửa đơn hàng
                                </Button>
                            )}
                            {order.status === 'in_progress' && (
                                <Button
                                    className="w-full justify-start bg-green-600 hover:bg-green-700"
                                    onClick={onShowPaymentDialog}
                                >
                                    <CreditCard className="h-4 w-4 mr-2" />
                                    Thanh toán ngay
                                </Button>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>

        </TabsContent>
    );
}

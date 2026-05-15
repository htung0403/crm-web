import { Bell, Calendar, LocateFixed, Clock3, ArrowRightLeft } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

const weekDays = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
const weekDates = [13, 14, 15, 16, 17, 18, 19];

export function AttendanceMobilePage() {
    return (
        <div className="min-h-[calc(100vh-8rem)] flex items-start justify-center bg-slate-100 p-3 md:p-6">
            <div className="w-full max-w-[390px] rounded-[34px] bg-[#f4f5f6] shadow-[0_20px_50px_rgba(2,6,23,0.18)] overflow-hidden border border-white">
                <div className="px-5 pt-4 pb-10 bg-[#003e36] text-white rounded-b-[36px]">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <Avatar className="h-11 w-11 border border-white/30">
                                <AvatarImage src="/images/login/handbag.jpg" alt="Nguyen Van An" />
                                <AvatarFallback>NA</AvatarFallback>
                            </Avatar>
                            <div>
                                <p className="text-sm text-emerald-100/90">Xin chào,</p>
                                <p className="text-[30px] leading-[1.1] font-semibold">Nguyễn Văn An</p>
                            </div>
                        </div>
                        <button className="h-10 w-10 rounded-full bg-white/10 border border-white/15 flex items-center justify-center">
                            <Bell className="h-5 w-5 text-emerald-100" />
                        </button>
                    </div>
                </div>

                <div className="px-4 -mt-7 space-y-3 pb-4">
                    <Card className="border-0 shadow-sm">
                        <CardContent className="p-4">
                            <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                                <span>Trạng thái hôm nay</span>
                                <span>...</span>
                            </div>
                            <div className="mt-6 text-center">
                                <span className="inline-flex items-center rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800">
                                    <span className="mr-1.5 h-2 w-2 rounded-full bg-emerald-700" />
                                    Đã check-in
                                </span>
                                <p className="mt-3 text-[48px] leading-none font-bold text-slate-900">08:30</p>
                                <p className="mt-2 text-slate-500">Thứ Sáu, 24/05/2024</p>
                            </div>
                            <div className="mt-6 grid grid-cols-2 gap-2">
                                <Button className="h-12 rounded-xl bg-[#003e36] hover:bg-[#00352f]">
                                    <ArrowRightLeft className="h-4 w-4 mr-2" />
                                    CHECK IN
                                </Button>
                                <Button variant="outline" className="h-12 rounded-xl border-amber-800 text-amber-800 hover:bg-amber-50">
                                    <ArrowRightLeft className="h-4 w-4 mr-2" />
                                    CHECK-OUT
                                </Button>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="border-0 shadow-sm">
                        <CardContent className="p-4">
                            <div className="flex items-start justify-between gap-3">
                                <div className="flex gap-3">
                                    <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center">
                                        <LocateFixed className="h-5 w-5 text-slate-500" />
                                    </div>
                                    <div>
                                        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Vị trí hiện tại</p>
                                        <p className="text-lg leading-[1.2] font-semibold text-slate-900">Tòa nhà Jarviz Building</p>
                                        <p className="text-sm text-slate-500">123 Nguyễn Văn Linh, Quận 7, TP.HCM</p>
                                    </div>
                                </div>
                                <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-500">GPS</span>
                            </div>
                        </CardContent>
                    </Card>

                    <div className="grid grid-cols-2 gap-3">
                        <Card className="border-0 shadow-sm">
                            <CardContent className="p-4">
                                <p className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                                    <Calendar className="h-4 w-4" />
                                    Lịch làm việc
                                </p>
                                <p className="mt-3 text-xs font-semibold text-slate-700">24/05/2024</p>
                                <div className="mt-3 grid grid-cols-7 gap-1 text-center text-xs text-slate-400">
                                    {weekDays.map((d) => <span key={d}>{d}</span>)}
                                </div>
                                <div className="mt-2 grid grid-cols-7 gap-1 text-center text-xs">
                                    {weekDates.map((d) => (
                                        <span
                                            key={d}
                                            className={cn(
                                                "h-6 w-6 mx-auto rounded-full flex items-center justify-center text-slate-500",
                                                d === 17 && "bg-[#002f2a] text-white font-semibold"
                                            )}
                                        >
                                            {d}
                                        </span>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="border-0 shadow-sm">
                            <CardContent className="p-4">
                                <p className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                                    <Clock3 className="h-4 w-4" />
                                    Tổng thời gian
                                </p>
                                <p className="mt-10 text-3xl font-bold text-slate-900">8h 15m</p>
                                <p className="mt-1 text-sm text-slate-500">Hôm nay</p>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>
        </div>
    );
}

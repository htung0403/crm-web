import { Bell, Settings, Search, Menu, LogOut } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import type { User, UserRole } from '@/types';

const roleLabels: Record<UserRole, string> = {
    admin: 'Quản trị viên',
    manager: 'Quản lý',
    accountant: 'Kế toán',
    sale: 'Nhân viên Sale',
    technician: 'Kỹ thuật viên',
};

interface HeaderProps {
    onMenuToggle?: () => void;
    isMobile: boolean;
    currentUser: User;
    onLogout?: () => void;
}

export function Header({ onMenuToggle, isMobile, currentUser, onLogout }: HeaderProps) {
    return (
        <header className="fixed top-0 left-0 right-0 z-40 h-16 border-b bg-white/95 backdrop-blur-sm">
            <div className="flex h-full items-center justify-between px-4 lg:px-6">
                {/* Left section - Logo & Search */}
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-blue-600 text-white font-bold text-lg">
                            C
                        </div>
                        <span className="hidden font-semibold text-lg text-foreground sm:block">
                            CRM<span className="text-primary">Pro</span>
                        </span>
                    </div>

                    {/* Search */}
                    <div className="hidden md:block relative w-64 lg:w-80">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            placeholder="Tìm kiếm khách hàng, đơn hàng..."
                            className="pl-9 bg-muted/50 border-0 focus-visible:ring-1"
                        />
                    </div>
                </div>

                {/* Right section - Notifications & User */}
                <div className="flex items-center gap-2">
                    {/* Notifications */}
                    <Button variant="ghost" size="icon" className="relative">
                        <Bell className="h-5 w-5" />
                        <Badge className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-[10px]">
                            3
                        </Badge>
                    </Button>

                    {/* Settings */}
                    <Button variant="ghost" size="icon" className="hidden sm:flex">
                        <Settings className="h-5 w-5" />
                    </Button>

                    {/* User Info */}
                    <div className="flex items-center gap-3 ml-2 pl-3 border-l">
                        <div className="hidden sm:block text-right">
                            <p className="text-sm font-medium">{currentUser.name}</p>
                            <p className="text-xs text-muted-foreground">{roleLabels[currentUser.role]}</p>
                        </div>
                        <Avatar className="h-9 w-9 cursor-pointer ring-2 ring-transparent hover:ring-primary/20 transition-all">
                            <AvatarImage src={currentUser.avatar} alt={currentUser.name} />
                            <AvatarFallback>{currentUser.name.charAt(0)}</AvatarFallback>
                        </Avatar>
                    </div>

                    {/* Logout button */}
                    {onLogout && (
                        <Button variant="ghost" size="icon" onClick={onLogout} className="text-red-500 hover:bg-red-50">
                            <LogOut className="h-5 w-5" />
                        </Button>
                    )}

                    {/* Mobile menu toggle */}
                    {isMobile && (
                        <Button variant="ghost" size="icon" onClick={onMenuToggle} className="ml-2">
                            <Menu className="h-5 w-5" />
                        </Button>
                    )}
                </div>
            </div>
        </header>
    );
}

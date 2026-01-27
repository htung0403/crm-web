import { useState } from 'react';
import { Eye, EyeOff, Lock, Mail, LogIn, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { useAuth } from '@/contexts/AuthContext';

export function LoginPage() {
    const { login, isLoading: authLoading } = useAuth();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [rememberMe, setRememberMe] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (!email || !password) {
            setError('Vui lòng nhập email và mật khẩu');
            return;
        }

        setIsLoading(true);

        try {
            await login(email, password);
            // Redirect happens automatically via AuthContext
        } catch (err: any) {
            const message = err.response?.data?.message || 'Đăng nhập thất bại. Vui lòng thử lại.';
            setError(message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleDemoLogin = async (demoEmail: string) => {
        setEmail(demoEmail);
        setPassword('123456');
        setIsLoading(true);
        setError('');

        try {
            await login(demoEmail, '123456');
        } catch (err: any) {
            const message = err.response?.data?.message || 'Đăng nhập thất bại. Vui lòng thử lại.';
            setError(message);
        } finally {
            setIsLoading(false);
        }
    };

    const demoAccounts = [
        { email: 'manager@demo.com', role: 'Quản lý', name: 'Nguyễn Thị Hương' },
        { email: 'accountant@demo.com', role: 'Kế toán', name: 'Lê Văn Tài' },
        { email: 'sale@demo.com', role: 'Sale', name: 'Trần Văn Minh' },
        { email: 'tech@demo.com', role: 'Kỹ thuật', name: 'Phạm Văn Đức' },
    ];

    const loading = isLoading || authLoading;

    return (
        <div className="min-h-screen flex">
            {/* Left side - Login Form */}
            <div className="flex-1 flex items-center justify-center p-8 bg-white">
                <div className="w-full max-w-md">
                    {/* Logo */}
                    <div className="flex items-center gap-3 mb-8">
                        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-blue-600 text-white font-bold text-2xl shadow-lg shadow-primary/25">
                            C
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-foreground">
                                CRM<span className="text-primary">Pro</span>
                            </h1>
                            <p className="text-sm text-muted-foreground">Hệ thống quản lý doanh nghiệp</p>
                        </div>
                    </div>

                    {/* Welcome Text */}
                    <div className="mb-8">
                        <h2 className="text-3xl font-bold text-foreground mb-2">Đăng nhập</h2>
                        <p className="text-muted-foreground">
                            Chào mừng bạn quay trở lại! Vui lòng đăng nhập để tiếp tục.
                        </p>
                    </div>

                    {/* Login Form */}
                    <form onSubmit={handleSubmit} className="space-y-5">
                        {/* Email */}
                        <div className="space-y-2">
                            <Label htmlFor="email">Email</Label>
                            <div className="relative">
                                <Mail className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                                <Input
                                    id="email"
                                    type="email"
                                    placeholder="name@company.com"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="pl-11 h-12"
                                    disabled={loading}
                                />
                            </div>
                        </div>

                        {/* Password */}
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <Label htmlFor="password">Mật khẩu</Label>
                                <button type="button" className="text-sm text-primary hover:underline">
                                    Quên mật khẩu?
                                </button>
                            </div>
                            <div className="relative">
                                <Lock className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                                <Input
                                    id="password"
                                    type={showPassword ? 'text' : 'password'}
                                    placeholder="••••••••"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="pl-11 pr-11 h-12"
                                    disabled={loading}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                >
                                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                                </button>
                            </div>
                        </div>

                        {/* Remember Me */}
                        <div className="flex items-center space-x-2">
                            <Checkbox
                                id="remember"
                                checked={rememberMe}
                                onCheckedChange={(checked) => setRememberMe(!!checked)}
                            />
                            <Label htmlFor="remember" className="cursor-pointer text-sm">
                                Ghi nhớ đăng nhập
                            </Label>
                        </div>

                        {/* Error Message */}
                        {error && (
                            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-600 text-sm">
                                {error}
                            </div>
                        )}

                        {/* Submit Button */}
                        <Button type="submit" className="w-full h-12 text-base" disabled={loading}>
                            {loading ? (
                                <>
                                    <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                                    Đang đăng nhập...
                                </>
                            ) : (
                                <>
                                    <LogIn className="h-5 w-5 mr-2" />
                                    Đăng nhập
                                </>
                            )}
                        </Button>
                    </form>

                    {/* Demo Accounts */}
                    <div className="mt-8 pt-6 border-t">
                        <p className="text-sm text-muted-foreground mb-3">
                            <span className="font-medium text-foreground">Tài khoản demo:</span> Click để đăng nhập nhanh (mật khẩu: 123456)
                        </p>
                        <div className="grid grid-cols-2 gap-2">
                            {demoAccounts.map((account) => (
                                <button
                                    key={account.email}
                                    type="button"
                                    onClick={() => handleDemoLogin(account.email)}
                                    disabled={loading}
                                    className="p-3 text-left rounded-lg border hover:border-primary hover:bg-primary/5 transition-colors group cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <p className="font-medium text-sm group-hover:text-primary">{account.name}</p>
                                    <p className="text-xs text-muted-foreground">{account.role}</p>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Right side - Hero Image/Illustration */}
            <div className="hidden lg:flex flex-1 bg-gradient-to-br from-primary via-blue-600 to-indigo-700 relative overflow-hidden">
                {/* Background Pattern */}
                <div className="absolute inset-0 opacity-10">
                    <div className="absolute top-0 left-0 w-96 h-96 bg-white rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2"></div>
                    <div className="absolute bottom-0 right-0 w-96 h-96 bg-white rounded-full blur-3xl translate-x-1/2 translate-y-1/2"></div>
                    <div className="absolute top-1/2 left-1/2 w-64 h-64 bg-white rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2"></div>
                </div>

                {/* Content */}
                <div className="relative z-10 flex flex-col justify-center p-12 text-white">
                    <div className="max-w-md">
                        {/* Stats Cards */}
                        <div className="grid grid-cols-2 gap-4 mb-8">
                            <div className="p-4 rounded-xl bg-white/10 backdrop-blur-sm">
                                <p className="text-3xl font-bold">1,500+</p>
                                <p className="text-white/80 text-sm">Khách hàng</p>
                            </div>
                            <div className="p-4 rounded-xl bg-white/10 backdrop-blur-sm">
                                <p className="text-3xl font-bold">50M+</p>
                                <p className="text-white/80 text-sm">Doanh thu/tháng</p>
                            </div>
                            <div className="p-4 rounded-xl bg-white/10 backdrop-blur-sm">
                                <p className="text-3xl font-bold">98%</p>
                                <p className="text-white/80 text-sm">Hài lòng</p>
                            </div>
                            <div className="p-4 rounded-xl bg-white/10 backdrop-blur-sm">
                                <p className="text-3xl font-bold">24/7</p>
                                <p className="text-white/80 text-sm">Hỗ trợ</p>
                            </div>
                        </div>

                        <h2 className="text-3xl font-bold mb-4">
                            Quản lý doanh nghiệp thông minh
                        </h2>
                        <p className="text-white/80 text-lg mb-8">
                            Giải pháp CRM/ERP toàn diện giúp bạn quản lý khách hàng, đơn hàng,
                            tài chính và nhân sự một cách hiệu quả.
                        </p>

                        {/* Features List */}
                        <ul className="space-y-3">
                            {[
                                'Quản lý khách hàng & Leads hiệu quả',
                                'Theo dõi đơn hàng theo thời gian thực',
                                'Báo cáo tài chính chi tiết',
                                'Phân quyền linh hoạt theo vai trò'
                            ].map((feature, i) => (
                                <li key={i} className="flex items-center gap-3">
                                    <div className="h-6 w-6 rounded-full bg-white/20 flex items-center justify-center">
                                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                        </svg>
                                    </div>
                                    <span>{feature}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>

                {/* Decorative Elements */}
                <div className="absolute bottom-8 right-8 text-white/60 text-sm">
                    © 2026 CRMPro. All rights reserved.
                </div>
            </div>
        </div>
    );
}

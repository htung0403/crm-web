import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { Header } from '@/components/layout/Header';
import { Sidebar } from '@/components/layout/Sidebar';
import { LoginPage } from '@/pages/LoginPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { LeadsPage } from '@/pages/LeadsPage';
import { LeadDetailPage } from '@/pages/LeadDetailPage';
import { OrdersPage } from '@/pages/OrdersPage';
import { OrderDetailPage } from '@/pages/OrderDetailPage';
import { InvoicesPage } from '@/pages/InvoicesPage';
import { FinancePage } from '@/pages/FinancePage';
import { ProductsPage } from '@/pages/ProductsPage';
import { EmployeesPage } from '@/pages/EmployeesPage';
import { EmployeeDetailPage } from '@/pages/EmployeeDetailPage';
import { KPIPage } from '@/pages/KPIPage';
import { SalaryPage } from '@/pages/SalaryPage';
import { CustomersPage } from '@/pages/CustomersPage';
import { CustomerDetailPage } from '@/pages/CustomerDetailPage';
import { InteractionsPage } from '@/pages/InteractionsPage';
import { ReportsPage } from '@/pages/ReportsPage';
import { TechnicianPage } from '@/pages/TechnicianPage';
import { TaskQRPage } from '@/pages/TaskQRPage';
import { QRScannerPage } from '@/pages/QRScannerPage';
import { DepartmentsPage } from '@/pages/DepartmentsPage';
import { ProductDetailPage } from '@/pages/ProductDetailPage';
import { WorkflowsPage } from '@/pages/WorkflowsPage';
import { CreateWorkflowPage } from '@/pages/CreateWorkflowPage';
import { CreateServicePage } from '@/pages/CreateServicePage';
import { ProductQRPage } from '@/pages/ProductQRPage';
import { CreateOrderPage } from '@/pages/CreateOrderPage';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import type { UserRole, User } from '@/types';
import { Toaster } from 'sonner';

// Placeholder pages for routes not yet implemented
function PlaceholderPage({ title }: { title: string }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
      <div className="h-20 w-20 rounded-2xl bg-muted flex items-center justify-center mb-4">
        <span className="text-4xl">🚧</span>
      </div>
      <h2 className="text-2xl font-bold text-foreground mb-2">{title}</h2>
      <p className="text-muted-foreground max-w-md">
        Trang này đang được phát triển. Vui lòng quay lại sau.
      </p>
    </div>
  );
}

// Permission configuration
const pagePermissions: Record<string, UserRole[]> = {
  dashboard: ['admin', 'manager', 'accountant', 'sale', 'technician'],
  leads: ['admin', 'manager', 'sale'],
  customers: ['admin', 'manager', 'sale'],
  interactions: ['admin', 'manager', 'sale'],
  orders: ['admin', 'manager', 'accountant', 'sale', 'technician'],
  invoices: ['admin', 'manager', 'accountant', 'sale'],
  income: ['admin', 'manager', 'accountant', 'sale'],
  expense: ['admin', 'manager', 'accountant', 'sale'],
  adjustment: ['admin', 'manager', 'accountant'],
  'product-list': ['admin', 'manager', 'accountant', 'sale', 'technician'],
  services: ['admin', 'manager', 'accountant', 'sale', 'technician'],
  packages: ['admin', 'manager', 'accountant', 'sale', 'technician'],
  vouchers: ['admin', 'manager', 'accountant', 'sale', 'technician'],
  tasks: ['admin', 'manager', 'technician'],
  departments: ['admin', 'manager'],
  workflows: ['admin', 'manager'],
  accessories: ['admin', 'manager', 'technician'],
  extension: ['admin', 'manager', 'technician'],
  upgrade: ['admin', 'manager', 'technician'],
  employees: ['admin', 'manager'],
  kpi: ['admin', 'manager'],
  salary: ['admin', 'manager', 'accountant'],
  reports: ['admin', 'manager', 'accountant'],
  settings: ['admin', 'manager'],
};

// Protected Route Component
function ProtectedRoute({ children, allowedRoles }: { children: React.ReactNode; allowedRoles?: UserRole[] }) {
  const { user, isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="h-12 w-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Đang tải...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (allowedRoles && user && !allowedRoles.includes(user.role)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <div className="h-20 w-20 rounded-2xl bg-red-100 flex items-center justify-center mb-4">
          <span className="text-4xl">🔒</span>
        </div>
        <h2 className="text-2xl font-bold text-foreground mb-2">Không có quyền truy cập</h2>
        <p className="text-muted-foreground max-w-md">
          Bạn không có quyền truy cập trang này. Vui lòng liên hệ quản trị viên.
        </p>
      </div>
    );
  }

  return <>{children}</>;
}

// Wrapper for ProductsPage with routing
function ProductsPageWrapper({ initialTab }: { initialTab: 'products' | 'services' | 'packages' | 'vouchers' }) {
  const navigate = useNavigate();

  const handleTabChange = (tab: string) => {
    navigate(`/${tab}`);
  };

  return <ProductsPage initialTab={initialTab} onTabChange={handleTabChange} />;
}

// Wrapper to inject currentUser from context
function WithCurrentUser({ children }: { children: (user: User) => React.ReactNode }) {
  const { user } = useAuth();
  if (!user) return null;
  return <>{children(user)}</>;
}

// Layout wrapper for authenticated pages
function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 1024);
      if (window.innerWidth >= 1024) {
        setSidebarOpen(false);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  if (!user) return null;

  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar */}
      <Sidebar
        isMobile={isMobile}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        currentUser={user}
        onLogout={handleLogout}
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-h-screen lg:ml-64">
        <Header
          currentUser={user}
          onLogout={handleLogout}
          isMobile={isMobile}
          onMenuToggle={() => setSidebarOpen(true)}
        />
        <main className="flex-1 p-4 md:p-6 lg:p-8 mt-16">
          {children}
        </main>
      </div>
    </div>
  );
}

function AppContent() {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  // Show loading state
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="h-12 w-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Đang tải...</p>
        </div>
      </div>
    );
  }

  // Redirect to login if not authenticated
  if (!isAuthenticated && location.pathname !== '/login') {
    return <Navigate to="/login" replace />;
  }

  // Redirect to dashboard if authenticated and on login page
  if (isAuthenticated && location.pathname === '/login') {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <Routes>
      {/* Public Route */}
      <Route path="/login" element={<LoginPage />} />

      {/* QR Code Route - Accessible by technicians */}
      <Route path="/task/:code" element={
        <ProtectedRoute allowedRoles={['admin', 'manager', 'technician']}>
          <TaskQRPage />
        </ProtectedRoute>
      } />

      {/* Product QR Code Route - For customer products */}
      <Route path="/product/:code" element={
        <ProtectedRoute allowedRoles={['admin', 'manager', 'technician', 'sale']}>
          <ProductQRPage />
        </ProtectedRoute>
      } />

      {/* QR Scanner Route */}
      <Route path="/scan" element={
        <ProtectedRoute allowedRoles={['admin', 'manager', 'technician']}>
          <QRScannerPage />
        </ProtectedRoute>
      } />

      {/* Product/Service/Package Detail Route - Accessible via QR scan */}
      <Route path="/item/:type/:id" element={
        <ProtectedRoute allowedRoles={['admin', 'manager', 'technician', 'sale', 'accountant']}>
          <ProductDetailPage />
        </ProtectedRoute>
      } />

      {/* Protected Routes - All wrapped in AppLayout */}
      <Route path="/*" element={
        <AppLayout>
          <Routes>
            <Route path="/dashboard" element={
              <ProtectedRoute allowedRoles={pagePermissions.dashboard}>
                <WithCurrentUser>
                  {(user) => <DashboardPage currentUser={user} />}
                </WithCurrentUser>
              </ProtectedRoute>
            } />

            <Route path="/leads" element={
              <ProtectedRoute allowedRoles={pagePermissions.leads}>
                <LeadsPage />
              </ProtectedRoute>
            } />

            <Route path="/leads/:id" element={
              <ProtectedRoute allowedRoles={pagePermissions.leads}>
                <LeadDetailPage />
              </ProtectedRoute>
            } />

            <Route path="/customers" element={
              <ProtectedRoute allowedRoles={pagePermissions.customers}>
                <CustomersPage />
              </ProtectedRoute>
            } />

            <Route path="/customers/:id" element={
              <ProtectedRoute allowedRoles={pagePermissions.customers}>
                <CustomerDetailPage />
              </ProtectedRoute>
            } />

            <Route path="/interactions" element={
              <ProtectedRoute allowedRoles={pagePermissions.interactions}>
                <InteractionsPage />
              </ProtectedRoute>
            } />

            <Route path="/orders" element={
              <ProtectedRoute allowedRoles={pagePermissions.orders}>
                <OrdersPage />
              </ProtectedRoute>
            } />

            <Route path="/orders/new" element={
              <ProtectedRoute allowedRoles={pagePermissions.orders}>
                <CreateOrderPage />
              </ProtectedRoute>
            } />

            <Route path="/orders/:id" element={
              <ProtectedRoute allowedRoles={pagePermissions.orders}>
                <OrderDetailPage />
              </ProtectedRoute>
            } />

            <Route path="/invoices" element={
              <ProtectedRoute allowedRoles={pagePermissions.invoices}>
                <WithCurrentUser>
                  {(user) => <InvoicesPage currentUser={user} />}
                </WithCurrentUser>
              </ProtectedRoute>
            } />

            <Route path="/income" element={
              <ProtectedRoute allowedRoles={pagePermissions.income}>
                <WithCurrentUser>
                  {(user) => <FinancePage currentUser={user} />}
                </WithCurrentUser>
              </ProtectedRoute>
            } />

            <Route path="/expense" element={
              <ProtectedRoute allowedRoles={pagePermissions.expense}>
                <WithCurrentUser>
                  {(user) => <FinancePage currentUser={user} />}
                </WithCurrentUser>
              </ProtectedRoute>
            } />

            <Route path="/product-list" element={
              <ProtectedRoute allowedRoles={pagePermissions['product-list']}>
                <ProductsPageWrapper initialTab="products" />
              </ProtectedRoute>
            } />

            <Route path="/services" element={
              <ProtectedRoute allowedRoles={pagePermissions.services}>
                <ProductsPageWrapper initialTab="services" />
              </ProtectedRoute>
            } />

            <Route path="/packages" element={
              <ProtectedRoute allowedRoles={pagePermissions.packages}>
                <ProductsPageWrapper initialTab="packages" />
              </ProtectedRoute>
            } />

            <Route path="/vouchers" element={
              <ProtectedRoute allowedRoles={pagePermissions.vouchers}>
                <ProductsPageWrapper initialTab="vouchers" />
              </ProtectedRoute>
            } />

            <Route path="/employees" element={
              <ProtectedRoute allowedRoles={pagePermissions.employees}>
                <EmployeesPage />
              </ProtectedRoute>
            } />

            <Route path="/employees/:id" element={
              <ProtectedRoute allowedRoles={pagePermissions.employees}>
                <EmployeeDetailPage />
              </ProtectedRoute>
            } />

            <Route path="/kpi" element={
              <ProtectedRoute allowedRoles={pagePermissions.kpi}>
                <KPIPage />
              </ProtectedRoute>
            } />

            <Route path="/salary" element={
              <ProtectedRoute allowedRoles={pagePermissions.salary}>
                <SalaryPage />
              </ProtectedRoute>
            } />

            <Route path="/reports" element={
              <ProtectedRoute allowedRoles={pagePermissions.reports}>
                <ReportsPage />
              </ProtectedRoute>
            } />

            <Route path="/tasks" element={
              <ProtectedRoute allowedRoles={pagePermissions.tasks}>
                <TechnicianPage />
              </ProtectedRoute>
            } />

            <Route path="/departments" element={
              <ProtectedRoute allowedRoles={pagePermissions.departments}>
                <DepartmentsPage />
              </ProtectedRoute>
            } />

            <Route path="/workflows" element={
              <ProtectedRoute allowedRoles={pagePermissions.workflows}>
                <WorkflowsPage />
              </ProtectedRoute>
            } />

            <Route path="/workflows/new" element={
              <ProtectedRoute allowedRoles={pagePermissions.workflows}>
                <CreateWorkflowPage />
              </ProtectedRoute>
            } />

            <Route path="/workflows/:id/edit" element={
              <ProtectedRoute allowedRoles={pagePermissions.workflows}>
                <CreateWorkflowPage />
              </ProtectedRoute>
            } />

            <Route path="/services/new" element={
              <ProtectedRoute allowedRoles={pagePermissions.products}>
                <CreateServicePage />
              </ProtectedRoute>
            } />

            <Route path="/services/:id/edit" element={
              <ProtectedRoute allowedRoles={pagePermissions.products}>
                <CreateServicePage />
              </ProtectedRoute>
            } />

            <Route path="/settings" element={
              <ProtectedRoute allowedRoles={pagePermissions.settings}>
                <PlaceholderPage title="Cài đặt" />
              </ProtectedRoute>
            } />

            {/* Default redirect */}
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </AppLayout>
      } />
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Toaster position="top-right" richColors />
        <AppContent />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;

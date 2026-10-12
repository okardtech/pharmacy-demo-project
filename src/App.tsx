import { lazy, Suspense, type ReactNode } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useStore } from '@/store/store';
import { can, type Perm } from '@/store/rbac';
import { AppShell } from '@/components/layout/AppShell';
import { SkeletonRows } from '@/components/ui';
import Login from '@/pages/common/Login';

const PharmacyDashboard = lazy(() => import('@/pages/pharmacy/Dashboard'));
const POS = lazy(() => import('@/pages/pharmacy/POS'));
const Stock = lazy(() => import('@/pages/pharmacy/Stock'));
const Receive = lazy(() => import('@/pages/pharmacy/Receive'));
const Reports = lazy(() => import('@/pages/pharmacy/Reports'));
const Records = {
  Prescriptions: lazy(() => import('@/pages/pharmacy/Records').then((m) => ({ default: m.Prescriptions }))),
  Controlled: lazy(() => import('@/pages/pharmacy/Records').then((m) => ({ default: m.ControlledRegister }))),
  Destruction: lazy(() => import('@/pages/pharmacy/Records').then((m) => ({ default: m.DestructionPage }))),
  Adr: lazy(() => import('@/pages/pharmacy/Records').then((m) => ({ default: m.AdrPage }))),
  Customers: lazy(() => import('@/pages/pharmacy/Records').then((m) => ({ default: m.Customers }))),
  Suppliers: lazy(() => import('@/pages/pharmacy/Records').then((m) => ({ default: m.Suppliers }))),
};
const Account = {
  License: lazy(() => import('@/pages/pharmacy/Account').then((m) => ({ default: m.LicensePage }))),
  Staff: lazy(() => import('@/pages/pharmacy/Account').then((m) => ({ default: m.Staff }))),
  Settings: lazy(() => import('@/pages/pharmacy/Account').then((m) => ({ default: m.SettingsPage }))),
};
const SyncCenter = lazy(() => import('@/pages/common/SyncCenter'));
const Gallery = lazy(() => import('@/pages/common/Gallery'));
const National = lazy(() => import('@/pages/regulator/National'));
const Registry = lazy(() => import('@/pages/regulator/Registry'));
const PharmacyDetail = lazy(() => import('@/pages/regulator/Registry').then((m) => ({ default: m.PharmacyDetail })));
const Inspections = lazy(() => import('@/pages/regulator/Inspections'));
const RunInspection = lazy(() => import('@/pages/regulator/Inspections').then((m) => ({ default: m.RunInspection })));
const Lic = {
  Register: lazy(() => import('@/pages/regulator/Licensing').then((m) => ({ default: m.RegisterPharmacy }))),
  Renewals: lazy(() => import('@/pages/regulator/Licensing').then((m) => ({ default: m.Renewals }))),
  Catalog: lazy(() => import('@/pages/regulator/Licensing').then((m) => ({ default: m.Catalog }))),
};
const Ov = {
  Corrective: lazy(() => import('@/pages/regulator/Oversight').then((m) => ({ default: m.Corrective }))),
  Controlled: lazy(() => import('@/pages/regulator/Oversight').then((m) => ({ default: m.ControlledMonitoring }))),
  Reports: lazy(() => import('@/pages/regulator/Oversight').then((m) => ({ default: m.GovReports }))),
  Users: lazy(() => import('@/pages/regulator/Oversight').then((m) => ({ default: m.UsersPage }))),
  Audit: lazy(() => import('@/pages/regulator/Oversight').then((m) => ({ default: m.AuditPage }))),
  System: lazy(() => import('@/pages/regulator/Oversight').then((m) => ({ default: m.SystemSettings }))),
};

/** Route guard: signed in, on the right side (pharmacy vs regulator), and holding the permission. */
function Guard({ side, perm, children }: { side?: 'app' | 'gov'; perm?: Perm; children: ReactNode }) {
  const { user, isRegulator } = useStore();
  if (!user) return <Navigate to="/login" replace />;
  if (side === 'gov' && !isRegulator) return <Navigate to="/app" replace />;
  if (side === 'app' && isRegulator) return <Navigate to="/gov" replace />;
  if (perm && !can(user, perm)) return <Navigate to={isRegulator ? '/gov' : '/app'} replace />;
  return <>{children}</>;
}

const S = ({ children }: { children: ReactNode }) => <Suspense fallback={<div className="rounded-card border border-border bg-surface"><SkeletonRows /></div>}>{children}</Suspense>;

export default function App() {
  const { user, isRegulator } = useStore();
  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to={isRegulator ? '/gov' : '/app'} replace /> : <Login />} />
      <Route element={<Guard><AppShell /></Guard>}>
        <Route path="/app" element={<Guard side="app"><S><PharmacyDashboard /></S></Guard>} />
        <Route path="/app/pos" element={<Guard side="app" perm="pos.sell"><S><POS /></S></Guard>} />
        <Route path="/app/stock" element={<Guard side="app" perm="stock.view"><S><Stock /></S></Guard>} />
        <Route path="/app/receive" element={<Guard side="app" perm="stock.receive"><S><Receive /></S></Guard>} />
        <Route path="/app/prescriptions" element={<Guard side="app"><S><Records.Prescriptions /></S></Guard>} />
        <Route path="/app/controlled" element={<Guard side="app" perm="pos.sellRx"><S><Records.Controlled /></S></Guard>} />
        <Route path="/app/destruction" element={<Guard side="app" perm="stock.receive"><S><Records.Destruction /></S></Guard>} />
        <Route path="/app/adr" element={<Guard side="app" perm="pos.sellRx"><S><Records.Adr /></S></Guard>} />
        <Route path="/app/customers" element={<Guard side="app"><S><Records.Customers /></S></Guard>} />
        <Route path="/app/suppliers" element={<Guard side="app" perm="stock.receive"><S><Records.Suppliers /></S></Guard>} />
        <Route path="/app/reports" element={<Guard side="app" perm="reports.pharmacy"><S><Reports /></S></Guard>} />
        <Route path="/app/license" element={<Guard side="app"><S><Account.License /></S></Guard>} />
        <Route path="/app/staff" element={<Guard side="app" perm="staff.manage"><S><Account.Staff /></S></Guard>} />
        <Route path="/app/settings" element={<Guard side="app"><S><Account.Settings /></S></Guard>} />
        <Route path="/app/sync" element={<S><SyncCenter /></S>} />
        <Route path="/gov" element={<Guard side="gov"><S><National /></S></Guard>} />
        <Route path="/gov/registry" element={<Guard side="gov" perm="registry.view"><S><Registry /></S></Guard>} />
        <Route path="/gov/registry/:id" element={<Guard side="gov" perm="registry.view"><S><PharmacyDetail /></S></Guard>} />
        <Route path="/gov/register" element={<Guard side="gov" perm="registry.edit"><S><Lic.Register /></S></Guard>} />
        <Route path="/gov/renewals" element={<Guard side="gov" perm="license.approve"><S><Lic.Renewals /></S></Guard>} />
        <Route path="/gov/catalog" element={<Guard side="gov"><S><Lic.Catalog /></S></Guard>} />
        <Route path="/gov/inspections" element={<Guard side="gov"><S><Inspections /></S></Guard>} />
        <Route path="/gov/inspections/:id" element={<Guard side="gov"><S><RunInspection /></S></Guard>} />
        <Route path="/gov/corrective" element={<Guard side="gov"><S><Ov.Corrective /></S></Guard>} />
        <Route path="/gov/controlled" element={<Guard side="gov" perm="registry.view"><S><Ov.Controlled /></S></Guard>} />
        <Route path="/gov/reports" element={<Guard side="gov" perm="registry.view"><S><Ov.Reports /></S></Guard>} />
        <Route path="/gov/users" element={<Guard side="gov" perm="users.manage"><S><Ov.Users /></S></Guard>} />
        <Route path="/gov/audit" element={<Guard side="gov" perm="audit.view"><S><Ov.Audit /></S></Guard>} />
        <Route path="/gov/system" element={<Guard side="gov" perm="settings.system"><S><Ov.System /></S></Guard>} />
        <Route path="/gov/sync" element={<S><SyncCenter /></S>} />
        <Route path="/gallery" element={<S><Gallery /></S>} />
      </Route>
      <Route path="*" element={<Navigate to={user ? (isRegulator ? '/gov' : '/app') : '/login'} replace />} />
    </Routes>
  );
}

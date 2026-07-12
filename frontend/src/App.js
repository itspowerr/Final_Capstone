import { Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider } from './context/AppContext';
import Landing from './pages/Landing';
import Login from './pages/Login';
import ClientDashboard from './pages/client/Dashboard';
import ExploreJobs from './pages/client/ExploreJobs';
import BrowseFreelancers from './pages/client/BrowseFreelancers';
import MyContracts from './pages/client/MyContracts';
import ClientProfile from './pages/client/Profile';
import FreelancerDashboard from './pages/freelancer/Dashboard';
import FreelancerFindJobs from './pages/freelancer/FindJobs';
import FreelancerMyContracts from './pages/freelancer/MyContracts';
import FreelancerMyProfile from './pages/freelancer/MyProfile';
import ClientMessages from './pages/shared/Messages';
import FreelancerNavbar from './components/freelancer/Navbar';
import ClientNavbar from './components/client/Navbar';
import AdminLogin from './pages/admin/Login';
import AdminDashboard from './pages/admin/Dashboard';
import AdminUsers from './pages/admin/AdminUsers';
import AdminJobs from './pages/admin/AdminJobs';
import AdminProposals from './pages/admin/AdminProposals';
import AdminContracts from './pages/admin/AdminContracts';
import AdminDisputes from './pages/admin/AdminDisputes';
import AuditLogs from './pages/admin/AuditLogs';
import AdminNavbar from './components/admin/Navbar';
import './css/landing.css';
import './css/login.css';
import './css/client/dashboard.css';
import './css/client/navbar.css';
import './css/client/explore-jobs.css';
import './css/client/browse-freelancers.css';
import './css/client/my-contracts.css';
import './css/client/profile.css';
import './css/freelancer/dashboard.css';
import './css/freelancer/navbar.css';
import './css/freelancer/my-contracts.css';
import './css/freelancer/profile.css';
import './css/admin/shared.css';
import './css/admin/navbar.css';
import './css/admin/login.css';
import './css/admin/dashboard.css';
import './css/admin/users.css';
import './css/admin/jobs.css';
import './css/admin/proposals.css';
import './css/admin/contracts.css';
import './css/admin/disputes.css';

const IS_ADMIN = process.env.REACT_APP_ADMIN_MODE === 'true' || window.location.port === '3001';

function getStoredUser() {
  const stored = localStorage.getItem('user');
  return stored ? JSON.parse(stored) : null;
}

function ProtectedRoute({ children }) {
  const user = getStoredUser();
  if (!user || user.role !== 'admin') return <Navigate to="/login" replace />;
  return children;
}

function AdminLayout({ children }) {
  return <><AdminNavbar />{children}</>;
}

export default function App() {
  if (IS_ADMIN) {
    return (
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<AdminLogin />} />
        <Route path="/dashboard" element={<ProtectedRoute><AdminLayout><AdminDashboard /></AdminLayout></ProtectedRoute>} />
        <Route path="/users" element={<ProtectedRoute><AdminLayout><AdminUsers /></AdminLayout></ProtectedRoute>} />
        <Route path="/jobs" element={<ProtectedRoute><AdminLayout><AdminJobs /></AdminLayout></ProtectedRoute>} />
        <Route path="/proposals" element={<ProtectedRoute><AdminLayout><AdminProposals /></AdminLayout></ProtectedRoute>} />
        <Route path="/contracts" element={<ProtectedRoute><AdminLayout><AdminContracts /></AdminLayout></ProtectedRoute>} />
        <Route path="/disputes" element={<ProtectedRoute><AdminLayout><AdminDisputes /></AdminLayout></ProtectedRoute>} />
        <Route path="/audit-logs" element={<ProtectedRoute><AdminLayout><AuditLogs /></AdminLayout></ProtectedRoute>} />
      </Routes>
    );
  }

  return (
    <AppProvider>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/client/dashboard" element={<ClientDashboard />} />
        <Route path="/client/explore-jobs" element={<ExploreJobs />} />
        <Route path="/client/browse-freelancers" element={<BrowseFreelancers />} />
        <Route path="/client/my-contracts" element={<MyContracts />} />
        <Route path="/client/profile" element={<ClientProfile />} />
        <Route path="/freelancer/dashboard" element={<FreelancerDashboard />} />
        <Route path="/freelancer/jobs" element={<FreelancerFindJobs />} />
        <Route path="/freelancer/contracts" element={<FreelancerMyContracts />} />
        <Route path="/freelancer/my-profile" element={<FreelancerMyProfile />} />
        <Route path="/freelancer/messages" element={<ClientMessages NavbarComponent={FreelancerNavbar} />} />
        <Route path="/client/messages" element={<ClientMessages NavbarComponent={ClientNavbar} />} />
      </Routes>
    </AppProvider>
  );
}

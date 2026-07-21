import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';

// Auth Pages
import Landing from './pages/Landing';
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';

// App Pages
import HouseholdSelector from './pages/HouseholdSelector';
import Dashboard from './pages/Dashboard';
import Expenses from './pages/Expenses';
import Balances from './pages/Balances';
import RecurringRules from './pages/RecurringRules';
import CalendarView from './pages/CalendarView';
import Settings from './pages/Settings';

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public Routes */}
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />

        {/* Protected Routes without Household Requirement */}
        <Route element={<ProtectedRoute requireHousehold={false} />}>
          <Route path="/households" element={<HouseholdSelector />} />
        </Route>

        {/* Protected Routes with Household Requirement */}
        <Route element={<ProtectedRoute requireHousehold={true} />}>
          <Route element={<Layout />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/expenses" element={<Expenses />} />
            <Route path="/balances" element={<Balances />} />
            <Route path="/recurring" element={<RecurringRules />} />
            <Route path="/calendar" element={<CalendarView />} />
            <Route path="/settings" element={<Settings />} />
          </Route>
        </Route>

        {/* Catch-all Redirect */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;

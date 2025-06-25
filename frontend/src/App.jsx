// App.jsx
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';
import LoginPage from './pages/LoginPage';
import AdminDashboard from './pages/AdminDashboard';
import ManagerDashboard from './pages/ManagerDashboard';
import CreateTaskPage from './pages/CreateTaskPage';
import TaskDetailsPage from './pages/TaskDetailsPage';
import CompletedTasksPage from './pages/CompletedTasksPage';
import EngineerManagementPage from './pages/EngineerManagementPage';
// import EngineerDashboard from './pages/EngineerDashboard';

const App = () => {
  return (
    <Router>
      <div className="min-h-screen bg-gray-50">
        <Routes>
          {/* Public Routes */}
          <Route path="/login" element={<LoginPage />} />
          
          {/* Protected Routes */}
          <Route path="/admin" element={
            <ProtectedRoute requiredRole="ADMIN">
              <AdminDashboard />
            </ProtectedRoute>
          } />
          
          <Route path="/manager" element={
            <ProtectedRoute requiredRole="MANAGER">
              <ManagerDashboard />
            </ProtectedRoute>
          } />

          <Route path="/manager/create-task" element={
            <ProtectedRoute requiredRole="MANAGER">
              <CreateTaskPage />
            </ProtectedRoute>
          } />

          <Route path="/manager/tasks/:taskId" element={
            <ProtectedRoute requiredRole="MANAGER">
              <TaskDetailsPage />
            </ProtectedRoute>
          } />

          <Route path="/manager/completed-tasks" element={
            <ProtectedRoute requiredRole="MANAGER">
              <CompletedTasksPage />
            </ProtectedRoute>
          } />

          <Route path="/manager/engineers" element={
            <ProtectedRoute requiredRole="MANAGER">
              <EngineerManagementPage />
            </ProtectedRoute>
          } />
          
          <Route path="/engineer" element={
            <ProtectedRoute requiredRole="ENGINEER">
              {/* <EngineerDashboard /> */}
            </ProtectedRoute>
          } />
          
          {/* Default redirect */}
          <Route path="/" element={<Navigate to="/login" replace />} />
          
          {/* Catch all - redirect to login */}
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </div>
    </Router>
  );
};

export default App;
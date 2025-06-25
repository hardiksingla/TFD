// components/ProtectedRoute.js
import React from 'react';
import { Navigate } from 'react-router-dom';
import { isAuthenticated, hasRole, redirectBasedOnRole } from '../utils/auth';

const ProtectedRoute = ({ children, requiredRole }) => {
  // Check if user is authenticated
  if (!isAuthenticated()) {
    return <Navigate to="/login" replace />;
  }

  // Check role-based access
  if (requiredRole && !hasRole(requiredRole)) {
    // Redirect to appropriate dashboard based on user's actual role
    const correctPath = redirectBasedOnRole();
    return <Navigate to={correctPath} replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
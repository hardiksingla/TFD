// utils/auth.js

export const getToken = () => {
  return localStorage.getItem('tfd_token');
};

export const getUser = () => {
  const userStr = localStorage.getItem('tfd_user');
  if (!userStr) return null;
  
  try {
    return JSON.parse(userStr);
  } catch (error) {
    console.error('Error parsing user data:', error);
    return null;
  }
};

export const setAuth = (token, user) => {
  localStorage.setItem('tfd_token', token);
  localStorage.setItem('tfd_user', JSON.stringify(user));
};

export const clearAuth = () => {
  localStorage.removeItem('tfd_token');
  localStorage.removeItem('tfd_user');
};

export const isAuthenticated = () => {
  return !!(getToken() && getUser());
};

export const hasRole = (requiredRole) => {
  const user = getUser();
  return user?.role === requiredRole;
};

export const redirectBasedOnRole = () => {
  const user = getUser();
  if (!user) return '/login';
  
  switch (user.role) {
    case 'ADMIN':
      return '/admin';
    case 'MANAGER':
      return '/manager';
    case 'ENGINEER':
      return '/engineer';
    default:
      return '/login';
  }
};
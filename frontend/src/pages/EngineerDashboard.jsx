// pages/EngineerDashboard.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, Clock, User, CheckCircle, AlertCircle, RefreshCw, Briefcase } from 'lucide-react';
import axios from 'axios';
import { getToken, getUser } from '../utils/auth';
import { BASE_URL } from '../config/api';
import DashboardLayout from '../components/DashboardLayout';

const EngineerDashboard = () => {
  const navigate = useNavigate();
  const token = getToken();
  const currentUser = getUser();
  
  const [loading, setLoading] = useState(true);
  const [myTasks, setMyTasks] = useState([]);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('current'); // 'current', 'upcoming', 'completed'

  useEffect(() => {
    fetchMyTasks();
  }, []);

  const fetchMyTasks = async () => {
    try {
      setLoading(true);
      setError('');
      
      // Use the new optimized endpoint that fetches only current user's tasks
      const response = await axios.get(`${BASE_URL}/api/v1/tasks/my-tasks`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.data.success) {
        setMyTasks(response.data.tasks);
      } else {
        setError('Failed to fetch your tasks. Please try again.');
      }
    } catch (error) {
      console.error('Error fetching tasks:', error);
      setError('Failed to fetch your tasks. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const categorizeTask = (task) => {
    if (task.status === 'COMPLETED') return 'completed';
    
    const currentTime = new Date();
    const hasCurrentSlots = task.timeSlots?.some(slot => {
      const startTime = new Date(slot.startDateTime);
      const endTime = new Date(slot.endDateTime);
      return startTime <= currentTime && currentTime <= endTime;
    });

    return hasCurrentSlots ? 'current' : 'upcoming';
  };

  const getFilteredTasks = () => {
    return myTasks.filter(task => categorizeTask(task) === activeTab);
  };

  const formatTimeSlots = (timeSlots) => {
    if (!timeSlots || timeSlots.length === 0) return 'No time slots';
    
    return timeSlots.map(slot => {
      const start = new Date(slot.startDateTime);
      const end = new Date(slot.endDateTime);
      return `${start.toLocaleDateString('en-IN', { 
        timeZone: 'Asia/Kolkata',
        weekday: 'short',
        month: 'short',
        day: 'numeric'
      })} ${start.toLocaleTimeString('en-IN', { 
        hour: '2-digit', 
        minute: '2-digit', 
        timeZone: 'Asia/Kolkata' 
      })} - ${end.toLocaleTimeString('en-IN', { 
        hour: '2-digit', 
        minute: '2-digit', 
        timeZone: 'Asia/Kolkata' 
      })}`;
    }).join('\n');
  };

  const getPriorityColor = (priority) => {
    return priority === 'HIGH' 
      ? 'bg-red-100 text-red-800 border-red-200' 
      : 'bg-green-100 text-green-800 border-green-200';
  };

  const getPriorityIcon = (priority) => {
    return priority === 'HIGH' 
      ? <AlertCircle className="w-4 h-4" />
      : <CheckCircle className="w-4 h-4" />;
  };

  const getTaskStatusInfo = (task) => {
    const category = categorizeTask(task);
    switch (category) {
      case 'current':
        return { 
          icon: <Briefcase className="w-4 h-4 text-blue-600" />, 
          text: 'Currently Active', 
          color: 'text-blue-600' 
        };
      case 'upcoming':
        return { 
          icon: <Clock className="w-4 h-4 text-yellow-600" />, 
          text: 'Upcoming', 
          color: 'text-yellow-600' 
        };
      case 'completed':
        return { 
          icon: <CheckCircle className="w-4 h-4 text-green-600" />, 
          text: 'Completed', 
          color: 'text-green-600' 
        };
      default:
        return { 
          icon: <Calendar className="w-4 h-4 text-gray-600" />, 
          text: 'Unknown', 
          color: 'text-gray-600' 
        };
    }
  };

  // Calculate task counts
  const taskCounts = {
    current: myTasks.filter(task => categorizeTask(task) === 'current').length,
    upcoming: myTasks.filter(task => categorizeTask(task) === 'upcoming').length,
    completed: myTasks.filter(task => categorizeTask(task) === 'completed').length
  };

  const filteredTasks = getFilteredTasks();

  if (loading) {
    return (
      <DashboardLayout title="My Tasks">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-2 text-gray-600">Loading your tasks...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="TFD Engineer Dashboard">
      <div className="space-y-6">
        {error && (
          <div className="p-3 bg-red-100 border border-red-400 text-red-700 rounded-lg">
            {error}
          </div>
        )}

        {/* Welcome Section */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Welcome, {currentUser?.name}</h1>
              <p className="text-gray-600 mt-1">Here are your assigned tasks and schedule</p>
            </div>
            <button
              onClick={fetchMyTasks}
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </button>
          </div>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center">
              <div className="p-3 bg-blue-100 rounded-full">
                <Briefcase className="w-6 h-6 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm text-gray-600">Current Tasks</p>
                <p className="text-2xl font-semibold text-gray-900">{taskCounts.current}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center">
              <div className="p-3 bg-yellow-100 rounded-full">
                <Clock className="w-6 h-6 text-yellow-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm text-gray-600">Upcoming Tasks</p>
                <p className="text-2xl font-semibold text-gray-900">{taskCounts.upcoming}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center">
              <div className="p-3 bg-green-100 rounded-full">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm text-gray-600">Completed Tasks</p>
                <p className="text-2xl font-semibold text-gray-900">{taskCounts.completed}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Tasks Section */}
        <div className="bg-white rounded-lg shadow-sm">
          {/* Tab Navigation */}
          <div className="border-b border-gray-200">
            <nav className="flex space-x-8 px-6" aria-label="Tabs">
              <button
                onClick={() => setActiveTab('current')}
                className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === 'current'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Current Tasks ({taskCounts.current})
              </button>
              <button
                onClick={() => setActiveTab('upcoming')}
                className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === 'upcoming'
                    ? 'border-yellow-500 text-yellow-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Upcoming Tasks ({taskCounts.upcoming})
              </button>
              <button
                onClick={() => setActiveTab('completed')}
                className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === 'completed'
                    ? 'border-green-500 text-green-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Completed Tasks ({taskCounts.completed})
              </button>
            </nav>
          </div>

          {/* Tasks List */}
          <div className="p-6">
            {filteredTasks.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Tasks Found</h3>
                <p className="text-gray-600">
                  {activeTab === 'current' && "You don't have any current active tasks."}
                  {activeTab === 'upcoming' && "You don't have any upcoming tasks scheduled."}
                  {activeTab === 'completed' && "You haven't completed any tasks yet."}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {filteredTasks.map((task) => {
                  const statusInfo = getTaskStatusInfo(task);
                  return (
                    <div
                      key={task.id}
                      className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                    >
                      {/* Task Header */}
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <h3 className="text-lg font-semibold text-gray-900 mb-1">
                            {task.project}
                          </h3>
                          <div className="flex items-center space-x-2">
                            <span className={`inline-flex items-center px-2 py-1 text-xs font-semibold rounded-full ${getPriorityColor(task.priority)}`}>
                              {getPriorityIcon(task.priority)}
                              <span className="ml-1">{task.priority} Priority</span>
                            </span>
                            <span className={`inline-flex items-center text-sm ${statusInfo.color}`}>
                              {statusInfo.icon}
                              <span className="ml-1">{statusInfo.text}</span>
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Task Details */}
                      <div className="space-y-3">
                        {/* Time Slots */}
                        <div>
                          <div className="flex items-center mb-2">
                            <Clock className="w-4 h-4 text-gray-500 mr-2" />
                            <span className="text-sm font-medium text-gray-700">Schedule:</span>
                          </div>
                          <div className="ml-6 text-sm text-gray-600 space-y-1">
                            {task.timeSlots?.map((slot, index) => {
                              const start = new Date(slot.startDateTime);
                              const end = new Date(slot.endDateTime);
                              const isToday = start.toDateString() === new Date().toDateString();
                              
                              return (
                                <div key={index} className={`${isToday ? 'font-medium text-blue-600' : ''}`}>
                                  {start.toLocaleDateString('en-IN', { 
                                    timeZone: 'Asia/Kolkata',
                                    weekday: 'long',
                                    month: 'short',
                                    day: 'numeric',
                                    year: 'numeric'
                                  })}
                                  <br />
                                  <span className="text-xs">
                                    {start.toLocaleTimeString('en-IN', { 
                                      hour: '2-digit', 
                                      minute: '2-digit', 
                                      timeZone: 'Asia/Kolkata' 
                                    })} - {end.toLocaleTimeString('en-IN', { 
                                      hour: '2-digit', 
                                      minute: '2-digit', 
                                      timeZone: 'Asia/Kolkata' 
                                    })}
                                    {isToday && <span className="ml-2 text-blue-600 font-semibold">(Today)</span>}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        {/* Contact Information */}
                        <div className="flex items-center">
                          <User className="w-4 h-4 text-gray-500 mr-2" />
                          <span className="text-sm text-gray-700">Contact: {task.contactNo}</span>
                        </div>

                        {/* Created By */}
                        <div className="flex items-center">
                          <User className="w-4 h-4 text-gray-500 mr-2" />
                          <span className="text-sm text-gray-700">
                            Assigned by: {task.createdBy?.name || 'Unknown'}
                          </span>
                        </div>

                        {/* Remarks (if any) */}
                        {task.remarks && (
                          <div className="mt-3 p-3 bg-blue-50 rounded-lg">
                            <div className="flex items-start">
                              <div className="text-sm">
                                <span className="font-medium text-blue-900">Manager's Note:</span>
                                <p className="mt-1 text-blue-800">{task.remarks}</p>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default EngineerDashboard;
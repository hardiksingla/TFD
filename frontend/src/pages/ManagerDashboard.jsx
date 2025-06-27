// pages/ManagerDashboard.jsx
import React, { useState, useEffect } from 'react';
import { ClipboardList, Users, Calendar, BarChart3, Plus, Eye, Clock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import DashboardLayout from '../components/DashboardLayout';
import { getToken, getUser } from '../utils/auth';
import { BASE_URL } from '../config/api';

const ManagerDashboard = () => {
  const navigate = useNavigate();
  const token = getToken();
  const currentUser = getUser();
  
  const [loading, setLoading] = useState(true);
  const [myTasks, setMyTasks] = useState([]);
  const [otherTasks, setOtherTasks] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchActiveTasks();
  }, []);

  const fetchActiveTasks = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${BASE_URL}/api/v1/tasks?status=ACTIVE`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = response.data;
      if (data.success) {
        const tasks = data.tasks;
        const currentTime = new Date();
        
        // Filter tasks with future timestamps
        const activeTasks = tasks.filter(task => {
          const timeSlots = task.timeSlots || [];
          return timeSlots.some(slot => new Date(slot.endDateTime) > currentTime);
        });

        // Separate tasks created by current manager vs others
        const myTasksList = activeTasks.filter(task => task.createdById === currentUser.id);
        const otherTasksList = activeTasks.filter(task => task.createdById !== currentUser.id);

        setMyTasks(myTasksList);
        setOtherTasks(otherTasksList);
      } else {
        setError('Failed to fetch tasks');
      }
    } catch (error) {
      console.error('Error fetching tasks:', error);
      setError('Failed to fetch tasks');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTask = () => {
    navigate('/manager/create-task');
  };

  const handleTaskClick = (taskId) => {
    navigate(`/manager/tasks/${taskId}`);
  };

  const getPriorityColor = (priority) => {
    return priority === 'HIGH' 
      ? 'bg-red-100 text-red-800' 
      : 'bg-green-100 text-green-800';
  };

  const formatTimeSlots = (timeSlots) => {
    if (!timeSlots || timeSlots.length === 0) return 'No time slots';
    
    const currentTime = new Date();
    const futureSlots = timeSlots.filter(slot => new Date(slot.endDateTime) > currentTime);
    
    if (futureSlots.length === 0) return 'No upcoming time slots';
    
    return futureSlots.slice(0, 2).map(slot => {
      // Convert UTC times to IST for display
      const start = new Date(slot.startDateTime);
      const end = new Date(slot.endDateTime);
      return `${start.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' })} ${start.toLocaleTimeString('en-IN', { hour: '2-digit', minute:'2-digit', timeZone: 'Asia/Kolkata' })} - ${end.toLocaleTimeString('en-IN', { hour: '2-digit', minute:'2-digit', timeZone: 'Asia/Kolkata' })}`;
    }).join(', ') + (futureSlots.length > 2 ? '...' : '');
  };

  // Calculate stats
  const stats = [
    {
      title: 'My Active Tasks',
      value: myTasks.length.toString(),
      icon: ClipboardList,
      color: 'bg-blue-500'
    },
    {
      title: 'All Active Tasks',
      value: (myTasks.length + otherTasks.length).toString(),
      icon: Calendar,
      color: 'bg-purple-500'
    },
    {
      title: 'High Priority',
      value: [...myTasks, ...otherTasks].filter(task => task.priority === 'HIGH').length.toString(),
      icon: BarChart3,
      color: 'bg-red-500'
    }
  ];

  const TaskCard = ({ task, isMyTask = false }) => (
    <div 
      onClick={() => handleTaskClick(task.id)}
      className="p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer border border-gray-200"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <h4 className="font-medium text-gray-900">{task.project}</h4>
          <p className="text-sm text-gray-600">
            Created by: {task.createdBy?.name || 'Unknown'}
          </p>
        </div>
        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getPriorityColor(task.priority)}`}>
          {task.priority}
        </span>
      </div>

      <div className="space-y-2 text-sm text-gray-600">
        <div className="flex items-center">
          <Clock className="w-4 h-4 mr-2" />
          <span>{formatTimeSlots(task.timeSlots)}</span>
        </div>
        
        {task.assignedUsers && task.assignedUsers.length > 0 && (
          <div className="flex items-center">
            <Users className="w-4 h-4 mr-2" />
            <span>{task.assignedUsers.length} engineer(s) assigned</span>
          </div>
        )}
        
        <div className="flex items-center">
          <span className="text-xs">Contact: {task.contactNo}</span>
        </div>
      </div>

      {task.remarks && (
        <div className="mt-2 p-2 bg-blue-50 rounded text-xs text-blue-800">
          <strong>Remarks:</strong> {task.remarks}
        </div>
      )}
    </div>
  );

  if (loading) {
    return (
      <DashboardLayout title="Manager Dashboard">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-2 text-gray-600">Loading tasks...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Manager Dashboard">
      <div className="space-y-6">
        {error && (
          <div className="p-3 bg-red-100 border border-red-400 text-red-700 rounded-lg">
            {error}
          </div>
        )}

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {stats.map((stat, index) => (
            <div key={index} className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center">
                <div className={`${stat.color} p-3 rounded-lg`}>
                  <stat.icon className="w-6 h-6 text-white" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">{stat.title}</p>
                  <p className="text-2xl font-semibold text-gray-900">{stat.value}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Task Sections */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* My Tasks */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">My Tasks ({myTasks.length})</h3>
              <button 
                onClick={handleCreateTask}
                className="inline-flex items-center px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
              >
                <Plus className="w-4 h-4 mr-1" />
                New Task
              </button>
            </div>
            
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {myTasks.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <ClipboardList className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                  <p className="text-sm">No active tasks created by you</p>
                  <button 
                    onClick={handleCreateTask}
                    className="mt-2 text-blue-600 hover:text-blue-700 text-sm font-medium"
                  >
                    Create your first task
                  </button>
                </div>
              ) : (
                myTasks.map((task) => (
                  <TaskCard key={task.id} task={task} isMyTask={true} />
                ))
              )}
            </div>
          </div>

          {/* Other Tasks */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">All Other Tasks ({otherTasks.length})</h3>
              <button className="text-gray-400 hover:text-gray-600 transition-colors">
                <Eye className="w-5 h-5" />
              </button>
            </div>
            
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {otherTasks.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Calendar className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                  <p className="text-sm">No other active tasks</p>
                </div>
              ) : (
                otherTasks.map((task) => (
                  <TaskCard key={task.id} task={task} isMyTask={false} />
                ))
              )}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <button 
              onClick={handleCreateTask}
              className="p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors"
            >
              <ClipboardList className="w-8 h-8 text-gray-400 mx-auto mb-2" />
              <p className="text-sm font-medium text-gray-900">Create New Task</p>
              <p className="text-xs text-gray-600">Assign tasks to engineers</p>
            </button>
            
            <button 
              onClick={() => navigate('/manager/completed-tasks')}
              className="p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-green-500 hover:bg-green-50 transition-colors"
            >
              <Calendar className="w-8 h-8 text-gray-400 mx-auto mb-2" />
              <p className="text-sm font-medium text-gray-900">View Completed Tasks</p>
              <p className="text-xs text-gray-600">Review past assignments</p>
            </button>
            
            <button 
              onClick={() => navigate('/manager/engineers')}
              className="p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-purple-500 hover:bg-purple-50 transition-colors"
            >
              <Users className="w-8 h-8 text-gray-400 mx-auto mb-2" />
              <p className="text-sm font-medium text-gray-900">Engineer Management</p>
              <p className="text-xs text-gray-600">View team availability</p>
            </button>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default ManagerDashboard;
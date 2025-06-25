// pages/CompletedTasksPage.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Calendar, Clock, User, Users, CheckCircle, Filter, Search } from 'lucide-react';
import axios from 'axios';
import { getToken, getUser } from '../utils/auth';
import { BASE_URL } from '../config/api';

const CompletedTasksPage = () => {
  const navigate = useNavigate();
  const token = getToken();
  const currentUser = getUser();
  
  const [loading, setLoading] = useState(true);
  const [completedTasks, setCompletedTasks] = useState([]);
  const [filteredTasks, setFilteredTasks] = useState([]);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterBy, setFilterBy] = useState('all'); // 'all', 'my', 'others'

  useEffect(() => {
    fetchCompletedTasks();
  }, []);

  useEffect(() => {
    filterTasks();
  }, [completedTasks, searchTerm, filterBy]);

  const fetchCompletedTasks = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${BASE_URL}/api/v1/tasks?status=COMPLETED`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = response.data;
      if (data.success) {
        setCompletedTasks(data.tasks);
      } else {
        setError('Failed to fetch completed tasks');
      }
    } catch (error) {
      console.error('Error fetching completed tasks:', error);
      setError('Failed to fetch completed tasks');
    } finally {
      setLoading(false);
    }
  };

  const filterTasks = () => {
    let filtered = completedTasks;

    // Filter by creator
    if (filterBy === 'my') {
      filtered = filtered.filter(task => task.createdById === currentUser.id);
    } else if (filterBy === 'others') {
      filtered = filtered.filter(task => task.createdById !== currentUser.id);
    }

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(task => 
        task.project.toLowerCase().includes(searchTerm.toLowerCase()) ||
        task.createdBy?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        task.contactNo.includes(searchTerm) ||
        (task.remarks && task.remarks.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }

    setFilteredTasks(filtered);
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
    
    return timeSlots.slice(0, 2).map(slot => {
      // Convert UTC times to IST for display
      const start = new Date(slot.startDateTime);
      const end = new Date(slot.endDateTime);
      return `${start.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' })} ${start.toLocaleTimeString('en-IN', { hour: '2-digit', minute:'2-digit', timeZone: 'Asia/Kolkata' })} - ${end.toLocaleTimeString('en-IN', { hour: '2-digit', minute:'2-digit', timeZone: 'Asia/Kolkata' })}`;
    }).join(', ') + (timeSlots.length > 2 ? '...' : '');
  };

  const getCompletionDate = (timeSlots) => {
    if (!timeSlots || timeSlots.length === 0) return null;
    
    // Find the latest end time
    const latestEndTime = timeSlots.reduce((latest, slot) => {
      const endTime = new Date(slot.endDateTime);
      return endTime > latest ? endTime : latest;
    }, new Date(0));

    return latestEndTime.toLocaleDateString('en-IN', { 
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const TaskCard = ({ task }) => (
    <div 
      onClick={() => handleTaskClick(task.id)}
      className="p-4 bg-white rounded-lg hover:bg-gray-50 transition-colors cursor-pointer border border-gray-200 shadow-sm"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <div className="flex items-center mb-2">
            <h4 className="font-medium text-gray-900 mr-2">{task.project}</h4>
            <CheckCircle className="w-4 h-4 text-green-600" />
          </div>
          <p className="text-sm text-gray-600">
            Created by: {task.createdBy?.name || 'Unknown'}
          </p>
          <p className="text-xs text-gray-500">
            Completed on: {getCompletionDate(task.timeSlots)}
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
            <span>{task.assignedUsers.length} engineer(s) worked on this</span>
          </div>
        )}
        
        <div className="flex items-center">
          <span className="text-xs">Contact: {task.contactNo}</span>
        </div>
      </div>

      {task.remarks && (
        <div className="mt-2 p-2 bg-gray-50 rounded text-xs text-gray-700">
          <strong>Remarks:</strong> {task.remarks}
        </div>
      )}

      <div className="mt-3 pt-2 border-t border-gray-100">
        <p className="text-xs text-gray-500">
          Created: {new Date(task.createdAt).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' })} | 
          Last updated: {new Date(task.updatedAt).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' })}
        </p>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading completed tasks...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <button
                onClick={() => navigate('/manager')}
                className="p-2 text-gray-400 hover:text-gray-600 transition-colors rounded-lg hover:bg-gray-100 mr-3"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-xl font-semibold text-gray-900">Completed Tasks</h1>
                <p className="text-sm text-gray-500">View all finished tasks and their details</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className="mb-6 p-3 bg-red-100 border border-red-400 text-red-700 rounded-lg">
            {error}
          </div>
        )}

        {/* Filters and Search */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            {/* Search */}
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by project, creator, contact, or remarks..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Filter */}
            <div className="flex items-center space-x-2">
              <Filter className="w-4 h-4 text-gray-600" />
              <select
                value={filterBy}
                onChange={(e) => setFilterBy(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">All Tasks</option>
                <option value="my">My Tasks</option>
                <option value="others">Others' Tasks</option>
              </select>
            </div>
          </div>

          {/* Results Count */}
          <div className="mt-4 pt-4 border-t border-gray-200">
            <p className="text-sm text-gray-600">
              Showing {filteredTasks.length} of {completedTasks.length} completed tasks
              {searchTerm && ` matching "${searchTerm}"`}
              {filterBy !== 'all' && ` (${filterBy === 'my' ? 'created by you' : 'created by others'})`}
            </p>
          </div>
        </div>

        {/* Tasks Grid */}
        {filteredTasks.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm p-12 text-center">
            <CheckCircle className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              {completedTasks.length === 0 ? 'No Completed Tasks' : 'No Tasks Found'}
            </h3>
            <p className="text-gray-600 mb-4">
              {completedTasks.length === 0 
                ? 'No tasks have been completed yet. Completed tasks will appear here automatically once all their time slots are finished.'
                : 'No tasks match your search criteria. Try adjusting your search or filter settings.'
              }
            </p>
            {searchTerm || filterBy !== 'all' ? (
              <button
                onClick={() => {
                  setSearchTerm('');
                  setFilterBy('all');
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Clear Filters
              </button>
            ) : (
              <button
                onClick={() => navigate('/manager')}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Back to Dashboard
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredTasks.map((task) => (
              <TaskCard key={task.id} task={task} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default CompletedTasksPage;
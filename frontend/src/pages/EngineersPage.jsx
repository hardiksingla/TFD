// pages/EngineerManagementPage.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Users, Clock, CheckCircle, AlertCircle, Calendar, User, Search, RefreshCw } from 'lucide-react';
import axios from 'axios';
import { getToken } from '../utils/auth';
import { BASE_URL } from '../config/api';

const EngineerManagementPage = () => {
  const navigate = useNavigate();
  const token = getToken();
  
  const [loading, setLoading] = useState(true);
  const [engineers, setEngineers] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [activeTab, setActiveTab] = useState('available'); // 'available' or 'busy'
  const [selectedEngineer, setSelectedEngineer] = useState(null);
  const [engineerTasks, setEngineerTasks] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Fetch all engineers and active tasks in parallel
      const [engineersResponse, tasksResponse] = await Promise.all([
        axios.get(`${BASE_URL}/api/v1/engineers`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        axios.get(`${BASE_URL}/api/v1/tasks?status=ACTIVE`, {
          headers: { 'Authorization': `Bearer ${token}` }
        })
      ]);

      if (engineersResponse.data.success && tasksResponse.data.success) {
        setEngineers(engineersResponse.data.engineers);
        setTasks(tasksResponse.data.tasks);
      } else {
        setError('Failed to fetch data');
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      setError('Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  const getEngineerStatus = () => {
    const currentTime = new Date();
    const engineerStatusMap = new Map();

    // Initialize all engineers as available
    engineers.forEach(engineer => {
      engineerStatusMap.set(engineer.id, {
        ...engineer,
        status: 'available',
        currentTasks: [],
        upcomingTasks: []
      });
    });

    // Check each active task
    tasks.forEach(task => {
      if (!task.assignedTo || task.assignedTo.length === 0) return;

      const timeSlots = task.timeSlots || [];
      
      // Check if task has current or upcoming time slots
      const hasCurrentSlots = timeSlots.some(slot => {
        const startTime = new Date(slot.startDateTime);
        const endTime = new Date(slot.endDateTime);
        return startTime <= currentTime && currentTime <= endTime;
      });

      const hasUpcomingSlots = timeSlots.some(slot => {
        const startTime = new Date(slot.startDateTime);
        return startTime > currentTime;
      });

      // Update engineer status for assigned engineers
      task.assignedTo.forEach(engineerId => {
        const engineerStatus = engineerStatusMap.get(engineerId);
        if (engineerStatus) {
          if (hasCurrentSlots) {
            engineerStatus.status = 'busy';
            engineerStatus.currentTasks.push(task);
          } else if (hasUpcomingSlots) {
            if (engineerStatus.status === 'available') {
              engineerStatus.status = 'scheduled';
            }
            engineerStatus.upcomingTasks.push(task);
          }
        }
      });
    });

    return Array.from(engineerStatusMap.values());
  };

  const handleEngineerClick = async (engineer) => {
    setSelectedEngineer(engineer);
    
    // Get all tasks (active and completed) for this engineer
    try {
      const [activeResponse, completedResponse] = await Promise.all([
        axios.get(`${BASE_URL}/api/v1/tasks?status=ACTIVE`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        axios.get(`${BASE_URL}/api/v1/tasks?status=COMPLETED`, {
          headers: { 'Authorization': `Bearer ${token}` }
        })
      ]);

      const allTasks = [
        ...(activeResponse.data.success ? activeResponse.data.tasks : []),
        ...(completedResponse.data.success ? completedResponse.data.tasks : [])
      ];

      // Filter tasks assigned to this engineer
      const engineerSpecificTasks = allTasks.filter(task => 
        task.assignedTo && task.assignedTo.includes(engineer.id)
      );

      setEngineerTasks(engineerSpecificTasks);
    } catch (error) {
      console.error('Error fetching engineer tasks:', error);
      setEngineerTasks([]);
    }
  };

  const closeEngineerDetails = () => {
    setSelectedEngineer(null);
    setEngineerTasks([]);
  };

  const formatTimeSlots = (timeSlots) => {
    if (!timeSlots || timeSlots.length === 0) return 'No time slots';
    
    return timeSlots.slice(0, 2).map(slot => {
      const start = new Date(slot.startDateTime);
      const end = new Date(slot.endDateTime);
      return `${start.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' })} ${start.toLocaleTimeString('en-IN', { hour: '2-digit', minute:'2-digit', timeZone: 'Asia/Kolkata' })} - ${end.toLocaleTimeString('en-IN', { hour: '2-digit', minute:'2-digit', timeZone: 'Asia/Kolkata' })}`;
    }).join(', ') + (timeSlots.length > 2 ? '...' : '');
  };

  const getPriorityColor = (priority) => {
    return priority === 'HIGH' 
      ? 'bg-red-100 text-red-800' 
      : 'bg-green-100 text-green-800';
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'available':
        return 'bg-green-100 text-green-800';
      case 'busy':
        return 'bg-red-100 text-red-800';
      case 'scheduled':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'available':
        return <CheckCircle className="w-4 h-4" />;
      case 'busy':
        return <AlertCircle className="w-4 h-4" />;
      case 'scheduled':
        return <Clock className="w-4 h-4" />;
      default:
        return <User className="w-4 h-4" />;
    }
  };

  const engineerStatusList = getEngineerStatus();
  
  const filteredEngineers = engineerStatusList.filter(engineer => {
    const matchesSearch = engineer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         engineer.username.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesTab = activeTab === 'available' 
      ? engineer.status === 'available' || engineer.status === 'scheduled'
      : engineer.status === 'busy';
    
    return matchesSearch && matchesTab;
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading engineer data...</p>
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
                <h1 className="text-xl font-semibold text-gray-900">Engineer Management</h1>
                <p className="text-sm text-gray-500">View engineer availability and task assignments</p>
              </div>
            </div>
            
            <button
              onClick={fetchData}
              className="inline-flex items-center px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </button>
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

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Engineers List */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow-sm">
              {/* Tabs */}
              <div className="border-b border-gray-200">
                <nav className="flex space-x-8 px-6" aria-label="Tabs">
                  <button
                    onClick={() => setActiveTab('available')}
                    className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                      activeTab === 'available'
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    Available Engineers
                    <span className="ml-2 px-2 py-1 text-xs rounded-full bg-green-100 text-green-800">
                      {engineerStatusList.filter(e => e.status === 'available' || e.status === 'scheduled').length}
                    </span>
                  </button>
                  <button
                    onClick={() => setActiveTab('busy')}
                    className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                      activeTab === 'busy'
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    Busy Engineers
                    <span className="ml-2 px-2 py-1 text-xs rounded-full bg-red-100 text-red-800">
                      {engineerStatusList.filter(e => e.status === 'busy').length}
                    </span>
                  </button>
                </nav>
              </div>

              {/* Search */}
              <div className="p-6 border-b border-gray-200">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search engineers by name or username..."
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              {/* Engineers Grid */}
              <div className="p-6">
                {filteredEngineers.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <Users className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                    <p className="text-lg font-medium text-gray-900 mb-2">
                      No {activeTab === 'available' ? 'Available' : 'Busy'} Engineers
                    </p>
                    <p className="text-gray-600">
                      {searchTerm ? 'No engineers match your search criteria.' : 
                       activeTab === 'available' ? 'All engineers are currently busy with tasks.' : 
                       'All engineers are currently available for new assignments.'}
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {filteredEngineers.map((engineer) => (
                      <div
                        key={engineer.id}
                        onClick={() => handleEngineerClick(engineer)}
                        className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer"
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <h4 className="font-medium text-gray-900">{engineer.name}</h4>
                            <p className="text-sm text-gray-600">@{engineer.username}</p>
                          </div>
                          <span className={`inline-flex items-center px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(engineer.status)}`}>
                            {getStatusIcon(engineer.status)}
                            <span className="ml-1 capitalize">{engineer.status}</span>
                          </span>
                        </div>

                        <div className="text-sm text-gray-600">
                          {engineer.status === 'busy' && engineer.currentTasks.length > 0 && (
                            <p>Currently working on {engineer.currentTasks.length} task(s)</p>
                          )}
                          {engineer.status === 'scheduled' && engineer.upcomingTasks.length > 0 && (
                            <p>Scheduled for {engineer.upcomingTasks.length} upcoming task(s)</p>
                          )}
                          {engineer.status === 'available' && (
                            <p>Available for new assignments</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Engineer Details Sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-sm p-6 sticky top-8">
              {selectedEngineer ? (
                <>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900">Engineer Details</h3>
                    <button
                      onClick={closeEngineerDetails}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      ×
                    </button>
                  </div>

                  <div className="mb-6">
                    <div className="flex items-center mb-2">
                      <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center mr-3">
                        <User className="w-5 h-5 text-blue-600" />
                      </div>
                      <div>
                        <h4 className="font-medium text-gray-900">{selectedEngineer.name}</h4>
                        <p className="text-sm text-gray-600">@{selectedEngineer.username}</p>
                      </div>
                    </div>
                    <span className={`inline-flex items-center px-3 py-1 text-sm font-semibold rounded-full ${getStatusColor(selectedEngineer.status)}`}>
                      {getStatusIcon(selectedEngineer.status)}
                      <span className="ml-1 capitalize">{selectedEngineer.status}</span>
                    </span>
                  </div>

                  <div>
                    <h4 className="font-medium text-gray-900 mb-3">
                      Task History ({engineerTasks.length})
                    </h4>
                    
                    <div className="space-y-3 max-h-96 overflow-y-auto">
                      {engineerTasks.length === 0 ? (
                        <div className="text-center py-4 text-gray-500">
                          <Calendar className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                          <p className="text-sm">No tasks assigned</p>
                        </div>
                      ) : (
                        engineerTasks.map((task) => (
                          <div
                            key={task.id}
                            onClick={() => navigate(`/manager/tasks/${task.id}`)}
                            className="p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer"
                          >
                            <div className="flex items-start justify-between mb-2">
                              <h5 className="font-medium text-gray-900 text-sm">{task.project}</h5>
                              <div className="flex items-center space-x-1">
                                <span className={`px-1 py-0.5 text-xs font-semibold rounded ${getPriorityColor(task.priority)}`}>
                                  {task.priority}
                                </span>
                                <span className={`px-1 py-0.5 text-xs font-semibold rounded ${
                                  task.status === 'COMPLETED' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'
                                }`}>
                                  {task.status}
                                </span>
                              </div>
                            </div>
                            <p className="text-xs text-gray-600">
                              {formatTimeSlots(task.timeSlots)}
                            </p>
                            <p className="text-xs text-gray-500 mt-1">
                              Created by: {task.createdBy?.name || 'Unknown'}
                            </p>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <Users className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Select an Engineer</h3>
                  <p className="text-gray-600">Click on any engineer to view their details and task history</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EngineerManagementPage;
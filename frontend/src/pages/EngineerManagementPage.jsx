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
  const [activeTab, setActiveTab] = useState('available'); // 'available', 'busy', or 'schedule'
  const [selectedEngineer, setSelectedEngineer] = useState(null);
  const [engineerTasks, setEngineerTasks] = useState([]);
  const [loadingEngineerTasks, setLoadingEngineerTasks] = useState(false);
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

  const getScheduleData = () => {
    const currentTime = new Date();
    const today = new Date(currentTime.getFullYear(), currentTime.getMonth(), currentTime.getDate());
    
    // Find the furthest future date among all tasks
    let maxDate = new Date(today);
    maxDate.setDate(maxDate.getDate() + 7); // Default to 7 days ahead
    
    tasks.forEach(task => {
      if (task.timeSlots && Array.isArray(task.timeSlots)) {
        task.timeSlots.forEach(slot => {
          const endDate = new Date(slot.endDateTime);
          if (endDate > maxDate) {
            maxDate = endDate;
          }
        });
      }
    });

    // Generate date range
    const dates = [];
    for (let d = new Date(today); d <= maxDate; d.setDate(d.getDate() + 1)) {
      dates.push(new Date(d));
    }

    // Create schedule data structure
    const scheduleData = engineers.map(engineer => {
      const engineerSchedule = {
        id: engineer.id,
        name: engineer.name,
        username: engineer.username,
        schedule: {}
      };

      dates.forEach(date => {
        const dateStr = date.toISOString().split('T')[0];
        engineerSchedule.schedule[dateStr] = [];
      });

      // Fill in task data
      tasks.forEach(task => {
        if (task.assignedTo && task.assignedTo.includes(engineer.id)) {
          task.timeSlots.forEach(slot => {
            const startDate = new Date(slot.startDateTime);
            const endDate = new Date(slot.endDateTime);
            const startDateStr = startDate.toISOString().split('T')[0];
            
            if (engineerSchedule.schedule[startDateStr]) {
              engineerSchedule.schedule[startDateStr].push({
                taskId: task.id,
                project: task.project,
                priority: task.priority,
                startTime: startDate,
                endTime: endDate
              });
            }
          });
        }
      });

      return engineerSchedule;
    });

    return { scheduleData, dates };
  };

  const getEngineerStatus = () => {
    const currentTime = new Date();
    
    return engineers.map(engineer => {
      const currentTasks = tasks.filter(task => {
        if (!task.assignedTo || !task.assignedTo.includes(engineer.id)) return false;
        
        return task.timeSlots.some(slot => {
          const startTime = new Date(slot.startDateTime);
          const endTime = new Date(slot.endDateTime);
          return currentTime >= startTime && currentTime <= endTime;
        });
      });

      const futureTasks = tasks.filter(task => {
        if (!task.assignedTo || !task.assignedTo.includes(engineer.id)) return false;
        
        return task.timeSlots.some(slot => {
          const startTime = new Date(slot.startDateTime);
          return startTime > currentTime;
        });
      });

      let status = 'available';
      if (currentTasks.length > 0) {
        status = 'busy';
      } else if (futureTasks.length > 0) {
        status = 'scheduled';
      }

      return {
        ...engineer,
        status,
        currentTasks: currentTasks.length,
        futureTasks: futureTasks.length
      };
    });
  };

  const showEngineerDetails = async (engineer) => {
    setSelectedEngineer(engineer);
    setLoadingEngineerTasks(true);
    setEngineerTasks([]); // Clear previous tasks
    
    try {
      // Fetch both active and completed tasks for this engineer
      const [activeResponse, completedResponse] = await Promise.all([
        axios.get(`${BASE_URL}/api/v1/tasks?status=ACTIVE`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        axios.get(`${BASE_URL}/api/v1/tasks?status=COMPLETED`, {
          headers: { 'Authorization': `Bearer ${token}` }
        })
      ]);

      // Combine all tasks
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
    } finally {
      setLoadingEngineerTasks(false);
    }
  };

  const closeEngineerDetails = () => {
    setSelectedEngineer(null);
    setEngineerTasks([]);
    setLoadingEngineerTasks(false);
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
  const { scheduleData, dates } = getScheduleData();
  
  const filteredEngineers = engineerStatusList.filter(engineer => {
    const matchesSearch = engineer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         engineer.username.toLowerCase().includes(searchTerm.toLowerCase());
    
    if (activeTab === 'schedule') return matchesSearch;
    
    const matchesTab = activeTab === 'available' 
      ? engineer.status === 'available'
      : engineer.status === 'busy';
    
    return matchesSearch && matchesTab;
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading engineers...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <button
                onClick={() => navigate('/manager')}
                className="mr-4 p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-gray-600" />
              </button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">TFD Manpower Allocation</h1>
                <p className="text-gray-600">Engineer Management & Scheduling</p>
              </div>
            </div>
            <button
              onClick={fetchData}
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </button>
          </div>
        </div>
      </div>

      <div className="flex">
        {/* Main Content */}
        <div className="flex-1 p-6">
          {error && (
            <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded-lg">
              {error}
            </div>
          )}

          {/* Search and Tabs */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex space-x-1 bg-gray-100 rounded-lg p-1">
                {['available', 'busy', 'schedule'].map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                      activeTab === tab
                        ? 'bg-white text-blue-600 shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    {tab === 'available' && 'Available'}
                    {tab === 'busy' && 'Busy'}
                    {tab === 'schedule' && 'Schedule View'}
                  </button>
                ))}
              </div>

              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search engineers..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
          </div>

          {/* Content based on active tab */}
          {activeTab === 'schedule' ? (
            // Schedule View
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="overflow-x-auto">
                <div className="min-w-full">
                  <div className="grid grid-cols-8 gap-px bg-gray-200">
                    {/* Header */}
                    <div className="bg-gray-50 p-3 font-medium text-gray-900">Engineer</div>
                    {dates.slice(0, 7).map(date => (
                      <div key={date.toISOString()} className="bg-gray-50 p-3 text-center">
                        <div className="font-medium text-gray-900">
                          {date.toLocaleDateString('en-IN', { weekday: 'short', timeZone: 'Asia/Kolkata' })}
                        </div>
                        <div className="text-xs text-gray-600">
                          {date.toLocaleDateString('en-IN', { month: 'short', day: 'numeric', timeZone: 'Asia/Kolkata' })}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Schedule Rows */}
                  {scheduleData.filter(engineer => 
                    engineer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    engineer.username.toLowerCase().includes(searchTerm.toLowerCase())
                  ).map(engineer => (
                    <div key={engineer.id} className="grid grid-cols-8 gap-px bg-gray-200">
                      <div className="bg-white p-3">
                        <div className="font-medium text-gray-900">{engineer.name}</div>
                        <div className="text-xs text-gray-600">@{engineer.username}</div>
                      </div>
                      {dates.slice(0, 7).map(date => {
                        const dateStr = date.toISOString().split('T')[0];
                        const dayTasks = engineer.schedule[dateStr] || [];
                        return (
                          <div key={dateStr} className="bg-white p-2 min-h-[60px]">
                            {dayTasks.map((task, idx) => (
                              <div
                                key={`${task.taskId}-${idx}`}
                                className={`text-xs p-1 mb-1 rounded ${
                                  task.priority === 'HIGH' ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
                                }`}
                              >
                                <div className="font-medium truncate">{task.project}</div>
                                <div className="text-xs">
                                  {task.startTime.toLocaleTimeString('en-IN', { 
                                    hour: '2-digit', 
                                    minute: '2-digit',
                                    timeZone: 'Asia/Kolkata'
                                  })} - {task.endTime.toLocaleTimeString('en-IN', { 
                                    hour: '2-digit', 
                                    minute: '2-digit',
                                    timeZone: 'Asia/Kolkata'
                                  })}
                                </div>
                              </div>
                            ))}
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            // List View (Available/Busy)
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredEngineers.map(engineer => (
                <div
                  key={engineer.id}
                  onClick={() => showEngineerDetails(engineer)}
                  className="bg-white p-4 rounded-lg shadow hover:shadow-md transition-shadow cursor-pointer border-l-4 border-blue-500"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center">
                      <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center mr-3">
                        <User className="w-5 h-5 text-blue-600" />
                      </div>
                      <div>
                        <h3 className="font-medium text-gray-900">{engineer.name}</h3>
                        <p className="text-sm text-gray-600">@{engineer.username}</p>
                      </div>
                    </div>
                    <span className={`inline-flex items-center px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(engineer.status)}`}>
                      {getStatusIcon(engineer.status)}
                      <span className="ml-1 capitalize">{engineer.status}</span>
                    </span>
                  </div>

                  <div className="text-sm text-gray-600 space-y-1">
                    <div className="flex justify-between">
                      <span>Current Tasks:</span>
                      <span className="font-medium">{engineer.currentTasks}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Scheduled Tasks:</span>
                      <span className="font-medium">{engineer.futureTasks}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right Sidebar - Engineer Details */}
        <div className="w-96 bg-white shadow-lg border-l">
          <div className="p-6">
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
  );
};

export default EngineerManagementPage;
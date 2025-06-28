// pages/CreateTaskPage.jsx - Updated with improved time picker
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, RefreshCw, User } from 'lucide-react';
import axios from 'axios';
import { getToken } from '../utils/auth';
import { BASE_URL } from '../config/api';
import QuickTimePicker from '../components/QuickTimePicker';

const CreateTaskPage = () => {
  const navigate = useNavigate();
  const token = getToken();
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [availableEngineers, setAvailableEngineers] = useState([]);
  const [fetchingEngineers, setFetchingEngineers] = useState(false);
  
  // Get today's date for default values
  const today = new Date().toISOString().split('T')[0];
  
  const [taskForm, setTaskForm] = useState({
    engineerInCharge: '',
    project: '',
    timeSlots: [
      {
        id: 1,
        startDate: today,
        startTime: '09:00',
        endDate: today,
        endTime: '17:00'
      }
    ],
    assignedEngineers: [],
    contactNo: '',
    priority: 'NORMAL',
    remarks: ''
  });

  // Handle time slots change from QuickTimePicker
  const handleTimeSlotsChange = (newTimeSlots) => {
    setTaskForm(prev => ({
      ...prev,
      timeSlots: newTimeSlots
    }));
    
    // Clear available engineers when time slots change
    if (availableEngineers.length > 0) {
      setAvailableEngineers([]);
      setTaskForm(prev => ({
        ...prev,
        assignedEngineers: []
      }));
    }
  };

  // Fetch available engineers based on time slots
  const fetchAvailableEngineers = async () => {
    // Validate time slots first
    console.log('Validating time slots:', taskForm.timeSlots);
    const validTimeSlots = taskForm.timeSlots.filter(slot => 
      slot.startDate && slot.startTime && slot.endDate && slot.endTime
    );

    if (validTimeSlots.length === 0) {
      setError('Please specify at least one complete time slot to check engineer availability');
      return;
    }

    // Validate time slot logic
    for (const slot of validTimeSlots) {
      const startDateTime = new Date(`${slot.startDate}T${slot.startTime}`);
      const endDateTime = new Date(`${slot.endDate}T${slot.endTime}`);
      
      if (startDateTime >= endDateTime) {
        setError('End time must be after start time for all time slots');
        return;
      }
      
      if (startDateTime < new Date()) {
        setError('Start time cannot be in the past');
        return;
      }
    }

    setFetchingEngineers(true);
    setError('');

    try {
      // Convert time slots to IST (UTC+5:30) format for backend
      const timeSlots = validTimeSlots.map(slot => {
        // Create date objects in local timezone (IST)
        const startDateTime = new Date(`${slot.startDate}T${slot.startTime}:00`);
        const endDateTime = new Date(`${slot.endDate}T${slot.endTime}:00`);
        
        return {
          startDateTime: startDateTime.toISOString(),
          endDateTime: endDateTime.toISOString()
        };
      });

      const response = await axios.post(`${BASE_URL}/api/v1/engineers/available`, {
        timeSlots
      }, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = response.data;
      if (data.success) {
        setAvailableEngineers(data.engineers);
        if (data.engineers.length === 0) {
          setError('No engineers are available during the specified time slots. Please choose different times.');
        }
      } else {
        setError('Failed to fetch available engineers');
      }
    } catch (error) {
      console.error('Error fetching engineers:', error);
      setError(error.response?.data?.error || 'Failed to fetch available engineers');
    } finally {
      setFetchingEngineers(false);
    }
  };

  // Toggle engineer selection
  const toggleEngineerSelection = (engineer) => {
    setTaskForm(prev => {
      const isSelected = prev.assignedEngineers.some(e => e.id === engineer.id);
      if (isSelected) {
        return {
          ...prev,
          assignedEngineers: prev.assignedEngineers.filter(e => e.id !== engineer.id)
        };
      } else {
        return {
          ...prev,
          assignedEngineers: [...prev.assignedEngineers, engineer]
        };
      }
    });
  };

  // Submit task
  const handleSubmitTask = async () => {
    // Validation
    if (!taskForm.engineerInCharge.trim()) {
      setError('Engineer in charge is required');
      return;
    }
    if (!taskForm.project.trim()) {
      setError('Project name is required');
      return;
    }
    if (!taskForm.contactNo.trim()) {
      setError('Contact number is required');
      return;
    }

    // Validate time slots
    const validTimeSlots = taskForm.timeSlots.filter(slot => 
      slot.startDate && slot.startTime && slot.endDate && slot.endTime
    );

    if (validTimeSlots.length === 0) {
      setError('At least one complete time slot is required');
      return;
    }

    // Validate time slot logic
    for (const slot of validTimeSlots) {
      const startDateTime = new Date(`${slot.startDate}T${slot.startTime}`);
      const endDateTime = new Date(`${slot.endDate}T${slot.endTime}`);
      
      if (startDateTime >= endDateTime) {
        setError('End time must be after start time for all time slots');
        return;
      }
      
      if (startDateTime < new Date()) {
        setError('Start time cannot be in the past');
        return;
      }
    }

    setLoading(true);
    setError('');

    try {
      // Format data for submission - convert IST to UTC
      const taskData = {
        engineerInCharge: taskForm.engineerInCharge,
        project: taskForm.project,
        timeSlots: validTimeSlots.map(slot => {
          // Create date objects in local timezone (IST)
          const startDateTime = new Date(`${slot.startDate}T${slot.startTime}:00`);
          const endDateTime = new Date(`${slot.endDate}T${slot.endTime}:00`);
          
          return {
            startDateTime: startDateTime.toISOString(),
            endDateTime: endDateTime.toISOString()
          };
        }),
        assignedTo: taskForm.assignedEngineers.map(engineer => engineer.id),
        contactNo: taskForm.contactNo,
        priority: taskForm.priority,
        remarks: taskForm.remarks
      };

      const response = await axios.post(`${BASE_URL}/api/v1/tasks`, taskData, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = response.data;
      if (data.success) {
        alert('Task created successfully!');
        navigate('/manager');
      } else {
        if (data.conflicts) {
          // Handle availability conflicts
          setError(`Engineer availability conflict: ${data.error}`);
        } else {
          setError(data.error || 'Failed to create task');
        }
      }
    } catch (error) {
      console.error('Error creating task:', error);
      if (error.response?.status === 409) {
        // Conflict error - engineers not available
        setError(error.response.data.error || 'One or more engineers are not available during the specified time slots');
      } else {
        setError(error.response?.data?.error || 'Failed to create task. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center h-16">
            <button
              onClick={() => navigate('/manager')}
              className="mr-4 p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </button>
            <div>
              <h1 className="text-xl font-semibold text-gray-900">Create New Task</h1>
              <p className="text-sm text-gray-600">Schedule work and assign engineers</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className="mb-6 p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Task Details */}
          <div className="lg:col-span-2 space-y-6">
            {/* Basic Task Information */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Task Information</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Engineer in Charge *
                  </label>
                  <input
                    type="text"
                    value={taskForm.engineerInCharge}
                    onChange={(e) => setTaskForm({ ...taskForm, engineerInCharge: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Name of responsible engineer"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Contact Number *
                  </label>
                  <input
                    type="tel"
                    value={taskForm.contactNo}
                    onChange={(e) => setTaskForm({ ...taskForm, contactNo: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="+91-9876543210"
                  />
                </div>
              </div>

              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Project Name *
                </label>
                <input
                  type="text"
                  value={taskForm.project}
                  onChange={(e) => setTaskForm({ ...taskForm, project: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter project name"
                />
              </div>

              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Priority Level
                </label>
                <div className="flex items-center space-x-4">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      value="NORMAL"
                      checked={taskForm.priority === 'NORMAL'}
                      onChange={(e) => setTaskForm({ ...taskForm, priority: e.target.value })}
                      className="mr-2"
                    />
                    <div className="flex items-center">
                      <div className="w-3 h-3 bg-green-500 rounded mr-2"></div>
                      <span className="text-sm text-gray-700">Normal Priority</span>
                    </div>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      value="HIGH"
                      checked={taskForm.priority === 'HIGH'}
                      onChange={(e) => setTaskForm({ ...taskForm, priority: e.target.value })}
                      className="mr-2"
                    />
                    <div className="flex items-center">
                      <div className="w-3 h-3 bg-red-500 rounded mr-2"></div>
                      <span className="text-sm text-gray-700">High Priority</span>
                    </div>
                  </label>
                </div>
              </div>

              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Remarks (Optional)
                </label>
                <textarea
                  value={taskForm.remarks}
                  onChange={(e) => setTaskForm({ ...taskForm, remarks: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter any additional remarks or notes"
                />
              </div>
            </div>

            {/* Improved Time Picker */}
            <QuickTimePicker 
              timeSlots={taskForm.timeSlots}
              onTimeSlotsChange={handleTimeSlotsChange}
            />
          </div>

          {/* Right Column - Engineer Assignment */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-sm p-6 sticky top-8">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">
                  Assign Engineers
                </h3>
                <button
                  onClick={fetchAvailableEngineers}
                  disabled={fetchingEngineers}
                  className="inline-flex items-center px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm disabled:opacity-50"
                >
                  <RefreshCw className={`w-4 h-4 mr-1 ${fetchingEngineers ? 'animate-spin' : ''}`} />
                  Check Availability
                </button>
              </div>

              <p className="text-sm text-gray-600 mb-4">
                Complete the time slots above, then check engineer availability to assign team members.
              </p>

              {/* Selected Engineers */}
              {taskForm.assignedEngineers.length > 0 && (
                <div className="mb-4">
                  <h4 className="text-sm font-medium text-gray-900 mb-2">
                    Selected Engineers ({taskForm.assignedEngineers.length})
                  </h4>
                  <div className="space-y-2">
                    {taskForm.assignedEngineers.map((engineer) => (
                      <div key={engineer.id} className="flex items-center justify-between p-2 bg-blue-50 rounded-lg">
                        <div className="flex items-center">
                          <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center mr-3">
                            <User className="w-4 h-4 text-blue-600" />
                          </div>
                          <div>
                            <p className="font-medium text-blue-900 text-sm">{engineer.name}</p>
                            <p className="text-xs text-blue-700">{engineer.username}</p>
                          </div>
                        </div>
                        <button
                          onClick={() => toggleEngineerSelection(engineer)}
                          className="text-red-600 hover:text-red-800 text-xs"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Available Engineers List */}
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {fetchingEngineers ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-green-600 mx-auto"></div>
                    <p className="mt-2 text-sm text-gray-600">Checking availability...</p>
                  </div>
                ) : availableEngineers.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <User className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                    <p className="text-sm">Click "Check Availability" to see available engineers</p>
                  </div>
                ) : (
                  <>
                    <h4 className="text-sm font-medium text-gray-700 mb-2">
                      Available Engineers ({availableEngineers.length})
                    </h4>
                    {availableEngineers.map((engineer) => {
                      const isSelected = taskForm.assignedEngineers.some(e => e.id === engineer.id);
                      return (
                        <button
                          key={engineer.id}
                          onClick={() => toggleEngineerSelection(engineer)}
                          className={`w-full text-left p-3 rounded-lg border transition-colors ${
                            isSelected
                              ? 'border-blue-500 bg-blue-50 text-blue-900'
                              : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-medium">{engineer.name}</p>
                              <p className="text-sm text-gray-600">{engineer.username}</p>
                            </div>
                            {isSelected && (
                              <div className="w-4 h-4 bg-blue-600 rounded-full flex items-center justify-center">
                                <div className="w-2 h-2 bg-white rounded-full"></div>
                              </div>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Submit Button */}
        <div className="mt-8 flex justify-end">
          <div className="flex space-x-3">
            <button
              onClick={() => navigate('/manager')}
              className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmitTask}
              disabled={loading}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Creating Task...' : 'Create Task'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreateTaskPage;
// pages/CreateTaskPage.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, RefreshCw, Calendar, Clock, User } from 'lucide-react';
import axios from 'axios';
import { getToken } from '../utils/auth';
import { BASE_URL } from '../config/api';

const CreateTaskPage = () => {
  const navigate = useNavigate();
  const token = getToken();
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [availableEngineers, setAvailableEngineers] = useState([]);
  const [fetchingEngineers, setFetchingEngineers] = useState(false);
  
  const [taskForm, setTaskForm] = useState({
    engineerInCharge: '',
    project: '',
    timeSlots: [
      {
        id: 1,
        startDate: '',
        startTime: '',
        endDate: '',
        endTime: ''
      }
    ],
    assignedEngineers: [],
    contactNo: '',
    priority: 'NORMAL',
    remarks: ''
  });

  // Add new time slot
  const addTimeSlot = () => {
    const newTimeSlot = {
      id: Date.now(),
      startDate: '',
      startTime: '',
      endDate: '',
      endTime: ''
    };
    setTaskForm(prev => ({
      ...prev,
      timeSlots: [...prev.timeSlots, newTimeSlot]
    }));
  };

  // Remove time slot
  const removeTimeSlot = (id) => {
    if (taskForm.timeSlots.length > 1) {
      setTaskForm(prev => ({
        ...prev,
        timeSlots: prev.timeSlots.filter(slot => slot.id !== id)
      }));
    }
  };

  // Update time slot
  const updateTimeSlot = (id, field, value) => {
    setTaskForm(prev => ({
      ...prev,
      timeSlots: prev.timeSlots.map(slot =>
        slot.id === id ? { ...slot, [field]: value } : slot
      )
    }));
  };

  // Fetch available engineers based on time slots
  const fetchAvailableEngineers = async () => {
    // Validate time slots first
    const validTimeSlots = taskForm.timeSlots.filter(slot => 
      slot.startDate && slot.startTime && slot.endDate && slot.endTime
    );

    if (validTimeSlots.length === 0) {
      setError('Please specify at least one complete time slot to check engineer availability');
      return;
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
        setError(data.error || 'Failed to create task');
      }
    } catch (error) {
      console.error('Error creating task:', error);
      setError(error.response?.data?.error || 'Failed to create task. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Get today's date for min date input
  const today = new Date().toISOString().split('T')[0];

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
              <h1 className="text-xl font-semibold text-gray-900">Create New Task</h1>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Form */}
          <div className="lg:col-span-2 space-y-6">
            {/* Basic Information */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Basic Information</h3>
              
              {error && (
                <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded-lg">
                  {error}
                </div>
              )}

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
                    placeholder="Enter engineer name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Project *
                  </label>
                  <input
                    type="text"
                    value={taskForm.project}
                    onChange={(e) => setTaskForm({ ...taskForm, project: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter project name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Contact Number *
                  </label>
                  <input
                    type="text"
                    value={taskForm.contactNo}
                    onChange={(e) => setTaskForm({ ...taskForm, contactNo: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter contact number"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Priority Level *
                  </label>
                  <select
                    value={taskForm.priority}
                    onChange={(e) => setTaskForm({ ...taskForm, priority: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="NORMAL">Normal</option>
                    <option value="HIGH">High</option>
                  </select>
                  <div className="mt-1 flex items-center">
                    <div className={`w-3 h-3 rounded-full mr-2 ${
                      taskForm.priority === 'HIGH' ? 'bg-red-500' : 'bg-green-500'
                    }`}></div>
                    <span className="text-xs text-gray-600">
                      {taskForm.priority === 'HIGH' ? 'High Priority (Red)' : 'Normal Priority (Green)'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Remarks
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

            {/* Time Slots */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Time Slots *</h3>
                <button
                  onClick={addTimeSlot}
                  className="inline-flex items-center px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Add Slot
                </button>
              </div>

              <div className="space-y-4">
                {taskForm.timeSlots.map((slot, index) => (
                  <div key={slot.id} className="p-4 border border-gray-200 rounded-lg">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-medium text-gray-900">Time Slot {index + 1}</h4>
                      {taskForm.timeSlots.length > 1 && (
                        <button
                          onClick={() => removeTimeSlot(slot.id)}
                          className="p-1 text-red-400 hover:text-red-600 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Start Date & Time
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                          <input
                            type="date"
                            value={slot.startDate}
                            onChange={(e) => updateTimeSlot(slot.id, 'startDate', e.target.value)}
                            min={today}
                            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                          <input
                            type="time"
                            value={slot.startTime}
                            onChange={(e) => updateTimeSlot(slot.id, 'startTime', e.target.value)}
                            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          End Date & Time
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                          <input
                            type="date"
                            value={slot.endDate}
                            onChange={(e) => updateTimeSlot(slot.id, 'endDate', e.target.value)}
                            min={slot.startDate || today}
                            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                          <input
                            type="time"
                            value={slot.endTime}
                            onChange={(e) => updateTimeSlot(slot.id, 'endTime', e.target.value)}
                            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Available Engineers Sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-sm p-6 sticky top-8">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Available Engineers</h3>
                <button
                  onClick={fetchAvailableEngineers}
                  disabled={fetchingEngineers}
                  className="inline-flex items-center px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm disabled:opacity-50"
                >
                  <RefreshCw className={`w-4 h-4 mr-1 ${fetchingEngineers ? 'animate-spin' : ''}`} />
                  Refresh
                </button>
              </div>

              <p className="text-sm text-gray-600 mb-4">
                Click "Refresh" to check engineer availability based on your specified time slots.
              </p>

              {/* Selected Engineers */}
              {taskForm.assignedEngineers.length > 0 && (
                <div className="mb-4">
                  <h4 className="text-sm font-medium text-gray-900 mb-2">Selected Engineers ({taskForm.assignedEngineers.length})</h4>
                  <div className="space-y-2">
                    {taskForm.assignedEngineers.map((engineer) => (
                      <div key={engineer.id} className="flex items-center justify-between p-2 bg-blue-50 rounded-lg">
                        <span className="text-sm font-medium text-blue-900">{engineer.name}</span>
                        <button
                          onClick={() => toggleEngineerSelection(engineer)}
                          className="text-blue-600 hover:text-blue-800 text-xs"
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
                {availableEngineers.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <User className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                    <p className="text-sm">No engineers data available</p>
                    <p className="text-xs">Set time slots and click refresh</p>
                  </div>
                ) : (
                  availableEngineers.map((engineer) => {
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
                  })
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
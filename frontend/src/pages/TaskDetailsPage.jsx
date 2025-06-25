// pages/TaskDetailsPage.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
  // Add import for CheckCircle
import { ArrowLeft, Edit2, Save, X, Plus, Trash2, RefreshCw, User, Clock, CheckCircle } from 'lucide-react';
import axios from 'axios';
import { getToken } from '../utils/auth';
import { BASE_URL } from '../config/api';

const TaskDetailsPage = () => {
  const navigate = useNavigate();
  const { taskId } = useParams();
  const token = getToken();
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [task, setTask] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [error, setError] = useState('');
  const [availableEngineers, setAvailableEngineers] = useState([]);
  const [fetchingEngineers, setFetchingEngineers] = useState(false);
  
  const [editForm, setEditForm] = useState({
    project: '',
    timeSlots: [],
    assignedTo: [],
    contactNo: '',
    priority: 'NORMAL',
    remarks: ''
  });

  useEffect(() => {
    fetchTaskDetails();
  }, [taskId]);

  // Initialize available engineers with currently assigned engineers when editing starts
  useEffect(() => {
    if (isEditing && task && task.assignedUsers) {
      // Set initially available engineers to currently assigned engineers
      setAvailableEngineers(task.assignedUsers.map(user => ({
        id: user.id,
        username: user.username,
        name: user.name,
        role: 'ENGINEER',
        isCurrentlyAssigned: true
      })));
    }
  }, [isEditing, task]);

  const fetchTaskDetails = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${BASE_URL}/api/v1/tasks/${taskId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = response.data;
      if (data.success) {
        setTask(data.task);
        
        // Initialize edit form
        setEditForm({
          project: data.task.project,
          timeSlots: data.task.timeSlots.map((slot, index) => {
            // Convert UTC times from database to local time for editing
            const startDate = new Date(slot.startDateTime);
            const endDate = new Date(slot.endDateTime);
            
            return {
              id: index + 1,
              startDate: startDate.toLocaleDateString('en-CA'), // YYYY-MM-DD format
              startTime: startDate.toLocaleTimeString('en-GB', { hour12: false }).substring(0, 5), // HH:MM format
              endDate: endDate.toLocaleDateString('en-CA'),
              endTime: endDate.toLocaleTimeString('en-GB', { hour12: false }).substring(0, 5)
            };
          }),
          assignedTo: data.task.assignedTo || [],
          contactNo: data.task.contactNo,
          priority: data.task.priority,
          remarks: data.task.remarks || ''
        });
      } else {
        setError('Failed to fetch task details');
      }
    } catch (error) {
      console.error('Error fetching task:', error);
      setError('Failed to fetch task details');
    } finally {
      setLoading(false);
    }
  };

  const fetchAvailableEngineers = async () => {
    // Only consider future time slots
    const currentTime = new Date();
    const futureTimeSlots = editForm.timeSlots.filter(slot => {
      // Create date in local timezone for comparison
      const endDateTime = new Date(`${slot.endDate}T${slot.endTime}`);
      return endDateTime > currentTime;
    }).filter(slot => slot.startDate && slot.startTime && slot.endDate && slot.endTime);

    if (futureTimeSlots.length === 0) {
      setError('Please specify at least one complete future time slot to check engineer availability');
      return;
    }

    setFetchingEngineers(true);
    setError('');

    try {
      const timeSlots = futureTimeSlots.map(slot => {
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
        // Combine available engineers with currently assigned engineers
        // to ensure we can show and manage currently assigned engineers
        const currentlyAssignedEngineers = task.assignedUsers || [];
        const availableEngineersSet = new Set(data.engineers.map(eng => eng.id));
        
        // Add currently assigned engineers to the list if they're not already there
        const allEngineers = [...data.engineers];
        currentlyAssignedEngineers.forEach(assignedEng => {
          if (!availableEngineersSet.has(assignedEng.id)) {
            allEngineers.push({
              id: assignedEng.id,
              username: assignedEng.username,
              name: assignedEng.name,
              role: 'ENGINEER',
              isCurrentlyAssigned: true // Flag to show they're currently assigned but not available
            });
          }
        });
        
        setAvailableEngineers(allEngineers);
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

  const addTimeSlot = () => {
    const newTimeSlot = {
      id: Date.now(),
      startDate: '',
      startTime: '',
      endDate: '',
      endTime: ''
    };
    setEditForm(prev => ({
      ...prev,
      timeSlots: [...prev.timeSlots, newTimeSlot]
    }));
  };

  const removeTimeSlot = (id) => {
    if (editForm.timeSlots.length > 1) {
      setEditForm(prev => ({
        ...prev,
        timeSlots: prev.timeSlots.filter(slot => slot.id !== id)
      }));
    }
  };

  const updateTimeSlot = (id, field, value) => {
    setEditForm(prev => ({
      ...prev,
      timeSlots: prev.timeSlots.map(slot =>
        slot.id === id ? { ...slot, [field]: value } : slot
      )
    }));
  };

  const toggleEngineerSelection = (engineer) => {
    setEditForm(prev => {
      const isSelected = prev.assignedTo.includes(engineer.id);
      if (isSelected) {
        return {
          ...prev,
          assignedTo: prev.assignedTo.filter(id => id !== engineer.id)
        };
      } else {
        return {
          ...prev,
          assignedTo: [...prev.assignedTo, engineer.id]
        };
      }
    });
  };

  const handleSave = async () => {
    // Validation
    if (!editForm.project.trim()) {
      setError('Project name is required');
      return;
    }
    if (!editForm.contactNo.trim()) {
      setError('Contact number is required');
      return;
    }

    // Validate time slots - only consider future slots
    const currentTime = new Date();
    const futureTimeSlots = editForm.timeSlots.filter(slot => {
      const endDateTime = new Date(`${slot.endDate}T${slot.endTime}`);
      return endDateTime > currentTime && slot.startDate && slot.startTime && slot.endDate && slot.endTime;
    });

    if (futureTimeSlots.length === 0) {
      setError('At least one complete future time slot is required');
      return;
    }

    // Validate time slot logic
    for (const slot of futureTimeSlots) {
      const startDateTime = new Date(`${slot.startDate}T${slot.startTime}`);
      const endDateTime = new Date(`${slot.endDate}T${slot.endTime}`);
      
      if (startDateTime >= endDateTime) {
        setError('End time must be after start time for all time slots');
        return;
      }
    }

    setSaving(true);
    setError('');

    try {
      const updateData = {
        project: editForm.project,
        timeSlots: futureTimeSlots.map(slot => {
          // Create date objects in local timezone (IST)
          const startDateTime = new Date(`${slot.startDate}T${slot.startTime}:00`);
          const endDateTime = new Date(`${slot.endDate}T${slot.endTime}:00`);
          
          return {
            startDateTime: startDateTime.toISOString(),
            endDateTime: endDateTime.toISOString()
          };
        }),
        assignedTo: editForm.assignedTo,
        contactNo: editForm.contactNo,
        priority: editForm.priority,
        remarks: editForm.remarks
      };

      const response = await axios.put(`${BASE_URL}/api/v1/tasks/${taskId}`, updateData, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = response.data;
      if (data.success) {
        setIsEditing(false);
        fetchTaskDetails(); // Refresh task data
        alert('Task updated successfully!');
      } else {
        setError(data.error || 'Failed to update task');
      }
    } catch (error) {
      console.error('Error updating task:', error);
      setError(error.response?.data?.error || 'Failed to update task. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    setError('');
    // Reset form to original task data
    if (task) {
      setEditForm({
        project: task.project,
        timeSlots: task.timeSlots.map((slot, index) => {
          // Convert UTC times from database to local time for editing
          const startDate = new Date(slot.startDateTime);
          const endDate = new Date(slot.endDateTime);
          
          return {
            id: index + 1,
            startDate: startDate.toLocaleDateString('en-CA'),
            startTime: startDate.toLocaleTimeString('en-GB', { hour12: false }).substring(0, 5),
            endDate: endDate.toLocaleDateString('en-CA'),
            endTime: endDate.toLocaleTimeString('en-GB', { hour12: false }).substring(0, 5)
          };
        }),
        assignedTo: task.assignedTo || [],
        contactNo: task.contactNo,
        priority: task.priority,
        remarks: task.remarks || ''
      });
    }
  };

  const getPriorityColor = (priority) => {
    return priority === 'HIGH' 
      ? 'bg-red-100 text-red-800' 
      : 'bg-green-100 text-green-800';
  };

  const formatDateTime = (dateTimeString) => {
    // Convert UTC time from database to local time (IST) for display
    const date = new Date(dateTimeString);
    return date.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' }) + ' ' + 
           date.toLocaleTimeString('en-IN', { 
             hour: '2-digit', 
             minute: '2-digit',
             timeZone: 'Asia/Kolkata'
           });
  };

  const today = new Date().toISOString().split('T')[0];
  const currentTime = new Date();

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading task details...</p>
        </div>
      </div>
    );
  }

  if (!task) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">Task not found</p>
          <button
            onClick={() => navigate('/manager')}
            className="mt-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Back to Dashboard
          </button>
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
              <h1 className="text-xl font-semibold text-gray-900">Task Details</h1>
            </div>
            
            <div className="flex items-center space-x-3">
              {task.status === 'COMPLETED' ? (
                <div className="flex items-center space-x-2 px-4 py-2 bg-green-100 text-green-800 rounded-lg">
                  <CheckCircle className="w-4 h-4" />
                  <span className="text-sm font-medium">Task Completed - Read Only</span>
                </div>
              ) : !isEditing ? (
                <button
                  onClick={() => setIsEditing(true)}
                  className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Edit2 className="w-4 h-4 mr-2" />
                  Edit Task
                </button>
              ) : (
                <>
                  <button
                    onClick={handleCancel}
                    className="inline-flex items-center px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <X className="w-4 h-4 mr-2" />
                    Cancel
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                  >
                    <Save className="w-4 h-4 mr-2" />
                    {saving ? 'Saving...' : 'Save Changes'}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Details */}
          <div className="lg:col-span-2 space-y-6">
            {error && (
              <div className="p-3 bg-red-100 border border-red-400 text-red-700 rounded-lg">
                {error}
              </div>
            )}

            {/* Basic Information */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Basic Information</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Project
                  </label>
                  {isEditing ? (
                    <input
                      type="text"
                      value={editForm.project}
                      onChange={(e) => setEditForm({ ...editForm, project: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  ) : (
                    <p className="text-gray-900">{task.project}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Contact Number
                  </label>
                  {isEditing ? (
                    <input
                      type="text"
                      value={editForm.contactNo}
                      onChange={(e) => setEditForm({ ...editForm, contactNo: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  ) : (
                    <p className="text-gray-900">{task.contactNo}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Priority
                  </label>
                  {isEditing ? (
                    <select
                      value={editForm.priority}
                      onChange={(e) => setEditForm({ ...editForm, priority: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="NORMAL">Normal</option>
                      <option value="HIGH">High</option>
                    </select>
                  ) : (
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getPriorityColor(task.priority)}`}>
                      {task.priority}
                    </span>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Created By
                  </label>
                  <p className="text-gray-900">{task.createdBy?.name || 'Unknown'}</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Status
                  </label>
                  <span className={`inline-flex px-3 py-1 text-sm font-semibold rounded-full ${
                    task.status === 'COMPLETED' 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-blue-100 text-blue-800'
                  }`}>
                    {task.status === 'COMPLETED' ? '✓ Completed' : 'Active'}
                  </span>
                </div>
              </div>

              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Remarks
                </label>
                {isEditing ? (
                  <textarea
                    value={editForm.remarks}
                    onChange={(e) => setEditForm({ ...editForm, remarks: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                ):<></>}
              </div>
            </div>

              {/* Time Slots */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Time Slots</h3>
                {isEditing && task.status !== 'COMPLETED' && (
                  <button
                    onClick={addTimeSlot}
                    className="inline-flex items-center px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Add Slot
                  </button>
                )}
              </div>

              {task.status === 'COMPLETED' && (
                <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-center">
                    <CheckCircle className="w-4 h-4 text-green-600 mr-2" />
                    <span className="text-sm text-green-800 font-medium">
                      This task has been completed. All time slots are in the past and cannot be modified.
                    </span>
                  </div>
                </div>
              )}

              {isEditing && task.status !== 'COMPLETED' ? (
                <div className="space-y-4">
                  {editForm.timeSlots.map((slot, index) => {
                    const endDateTime = new Date(`${slot.endDate}T${slot.endTime}`);
                    const isPast = endDateTime <= currentTime;
                    
                    return (
                      <div key={slot.id} className={`p-4 border rounded-lg ${
                        isPast ? 'bg-gray-50 border-gray-200' : 
                        task.status === 'COMPLETED' ? 'bg-green-50 border-green-200' :
                        'border-gray-200'
                      }`}>
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="font-medium text-gray-900">
                            Time Slot {index + 1}
                            {isPast && <span className="ml-2 text-xs text-red-600">(Past - Read Only)</span>}
                            {task.status === 'COMPLETED' && <span className="ml-2 text-xs text-green-600">(Completed)</span>}
                          </h4>
                          {editForm.timeSlots.length > 1 && !isPast && task.status !== 'COMPLETED' && (
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
                                min={isPast ? undefined : today}
                                disabled={isPast || task.status === 'COMPLETED'}
                                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
                              />
                              <input
                                type="time"
                                value={slot.startTime}
                                onChange={(e) => updateTimeSlot(slot.id, 'startTime', e.target.value)}
                                disabled={isPast || task.status === 'COMPLETED'}
                                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
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
                                min={slot.startDate || (isPast ? undefined : today)}
                                disabled={isPast || task.status === 'COMPLETED'}
                                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
                              />
                              <input
                                type="time"
                                value={slot.endTime}
                                onChange={(e) => updateTimeSlot(slot.id, 'endTime', e.target.value)}
                                disabled={isPast || task.status === 'COMPLETED'}
                                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="space-y-3">
                  {task.timeSlots.map((slot, index) => {
                    const startDate = new Date(slot.startDateTime);
                    const endDate = new Date(slot.endDateTime);
                    const isPast = endDate <= currentTime;
                    
                    return (
                      <div key={index} className={`p-3 rounded-lg border ${
                        isPast ? 'bg-gray-50 border-gray-200' : 
                        task.status === 'COMPLETED' ? 'bg-green-50 border-green-200' :
                        'bg-blue-50 border-blue-200'
                      }`}>
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium text-gray-900">
                              Slot {index + 1}
                              {isPast && <span className="ml-2 text-xs text-red-600">(Completed)</span>}
                            </p>
                            <p className="text-sm text-gray-600">
                              {formatDateTime(slot.startDateTime)} - {formatDateTime(slot.endDateTime)}
                            </p>
                          </div>
                          <Clock className={`w-5 h-5 ${
                            task.status === 'COMPLETED' ? 'text-green-600' :
                            isPast ? 'text-gray-400' : 'text-blue-600'
                          }`} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Assigned Engineers Sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-sm p-6 sticky top-8">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">
                  {isEditing ? 'Assign Engineers' : 'Assigned Engineers'}
                </h3>
                {isEditing && (
                  <button
                    onClick={fetchAvailableEngineers}
                    disabled={fetchingEngineers}
                    className="inline-flex items-center px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm disabled:opacity-50"
                  >
                    <RefreshCw className={`w-4 h-4 mr-1 ${fetchingEngineers ? 'animate-spin' : ''}`} />
                    Refresh
                  </button>
                )}
              </div>

              {isEditing && (
                <p className="text-sm text-gray-600 mb-4">
                  Currently assigned engineers are shown below. Click "Refresh" to check availability for new time slots.
                </p>
              )}

              {/* Currently Assigned Engineers */}
              {!isEditing ? (
                <div className="space-y-2">
                  {task.assignedUsers && task.assignedUsers.length > 0 ? (
                    task.assignedUsers.map((engineer) => (
                      <div key={engineer.id} className="flex items-center p-3 bg-blue-50 rounded-lg">
                        <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center mr-3">
                          <User className="w-4 h-4 text-blue-600" />
                        </div>
                        <div>
                          <p className="font-medium text-blue-900">{engineer.name}</p>
                          <p className="text-sm text-blue-700">{engineer.username}</p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-4 text-gray-500">
                      <User className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                      <p className="text-sm">No engineers assigned</p>
                    </div>
                  )}
                </div>
              ) : (
                <>
                  {/* Selected Engineers in Edit Mode */}
                  {editForm.assignedTo.length > 0 && (
                    <div className="mb-4">
                      <h4 className="text-sm font-medium text-gray-900 mb-2">
                        Selected Engineers ({editForm.assignedTo.length})
                      </h4>
                      <div className="space-y-2">
                        {availableEngineers
                          .filter(engineer => editForm.assignedTo.includes(engineer.id))
                          .map((engineer) => (
                            <div key={engineer.id} className={`flex items-center justify-between p-2 rounded-lg ${
                              engineer.isCurrentlyAssigned ? 'bg-yellow-50 border border-yellow-200' : 'bg-blue-50'
                            }`}>
                              <div>
                                <span className="text-sm font-medium text-blue-900">{engineer.name}</span>
                                {engineer.isCurrentlyAssigned && (
                                  <span className="ml-2 text-xs text-yellow-600 font-medium">(Currently Assigned)</span>
                                )}
                              </div>
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
                        <p className="text-xs">Currently assigned engineers will appear when you start editing</p>
                      </div>
                    ) : (
                      <>
                        {/* Currently Available Engineers */}
                        {availableEngineers.filter(eng => !eng.isCurrentlyAssigned).length > 0 && (
                          <>
                            <h5 className="text-xs font-medium text-gray-700 mb-2 mt-4">Available Engineers:</h5>
                            {availableEngineers
                              .filter(engineer => !engineer.isCurrentlyAssigned)
                              .map((engineer) => {
                                const isSelected = editForm.assignedTo.includes(engineer.id);
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

                        {/* Currently Assigned Engineers (if not selected) */}
                        {availableEngineers.filter(eng => eng.isCurrentlyAssigned && !editForm.assignedTo.includes(eng.id)).length > 0 && (
                          <>
                            <h5 className="text-xs font-medium text-gray-700 mb-2 mt-4">Previously Assigned Engineers:</h5>
                            {availableEngineers
                              .filter(engineer => engineer.isCurrentlyAssigned && !editForm.assignedTo.includes(engineer.id))
                              .map((engineer) => (
                                <button
                                  key={engineer.id}
                                  onClick={() => toggleEngineerSelection(engineer)}
                                  className="w-full text-left p-3 rounded-lg border border-yellow-200 bg-yellow-50 hover:bg-yellow-100 transition-colors"
                                >
                                  <div className="flex items-center justify-between">
                                    <div>
                                      <p className="font-medium text-yellow-900">{engineer.name}</p>
                                      <p className="text-sm text-yellow-700">{engineer.username}</p>
                                      <p className="text-xs text-yellow-600">Currently assigned (may have conflicts)</p>
                                    </div>
                                  </div>
                                </button>
                              ))}
                          </>
                        )}
                      </>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TaskDetailsPage;
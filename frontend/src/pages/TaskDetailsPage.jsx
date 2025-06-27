// pages/TaskDetailsPage.jsx - Updated with improved time picker
import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Edit2, Save, X, RefreshCw, User, Clock, CheckCircle } from 'lucide-react';
import axios from 'axios';
import { getToken } from '../utils/auth';
import { BASE_URL } from '../config/api';
import QuickTimePicker from '../components/QuickTimePicker';

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
        headers: { 'Authorization': `Bearer ${token}` }
      });

      const data = response.data;
      if (data.success) {
        setTask(data.task);
        
        // Convert task data to edit form format
        const timeSlots = data.task.timeSlots.map((slot, index) => ({
          id: index + 1,
          startDate: new Date(slot.startDateTime).toISOString().split('T')[0],
          startTime: new Date(slot.startDateTime).toTimeString().slice(0, 5),
          endDate: new Date(slot.endDateTime).toISOString().split('T')[0],
          endTime: new Date(slot.endDateTime).toTimeString().slice(0, 5)
        }));

        setEditForm({
          project: data.task.project,
          timeSlots: timeSlots,
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
    // Validate time slots first
    const validTimeSlots = editForm.timeSlots.filter(slot => 
      slot.startDate && slot.startTime && slot.endDate && slot.endTime
    );

    if (validTimeSlots.length === 0) {
      setError('Please specify at least one complete time slot to check engineer availability');
      return;
    }

    setFetchingEngineers(true);
    setError('');

    try {
      // Convert time slots to ISO format for backend
      const timeSlots = validTimeSlots.map(slot => {
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
        // Combine available engineers with currently assigned ones
        const currentlyAssigned = task.assignedUsers || [];
        const availableWithAssigned = [
          ...currentlyAssigned.map(user => ({
            ...user,
            role: 'ENGINEER',
            isCurrentlyAssigned: true
          })),
          ...data.engineers.filter(eng => 
            !currentlyAssigned.some(assigned => assigned.id === eng.id)
          )
        ];
        
        setAvailableEngineers(availableWithAssigned);
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

  // Handle time slots change from QuickTimePicker
  const handleTimeSlotsChange = (newTimeSlots) => {
    setEditForm(prev => ({
      ...prev,
      timeSlots: newTimeSlots
    }));
    
    // Clear available engineers when time slots change (except currently assigned)
    if (availableEngineers.length > 0) {
      const currentlyAssigned = availableEngineers.filter(eng => eng.isCurrentlyAssigned);
      setAvailableEngineers(currentlyAssigned);
    }
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
        if (data.conflicts) {
          // Handle availability conflicts
          setError(`Engineer availability conflict: ${data.error}`);
        } else {
          setError(data.error || 'Failed to update task');
        }
      }
    } catch (error) {
      console.error('Error updating task:', error);
      if (error.response?.status === 409) {
        // Conflict error - engineers not available
        setError(error.response.data.error || 'One or more engineers are not available during the specified time slots');
      } else {
        setError(error.response?.data?.error || 'Failed to update task. Please try again.');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setError('');
    setAvailableEngineers([]);
    // Reset form to original task data
    if (task) {
      const timeSlots = task.timeSlots.map((slot, index) => ({
        id: index + 1,
        startDate: new Date(slot.startDateTime).toISOString().split('T')[0],
        startTime: new Date(slot.startDateTime).toTimeString().slice(0, 5),
        endDate: new Date(slot.endDateTime).toISOString().split('T')[0],
        endTime: new Date(slot.endDateTime).toTimeString().slice(0, 5)
      }));

      setEditForm({
        project: task.project,
        timeSlots: timeSlots,
        assignedTo: task.assignedTo || [],
        contactNo: task.contactNo,
        priority: task.priority,
        remarks: task.remarks || ''
      });
    }
  };

  const formatDateTime = (dateTimeString) => {
    const date = new Date(dateTimeString);
    return date.toLocaleString('en-IN', { 
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getPriorityColor = (priority) => {
    return priority === 'HIGH' 
      ? 'bg-red-100 text-red-800' 
      : 'bg-green-100 text-green-800';
  };

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
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Task Not Found</h2>
          <p className="text-gray-600 mb-4">The task you're looking for doesn't exist.</p>
          <button
            onClick={() => navigate('/manager')}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const currentTime = new Date();
  const canEdit = task.status !== 'COMPLETED';

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <button
                onClick={() => navigate('/manager')}
                className="mr-4 p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-gray-600" />
              </button>
              <div>
                <h1 className="text-xl font-semibold text-gray-900">Task Details</h1>
                <p className="text-sm text-gray-600">{task.project}</p>
              </div>
            </div>

            {canEdit && (
              <div className="flex space-x-2">
                {!isEditing ? (
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
                      onClick={handleCancelEdit}
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
            )}
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
              
              {isEditing ? (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Project Name</label>
                    <input
                      type="text"
                      value={editForm.project}
                      onChange={(e) => setEditForm({ ...editForm, project: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Contact Number</label>
                      <input
                        type="tel"
                        value={editForm.contactNo}
                        onChange={(e) => setEditForm({ ...editForm, contactNo: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Priority Level</label>
                      <div className="flex space-x-4">
                        <label className="flex items-center">
                          <input
                            type="radio"
                            value="NORMAL"
                            checked={editForm.priority === 'NORMAL'}
                            onChange={(e) => setEditForm({ ...editForm, priority: e.target.value })}
                            className="mr-2"
                          />
                          <div className="flex items-center">
                            <div className="w-3 h-3 bg-green-500 rounded mr-2"></div>
                            <span className="text-sm">Normal</span>
                          </div>
                        </label>
                        <label className="flex items-center">
                          <input
                            type="radio"
                            value="HIGH"
                            checked={editForm.priority === 'HIGH'}
                            onChange={(e) => setEditForm({ ...editForm, priority: e.target.value })}
                            className="mr-2"
                          />
                          <div className="flex items-center">
                            <div className="w-3 h-3 bg-red-500 rounded mr-2"></div>
                            <span className="text-sm">High</span>
                          </div>
                        </label>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Remarks</label>
                    <textarea
                      value={editForm.remarks}
                      onChange={(e) => setEditForm({ ...editForm, remarks: e.target.value })}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Enter any additional remarks or notes"
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <h4 className="text-sm font-medium text-gray-700">Project</h4>
                    <p className="text-lg text-gray-900">{task.project}</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <h4 className="text-sm font-medium text-gray-700">Contact Number</h4>
                      <p className="text-gray-900">{task.contactNo}</p>
                    </div>

                    <div>
                      <h4 className="text-sm font-medium text-gray-700">Priority</h4>
                      <span className={`inline-flex items-center px-2 py-1 text-xs font-semibold rounded-full ${getPriorityColor(task.priority)}`}>
                        {task.priority}
                      </span>
                    </div>
                  </div>

                  {task.remarks && (
                    <div>
                      <h4 className="text-sm font-medium text-gray-700">Remarks</h4>
                      <p className="text-gray-900">{task.remarks}</p>
                    </div>
                  )}

                  <div>
                    <h4 className="text-sm font-medium text-gray-700">Status</h4>
                    <span className={`inline-flex items-center px-2 py-1 text-xs font-semibold rounded-full ${
                      task.status === 'COMPLETED' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'
                    }`}>
                      {task.status === 'COMPLETED' && <CheckCircle className="w-3 h-3 mr-1" />}
                      {task.status}
                    </span>
                  </div>

                  <div>
                    <h4 className="text-sm font-medium text-gray-700">Created By</h4>
                    <p className="text-gray-900">{task.createdBy?.name || 'Unknown'}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Time Slots Section */}
            {isEditing ? (
              <QuickTimePicker 
                timeSlots={editForm.timeSlots}
                onTimeSlotsChange={handleTimeSlotsChange}
              />
            ) : (
              <div className="bg-white rounded-lg shadow-sm p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                  <Clock className="w-5 h-5 mr-2 text-blue-600" />
                  Schedule
                </h3>
                <div className="space-y-3">
                  {task.timeSlots.map((slot, index) => {
                    const startDate = new Date(slot.startDateTime);
                    const endDate = new Date(slot.endDateTime);
                    const isPast = endDate <= currentTime;
                    
                    return (
                      <div key={index} className={`p-4 rounded-lg border ${
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
              </div>
            )}
          </div>

          {/* Right Column - Engineer Assignment */}
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
                    {fetchingEngineers ? (
                      <div className="text-center py-8">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-green-600 mx-auto"></div>
                        <p className="mt-2 text-sm text-gray-600">Checking availability...</p>
                      </div>
                    ) : availableEngineers.length === 0 ? (
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
                                  className="w-full text-left p-3 rounded-lg border border-yellow-200 hover:border-yellow-300 hover:bg-yellow-50 transition-colors"
                                >
                                  <div className="flex items-center justify-between">
                                    <div>
                                      <p className="font-medium text-gray-900">{engineer.name}</p>
                                      <p className="text-sm text-gray-600">{engineer.username}</p>
                                      <p className="text-xs text-yellow-600">Previously assigned</p>
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
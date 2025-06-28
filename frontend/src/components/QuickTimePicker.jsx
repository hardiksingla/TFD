// components/QuickTimePicker.jsx
import React, { useState } from 'react';
import { Clock, Calendar, Copy, Plus, Trash2, Zap } from 'lucide-react';

const QuickTimePicker = ({ timeSlots, onTimeSlotsChange, className = "" }) => {
  const [activeSlot, setActiveSlot] = useState(0);

  // Quick preset options
  const timePresets = [
    { label: "Morning (9 AM - 12 PM)", start: "09:00", end: "12:00", duration: 3 },
    { label: "Afternoon (1 PM - 5 PM)", start: "13:00", end: "17:00", duration: 4 },
    { label: "Full Day (9 AM - 5 PM)", start: "09:00", end: "17:00", duration: 8 },
    { label: "Half Day (9 AM - 1 PM)", start: "09:00", end: "13:00", duration: 4 },
    { label: "Evening (2 PM - 6 PM)", start: "14:00", end: "18:00", duration: 4 },
    { label: "Extended (8 AM - 6 PM)", start: "08:00", end: "18:00", duration: 10 }
  ];

  // Duration presets
  const durationPresets = [
    { label: "30 min", hours: 0, minutes: 30 },
    { label: "1 hour", hours: 1, minutes: 0 },
    { label: "2 hours", hours: 2, minutes: 0 },
    { label: "4 hours", hours: 4, minutes: 0 },
    { label: "8 hours", hours: 8, minutes: 0 }
  ];

  // Get today's date in YYYY-MM-DD format
  const today = new Date().toISOString().split('T')[0];

  // Add new time slot
  const addTimeSlot = () => {
    const newSlot = {
      id: Date.now(),
      startDate: today,
      startTime: '09:00',
      endDate: today,
      endTime: '17:00'
    };
    onTimeSlotsChange([...timeSlots, newSlot]);
    setActiveSlot(timeSlots.length);
  };

  // Remove time slot
  const removeTimeSlot = (id) => {
    if (timeSlots.length > 1) {
      const newSlots = timeSlots.filter(slot => slot.id !== id);
      onTimeSlotsChange(newSlots);
      if (activeSlot >= newSlots.length) {
        setActiveSlot(Math.max(0, newSlots.length - 1));
      }
    }
  };

  // Update specific time slot
  const updateTimeSlot = (id, field, value) => {
    // console.log(`Updating slot ${id} field ${field} to ${value}`);
    const newSlots = timeSlots.map(slot =>
      slot.id === id ? { ...slot, [field]: value } : slot
    );
    onTimeSlotsChange(newSlots);
  };
  const updateTimeSlot2 = (id, field, field2, value) => {
    // console.log(`Updating slot ${id} field ${field} to ${value}`);
    const newSlots = timeSlots.map(slot =>
      slot.id === id ? { ...slot, [field]: value , [field2]:value } : slot
    );
    onTimeSlotsChange(newSlots);
  };
  // Apply time preset to current slot
  const applyTimePreset = (preset) => {
    const currentSlot = timeSlots[activeSlot];
    if (!currentSlot) return;

    const updatedSlot = {
      ...currentSlot,
      startTime: preset.start,
      endTime: preset.end,
      startDate: currentSlot.startDate || today,
      endDate: currentSlot.endDate || today
    };

    const newSlots = timeSlots.map(slot =>
      slot.id === currentSlot.id ? updatedSlot : slot
    );
    onTimeSlotsChange(newSlots);
  };

  // Apply duration from start time
  const applyDuration = (duration) => {
    const currentSlot = timeSlots[activeSlot];
    if (!currentSlot || !currentSlot.startTime) return;

    const [startHours, startMinutes] = currentSlot.startTime.split(':').map(Number);
    const startTotalMinutes = startHours * 60 + startMinutes;
    const endTotalMinutes = startTotalMinutes + (duration.hours * 60) + duration.minutes;
    
    const endHours = Math.floor(endTotalMinutes / 60) % 24;
    const endMins = endTotalMinutes % 60;
    
    const endTime = `${endHours.toString().padStart(2, '0')}:${endMins.toString().padStart(2, '0')}`;
    
    updateTimeSlot(currentSlot.id, 'endTime', endTime);
  };

  // Duplicate current slot
  const duplicateSlot = (slotToDuplicate) => {
    const newSlot = {
      ...slotToDuplicate,
      id: Date.now()
    };
    onTimeSlotsChange([...timeSlots, newSlot]);
  };

  // Smart time rounding (to nearest 15 minutes)
  const roundTime = (timeString) => {
    const [hours, minutes] = timeString.split(':').map(Number);
    const totalMinutes = hours * 60 + minutes;
    const roundedMinutes = Math.round(totalMinutes / 15) * 15;
    const newHours = Math.floor(roundedMinutes / 60) % 24;
    const newMins = roundedMinutes % 60;
    return `${newHours.toString().padStart(2, '0')}:${newMins.toString().padStart(2, '0')}`;
  };

  // Handle time input with auto-rounding
  const handleTimeChange = (id, field, value) => {
    console.log(`Changing slot ${id} field ${field} to ${value}`);
    // const roundedTime = roundTime(value);
    updateTimeSlot(id, field, value);
  };

  // Generate next few days for quick date selection
  const getQuickDates = () => {
    const dates = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date();
      date.setDate(date.getDate() + i);
      dates.push({
        value: date.toISOString().split('T')[0],
        label: i === 0 ? 'Today' : 
               i === 1 ? 'Tomorrow' : 
               date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
      });
    }
    return dates;
  };

  const quickDates = getQuickDates();
  const currentSlot = timeSlots[activeSlot];

  return (
    <div className={`bg-white rounded-lg shadow-sm p-6 ${className}`}>
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center">
          <Clock className="w-5 h-5 mr-2 text-blue-600" />
          Schedule Time Slots
        </h3>
        <button
          onClick={addTimeSlot}
          className="inline-flex items-center px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
        >
          <Plus className="w-4 h-4 mr-1" />
          Add Slot
        </button>
      </div>

      {/* Time Slot Tabs */}
      <div className="flex space-x-2 mb-6 overflow-x-auto">
        {timeSlots.map((slot, index) => (
          <button
            key={slot.id}
            onClick={() => setActiveSlot(index)}
            className={`flex items-center px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
              activeSlot === index
                ? 'bg-blue-100 text-blue-700 border-2 border-blue-200'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200 border-2 border-transparent'
            }`}
          >
            <Calendar className="w-4 h-4 mr-1" />
            Slot {index + 1}
            {timeSlots.length > 1 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  removeTimeSlot(slot.id);
                }}
                className="ml-2 text-red-400 hover:text-red-600"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            )}
          </button>
        ))}
      </div>

      {currentSlot && (
        <div className="space-y-6">
          {/* Quick Time Presets */}
          <div>
            <div className="flex items-center mb-3">
              <Zap className="w-4 h-4 mr-2 text-orange-500" />
              <h4 className="font-medium text-gray-900">Quick Presets</h4>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
              {timePresets.map((preset, index) => (
                <button
                  key={index}
                  onClick={() => applyTimePreset(preset)}
                  className="p-3 text-left border border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition-colors group"
                >
                  <div className="font-medium text-sm text-gray-900 group-hover:text-blue-700">
                    {preset.label.split(' (')[0]}
                  </div>
                  <div className="text-xs text-gray-500 group-hover:text-blue-600">
                    {preset.start} - {preset.end} ({preset.duration}h)
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Quick Date Selection */}
          <div>
            <h4 className="font-medium text-gray-900 mb-3">Select Date</h4>
            <div className="grid grid-cols-4 lg:grid-cols-7 gap-2">
              {quickDates.map((date) => (
                <button
                  key={date.value}
                  onClick={() => {
                    // Fix: Update both start and end dates
                    updateTimeSlot2(currentSlot.id, 'endDate', 'startDate', date.value);
                    // updateTimeSlot(currentSlot.id, 'startDate', date.value);
                  }}
                  className={`p-2 text-center rounded-lg border transition-colors ${
                    currentSlot.startDate === date.value && currentSlot.endDate === date.value
                      ? 'border-blue-300 bg-blue-50 text-blue-700'
                      : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <div className="text-sm font-medium">{date.label}</div>
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Click a date to set both start and end date for same-day tasks
            </p>
          </div>

          {/* Custom Date/Time Input */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Start Time */}
            <div className="space-y-3">
              <h4 className="font-medium text-gray-900">Start Time</h4>
              <div className="space-y-2">
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Date</label>
                  <input
                    type="date"
                    value={currentSlot.startDate}
                    onChange={(e) => updateTimeSlot(currentSlot.id, 'startDate', e.target.value)}
                    min={today}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Time</label>
                  <input
                    type="time"
                    value={currentSlot.startTime}
                    onChange={(e) => handleTimeChange(currentSlot.id, 'startTime', e.target.value)}
                    step="900" // 15-minute steps
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
            </div>

            {/* End Time */}
            <div className="space-y-3">
              <h4 className="font-medium text-gray-900">End Time</h4>
              <div className="space-y-2">
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Date</label>
                  <input
                    type="date"
                    value={currentSlot.endDate}
                    onChange={(e) => updateTimeSlot(currentSlot.id, 'endDate', e.target.value)}
                    min={currentSlot.startDate || today}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Time</label>
                  <input
                    type="time"
                    value={currentSlot.endTime}
                    onChange={(e) => handleTimeChange(currentSlot.id, 'endTime', e.target.value)}
                    step="900" // 15-minute steps
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Duration Quick Set */}
          <div>
            <h4 className="font-medium text-gray-900 mb-3">Or Set Duration from Start Time</h4>
            <div className="flex flex-wrap gap-2">
              {durationPresets.map((duration, index) => (
                <button
                  key={index}
                  onClick={() => applyDuration(duration)}
                  className="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm"
                >
                  + {duration.label}
                </button>
              ))}
            </div>
          </div>

          {/* Slot Actions */}
          <div className="flex items-center justify-between pt-4 border-t border-gray-200">
            <button
              onClick={() => duplicateSlot(currentSlot)}
              className="inline-flex items-center px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm"
            >
              <Copy className="w-4 h-4 mr-1" />
              Duplicate This Slot
            </button>

            {/* Time Summary */}
            <div className="text-sm text-gray-600">
              {currentSlot.startDate && currentSlot.startTime && currentSlot.endDate && currentSlot.endTime && (
                <div>
                  <strong>Duration:</strong> {(() => {
                    const start = new Date(`${currentSlot.startDate}T${currentSlot.startTime}`);
                    const end = new Date(`${currentSlot.endDate}T${currentSlot.endTime}`);
                    const diffMs = end - start;
                    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
                    const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
                    return diffHours > 0 ? `${diffHours}h ${diffMinutes}m` : `${diffMinutes}m`;
                  })()}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* All Slots Summary */}
      {timeSlots.length > 1 && (
        <div className="mt-6 pt-6 border-t border-gray-200">
          <h4 className="font-medium text-gray-900 mb-3">All Time Slots Summary</h4>
          <div className="space-y-2">
            {timeSlots.map((slot, index) => (
              <div key={slot.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <span className="font-medium">Slot {index + 1}:</span>
                  {slot.startDate && slot.startTime && slot.endDate && slot.endTime ? (
                    <span className="ml-2 text-gray-600">
                      {slot.startDate === slot.endDate 
                        ? `${new Date(slot.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} ${slot.startTime} - ${slot.endTime}`
                        : `${new Date(slot.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} ${slot.startTime} - ${new Date(slot.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} ${slot.endTime}`
                      }
                    </span>
                  ) : (
                    <span className="ml-2 text-red-500">Incomplete</span>
                  )}
                </div>
                <button
                  onClick={() => setActiveSlot(index)}
                  className="text-blue-600 hover:text-blue-700 text-sm"
                >
                  Edit
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default QuickTimePicker;
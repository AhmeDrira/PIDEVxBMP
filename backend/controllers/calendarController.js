const CalendarEvent = require('../models/CalendarEvent');
const mongoose = require('mongoose');

// @desc  Get all events for the logged-in artisan
// @route GET /api/calendar
// @access Private (artisan)
const getEvents = async (req, res) => {
  try {
    const events = await CalendarEvent.find({ artisanId: req.user._id }).sort({ startDate: 1 });
    res.status(200).json(events);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error while fetching calendar events' });
  }
};

// @desc  Get public events for a specific artisan (for expert view)
// @route GET /api/calendar/public/:artisanId
// @access Public
const getPublicEvents = async (req, res) => {
  try {
    const { artisanId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(artisanId)) {
      return res.status(400).json({ message: 'Invalid artisan ID' });
    }
    const events = await CalendarEvent.find({
      artisanId,
      isPublic: true,
    }).sort({ startDate: 1 });
    res.status(200).json(events);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error while fetching public calendar events' });
  }
};

// @desc  Create a new calendar event
// @route POST /api/calendar
// @access Private (artisan)
const createEvent = async (req, res) => {
  try {
    const { title, type, startDate, endDate, description, location, color, isPublic } = req.body;

    if (!title || !type || !startDate || !endDate) {
      return res.status(400).json({ message: 'title, type, startDate, and endDate are required' });
    }

    const parsedStart = new Date(startDate);
    const parsedEnd = new Date(endDate);
    if (isNaN(parsedStart.getTime()) || isNaN(parsedEnd.getTime())) {
      return res.status(400).json({ message: 'Invalid dates' });
    }
    if (parsedEnd <= parsedStart) {
      return res.status(400).json({ message: 'End date must be after start date' });
    }

    const publicTypes = ['disponibilite', 'projet'];
    const resolvedIsPublic = isPublic !== undefined ? Boolean(isPublic) : publicTypes.includes(type);

    const event = await CalendarEvent.create({
      artisanId: req.user._id,
      title,
      type,
      startDate: parsedStart,
      endDate: parsedEnd,
      description: description || '',
      location: location || '',
      color: color || '',
      isPublic: resolvedIsPublic,
    });

    res.status(201).json(event);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error while creating calendar event' });
  }
};

// @desc  Update a calendar event
// @route PUT /api/calendar/:id
// @access Private (artisan)
const updateEvent = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid event ID' });
    }

    const event = await CalendarEvent.findById(id);
    if (!event) return res.status(404).json({ message: 'Event not found' });
    if (event.artisanId.toString() !== req.user._id.toString()) {
      return res.status(401).json({ message: 'Not authorized' });
    }

    // Project events can only be updated via project controller
    if (event.projectId) {
      return res.status(403).json({ message: 'Project events can only be modified via the project.' });
    }

    const { title, type, startDate, endDate, description, location, color, isPublic } = req.body;

    if (startDate && endDate) {
      const parsedStart = new Date(startDate);
      const parsedEnd = new Date(endDate);
      if (parsedEnd <= parsedStart) {
        return res.status(400).json({ message: 'End date must be after start date' });
      }
    }

    const publicTypes = ['disponibilite', 'projet'];
    const resolvedType = type || event.type;
    const resolvedIsPublic =
      isPublic !== undefined ? Boolean(isPublic) : publicTypes.includes(resolvedType);

    const updated = await CalendarEvent.findByIdAndUpdate(
      id,
      {
        ...(title && { title }),
        ...(type && { type }),
        ...(startDate && { startDate: new Date(startDate) }),
        ...(endDate && { endDate: new Date(endDate) }),
        ...(description !== undefined && { description }),
        ...(location !== undefined && { location }),
        ...(color !== undefined && { color }),
        isPublic: resolvedIsPublic,
      },
      { new: true, runValidators: true }
    );

    res.status(200).json(updated);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error while updating calendar event' });
  }
};

// @desc  Delete a calendar event
// @route DELETE /api/calendar/:id
// @access Private (artisan)
const deleteEvent = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid event ID' });
    }

    const event = await CalendarEvent.findById(id);
    if (!event) return res.status(404).json({ message: 'Event not found' });
    if (event.artisanId.toString() !== req.user._id.toString()) {
      return res.status(401).json({ message: 'Not authorized' });
    }
    if (event.projectId) {
      return res.status(403).json({ message: 'Project events can only be deleted via the project.' });
    }

    await CalendarEvent.deleteOne({ _id: id });
    res.status(200).json({ message: 'Event deleted', id });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error while deleting calendar event' });
  }
};

module.exports = { getEvents, getPublicEvents, createEvent, updateEvent, deleteEvent };

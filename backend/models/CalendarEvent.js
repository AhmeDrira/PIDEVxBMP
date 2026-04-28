const mongoose = require('mongoose');

const calendarEventSchema = new mongoose.Schema(
  {
    artisanId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    type: {
      type: String,
      enum: ['projet', 'rdv', 'disponibilite', 'conge', 'rappel'],
      required: true,
      default: 'rdv',
    },
    startDate: {
      type: Date,
      required: true,
    },
    endDate: {
      type: Date,
      required: true,
    },
    description: {
      type: String,
      default: '',
    },
    location: {
      type: String,
      default: '',
    },
    color: {
      type: String,
      default: '',
    },
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      default: null,
    },
    isPublic: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

calendarEventSchema.index({ artisanId: 1, startDate: 1 });

module.exports = mongoose.model('CalendarEvent', calendarEventSchema);

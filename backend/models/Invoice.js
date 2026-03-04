const mongoose = require('mongoose');

const invoiceSchema = new mongoose.Schema({
  invoiceNumber: {
    type: String,
    required: true,
    unique: true
  },
  project: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    required: [true, 'Please select a project']
  },
  artisan: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  clientName: {
    type: String,
    required: [true, 'Please add a client name']
  },
  amount: {
    type: Number,
    required: [true, 'Please add an amount']
  },
  description: {
    type: String,
    required: [true, 'Please add a description']
  },
  issueDate: {
    type: Date,
    required: [true, 'Please add an issue date']
  },
  dueDate: {
    type: Date,
    required:[true, 'Please add a due date']
  },
  status: {
    type: String,
    enum:['pending', 'paid', 'overdue'],
    default: 'pending'
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Invoice', invoiceSchema);
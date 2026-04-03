const mongoose = require('mongoose');

const projectSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Please add a title'],
  },
  description: {
    type: String,
    required: [true, 'Please add a description'],
  },
  location: {
    type: String,
    required: [true, 'Please add a location'],
  },
  budget: {
    type: Number,
    default: 0,
    min: 0,
  },
  startDate: {
    type: Date,
    required:[true, 'Please add a start date'],
  },
  endDate: {
    type: Date,
    required:[true, 'Please add an end date'],
  },
  status: {
    type: String,
    enum: ['active', 'pending', 'completed'],
    default: 'active',
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high'],
    default: 'medium',
  },
  // ---> AJOUTE CECI :
  progress: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  tasks: [
    {
      title: {
        type: String,
        required: [true, 'Please add a task title'],
        trim: true,
      },
      status: {
        type: String,
        enum: ['todo', 'in_progress', 'done'],
        default: 'todo',
      },
    },
  ],
  materials: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product'
  }],
  personalMaterials: [
    {
      name: {
        type: String,
        required: [true, 'Please add a material name'],
        trim: true,
      },
      category: {
        type: String,
        required: [true, 'Please add a category'],
        trim: true,
      },
      price: {
        type: Number,
        required: [true, 'Please add a price'],
        min: 0,
      },
      stock: {
        type: Number,
        default: 1,
        min: 1,
      },
      image: {
        type: String,
        default: '',
      },
      description: {
        type: String,
        default: '',
      },
    },
  ],
  // La relation : on relie ce projet à l'artisan (User)
  artisan: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  }
}, {
  timestamps: true // Ajoute automatiquement createdAt et updatedAt
});

module.exports = mongoose.model('Project', projectSchema);
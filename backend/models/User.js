const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  firstName: {
    type: String,
    required: [true, 'Please add a first name'],
  },
  lastName: {
    type: String,
    required: [true, 'Please add a last name'],
  },
  email: {
    type: String,
    required: [true, 'Please add an email'],
    unique: true,
    match: [
      /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
      'Please add a valid email',
    ],
  },
  phone: {
    type: String,
    required: [true, 'Please add a phone number'],
    unique: true,
  },
  password: {
    type: String,
    required: [true, 'Please add a password'],
    minlength: 6,
    select: false,
  },
  role: {
    type: String,
    enum: ['user', 'artisan', 'expert', 'manufacturer', 'admin'],
    default: 'user',
  },
  status: {
    type: String,
    enum: ['active', 'suspended'],
    default: 'active',
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  resetPasswordToken: {
    type: String,
    select: false,
  },
  resetPasswordExpires: {
    type: Date,
    select: false,
  },
}, { discriminatorKey: 'role' });

// Encrypt password using bcrypt
userSchema.pre('save', async function () {
  if (!this.isModified('password')) {
    return;
  }
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// Match user entered password to hashed password in database
userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

const User = mongoose.model('User', userSchema);

// Discriminators
const Artisan = User.discriminator('artisan', new mongoose.Schema({
  location: { type: String, required: true },
  domain: { type: String, required: true },
  yearsExperience: { type: Number },
  bio: { type: String, default: '' },
  licenseNumber: { type: String, default: '' }
}));

const Expert = User.discriminator('expert', new mongoose.Schema({
  domain: { type: String, required: true },
}));

const Manufacturer = User.discriminator('manufacturer', new mongoose.Schema({
  companyName: { type: String, required: true },
  certificationFile: {
    data: Buffer,
    contentType: String,
    fileName: String
  },
  verificationStatus: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  reviewedAt: { type: Date },
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  rejectionReason: { type: String },
}));

const Admin = User.discriminator('admin', new mongoose.Schema({
  // Admin specific fields can be added here if needed
}));

module.exports = {
  User,
  Artisan,
  Expert,
  Manufacturer,
  Admin
};

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
    set: v => (v === '' ? undefined : v),
    index: {
      unique: true,
      partialFilterExpression: { phone: { $exists: true, $ne: '' } }
    },
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
  isVerified: {
    type: Boolean,
    default: false,
  },
  verificationToken: {
    type: String,
    select: false,
  },
  verificationTokenExpires: {
    type: Date,
    select: false,
  },
  isPhoneVerified: {
    type: Boolean,
    default: false,
  },
  phoneVerificationCode: {
    type: String,
    select: false,
  },
  phoneVerificationExpires: {
    type: Date,
    select: false,
  },
  pendingPhone: {
    type: String,
    select: false,
  },
  profilePhoto: {
    type: String,
    default: '',
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
  pendingEmail: {
    type: String,
    select: false,
  },
  emailChangeToken: {
    type: String,
    select: false,
  },
  emailChangeTokenExpires: {
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

// Discriminators (fields required in schema; sign-up sends empty string, user fills later in profile)
const Artisan = User.discriminator('artisan', new mongoose.Schema({
  location: { type: String, default: '' },
  domain: { type: String, default: '' },
  yearsExperience: { type: Number },
}));

const Expert = User.discriminator('expert', new mongoose.Schema({
  domain: { type: String, default: '' },
}));

const Manufacturer = User.discriminator('manufacturer', new mongoose.Schema({
  companyName: { type: String, default: '' },
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

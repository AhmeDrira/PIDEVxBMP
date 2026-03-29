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
  adminType: {
    type: String,
    enum: ['super', 'sub'],
    default: undefined,
  },
  permissions: {
    canVerifyManufacturers: { type: Boolean, default: false },
    canManageKnowledge: { type: Boolean, default: false },
    canSuspendUsers: { type: Boolean, default: false },
    canDeleteUsers: { type: Boolean, default: false },
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
  subscription: {
    planId: { type: String, default: 'free' },
    status: { type: String, enum: ['active', 'inactive', 'canceled'], default: 'inactive' },
    startDate: { type: Date },
    endDate: { type: Date },
    stripeSessionId: { type: String },
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
  bio: { type: String, default: '' },
  skills: [{ type: String }],
  certifications: [{ type: String }],
  portfolio: [
    {
      title: { type: String, required: true, trim: true },
      description: { type: String, required: true, trim: true },
      location: { type: String, default: '' },
      completedDate: { type: Date },
      source: { type: String, enum: ['project', 'manual'], default: 'manual' },
      sourceProject: { type: mongoose.Schema.Types.ObjectId, ref: 'Project' },
      media: [
        {
          type: { type: String, enum: ['image', 'video'], default: 'image' },
          url: { type: String, required: true, trim: true },
        },
      ],
    },
  ],
}));

const Expert = User.discriminator('expert', new mongoose.Schema({
  domain: { type: String, default: '' },
  bio: { type: String, default: '' },
  location: { type: String, default: '' },
  specialization: { type: String, default: '' },
  credentials: { type: String, default: '' },
  institution: { type: String, default: '' },
}));

const Manufacturer = User.discriminator('manufacturer', new mongoose.Schema({
  companyName: { type: String, default: '' },
  description: { type: String, default: '' },
  certificationNumber: { type: String, default: '' },
  certificationFile: { type: String, default: '' },
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

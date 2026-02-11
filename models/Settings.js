import mongoose from 'mongoose';

const settingsSchema = new mongoose.Schema({
  current_semester: {
    type: String,
    enum: ['mousson', 'harmattan'],
    default: 'harmattan'
  },
  current_academic_year: {
    type: Number,
    required: true,
    default: () => new Date().getFullYear()
  },
  max_upload_size_mb: {
    type: Number,
    default: 50,
    min: 1,
    max: 500
  }
}, {
  timestamps: true
});

export default mongoose.model('Settings', settingsSchema);

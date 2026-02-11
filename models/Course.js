import mongoose from 'mongoose';

const courseSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  category: {
    type: String,
    required: true
  },
  filiere: {
    type: String,
    default: null
  },
  niveau: {
    type: String,
    enum: ['licence1', 'licence2', 'licence3', null],
    default: null
  },
  institut: {
    type: String,
    enum: ['DGI', 'ISSJ', 'ISEG', null],
    default: null
  },
  semester: {
    type: String,
    enum: ['mousson', 'harmattan', null],
    default: null
  },
  academic_year: {
    type: Number,
    default: null
  },
  institution: {
    type: String,
    default: 'UCAO-UUT'
  },
  description: {
    type: String,
    required: true
  },
  thumbnail: {
    type: String,
    default: null
  },
  video_url: {
    type: String,
    default: null
  },
  created_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  status: {
    type: String,
    enum: ['draft', 'published', 'archived'],
    default: 'draft'
  },
  resources: [{
    name: { type: String, required: true },
    type: { type: String, required: true },
    url: { type: String, required: true }
  }]
}, {
  timestamps: true
});

courseSchema.index({ filiere: 1, niveau: 1, institution: 1 });
courseSchema.index({ status: 1 });
courseSchema.index({ institut: 1 });
courseSchema.index({ institut: 1, semester: 1, academic_year: 1 });

export default mongoose.model('Course', courseSchema);


import mongoose from 'mongoose';

const guideSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  content: {
    type: String,
    required: true
  },
  institut: {
    type: String,
    enum: ['DGI', 'ISSJ', 'ISEG', null],
    default: null
  },
  order: {
    type: Number,
    default: 0
  },
  status: {
    type: String,
    enum: ['draft', 'published'],
    default: 'published'
  }
}, {
  timestamps: true
});

guideSchema.index({ status: 1, order: 1 });
guideSchema.index({ institut: 1 });

export default mongoose.model('Guide', guideSchema);

import mongoose from 'mongoose';

const categorySchema = new mongoose.Schema({
  institut: {
    type: String,
    enum: ['DGI', 'ISSJ', 'ISEG', null],
    default: null
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    default: ''
  },
  order: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

categorySchema.index({ name: 1 });
categorySchema.index({ institut: 1 });
categorySchema.index({ institut: 1, name: 1 }, { unique: true });

export default mongoose.model('Category', categorySchema);

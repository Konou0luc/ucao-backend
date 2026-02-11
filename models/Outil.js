import mongoose from 'mongoose';

const outilSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    default: ''
  },
  url: {
    type: String,
    required: true,
    trim: true
  },
  institut: {
    type: String,
    enum: ['DGI', 'ISSJ', 'ISEG', null],
    default: null
  },
  order: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

outilSchema.index({ order: 1 });
outilSchema.index({ institut: 1 });

export default mongoose.model('Outil', outilSchema);

import mongoose from 'mongoose';

const filiereSchema = new mongoose.Schema({
  institut: {
    type: String,
    required: true,
    enum: ['DGI', 'ISSJ', 'ISEG']
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  order: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

filiereSchema.index({ institut: 1, name: 1 }, { unique: true });
filiereSchema.index({ institut: 1, order: 1 });

export default mongoose.model('Filiere', filiereSchema);

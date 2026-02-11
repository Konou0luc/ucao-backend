import mongoose from 'mongoose';

const discussionSchema = new mongoose.Schema({
  course_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Course',
    default: null
  },
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  content: {
    type: String,
    required: true
  },
  is_pinned: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

discussionSchema.index({ course_id: 1 });
discussionSchema.index({ is_pinned: -1, created_at: -1 });

export default mongoose.model('Discussion', discussionSchema);


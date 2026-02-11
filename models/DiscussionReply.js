import mongoose from 'mongoose';

const discussionReplySchema = new mongoose.Schema({
  discussion_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Discussion',
    required: true
  },
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  content: {
    type: String,
    required: true
  }
}, {
  timestamps: true
});

discussionReplySchema.index({ discussion_id: 1 });

export default mongoose.model('DiscussionReply', discussionReplySchema);


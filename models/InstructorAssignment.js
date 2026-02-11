import mongoose from 'mongoose';

const instructorAssignmentSchema = new mongoose.Schema({
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  institut: {
    type: String,
    enum: ['DGI', 'ISSJ', 'ISEG'],
    required: true
  },
  semester: {
    type: String,
    enum: ['mousson', 'harmattan'],
    required: true
  },
  academic_year: {
    type: Number,
    required: true
  },
  course_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Course',
    required: true
  }
}, {
  timestamps: true
});

instructorAssignmentSchema.index({ institut: 1, semester: 1, academic_year: 1 });
instructorAssignmentSchema.index({ user_id: 1, semester: 1, academic_year: 1 });
instructorAssignmentSchema.index({ course_id: 1, semester: 1, academic_year: 1 });

export default mongoose.model('InstructorAssignment', instructorAssignmentSchema);

import mongoose from 'mongoose';

const evaluationCalendarSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    default: null
  },
  institut: {
    type: String,
    enum: ['DGI', 'ISSJ', 'ISEG', null],
    default: null
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
  evaluation_date: {
    type: Date,
    required: true
  },
  start_time: {
    type: String,
    default: null
  },
  end_time: {
    type: String,
    default: null
  },
  location: {
    type: String,
    default: null
  },
  type: {
    type: String,
    enum: ['examen', 'controle', 'tp', 'projet'],
    default: 'examen'
  },
  course_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Course',
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
  }
}, {
  timestamps: true
});

evaluationCalendarSchema.index({ evaluation_date: 1 });
evaluationCalendarSchema.index({ institut: 1, filiere: 1, niveau: 1 });
evaluationCalendarSchema.index({ institut: 1, semester: 1, academic_year: 1 });

export default mongoose.model('EvaluationCalendar', evaluationCalendarSchema);


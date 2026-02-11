import mongoose from 'mongoose';

const timetableSchema = new mongoose.Schema({
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
  course_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Course',
    required: true
  },
  day_of_week: {
    type: String,
    enum: ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'],
    default: 'lundi'
  },
  start_time: {
    type: String,
    required: true
  },
  end_time: {
    type: String,
    required: true
  },
  room: {
    type: String,
    default: null
  },
  instructor: {
    type: String,
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

timetableSchema.index({ institut: 1, filiere: 1, niveau: 1, day_of_week: 1 });
timetableSchema.index({ institut: 1, semester: 1, academic_year: 1 });

export default mongoose.model('Timetable', timetableSchema);


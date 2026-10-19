
import mongoose from 'mongoose';

const taskSchema = new mongoose.Schema(
  {
    title: String,

    description: String,

    priority: String,

    statuses: [
      {
        //_id: false,
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
        },
        status: String,
        completedAt: Date,
      },
    ],

    dueDate: Date,

    attachment: {
      filename: String,
      originalName: String,
      mimetype: String,
      size: Number,
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },

    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    completedAt: Date,

    isDeleted: {
      type: Boolean,
      default: false,
    },

    deletedAt: Date,

    deletedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  {
    timestamps: true,
  }
);

const Task = mongoose.model('Task', taskSchema);

export default Task;

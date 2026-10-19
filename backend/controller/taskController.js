
import mongoose from 'mongoose';
import Task from '../models/Task.js';
import User from '../models/user.js';
import fs from 'fs/promises';
import path from 'path';

const STATUSES = [
  'Open',
  'In Progress',
  'On Hold',
  'In Review',
  'Completed',
];

const PRIORITIES = ['Low', 'Medium', 'High', 'Urgent'];

const POPULATE = [
  { path: 'createdBy', select: 'name email' },
  { path: 'assignedTo', select: 'name email' },
  { path: 'statuses.user', select: 'name email' },
];



// CREATE TASK
export const createTask = async (req, res) => {
  try {
    const {
      title,
      description,
      priority,
      dueDate,
      assignedTo,
    } = req.body;

    const userId = req.user?._id || req.user?.id;

    // Validate login
    if (!userId) {
      return res.status(401).json({
        message: 'Please log in',
      });
    }

    // Validate title
    if (!title || !title.trim()) {
      return res.status(400).json({
        message: 'Title is required',
      });
    }

    // Validate due date
    if (!dueDate || isNaN(Date.parse(dueDate))) {
      return res.status(400).json({
        message: 'Valid due date is required',
      });
    }

    // Validate priority
    if (priority && !PRIORITIES.includes(priority)) {
      return res.status(400).json({
        message: 'Invalid priority',
      });
    }

    // Assign to the selected user, or to yourself by default
    const assigneeId = assignedTo || String(userId);

    if (!mongoose.isValidObjectId(assigneeId)) {
      return res.status(400).json({
        message: 'Invalid assigned user ID',
      });
    }

    // Check that the assigned user exists
    const userExists = await User.exists({
      _id: assigneeId,
    });

    if (!userExists) {
      return res.status(400).json({
        message: 'Assigned user not found',
      });
    }

    // Create task with one assignee
    const task = await Task.create({
      title: title.trim(),
      description: description || '',
      priority: priority || 'Medium',
      dueDate: new Date(dueDate),
      createdBy: userId,
      assignedTo: assigneeId,
      statuses: [
        {
          user: assigneeId,
          status: 'Open',
        },
      ],
      attachment: req.file
        ? {
            filename: req.file.filename,
            originalName: req.file.originalname,
            mimetype: req.file.mimetype,
            size: req.file.size,
          }
        : undefined,
    });

    await task.populate(POPULATE);

    return res.status(201).json({
      message: 'Task created successfully',
      task,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      message: 'Failed to create task',
    });
  }
};


// GET ALL MY TASKS


export const getTasks = async (req, res) => {
  try {
    const {
      view = 'all',
      search = '',
      status = '',
      priority = '',
      assignee = '',
      dueFrom = '',
      dueTo = '',
      overdue = false,
    } = req.body || {};

    const userId = req.user?._id || req.user?.id;

    // 1. Check login
    if (!userId) {
      return res.status(401).json({
        message: 'Please login first',
      });
    }

    // 2. Validate view
    const validViews = ['all', 'created', 'assigned'];

    if (!validViews.includes(view)) {
      return res.status(400).json({
        message: 'Invalid task view',
      });
    }

    // 3. Validate status
    if (
      status &&
      status !== 'all' &&
      !STATUSES.includes(status)
    ) {
      return res.status(400).json({
        message: 'Invalid status',
      });
    }

    // 4. Validate priority
    if (
      priority &&
      priority !== 'all' &&
      !PRIORITIES.includes(priority)
    ) {
      return res.status(400).json({
        message: 'Invalid priority',
      });
    }

    // 5. Validate assignee ID
    if (
      assignee &&
      !mongoose.Types.ObjectId.isValid(assignee)
    ) {
      return res.status(400).json({
        message: 'Invalid assignee ID',
      });
    }

    // 6. Build the MongoDB query
    const query = {
      isDeleted: false,
    };

    const conditions = [];

    // Filter by task relationship
    if (view === 'created') {
      conditions.push({
        createdBy: userId,
      });
    } else if (view === 'assigned') {
      conditions.push({
        assignedTo: userId,
      });
    } else {
      // Show tasks created by or assigned to the logged-in user
      conditions.push({
        $or: [
          { createdBy: userId },
          { assignedTo: userId },
        ],
      });
    }

    // 7. Search by task title
    if (search.trim()) {
      const escapedSearch = search.trim().replace(
        /[.*+?^${}()|[\]\\]/g,
        '\\$&'
      );

      conditions.push({
        title: {
          $regex: escapedSearch,
          $options: 'i',
        },
      });
    }

    // 8. Filter by priority
    if (priority && priority !== 'all') {
      conditions.push({
        priority,
      });
    }

    // 9. Filter by assignee
    if (assignee) {
      conditions.push({
        assignedTo: new mongoose.Types.ObjectId(assignee),
      });
    }

    // 10. Filter by due date
    const dueDateFilter = {};

    const parseDateOnly = (value) => {
      if (
        typeof value !== 'string' ||
        !/^\d{4}-\d{2}-\d{2}$/.test(value)
      ) {
        return null;
      }

      const date = new Date(`${value}T00:00:00`);

      if (
        Number.isNaN(date.getTime()) ||
        date.getFullYear() !== Number(value.slice(0, 4)) ||
        date.getMonth() !== Number(value.slice(5, 7)) - 1 ||
        date.getDate() !== Number(value.slice(8, 10))
      ) {
        return null;
      }

      return date;
    };

    if (dueFrom) {
      const startDate = parseDateOnly(dueFrom);

      if (!startDate) {
        return res.status(400).json({
          message: 'Invalid start date',
        });
      }

      dueDateFilter.$gte = startDate;
    }

    if (dueTo) {
      const endDate = parseDateOnly(dueTo);

      if (!endDate) {
        return res.status(400).json({
          message: 'Invalid end date',
        });
      }

      // Exclusive next-day boundary includes the entire selected day
      endDate.setDate(endDate.getDate() + 1);
      dueDateFilter.$lt = endDate;
    }

    if (
      dueDateFilter.$gte &&
      dueDateFilter.$lt &&
      dueDateFilter.$gte >= dueDateFilter.$lt
    ) {
      return res.status(400).json({
        message: 'Start date must be on or before end date',
      });
    }

    if (Object.keys(dueDateFilter).length > 0) {
      conditions.push({
        dueDate: dueDateFilter,
      });
    }

    // Apply all non-status filters together
    if (conditions.length > 0) {
      query.$and = conditions;
    }

    // 11. Fetch tasks and populate user information
    const tasks = await Task.find(query)
      .populate(POPULATE)
      .sort({ dueDate: 1 });

    // 12. Find the status belonging to each task's assignee
    const getAssigneeStatus = (task) => {
      const assignedUserId = String(
        task.assignedTo?._id ||
        task.assignedTo ||
        ''
      );

      const statusRecord = (task.statuses || []).find(
        (item) =>
          String(item.user?._id || item.user || '') ===
          assignedUserId
      );

      return statusRecord?.status || task.overallStatus || 'Open';
    };

    // 13. Filter by assignee status
    // The creator and assignee both see the same status.
    let filteredTasks = tasks;

    if (status && status !== 'all') {
      filteredTasks = tasks.filter(
        (task) => getAssigneeStatus(task) === status
      );
    }

    // 14. Calculate overdue status
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let result = filteredTasks.map((task) => {
      const taskObject = task.toObject();

      const assigneeStatus = getAssigneeStatus(task);

      const dueDate = task.dueDate
        ? new Date(task.dueDate)
        : null;

      taskObject.isOverdue = Boolean(
        dueDate &&
        !Number.isNaN(dueDate.getTime()) &&
        dueDate < today &&
        assigneeStatus !== 'Completed'
      );

      return taskObject;
    });

    // 15. Filter overdue tasks only
    const overdueOnly =
      overdue === true || overdue === 'true';

    if (overdueOnly) {
      result = result.filter((task) => task.isOverdue);
    }

    // 16. Return the final task list
    return res.status(200).json({
      message: 'Tasks fetched successfully',
      tasks: result,
    });
  } catch (error) {
    console.error('Get tasks error:', error);

    return res.status(500).json({
      message: 'Failed to fetch tasks',
      error: error.message,
    });
  }
};



// GET SINGLE TASK
export const getTask = async (req, res) => {
  try {
    const userId = req.user?._id || req.user?.id;
    const { id } = req.body;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: 'Invalid task ID' });
    }

    const task = await Task.findOne({
      _id: id,
      isDeleted: false,
      $or: [
        { createdBy: userId },
        { assignedTo: userId },
      ],
    }).populate(POPULATE);

    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    return res.status(200).json({ task });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: 'Failed to get task',
    });
  }
};

// UPDATE TASK
export const updateTask = async (req, res) => {
  try {
    const userId = req.user?._id || req.user?.id;
    const { id } = req.body;

    const {
      title,
      description,
      priority,
      dueDate,
    } = req.body;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: 'Invalid task ID' });
    }

    const task = await Task.findOne({
      _id: id,
      createdBy: userId,
      isDeleted: false,
    });

    if (!task) {
      return res.status(404).json({
        message: 'Task not found or you cannot edit it',
      });
    }

    // Validation
    if (title !== undefined) {
      if (typeof title !== 'string' || !title.trim()) {
        return res.status(400).json({
          message: 'Title cannot be empty',
        });
      }

      task.title = title.trim();
    }

    if (description !== undefined) {
      task.description = description;
    }

    if (priority !== undefined) {
      if (!PRIORITIES.includes(priority)) {
        return res.status(400).json({
          message: 'Invalid priority',
        });
      }

      task.priority = priority;
    }

    if (dueDate !== undefined) {
      if (!dueDate || isNaN(Date.parse(dueDate))) {
        return res.status(400).json({
          message: 'Invalid due date',
        });
      }

      task.dueDate = new Date(dueDate);
    }

    if (req.file) {
      task.attachment = {
        filename: req.file.filename,
        originalName: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size,
      };
    }

    await task.save();
    await task.populate(POPULATE);

    return res.status(200).json({
      message: 'Task updated successfully',
      task,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: 'Failed to update task',
    });
  }
};

// UPDATE MY STATUS

const updateStatus = async (req, res) => {
  try {
    const { id, status } = req.body;

    // 1. Validate request
    if (!id || !status) {
      return res.status(400).json({
        message: 'Task ID and status are required',
      });
    }

    if (!STATUSES.includes(status)) {
      return res.status(400).json({
        message: 'Invalid task status',
      });
    }

    // 2. Get logged-in user ID
    const userId = String(
      req.user?.id ||
      req.user?._id ||
      req.user?.userId ||
      ''
    );

    if (!userId) {
      return res.status(401).json({
        message: 'Please log in first',
      });
    }

    // 3. Find task
    const task = await Task.findById(id);

    if (!task) {
      return res.status(404).json({
        message: 'Task not found',
      });
    }

    // 4. Identify creator and assignee
    const creatorId = String(
      task.createdBy?._id ||
      task.createdBy ||
      ''
    );

    const assigneeId = String(
      task.assignedTo?._id ||
      task.assignedTo ||
      ''
    );

    const isCreator = userId === creatorId;
    const isAssignee = userId === assigneeId;

    // Only the creator or assignee can update the task status
    if (!isCreator && !isAssignee) {
      return res.status(403).json({
        message: 'You cannot update this task',
      });
    }

    // 5. Get the current status of the single assignee
    const statusRecord = (task.statuses || []).find(
      (item) =>
        String(item.user?._id || item.user || '') ===
        assigneeId
    );

    const currentStatus = statusRecord?.status || 'Open';

    // 6. Completed tasks are permanently read-only
    if (currentStatus === 'Completed') {
      return res.status(403).json({
        message: 'Completed tasks cannot be changed',
      });
    }

    // 7. Creator permissions
    if (isCreator) {
      // Creator can set On Hold only from In Progress
      if (status === 'On Hold' && currentStatus !== 'In Progress') {
        return res.status(400).json({
          message: 'You can set On Hold only when the task is In Progress',
        });
      }

      // Creator can reopen only from On Hold
      // The frontend sends "In Progress" for the Reopen action
      if (status === 'In Progress' && currentStatus !== 'On Hold') {
        return res.status(400).json({
          message: 'You can reopen the task only when it is On Hold',
        });
      }

      // Creator can complete only from In Review
      if (status === 'Completed' && currentStatus !== 'In Review') {
        return res.status(400).json({
          message: 'You can complete the task only when it is In Review',
        });
      }

      // Creator cannot set other statuses
      if (!['On Hold', 'In Progress', 'Completed'].includes(status)) {
        return res.status(403).json({
          message: 'Creator can only set On Hold, reopen, or Completed',
        });
      }
    }

    // 8. Assignee permissions
    if (isAssignee) {
      // Assignee cannot change status while task is On Hold
      if (currentStatus === 'On Hold') {
        return res.status(403).json({
          message: 'Task is On Hold. Wait for the creator to reopen it.',
        });
      }

      // Assignee cannot set On Hold or Completed
      if (['On Hold', 'Completed'].includes(status)) {
        return res.status(403).json({
          message: 'Assignee cannot set On Hold or Completed',
        });
      }

      // Assignee can only set Open, In Progress, or In Review
      if (!['Open', 'In Progress', 'In Review'].includes(status)) {
        return res.status(403).json({
          message: 'Assignee can only set Open, In Progress, or In Review',
        });
      }
    }

    // 9. Update the status record
    const completedAt =
      status === 'Completed' ? new Date() : null;

    if (statusRecord) {
      statusRecord.status = status;
      statusRecord.completedAt = completedAt;
    } else {
      task.statuses.push({
        user: task.assignedTo,
        status,
        completedAt,
      });
    }

    // 10. Save changes
    await task.save();

    // 11. Fetch updated task
    const updatedTask = await Task.findById(id)
      .populate('createdBy', 'name email')
      .populate('assignedTo', 'name email')
      .populate('statuses.user', 'name email');

    return res.status(200).json({
      message: 'Task status updated successfully',
      task: updatedTask,
    });
  } catch (error) {
    console.error('Update status error:', error);

    return res.status(500).json({
      message: 'Failed to update task status',
      error: error.message,
    });
  }
};

export { updateStatus };





// DELETE TASK (SOFT DELETE)

export const deleteTask = async (req, res) => {
  try {
    const userId = req.user?._id || req.user?.id;
    const { id } = req.body;

    // 1. Check login
    if (!userId) {
      return res.status(401).json({
        message: 'Please log in',
      });
    }

    // 2. Validate task ID
    if (!id || !mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        message: 'Invalid task ID',
      });
    }

    // 3. Find the task
    const task = await Task.findById(id);

    if (!task || task.isDeleted) {
      return res.status(404).json({
        message: 'Task not found',
      });
    }

    // 4. Only the task creator can delete it
    const creatorId = String(task.createdBy?._id || task.createdBy);
    
    if (creatorId !== String(userId)) {
      return res.status(403).json({
        message: 'Only the task creator can delete this task',
      });
    }

    // 5. Soft delete
    task.isDeleted = true;
    task.deletedAt = new Date();
    task.deletedBy = userId;

    await task.save();

    return res.status(200).json({
      message: 'Task deleted successfully',
    });
  } catch (error) {
    console.error('Delete task error:', error);

    return res.status(500).json({
      message: 'Failed to delete task',
      error: error.message,
    });
  }
};




export const getStats = async (req, res) => {
  try {
    const userId = req.user?._id || req.user?.id;

    if (!userId) {
      return res.status(401).json({
        message: 'Please log in',
      });
    }

    // Start of today: tasks due today are NOT overdue.
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [created, assigned, inProgress, completed, overdue] =
      await Promise.all([
        // Total tasks created by the logged-in user
        Task.countDocuments({
          createdBy: userId,
          isDeleted: false,
        }),

        // Total tasks assigned to the logged-in user
        Task.countDocuments({
          assignedTo: userId,
          isDeleted: false,
        }),

        // Tasks currently In Progress
        Task.countDocuments({
          assignedTo: userId,
          isDeleted: false,
          statuses: {
            $elemMatch: {
              user: userId,
              status: 'In Progress',
            },
          },
        }),

        // Tasks completed by the logged-in user
        Task.countDocuments({
          assignedTo: userId,
          isDeleted: false,
          statuses: {
            $elemMatch: {
              user: userId,
              status: 'Completed',
            },
          },
        }),

        // Overdue tasks: due before today and not completed
        Task.countDocuments({
          assignedTo: userId,
          isDeleted: false,
          dueDate: {
            $lt: today,
            $ne: null,
          },
          statuses: {
            $elemMatch: {
              user: userId,
              status: { $ne: 'Completed' },
            },
          },
        }),
      ]);

    return res.status(200).json({
      stats: {
        created,
        assigned,
        inProgress,
        completed,
        overdue,
      },
    });
  } catch (error) {
    console.error('Get stats error:', error);

    return res.status(500).json({
      message: 'Failed to get task statistics',
    });
  }
};



export const assignTask = async (req, res) => {
  try {
    const userId = req.user?._id || req.user?.id;
    const { id, assignedTo } = req.body;

    // 1. Check login
    if (!userId) {
      return res.status(401).json({
        message: 'Please log in',
      });
    }

    // 2. Validate task ID
    if (!id || !mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        message: 'Invalid task ID',
      });
    }

    // 3. Validate assignee ID
    if (!assignedTo || !mongoose.isValidObjectId(assignedTo)) {
      return res.status(400).json({
        message: 'Please select a valid assignee',
      });
    }

    // 4. Find task
    const task = await Task.findById(id);

    if (!task || task.isDeleted) {
      return res.status(404).json({
        message: 'Task not found',
      });
    }

    // 5. Only the creator can reassign the task
    const creatorId = String(task.createdBy?._id || task.createdBy);

    if (creatorId !== String(userId)) {
      return res.status(403).json({
        message: 'Only the task creator can reassign this task',
      });
    }

    // 6. Check that the selected user exists
    const assigneeUser = await User.findById(assignedTo);

    if (!assigneeUser) {
      return res.status(404).json({
        message: 'Assignee not found',
      });
    }

    // 7. Assign a single user
    // Assign to exactly one user and reset their status
task.assignedTo = assigneeUser._id;

task.statuses = [
  {
    user: assigneeUser._id,
    status: 'Open',
    completedAt: null,
  },
];

await task.save();

    // Add a default status for the new assignee if they have none
    const existingStatus = (task.statuses || []).find(
      (item) =>
        String(item.user?._id || item.user) === String(assignedTo)
    );

    if (!existingStatus) {
      task.statuses.push({
        user: assigneeUser._id,
        status: 'Open',
      });
    }

    await task.save();

    // Return populated task details
    const updatedTask = await Task.findById(task._id).populate(POPULATE);

    return res.status(200).json({
      message: 'Task assigned successfully',
      task: updatedTask,
    });
  } catch (error) {
    console.error('Assign task error:', error);

    return res.status(500).json({
      message: 'Failed to assign task',
      error: error.message,
    });
  }
};



export const getTaskAttachment = async (req, res) => {
  try {
    const userId = req.user?._id || req.user?.id;
    const { id } = req.body;

    if (!userId) {
      return res.status(401).json({
        message: 'Please log in',
      });
    }

    if (!id || !mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        message: 'Invalid task ID',
      });
    }

    const task = await Task.findOne({
      _id: id,
      isDeleted: false,
    });

    if (!task) {
      return res.status(404).json({
        message: 'Task not found',
      });
    }

    const creatorId = String(task.createdBy?._id || task.createdBy);
    const assigneeId = String(task.assignedTo?._id || task.assignedTo);

    // Allow only the creator or assigned user.
    if (
      String(userId) !== creatorId &&
      String(userId) !== assigneeId
    ) {
      return res.status(403).json({
        message: 'You are not allowed to access this attachment',
      });
    }

    const attachment = task.attachment;

    if (!attachment?.filename) {
      return res.status(404).json({
        message: 'No attachment found for this task',
      });
    }

    const uploadRoot = path.resolve(process.cwd(), 'uploads');

    // Use the filename stored in MongoDB, not the whole attachment object.
    const filename = path.basename(attachment.filename);
    const filePath = path.resolve(uploadRoot, filename);

    // Prevent access outside the uploads folder.
    if (!filePath.startsWith(uploadRoot + path.sep)) {
      return res.status(400).json({
        message: 'Invalid attachment path',
      });
    }

    await fs.access(filePath);

    return res.download(
      filePath,
      attachment.originalName || filename
    );
  } catch (error) {
    if (error.code === 'ENOENT') {
      return res.status(404).json({
        message: 'Attachment file not found on the server',
      });
    }

    console.error('Get task attachment error:', error);

    return res.status(500).json({
      message: 'Failed to download attachment',
    });
  }
};



export const removeTaskAttachment = async (req, res) => {
  try {
    const userId = req.user?._id || req.user?.id;
    const { id } = req.body;

    if (!userId) {
      return res.status(401).json({ message: 'Please log in' });
    }

    if (!id || !mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: 'Invalid task ID' });
    }

    const task = await Task.findOne({
      _id: id,
      isDeleted: false,
    });

    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    const creatorId = String(task.createdBy?._id || task.createdBy);

    if (String(userId) !== creatorId) {
      return res.status(403).json({
        message: 'Only the task creator can remove the attachment',
      });
    }

    if (!task.attachment?.filename) {
      return res.status(404).json({
        message: 'No attachment found',
      });
    }

    const uploadRoot = path.resolve(process.cwd(), 'uploads');
    const filename = path.basename(task.attachment.filename);
    const filePath = path.resolve(uploadRoot, filename);

    if (!filePath.startsWith(uploadRoot + path.sep)) {
      return res.status(400).json({
        message: 'Invalid attachment path',
      });
    }

    // Remove the stored file. Ignore it if it is already missing.
    try {
      await fs.unlink(filePath);
    } catch (error) {
      if (error.code !== 'ENOENT') {
        throw error;
      }
    }

    // Remove the attachment reference from the task.
    task.attachment = undefined;
    task.markModified('attachment');
    await task.save();

    return res.status(200).json({
      message: 'Attachment removed successfully',
      task,
    });
  } catch (error) {
    console.error('Remove attachment error:', error);

    return res.status(500).json({
      message: 'Failed to remove attachment',
    });
  }
};

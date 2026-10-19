import mongoose from 'mongoose';
import Task from '../models/Task.js';
import User from '../models/user.js';
import fs from 'fs/promises';
import path from 'path';
import { sendEmail } from '../utils/mailSend.js';

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

// Escape special characters before using a string in a regex.
const escapeRegex = (value) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Escape user-provided text before placing it in HTML.
const escapeHtml = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

// ======================================================
// CREATE TASK + SEND EMAIL
// ======================================================

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
    if (typeof title !== 'string' || !title.trim()) {
      return res.status(400).json({
        message: 'Title is required',
      });
    }

    // Check for duplicate title
    const existingTask = await Task.findOne({
      title: {
        $regex: `^${escapeRegex(title.trim())}$`,
        $options: 'i',
      },
      isDeleted: false,
    });

    if (existingTask) {
      return res.status(400).json({
        message: 'A task with this title already exists',
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

    // Assign to the selected user, or yourself by default
    const assigneeId = assignedTo || String(userId);

    if (!mongoose.isValidObjectId(assigneeId)) {
      return res.status(400).json({
        message: 'Invalid assigned user ID',
      });
    }

    // Find the assigned user
    const assignee = await User.findById(assigneeId)
      .select('name email');

    if (!assignee) {
      return res.status(400).json({
        message: 'Assigned user not found',
      });
    }

    // Find the task creator
    const creator = await User.findById(userId)
      .select('name email');

    if (!creator) {
      return res.status(404).json({
        message: 'Task creator not found',
      });
    }

    
const lastTask = await Task.findOne({
  taskNumber: { $type: 'number' },
})
  .sort({ taskNumber: -1 })
  .select('taskNumber')
  .lean();

const nextTaskNumber = lastTask
  ? lastTask.taskNumber + 1
  : 1;


    // Create task with one assignee
    const task = await Task.create({
      taskNumber: nextTaskNumber,
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

    // Send email to the assigned user
    let emailSent = false;

    try {
      const isSelfAssigned =
        String(assignee._id) === String(userId);

      if (!assignee.email) {
        console.log(
          'Email not sent: assigned user has no email address'
        );
      } else if (isSelfAssigned) {
        // No need to notify someone about their own task.
      } else {
        const html = `
          <div style="font-family: Arial, sans-serif; padding: 20px;">
            <h2>New Task Assigned</h2>

            <p>Hello ${escapeHtml(assignee.name || 'User')},</p>

            <p>A new task has been assigned to you.</p>

            <div style="padding: 15px; background: #f3f4f6; border-radius: 8px;">
              <p>
                <strong>Task Title:</strong>
                ${escapeHtml(task.title)}
              </p>

              <p>
                <strong>Description:</strong>
                ${escapeHtml(task.description || 'No description')}
              </p>

              <p>
                <strong>Priority:</strong>
                ${escapeHtml(task.priority)}
              </p>

              <p>
                <strong>Due Date:</strong>
                ${escapeHtml(
                  new Date(task.dueDate).toLocaleDateString('en-IN')
                )}
              </p>

              <p>
                <strong>Created By:</strong>
                ${escapeHtml(creator.name || 'User')}
              </p>
            </div>

            <p>
              Please log in to your Task Management application
              to view your task.
            </p>
          </div>
        `;

        await sendEmail(
          assignee.email,
          'New Task Assigned - Task Management',
          html
        );

        emailSent = true;

        console.log('Task email sent to:', assignee.email);
      }
    } catch (emailError) {
      // Email failure should not undo task creation.
      console.error(
        'Failed to send task email:',
        emailError.message
      );
    }

    return res.status(201).json({
      message: 'Task created successfully',
      task,
      emailSent,
    });
  } catch (error) {
    console.error('Create task error:', error);

    return res.status(500).json({
      message: 'Failed to create task',
      error: error.message,
    });
  }
};

// ======================================================
// GET ALL TASKS
// ======================================================

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

    if (!userId) {
      return res.status(401).json({
        message: 'Please login first',
      });
    }

    // Validate view
    const validViews = ['all', 'created', 'assigned'];

    if (!validViews.includes(view)) {
      return res.status(400).json({
        message: 'Invalid task view',
      });
    }

    // Validate status
    if (
      status &&
      status !== 'all' &&
      !STATUSES.includes(status)
    ) {
      return res.status(400).json({
        message: 'Invalid status',
      });
    }

    // Validate priority
    if (
      priority &&
      priority !== 'all' &&
      !PRIORITIES.includes(priority)
    ) {
      return res.status(400).json({
        message: 'Invalid priority',
      });
    }

    // Validate assignee ID
    if (
      assignee &&
      !mongoose.isValidObjectId(assignee)
    ) {
      return res.status(400).json({
        message: 'Invalid assignee ID',
      });
    }

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
      conditions.push({
        $or: [
          { createdBy: userId },
          { assignedTo: userId },
        ],
      });
    }

    // Search by title
    if (typeof search === 'string' && search.trim()) {
      conditions.push({
        title: {
          $regex: escapeRegex(search.trim()),
          $options: 'i',
        },
      });
    }

    // Filter by priority
    if (priority && priority !== 'all') {
      conditions.push({ priority });
    }

    // Filter by assignee
    if (assignee) {
      conditions.push({
        assignedTo: new mongoose.Types.ObjectId(assignee),
      });
    }

    // Validate and filter due dates
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

      // Include the entire selected end date.
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

    query.$and = conditions;

    const tasks = await Task.find(query)
      .populate(POPULATE)
      .sort({ dueDate: 1 });

    // Get the assigned user's status.
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

    // Filter by status
    let filteredTasks = tasks;

    if (status && status !== 'all') {
      filteredTasks = tasks.filter(
        (task) => getAssigneeStatus(task) === status
      );
    }

    // Tasks due today are not overdue.
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

    // Filter overdue tasks
    const overdueOnly =
      overdue === true || overdue === 'true';

    if (overdueOnly) {
      result = result.filter((task) => task.isOverdue);
    }

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

// ======================================================
// GET SINGLE TASK
// ======================================================

export const getTask = async (req, res) => {
  try {
    const userId = req.user?._id || req.user?.id;
    const { id } = req.body;

    if (!userId) {
      return res.status(401).json({
        message: 'Please log in',
      });
    }

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        message: 'Invalid task ID',
      });
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
      return res.status(404).json({
        message: 'Task not found',
      });
    }

    return res.status(200).json({ task });
  } catch (error) {
    console.error('Get task error:', error);

    return res.status(500).json({
      message: 'Failed to get task',
    });
  }
};

// ======================================================
// UPDATE TASK
// ======================================================

export const updateTask = async (req, res) => {
  try {
    const userId = req.user?._id || req.user?.id;
    const { id, title, description, priority, dueDate } = req.body;

    if (!userId) {
      return res.status(401).json({
        message: 'Please log in',
      });
    }

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        message: 'Invalid task ID',
      });
    }

    // Only the creator can edit.
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

    // Validate title and check duplicates.
    if (title !== undefined) {
      if (typeof title !== 'string' || !title.trim()) {
        return res.status(400).json({
          message: 'Title cannot be empty',
        });
      }

      const existingTask = await Task.findOne({
        _id: { $ne: task._id },
        title: {
          $regex: `^${escapeRegex(title.trim())}$`,
          $options: 'i',
        },
        isDeleted: false,
      });

      if (existingTask) {
        return res.status(400).json({
          message: 'A task with this title already exists',
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
    console.error('Update task error:', error);

    return res.status(500).json({
      message: 'Failed to update task',
    });
  }
};

// ======================================================
// UPDATE TASK STATUS
// ======================================================

const updateStatus = async (req, res) => {
  try {
    const { id, status } = req.body;

    if (!id || !status) {
      return res.status(400).json({
        message: 'Task ID and status are required',
      });
    }

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        message: 'Invalid task ID',
      });
    }

    if (!STATUSES.includes(status)) {
      return res.status(400).json({
        message: 'Invalid task status',
      });
    }

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

    const task = await Task.findById(id);

    if (!task || task.isDeleted) {
      return res.status(404).json({
        message: 'Task not found',
      });
    }

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

    if (!isCreator && !isAssignee) {
      return res.status(403).json({
        message: 'You cannot update this task',
      });
    }

    // Find the single assignee's status.
    const statusRecord = (task.statuses || []).find(
      (item) =>
        String(item.user?._id || item.user || '') ===
        assigneeId
    );

    const currentStatus = statusRecord?.status || 'Open';

    // Completed tasks cannot be changed.
    if (currentStatus === 'Completed') {
      return res.status(403).json({
        message: 'Completed tasks cannot be changed',
      });
    }

    // Build the set of statuses this user may move the task to.
    // A self-assigned task (creator === assignee) gets both sets,
    // so it can go Open -> In Progress -> In Review -> Completed.
    const allowed = new Set();

    if (isAssignee && currentStatus !== 'On Hold') {
      ['Open', 'In Progress', 'In Review'].forEach((s) =>
        allowed.add(s)
      );
    }

    if (isCreator) {
      if (currentStatus === 'In Progress') allowed.add('On Hold');
      if (currentStatus === 'On Hold') allowed.add('In Progress');
      if (currentStatus === 'In Review') allowed.add('Completed');
    }

    if (!allowed.has(status)) {
      if (isAssignee && !isCreator && currentStatus === 'On Hold') {
        return res.status(403).json({
          message: 'Task is On Hold. Wait for the creator to reopen it.',
        });
      }

      return res.status(403).json({
        message: `You cannot change this task from ${currentStatus} to ${status}`,
      });
    }

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

    
    // Save the updated status first
    await task.save();

    // Get task creator and assignee details
    const updatedTask = await Task.findById(id)
      .populate('createdBy', 'name email')
      .populate('assignedTo', 'name email')
      .populate('statuses.user', 'name email');

    // Send status-change emails
    try {
      const creator = updatedTask.createdBy;
      const assignee = updatedTask.assignedTo;

      const recipients = [
        creator?.email,
        assignee?.email,
      ].filter(Boolean);

      // Avoid sending twice if both users are the same
      const uniqueRecipients = [...new Set(recipients)];

      const changedBy = String(userId) === creator?._id.toString()
        ? creator.name
        : assignee?.name || 'User';

      const html = `
        <div style="font-family: Arial, sans-serif; padding: 20px;">
          <h2>Task Status Updated</h2>

          <p>Hello,</p>

          <p>The status of a task has changed.</p>

          <div style="background: #f3f4f6; padding: 15px; border-radius: 8px;">
            <p>
              <strong>Task:</strong>
              ${updatedTask.title}
            </p>

            <p>
              <strong>Previous Status:</strong>
              ${currentStatus}
            </p>

            <p>
              <strong>New Status:</strong>
              ${status}
            </p>

            <p>
              <strong>Changed By:</strong>
              ${changedBy}
            </p>
          </div>

          <p>Please log in to your Task Management application
          to view the task.</p>
        </div>
      `;

      for (const email of uniqueRecipients) {
        await sendEmail(
          email,
          `Task Status Changed - ${updatedTask.title}`,
          html
        );
      }

      console.log('Status-change emails sent successfully');
    } catch (emailError) {
      console.error(
        'Failed to send status-change email:',
        emailError.message
      );
    }

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

// ======================================================
// DELETE TASK (SOFT DELETE)
// ======================================================

export const deleteTask = async (req, res) => {
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

    const task = await Task.findById(id);

    if (!task || task.isDeleted) {
      return res.status(404).json({
        message: 'Task not found',
      });
    }

    const creatorId = String(
      task.createdBy?._id || task.createdBy
    );

    if (creatorId !== String(userId)) {
      return res.status(403).json({
        message: 'Only the task creator can delete this task',
      });
    }

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

// ======================================================
// GET DASHBOARD STATISTICS
// ======================================================

export const getStats = async (req, res) => {
  try {
    const userId = req.user?._id || req.user?.id;

    if (!userId) {
      return res.status(401).json({
        message: 'Please log in',
      });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [
      created,
      assigned,
      inProgress,
      completed,
      overdue,
    ] = await Promise.all([
      Task.countDocuments({
        createdBy: userId,
        isDeleted: false,
      }),

      Task.countDocuments({
        assignedTo: userId,
        isDeleted: false,
      }),

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

// ======================================================
// REASSIGN TASK
// ======================================================

export const assignTask = async (req, res) => {
  try {
    const userId = req.user?._id || req.user?.id;
    const { id, assignedTo } = req.body;

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

    if (!assignedTo || !mongoose.isValidObjectId(assignedTo)) {
      return res.status(400).json({
        message: 'Please select a valid assignee',
      });
    }

    const task = await Task.findById(id);

    if (!task || task.isDeleted) {
      return res.status(404).json({
        message: 'Task not found',
      });
    }

    const creatorId = String(
      task.createdBy?._id || task.createdBy
    );

    if (creatorId !== String(userId)) {
      return res.status(403).json({
        message: 'Only the task creator can reassign this task',
      });
    }

    // Reassign only while the task is Open.
    const currentAssigneeId = String(
      task.assignedTo?._id || task.assignedTo || ''
    );

    const currentStatusRecord = (task.statuses || []).find(
      (item) =>
        String(item.user?._id || item.user || '') ===
        currentAssigneeId
    );

    const currentStatus =
      currentStatusRecord?.status || task.overallStatus || 'Open';

    if (currentStatus !== 'Open') {
      return res.status(400).json({
        message: 'You can reassign the task only when it is Open',
      });
    }

    const assigneeUser = await User.findById(assignedTo);

    if (!assigneeUser) {
      return res.status(404).json({
        message: 'Assignee not found',
      });
    }

    // Assign exactly one user and reset their status.
    task.assignedTo = assigneeUser._id;
    task.statuses = [
      {
        user: assigneeUser._id,
        status: 'Open',
        completedAt: null,
      },
    ];

    await task.save();

    const updatedTask = await Task.findById(task._id)
      .populate(POPULATE);

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

// ======================================================
// DOWNLOAD TASK ATTACHMENT
// ======================================================

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

    const creatorId = String(
      task.createdBy?._id || task.createdBy
    );

    const assigneeId = String(
      task.assignedTo?._id || task.assignedTo
    );

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
    const filename = path.basename(attachment.filename);
    const filePath = path.resolve(uploadRoot, filename);

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
      message: 'Failed to download task attachment',
    });
  }
};

// ======================================================
// REMOVE TASK ATTACHMENT
// ======================================================

export const removeTaskAttachment = async (req, res) => {
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

    const creatorId = String(
      task.createdBy?._id || task.createdBy
    );

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

    // Update the database first, then remove the file, so a failed
    // save never leaves a record pointing at a missing file.
    task.attachment = undefined;
    task.markModified('attachment');

    await task.save();

    // Ignore the file if it is already missing.
    try {
      await fs.unlink(filePath);
    } catch (error) {
      if (error.code !== 'ENOENT') {
        console.error('Attachment file cleanup failed:', error);
      }
    }

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
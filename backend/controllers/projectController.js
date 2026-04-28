const Project = require('../models/Project');
const CalendarEvent = require('../models/CalendarEvent');
const Contract = require('../models/Contract');
const ProjectProposal = require('../models/ProjectProposal');
const { User } = require('../models/User');
const Product = require('../models/Product');
const mongoose = require('mongoose');
const { logAction } = require('../utils/actionLogger');

const normalizeUploadedPath = (filePath = '') => {
  const normalized = String(filePath || '').replace(/\\/g, '/').trim();
  if (!normalized) return '';
  return normalized.startsWith('/') ? normalized : `/${normalized}`;
};

// @desc    Create a new project
// @route   POST /api/projects
// @access  Private (Artisan only)
const createProject = async (req, res) => {
  try {
    const { title, description, location, budget, startDate, endDate, progress, tasks } = req.body;

    const missingFields = [];
    if (!title) missingFields.push('title');
    if (!description) missingFields.push('description');
    if (!location) missingFields.push('location');
    if (budget === undefined || budget === null || budget === '') missingFields.push('budget');
    if (!startDate) missingFields.push('startDate');
    if (!endDate) missingFields.push('endDate');

    if (missingFields.length) {
      return res.status(400).json({
        message: 'Please add all required fields',
        missingFields,
      });
    }

    const normalizedBudget = Number(budget);
    if (!Number.isFinite(normalizedBudget) || normalizedBudget < 0) {
      return res.status(400).json({ message: 'Budget must be a valid non-negative number' });
    }

    const parsedStartDate = new Date(startDate);
    const parsedEndDate = new Date(endDate);
    if (Number.isNaN(parsedStartDate.getTime()) || Number.isNaN(parsedEndDate.getTime())) {
      return res.status(400).json({ message: 'Invalid project dates' });
    }
    if (parsedEndDate <= parsedStartDate) {
      return res.status(400).json({ message: 'End date must be after start date' });
    }

    // Création du projet relié à l'artisan connecté (req.user._id vient du token)
    const project = await Project.create({
      title,
      description,
      location,
      budget: normalizedBudget,
      startDate: parsedStartDate,
      endDate: parsedEndDate,
      progress: Number.isFinite(Number(progress)) ? Number(progress) : 0,
      tasks: Array.isArray(tasks) ? tasks : [],
      artisan: req.user._id 
    });

    await logAction(req, {
      actionKey: 'artisan.project.create',
      actionLabel: 'Created Project',
      entityType: 'project',
      entityId: project._id,
      description: `Project \"${project.title}\" created by artisan.`,
      metadata: {
        title: project.title,
        budget: project.budget,
      },
    });

    // Sync: create a calendar event for this project
    try {
      await CalendarEvent.create({
        artisanId: req.user._id,
        title: project.title,
        type: 'projet',
        startDate: project.startDate,
        endDate: project.endDate,
        description: project.description || '',
        location: project.location || '',
        projectId: project._id,
        isPublic: true,
      });
    } catch (calErr) {
      console.error('Calendar sync error on project create:', calErr);
    }

    res.status(201).json(project);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error while creating project' });
  }
};

// @desc    Get all projects for logged in artisan
// @route   GET /api/projects
// @access  Private (Artisan only)
const getProjects = async (req, res) => {
  try {
    // On cherche tous les projets dont l'artisan correspond à l'ID de l'utilisateur connecté
    const projects = await Project.find({ artisan: req.user._id })
      .populate('materials')
      .populate('expertId', 'firstName lastName email profilePhoto')
      .populate('contractId', 'status signedByArtisanAt _id')
      .sort({ createdAt: -1 });
    res.status(200).json(projects);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error while fetching projects' });
  }
};

// @desc    Update a project
// @route   PUT /api/projects/:id
// @access  Private (Artisan only)
const updateProject = async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);

    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    // Vérifier que le projet appartient à l'artisan connecté
    if (project.artisan.toString() !== req.user._id.toString()) {
      return res.status(401).json({ message: 'Not authorized' });
    }

    const updatePayload = { ...req.body };

    if (Object.prototype.hasOwnProperty.call(updatePayload, 'materials')) {
      if (!Array.isArray(updatePayload.materials)) {
        return res.status(400).json({ message: 'materials must be an array of product IDs' });
      }

      const normalizedMaterials = updatePayload.materials
        .flatMap((item) => (Array.isArray(item) ? item : [item]))
        .map((item) => (typeof item === 'object' && item !== null ? item._id : item))
        .filter((id) => typeof id === 'string')
        .map((id) => id.trim());

      const invalidMaterialId = normalizedMaterials.find(
        (id) => !mongoose.Types.ObjectId.isValid(id)
      );

      if (invalidMaterialId) {
        return res.status(400).json({
          message: `Invalid material ID: ${invalidMaterialId}`,
        });
      }

      // Keep duplicates — each occurrence represents one unit of quantity
      updatePayload.materials = normalizedMaterials;
    }

    const updatedProject = await Project.findByIdAndUpdate(
      req.params.id,
      updatePayload,
      { returnDocument: 'after', runValidators: true }
    ).populate('materials');

    // Sync: update linked calendar event if dates or title changed
    try {
      const calUpdate = {};
      if (updatePayload.title) calUpdate.title = updatePayload.title;
      if (updatePayload.startDate) calUpdate.startDate = new Date(updatePayload.startDate);
      if (updatePayload.endDate) calUpdate.endDate = new Date(updatePayload.endDate);
      if (updatePayload.description !== undefined) calUpdate.description = updatePayload.description;
      if (Object.keys(calUpdate).length > 0) {
        await CalendarEvent.findOneAndUpdate({ projectId: req.params.id }, calUpdate);
      }
    } catch (calErr) {
      console.error('Calendar sync error on project update:', calErr);
    }

    res.status(200).json(updatedProject);

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error while updating project' });
  }
};

// @desc    Delete a project
// @route   DELETE /api/projects/:id
// @access  Private (Artisan only)
const deleteProject = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid project ID' });
    }

    const project = await Project.findById(id);

    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    if (project.artisan.toString() !== req.user._id.toString()) {
      return res.status(401).json({ message: 'Not authorized' });
    }

    await Project.deleteOne({ _id: project._id });

    // Sync: remove linked calendar event
    try {
      await CalendarEvent.deleteOne({ projectId: project._id });
    } catch (calErr) {
      console.error('Calendar sync error on project delete:', calErr);
    }

    await logAction(req, {
      actionKey: 'artisan.project.delete',
      actionLabel: 'Deleted Project',
      entityType: 'project',
      entityId: project._id,
      description: `Project "${project.title}" deleted by artisan.`,
      metadata: {
        title: project.title,
      },
    });

    return res.status(200).json({
      message: 'Project deleted successfully',
      id: String(project._id),
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Server error while deleting project' });
  }
};

// @desc    Upload/update image for a personal material in a project
// @route   POST /api/projects/:id/personal-materials/:materialId/image
// @access  Private (Artisan only)
const uploadPersonalMaterialImage = async (req, res) => {
  try {
    const { id: projectId, materialId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(projectId)) {
      return res.status(400).json({ message: 'Invalid project ID' });
    }

    if (!mongoose.Types.ObjectId.isValid(materialId)) {
      return res.status(400).json({ message: 'Invalid personal material ID' });
    }

    if (!req.file) {
      return res.status(400).json({ message: 'Image file is required' });
    }

    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    if (project.artisan.toString() !== req.user._id.toString()) {
      return res.status(401).json({ message: 'Not authorized' });
    }

    const personalMaterial = project.personalMaterials.id(materialId);
    if (!personalMaterial) {
      return res.status(404).json({ message: 'Personal material not found' });
    }

    personalMaterial.image = normalizeUploadedPath(req.file.path);
    await project.save();

    const updatedProject = await Project.findById(projectId).populate('materials');

    return res.status(200).json({
      message: 'Personal material image uploaded successfully',
      personalMaterial,
      project: updatedProject,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Server error while uploading personal material image' });
  }
};

// @desc    Get collaborative projects where the expert is involved
// @route   GET /api/projects/expert/:expertId
// @access  Private (expert or admin)
const getExpertProjects = async (req, res) => {
  try {
    const { expertId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(expertId)) {
      return res.status(400).json({ message: 'Invalid expert ID' });
    }

    // Only the expert themselves (or admin) can access
    if (
      req.user.role !== 'admin' &&
      req.user._id.toString() !== expertId
    ) {
      return res.status(403).json({ message: 'Not authorized to view these projects' });
    }

    const projects = await Project.find({ expertId, isCollaborative: true })
      .populate('artisan', 'firstName lastName email profilePhoto domain location')
      .populate('contractId', 'status signedByArtisanAt signatureData _id')
      .sort({ createdAt: -1 });

    return res.status(200).json(projects);
  } catch (error) {
    console.error('getExpertProjects error:', error);
    return res.status(500).json({ message: 'Server error while fetching expert projects' });
  }
};

module.exports = {
  createProject,
  getProjects,
  getExpertProjects,
  updateProject,
  deleteProject,
  uploadPersonalMaterialImage,
};

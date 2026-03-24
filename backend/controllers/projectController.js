const Project = require('../models/Project');
const mongoose = require('mongoose');
const { logAction } = require('../utils/actionLogger');

// @desc    Create a new project
// @route   POST /api/projects
// @access  Private (Artisan only)
const createProject = async (req, res) => {
  try {
    const { title, description, location, budget, startDate, endDate, progress, tasks } = req.body;

    // Validation basique
    if (!title || !description || !location || !startDate || !endDate) {
      return res.status(400).json({ message: 'Please add all fields' });
    }

    // Création du projet relié à l'artisan connecté (req.user._id vient du token)
    const project = await Project.create({
      title,
      description,
      location,
      budget: Number.isFinite(Number(budget)) ? Number(budget) : 0,
      startDate,
      endDate,
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

      updatePayload.materials = [...new Set(normalizedMaterials)];
    }

    const updatedProject = await Project.findByIdAndUpdate(
      req.params.id,
      updatePayload,
      { returnDocument: 'after', runValidators: true }
    );

    res.status(200).json(updatedProject);

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error while updating project' });
  }
};

module.exports = {
  createProject,
  getProjects,
  updateProject 
};
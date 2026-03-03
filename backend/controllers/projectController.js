const Project = require('../models/Project');

// =============================
// Create Project
// =============================
const createProject = async (req, res) => {
  try {
    const { title, description, location, budget, startDate, endDate } = req.body;

    if (!title || !description || !location || !budget || !startDate || !endDate) {
      return res.status(400).json({ message: 'Please add all fields' });
    }

    const project = await Project.create({
      title,
      description,
      location,
      budget,
      startDate,
      endDate,
      artisan: req.user._id 
    });

    res.status(201).json(project);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error while creating project' });
  }
};

// =============================
// Get Projects (Logged Artisan)
// =============================
const getProjects = async (req, res) => {
  try {
    const projects = await Project.find({ artisan: req.user._id })
      .sort({ createdAt: -1 });

    res.status(200).json(projects);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error while fetching projects' });
  }
};

// =============================
// Get Projects by Artisan ID
// =============================
const getProjectsByArtisan = async (req, res) => {
  try {
    const projects = await Project.find({ 
      artisan: req.params.artisanId 
    }).sort({ createdAt: -1 });

    res.status(200).json(projects);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error while fetching artisan projects' });
  }
};

// =============================
// Update Project
// =============================
const updateProject = async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);

    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    if (project.artisan.toString() !== req.user._id.toString()) {
      return res.status(401).json({ message: 'Not authorized' });
    }

    const updatedProject = await Project.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
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
  updateProject,
  getProjectsByArtisan
};
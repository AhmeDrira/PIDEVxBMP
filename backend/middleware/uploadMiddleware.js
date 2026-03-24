const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Créer le dossier 'uploads/' s'il n'existe pas
const dir = './uploads';
if (!fs.existsSync(dir)){
    fs.mkdirSync(dir);
}

// Configuration du stockage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/'); // Les fichiers iront dans le dossier "uploads"
  },
  filename: function (req, file, cb) {
    // Nom unique pour éviter d'écraser des fichiers du même nom
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

// MODIFIÉ : Filtre pour n'accepter que les IMAGES (jpg, jpeg, png)
const fileFilter = (req, file, cb) => {
  // On définit les extensions d'images autorisées
  const allowedFileTypes = /jpeg|jpg|png|pdf/;
  
  // Vérification de l'extension
  const extname = allowedFileTypes.test(path.extname(file.originalname).toLowerCase());
  // Vérification du type MIME
  const mimetype = allowedFileTypes.test(file.mimetype);

  if (extname && mimetype) {
    return cb(null, true);
  } else {
    // Message d'erreur clair pour l'utilisateur
    cb(new Error('Seuls les formats .jpg, .jpeg, et .png sont autorisés !'));
  }
};

const upload = multer({ 
  storage: storage,
  fileFilter: fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 } // Réduit à 5MB (suffisant pour des photos)
});

module.exports = upload;
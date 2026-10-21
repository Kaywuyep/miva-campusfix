const router = require('express').Router();
const { body } = require('express-validator');
const Category = require('../models/Category');
const ServiceRequest = require('../models/ServiceRequest');
const { protect, authorize } = require('../middleware/auth');
const validate = require('../middleware/validate');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { audit } = require('../utils/activity');

router.use(protect);

// GET /api/categories — any logged-in user (fills the request form dropdown)
router.get('/', asyncHandler(async (req, res) => {
  const filter = req.user.role.name === 'admin' ? {} : { isActive: true };
  res.json({ success: true, data: await Category.find(filter).sort({ name: 1 }) });
}));

router.post(
  '/',
  authorize('admin'),
  [body('name').trim().notEmpty().withMessage('Name is required'), body('description').optional().trim()],
  validate,
  asyncHandler(async (req, res) => {
    const cat = await Category.create(req.body);
    await audit(req, 'CATEGORY_CREATED', 'Category', cat._id, cat.name);
    res.status(201).json({ success: true, message: 'Category created', data: cat });
  })
);

router.put(
  '/:id',
  authorize('admin'),
  [body('name').optional().trim().notEmpty(), body('isActive').optional().isBoolean().toBoolean()],
  validate,
  asyncHandler(async (req, res) => {
    const cat = await Category.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!cat) throw new ApiError(404, 'Category not found');
    await audit(req, 'CATEGORY_UPDATED', 'Category', cat._id, cat.name);
    res.json({ success: true, message: 'Category updated', data: cat });
  })
);

router.delete(
  '/:id',
  authorize('admin'),
  asyncHandler(async (req, res) => {
    if (await ServiceRequest.exists({ category: req.params.id })) {
      throw new ApiError(409, 'Category is in use — deactivate it instead');
    }
    const cat = await Category.findByIdAndDelete(req.params.id);
    if (!cat) throw new ApiError(404, 'Category not found');
    await audit(req, 'CATEGORY_DELETED', 'Category', cat._id, cat.name);
    res.json({ success: true, message: 'Category deleted' });
  })
);

module.exports = router;

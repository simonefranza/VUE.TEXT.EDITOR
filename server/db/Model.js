const mongoose = require('mongoose');
const joi = require('joi');

const dataSchema = mongoose.Schema({
  docID: {
    type: Number,
    required: true,
  },
  changes: {
    type: Array,
    required: true,
  }
  //userFrom: {
  //  type: mongoose.Schema.Types.ObjectId,
  //  required: true,
  //},
  //userTo: {
  //  type: mongoose.Schema.Types.ObjectId,
  //  required: true,
  //},
  }, { timestamps: true });

const validation = joi.object({
  code: joi.number().required(),
  char: joi.string().length(1).required(),
  identifier: joi.array().items(joi.number()),
  uniqueID: joi.string().required(),
});

module.exports = {
  dataSchema: mongoose.model('documents', dataSchema),
  validationSchema: validation,
};
